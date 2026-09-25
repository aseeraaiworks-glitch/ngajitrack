-- Forward-only approval gate. Private records are reachable only through bounded RPCs.
-- Masks: 0 NONE (explicit only), 1 WALI, 2 LEMBAGA_A, 3 both.
create table private.enrollment_policies (
  institution_id uuid primary key references public.institutions(id),
  requirements integer not null check (requirements between 0 and 3)
);
create table private.program_approval_policies (
  program_id uuid primary key references public.programs(id),
  requirements integer not null check (requirements between 0 and 3)
);
create table private.enrollment_legacy_exceptions (
  enrollment_id uuid primary key references public.institution_enrollments(id),
  program_ids uuid[] not null,
  recorded_at timestamptz not null default now()
);
create table private.enrollment_approval_requests (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.institution_enrollments(id),
  program_id uuid references public.programs(id),
  requirements integer not null check (requirements between 0 and 3),
  context jsonb not null,
  requested_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);
create unique index enrollment_approval_open_scope on private.enrollment_approval_requests
  (enrollment_id,coalesce(program_id,'00000000-0000-0000-0000-000000000000'::uuid)) where cancelled_at is null;
create table private.enrollment_approval_decisions (
  request_id uuid not null references private.enrollment_approval_requests(id),
  party text not null check(party in ('WALI','LEMBAGA_A')),
  actor_profile_id uuid not null references public.profiles(id),
  approved boolean not null,
  decided_at timestamptz not null default now(),
  primary key(request_id,party)
);
revoke all on private.enrollment_policies,private.program_approval_policies,
  private.enrollment_legacy_exceptions,private.enrollment_approval_requests,
  private.enrollment_approval_decisions from public,anon,authenticated,service_role;
alter table private.enrollment_policies enable row level security;
alter table private.program_approval_policies enable row level security;
alter table private.enrollment_legacy_exceptions enable row level security;
alter table private.enrollment_approval_requests enable row level security;
alter table private.enrollment_approval_decisions enable row level security;
create index approval_request_enrollment on private.enrollment_approval_requests(enrollment_id);

insert into private.enrollment_legacy_exceptions(enrollment_id,program_ids)
select e.id,coalesce(array_agg(distinct pe.program_id) filter(where pe.status='ACTIVE' and pe.deleted_at is null),'{}'::uuid[])
from public.institution_enrollments e left join public.program_enrollments pe on pe.institution_enrollment_id=e.id
where e.status='ACTIVE' and e.enrollment_type in ('TEMPORARY','HOLIDAY') and e.deleted_at is null
group by e.id;
insert into public.audit_logs(institution_id,actor_role_code,action,entity_type,entity_id,new_value)
select e.institution_id,'SYSTEM','LEGACY_APPROVAL_EXCEPTION','institution_enrollments',e.id,
  jsonb_build_object('reason','Active before approval migration; not an approval','program_ids',l.program_ids)
from private.enrollment_legacy_exceptions l join public.institution_enrollments e on e.id=l.enrollment_id;

create function private.enrollment_approval_context(e public.institution_enrollments) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_build_object('institution_id',e.institution_id,'student_id',e.student_id,
 'started_at',e.started_at,'scheduled_end_at',e.scheduled_end_at,'previous_institution_id',e.previous_institution_id,
 'enrollment_type',e.enrollment_type,'source_type',e.source_type,'reason',e.reason)
$$;
create function private.approval_mask(tenant uuid,program uuid default null) returns integer
language sql stable security definer set search_path='' as $$
 select coalesce((select requirements from private.enrollment_policies where institution_id=tenant),1)
 | coalesce((select requirements from private.program_approval_policies where program_id=program),0)
