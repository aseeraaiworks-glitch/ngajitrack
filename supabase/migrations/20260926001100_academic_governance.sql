-- Academic structure and explicit leadership governance. Forward-only migration.
create table public.program_learning_types (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null,
 program_id uuid not null, learning_type_id uuid not null references public.program_types(id),
 is_active boolean not null default true, created_at timestamptz not null default now(),
 unique(institution_id,program_id,learning_type_id),
 foreign key(institution_id,program_id) references public.programs(institution_id,id)
);
insert into public.program_learning_types(institution_id,program_id,learning_type_id)
select institution_id,id,program_type_id from public.programs;
create table public.institution_levels (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id),
 code text not null check(btrim(code)<>''), name text not null check(btrim(name)<>''),
 sort_order integer not null default 0, is_active boolean not null default true,
 created_at timestamptz not null default now(), unique(institution_id,id), unique(institution_id,code)
);
create table public.program_levels (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null, program_id uuid not null, level_id uuid not null,
 is_active boolean not null default true, created_at timestamptz not null default now(),
 foreign key(institution_id,program_id) references public.programs(institution_id,id),
 foreign key(institution_id,level_id) references public.institution_levels(institution_id,id),
 unique(institution_id,program_id,level_id), unique(institution_id,program_id,id)
);
alter table public.groups add column program_level_id uuid;
alter table public.groups add constraint groups_program_level_fk foreign key(institution_id,program_id,program_level_id)
references public.program_levels(institution_id,program_id,id);
create index groups_program_level on public.groups(institution_id,program_id,program_level_id);
create function private.sync_primary_learning_type() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.program_learning_types(institution_id,program_id,learning_type_id) values(new.institution_id,new.id,new.program_type_id)
 on conflict(institution_id,program_id,learning_type_id) do update set is_active=true;
 return new;
end $$;
create trigger sync_primary_learning_type after insert or update of program_type_id on public.programs for each row execute function private.sync_primary_learning_type();
create function private.guard_academic_structure() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.id<>old.id or to_jsonb(new)->'institution_id' is distinct from to_jsonb(old)->'institution_id'
 or to_jsonb(new)->'program_id' is distinct from to_jsonb(old)->'program_id'
 or to_jsonb(new)->'level_id' is distinct from to_jsonb(old)->'level_id'
 or to_jsonb(new)->'learning_type_id' is distinct from to_jsonb(old)->'learning_type_id') then raise exception 'Academic ownership is immutable' using errcode='23514'; end if;
 if tg_table_name='program_learning_types' then
  if not new.is_active and exists(select 1 from public.programs p where p.id=new.program_id and p.program_type_id=new.learning_type_id) then raise exception 'Primary learning type must remain active' using errcode='23514'; end if;
 end if;
 return new;
end $$;
create function private.guard_group_level() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and new.program_level_id is distinct from old.program_level_id and exists(select 1 from public.group_memberships where group_id=old.id) then raise exception 'Create a new class for a new academic context' using errcode='23514'; end if;
 if new.program_level_id is not null and not exists(select 1 from public.program_levels pl join public.institution_levels l on l.id=pl.level_id where pl.id=new.program_level_id and pl.institution_id=new.institution_id and pl.program_id=new.program_id and pl.is_active and l.is_active) then raise exception 'Active program level required' using errcode='23514'; end if;
 return new;
end $$;
create trigger guard_group_level before insert or update of program_level_id on public.groups for each row execute function private.guard_group_level();
-- Serialize first placement against class-context edits, including concurrent inserts.
create function private.lock_group_academic_context() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.groups where id=new.group_id for share;
 return new;
end $$;
create trigger aa_academic_group_lock before insert or update of group_id on public.group_memberships for each row execute function private.lock_group_academic_context();

alter table public.roles drop constraint roles_code_check;
alter table public.roles add constraint roles_code_check check(code in ('SUPER_ADMIN','INSTITUTION_ADMIN','TEACHER','GUARDIAN','STUDENT','MUDIR','WAKIL_MUDIR'));
insert into public.roles(code,name) values('MUDIR','Mudir'),('WAKIL_MUDIR','Wakil Mudir');
alter table public.institution_members add constraint institution_members_tenant_id_key unique(institution_id,id);
do $$ declare leader uuid; begin
 select id into leader from public.roles where code='MUDIR';
 execute format('create unique index one_active_mudir on public.institution_members(institution_id) where status=''ACTIVE'' and deleted_at is null and role_id=%L::uuid',leader);
