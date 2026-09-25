-- Helpers use a fixed search_path and reside outside the exposed API schema.
-- They bind every authorization check to auth.uid(), never a client-supplied user ID.
create function private.personal_student(tenant_id uuid, student uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.student_profiles s
    join public.institutions i on i.id = s.institution_id
    where s.id = student and s.institution_id = tenant_id and s.deleted_at is null
      and i.deleted_at is null and i.is_active and i.status in ('ACTIVE','TRIAL')
      and (
        (private.has_role(tenant_id,'STUDENT') and exists (
          select 1 from public.student_identities si where si.id = s.student_identity_id
            and si.profile_id = private.current_profile_id() and si.deleted_at is null and si.status = 'ACTIVE'
        ))
        or (private.has_role(tenant_id,'GUARDIAN') and exists (
          select 1 from public.guardian_students gs
          join public.guardian_profiles gp on gp.id = gs.guardian_id and gp.institution_id = gs.institution_id
          where gs.institution_id = tenant_id and gs.student_id = student
            and gs.status = 'VERIFIED' and gs.can_view_progress and gs.deleted_at is null
            and gp.profile_id = private.current_profile_id() and gp.status = 'ACTIVE' and gp.deleted_at is null
        ))
      )
  )
$$;

create function private.teaches_scope(tenant_id uuid, program uuid, class_id uuid default null) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role(tenant_id,'TEACHER') and exists (
    select 1 from public.teacher_assignments a
    join public.teacher_profiles t on t.id = a.teacher_id and t.institution_id = a.institution_id
    join public.programs p on p.id = a.program_id and p.institution_id = a.institution_id
    where a.institution_id = tenant_id and a.program_id = program
      and t.profile_id = private.current_profile_id() and t.status = 'ACTIVE' and t.deleted_at is null
      and a.is_active and a.deleted_at is null
      and (a.start_date is null or a.start_date <= current_date)
      and (a.end_date is null or a.end_date >= current_date)
      and p.is_active and p.deleted_at is null
      and (a.group_id is null or exists(select 1 from public.groups g where g.id = a.group_id
        and g.institution_id = tenant_id and g.is_active and g.status = 'ACTIVE' and g.deleted_at is null))
      and (class_id is null or a.group_id is null or a.group_id = class_id)
  )
$$;