$$;
create function public.set_enrollment_approval_policy(tenant_id uuid,requirements text,program_id uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare mask integer; parent_mask integer;
begin
 if not private.has_role(tenant_id,'INSTITUTION_ADMIN') then raise exception 'Institution administrator required' using errcode='42501'; end if;
 mask:=case requirements when 'NONE' then 0 when 'WALI' then 1 when 'LEMBAGA_A' then 2 when 'WALI+LEMBAGA_A' then 3 end;
 if mask is null then raise exception 'Invalid approval policy' using errcode='22023'; end if;
 -- Serialize policy changes with request snapshots, including program overrides.
 perform 1 from public.institutions where id=tenant_id for update;
 if program_id is null then
  insert into private.enrollment_policies values(tenant_id,mask) on conflict(institution_id) do update set requirements=excluded.requirements;
 else
  if not exists(select 1 from public.programs p where p.id=program_id and p.institution_id=tenant_id and p.deleted_at is null) then raise exception 'Program unavailable' using errcode='42501'; end if;
  parent_mask:=private.approval_mask(tenant_id);
  if (mask | parent_mask)<>mask then raise exception 'Program cannot weaken institution policy' using errcode='23514'; end if;
  insert into private.program_approval_policies values(program_id,mask) on conflict on constraint program_approval_policies_pkey do update set requirements=excluded.requirements;
 end if;
 insert into public.audit_logs(institution_id,actor_profile_id,action,entity_type,entity_id,new_value)
 values(tenant_id,private.current_profile_id(),'SET_APPROVAL_POLICY','approval_policy',coalesce(program_id,tenant_id),jsonb_build_object('requirements',requirements));
end $$;

create function private.profile_has_role(actor uuid,tenant uuid,role_code text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.institution_members m join public.roles r on r.id=m.role_id
 join public.profiles p on p.id=m.profile_id join public.institutions i on i.id=m.institution_id
 where m.profile_id=actor and m.institution_id=tenant and r.code=role_code
 and m.status='ACTIVE' and m.deleted_at is null and m.ended_at is null and (m.joined_at is null or m.joined_at<=now())
 and p.is_active and p.deleted_at is null and i.is_active and i.deleted_at is null and i.status in ('ACTIVE','TRIAL'))
$$;
create function private.approval_party_allowed(request_id uuid,party text,actor uuid default private.current_profile_id()) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.enrollment_approval_requests r
 join public.institution_enrollments e on e.id=r.enrollment_id
 join public.student_profiles target on target.id=e.student_id
 where r.id=request_id and r.cancelled_at is null and target.student_identity_id is not null
 and r.context=private.enrollment_approval_context(e)
 and e.deleted_at is null and e.status in ('PENDING','ACTIVE')
 and e.scheduled_end_at>private.institution_today(e.institution_id)
 and case party
 when 'LEMBAGA_A' then (r.requirements & 2)=2
  and e.previous_institution_id is not null and e.previous_institution_id<>e.institution_id
  and private.profile_has_role(actor,e.previous_institution_id,'INSTITUTION_ADMIN')
  and exists(select 1 from public.student_profiles source join public.institution_enrollments se on se.student_id=source.id
   where source.institution_id=e.previous_institution_id and source.student_identity_id=target.student_identity_id
   and source.deleted_at is null and source.status='ACTIVE' and private.enrollment_operational(se.id))
 when 'WALI' then (r.requirements & 1)=1 and exists(
  select 1 from public.student_profiles child join public.guardian_students link on link.student_id=child.id and link.institution_id=child.institution_id
  join public.guardian_profiles g on g.id=link.guardian_id and g.institution_id=link.institution_id
  where child.student_identity_id=target.student_identity_id and child.deleted_at is null and child.status='ACTIVE'
   and link.status='VERIFIED' and link.deleted_at is null and g.profile_id=actor
   and g.status='ACTIVE' and g.deleted_at is null and private.profile_has_role(actor,g.institution_id,'GUARDIAN'))
 else false end)
$$;

