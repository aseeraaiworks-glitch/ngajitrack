-- Forward-only migration: existing enrollment dates/history remain unchanged.
alter table public.institution_enrollments
  add column enrollment_type text not null default 'REGULAR'
    check (enrollment_type in ('REGULAR','TEMPORARY','HOLIDAY')),
  add column scheduled_end_at date,
  add column reason text,
  add constraint enrollment_schedule_valid check (
    (enrollment_type = 'REGULAR' or (started_at is not null and scheduled_end_at is not null))
    and (scheduled_end_at is null or (started_at is not null and scheduled_end_at > started_at
      and isfinite(scheduled_end_at) and isfinite(started_at)))
  );
comment on column public.institution_enrollments.started_at is 'Inclusive start date in institution timezone.';
comment on column public.institution_enrollments.scheduled_end_at is 'Exclusive validity limit in institution timezone; independent of scheduler execution.';
comment on column public.institution_enrollments.ended_at is 'Actual closure date in institution timezone; audit records the processing timestamp.';

-- Closing a planned enrollment/placement before it starts is valid. ENDED dates
-- are server-stamped below; existing statuses retain their original ordering rule.
alter table public.institution_enrollments drop constraint institution_enrollments_check;
alter table public.institution_enrollments add constraint institution_closure_date_order
  check (status='ENDED' or ended_at is null or started_at is null or ended_at >= started_at);
alter table public.program_enrollments drop constraint program_enrollments_check;
alter table public.program_enrollments add constraint program_closure_date_order
  check (status='ENDED' or completed_at is null or enrolled_at is null or completed_at >= enrolled_at);
alter table public.group_memberships drop constraint group_memberships_check;
alter table public.group_memberships add constraint group_closure_date_order
  check (status='ENDED' or ended_at is null or ended_at >= started_at);

alter table public.institution_enrollments drop constraint institution_enrollments_status_check;
alter table public.program_enrollments drop constraint program_enrollments_status_check;
alter table public.group_memberships drop constraint group_memberships_status_check;
do $$
declare t text;
begin
  foreach t in array array['institution_enrollments','program_enrollments','group_memberships'] loop
    execute format('alter table public.%I add constraint %I check (status in (''PENDING'',''ACTIVE'',''COMPLETED'',''GRADUATED'',''TRANSFERRED'',''WITHDRAWN'',''ARCHIVED'',''ENDED''))',t,t||'_status_check');
  end loop;
end;
$$;

create function private.institution_today(tenant_id uuid) returns date
language sql stable security definer set search_path = '' as $$
  select (statement_timestamp() at time zone i.timezone)::date from public.institutions i where i.id = tenant_id
$$;
revoke all on function private.institution_today(uuid) from public,anon,authenticated;

create function private.enrollment_operational(enrollment_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.institution_enrollments e
    join public.institutions i on i.id=e.institution_id
    where e.id=enrollment_id and e.status='ACTIVE' and e.deleted_at is null and e.ended_at is null
      and i.is_active and i.deleted_at is null and i.status in ('ACTIVE','TRIAL')
      and (e.started_at is null or e.started_at <= (statement_timestamp() at time zone i.timezone)::date)
      and (e.scheduled_end_at is null or (statement_timestamp() at time zone i.timezone)::date < e.scheduled_end_at))
$$;
revoke all on function private.enrollment_operational(uuid) from public,anon;
grant execute on function private.enrollment_operational(uuid) to authenticated;

-- Invalid timezone values would otherwise break every expiry batch. Changing
-- timezone while a schedule is open could also resurrect access at a date boundary.
do $$
begin
  if exists(select 1 from public.institutions i where not exists(
    select 1 from pg_catalog.pg_timezone_names z where z.name=i.timezone)) then
    raise exception 'Invalid institution timezone: repair existing values before migration' using errcode='23514';
  end if;
end;
$$;
create function private.validate_schedule_timezone() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.timezone) then
    raise exception 'Invalid institution timezone' using errcode='23514';
  end if;
  if tg_op='UPDATE' and new.timezone is distinct from old.timezone and exists(
    select 1 from public.institution_enrollments where institution_id=new.id
      and status in ('PENDING','ACTIVE') and scheduled_end_at is not null and deleted_at is null) then
    raise exception 'Close scheduled enrollments before changing institution timezone' using errcode='23514';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_schedule_timezone() from public,anon,authenticated;
create trigger validate_schedule_timezone before insert or update of timezone on public.institutions
for each row execute function private.validate_schedule_timezone();

create index enrollment_expiry_candidates on public.institution_enrollments(scheduled_end_at,institution_id)
  where status in ('PENDING','ACTIVE') and scheduled_end_at is not null and deleted_at is null;

-- A terminal enrollment is immutable, including its schedule and soft-delete fields.
create function private.guard_enrollment_period() returns trigger
language plpgsql security definer set search_path = '' as $$
declare today date := private.institution_today(new.institution_id);
begin
  if tg_op='UPDATE' then
    if old.status='ENDED' then
      raise exception 'Historical enrollment is read-only' using errcode='23514';
    end if;
    if tg_table_name='institution_enrollments' then
      if old.scheduled_end_at is not null and old.scheduled_end_at <= today
        and (new.scheduled_end_at is distinct from old.scheduled_end_at
          or new.started_at is distinct from old.started_at or new.enrollment_type is distinct from old.enrollment_type
          or (old.status <> 'ACTIVE' and new.status='ACTIVE')) then
        raise exception 'Expired enrollment cannot be rescheduled or reactivated' using errcode='23514';
      end if;
    end if;
  end if;
  if new.status='ENDED' then
    if tg_table_name='program_enrollments' then new.completed_at := today;
    elsif tg_table_name='group_memberships' then new.ended_at := statement_timestamp();
    else new.ended_at := today;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_enrollment_period() from public,anon,authenticated;
