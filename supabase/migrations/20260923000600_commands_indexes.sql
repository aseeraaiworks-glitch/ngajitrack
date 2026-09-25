create function private.create_institution(code text, institution_name text, kind text, admin_profile uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if not private.is_super_admin() then
    raise exception 'Platform administrator required' using errcode = '42501';
  end if;
  if not exists(select 1 from public.profiles where id = admin_profile and is_active and deleted_at is null) then
    raise exception 'Active admin profile required' using errcode = '23514';
  end if;
  insert into public.institutions(public_code,name,institution_type,status)
    values(code,institution_name,kind,'ACTIVE') returning id into result;
  insert into public.institution_members(institution_id,profile_id,role_id,status,joined_at)
    select result,admin_profile,id,'ACTIVE',now() from public.roles where roles.code = 'INSTITUTION_ADMIN';
  return result;
end;
$$;
revoke all on function private.create_institution(text,text,text,uuid) from public,anon;
grant execute on function private.create_institution(text,text,text,uuid) to authenticated;
create function public.create_institution(code text,institution_name text,kind text,admin_profile uuid)
returns uuid language sql security invoker set search_path = '' as $$
  select private.create_institution(code,institution_name,kind,admin_profile)
$$;
revoke all on function public.create_institution(text,text,text,uuid) from public,anon;
grant execute on function public.create_institution(text,text,text,uuid) to authenticated;

-- A limited projection: field users cannot SELECT full institution records.
create function private.my_institutions()
returns table(id uuid,public_code text,name text,institution_type text,timezone text)
language sql stable security definer set search_path = '' as $$
  select distinct i.id,i.public_code,i.name,i.institution_type,i.timezone
  from public.institutions i join public.institution_members m on m.institution_id = i.id
  where m.profile_id = private.current_profile_id() and m.status = 'ACTIVE' and m.deleted_at is null
    and m.ended_at is null and (m.joined_at is null or m.joined_at <= now())
    and i.is_active and i.deleted_at is null and i.status in ('ACTIVE','TRIAL')
$$;
revoke all on function private.my_institutions() from public,anon;
grant execute on function private.my_institutions() to authenticated;
create function public.my_institutions()
returns table(id uuid,public_code text,name text,institution_type text,timezone text)
language sql stable security invoker set search_path = '' as $$ select * from private.my_institutions() $$;
revoke all on function public.my_institutions() from public,anon;
grant execute on function public.my_institutions() to authenticated;

create function public.move_student_group(enrollment_id uuid,target_group_id uuid)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare pe public.program_enrollments; result uuid;
begin
  select * into pe from public.program_enrollments where id = enrollment_id for update;
  if not found or not private.has_role(pe.institution_id,'INSTITUTION_ADMIN') then
    raise exception 'Institution administrator required' using errcode = '42501';
  end if;
  if pe.status <> 'ACTIVE' or pe.deleted_at is not null then
    raise exception 'Active program enrollment required' using errcode = '23514';
  end if;
  if not exists(select 1 from public.groups where id = target_group_id and institution_id = pe.institution_id
    and program_id = pe.program_id and is_active and status = 'ACTIVE' and deleted_at is null) then
    raise exception 'Active group in the same program required' using errcode = '23514';
  end if;
  -- Idempotent when already in the requested class; lock above serializes concurrent moves.
  select id into result from public.group_memberships where program_enrollment_id = pe.id
    and group_id = target_group_id and status = 'ACTIVE' and deleted_at is null;
  if found then return result; end if;
  update public.group_memberships set status = 'COMPLETED',ended_at = now()
    where program_enrollment_id = pe.id and status = 'ACTIVE' and deleted_at is null;
  insert into public.group_memberships(institution_id,program_enrollment_id,student_id,program_id,group_id,status,assigned_by)
    values(pe.institution_id,pe.id,pe.student_id,pe.program_id,target_group_id,'ACTIVE',private.current_profile_id())
    returning id into result;
  return result;
end;
$$;
revoke all on function public.move_student_group(uuid,uuid) from public,anon;
grant execute on function public.move_student_group(uuid,uuid) to authenticated;

create function private.stamp_guardian_verification() returns trigger
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.current_profile_id();
begin
  if new.status = 'VERIFIED' and (tg_op = 'INSERT' or old.status <> 'VERIFIED') then
    new.verified_at := now();
    -- Server-only provisioning without a JWT must supply a verified actor explicitly.
    new.verified_by := coalesce(actor,new.verified_by);
  elsif tg_op = 'UPDATE' then
    new.verified_at := old.verified_at;
    new.verified_by := old.verified_by;
  end if;
  return new;
end;
$$;
revoke all on function private.stamp_guardian_verification() from public,anon,authenticated;
create trigger stamp_verification before insert or update on public.guardian_students
for each row execute function private.stamp_guardian_verification();

create index students_tenant_status on public.student_profiles(institution_id,status) where deleted_at is null;
create index students_identity on public.student_profiles(student_identity_id) where deleted_at is null;
create index teacher_profile_login on public.teacher_profiles(profile_id,institution_id) where deleted_at is null;
create index guardian_profile_login on public.guardian_profiles(profile_id,institution_id) where deleted_at is null;
create index guardian_child_lookup on public.guardian_students(institution_id,student_id,guardian_id) where deleted_at is null and status = 'VERIFIED';
create index programs_tenant_type on public.programs(institution_id,program_type_id) where deleted_at is null;
create index programs_type on public.programs(program_type_id);
create index groups_program on public.groups(institution_id,program_id) where deleted_at is null;
create index institution_enrollment_roster on public.institution_enrollments(institution_id,status,student_id) where deleted_at is null;
create index program_enrollment_student on public.program_enrollments(institution_id,student_id,program_id,status) where deleted_at is null;
create index program_enrollment_parent on public.program_enrollments(institution_id,student_id,institution_enrollment_id);
create index program_enrollment_program on public.program_enrollments(institution_id,program_id);
create index group_membership_roster on public.group_memberships(institution_id,group_id,status,student_id) where deleted_at is null;
create index group_membership_parent on public.group_memberships(institution_id,student_id,program_id,program_enrollment_id);
create index teacher_assignment_lookup on public.teacher_assignments(institution_id,teacher_id,program_id,group_id) where deleted_at is null;
create index teacher_assignment_group on public.teacher_assignments(institution_id,program_id,group_id);
create index audit_tenant_time on public.audit_logs(institution_id,created_at desc);
create index audit_entity on public.audit_logs(entity_type,entity_id,created_at desc);

-- Soft-delete through a narrowly scoped command: normal SELECT policies never
-- expose deleted rows, including to an institution administrator.
create function private.soft_delete_record(entity_table text,record_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare tenant uuid;
begin
  if entity_table not in ('student_profiles','teacher_profiles','guardian_profiles','guardian_students',
    'programs','groups','institution_enrollments','program_enrollments','group_memberships','teacher_assignments','institution_members') then
    raise exception 'Unsupported soft-delete entity' using errcode = '42501';
  end if;
  execute format('select institution_id from public.%I where id=$1 for update',entity_table) into tenant using record_id;
  if tenant is null or not private.has_role(tenant,'INSTITUTION_ADMIN') then
    raise exception 'Institution administrator required' using errcode = '42501';
  end if;
  execute format('update public.%I set deleted_at=now() where id=$1 and deleted_at is null',entity_table) using record_id;
end;
$$;
revoke all on function private.soft_delete_record(text,uuid) from public,anon;
grant execute on function private.soft_delete_record(text,uuid) to authenticated;
create function public.soft_delete_record(entity_table text,record_id uuid) returns void
language sql security invoker set search_path = '' as $$ select private.soft_delete_record(entity_table,record_id) $$;
revoke all on function public.soft_delete_record(text,uuid) from public,anon;
grant execute on function public.soft_delete_record(text,uuid) to authenticated;

create function private.set_institution_status(tenant_id uuid,new_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_super_admin() then raise exception 'Platform administrator required' using errcode = '42501'; end if;
  update public.institutions set status=new_status where id=tenant_id and deleted_at is null;
  if not found then raise exception 'Institution not found' using errcode = 'P0002'; end if;
end;
$$;
revoke all on function private.set_institution_status(uuid,text) from public,anon;
grant execute on function private.set_institution_status(uuid,text) to authenticated;
create function public.set_institution_status(tenant_id uuid,new_status text) returns void
language sql security invoker set search_path = '' as $$ select private.set_institution_status(tenant_id,new_status) $$;
revoke all on function public.set_institution_status(uuid,text) from public,anon;
grant execute on function public.set_institution_status(uuid,text) to authenticated;