create function public.request_enrollment_approval(enrollment_id uuid,program_id uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare e public.institution_enrollments; mask integer; result uuid;
begin
 select * into e from public.institution_enrollments where id=enrollment_id for update;
 if not found or not private.has_role(e.institution_id,'INSTITUTION_ADMIN') then raise exception 'Institution administrator required' using errcode='42501'; end if;
 if e.enrollment_type='REGULAR' or e.status not in ('PENDING','ACTIVE') or e.deleted_at is not null or e.scheduled_end_at<=private.institution_today(e.institution_id) then raise exception 'Open temporary enrollment required' using errcode='23514'; end if;
 if not exists(select 1 from public.student_profiles s join public.student_identities i on i.id=s.student_identity_id where s.id=e.student_id and i.status='ACTIVE' and i.deleted_at is null) then raise exception 'Verified identity binding required' using errcode='23514'; end if;
 if program_id is not null and not exists(select 1 from public.programs p where p.id=program_id and p.institution_id=e.institution_id and p.is_active and p.deleted_at is null) then raise exception 'Program unavailable' using errcode='42501'; end if;
 perform 1 from public.institutions where id=e.institution_id for share;
 mask:=private.approval_mask(e.institution_id,program_id);
 if (mask & 2)=2 and (e.previous_institution_id is null or e.previous_institution_id=e.institution_id or not exists(
  select 1 from public.student_profiles s join public.student_profiles t on t.student_identity_id=s.student_identity_id
  join public.institution_enrollments se on se.student_id=s.id
  where t.id=e.student_id and s.institution_id=e.previous_institution_id and s.deleted_at is null and s.status='ACTIVE' and private.enrollment_operational(se.id))) then raise exception 'Verified source institution required' using errcode='23514'; end if;
 select r.id into result from private.enrollment_approval_requests r where r.enrollment_id=e.id and r.program_id is not distinct from request_enrollment_approval.program_id and r.cancelled_at is null;
 if result is not null then return result; end if;
 insert into private.enrollment_approval_requests(enrollment_id,program_id,requirements,context,requested_by)
 values(e.id,program_id,mask,private.enrollment_approval_context(e),private.current_profile_id()) returning id into result;
 insert into public.audit_logs(institution_id,actor_profile_id,action,entity_type,entity_id,new_value)
 values(e.institution_id,private.current_profile_id(),'REQUEST_APPROVAL','enrollment_approval_requests',result,jsonb_build_object('requirements',mask,'program_id',program_id));
 return result;
end $$;

create function public.my_enrollment_approval_requests() returns table(request_id uuid,enrollment_id uuid,student_name text,destination_name text,source_name text,program_name text,started_at date,scheduled_end_at date,requirements integer)
language sql stable security definer set search_path='' as $$
 select r.id,e.id,s.display_name,d.name,src.name,p.name,e.started_at,e.scheduled_end_at,r.requirements
 from private.enrollment_approval_requests r join public.institution_enrollments e on e.id=r.enrollment_id
 join public.student_profiles s on s.id=e.student_id join public.institutions d on d.id=e.institution_id
 left join public.institutions src on src.id=e.previous_institution_id left join public.programs p on p.id=r.program_id
 where r.cancelled_at is null and r.context=private.enrollment_approval_context(e)
 and (private.has_role(e.institution_id,'INSTITUTION_ADMIN') or private.approval_party_allowed(r.id,'WALI') or private.approval_party_allowed(r.id,'LEMBAGA_A'))
$$;
create function public.decide_enrollment_approval(request_id uuid,party text,approved boolean) returns void
language plpgsql security definer set search_path='' as $$
declare r private.enrollment_approval_requests; e public.institution_enrollments;
begin
 select ie.* into e from public.institution_enrollments ie join private.enrollment_approval_requests ar on ar.enrollment_id=ie.id where ar.id=request_id for update of ie;
 select * into r from private.enrollment_approval_requests ar where ar.id=request_id for update;
 if not found or not private.approval_party_allowed(request_id,party) then raise exception 'Approval unavailable or unauthorized' using errcode='42501'; end if;
 if approved is null then raise exception 'Decision required' using errcode='22023'; end if;
 if exists(select 1 from private.enrollment_approval_decisions a where a.request_id=r.id and a.party=decide_enrollment_approval.party) then
  if exists(select 1 from private.enrollment_approval_decisions a where a.request_id=r.id and a.party=decide_enrollment_approval.party and a.approved=decide_enrollment_approval.approved and a.actor_profile_id=private.current_profile_id()) then return; end if;
  raise exception 'Decision already recorded; create a new request' using errcode='23514';
 end if;
 insert into private.enrollment_approval_decisions values(r.id,party,private.current_profile_id(),approved,now());
 insert into public.audit_logs(institution_id,actor_profile_id,action,entity_type,entity_id,new_value)
 values(e.institution_id,private.current_profile_id(),'DECIDE_APPROVAL','enrollment_approval_requests',r.id,jsonb_build_object('party',party,'approved',approved));
end $$;

create function private.approval_satisfied(root_id uuid,program uuid default null,allow_legacy boolean default true) returns boolean
language sql stable security definer set search_path='' as $$
 select (allow_legacy and exists(select 1 from private.enrollment_legacy_exceptions where enrollment_id=root_id and (program is null or program=any(program_ids))))
 or exists(select 1 from private.enrollment_approval_requests r join public.institution_enrollments e on e.id=r.enrollment_id
 where e.id=root_id and r.program_id is not distinct from program and r.cancelled_at is null and r.context=private.enrollment_approval_context(e)
 and not exists(select 1 from private.enrollment_approval_decisions d where d.request_id=r.id and not d.approved)
 and (((r.requirements | private.approval_mask(e.institution_id,program)) & 1)=0 or exists(select 1 from private.enrollment_approval_decisions d where d.request_id=r.id and d.party='WALI' and d.approved and private.approval_party_allowed(r.id,d.party,d.actor_profile_id)))
 and (((r.requirements | private.approval_mask(e.institution_id,program)) & 2)=0 or exists(select 1 from private.enrollment_approval_decisions d where d.request_id=r.id and d.party='LEMBAGA_A' and d.approved and private.approval_party_allowed(r.id,d.party,d.actor_profile_id))))
$$;
create function public.cancel_enrollment_approval(request_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r private.enrollment_approval_requests; e public.institution_enrollments;
begin
 select ie.* into e from public.institution_enrollments ie join private.enrollment_approval_requests ar on ar.enrollment_id=ie.id where ar.id=request_id for update of ie;
 select * into r from private.enrollment_approval_requests ar where ar.id=request_id for update;
 if not found or not private.has_role(e.institution_id,'INSTITUTION_ADMIN') then raise exception 'Request unavailable' using errcode='42501'; end if;
 if (r.program_id is null and e.status='ACTIVE') or exists(select 1 from public.program_enrollments pe where pe.institution_enrollment_id=e.id and pe.program_id=r.program_id and pe.status='ACTIVE' and pe.deleted_at is null) then raise exception 'Close active enrollment before revocation' using errcode='23514'; end if;
 if r.cancelled_at is not null then return; end if;
 update private.enrollment_approval_requests set cancelled_at=now() where id=r.id;
 insert into public.audit_logs(institution_id,actor_profile_id,action,entity_type,entity_id)
 values(e.institution_id,private.current_profile_id(),'CANCEL_APPROVAL_REQUEST','enrollment_approval_requests',r.id);
end $$;
revoke all on function public.cancel_enrollment_approval(uuid) from public,anon,service_role;
grant execute on function public.cancel_enrollment_approval(uuid) to authenticated;
create function private.guard_enrollment_approval() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and private.enrollment_approval_context(new) is distinct from private.enrollment_approval_context(old) then
  if old.status='ACTIVE' and (old.enrollment_type<>'REGULAR' or new.enrollment_type<>'REGULAR') then raise exception 'Close active enrollment and request approval for a new context' using errcode='23514'; end if;
  update private.enrollment_approval_requests set cancelled_at=now() where enrollment_id=old.id and cancelled_at is null;
  delete from private.enrollment_legacy_exceptions where enrollment_id=old.id;
 end if;
 if tg_op='UPDATE' and old.status='ACTIVE' and old.enrollment_type<>'REGULAR' and new.status='PENDING' then raise exception 'Close active enrollment; do not reset to pending' using errcode='23514'; end if;
 if new.enrollment_type<>'REGULAR' and new.status='ACTIVE' and (tg_op='INSERT' or old.status<>'ACTIVE') then
  if tg_op='INSERT' or not private.approval_satisfied(new.id) then raise exception 'Enrollment approval required' using errcode='23514'; end if;
 end if;
 return new;
end $$;
create trigger approval_gate before insert or update on public.institution_enrollments for each row execute function private.guard_enrollment_approval();
create function private.guard_program_approval() returns trigger
language plpgsql security definer set search_path='' as $$
declare e public.institution_enrollments;
begin
 if new.status not in ('PENDING','ACTIVE') or new.deleted_at is not null then return new; end if;
 if tg_op='UPDATE' and old.status='ACTIVE' and new.status='ACTIVE' then return new; end if;
 select * into e from public.institution_enrollments where id=new.institution_enrollment_id for share;
 if e.enrollment_type<>'REGULAR' and not private.approval_satisfied(e.id,new.program_id,tg_op='UPDATE') then raise exception 'Program approval required' using errcode='23514'; end if;
 return new;
end $$;
create trigger approval_gate before insert or update on public.program_enrollments for each row execute function private.guard_program_approval();

-- No generic administrative entrypoint or table grants are exposed.
revoke all on function private.enrollment_approval_context(public.institution_enrollments),private.approval_mask(uuid,uuid),private.approval_party_allowed(uuid,text,uuid),private.profile_has_role(uuid,uuid,text),private.approval_satisfied(uuid,uuid,boolean),private.guard_enrollment_approval(),private.guard_program_approval() from public,anon,authenticated,service_role;
revoke all on function public.set_enrollment_approval_policy(uuid,text,uuid),public.request_enrollment_approval(uuid,uuid),public.my_enrollment_approval_requests(),public.decide_enrollment_approval(uuid,text,boolean) from public,anon,service_role;
grant execute on function public.set_enrollment_approval_policy(uuid,text,uuid),public.request_enrollment_approval(uuid,uuid),public.my_enrollment_approval_requests(),public.decide_enrollment_approval(uuid,text,boolean) to authenticated;
