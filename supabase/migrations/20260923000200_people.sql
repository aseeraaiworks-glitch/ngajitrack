-- NgajiTrack backend foundation. Ordered migration; replay on a clean database.

create table public.student_identities (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete restrict,
  ngajitrack_student_id text not null unique check (btrim(ngajitrack_student_id) <> ''),
  profile_id uuid unique references public.profiles(id) on delete restrict,
  full_name_canonical text,
  birth_date date,
  status text not null default 'PENDING' check (status in ('PENDING','ACTIVE','INACTIVE','ARCHIVED'))
);
alter table public.student_identities enable row level security;
revoke all on public.student_identities from public, anon, authenticated;
grant all on public.student_identities to service_role;
create table public.student_profiles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete restrict,
  institution_id uuid not null references public.institutions(id) on delete restrict,
  student_identity_id uuid references public.student_identities(id) on delete restrict,
  institution_student_id text,
  nis_local text,
  nisn text,
  display_name text not null check (btrim(display_name) <> ''),
  gender text,
  birth_date_local date,
  status text not null default 'PENDING' check (status in ('PENDING','ACTIVE','INACTIVE','GRADUATED','TRANSFERRED','ARCHIVED')),
  metadata jsonb not null default '{}' check (jsonb_typeof(metadata) = 'object'),
  unique(institution_id,id)
);
alter table public.student_profiles enable row level security;
revoke all on public.student_profiles from public, anon, authenticated;
grant all on public.student_profiles to service_role;
create table public.teacher_profiles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete restrict,
  institution_id uuid not null references public.institutions(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  teacher_public_id text not null,
  employee_code text,
  status text not null default 'PENDING' check (status in ('PENDING','ACTIVE','INACTIVE','ARCHIVED')),
  metadata jsonb not null default '{}' check (jsonb_typeof(metadata) = 'object'),
  unique(institution_id,id),
  unique(institution_id,teacher_public_id)
);
alter table public.teacher_profiles enable row level security;
revoke all on public.teacher_profiles from public, anon, authenticated;
grant all on public.teacher_profiles to service_role;
create table public.guardian_profiles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete restrict,
  institution_id uuid not null references public.institutions(id) on delete restrict,
  profile_id uuid references public.profiles(id) on delete restrict,
  guardian_public_id text not null,
  status text not null default 'PENDING' check (status in ('PENDING','ACTIVE','INACTIVE','ARCHIVED')),
  metadata jsonb not null default '{}' check (jsonb_typeof(metadata) = 'object'),
  unique(institution_id,id),
  unique(institution_id,guardian_public_id)
);
alter table public.guardian_profiles enable row level security;
revoke all on public.guardian_profiles from public, anon, authenticated;
grant all on public.guardian_profiles to service_role;
create table public.guardian_students (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete restrict,
  institution_id uuid not null references public.institutions(id) on delete restrict,
  guardian_id uuid not null,
  student_id uuid not null,
  relationship_type text check (relationship_type in ('FATHER','MOTHER','GUARDIAN','OTHER')),
  status text not null default 'PENDING' check (status in ('PENDING','VERIFIED','REVOKED')),
  is_primary boolean not null default false,
  can_view_progress boolean not null default true,
  can_receive_updates boolean not null default true,
  verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete restrict,
  foreign key (institution_id,guardian_id) references public.guardian_profiles (institution_id,id) on delete restrict,
  foreign key (institution_id,student_id) references public.student_profiles (institution_id,id) on delete restrict,
  check (status <> 'VERIFIED' or (verified_at is not null and verified_by is not null))
);
alter table public.guardian_students enable row level security;
revoke all on public.guardian_students from public, anon, authenticated;
grant all on public.guardian_students to service_role;

create unique index student_local_id_key on public.student_profiles(institution_id,institution_student_id) where institution_student_id is not null and deleted_at is null;
create unique index student_identity_tenant_key on public.student_profiles(institution_id,student_identity_id) where student_identity_id is not null and deleted_at is null;
create unique index teacher_profile_tenant_key on public.teacher_profiles(institution_id,profile_id) where deleted_at is null;
create unique index guardian_profile_tenant_key on public.guardian_profiles(institution_id,profile_id) where profile_id is not null and deleted_at is null;
create unique index guardian_student_live_key on public.guardian_students(institution_id,guardian_id,student_id) where deleted_at is null;
