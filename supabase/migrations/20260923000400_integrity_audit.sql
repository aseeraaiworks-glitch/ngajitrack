-- Integrity checks run for trusted-server writes as well as API writes.
create function private.current_profile_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.profiles
  where auth_user_id = (select auth.uid()) and is_active and deleted_at is null
$$;

create function private.has_role(tenant_id uuid, wanted_role text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.institution_members m
    join public.roles r on r.id = m.role_id
    join public.institutions i on i.id = m.institution_id
    where m.profile_id = private.current_profile_id() and m.institution_id = tenant_id
      and r.code = wanted_role and m.status = 'ACTIVE' and m.deleted_at is null
      and m.ended_at is null and (m.joined_at is null or m.joined_at <= now())
      and i.is_active and i.deleted_at is null and i.status in ('ACTIVE','TRIAL')
  )
$$;

create function private.is_super_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.platform_roles
    where profile_id = private.current_profile_id() and role_code = 'SUPER_ADMIN'
      and is_active and deleted_at is null)
$$;

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references public.institutions(id) on delete restrict,
  actor_profile_id uuid references public.profiles(id) on delete restrict,
  actor_role_code text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  request_id text,
  ip_hash text,
  user_agent_summary text,
  created_at timestamptz not null default now()
);
alter table public.audit_logs enable row level security;
revoke all on public.audit_logs from public, anon, authenticated, service_role;
grant select on public.audit_logs to service_role;

create function private.stamp_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  before_row jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  after_row jsonb := to_jsonb(new);
  actor uuid := private.current_profile_id();
  col text;
  patch jsonb;
begin
  if tg_op = 'UPDATE' then
    foreach col in array array['id','institution_id','auth_user_id'] loop
      if before_row->col is distinct from after_row->col then
        raise exception 'Immutable ownership column: %',col using errcode = '23514';
      end if;
    end loop;
    foreach col in array coalesce(tg_argv,array[]::text[]) loop
      if before_row->col is distinct from after_row->col then
        raise exception 'Close the old relationship and create a new row: %',col using errcode = '23514';
      end if;
    end loop;
    if tg_table_name in ('institution_enrollments','program_enrollments','group_memberships')
       and before_row->>'status' in ('COMPLETED','GRADUATED','TRANSFERRED','WITHDRAWN','ARCHIVED') then
      raise exception 'Historical enrollment is read-only' using errcode = '23514';
    end if;
    patch := jsonb_build_object('created_at',before_row->'created_at','updated_at',now());
    if after_row ? 'created_by' then
      patch := patch || jsonb_build_object('created_by',before_row->'created_by','updated_by',actor);
    end if;
  else
    patch := jsonb_build_object('created_at',now(),'updated_at',now());
    if after_row ? 'created_by' then
      patch := patch || jsonb_build_object('created_by',actor,'updated_by',actor);
    end if;
  end if;
  if after_row ? 'deleted_by' then
    patch := patch || jsonb_build_object('deleted_by',case when new.deleted_at is not null then actor end);
  end if;
  new := jsonb_populate_record(new,patch);
  return new;
end;
$$;

-- Arguments are migration-controlled table:column pairs, never client input.
create function private.require_live_parents() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  row_data jsonb := to_jsonb(new);
  parent_data jsonb;
  relation text;
  parent_table text;
  parent_col text;
begin
  -- Closing/soft-deleting existing records must remain possible after a parent closes.
  if tg_op = 'UPDATE' and (new.deleted_at is not null
    or row_data->>'status' in ('INACTIVE','COMPLETED','GRADUATED','TRANSFERRED','WITHDRAWN','ARCHIVED','REVOKED')
    or row_data->>'is_active' = 'false') then return new; end if;
  foreach relation in array tg_argv loop
    parent_table := split_part(relation,':',1);
    parent_col := split_part(relation,':',2);
    if row_data->>parent_col is null then continue; end if;
    execute format('select to_jsonb(p) from public.%I p where p.id = $1 for share',parent_table)
      into parent_data using (row_data->>parent_col)::uuid;
    if parent_data is null or parent_data->>'deleted_at' is not null
      or parent_data->>'is_active' = 'false'
      or (parent_data ? 'status' and parent_data->>'status' not in ('ACTIVE','TRIAL')) then
      raise exception 'Parent is not active: %',parent_table using errcode = '23514';
    end if;
  end loop;
  return new;
end;
$$;

create function private.validate_member_role() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from public.roles where id = new.role_id and code = 'SUPER_ADMIN') then
    raise exception 'SUPER_ADMIN belongs in platform_roles' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger check_member_role before insert or update on public.institution_members
for each row execute function private.validate_member_role();

create function private.validate_person_membership() returns trigger
language plpgsql security definer set search_path = '' as $$
declare required_role text := tg_argv[0];
begin
  if new.profile_id is null or new.deleted_at is not null or new.status <> 'ACTIVE' then return new; end if;
  if not exists (
    select 1 from public.institution_members m join public.roles r on r.id = m.role_id
    join public.profiles p on p.id = m.profile_id
    where m.institution_id = new.institution_id and m.profile_id = new.profile_id and r.code = required_role
      and m.status = 'ACTIVE' and m.deleted_at is null and m.ended_at is null
      and (m.joined_at is null or m.joined_at <= now()) and p.is_active and p.deleted_at is null
  ) then raise exception 'Active person requires matching institution membership' using errcode = '23514'; end if;
  return new;