do $$
declare t text;
begin
  foreach t in array array['institution_enrollments','program_enrollments','group_memberships'] loop
    execute format('create trigger guard_enrollment_period before insert or update on public.%I for each row execute function private.guard_enrollment_period()',t);
  end loop;
end;
$$;

-- Check the root period even for a group whose immediate program parent still says ACTIVE.
-- Locking the root coordinates writes with closure and period changes.
create function private.require_enrollment_period() returns trigger
language plpgsql security definer set search_path = '' as $$
declare root_id uuid;
begin
  if tg_op='UPDATE' and (new.deleted_at is not null or new.status not in ('PENDING','ACTIVE')) then return new; end if;
  if new.status not in ('PENDING','ACTIVE') then return new; end if;
  if tg_table_name='program_enrollments' then root_id := new.institution_enrollment_id;
  else
    select institution_enrollment_id into root_id from public.program_enrollments
      where id=new.program_enrollment_id and institution_id=new.institution_id;
  end if;
  perform 1 from public.institution_enrollments where id=root_id and institution_id=new.institution_id for share;
  if not found or not private.enrollment_operational(root_id) then
    raise exception 'Operational institution enrollment required' using errcode='23514';
  end if;
  return new;
end;
$$;
revoke all on function private.require_enrollment_period() from public,anon,authenticated;
create trigger check_enrollment_period before insert or update on public.program_enrollments
for each row execute function private.require_enrollment_period();
create trigger check_enrollment_period before insert or update on public.group_memberships
for each row execute function private.require_enrollment_period();

-- Triggers enforce atomic closure for both the command and direct authorized UPDATE.
-- No profiles, memberships, guardian links or teacher assignments are touched.
create function private.close_enrollment_children() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status='ENDED' and old.status is distinct from new.status then
    if tg_table_name='institution_enrollments' then
      update public.program_enrollments set status='ENDED'
        where institution_id=new.institution_id and institution_enrollment_id=new.id and status in ('PENDING','ACTIVE');
    else
      update public.group_memberships set status='ENDED'
        where institution_id=new.institution_id and program_enrollment_id=new.id and status in ('PENDING','ACTIVE');
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.close_enrollment_children() from public,anon,authenticated;
create trigger close_enrollment_children after update on public.institution_enrollments
for each row execute function private.close_enrollment_children();
create trigger close_enrollment_children after update on public.program_enrollments
for each row execute function private.close_enrollment_children();

create function public.end_institution_enrollment(enrollment_id uuid, closure_reason text default null)
returns void language plpgsql security invoker set search_path = '' as $$
declare e public.institution_enrollments;
begin
  select * into e from public.institution_enrollments where id=enrollment_id for update;
  if not found or not private.has_role(e.institution_id,'INSTITUTION_ADMIN') then
    raise exception 'Institution administrator required' using errcode='42501';
  end if;
  if e.status='ENDED' then return; end if;
  if e.status not in ('PENDING','ACTIVE') or e.deleted_at is not null then
    raise exception 'Enrollment already closed' using errcode='23514';
  end if;
  update public.institution_enrollments set status='ENDED',completion_reason=closure_reason where id=e.id;
end;
$$;
revoke all on function public.end_institution_enrollment(uuid,text) from public,anon;
grant execute on function public.end_institution_enrollment(uuid,text) to authenticated;

-- Trusted scheduler entry point, bounded batches; never executable by API users.
create function public.expire_institution_enrollments(batch_size integer default 100) returns integer
language plpgsql security definer set search_path = '' as $$
declare e record; affected integer := 0;
begin
  if batch_size is null or batch_size < 1 or batch_size > 1000 then
    raise exception 'Batch size must be between 1 and 1000' using errcode='22023';
  end if;
  for e in select id from public.institution_enrollments
    where status in ('PENDING','ACTIVE') and deleted_at is null
      and scheduled_end_at <= private.institution_today(institution_id)
    order by scheduled_end_at,id limit batch_size for update skip locked loop
    update public.institution_enrollments set status='ENDED',completion_reason='SCHEDULE_EXPIRED' where id=e.id;
    affected := affected + 1;
  end loop;
  return affected;
end;
$$;
revoke all on function public.expire_institution_enrollments(integer) from public,anon,authenticated;
grant execute on function public.expire_institution_enrollments(integer) to service_role;

-- Extend existing guards and authorization without rewriting migrations 1-6.
create or replace function private.stamp_row() returns trigger
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
       and before_row->>'status' in ('COMPLETED','GRADUATED','TRANSFERRED','WITHDRAWN','ARCHIVED','ENDED') then
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

create or replace function private.require_live_parents() returns trigger
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
    or row_data->>'status' in ('INACTIVE','COMPLETED','GRADUATED','TRANSFERRED','WITHDRAWN','ARCHIVED','REVOKED','ENDED')
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

create or replace function private.teaches_student(tenant_id uuid, student uuid, program uuid default null, class_id uuid default null)
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
      and private.enrollment_operational(ie.id)
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

create or replace function public.move_student_group(enrollment_id uuid,target_group_id uuid)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare pe public.program_enrollments; result uuid;
begin
  perform 1 from public.institution_enrollments where id = (select institution_enrollment_id from public.program_enrollments where id=enrollment_id) for share;
  select * into pe from public.program_enrollments where id = enrollment_id for update;
  if not found or not private.has_role(pe.institution_id,'INSTITUTION_ADMIN') then
    raise exception 'Institution administrator required' using errcode = '42501';
  end if;
  if pe.status <> 'ACTIVE' or pe.deleted_at is not null or not private.enrollment_operational(pe.institution_enrollment_id) then
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
