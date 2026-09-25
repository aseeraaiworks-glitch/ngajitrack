-- NgajiTrack backend foundation. Ordered migration; replay on a clean database.

create table public.program_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.program_types enable row level security;
revoke all on public.program_types from public, anon, authenticated;
grant all on public.program_types to service_role;
create table public.programs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete restrict,
  institution_id uuid not null references public.institutions(id) on delete restrict,
  name text not null check (btrim(name) <> ''),
  description text,
  program_type_id uuid not null references public.program_types(id) on delete restrict,
  is_active boolean not null default true,
  unique(institution_id,id)
);
alter table public.programs enable row level security;
revoke all on public.programs from public, anon, authenticated;
grant all on public.programs to service_role;
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete restrict,
  institution_id uuid not null references public.institutions(id) on delete restrict,
  program_id uuid not null,
  name text not null check (btrim(name) <> ''),
  code text,
  description text,
  is_active boolean not null default true,
  status text not null default 'DRAFT' check (status in ('DRAFT','ACTIVE','INACTIVE','ARCHIVED')),
  foreign key (institution_id,program_id) references public.programs (institution_id,id) on delete restrict,
  unique(institution_id,id),
  unique(institution_id,program_id,id)
);
alter table public.groups enable row level security;
revoke all on public.groups from public, anon, authenticated;
grant all on public.groups to service_role;
create table public.institution_enrollments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete restrict,
  institution_id uuid not null references public.institutions(id) on delete restrict,
  student_id uuid not null,
  status text not null default 'PENDING' check (status in ('PENDING','ACTIVE','COMPLETED','GRADUATED','TRANSFERRED','WITHDRAWN','ARCHIVED')),
  started_at date,
  ended_at date,
  completion_reason text,
  source_type text,
  previous_institution_id uuid references public.institutions(id) on delete restrict,
  foreign key (institution_id,student_id) references public.student_profiles (institution_id,id) on delete restrict,
  unique(institution_id,student_id,id),
  check (ended_at is null or started_at is null or ended_at >= started_at),
  check (status <> 'ACTIVE' or ended_at is null)
);
alter table public.institution_enrollments enable row level security;
revoke all on public.institution_enrollments from public, anon, authenticated;
grant all on public.institution_enrollments to service_role;
create table public.program_enrollments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete restrict,
  institution_id uuid not null references public.institutions(id) on delete restrict,
  institution_enrollment_id uuid not null,
  program_id uuid not null,
  student_id uuid not null,
  status text not null default 'PENDING' check (status in ('PENDING','ACTIVE','COMPLETED','GRADUATED','TRANSFERRED','WITHDRAWN','ARCHIVED')),
  enrolled_at date,
  completed_at date,
  foreign key (institution_id,student_id,institution_enrollment_id) references public.institution_enrollments (institution_id,student_id,id) on delete restrict,
  foreign key (institution_id,program_id) references public.programs (institution_id,id) on delete restrict,
  unique(institution_id,student_id,program_id,id),
  check (completed_at is null or enrolled_at is null or completed_at >= enrolled_at),
  check (status <> 'ACTIVE' or completed_at is null)
);
alter table public.program_enrollments enable row level security;
revoke all on public.program_enrollments from public, anon, authenticated;
grant all on public.program_enrollments to service_role;
create table public.group_memberships (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete restrict,
  institution_id uuid not null references public.institutions(id) on delete restrict,
  program_enrollment_id uuid not null,
  student_id uuid not null,
  program_id uuid not null,
  group_id uuid not null,
  status text not null default 'PENDING' check (status in ('PENDING','ACTIVE','COMPLETED','GRADUATED','TRANSFERRED','WITHDRAWN','ARCHIVED')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  assigned_by uuid references public.profiles(id) on delete restrict,
  approved_by uuid references public.profiles(id) on delete restrict,
  foreign key (institution_id,student_id,program_id,program_enrollment_id) references public.program_enrollments (institution_id,student_id,program_id,id) on delete restrict,
  foreign key (institution_id,program_id,group_id) references public.groups (institution_id,program_id,id) on delete restrict,
  check (ended_at is null or ended_at >= started_at),
  check (status <> 'ACTIVE' or ended_at is null)
);
alter table public.group_memberships enable row level security;
revoke all on public.group_memberships from public, anon, authenticated;
grant all on public.group_memberships to service_role;
create table public.teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete restrict,
  institution_id uuid not null references public.institutions(id) on delete restrict,
  teacher_id uuid not null,
  program_id uuid not null,
  group_id uuid,
  assignment_role text not null default 'TEACHER',
  start_date date,
  end_date date,
  is_active boolean not null default true,
  foreign key (institution_id,teacher_id) references public.teacher_profiles (institution_id,id) on delete restrict,
  foreign key (institution_id,program_id) references public.programs (institution_id,id) on delete restrict,
  foreign key (institution_id,program_id,group_id) references public.groups (institution_id,program_id,id) on delete restrict,
  check (end_date is null or start_date is null or end_date >= start_date)
);
alter table public.teacher_assignments enable row level security;
revoke all on public.teacher_assignments from public, anon, authenticated;
grant all on public.teacher_assignments to service_role;

create unique index institution_enrollment_active_key on public.institution_enrollments(institution_id,student_id) where status = 'ACTIVE' and deleted_at is null;
create unique index program_enrollment_active_key on public.program_enrollments(institution_id,student_id,program_id) where status = 'ACTIVE' and deleted_at is null;
create unique index group_membership_active_key on public.group_memberships(institution_id,program_enrollment_id) where status = 'ACTIVE' and deleted_at is null;
insert into public.program_types(code,name) values ('TAHFIZ','Tahfiz'),('QURAN_READING','Baca Al-Qur''an'),('CUSTOM','Custom');
