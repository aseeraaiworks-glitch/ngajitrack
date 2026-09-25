-- Operational scheduler only. Product tables, policies and worker stay unchanged.
-- Requires pg_cron preload and a passwordless LOCAL connection path already verified.
-- No authentication/HBA changes or credentials are installed by this migration.
create extension if not exists pg_cron;

do $$
begin
  if current_database() <> current_setting('cron.database_name') then
    raise exception 'Apply scheduler migration only in cron.database_name';
  end if;
  if not exists(select 1 from pg_roles where rolname='ngt_expiry_scheduler') then
    create role ngt_expiry_scheduler login noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls password null;
    comment on role ngt_expiry_scheduler is 'NgajiTrack expiry-only scheduler; managed by migration 8';
  elsif (select shobj_description(oid,'pg_authid') from pg_roles where rolname='ngt_expiry_scheduler') is distinct from 'NgajiTrack expiry-only scheduler; managed by migration 8' then
    raise exception 'Refusing to reuse an unmanaged scheduler role';
  end if;
  if exists(select 1 from pg_roles where rolname='ngt_expiry_scheduler' and
    (rolsuper or rolinherit or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls or not rolcanlogin))
    or exists(select 1 from pg_auth_members where member=(select oid from pg_roles where rolname='ngt_expiry_scheduler')) then
    raise exception 'Scheduler role has unexpected attributes or memberships';
  end if;
  if pg_has_role('authenticator','ngt_expiry_scheduler','MEMBER') or pg_has_role('authenticated','ngt_expiry_scheduler','MEMBER')
    or pg_has_role('anon','ngt_expiry_scheduler','MEMBER') then
    raise exception 'Client must not assume scheduler role';
  end if;
  -- Installation-only ability to register the job AS its execution role.
  execute format('grant ngt_expiry_scheduler to %I with inherit false, set true',current_user);
  execute format('grant connect on database %I to ngt_expiry_scheduler',current_database());
end;
$$;
alter role ngt_expiry_scheduler password null;
alter role ngt_expiry_scheduler set search_path = '';
alter role ngt_expiry_scheduler set statement_timeout = '60s';
alter role ngt_expiry_scheduler set lock_timeout = '5s';
grant usage on schema public to ngt_expiry_scheduler;
grant execute on function public.expire_institution_enrollments(integer) to ngt_expiry_scheduler;

-- Refuse privilege drift rather than silently activating an overprivileged role.
do $$
begin
  if exists(select 1 from pg_tables where schemaname in ('public','private') and
    has_table_privilege('ngt_expiry_scheduler',format('%I.%I',schemaname,tablename),'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')) then
    raise exception 'Scheduler has unexpected direct product-table privileges';
  end if;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where (n.nspname='private' or (n.nspname='public' and p.proname in
      ('create_institution','my_institutions','set_institution_status','move_student_group','soft_delete_record','end_institution_enrollment')))
      and has_function_privilege('ngt_expiry_scheduler',p.oid,'EXECUTE')) then
    raise exception 'Scheduler has unexpected application-function privileges';
  end if;
  if exists(select 1 from cron.job where jobname='ngajitrack-expire-enrollments' and
    (username<>'ngt_expiry_scheduler' or database<>current_database())) then
    raise exception 'Conflicting scheduler job owner or database';
  end if;
end;
$$;

-- Metadata/control is administrative, not an API surface.
revoke all on schema cron from public,anon,authenticated,authenticator,ngt_expiry_scheduler;
revoke all on all tables in schema cron from public,anon,authenticated,authenticator,ngt_expiry_scheduler;
revoke all on all sequences in schema cron from public,anon,authenticated,authenticator,ngt_expiry_scheduler;
revoke all on all functions in schema cron from public,anon,authenticated,authenticator,ngt_expiry_scheduler;
-- These grants exist only within the migration transaction and are revoked below.
grant usage on schema cron to ngt_expiry_scheduler;
grant execute on function cron.schedule(text,text,text) to ngt_expiry_scheduler;
set local role ngt_expiry_scheduler;
select cron.schedule('ngajitrack-expire-enrollments','*/15 * * * *','select public.expire_institution_enrollments(500)');
reset role;
revoke all on schema cron from ngt_expiry_scheduler;
revoke execute on function cron.schedule(text,text,text) from ngt_expiry_scheduler;
do $$
begin
  execute format('revoke ngt_expiry_scheduler from %I',current_user);
  -- PostgreSQL 16+ retains a bootstrap-granted ADMIN-only membership for a
  -- non-superuser CREATEROLE installer. It conveys no SET/INHERIT capability.
  if exists(select 1 from pg_auth_members where roleid=(select oid from pg_roles where rolname='ngt_expiry_scheduler')
    and (member<>current_user::regrole or not admin_option or inherit_option or set_option)) then
    raise exception 'Unexpected scheduler role membership after installation';
  end if;
end;
$$;