create function private.teaches_student(tenant_id uuid, student uuid, program uuid default null, class_id uuid default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_role(tenant_id,'TEACHER') and exists (
    select 1 from public.program_enrollments pe
    join public.institution_enrollments ie on ie.id = pe.institution_enrollment_id and ie.institution_id = pe.institution_id
    join public.student_profiles s on s.id = pe.student_id and s.institution_id = pe.institution_id
    join public.teacher_assignments a on a.institution_id = pe.institution_id and a.program_id = pe.program_id
    join public.teacher_profiles t on t.id = a.teacher_id and t.institution_id = a.institution_id
    join public.programs p on p.id = pe.program_id and p.institution_id = pe.institution_id
    where pe.institution_id = tenant_id and pe.student_id = student
      and (program is null or pe.program_id = program)
      and pe.status = 'ACTIVE' and pe.deleted_at is null and pe.completed_at is null
      and (pe.enrolled_at is null or pe.enrolled_at <= current_date)
      and ie.status = 'ACTIVE' and ie.deleted_at is null and ie.ended_at is null
      and (ie.started_at is null or ie.started_at <= current_date)
      and s.status = 'ACTIVE' and s.deleted_at is null and p.is_active and p.deleted_at is null
      and t.profile_id = private.current_profile_id() and t.status = 'ACTIVE' and t.deleted_at is null
      and a.is_active and a.deleted_at is null
      and (a.start_date is null or a.start_date <= current_date)
      and (a.end_date is null or a.end_date >= current_date)
      and (
        (a.group_id is null and class_id is null)
        or exists (
          select 1 from public.group_memberships gm
          join public.groups g on g.id = gm.group_id and g.institution_id = gm.institution_id
          where gm.institution_id = tenant_id and gm.program_enrollment_id = pe.id
            and gm.student_id = student and gm.program_id = pe.program_id
            and (a.group_id is null or gm.group_id = a.group_id)
            and (class_id is null or gm.group_id = class_id)
            and gm.status = 'ACTIVE' and gm.deleted_at is null and gm.ended_at is null and gm.started_at <= now()
            and g.is_active and g.status = 'ACTIVE' and g.deleted_at is null
        )
      )
  )
$$;

create function private.personal_program(tenant_id uuid, program uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.program_enrollments pe
    join public.institution_enrollments ie on ie.id = pe.institution_enrollment_id
    where pe.institution_id = tenant_id and pe.program_id = program and pe.deleted_at is null
      and ie.deleted_at is null and private.personal_student(tenant_id,pe.student_id))
$$;
create function private.personal_group(tenant_id uuid, class_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.group_memberships gm
    join public.program_enrollments pe on pe.id = gm.program_enrollment_id
    join public.institution_enrollments ie on ie.id = pe.institution_enrollment_id
    where gm.institution_id = tenant_id and gm.group_id = class_id and gm.deleted_at is null
      and pe.deleted_at is null and ie.deleted_at is null and private.personal_student(tenant_id,gm.student_id))
$$;

revoke all on function private.personal_student(uuid,uuid),private.teaches_scope(uuid,uuid,uuid),
  private.teaches_student(uuid,uuid,uuid,uuid),private.personal_program(uuid,uuid),private.personal_group(uuid,uuid) from public,anon;
grant execute on function private.personal_student(uuid,uuid),private.teaches_scope(uuid,uuid,uuid),
  private.teaches_student(uuid,uuid,uuid,uuid),private.personal_program(uuid,uuid),private.personal_group(uuid,uuid) to authenticated;

-- Global identity is not an institution-searchable directory.
grant select on public.profiles,public.student_identities,public.platform_roles,public.roles,public.program_types to authenticated;
grant update(full_name,preferred_name,phone,email,avatar_path,locale,timezone,last_seen_at) on public.profiles to authenticated;
create policy profiles_self_read on public.profiles for select to authenticated
using (id = (select private.current_profile_id()));
create policy profiles_self_update on public.profiles for update to authenticated
using (id = (select private.current_profile_id())) with check (id = (select private.current_profile_id()));
create policy identities_self_read on public.student_identities for select to authenticated
using (profile_id = (select private.current_profile_id()) and deleted_at is null);
create policy platform_roles_self_read on public.platform_roles for select to authenticated
using (profile_id = (select private.current_profile_id()) and deleted_at is null);
create policy roles_read on public.roles for select to authenticated using ((select private.current_profile_id()) is not null);
create policy program_types_read on public.program_types for select to authenticated
using ((select private.current_profile_id()) is not null and is_active);

grant select on public.institutions,public.institution_members to authenticated;
grant update(name,short_name,institution_type,logo_path,address,city,province,country_code,timezone) on public.institutions to authenticated;
grant update(status,ended_at,is_primary,deleted_at) on public.institution_members to authenticated;
create policy institutions_read on public.institutions for select to authenticated
using (deleted_at is null and (private.has_role(id,'INSTITUTION_ADMIN') or private.is_super_admin()));
create policy institutions_update on public.institutions for update to authenticated
using (deleted_at is null and private.has_role(id,'INSTITUTION_ADMIN'))
with check (deleted_at is null and private.has_role(id,'INSTITUTION_ADMIN'));
create policy members_read on public.institution_members for select to authenticated
using (deleted_at is null and (profile_id = private.current_profile_id() or private.has_role(institution_id,'INSTITUTION_ADMIN') or private.is_super_admin()));
create policy members_update on public.institution_members for update to authenticated
using (deleted_at is null and private.has_role(institution_id,'INSTITUTION_ADMIN'))
with check (private.has_role(institution_id,'INSTITUTION_ADMIN'));

-- Local person data can be managed by the institution. Binding an account is server-only.
grant select on public.student_profiles,public.teacher_profiles,public.guardian_profiles to authenticated;
grant insert(institution_id,institution_student_id,nis_local,nisn,display_name,gender,birth_date_local,status,metadata),
  update(institution_student_id,nis_local,nisn,display_name,gender,birth_date_local,status,metadata,deleted_at)
  on public.student_profiles to authenticated;
grant insert(institution_id,profile_id,teacher_public_id,employee_code,status,metadata),
  update(employee_code,status,metadata,deleted_at) on public.teacher_profiles to authenticated;
grant insert(institution_id,profile_id,guardian_public_id,status,metadata),
  update(status,metadata,deleted_at) on public.guardian_profiles to authenticated;

create policy students_read on public.student_profiles for select to authenticated
using (deleted_at is null and (private.has_role(institution_id,'INSTITUTION_ADMIN')
  or private.personal_student(institution_id,id) or private.teaches_student(institution_id,id)));
create policy teachers_read on public.teacher_profiles for select to authenticated
using (deleted_at is null and (private.has_role(institution_id,'INSTITUTION_ADMIN')
  or (profile_id = private.current_profile_id() and private.has_role(institution_id,'TEACHER'))));
create policy guardians_read on public.guardian_profiles for select to authenticated
using (deleted_at is null and (private.has_role(institution_id,'INSTITUTION_ADMIN')
  or (profile_id = private.current_profile_id() and private.has_role(institution_id,'GUARDIAN'))));

grant select,insert,update on public.guardian_students,public.programs,public.groups,
  public.institution_enrollments,public.program_enrollments,public.group_memberships,public.teacher_assignments to authenticated;

create policy guardian_links_read on public.guardian_students for select to authenticated
using (deleted_at is null and (private.has_role(institution_id,'INSTITUTION_ADMIN') or (
  status = 'VERIFIED' and exists(select 1 from public.guardian_profiles g where g.id = guardian_id
    and g.institution_id = guardian_students.institution_id and g.profile_id = private.current_profile_id()
    and g.status = 'ACTIVE' and g.deleted_at is null and private.has_role(g.institution_id,'GUARDIAN')))));
create policy programs_read on public.programs for select to authenticated
using (deleted_at is null and (private.has_role(institution_id,'INSTITUTION_ADMIN')
  or private.teaches_scope(institution_id,id) or private.personal_program(institution_id,id)));
create policy groups_read on public.groups for select to authenticated
using (deleted_at is null and (private.has_role(institution_id,'INSTITUTION_ADMIN')
  or (is_active and status = 'ACTIVE' and private.teaches_scope(institution_id,program_id,id))
  or private.personal_group(institution_id,id)));
create policy institution_enrollments_read on public.institution_enrollments for select to authenticated
using (deleted_at is null and (private.has_role(institution_id,'INSTITUTION_ADMIN')
  or private.personal_student(institution_id,student_id)
  or (status = 'ACTIVE' and private.teaches_student(institution_id,student_id))));
create policy program_enrollments_read on public.program_enrollments for select to authenticated
using (deleted_at is null and (private.has_role(institution_id,'INSTITUTION_ADMIN')
  or private.personal_student(institution_id,student_id)
  or (status = 'ACTIVE' and private.teaches_student(institution_id,student_id,program_id))));
create policy group_memberships_read on public.group_memberships for select to authenticated
using (deleted_at is null and (private.has_role(institution_id,'INSTITUTION_ADMIN')
  or private.personal_student(institution_id,student_id)
  or (status = 'ACTIVE' and ended_at is null and started_at <= now()
    and private.teaches_student(institution_id,student_id,program_id,group_id))));
create policy assignments_read on public.teacher_assignments for select to authenticated
using (deleted_at is null and (private.has_role(institution_id,'INSTITUTION_ADMIN') or (
  private.has_role(institution_id,'TEACHER') and exists(select 1 from public.teacher_profiles t
    where t.id = teacher_id and t.institution_id = teacher_assignments.institution_id
      and t.profile_id = private.current_profile_id() and t.deleted_at is null and t.status = 'ACTIVE'))));

do $$
declare t text;
begin
  foreach t in array array['student_profiles','teacher_profiles','guardian_profiles','guardian_students','programs','groups',
    'institution_enrollments','program_enrollments','group_memberships','teacher_assignments'] loop
    execute format('create policy admin_insert on public.%I for insert to authenticated with check (deleted_at is null and private.has_role(institution_id,''INSTITUTION_ADMIN''))',t);
    execute format('create policy admin_update on public.%I for update to authenticated using (deleted_at is null and private.has_role(institution_id,''INSTITUTION_ADMIN'')) with check (private.has_role(institution_id,''INSTITUTION_ADMIN''))',t);
  end loop;
end;
$$;

grant select on public.audit_logs to authenticated;
create policy audit_read on public.audit_logs for select to authenticated
using ((institution_id is not null and private.has_role(institution_id,'INSTITUTION_ADMIN'))
  or (institution_id is null and private.is_super_admin()));

-- No DELETE/TRUNCATE grants, no anon table grants, no client writes to global references,
-- identities/platform roles, and no direct client membership creation.