end $$;
create table private.membership_scopes (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null, membership_id uuid not null,
 scope_type text not null check(scope_type in ('INSTITUTION','PROGRAM')), program_id uuid,
 starts_at timestamptz not null default now(), expires_at timestamptz, revoked_at timestamptz,
 granted_by uuid not null references public.profiles(id), revoked_by uuid references public.profiles(id),
 foreign key(institution_id,membership_id) references public.institution_members(institution_id,id),
 foreign key(institution_id,program_id) references public.programs(institution_id,id),
 check((scope_type='INSTITUTION' and program_id is null) or (scope_type='PROGRAM' and program_id is not null)),
 check(expires_at is null or expires_at>starts_at)
);
create unique index membership_scope_open on private.membership_scopes(membership_id,scope_type,coalesce(program_id,'00000000-0000-0000-0000-000000000000'::uuid)) where revoked_at is null;
create index leadership_scope_lookup on private.membership_scopes(institution_id,program_id,membership_id) where revoked_at is null;
create function private.guard_leadership_scope() returns trigger language plpgsql security definer set search_path='' as $$
declare role_name text;
begin
 select r.code into role_name from public.institution_members m join public.roles r on r.id=m.role_id where m.id=new.membership_id and m.institution_id=new.institution_id;
 if role_name not in ('MUDIR','WAKIL_MUDIR') or role_name is null or (role_name='MUDIR' and (new.scope_type<>'INSTITUTION' or new.expires_at is not null)) then raise exception 'Invalid leadership scope' using errcode='23514'; end if;
 if tg_op='UPDATE' and (new.membership_id<>old.membership_id or new.institution_id<>old.institution_id or new.scope_type<>old.scope_type or new.program_id is distinct from old.program_id) then raise exception 'Scope context is immutable' using errcode='23514'; end if;
 return new;
end $$;
create trigger guard_leadership_scope before insert or update on private.membership_scopes for each row execute function private.guard_leadership_scope();
-- One-use, transaction-bound internal write permits. No client/server direct grants.
create table private.leadership_write_permits(membership_id uuid primary key,transaction_id bigint not null,expected jsonb not null);
create function private.guard_leadership_member() returns trigger language plpgsql security definer set search_path='' as $$
declare payload jsonb;
begin
 if tg_op='DELETE' then
  if exists(select 1 from public.roles where id=old.role_id and code in ('MUDIR','WAKIL_MUDIR')) then raise exception 'Leadership history cannot be deleted' using errcode='42501'; end if;
  return old;
 end if;
 if exists(select 1 from public.roles where id=new.role_id and code in ('MUDIR','WAKIL_MUDIR')) or (tg_op='UPDATE' and exists(select 1 from public.roles where id=old.role_id and code in ('MUDIR','WAKIL_MUDIR'))) then
  payload:=jsonb_build_object('institution_id',new.institution_id,'profile_id',new.profile_id,'role_id',new.role_id,'status',new.status,'deleted_at',new.deleted_at,'ended_at',new.ended_at);
  delete from private.leadership_write_permits where membership_id=new.id and transaction_id=txid_current() and expected=payload;
  if not found then raise exception 'Leadership membership requires governance command' using errcode='42501'; end if;
 end if;
 return new;
