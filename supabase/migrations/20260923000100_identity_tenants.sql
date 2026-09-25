-- NgajiTrack backend foundation. Ordered migration; replay on a clean database.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;
revoke create on schema public from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete restrict,
  full_name text not null,
  preferred_name text,
  phone text,
  email text,
  avatar_path text,
  locale text not null default 'id',
  timezone text not null default 'Asia/Jakarta',
  is_active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete restrict
);
alter table public.profiles enable row level security;
revoke all on public.profiles from public, anon, authenticated;
grant all on public.profiles to service_role;
create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete restrict,
  public_code text not null unique check (btrim(public_code) <> ''),
  name text not null check (btrim(name) <> ''),
  short_name text,
  institution_type text not null,
  logo_path text,
  address text,
  city text,
  province text,
  country_code text not null default 'ID',
  timezone text not null default 'Asia/Jakarta',
  status text not null default 'DRAFT' check (status in ('DRAFT','PENDING_VERIFICATION','TRIAL','ACTIVE','SUSPENDED','ARCHIVED')),
  is_active boolean not null default true
);
alter table public.institutions enable row level security;
revoke all on public.institutions from public, anon, authenticated;
grant all on public.institutions to service_role;
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('SUPER_ADMIN','INSTITUTION_ADMIN','TEACHER','GUARDIAN','STUDENT')),
  name text not null,
  description text
);
alter table public.roles enable row level security;
revoke all on public.roles from public, anon, authenticated;
grant all on public.roles to service_role;
create table public.institution_members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete restrict,
  institution_id uuid not null references public.institutions(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  role_id uuid not null references public.roles(id) on delete restrict,
  status text not null default 'PENDING' check (status in ('PENDING','ACTIVE','INACTIVE','ARCHIVED')),
  joined_at timestamptz,
  ended_at timestamptz,
  is_primary boolean not null default false,
  check (ended_at is null or joined_at is null or ended_at >= joined_at),
  check (status <> 'ACTIVE' or ended_at is null)
);
alter table public.institution_members enable row level security;
revoke all on public.institution_members from public, anon, authenticated;
grant all on public.institution_members to service_role;
create table public.platform_roles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  role_code text not null check (role_code = 'SUPER_ADMIN'),
  is_active boolean not null default true,
  unique(profile_id,role_code)
);
alter table public.platform_roles enable row level security;
revoke all on public.platform_roles from public, anon, authenticated;
grant all on public.platform_roles to service_role;

create unique index institution_members_live_key on public.institution_members(institution_id,profile_id,role_id) where deleted_at is null;
create index institution_members_profile_scope on public.institution_members(profile_id,institution_id,role_id) where deleted_at is null and status = 'ACTIVE';

insert into public.roles(code,name) values
('SUPER_ADMIN','Super Admin'),('INSTITUTION_ADMIN','Admin Lembaga'),('TEACHER','Ustaz/Ustazah'),('GUARDIAN','Wali'),('STUDENT','Santri');

create function private.handle_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(auth_user_id,full_name)
  values (new.id,coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'),''),'Pengguna'));
  return new;
end;
$$;
revoke all on function private.handle_auth_user() from public,anon,authenticated;
create trigger on_auth_user_created after insert on auth.users
for each row execute function private.handle_auth_user();
-- Existing auth users, if any, get a profile; metadata never grants roles.
insert into public.profiles(auth_user_id,full_name)
select id,coalesce(nullif(btrim(raw_user_meta_data->>'full_name'),''),'Pengguna') from auth.users
on conflict(auth_user_id) do nothing;