end;
$$;
create trigger check_teacher_member before insert or update on public.teacher_profiles
for each row execute function private.validate_person_membership('TEACHER');
create trigger check_guardian_member before insert or update on public.guardian_profiles
for each row execute function private.validate_person_membership('GUARDIAN');

create function private.audit_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  previous jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  current_row jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  record_data jsonb := coalesce(current_row,previous);
  tenant uuid := (record_data->>'institution_id')::uuid;
  actor uuid := private.current_profile_id();
  action_name text := tg_op;
begin
  if tg_table_name = 'institutions' then tenant := (record_data->>'id')::uuid; end if;
  if tg_op = 'UPDATE' and previous->>'deleted_at' is null and current_row->>'deleted_at' is not null then
    action_name := 'SOFT_DELETE';
  elsif tg_op = 'UPDATE' and previous->>'deleted_at' is not null and current_row->>'deleted_at' is null then
    action_name := 'RESTORE';
  end if;
  insert into public.audit_logs(institution_id,actor_profile_id,actor_role_code,action,entity_type,entity_id,old_value,new_value)
  values(tenant,actor,case when private.is_super_admin() then 'SUPER_ADMIN'
    when private.has_role(tenant,'INSTITUTION_ADMIN') then 'INSTITUTION_ADMIN'
    when actor is null then 'SYSTEM' else 'SELF' end,
    action_name,tg_table_name,(record_data->>'id')::uuid,previous,current_row);
  return coalesce(new,old);
end;
$$;

create function private.reject_audit_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin raise exception 'Audit logs are append-only' using errcode = '23514'; end;
$$;
create trigger audit_append_only before update or delete or truncate on public.audit_logs
for each statement execute function private.reject_audit_mutation();

create trigger audit_reference_changes after insert or update or delete on public.roles
for each row execute function private.audit_change();
create trigger audit_reference_changes after insert or update or delete on public.program_types
for each row execute function private.audit_change();

do $$
declare t text;
begin
  foreach t in array array['profiles','institutions','institution_members','platform_roles','student_identities',
    'student_profiles','teacher_profiles','guardian_profiles','guardian_students','programs','groups',
    'institution_enrollments','program_enrollments','group_memberships','teacher_assignments'] loop
    execute format('create trigger stamp_metadata before insert or update on public.%I for each row execute function private.stamp_row()',t);
    execute format('create trigger audit_changes after insert or update or delete on public.%I for each row execute function private.audit_change()',t);
  end loop;
end;
$$;

-- Extra immutable relation columns ensure transfers cannot rewrite history.
create trigger immutable_member before update on public.institution_members
for each row execute function private.stamp_row('profile_id','role_id');
create trigger immutable_institution_enrollment before update on public.institution_enrollments
for each row execute function private.stamp_row('student_id');
create trigger immutable_program_enrollment before update on public.program_enrollments
for each row execute function private.stamp_row('student_id','program_id','institution_enrollment_id');
create trigger immutable_group_membership before update on public.group_memberships
for each row execute function private.stamp_row('student_id','program_id','group_id','program_enrollment_id');
create trigger immutable_assignment before update on public.teacher_assignments
for each row execute function private.stamp_row('teacher_id','program_id','group_id');
create trigger immutable_guardian_link before update on public.guardian_students
for each row execute function private.stamp_row('guardian_id','student_id');
create trigger immutable_group_program before update on public.groups
for each row execute function private.stamp_row('program_id');

create trigger live_parents before insert or update on public.institution_members
for each row execute function private.require_live_parents('institutions:institution_id','profiles:profile_id');
create trigger live_parents before insert or update on public.student_profiles
for each row execute function private.require_live_parents('institutions:institution_id','student_identities:student_identity_id');
create trigger live_parents before insert or update on public.teacher_profiles
for each row execute function private.require_live_parents('institutions:institution_id','profiles:profile_id');
create trigger live_parents before insert or update on public.guardian_profiles
for each row execute function private.require_live_parents('institutions:institution_id','profiles:profile_id');
create trigger live_parents before insert or update on public.guardian_students
for each row execute function private.require_live_parents('institutions:institution_id','guardian_profiles:guardian_id','student_profiles:student_id');
create trigger live_parents before insert or update on public.programs
for each row execute function private.require_live_parents('institutions:institution_id','program_types:program_type_id');
create trigger live_parents before insert or update on public.groups
for each row execute function private.require_live_parents('institutions:institution_id','programs:program_id');
create trigger live_parents before insert or update on public.institution_enrollments
for each row execute function private.require_live_parents('institutions:institution_id','student_profiles:student_id');
create trigger live_parents before insert or update on public.program_enrollments
for each row execute function private.require_live_parents('institutions:institution_id','institution_enrollments:institution_enrollment_id','programs:program_id','student_profiles:student_id');
create trigger live_parents before insert or update on public.group_memberships
for each row execute function private.require_live_parents('institutions:institution_id','program_enrollments:program_enrollment_id','groups:group_id','student_profiles:student_id');
create trigger live_parents before insert or update on public.teacher_assignments
for each row execute function private.require_live_parents('institutions:institution_id','teacher_profiles:teacher_id','programs:program_id','groups:group_id');

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.current_profile_id(),private.has_role(uuid,text),private.is_super_admin() to authenticated;