end $$;
create trigger aa_leadership_governance before insert or update or delete on public.institution_members for each row execute function private.guard_leadership_member();
create function private.write_leadership_member(tenant uuid,person uuid,role_code text,activate boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare rid uuid; m public.institution_members; result uuid; finish timestamptz;
begin
 select id into rid from public.roles where code=role_code and code in ('MUDIR','WAKIL_MUDIR');
 if rid is null then raise exception 'Invalid leadership role'; end if;
 select * into m from public.institution_members where institution_id=tenant and profile_id=person and role_id=rid and deleted_at is null for update;
 result:=coalesce(m.id,gen_random_uuid()); finish:=case when activate then null else statement_timestamp() end;
 insert into private.leadership_write_permits values(result,txid_current(),jsonb_build_object('institution_id',tenant,'profile_id',person,'role_id',rid,'status',case when activate then 'ACTIVE' else 'INACTIVE' end,'deleted_at',null,'ended_at',finish));
 if m.id is null then
  insert into public.institution_members(id,institution_id,profile_id,role_id,status,joined_at,ended_at) values(result,tenant,person,rid,case when activate then 'ACTIVE' else 'INACTIVE' end,statement_timestamp(),finish);
 else
  update public.institution_members set status=case when activate then 'ACTIVE' else 'INACTIVE' end,ended_at=finish where id=m.id;
 end if;
 return result;
end $$;
create function private.leadership_scope(tenant uuid,program uuid default null,require_mudir boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.institution_members m join public.roles r on r.id=m.role_id join private.membership_scopes s on s.membership_id=m.id
 where m.institution_id=tenant and m.profile_id=private.current_profile_id()
 and r.code in ('MUDIR','WAKIL_MUDIR') and (not require_mudir or r.code='MUDIR')
 and private.has_role(tenant,r.code) and s.revoked_at is null and s.starts_at<=statement_timestamp() and (s.expires_at is null or s.expires_at>statement_timestamp())
 and (s.scope_type='INSTITUTION' or (program is not null and s.program_id=program))
 and (s.program_id is null or exists(select 1 from public.programs p where p.id=s.program_id and p.is_active and p.deleted_at is null)))
$$;
alter table public.audit_logs add column permission_code text;
alter table public.audit_logs add column actor_membership_id uuid references public.institution_members(id);
alter table public.audit_logs add column authorization_scope jsonb check(authorization_scope is null or jsonb_typeof(authorization_scope)='object');
create function private.governance_audit(tenant uuid,action_name text,entity uuid,context jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare m uuid; role_name text;
begin
 role_name:=case when action_name='VERIFY_MUDIR_CASE' then 'SUPER_ADMIN' when action_name='PUBLISH_LEARNING_CONFIG' then 'INSTITUTION_ADMIN' when action_name='REQUEST_MUDIR_CASE' and context->>'purpose'<>'REPLACEMENT' then 'INSTITUTION_ADMIN' else 'MUDIR' end;
 select im.id into m from public.institution_members im join public.roles r on r.id=im.role_id where im.institution_id=tenant and im.profile_id=private.current_profile_id() and im.status='ACTIVE' and im.deleted_at is null and r.code=role_name;
 insert into public.audit_logs(institution_id,actor_profile_id,action,entity_type,entity_id,permission_code,actor_membership_id,authorization_scope)
 values(tenant,private.current_profile_id(),action_name,'leadership_governance',entity,action_name,m,context||jsonb_build_object('authorization_role',case when action_name='ACCEPT_LEADERSHIP' then 'INVITATION_RECIPIENT' when action_name='REQUEST_REPRESENTATIVE_RECOVERY' then 'UNVERIFIED_REPRESENTATIVE_REQUEST' else role_name end));
end $$;

create table private.leadership_cases (
 id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.institutions(id),
 purpose text not null check(purpose in ('ONBOARDING','REPLACEMENT','RECOVERY')),
 recipient_profile_id uuid not null references public.profiles(id),requested_by uuid not null references public.profiles(id),
 reason text not null check(length(btrim(reason)) between 1 and 1000),evidence_reference text,
 request_evidence_reference text,
 expected_mudir_id uuid references public.institution_members(id),
 expected_mudir_scope_id uuid references private.membership_scopes(id),
 verified_by uuid references public.profiles(id),verified_at timestamptz,consumed_at timestamptz,
 expires_at timestamptz not null default now()+interval '7 days',created_at timestamptz not null default now()
);
alter table private.provisioning_invitations drop constraint provisioning_invitations_role_code_check;
alter table private.provisioning_invitations add constraint provisioning_invitations_role_code_check check(role_code in ('STUDENT','TEACHER','GUARDIAN','INSTITUTION_ADMIN','MUDIR','WAKIL_MUDIR'));
alter table private.provisioning_invitations add column purpose text not null default 'STANDARD' check(purpose in ('STANDARD','LEADERSHIP'));
alter table private.provisioning_invitations add column leadership_case_id uuid references private.leadership_cases(id);
alter table private.provisioning_invitations add column inviter_membership_id uuid references public.institution_members(id);
alter table private.provisioning_invitations add column inviter_scope_id uuid references private.membership_scopes(id);
alter table private.provisioning_invitations add constraint invitation_tenant_id unique(institution_id,id);
create table private.provisioning_invitation_scopes (
 invitation_id uuid not null references private.provisioning_invitations(id),institution_id uuid not null references public.institutions(id),
 scope_type text not null check(scope_type in ('INSTITUTION','PROGRAM')),program_id uuid,
 expires_at timestamptz,
 foreign key(institution_id,invitation_id) references private.provisioning_invitations(institution_id,id),
 foreign key(institution_id,program_id) references public.programs(institution_id,id),
 check((scope_type='INSTITUTION' and program_id is null) or (scope_type='PROGRAM' and program_id is not null))
);
create unique index invitation_scope_unique on private.provisioning_invitation_scopes(invitation_id,scope_type,coalesce(program_id,'00000000-0000-0000-0000-000000000000'::uuid));

create function public.request_mudir_case(tenant_id uuid,recipient_profile_id uuid,purpose text,reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare current_mudir uuid; current_scope uuid; result uuid; actor uuid:=private.current_profile_id();
begin
 perform 1 from public.institutions where id=tenant_id for update;
 select m.id into current_mudir from public.institution_members m join public.roles r on r.id=m.role_id where m.institution_id=tenant_id and r.code='MUDIR' and m.status='ACTIVE' and m.deleted_at is null;
 select id into current_scope from private.membership_scopes where membership_id=current_mudir and scope_type='INSTITUTION' and revoked_at is null;
 if exists(select 1 from public.institution_members where id=current_mudir and profile_id=recipient_profile_id) then raise exception 'Recipient is already Mudir' using errcode='23514'; end if;
 if purpose='REPLACEMENT' then
  if not private.leadership_scope(tenant_id,null,true) then raise exception 'Active Mudir required' using errcode='42501'; end if;
 elsif purpose in ('ONBOARDING','RECOVERY') then
  if not private.has_role(tenant_id,'INSTITUTION_ADMIN') then raise exception 'Authorized institutional request required' using errcode='42501'; end if;
  if purpose='ONBOARDING' and current_mudir is not null then raise exception 'Use recovery or replacement' using errcode='23514'; end if;
 else raise exception 'Invalid purpose' using errcode='22023'; end if;
 if not exists(select 1 from public.profiles where id=recipient_profile_id and is_active and deleted_at is null) then raise exception 'Active recipient required' using errcode='23514'; end if;
 insert into private.leadership_cases(institution_id,purpose,recipient_profile_id,requested_by,reason,expected_mudir_id,expected_mudir_scope_id,verified_by,verified_at)
 values(tenant_id,purpose,recipient_profile_id,actor,reason,current_mudir,current_scope,case when purpose='REPLACEMENT' then actor end,case when purpose='REPLACEMENT' then now() end) returning id into result;
 perform private.governance_audit(tenant_id,'REQUEST_MUDIR_CASE',result,jsonb_build_object('purpose',purpose));return result;
end $$;
-- A representative can submit evidence, never grant a role or read institution data.
-- Platform verification must establish institutional authority, not just account ownership.
create function public.request_representative_recovery(tenant_id uuid,recipient_profile_id uuid,reason text,evidence_reference text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_profile_id(); result uuid; current_mudir uuid; current_scope uuid;
begin
 if not exists(select 1 from public.profiles p join auth.users u on u.id=p.auth_user_id where p.id=actor and p.is_active and p.deleted_at is null and (u.email_confirmed_at is not null or u.phone_confirmed_at is not null)) then raise exception 'Verified requester required' using errcode='42501'; end if;
 if evidence_reference is null or length(btrim(evidence_reference)) not between 1 and 200 then raise exception 'Evidence reference required' using errcode='22023'; end if;
 perform 1 from public.institutions where id=tenant_id and is_active and deleted_at is null for update;
 if not found then raise exception 'Institution unavailable' using errcode='42501'; end if;
 if not exists(select 1 from public.profiles where id=recipient_profile_id and is_active and deleted_at is null) then raise exception 'Recipient unavailable' using errcode='42501'; end if;
 select m.id into current_mudir from public.institution_members m join public.roles r on r.id=m.role_id where m.institution_id=tenant_id and r.code='MUDIR' and m.status='ACTIVE' and m.deleted_at is null;
 select id into current_scope from private.membership_scopes where membership_id=current_mudir and scope_type='INSTITUTION' and revoked_at is null;
 insert into private.leadership_cases(institution_id,purpose,recipient_profile_id,requested_by,reason,request_evidence_reference,expected_mudir_id,expected_mudir_scope_id)
 values(tenant_id,'RECOVERY',recipient_profile_id,actor,reason,evidence_reference,current_mudir,current_scope) returning id into result;
 perform private.governance_audit(tenant_id,'REQUEST_REPRESENTATIVE_RECOVERY',result);return result;
end $$;
-- Verified platform operator plus recorded evidence; no automatic role grant.
create function public.verify_mudir_case(case_id uuid,evidence_reference text) returns void
language plpgsql security definer set search_path='' as $$
declare c private.leadership_cases;
begin
 if not private.is_super_admin() then raise exception 'Verified platform recovery operator required' using errcode='42501'; end if;
 if evidence_reference is null or length(btrim(evidence_reference)) not between 1 and 200 then raise exception 'Evidence reference required' using errcode='22023'; end if;
 select * into c from private.leadership_cases where id=case_id for update;
 if not found or c.purpose not in ('ONBOARDING','RECOVERY') or c.consumed_at is not null or c.expires_at<=now() then raise exception 'Recovery case unavailable' using errcode='23514'; end if;
 if c.requested_by=private.current_profile_id() then raise exception 'Requester cannot verify own institutional evidence' using errcode='42501'; end if;
 if c.verified_at is not null then raise exception 'Case already verified' using errcode='23514'; end if;
 update private.leadership_cases set verified_by=private.current_profile_id(),verified_at=now(),evidence_reference=verify_mudir_case.evidence_reference where id=c.id;
 perform private.governance_audit(c.institution_id,'VERIFY_MUDIR_CASE',c.id,jsonb_build_object('purpose',c.purpose));
end $$;
create function public.invite_leadership(tenant_id uuid,recipient_profile_id uuid,role_code text,program_ids uuid[] default null,case_id uuid default null,scope_expires_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c private.leadership_cases; actor uuid:=private.current_profile_id(); token text; result uuid; inviter uuid; inviter_scope uuid; p uuid;
begin
 if actor is null then raise exception 'Active profile required' using errcode='42501'; end if;
 perform 1 from public.institutions where id=tenant_id for update;
 if role_code='MUDIR' then
  select * into c from private.leadership_cases where id=case_id for update;
  if not found or c.institution_id<>tenant_id or c.recipient_profile_id<>recipient_profile_id or c.verified_at is null or c.consumed_at is not null or c.expires_at<=now() or (actor<>c.requested_by and actor<>c.verified_by) then raise exception 'Verified institutional case required' using errcode='42501'; end if;
  if c.purpose='REPLACEMENT' and not private.leadership_scope(tenant_id,null,true) then raise exception 'Replacement authority expired' using errcode='42501'; end if;
  if c.purpose in ('ONBOARDING','RECOVERY') and not ((actor=c.verified_by and private.is_super_admin()) or (actor=c.requested_by and (c.request_evidence_reference is not null or private.has_role(tenant_id,'INSTITUTION_ADMIN')))) then raise exception 'Case issuer authority expired' using errcode='42501'; end if;
  if program_ids is not null or scope_expires_at is not null then raise exception 'Mudir requires institution scope' using errcode='23514'; end if;
 elsif role_code='WAKIL_MUDIR' then
  if not private.leadership_scope(tenant_id,null,true) or case_id is not null then raise exception 'Active Mudir required' using errcode='42501'; end if;
 else raise exception 'Invalid leadership role' using errcode='22023'; end if;
 if program_ids is not null and (cardinality(program_ids)=0 or array_position(program_ids,null) is not null) then raise exception 'Nonempty program scopes required' using errcode='22023'; end if;
 if scope_expires_at is not null and scope_expires_at<=now() then raise exception 'Future scope expiry required' using errcode='22023'; end if;
 if not exists(select 1 from public.profiles p join auth.users u on u.id=p.auth_user_id where p.id=recipient_profile_id and p.is_active and p.deleted_at is null and (u.email_confirmed_at is not null or u.phone_confirmed_at is not null)) then raise exception 'Verified active recipient required' using errcode='23514'; end if;
 select m.id into inviter from public.institution_members m join public.roles r on r.id=m.role_id where m.institution_id=tenant_id and m.profile_id=actor and r.code='MUDIR' and m.status='ACTIVE' and m.deleted_at is null;
 select id into inviter_scope from private.membership_scopes where membership_id=inviter and scope_type='INSTITUTION' and revoked_at is null;
 token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
 insert into private.provisioning_invitations(institution_id,recipient_profile_id,role_code,authorized_by,verification_reference,token_hash,expires_at,purpose,leadership_case_id,inviter_membership_id,inviter_scope_id)
 values(tenant_id,recipient_profile_id,role_code,actor,'LEADERSHIP_GOVERNANCE',sha256(convert_to(token,'UTF8')),now()+interval '24 hours','LEADERSHIP',case_id,inviter,inviter_scope) returning id into result;
 if program_ids is null then insert into private.provisioning_invitation_scopes values(result,tenant_id,'INSTITUTION',null,scope_expires_at);
 else foreach p in array program_ids loop
  if not exists(select 1 from public.programs where id=p and institution_id=tenant_id and is_active and deleted_at is null) then raise exception 'Program outside authorized scope' using errcode='42501'; end if;
  insert into private.provisioning_invitation_scopes values(result,tenant_id,'PROGRAM',p,scope_expires_at) on conflict do nothing;
 end loop;end if;
 perform private.governance_audit(tenant_id,'INVITE_LEADERSHIP',result,jsonb_build_object('role',role_code,'program_ids',program_ids));
 return jsonb_build_object('invitation_id',result,'token',token);
end $$;

-- Preserve v10 signatures/behavior for STANDARD invitations; no legacy bypass for leaders.
alter function public.accept_provisioning_invitation(text) rename to accept_standard_invitation;
alter function public.accept_standard_invitation(text) set schema private;
revoke all on function private.accept_standard_invitation(text) from public,anon,authenticated,service_role;
create function public.accept_provisioning_invitation(token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i private.provisioning_invitations; c private.leadership_cases; current_mudir uuid; current_scope uuid;
 old_person uuid; m uuid; s record; actor uuid:=private.current_profile_id();
begin
 select * into i from private.provisioning_invitations where token_hash=sha256(convert_to(token,'UTF8'));
 if not found then raise exception 'Invitation unavailable' using errcode='42501'; end if;
 if i.purpose='STANDARD' then
  if i.role_code not in ('STUDENT','TEACHER','GUARDIAN','INSTITUTION_ADMIN') then raise exception 'Invalid standard role' using errcode='42501'; end if;
  return private.accept_standard_invitation(token);
 end if;
 -- All leadership commands take the institution lock before invitation/member locks.
 perform 1 from public.institutions where id=i.institution_id for update;
 select * into i from private.provisioning_invitations where id=i.id for update;
 if actor is null or i.recipient_profile_id is distinct from actor or i.consumed_at is not null or i.revoked_at is not null or i.expires_at<=statement_timestamp() then raise exception 'Invitation unavailable' using errcode='42501'; end if;
 if not exists(select 1 from public.institutions where id=i.institution_id and is_active and deleted_at is null and status in ('ACTIVE','TRIAL')) then raise exception 'Institution unavailable' using errcode='42501'; end if;
 if not exists(select 1 from private.provisioning_invitation_scopes where invitation_id=i.id) then raise exception 'Scope required' using errcode='23514'; end if;
 if exists(select 1 from private.provisioning_invitation_scopes sc where sc.invitation_id=i.id and ((sc.expires_at is not null and sc.expires_at<=statement_timestamp()) or (sc.program_id is not null and not exists(select 1 from public.programs p where p.id=sc.program_id and p.institution_id=i.institution_id and p.is_active and p.deleted_at is null)))) then raise exception 'Scope unavailable' using errcode='42501'; end if;
 if i.role_code='MUDIR' then
  select * into c from private.leadership_cases where id=i.leadership_case_id for update;
  select im.id,im.profile_id into current_mudir,old_person from public.institution_members im join public.roles r on r.id=im.role_id where im.institution_id=i.institution_id and r.code='MUDIR' and im.status='ACTIVE' and im.deleted_at is null;
  select id into current_scope from private.membership_scopes where membership_id=current_mudir and scope_type='INSTITUTION' and revoked_at is null;
  if c.id is null or c.verified_at is null or c.consumed_at is not null or c.expires_at<=statement_timestamp() or c.expected_mudir_id is distinct from current_mudir or c.expected_mudir_scope_id is distinct from current_scope then raise exception 'Stale governance case' using errcode='42501'; end if;
  if c.purpose='REPLACEMENT' and (not private.profile_has_role(c.requested_by,i.institution_id,'MUDIR') or not exists(select 1 from private.membership_scopes where membership_id=current_mudir and scope_type='INSTITUTION' and revoked_at is null and starts_at<=now() and (expires_at is null or expires_at>now()))) then raise exception 'Replacement authority expired' using errcode='42501'; end if;
  if current_mudir is not null then
   perform private.write_leadership_member(i.institution_id,old_person,'MUDIR',false);
   update private.membership_scopes set revoked_at=now(),revoked_by=actor where membership_id=current_mudir and revoked_at is null;
  end if;
 elsif i.role_code='WAKIL_MUDIR' then
  if not private.profile_has_role(i.authorized_by,i.institution_id,'MUDIR') or not exists(select 1 from private.membership_scopes where id=i.inviter_scope_id and membership_id=i.inviter_membership_id and scope_type='INSTITUTION' and revoked_at is null and starts_at<=now() and (expires_at is null or expires_at>now())) then raise exception 'Inviter authority expired' using errcode='42501'; end if;
 else raise exception 'Invalid leadership role' using errcode='42501'; end if;
 m:=private.write_leadership_member(i.institution_id,actor,i.role_code,true);
 for s in select * from private.provisioning_invitation_scopes where invitation_id=i.id loop
  update private.membership_scopes set revoked_at=now(),revoked_by=actor where membership_id=m and scope_type=s.scope_type and program_id is not distinct from s.program_id and revoked_at is null and expires_at<=statement_timestamp();
  insert into private.membership_scopes(institution_id,membership_id,scope_type,program_id,expires_at,granted_by)
  values(i.institution_id,m,s.scope_type,s.program_id,s.expires_at,i.authorized_by) on conflict do nothing;
 end loop;
 update private.provisioning_invitations set consumed_at=now() where id=i.id;
 if i.leadership_case_id is not null then update private.leadership_cases set consumed_at=now() where id=i.leadership_case_id; end if;
 perform private.governance_audit(i.institution_id,'ACCEPT_LEADERSHIP',m,jsonb_build_object('role',i.role_code,'invitation_id',i.id));
 return jsonb_build_object('invitation_id',i.id,'membership_id',m,'institution_id',i.institution_id,'role_code',i.role_code);
end $$;
alter function public.revoke_provisioning_invitation(uuid) rename to revoke_standard_invitation;
alter function public.revoke_standard_invitation(uuid) set schema private;
revoke all on function private.revoke_standard_invitation(uuid) from public,anon,authenticated,service_role;
create function public.revoke_provisioning_invitation(invitation_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare i private.provisioning_invitations;
begin
 select * into i from private.provisioning_invitations where id=invitation_id;
 if not found then raise exception 'Invitation unavailable' using errcode='42501'; end if;
 if i.purpose='STANDARD' then perform private.revoke_standard_invitation(invitation_id);return;end if;
 perform 1 from public.institutions where id=i.institution_id for update;
 if not private.leadership_scope(i.institution_id,null,true) then raise exception 'Active Mudir required' using errcode='42501'; end if;
 update private.provisioning_invitations set revoked_at=coalesce(revoked_at,now()) where id=i.id and consumed_at is null;
 perform private.governance_audit(i.institution_id,'REVOKE_LEADERSHIP_INVITATION',i.id);
end $$;
create function public.revoke_leadership_scope(scope_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare s private.membership_scopes; role_name text;
begin
 select * into s from private.membership_scopes where id=scope_id;
 if not found then raise exception 'Scope unavailable' using errcode='42501'; end if;
 perform 1 from public.institutions where id=s.institution_id for update;
 select r.code into role_name from public.institution_members m join public.roles r on r.id=m.role_id where m.id=s.membership_id;
 if not private.leadership_scope(s.institution_id,null,true) or role_name<>'WAKIL_MUDIR' then raise exception 'Use authorized leadership governance' using errcode='42501'; end if;
 update private.membership_scopes set revoked_at=coalesce(revoked_at,now()),revoked_by=private.current_profile_id() where id=s.id;
 perform private.governance_audit(s.institution_id,'REVOKE_LEADERSHIP_SCOPE',s.id,jsonb_build_object('program_id',s.program_id,'scope_type',s.scope_type));
end $$;
create function public.my_leadership_scopes() returns table(scope_id uuid,membership_id uuid,institution_id uuid,role_code text,scope_type text,program_id uuid,expires_at timestamptz)
language sql stable security definer set search_path='' as $$
 select s.id,m.id,m.institution_id,r.code,s.scope_type,s.program_id,s.expires_at from private.membership_scopes s
 join public.institution_members m on m.id=s.membership_id join public.roles r on r.id=m.role_id
 where m.profile_id=private.current_profile_id() and private.has_role(m.institution_id,r.code)
 and s.revoked_at is null and s.starts_at<=now() and (s.expires_at is null or s.expires_at>now())
$$;

-- Typed setting registry is migration-controlled. Unknown keys/SQL/permission keys
-- are rejected. No pedagogical defaults are invented by this structural migration.
create table private.learning_setting_definitions(setting_key text primary key,value_kind text not null check(value_kind in ('string','number','boolean','array','object')));
create table private.learning_config_versions (
 id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.institutions(id),
 learning_type_id uuid not null references public.program_types(id),scope_type text not null check(scope_type in ('INSTITUTION','LEVEL','PROGRAM','PROGRAM_LEVEL')),
 level_id uuid,program_id uuid,program_level_id uuid,
 version integer not null check(version>0),schema_version integer not null default 1 check(schema_version=1),
 settings jsonb not null check(jsonb_typeof(settings)='object'),published_at timestamptz not null default now(),retired_at timestamptz,
 created_by uuid not null references public.profiles(id),
 foreign key(institution_id,level_id) references public.institution_levels(institution_id,id),
 foreign key(institution_id,program_id) references public.programs(institution_id,id),
 foreign key(institution_id,program_id,program_level_id) references public.program_levels(institution_id,program_id,id),
 check((scope_type='INSTITUTION' and level_id is null and program_id is null and program_level_id is null)
 or (scope_type='LEVEL' and level_id is not null and program_id is null and program_level_id is null)
 or (scope_type='PROGRAM' and level_id is null and program_id is not null and program_level_id is null)
 or (scope_type='PROGRAM_LEVEL' and level_id is null and program_id is not null and program_level_id is not null))
);
create unique index config_scope_version on private.learning_config_versions(institution_id,learning_type_id,scope_type,coalesce(level_id,program_level_id,program_id,institution_id),version);
create unique index config_scope_current on private.learning_config_versions(institution_id,learning_type_id,scope_type,coalesce(level_id,program_level_id,program_id,institution_id)) where retired_at is null;
create function public.publish_learning_config(tenant_id uuid,learning_type_id uuid,scope_type text,settings jsonb,level_id uuid default null,program_id uuid default null,program_level_id uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; next_version integer; scope_target uuid:=coalesce(level_id,program_level_id,program_id,tenant_id);
begin
 if not private.has_role(tenant_id,'INSTITUTION_ADMIN') then raise exception 'Institution administrator required' using errcode='42501'; end if;
 perform 1 from public.institutions where id=tenant_id for update;
 if settings is null or jsonb_typeof(settings)<>'object' then raise exception 'Typed settings object required' using errcode='22023'; end if;
 if exists(select 1 from jsonb_each(settings) x left join private.learning_setting_definitions d on d.setting_key=x.key where d.setting_key is null or jsonb_typeof(x.value)<>d.value_kind) then raise exception 'Unknown or invalid configuration key' using errcode='22023'; end if;
 if program_id is not null and not exists(select 1 from public.program_learning_types pt where pt.program_id=publish_learning_config.program_id and pt.institution_id=tenant_id and pt.learning_type_id=publish_learning_config.learning_type_id and pt.is_active) then raise exception 'Learning type unavailable in program' using errcode='23514'; end if;
 select coalesce(max(v.version),0)+1 into next_version from private.learning_config_versions v where v.institution_id=tenant_id and v.learning_type_id=publish_learning_config.learning_type_id and v.scope_type=publish_learning_config.scope_type and coalesce(v.level_id,v.program_level_id,v.program_id,v.institution_id)=scope_target;
 update private.learning_config_versions v set retired_at=now() where v.institution_id=tenant_id and v.learning_type_id=publish_learning_config.learning_type_id and v.scope_type=publish_learning_config.scope_type and coalesce(v.level_id,v.program_level_id,v.program_id,v.institution_id)=scope_target and v.retired_at is null;
 insert into private.learning_config_versions(institution_id,learning_type_id,scope_type,settings,level_id,program_id,program_level_id,version,created_by)
 values(tenant_id,learning_type_id,scope_type,settings,level_id,program_id,program_level_id,next_version,private.current_profile_id()) returning id into result;
 perform private.governance_audit(tenant_id,'PUBLISH_LEARNING_CONFIG',result,jsonb_build_object('scope_type',scope_type,'program_id',program_id,'program_level_id',program_level_id)); return result;
end $$;
create function public.effective_learning_config(tenant_id uuid,program_id uuid,learning_type_id uuid,program_level_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare level uuid; v record; result jsonb:='{}'; sources jsonb:='{}'; k text;
begin
 if not (private.has_role(tenant_id,'INSTITUTION_ADMIN') or private.leadership_scope(tenant_id,program_id) or private.teaches_scope(tenant_id,program_id) or private.personal_program(tenant_id,program_id)) then raise exception 'Program unavailable' using errcode='42501'; end if;
 if not exists(select 1 from public.program_learning_types pt join public.programs p on p.id=pt.program_id where pt.institution_id=tenant_id and pt.program_id=effective_learning_config.program_id and pt.learning_type_id=effective_learning_config.learning_type_id and pt.is_active and p.is_active and p.deleted_at is null) then raise exception 'Learning type unavailable' using errcode='23514'; end if;
 if program_level_id is not null then
  select pl.level_id into level from public.program_levels pl where pl.id=program_level_id and pl.institution_id=tenant_id and pl.program_id=effective_learning_config.program_id and pl.is_active;
  if not found then raise exception 'Program level unavailable' using errcode='23514'; end if;
 end if;
 for v in select * from private.learning_config_versions c where c.institution_id=tenant_id and c.learning_type_id=effective_learning_config.learning_type_id and c.retired_at is null and
 (c.scope_type='INSTITUTION' or (c.scope_type='LEVEL' and c.level_id=level) or (c.scope_type='PROGRAM' and c.program_id=effective_learning_config.program_id) or (c.scope_type='PROGRAM_LEVEL' and c.program_level_id=effective_learning_config.program_level_id))
 order by case c.scope_type when 'INSTITUTION' then 1 when 'LEVEL' then 2 when 'PROGRAM' then 3 else 4 end loop
  result:=result||v.settings;
  for k in select jsonb_object_keys(v.settings) loop sources:=sources||jsonb_build_object(k,v.id);end loop;
 end loop;
 return jsonb_build_object('settings',result,'sources',sources,'schema_version',1);
end $$;

-- Read-only monitoring; never append leadership to operational write policies.
create policy leadership_program_read on public.programs for select to authenticated using(deleted_at is null and private.leadership_scope(institution_id,id));
create policy leadership_group_read on public.groups for select to authenticated using(deleted_at is null and private.leadership_scope(institution_id,program_id));
create policy leadership_program_enrollment_read on public.program_enrollments for select to authenticated using(deleted_at is null and private.leadership_scope(institution_id,program_id));
create policy leadership_group_membership_read on public.group_memberships for select to authenticated using(deleted_at is null and private.leadership_scope(institution_id,program_id));
create policy leadership_assignment_read on public.teacher_assignments for select to authenticated using(deleted_at is null and private.leadership_scope(institution_id,program_id));
create function public.monitor_students(tenant_id uuid,program_id uuid) returns table(student_id uuid,display_name text,program_enrollment_id uuid,enrollment_status text)
language sql stable security definer set search_path='' as $$
 select s.id,s.display_name,pe.id,pe.status from public.student_profiles s join public.program_enrollments pe on pe.student_id=s.id and pe.institution_id=s.institution_id
 where pe.institution_id=tenant_id and pe.program_id=monitor_students.program_id and pe.deleted_at is null and s.deleted_at is null
 and (private.has_role(tenant_id,'INSTITUTION_ADMIN') or private.leadership_scope(tenant_id,program_id))
$$;
do $$ declare t text; begin
 foreach t in array array['program_learning_types','institution_levels','program_levels'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select,insert,update on public.%I to authenticated',t);
  execute format('grant select,insert,update on public.%I to service_role',t);
  execute format('create policy admin_manage on public.%I for all to authenticated using(private.has_role(institution_id,''INSTITUTION_ADMIN'')) with check(private.has_role(institution_id,''INSTITUTION_ADMIN''))',t);
  execute format('create trigger guard_academic_structure before update on public.%I for each row execute function private.guard_academic_structure()',t);
  execute format('create trigger audit_changes after insert or update on public.%I for each row execute function private.audit_change()',t);
 end loop;
end $$;
create policy leadership_level_read on public.institution_levels for select to authenticated using(private.leadership_scope(institution_id) or exists(select 1 from public.program_levels p where p.level_id=institution_levels.id and private.leadership_scope(p.institution_id,p.program_id)));
create policy leadership_program_level_read on public.program_levels for select to authenticated using(private.leadership_scope(institution_id,program_id));
create policy leadership_learning_type_read on public.program_learning_types for select to authenticated using(private.leadership_scope(institution_id,program_id));
create policy participant_program_level_read on public.program_levels for select to authenticated using(private.teaches_scope(institution_id,program_id) or private.personal_program(institution_id,program_id));
create policy participant_learning_type_read on public.program_learning_types for select to authenticated using(private.teaches_scope(institution_id,program_id) or private.personal_program(institution_id,program_id));
create policy participant_level_read on public.institution_levels for select to authenticated using(exists(select 1 from public.program_levels p where p.level_id=institution_levels.id and (private.teaches_scope(p.institution_id,p.program_id) or private.personal_program(p.institution_id,p.program_id))));
-- Private tables are exposed only through bounded, authenticated RPCs.
do $$ declare t text; begin
 foreach t in array array['membership_scopes','leadership_write_permits','leadership_cases','provisioning_invitation_scopes','learning_setting_definitions','learning_config_versions'] loop
  execute format('alter table private.%I enable row level security',t);
  execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);
 end loop;
end $$;
revoke all on function private.sync_primary_learning_type(),private.guard_academic_structure(),private.guard_group_level(),private.guard_leadership_member(),private.write_leadership_member(uuid,uuid,text,boolean),private.leadership_scope(uuid,uuid,boolean),private.governance_audit(uuid,text,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function private.leadership_scope(uuid,uuid,boolean) to authenticated;
revoke all on function private.guard_leadership_scope(),public.request_representative_recovery(uuid,uuid,text,text) from public,anon,authenticated,service_role;
revoke all on function private.lock_group_academic_context() from public,anon,authenticated,service_role;
grant execute on function public.request_representative_recovery(uuid,uuid,text,text) to authenticated;
revoke all on function public.request_mudir_case(uuid,uuid,text,text),public.verify_mudir_case(uuid,text),public.invite_leadership(uuid,uuid,text,uuid[],uuid,timestamptz),public.accept_provisioning_invitation(text),public.revoke_provisioning_invitation(uuid),public.revoke_leadership_scope(uuid),public.my_leadership_scopes(),public.publish_learning_config(uuid,uuid,text,jsonb,uuid,uuid,uuid),public.effective_learning_config(uuid,uuid,uuid,uuid),public.monitor_students(uuid,uuid) from public,anon,service_role;
grant execute on function public.request_mudir_case(uuid,uuid,text,text),public.verify_mudir_case(uuid,text),public.invite_leadership(uuid,uuid,text,uuid[],uuid,timestamptz),public.accept_provisioning_invitation(text),public.revoke_provisioning_invitation(uuid),public.revoke_leadership_scope(uuid),public.my_leadership_scopes(),public.publish_learning_config(uuid,uuid,text,jsonb,uuid,uuid,uuid),public.effective_learning_config(uuid,uuid,uuid,uuid),public.monitor_students(uuid,uuid) to authenticated;
