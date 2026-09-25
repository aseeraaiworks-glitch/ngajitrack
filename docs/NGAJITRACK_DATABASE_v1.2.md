# NgajiTrack — Database Design

**Document:** `DATABASE.md`  
**Product:** NgajiTrack  
**Parent Brand:** Aseera  
**Status:** Draft v1.2 — Multi-Program Database + Quran Reading, Score, Calendar & Poster Foundation  
**Depends on:** `PRODUCT_SPEC.md`, `ARCHITECTURE.md`  
**Primary Database:** PostgreSQL  
**Recommended MVP Platform:** Supabase/PostgreSQL  
**Purpose:** Menjadi acuan struktur database NgajiTrack agar data multi-lembaga, role, program Tahfiz dan Quran Reading, progres santri, audit, Flutter client, serta fitur lanjutan dapat berkembang tanpa perlu membongkar fondasi inti.

---

# 1. Database Design Goals

Database NgajiTrack harus:

1. aman untuk multi-lembaga;
2. mendukung 5 role utama;
3. tidak menyimpan role sebagai satu field permanen di user;
4. mendukung satu user dengan beberapa peran;
5. mendukung banyak metode tahfiz;
6. mendukung metode Daarut Tahfiz-style;
7. mendukung metode Sulaimaniyah-style;
8. mendukung preset utama NgajiTrack;
9. mendukung custom label/configuration per lembaga;
10. mendukung progres berbasis halaman, ayat, lembar, juz, multi-juz, dan cycle;
11. menyimpan history sekaligus current state;
12. menjaga audit trail;
13. mendukung soft delete;
14. dapat dipakai web/PWA/Flutter/native dengan backend yang sama;
15. dapat berkembang tanpa migration besar yang destruktif;
16. mendukung identitas santri lintas lembaga tanpa mencampur data tenant;
17. mendukung bulk onboarding ratusan/ribuan santri;
18. mendukung linking akun existing dengan verifikasi aman;
19. mendukung riwayat tahfiz portabel dengan consent;
20. mendukung input ustaz yang tetap aman ketika internet terputus;
21. mendukung program Tahfiz dan Quran Reading dalam backend yang sama;
22. mendukung metode baca seperti Iqra/Ummi/Qiroati/Tilawati/Yanbu'a sebagai label/config tanpa menyalin isi buku;
23. mendukung quick input halaman 2–5 detik untuk kelas Quran Reading;
24. mendukung NgajiTrack Score yang versioned dan explainable;
25. mendukung kalender/jadwal santri tanpa membuat source-of-truth terpisah;
26. mendukung poster progres on-demand tanpa menyimpan file poster final permanen;
27. menjaga histori alumni/read-only tetap terpisah dari query operasional santri aktif;
28. tetap modular agar Personal Mode dan built-in Mushaf reader dapat ditambahkan kemudian tanpa masuk scope MVP saat ini.

Prinsip utama:

> **Data historis bersifat append-oriented, sedangkan posisi terkini disimpan sebagai state terpisah.**

---

# 2. Naming Convention

Gunakan:

- `snake_case` untuk table/column;
- singular/plural harus konsisten;
- primary key menggunakan `uuid`;
- timestamp menggunakan `timestamptz`;
- boolean menggunakan prefix yang jelas seperti `is_active`;
- foreign key berakhiran `_id`.

Contoh:

```text
institutions
institution_members
student_profiles
learning_sessions
progress_states
```

---

# 3. Primary Key Strategy

Gunakan:

```sql
id uuid primary key default gen_random_uuid()
```

Alasan:

- aman untuk distributed/mobile clients;
- tidak mudah ditebak;
- tidak bentrok saat future offline sync;
- cocok untuk public API.

Untuk ID yang ditampilkan ke user, gunakan **public identifier terpisah**.

Contoh:

```text
student_public_id = NGT-STU-8F2K91
institution_code = DTAI01
```

Jangan gunakan UUID sebagai ID manusia.

---

# 4. Time Strategy

Semua timestamp disimpan sebagai:

```sql
timestamptz
```

Standard:

```text
created_at
updated_at
deleted_at
```

Server menyimpan timezone-aware UTC-compatible timestamp.

UI menampilkan sesuai timezone lembaga/user.

---

# 5. Soft Delete Standard

Entitas penting menggunakan:

```text
deleted_at timestamptz null
deleted_by uuid null
```

Row dianggap aktif jika:

```sql
deleted_at is null
```

Tidak semua reference table wajib soft-delete, tetapi data user, submission, exam, institution config, dan relationship penting harus mendukungnya.

---

# 6. Audit Metadata Standard

Table yang mutable sebaiknya memiliki:

```text
created_at
created_by
updated_at
updated_by
```

Untuk perubahan sensitif, detail old/new value masuk ke `audit_logs`.

---

# 7. Multi-Tenant Rule

Semua data milik lembaga wajib memiliki:

```text
institution_id
```

langsung atau dapat diturunkan secara aman dari parent relation.

Untuk tabel operasional utama, lebih baik `institution_id` tetap eksplisit untuk:

- RLS;
- query;
- indexing;
- audit;
- debugging;
- reporting.

Tidak boleh ada query tenant-scoped tanpa filter tenant/security policy.

---

# 8. Core Domain Map

```text
AUTH USER
   │
   └── profiles
        │
        ├── institution_members
        │      ├── institutions
        │      └── roles
        │
        └── student_identities
               │
               └── student_profiles per lembaga

INSTITUTION
   │
   ├── institution_enrollments
   ├── programs
   ├── groups
   ├── group_memberships
   ├── method_configs
   ├── grading_schemes
   └── quick_notes

ONBOARDING & IDENTITY LINKING
   │
   ├── import_jobs
   ├── import_rows
   ├── student_link_requests
   ├── history_share_consents
   └── student_baselines

PROGRAM
   │
   ├── program_enrollments
   ├── group_memberships
   ├── teacher_assignments
   └── method_config

QURAN CORE
   │
   ├── quran_mushafs
   ├── quran_juz
   ├── quran_pages
   ├── quran_surahs
   └── quran_ayahs

TAHFIZ ENGINE
   │
   ├── method_presets
   ├── method_preset_stages
   ├── method_configs
   ├── method_stages
   └── method_rules

LEARNING
   │
   ├── learning_sessions
   ├── submissions
   ├── submission_segments
   ├── assessments
   ├── notes
   └── progress_states

OFFLINE / SYNC
   │
   └── client_operations

EXAM
   │
   ├── exams
   ├── exam_attempts
   └── exam_results

ASSISTED SETUP
   │
   └── method_setup_requests

SYSTEM
   │
   ├── audit_logs
   ├── notifications
   └── feature_flags
```

---

# 9. Table: `profiles`

Menyimpan profil user aplikasi.

Auth credential tetap dikelola auth provider.

## Columns

```text
id                  uuid PK
auth_user_id        uuid UNIQUE NOT NULL
full_name           text NOT NULL
preferred_name      text NULL
phone               text NULL
email               text NULL
avatar_path         text NULL
locale              text DEFAULT 'id'
timezone            text DEFAULT 'Asia/Jakarta'
is_active           boolean DEFAULT true
last_seen_at        timestamptz NULL
created_at          timestamptz NOT NULL
updated_at          timestamptz NOT NULL
deleted_at          timestamptz NULL
```

## Rules

- satu `auth_user_id` hanya punya satu profile;
- password tidak disimpan di sini;
- email/phone bukan source-of-truth auth jika auth provider punya tabel sendiri.

---

# 10. Table: `institutions`

Mewakili pesantren/lembaga/TPA/TPQ/SDIT/rumah tahfiz.

## Columns

```text
id                  uuid PK
public_code         text UNIQUE NOT NULL
name                text NOT NULL
short_name          text NULL
institution_type    text NOT NULL
logo_path           text NULL
address             text NULL
city                text NULL
province            text NULL
country_code        text DEFAULT 'ID'
timezone            text DEFAULT 'Asia/Jakarta'
status              text NOT NULL
is_active           boolean DEFAULT true
created_at          timestamptz NOT NULL
created_by          uuid NULL
updated_at          timestamptz NOT NULL
updated_by          uuid NULL
deleted_at          timestamptz NULL
deleted_by          uuid NULL
```

## Suggested status

```text
TRIAL
ACTIVE
SUSPENDED
ARCHIVED
```

Billing status tidak perlu lengkap di MVP.

---

# 11. Table: `roles`

Reference table.

## Rows

```text
SUPER_ADMIN
INSTITUTION_ADMIN
TEACHER
GUARDIAN
STUDENT
```

## Columns

```text
id          uuid PK
code        text UNIQUE NOT NULL
name        text NOT NULL
description text NULL
```

---

# 12. Table: `institution_members`

Menghubungkan user dengan lembaga dan role.

Ini adalah fondasi role model NgajiTrack.

## Columns

```text
id                  uuid PK
institution_id      uuid FK institutions
profile_id          uuid FK profiles
role_id             uuid FK roles
status              text NOT NULL
joined_at           timestamptz NULL
ended_at            timestamptz NULL
is_primary          boolean DEFAULT false
created_at          timestamptz NOT NULL
created_by          uuid NULL
updated_at          timestamptz NOT NULL
updated_by          uuid NULL
deleted_at          timestamptz NULL
```

## Unique

Disarankan:

```text
UNIQUE(institution_id, profile_id, role_id)
WHERE deleted_at IS NULL
```

Satu profile dapat:

- TEACHER di lembaga A;
- GUARDIAN di lembaga B.

---

# 13. Student Identity Model

NgajiTrack memisahkan **identitas global santri** dari **record santri milik lembaga**.

Tujuannya agar santri dapat tamat dari Lembaga A, masuk ke Lembaga B, tetap menggunakan identitas NgajiTrack yang sama, dan tetap menjaga isolasi data antar-lembaga.

```text
student_identities        ← global / portable
       │
       ├── optional login profile
       │
       ├── Lembaga A → student_profiles A
       └── Lembaga B → student_profiles B
```

## 13.1 Table: `student_identities`

```text
id                      uuid PK
ngajitrack_student_id   text UNIQUE NOT NULL
profile_id              uuid FK profiles NULL
full_name_canonical     text NULL
birth_date              date NULL
status                  text NOT NULL
created_at              timestamptz NOT NULL
updated_at              timestamptz NOT NULL
deleted_at              timestamptz NULL
```

### Rules

- satu identitas global dapat terhubung ke banyak record lembaga sepanjang waktu;
- `profile_id` nullable karena santri dapat tercatat sebelum memiliki akun login;
- `ngajitrack_student_id` bukan NIS/NISN;
- duplicate merge membutuhkan verification flow dan audit;
- data tenant lama tidak otomatis dibuka ke tenant baru.

## 13.2 Table: `student_profiles`

Record santri **khusus dalam satu lembaga**.

```text
id                      uuid PK
institution_id          uuid FK
student_identity_id     uuid FK student_identities NULL
institution_student_id  text NULL
nis_local               text NULL
nisn                    text NULL
display_name            text NOT NULL
gender                  text NULL
birth_date_local        date NULL
status                  text NOT NULL
default_mushaf_id       uuid NULL
metadata                jsonb DEFAULT '{}'
created_at              timestamptz NOT NULL
created_by              uuid NULL
updated_at              timestamptz NOT NULL
updated_by              uuid NULL
deleted_at              timestamptz NULL
deleted_by              uuid NULL
```

`student_identity_id` boleh sementara `NULL` ketika data baru diimport dan matching belum selesai. Setelah verification berhasil, record lokal dihubungkan ke identitas global existing.

---

# 14. Table: `teacher_profiles`

## Columns

```text
id                  uuid PK
institution_id      uuid FK
profile_id          uuid FK profiles NOT NULL
teacher_public_id   text NOT NULL
employee_code       text NULL
status              text NOT NULL
metadata            jsonb DEFAULT '{}'
created_at          timestamptz NOT NULL
updated_at          timestamptz NOT NULL
deleted_at          timestamptz NULL
```

---

# 15. Table: `guardian_profiles`

## Columns

```text
id                  uuid PK
institution_id      uuid FK
profile_id          uuid FK profiles NOT NULL
guardian_public_id  text NOT NULL
status              text NOT NULL
metadata            jsonb DEFAULT '{}'
created_at          timestamptz NOT NULL
updated_at          timestamptz NOT NULL
deleted_at          timestamptz NULL
```

---

# 16. Table: `guardian_students`

Hubungan wali ↔ santri.

## Columns

```text
id                  uuid PK
institution_id      uuid FK
guardian_id         uuid FK guardian_profiles
student_id          uuid FK student_profiles
relationship_type   text NULL
is_primary          boolean DEFAULT false
can_view_progress   boolean DEFAULT true
can_receive_updates boolean DEFAULT true
created_at          timestamptz NOT NULL
created_by          uuid NULL
deleted_at          timestamptz NULL
```

## Example relationship

```text
FATHER
MOTHER
GUARDIAN
OTHER
```

Satu santri boleh punya beberapa wali.

---

# 16A. Table: `program_types`

Reference table untuk menentukan pengalaman/logic utama program.

## Seed minimum

```text
TAHFIZ
QURAN_READING
CUSTOM
```

## Columns

```text
id                  uuid PK
code                text UNIQUE NOT NULL
name                text NOT NULL
description         text NULL
is_active           boolean DEFAULT true
created_at          timestamptz NOT NULL
```

`program_type` bukan role user. Satu ustaz dapat mengajar beberapa program berbeda dan Flutter menyesuaikan UI berdasarkan program yang sedang dibuka.

---

# 17. Table: `programs`

Program pembelajaran/tahfiz dalam lembaga.

Contoh:

```text
Tahfiz Reguler
Tahfiz Intensif
Tahsin
Kelas Syahadah
Iqra Dasar
Kelas Baca Al-Qur'an
```

## Columns

```text
id                       uuid PK
institution_id           uuid FK
name                     text NOT NULL
description              text NULL
program_type_id          uuid FK program_types NOT NULL
method_config_id         uuid FK method_configs NULL
reading_method_config_id uuid FK reading_method_configs NULL
default_mushaf_id        uuid NULL
is_active           boolean DEFAULT true
created_at          timestamptz NOT NULL
created_by          uuid NULL
updated_at          timestamptz NOT NULL
updated_by          uuid NULL
deleted_at          timestamptz NULL
```

---

# 18. Table: `groups`

Mewakili kelas/halaqah.

Catatan: untuk lembaga yang cukup satu kelompok, tetap gunakan satu row group agar arsitektur konsisten.

## Columns

```text
id                  uuid PK
institution_id      uuid FK
program_id          uuid FK
name                text NOT NULL
code                text NULL
description         text NULL
is_active           boolean DEFAULT true
created_at          timestamptz NOT NULL
created_by          uuid NULL
updated_at          timestamptz NOT NULL
deleted_at          timestamptz NULL
```

---

# 19. Table: `teacher_assignments`

Menghubungkan ustaz ke program/group.

## Columns

```text
id                  uuid PK
institution_id      uuid FK
teacher_id          uuid FK teacher_profiles
program_id          uuid FK programs
group_id            uuid FK groups NULL
assignment_role     text DEFAULT 'TEACHER'
start_date          date NULL
end_date            date NULL
is_active           boolean DEFAULT true
created_at          timestamptz NOT NULL
created_by          uuid NULL
deleted_at          timestamptz NULL
```

---

# 20. Enrollment & Class Membership Model

NgajiTrack membedakan tiga level hubungan:

```text
Institution Enrollment
→ Program Enrollment
→ Group/Halaqah Membership
```

Ini menjaga histori saat santri tamat, pindah, masuk program lain, atau berpindah kelas.

## 20.1 Table: `institution_enrollments`

```text
id                      uuid PK
institution_id          uuid FK
student_id              uuid FK student_profiles
status                  text NOT NULL
started_at              date NULL
ended_at                date NULL
completion_reason       text NULL
source_type             text NULL
previous_institution_id uuid NULL
created_at              timestamptz NOT NULL
created_by              uuid NULL
updated_at              timestamptz NOT NULL
deleted_at              timestamptz NULL
```

Status:

```text
PENDING
ACTIVE
COMPLETED
GRADUATED
TRANSFERRED
WITHDRAWN
ARCHIVED
```

Enrollment lama tidak di-overwrite ketika santri masuk lembaga baru.

## 20.2 Table: `program_enrollments`

```text
id                        uuid PK
institution_id            uuid FK
institution_enrollment_id uuid FK institution_enrollments
program_id                uuid FK
student_id                uuid FK student_profiles
status                    text NOT NULL
enrolled_at               date NULL
completed_at              date NULL
method_config_id          uuid NULL
mushaf_id                 uuid NULL
created_at                timestamptz NOT NULL
created_by                uuid NULL
updated_at                timestamptz NOT NULL
deleted_at                timestamptz NULL
```

## 20.3 Table: `group_memberships`

Histori penempatan santri ke kelas/halaqah.

```text
id                      uuid PK
institution_id          uuid FK
program_enrollment_id   uuid FK
student_id              uuid FK student_profiles
group_id                uuid FK groups
status                  text NOT NULL
started_at              timestamptz NOT NULL
ended_at                timestamptz NULL
assigned_by             uuid NULL
approved_by             uuid NULL
created_at              timestamptz NOT NULL
updated_at              timestamptz NOT NULL
deleted_at              timestamptz NULL
```

Perubahan struktur resmi kelas dilakukan oleh Admin Lembaga atau role yang diberi permission setara. Perpindahan menutup membership lama dan membuat membership baru, bukan overwrite histori.

---

# 20A. Quran Reading / Iqra-Style Data Model

Program `QURAN_READING` memakai model progres level/jilid + halaman yang configurable.

NgajiTrack tidak menyimpan isi buku, scan halaman, ilustrasi, atau kurikulum proprietary metode pihak ketiga. Yang disimpan hanya konfigurasi administratif yang diperlukan lembaga untuk tracking.

## Table: `reading_method_configs`

```text
id                  uuid PK
institution_id      uuid FK
method_label        text NOT NULL
name                text NOT NULL
version             integer DEFAULT 1
status              text NOT NULL
is_default          boolean DEFAULT false
metadata            jsonb DEFAULT '{}'
created_at          timestamptz NOT NULL
created_by          uuid NULL
updated_at          timestamptz NOT NULL
updated_by          uuid NULL
deleted_at          timestamptz NULL
```

Contoh `method_label`:

```text
IQRA
UMMI
QIROATI
TILAWATI
YANBUA
CUSTOM
```

Nama tersebut hanya label metode yang digunakan lembaga, bukan klaim integrasi/afiliasi resmi.

## Table: `reading_method_levels`

```text
id                       uuid PK
institution_id           uuid FK
reading_method_config_id uuid FK
level_code               text NOT NULL
display_name             text NOT NULL
position                 integer NOT NULL
page_start               integer DEFAULT 1
page_end                 integer NOT NULL
settings                 jsonb DEFAULT '{}'
is_active                boolean DEFAULT true
created_at               timestamptz NOT NULL
updated_at               timestamptz NOT NULL
deleted_at               timestamptz NULL
```

Recommended unique:

```text
UNIQUE(reading_method_config_id, level_code)
WHERE deleted_at IS NULL
```

`page_end` tidak boleh diasumsikan sama untuk semua metode/edisi. Admin Lembaga mengisi struktur sesuai buku yang benar-benar digunakan.

Progress Quran Reading **tidak membuat source-of-truth baru**. Current state tetap memakai `progress_states`, dengan `state_type = READING_LEVEL_PAGE`.

---

# 21. Quran Core Overview

NgajiTrack tidak boleh menyimpan posisi Al-Qur'an hanya sebagai text bebas. Quran Core pada MVP adalah **reference/mapping layer untuk tracking**, bukan built-in Mushaf reader.

Struktur:

```text
quran_mushafs
quran_juz
quran_pages
quran_surahs
quran_ayahs
quran_page_ayah_ranges
```

---

# 22. Table: `quran_mushafs`

## Columns

```text
id                  uuid PK
code                text UNIQUE NOT NULL
name                text NOT NULL
publisher           text NULL
edition             text NULL
total_pages         integer NULL
pages_per_juz_rule  text NULL
is_system_default   boolean DEFAULT false
is_active           boolean DEFAULT true
metadata            jsonb DEFAULT '{}'
created_at          timestamptz NOT NULL
```

Jangan hard-code bahwa semua mushaf = 20 halaman/juz.

---

# 23. Table: `quran_juz`

## Columns

```text
id                  uuid PK
mushaf_id           uuid FK quran_mushafs
juz_number          integer NOT NULL
page_start          integer NULL
page_end            integer NULL
page_count          integer NULL
created_at          timestamptz NOT NULL
```

## Constraint

```text
juz_number BETWEEN 1 AND 30
```

---

# 24. Table: `quran_pages`

## Columns

```text
id                  uuid PK
mushaf_id           uuid FK
global_page_number  integer NOT NULL
juz_number          integer NULL
page_in_juz         integer NULL
sheet_in_juz        numeric(5,2) NULL
created_at          timestamptz NOT NULL
```

## Notes

`sheet_in_juz` opsional.

Jika lembaga menggunakan:

```text
1 lembar = 2 halaman
```

mapping dapat dihitung/configured.

---

# 25. Table: `quran_surahs`

Reference global.

## Columns

```text
id                  uuid PK
surah_number        integer UNIQUE NOT NULL
arabic_name         text NULL
latin_name          text NOT NULL
ayah_count          integer NOT NULL
```

---

# 26. Table: `quran_ayahs`

## Columns

```text
id                  uuid PK
surah_id            uuid FK
ayah_number         integer NOT NULL
juz_number          integer NULL
```

Isi teks Al-Qur'an tidak wajib untuk MVP tracking dan **tidak dimasukkan hanya demi membuat reader**. Built-in Mushaf reader ditunda sampai sumber resmi, lisensi/tashih, dan kebutuhan produknya jelas.

---

# 27. Table: `quran_page_ayah_ranges`

Mapping page ↔ ayah.

## Columns

```text
id                  uuid PK
mushaf_id           uuid FK
page_id             uuid FK
surah_id            uuid FK
ayah_start          integer NOT NULL
ayah_end            integer NOT NULL
sequence_order      integer NOT NULL
```

Berguna saat lembaga ingin melihat page sekaligus ayah.

---

# 28. Table: `method_presets`

Preset global NgajiTrack.

## Example rows

```text
NGAJITRACK_STANDARD
DAARUT_REFERENCE
SULAIMANIYAH_REFERENCE
```

## Columns

```text
id                  uuid PK
code                text UNIQUE NOT NULL
name                text NOT NULL
description         text NULL
version             integer DEFAULT 1
is_system           boolean DEFAULT true
is_active           boolean DEFAULT true
created_at          timestamptz NOT NULL
updated_at          timestamptz NOT NULL
```

---

# 29. Table: `method_preset_stages`

Tahap bawaan sebuah preset.

## Columns

```text
id                  uuid PK
preset_id           uuid FK method_presets
stage_type          text NOT NULL
default_name        text NOT NULL
position            integer NOT NULL
default_unit        text NOT NULL
is_optional         boolean DEFAULT false
default_rules       jsonb DEFAULT '{}'
created_at          timestamptz NOT NULL
```

## Example stage_type

```text
NEW_MEMORIZATION
RECENT_REVIEW
LONG_TERM_REVIEW
EXAM
FINAL_PREPARATION
COMPLETION
CYCLE
```

---

# 30. Table: `method_configs`

Konfigurasi metode milik lembaga.

## Columns

```text
id                  uuid PK
institution_id      uuid FK
preset_id           uuid FK method_presets NULL
program_type_id     uuid FK program_types NOT NULL
name                text NOT NULL
description         text NULL
version             integer DEFAULT 1
status              text NOT NULL
is_default          boolean DEFAULT false
created_at          timestamptz NOT NULL
created_by          uuid NULL
updated_at          timestamptz NOT NULL
updated_by          uuid NULL
deleted_at          timestamptz NULL
```

Saat lembaga memilih preset, buat config milik lembaga.

Jangan mengubah preset global.

---

# 31. Table: `method_stages`

Stage hasil konfigurasi lembaga.

## Columns

```text
id                  uuid PK
institution_id      uuid FK
method_config_id    uuid FK
stage_type          text NOT NULL
display_name        text NOT NULL
position            integer NOT NULL
progress_unit       text NOT NULL
is_enabled          boolean DEFAULT true
is_required         boolean DEFAULT false
visibility          jsonb DEFAULT '{}'
settings            jsonb DEFAULT '{}'
created_at          timestamptz NOT NULL
created_by          uuid NULL
updated_at          timestamptz NOT NULL
updated_by          uuid NULL
deleted_at          timestamptz NULL
```

`display_name` dapat diganti lembaga.

---

# 32. Table: `method_rules`

Rule declarative.

## Columns

```text
id                  uuid PK
institution_id      uuid FK
method_config_id    uuid FK
stage_id            uuid FK method_stages NULL
rule_type           text NOT NULL
config              jsonb NOT NULL
priority            integer DEFAULT 100
is_active           boolean DEFAULT true
created_at          timestamptz NOT NULL
created_by          uuid NULL
updated_at          timestamptz NOT NULL
deleted_at          timestamptz NULL
```

## Example

Recent review:

```json
{
  "window": 10,
  "unit": "SHEET",
  "direction": "BACKWARD",
  "cross_juz": true
}
```

Manzil:

```json
{
  "rotation": "SEQUENTIAL",
  "default_daily_quantity": 1,
  "unit": "JUZ"
}
```

Sulaimaniyah:

```json
{
  "cycle_direction": "DESC_PAGE",
  "juz_order": "ASC",
  "start_page_in_juz": 20
}
```

---

# 33. Progress Unit Enum

Recommended values:

```text
AYAH
HALF_PAGE
PAGE
SHEET
HALF_JUZ
JUZ
MULTI_JUZ
CYCLE
CUSTOM
```

Untuk PostgreSQL, boleh gunakan:

- text + CHECK constraint; atau
- lookup table.

Untuk MVP, text + validation sering lebih fleksibel.

---

# 34. Table: `grading_schemes`

Skema nilai lembaga/program.

## Columns

```text
id                  uuid PK
institution_id      uuid FK
name                text NOT NULL
scheme_type         text NOT NULL
is_default          boolean DEFAULT false
config              jsonb NOT NULL
created_at          timestamptz NOT NULL
updated_at          timestamptz NOT NULL
deleted_at          timestamptz NULL
```

## Example config

```json
{
  "options": [
    {"code":"LANCAR","label":"Lancar"},
    {"code":"CUKUP","label":"Cukup"},
    {"code":"ULANG","label":"Ulang"}
  ]
}
```

---

# 35. Table: `assessment_categories`

Optional categories.

## Columns

```text
id                  uuid PK
institution_id      uuid FK
name                text NOT NULL
code                text NOT NULL
position            integer NOT NULL
is_active           boolean DEFAULT true
created_at          timestamptz NOT NULL
deleted_at          timestamptz NULL
```

Examples:

```text
FLUENCY
TAJWID
FASAHAH
MAKHRAJ
LENGTH_SHORTNESS
LETTER_CONFUSION
```

---

# 36. Table: `quick_notes`

Quick notes memiliki scope.

## Columns

```text
id                  uuid PK
institution_id      uuid FK NULL
teacher_id          uuid FK teacher_profiles NULL
scope               text NOT NULL
label               text NOT NULL
code                text NULL
category            text NULL
position            integer DEFAULT 100
is_active           boolean DEFAULT true
created_at          timestamptz NOT NULL
updated_at          timestamptz NOT NULL
deleted_at          timestamptz NULL
```

## Scope

```text
GLOBAL
INSTITUTION
TEACHER
```

---

# 37. Table: `learning_sessions`

## Columns

```text
id                  uuid PK
institution_id      uuid FK
program_id          uuid FK
group_id            uuid FK NULL
teacher_id          uuid FK
status              text NOT NULL
started_at          timestamptz NOT NULL
ended_at            timestamptz NULL
teaching_mode_used  boolean DEFAULT false
metadata            jsonb DEFAULT '{}'
created_at          timestamptz NOT NULL
updated_at          timestamptz NOT NULL
```

## Status

```text
ACTIVE
COMPLETED
CANCELLED
```

---

# 38. Table: `submissions`

Record utama setoran/murajaah.

## Columns

```text
id                       uuid PK
institution_id           uuid FK
student_id               uuid FK
teacher_id               uuid FK
program_id               uuid FK
group_id                 uuid FK NULL
method_config_id         uuid FK NULL
reading_method_config_id uuid FK NULL
stage_id                 uuid FK NULL
session_id               uuid FK NULL

submission_type          text NOT NULL
progress_unit            text NOT NULL
activity_source          text DEFAULT 'TEACHER'

quantity                numeric(10,2) NULL

start_position          jsonb NOT NULL
end_position            jsonb NOT NULL

result_code             text NULL
status                  text NOT NULL

occurred_at             timestamptz NOT NULL

client_request_id       text NULL
base_progress_version   integer NULL
version                 integer DEFAULT 1

created_at              timestamptz NOT NULL
created_by              uuid NULL
updated_at              timestamptz NOT NULL
updated_by              uuid NULL
deleted_at              timestamptz NULL
deleted_by              uuid NULL
```

## Status

```text
DRAFT
COMPLETED
CORRECTED
VOID
```

MVP normalnya menyimpan permanent record setelah confirm.

Contoh `submission_type`:

```text
NEW_MEMORIZATION
REVIEW
EXAM_PRACTICE
READING_PROGRESS
READING_REPEAT
```

Untuk `QURAN_READING`, `stage_id` dapat `NULL`, sedangkan `reading_method_config_id` wajib terisi. Untuk `TAHFIZ`, `method_config_id` dan stage yang relevan digunakan sesuai rule program.

---

# 39. Position JSON Schema — Page-Based

Contoh:

```json
{
  "type": "PAGE",
  "mushaf_id": "uuid",
  "juz": 7,
  "page_in_juz": 9,
  "global_page": 129
}
```

---

# 40. Position JSON Schema — Ayah-Based

```json
{
  "type": "AYAH",
  "surah": 2,
  "ayah_start": 1,
  "ayah_end": 10,
  "juz": 1
}
```

---

# 41. Position JSON Schema — Juz-Based

```json
{
  "type": "JUZ",
  "juz_start": 5,
  "juz_end": 6
}
```

---

# 42. Position JSON Schema — Sulaimaniyah

```json
{
  "type": "CYCLE_PAGE",
  "cycle": 4,
  "page_in_juz": 17,
  "juz": 12
}
```

Position schema harus divalidasi di service layer.

---

# 42A. Position JSON Schema — Quran Reading

Contoh:

```json
{
  "type": "READING_PAGE",
  "reading_method_config_id": "uuid",
  "level_id": "uuid",
  "level_code": "IQRA_3",
  "page": 18
}
```

Contoh input `+2` lalu `+2`:

```text
start_position.page = 18
quantity = 4
end_position.page = 21
next_position.page = 22
```

Server harus memvalidasi boundary terhadap `reading_method_levels.page_start/page_end`.

Jika status `ULANG`, current page tidak otomatis maju.

---

# 43. Table: `submission_segments`

Dipakai jika satu submission mencakup beberapa segment.

Contoh:

- range lintas juz;
- multi-part review;
- future mixed range.

## Columns

```text
id                  uuid PK
institution_id      uuid FK
submission_id       uuid FK
sequence_order      integer NOT NULL
segment_type        text NOT NULL
start_position      jsonb NOT NULL
end_position        jsonb NOT NULL
quantity            numeric(10,2) NULL
created_at          timestamptz NOT NULL
```

MVP dapat tidak selalu memakai table ini untuk submission sederhana.

---

# 44. Table: `assessments`

## Columns

```text
id                  uuid PK
institution_id      uuid FK
submission_id       uuid FK
grading_scheme_id   uuid FK NULL
overall_result      text NULL
score_numeric       numeric(8,2) NULL
created_at          timestamptz NOT NULL
created_by          uuid NULL
updated_at          timestamptz NOT NULL
deleted_at          timestamptz NULL
```

---

# 45. Table: `assessment_items`

Jika lembaga menggunakan beberapa kategori.

## Columns

```text
id                  uuid PK
institution_id      uuid FK
assessment_id       uuid FK
category_id         uuid FK
result_code         text NULL
score_numeric       numeric(8,2) NULL
note                text NULL
created_at          timestamptz NOT NULL
```

---

# 46. Table: `notes`

Catatan bebas terkait aktivitas.

## Columns

```text
id                  uuid PK
institution_id      uuid FK
student_id          uuid FK
submission_id       uuid FK NULL
teacher_id          uuid FK NULL
note_type           text NOT NULL
content             text NOT NULL
visibility          text NOT NULL
created_at          timestamptz NOT NULL
created_by          uuid NULL
updated_at          timestamptz NOT NULL
deleted_at          timestamptz NULL
```

## Visibility

```text
TEACHER_ONLY
INSTITUTION
STUDENT
GUARDIAN
STUDENT_AND_GUARDIAN
```

---

# 47. Table: `submission_quick_notes`

Many-to-many antara submission dan quick note.

## Columns

```text
submission_id       uuid FK
quick_note_id       uuid FK
created_at          timestamptz NOT NULL
```

Composite PK:

```text
(submission_id, quick_note_id)
```

---

# 48. Table: `progress_states`

Current state santri.

## Columns

```text
id                       uuid PK
institution_id           uuid FK
student_id               uuid FK
program_id               uuid FK
method_config_id         uuid FK NULL
reading_method_config_id uuid FK NULL
stage_id                 uuid FK NULL
state_key                text NOT NULL

state_type               text NOT NULL
state_data               jsonb NOT NULL

version                  integer DEFAULT 1

last_submission_id  uuid NULL
last_activity_at    timestamptz NULL

created_at          timestamptz NOT NULL
updated_at          timestamptz NOT NULL
```

## Unique

```text
UNIQUE(student_id, program_id, state_key)
```

Contoh `state_key`:

```text
TAHFIZ_STAGE:<stage_uuid>
READING_CURRENT
```

Dengan ini Quran Reading tidak bergantung pada `NULL` semantics di unique constraint.

---

# 49. Example `progress_states` — NgajiTrack Standard

```json
{
  "type": "PAGE_PROGRESS",
  "juz": 8,
  "page_in_juz": 14,
  "completed_juz": [1,2,3,4,5,6,7]
}
```

---

# 50. Example `progress_states` — Manzil

```json
{
  "type": "ROTATION",
  "daily_target": 2,
  "unit": "JUZ",
  "next_juz": 5,
  "last_completed_juz": 4
}
```

---

# 51. Example `progress_states` — Sulaimaniyah

```json
{
  "type": "CYCLE",
  "cycle": 4,
  "page_in_juz": 17,
  "current_juz": 12,
  "completed_juz_in_cycle": [1,2,3,4,5,6,7,8,9,10,11]
}
```

---

# 51A. Example `progress_states` — Quran Reading

```json
{
  "type": "READING_LEVEL_PAGE",
  "reading_method_config_id": "uuid",
  "level_id": "uuid",
  "level_code": "IQRA_3",
  "current_page": 22,
  "last_completed_page": 21,
  "last_result": "LANCAR"
}
```

`reading_method_levels` menjadi acuan boundary dan urutan level berikutnya.

---

# 52. Table: `student_stage_settings`

Override target per santri.

Berguna untuk Manzil 1, 1.5, 2, 3 juz/hari.

## Columns

```text
id                  uuid PK
institution_id      uuid FK
student_id          uuid FK
program_id          uuid FK
stage_id            uuid FK
settings            jsonb NOT NULL
effective_from      date NULL
effective_to        date NULL
created_at          timestamptz NOT NULL
created_by          uuid NULL
updated_at          timestamptz NOT NULL
deleted_at          timestamptz NULL
```

## Example

```json
{
  "daily_target": 2,
  "unit": "JUZ"
}
```

---

# 53. Table: `exams`

Definition ujian.

## Columns

```text
id                  uuid PK
institution_id      uuid FK
program_id          uuid FK
method_config_id    uuid FK
stage_id            uuid FK
name                text NOT NULL
exam_type           text NOT NULL
rule_config         jsonb NOT NULL
is_active           boolean DEFAULT true
created_at          timestamptz NOT NULL
created_by          uuid NULL
updated_at          timestamptz NOT NULL
deleted_at          timestamptz NULL
```

## Example type

```text
ONE_JUZ
FIVE_JUZ
MULTI_JUZ
FINAL
CUSTOM
```

---

# 54. Table: `exam_attempts`

## Columns

```text
id                  uuid PK
institution_id      uuid FK
exam_id             uuid FK
student_id          uuid FK
examiner_teacher_id uuid FK NULL
started_at          timestamptz NULL
completed_at        timestamptz NULL
status              text NOT NULL
range_data          jsonb NOT NULL
created_at          timestamptz NOT NULL
created_by          uuid NULL
updated_at          timestamptz NOT NULL
deleted_at          timestamptz NULL
```

---

# 55. Table: `exam_results`

## Columns

```text
id                  uuid PK
institution_id      uuid FK
exam_attempt_id     uuid FK
result_code         text NOT NULL
score_numeric       numeric(8,2) NULL
mistake_count       integer NULL
notes               text NULL
created_at          timestamptz NOT NULL
created_by          uuid NULL
updated_at          timestamptz NOT NULL
```

---

# 56. Syahadah / Final Stage

MVP tidak membutuhkan tabel sertifikat khusus.

Gunakan:

- `method_stages`
- `exam_attempts`
- `exam_results`
- `progress_states`

Jika future certificate diperlukan, tambahkan:

```text
certificates
```

tanpa mengubah core progress model.

---

# 57. Sabaq / Hafalan Baru Mapping

Jangan buat tabel bernama `sabaq`.

Gunakan:

```text
submissions
stage_type = NEW_MEMORIZATION
```

Ini menjaga sistem tetap generic.

---

# 58. Sabqi / Penguatan Mapping

Gunakan:

```text
stage_type = RECENT_REVIEW
method_rules.rule_type = REVIEW_WINDOW
```

Rule contoh:

```json
{
  "window": 10,
  "unit": "SHEET",
  "direction": "BACKWARD"
}
```

---

# 59. Manzil / Murajaah Berkala Mapping

Gunakan:

```text
stage_type = LONG_TERM_REVIEW
student_stage_settings
progress_states
```

Target harian dapat per santri.

---

# 60. Mukammal / Ujian Mapping

Gunakan:

```text
stage_type = EXAM
exams
exam_attempts
exam_results
```

---

# 61. Pemantapan Akhir Mapping

Gunakan:

```text
stage_type = FINAL_PREPARATION
student_stage_settings
submissions
progress_states
```

Target progression dapat:

```text
1.5 → 2 → 3 → 5 → 10 → 15
```

tetapi tidak hard-code.

---

# 62. Sulaimaniyah Cycle Mapping

Tidak buat tabel khusus `sulaimaniyah`.

Gunakan:

```text
stage_type = CYCLE
method_rules
progress_states
submissions
```

Method preset mendefinisikan logic.

---

# 62A. NgajiTrack Score Foundation

NgajiTrack Score terutama digunakan untuk program Tahfiz yang memiliki data assessment terverifikasi.

Score **tidak menggantikan jumlah hafalan**. Jumlah hafalan tetap field/derived metric terpisah.

## Table: `score_formula_versions`

```text
id                  uuid PK
code                text NOT NULL
version             integer NOT NULL
name                text NOT NULL
weights             jsonb NOT NULL
calculation_rules   jsonb NOT NULL
status              text NOT NULL
effective_from      timestamptz NULL
created_at          timestamptz NOT NULL
```

Seed formula awal dapat merepresentasikan:

```json
{
  "quality": 0.35,
  "retention": 0.30,
  "consistency": 0.20,
  "speed": 0.15
}
```

Formula harus versioned. Jangan mengubah histori score dengan formula baru tanpa menyimpan versi yang digunakan.

## Table: `program_score_settings`

```text
id                  uuid PK
institution_id      uuid FK
program_id          uuid FK
formula_version_id  uuid FK score_formula_versions
is_enabled          boolean DEFAULT false
speed_target_config jsonb DEFAULT '{}'
visibility          jsonb DEFAULT '{}'
created_at          timestamptz NOT NULL
updated_at          timestamptz NOT NULL
```

Kecepatan dibandingkan dengan target program/lembaga yang relevan, bukan ranking kecepatan global.

## Table: `ngajitrack_score_snapshots`

```text
id                  uuid PK
institution_id      uuid FK
student_id          uuid FK
program_id          uuid FK
formula_version_id  uuid FK
total_score         numeric(8,2) NOT NULL
components          jsonb NOT NULL
window_start        date NULL
window_end          date NULL
calculated_at       timestamptz NOT NULL
source_version      integer DEFAULT 1
created_at          timestamptz NOT NULL
```

Contoh `components`:

```json
{
  "quality": 94,
  "retention": 92,
  "consistency": 90,
  "speed": 95
}
```

`total_score` default berada pada skala 0–10000. Backend harus dapat menjelaskan komponen yang menghasilkan score.

---

# 62B. Calendar / Schedule Foundation

## Table: `calendar_events`

Digunakan untuk jadwal setoran, murajaah, ujian, target, atau kegiatan lembaga yang relevan kepada santri.

```text
id                  uuid PK
institution_id      uuid FK
program_id          uuid FK NULL
group_id            uuid FK NULL
student_id          uuid FK NULL
event_type          text NOT NULL
title               text NOT NULL
description         text NULL
starts_at           timestamptz NOT NULL
ends_at             timestamptz NULL
source_type         text NULL
source_id           uuid NULL
visibility          jsonb DEFAULT '{}'
status              text NOT NULL
created_at          timestamptz NOT NULL
created_by          uuid NULL
updated_at          timestamptz NOT NULL
deleted_at          timestamptz NULL
```

Calendar event tidak boleh menjadi pengganti submission/exam. Jika event berasal dari exam/target, gunakan `source_type/source_id` agar tetap dapat ditelusuri.

---

# 62C. Poster Template & Asset Foundation

Poster progres dibuat **on-demand**. File final tidak disimpan permanen.

## Table: `poster_assets`

```text
id                  uuid PK
institution_id      uuid FK NULL
asset_scope         text NOT NULL
asset_type          text NOT NULL
name                text NOT NULL
storage_path        text NOT NULL
mime_type           text NOT NULL
license_source      text NULL
license_note        text NULL
metadata            jsonb DEFAULT '{}'
is_active           boolean DEFAULT true
created_at          timestamptz NOT NULL
created_by          uuid NULL
deleted_at          timestamptz NULL
```

`institution_id = NULL` berarti asset global NgajiTrack.

## Table: `institution_poster_templates`

```text
id                  uuid PK
institution_id      uuid FK
name                text NOT NULL
template_type       text NOT NULL
layout_config       jsonb NOT NULL
background_asset_id uuid FK poster_assets NULL
watermark_corner    text NOT NULL
version             integer DEFAULT 1
status              text NOT NULL
is_default          boolean DEFAULT false
created_at          timestamptz NOT NULL
created_by          uuid NULL
updated_at          timestamptz NOT NULL
updated_by          uuid NULL
deleted_at          timestamptz NULL
```

Allowed `watermark_corner`:

```text
BOTTOM_LEFT
BOTTOM_RIGHT
```

**Tidak ada field `watermark_enabled`.** Generator backend selalu menambahkan logo resmi NgajiTrack sebagai watermark kecil. Lembaga tidak dapat mematikannya melalui template config.

Dynamic placeholder yang boleh digunakan contoh:

```text
{{student_name}}
{{achievement}}
{{institution_name}}
{{date}}
{{class_name}}
```

Schema `layout_config` harus divalidasi. Jangan mengizinkan arbitrary executable code.

File hasil render:

```text
generate
→ stream/download ke client
→ dispose
```

Tidak ada `final_poster_path` permanen pada MVP.

---

# 63. Table: `audit_logs`

## Columns

```text
id                  uuid PK
institution_id      uuid NULL
actor_profile_id    uuid NULL
actor_role_code     text NULL
action              text NOT NULL
entity_type         text NOT NULL
entity_id           uuid NULL
old_value           jsonb NULL
new_value           jsonb NULL
request_id          text NULL
ip_hash             text NULL
user_agent_summary  text NULL
created_at          timestamptz NOT NULL
```

Audit log immutable untuk user biasa.

---

# 64. Audit Actions

Contoh:

```text
CREATE
UPDATE
DELETE
RESTORE
ASSIGN_ROLE
REMOVE_ROLE
CREATE_SUBMISSION
CORRECT_SUBMISSION
VOID_SUBMISSION
UPDATE_METHOD_CONFIG
RESET_PASSWORD_REQUESTED
DISABLE_ACCOUNT
VIEW_SENSITIVE_STUDENT_PROGRESS
VIEW_SENSITIVE_STUDENT_SCORE
GENERATE_PROGRESS_POSTER
```

---

# 65. Table: `notifications`

MVP optional tetapi schema boleh disiapkan.

## Columns

```text
id                  uuid PK
institution_id      uuid NULL
recipient_profile_id uuid NOT NULL
type                text NOT NULL
title               text NOT NULL
body                text NOT NULL
data                jsonb DEFAULT '{}'
status              text NOT NULL
read_at             timestamptz NULL
created_at          timestamptz NOT NULL
```

---

# 66. Table: `feature_flags`

## Columns

```text
id                  uuid PK
code                text UNIQUE NOT NULL
description         text NULL
is_enabled_global   boolean DEFAULT false
created_at          timestamptz NOT NULL
updated_at          timestamptz NOT NULL
```

Future institution override dapat ditambah.

---

# 67. Table: `institution_feature_flags`

## Columns

```text
id                  uuid PK
institution_id      uuid FK
feature_flag_id     uuid FK
is_enabled          boolean NOT NULL
created_at          timestamptz NOT NULL
updated_at          timestamptz NOT NULL
```

---

# 68. Student Identifiers

NgajiTrack membedakan tiga lapisan identitas.

### 68.1 NgajiTrack Global Student ID

```text
NGT-8F2K91
```

Disimpan di `student_identities.ngajitrack_student_id` dan tetap sama lintas lembaga.

### 68.2 ID/NIS Milik Lembaga

Disimpan di:

```text
student_profiles.institution_student_id
student_profiles.nis_local
```

Boleh berbeda di tiap lembaga.

### 68.3 NISN

Dapat menjadi salah satu sinyal matching bila tersedia, tetapi bukan pengganti NgajiTrack ID dan bukan satu-satunya kunci verifikasi.

---

# 69. Login Mapping

Login mengikuti identitas global, bukan record lembaga.

```text
auth.users
   ↓
profiles
   ↓
student_identities
   ↓
student_profiles per lembaga
```

Jika santri belum memiliki akun:

```text
student_identities.profile_id = NULL
```

Jika record lembaga belum ter-link:

```text
student_profiles.student_identity_id = NULL
```

Setelah verification berhasil, record lembaga dihubungkan ke identitas global existing.

---

# 70. Guardian Account Flow

Wali dapat dibuat sebelum login aktif.

Flow:

```text
Guardian record
  ↓
Guardian invitation
  ↓
Auth account
  ↓
profiles
  ↓
guardian_profiles
  ↓
guardian_students
```

---

# 71. Teacher Account Flow

Teacher wajib memiliki profile login untuk input.

```text
auth user
  ↓
profile
  ↓
institution member TEACHER
  ↓
teacher profile
  ↓
teacher assignment
```

---

# 72. Super Admin

Super Admin bukan bagian dari satu lembaga tertentu.

Dapat menggunakan:

```text
platform_roles
```

atau role khusus dengan `institution_id = NULL`.

Untuk MVP, rekomendasi:

- auth profile;
- platform role terpisah.

Jangan memaksa Super Admin menjadi member semua lembaga.

---

# 73. Table: `platform_roles`

## Columns

```text
id                  uuid PK
profile_id          uuid FK
role_code           text NOT NULL
is_active           boolean DEFAULT true
created_at          timestamptz NOT NULL
```

Example:

```text
SUPER_ADMIN
SUPPORT
```

MVP cukup SUPER_ADMIN.

---

# 74. Unique Constraints

Recommended:

```text
institutions.public_code UNIQUE
roles.code UNIQUE
quran_surahs.surah_number UNIQUE
method_presets.code UNIQUE
program_types.code UNIQUE
profiles.auth_user_id UNIQUE
```

Tenant-scoped examples:

```text
UNIQUE(ngajitrack_student_id) ON student_identities
UNIQUE(institution_id, institution_student_id) WHERE institution_student_id IS NOT NULL
UNIQUE(institution_id, teacher_public_id)
UNIQUE(institution_id, guardian_public_id)
UNIQUE(reading_method_config_id, level_code) WHERE deleted_at IS NULL
UNIQUE(code, version) ON score_formula_versions
```

---

# 75. Foreign Key Delete Strategy

Jangan cascade-delete data pendidikan.

Gunakan:

```text
ON DELETE RESTRICT
```

atau:

```text
ON DELETE SET NULL
```

untuk field tertentu.

Hindari:

```text
ON DELETE CASCADE
```

pada:

- students;
- submissions;
- assessments;
- exams;
- audit.

Cascade boleh digunakan untuk child teknis yang aman seperti purely derived config items jika sudah dipertimbangkan.

---

# 76. Index Strategy

Minimum indexes:

```text
institution_members(institution_id, profile_id)
student_profiles(institution_id)
teacher_profiles(institution_id)
guardian_profiles(institution_id)

programs(institution_id)
groups(institution_id, program_id)

teacher_assignments(teacher_id, group_id)
program_enrollments(student_id, program_id)

submissions(institution_id, student_id, occurred_at DESC)
submissions(teacher_id, occurred_at DESC)
submissions(stage_id, occurred_at DESC)

progress_states(student_id, program_id, state_key)
reading_method_levels(reading_method_config_id, position)
institution_enrollments(institution_id, status, student_id)
ngajitrack_score_snapshots(student_id, program_id, calculated_at DESC)
calendar_events(student_id, starts_at)
calendar_events(group_id, starts_at)
institution_poster_templates(institution_id, status)

audit_logs(institution_id, created_at DESC)
```

---

# 77. Partial Indexes

Untuk soft delete:

```sql
CREATE INDEX ...
ON student_profiles(institution_id)
WHERE deleted_at IS NULL;
```

Pertimbangkan untuk tabel besar.

---

# 78. JSONB Usage Rule

Gunakan JSONB hanya untuk:

- flexible config;
- position;
- state;
- metadata;
- rule definitions.

Jangan gunakan JSONB untuk data inti yang perlu relational query reguler.

Buruk:

```text
student_data jsonb
```

Bagus:

```text
student_id
institution_id
status
metadata jsonb
```

---

# 79. Immutable vs Mutable Data

## Relatif immutable

- submission history;
- audit logs;
- completed exam result history.

## Mutable

- profile;
- method config;
- group membership;
- progress state.

Correction history tetap diaudit.

---

# 80. Submission Correction Strategy

Jangan overwrite tanpa jejak.

Pilihan MVP:

1. update submission;
2. increment version;
3. tulis audit log;
4. recalculate progress_state jika perlu.

Future lebih strict:

- create correction event.

---

# 81. Version Column

Tables penting:

```text
progress_states.version
submissions.version
method_configs.version
reading_method_configs.version
institution_poster_templates.version
score_formula_versions.version
```

Digunakan untuk optimistic concurrency.

---

# 82. Idempotency

`submissions.client_request_id`

Recommended unique scoped:

```text
UNIQUE(institution_id, client_request_id)
WHERE client_request_id IS NOT NULL
```

Mencegah double save. Untuk operasi offline queued yang lebih luas, gunakan juga `client_operations`.

---

# 83. Offline Draft & Sync Queue

Draft ustaz tidak wajib dikirim ke server pada setiap tap. Sebelum konfirmasi, source-of-truth draft berada di penyimpanan lokal durable pada client.

Client minimal menyimpan:

```text
draft_id
student_id
session_id
stage_id
actions
assessment
quick_notes
base_progress_version
local_status
updated_at
```

Status lokal:

```text
DRAFT
READY_TO_SYNC
PENDING_SYNC
SYNCED
CONFLICT
FAILED_RETRYABLE
```

## 83.1 Table: `client_operations`

Server receipt untuk operasi queued/idempotent.

```text
id                      uuid PK
institution_id          uuid FK
profile_id              uuid FK
client_operation_id     text NOT NULL
operation_type          text NOT NULL
payload_hash            text NULL
status                  text NOT NULL
entity_type             text NULL
entity_id               uuid NULL
base_version            integer NULL
server_version          integer NULL
received_at             timestamptz NOT NULL
processed_at            timestamptz NULL
error_code              text NULL
created_at              timestamptz NOT NULL
```

Unique:

```text
UNIQUE(institution_id, client_operation_id)
```

Jika `base_progress_version` sudah stale dan operasi tidak aman untuk auto-merge, hasilnya harus `CONFLICT`, bukan silent overwrite.

---

# 84. Suggested RLS — Institutions

Super Admin:

- read/write via privileged server context;
- review progres/score lintas lembaga hanya melalui permission yang sesuai;
- review sensitif untuk keperluan operasional harus menulis audit action seperti `VIEW_SENSITIVE_STUDENT_PROGRESS` atau `VIEW_SENSITIVE_STUDENT_SCORE`.

Institution Admin:

- read own institution.

Teacher/Guardian/Student:

- read limited public institution info.

---

# 85. Suggested RLS — Students

Institution Admin:

```text
student.institution_id = own institution
```

Teacher:

```text
student belongs to assigned group/program
```

Guardian:

```text
guardian_students contains relationship
```

Student:

```text
student.profile_id = current profile
```

---

# 86. Suggested RLS — Submissions

Institution Admin:

- read all own institution.

Teacher:

- create for assigned students;
- read assigned students;
- edit only according to correction policy.

Guardian:

- read child only if visibility allows.

Student:

- read self only.

---

# 87. Suggested RLS — Audit Logs

Super Admin:

- access platform.

Institution Admin:

- read institution-scoped relevant audit.

Teacher:

- no broad audit access.

Guardian/Student:

- no access.

---

# 87A. Suggested RLS — Score, Calendar, Poster

## Score

- Institution Admin: read own institution;
- Teacher: read assigned students jika feature/visibility mengizinkan;
- Guardian: read linked child jika visibility mengizinkan;
- Student: read self jika visibility mengizinkan;
- Super Admin: privileged review dengan audit untuk akses sensitif.

## Calendar

- Institution Admin: manage own institution;
- Teacher: manage/read events sesuai assignment dan permission;
- Guardian/Student: read hanya event yang visible dan terkait dirinya/anaknya.

## Poster Templates / Assets

- Institution Admin: manage template milik lembaga;
- Teacher/Guardian/Student: read template yang published bila diperlukan untuk generate;
- global NgajiTrack assets tidak dapat dimodifikasi oleh tenant;
- watermark official tidak dapat dinonaktifkan lewat RLS/client payload.

---

# 88. Data Visibility by Note

`notes.visibility`

Backend harus memfilter.

Contoh:

```text
TEACHER_ONLY
```

tidak pernah dikirim ke wali/santri.

---

# 89. Institution Config Versioning

Method config perubahan besar dapat membuat versi baru.

Contoh:

```text
Method Config v1
effective until 2026-12-31

Method Config v2
effective from 2027-01-01
```

MVP dapat mulai sederhana, tetapi schema `version` harus ada.

Historical submission menyimpan `method_config_id`.

---

# 90. Why Historical Method ID Matters

Jika lembaga mengganti nama/rule:

Submission lama tetap harus dapat ditafsirkan berdasarkan config saat dibuat.

Jangan hanya query config terbaru.

---

# 91. Program Method Reference

`programs.method_config_id` digunakan sebagai default Tahfiz method config.

`programs.reading_method_config_id` digunakan sebagai default Quran Reading config.

Submission menyimpan referensi config yang benar sesuai program:

```text
Tahfiz:
method_config_id
stage_id

Quran Reading:
reading_method_config_id
stage_id = NULL (normal case)
```

untuk historical integrity.

---

# 92. Mushaf Version Integrity

Submission Tahfiz yang bergantung pada pagination mushaf menyimpan `mushaf_id` di position/reference yang relevan.

Jika lembaga ganti mushaf:

history lama tetap merujuk mushaf lama.

---

# 93. Import Data

Future import spreadsheet harus mengarah ke domain tables.

Jangan create generic imported JSON blob sebagai final storage.

Import flow:

```text
Upload
→ Validate
→ Preview
→ Resolve errors
→ Commit transaction
→ Audit
```

Bukan MVP wajib, tapi architecture harus memungkinkan.

---

# 94. Report Query Sources

Report membaca:

```text
student_profiles
program_enrollments
submissions
assessments
progress_states
method_stages
```

Report tidak bergantung pada frontend state.

---

# 95. Daily Progress Summary

Future materialized view dapat dibuat:

```text
daily_student_progress
```

MVP tidak perlu sampai query lambat terbukti.

---

# 96. Analytics Strategy

Jangan tambahkan analytics table terlalu dini.

Mulai dari normalized operational schema.

Jika scale:

- views;
- materialized views;
- analytics warehouse.

---

# 97. Data Retention

MVP policy awal:

- submission educational records tidak otomatis dihapus;
- graduated student menjadi read-only/archive;
- alumni yang tidak aktif tidak memerlukan proses realtime/background khusus;
- query operasional kelas aktif harus memfilter enrollment aktif agar histori alumni tidak ikut membebani flow mengajar;
- account logout tidak menghapus academic history;
- institution suspension tidak menghapus data.

Policy final harus masuk legal/privacy nanti.

---

# 98. Graduate / Transfer

Student status:

```text
ACTIVE
INACTIVE
GRADUATED
TRANSFERRED
ARCHIVED
```

History tetap tersimpan.

Jika pindah lembaga, jangan sekadar mengubah `institution_id` pada old records.

Future cross-institution portability harus dirancang sebagai transfer/copy/reference flow.

---

# 99. Read-Only Historical Data

Saat program selesai:

```text
program_enrollment.status = COMPLETED
```

History:

- tetap viewable;
- correction hanya role tertentu;
- correction selalu audit.

---

# 99A. Supabase Storage Scope

Untuk MVP, object storage dibatasi pada kebutuhan nyata:

```text
avatars/
institution-branding/
poster-assets/
```

Contoh penggunaan:

- foto profil jika fitur avatar digunakan;
- logo/foto identitas lembaga;
- background/template/ornament poster yang telah dikurasi.

Tidak ada bucket permanen untuk:

```text
generated-posters/
student-videos/
murajaah-videos/
activity-photo-evidence/
```

kecuali scope produk berubah secara eksplisit.

Poster final on-demand sebaiknya dirender ke memory/temp file singkat lalu dikirim ke client dan dibuang.

Storage policy harus membatasi write sesuai role dan `institution_id`/path convention.

---

# 100. Backup Data Scope

Backup minimum:

- PostgreSQL;
- storage metadata;
- avatar/profile image yang memang digunakan;
- logo/branding lembaga;
- poster template assets yang permanen.

Poster final on-demand tidak termasuk backup karena tidak disimpan permanen.

Auth backup mengikuti provider capability.

---

# 100A. Seed — Program Types

```text
TAHFIZ         "Tahfiz"
QURAN_READING  "Baca Al-Qur'an"
CUSTOM         "Custom"
```

Program type seed adalah reference global dan tidak diubah tenant.

---

# 101. Seed — NgajiTrack Standard

Seed preset:

```text
NGAJITRACK_STANDARD
```

Stages:

```text
1 NEW_MEMORIZATION   "Hafalan Baru"
2 RECENT_REVIEW      "Penguatan"
3 LONG_TERM_REVIEW   "Murajaah Berkala"
4 EXAM               "Ujian Tahfiz"
5 FINAL_PREPARATION  "Pemantapan Akhir"
6 COMPLETION         "Khatam / Final Tahfiz"
```

---

# 102. Seed — Daarut Reference

```text
DAARUT_REFERENCE
```

Display names:

```text
Sabaq
Sabqi
Manzil
Mukammal
Persiapan Syahadah
Syahadah
```

Internal stage types tetap generic.

---

# 103. Seed — Sulaimaniyah Reference

```text
SULAIMANIYAH_REFERENCE
```

Minimum:

```text
CYCLE
REVIEW
EXAM
COMPLETION
```

Nama final dapat disesuaikan setelah validasi detail lapangan.

---

# 104. Dummy Institution A

Untuk staging:

```text
Institution:
Daarut Demo

Method:
DAARUT_REFERENCE

Students:
30

Teachers:
2

Guardians:
sample linked accounts
```

---

# 105. Dummy Institution B

```text
Institution:
Sulaimaniyah Demo

Method:
SULAIMANIYAH_REFERENCE

Students:
30

Teachers:
2
```

---

# 105A. Dummy Institution C — Quran Reading

```text
Institution:
TPQ Reading Demo

Program Type:
QURAN_READING

Method:
IQRA (demo config)

Levels:
Iqra 1–6 dengan jumlah halaman fixture yang configurable

Students:
20

Teachers:
2
```

Fixture wajib mencakup:

- `+1`;
- `+2`;
- akumulasi `+2 +2`;
- `ULANG`;
- boundary antar level;
- issue tag seperti makhraj/kelancaran;
- satu edisi/config dengan jumlah halaman berbeda untuk memastikan tidak ada hard-code.

---

# 106. Data Generation for QA

Buat fixture:

- 1 bulan submission;
- multiple stages;
- assessment mix;
- missing days;
- corrections;
- completed juz;
- cycle transition;
- exam results;
- Quran Reading page progress;
- repeat/no-advance case;
- level boundary;
- score snapshot;
- calendar event;
- poster template config.

Tujuan: menguji sistem lebih nyata.

---

# 107. Migration Order

Recommended:

```text
001 extensions
002 profiles
003 institutions
004 roles_memberships
005 people
006 program_types
007 programs_groups
008 relationships
009 quran_reference_core
010 reading_method_configs
011 method_presets
012 method_configs
013 grading_quick_notes
014 sessions
015 submissions
016 assessments_notes
017 progress_states
018 exams
019 score_foundation
020 calendar_events
021 poster_assets_templates
022 onboarding_linking
023 offline_client_operations
024 audit
025 notifications_flags
026 rls
027 indexes
028 seed_program_types
029 seed_presets
```

Nomor final dapat berbeda, tetapi dependency order harus dijaga.

---

# 108. Trigger Strategy

Gunakan trigger secara hati-hati.

Cocok untuk:

- `updated_at`;
- audit metadata sederhana.

Jangan sembunyikan business logic kompleks di trigger jika service layer lebih jelas.

Tahfiz/Quran Reading progress calculation sebaiknya di service/domain logic, bukan trigger misterius.

---

# 109. Stored Procedure Strategy

Stored procedure dapat dipakai untuk:

- transaction-safe operations;
- high-value atomic commands.

Contoh future:

```text
record_submission()
```

Tetapi harus terdokumentasi dan diuji.

---

# 110. Service-Level Source of Truth

Untuk operasi seperti:

```text
recordSubmission
recordReadingProgress
correctSubmission
completeExam
calculateNgajiTrackScore
generateProgressPoster
```

service layer adalah orchestrator.

Database tetap punya constraints terakhir.

---

# 111. Data Constraints

Contoh minimum:

```text
juz_number between 1 and 30
quantity >= 0
position != null
institution_id != null
reading_method_levels.page_end >= page_start
ngajitrack_score_snapshots.total_score between 0 and 10000
institution_poster_templates.watermark_corner in (BOTTOM_LEFT, BOTTOM_RIGHT)
```

Page range Tahfiz harus divalidasi terhadap mushaf/reference mapping. Page range Quran Reading harus divalidasi terhadap `reading_method_levels`.

---

# 112. Half Page Precision

Gunakan numeric:

```text
numeric(10,2)
```

bukan floating point.

Contoh:

```text
0.50
1.00
1.50
2.00
```

---

# 113. Multi-Juz Quantity

Juga numeric.

Contoh Manzil:

```text
1.50 JUZ
2.00 JUZ
3.00 JUZ
```

---

# 114. Boundary Calculation

Do not trust client.

Client boleh preview.

Server recalculates:

```text
current_state
+ requested_quantity
+ program type
+ relevant method/read config
+ mushaf constraints (Tahfiz bila relevan)
+ level/page constraints (Quran Reading bila relevan)
```

baru commit.

---

# 115. Save & Next

Tidak membutuhkan field khusus database.

Flow:

```text
recordSubmission(student A)
success
↓
client loads student B
```

Learning session tetap sama.

---

# 116. Class Quick View

Semua input tetap menghasilkan row submission normal.

Jangan buat jalur data berbeda.

Quick View hanya UI optimization.

Untuk Quran Reading, contoh UI `+1`, `+2`, `ULANG`, `DETAIL` tetap berakhir pada `submissions` + `progress_states` yang sama, bukan tabel input terpisah.

---

# 117. Focus Teaching Mode

Tidak perlu menyimpan OS notification state di database.

Boleh menyimpan:

```text
learning_sessions.teaching_mode_used
```

untuk product analytics terbatas.

Jangan simpan daftar notifikasi pribadi user.

---

# 118. Future Home Supervisor

Belum MVP. Kolom `submissions.activity_source` sudah disiapkan agar fitur dapat ditambah tanpa migration besar.

Values future:

```text
TEACHER
GUARDIAN
STUDENT
SYSTEM
```

Untuk MVP, submission akademik utama tetap teacher-driven.

---

# 118A. Explicit Deferred Scope — Personal Mode & Built-in Mushaf

## Personal Mode

Tidak dibuat pada MVP saat ini.

Tidak perlu membuat tabel:

```text
personal_hifzh_logs
personal_memory_map
personal_streaks
personal_google_drive_backups
```

Arsitektur tetap modular agar mode ini dapat ditambahkan lewat versi aplikasi berikutnya.

## Built-in Mushaf Reader

Tidak dibuat pada MVP saat ini.

Quran reference tables tetap dipakai untuk tracking. Jangan menambah teks Qur'an penuh, audio, bookmark reader, reader history, atau reader preferences hanya karena tabel Quran Core sudah tersedia.

---

# 119. Future Billing Tables

Tidak dibuat di MVP.

Future:

```text
subscriptions
invoices
invoice_items
payments
payment_events
```

Jangan campur sekarang dengan academic core.

---

# 120. Future Mobile Device Tables

Jika push notification dibutuhkan:

```text
devices
push_tokens
```

Belum MVP wajib.

---

# 121. ERD — Core Identity

```text
profiles
   │
   ├──── institution_members ──── institutions
   │             │
   │             └──── roles
   │
   ├──── teacher_profiles
   ├──── guardian_profiles
   └──── student_profiles
```

---

# 122. ERD — People Relationships

```text
guardian_profiles
      │
      └──── guardian_students ──── student_profiles

teacher_profiles
      │
      └──── teacher_assignments ── groups

student_profiles
      │
      └──── program_enrollments ── programs
```

---

# 123. ERD — Method

```text
program_types
      │
      └──── programs
              │
              ├──── method_config_id ────── method_configs (TAHFIZ)
              │                               ├──── method_stages
              │                               └──── method_rules
              │
              └──── reading_method_config_id ─ reading_method_configs
                                                └──── reading_method_levels

method_presets
      │
      └──── method_preset_stages
```

---

# 124. ERD — Learning

```text
learning_sessions
        │
        └──── submissions
                 │
                 ├──── assessments
                 │        └──── assessment_items
                 │
                 ├──── notes
                 │
                 └──── submission_quick_notes

student_profiles
        │
        └──── progress_states
```

---

# 125. ERD — Quran

```text
quran_mushafs
      │
      ├──── quran_juz
      ├──── quran_pages
      │       └──── quran_page_ayah_ranges
      └────────────────────────────┐
                                   │
quran_surahs ───── quran_ayahs     │
      │                            │
      └──── quran_page_ayah_ranges┘
```

---

# 126. RLS Test Matrix

Test wajib:

| Role | Institution A Student | Institution B Student |
|---|---|---|
| Super Admin | Allowed | Allowed |
| Admin A | Allowed | Denied |
| Teacher A assigned | Allowed | Denied |
| Teacher A unassigned | Denied | Denied |
| Guardian linked | Allowed child only | Denied |
| Student | Self only | Denied |

Tambahkan test yang sama untuk `ngajitrack_score_snapshots`, `calendar_events`, `reading_method_configs`, dan template poster tenant-scoped.

---

# 127. Submission Access Matrix

| Role | Read | Create | Correct | Delete/Void |
|---|---|---|---|---|
| Super Admin | Controlled | No normal use | Controlled | Controlled |
| Admin Lembaga | Own institution | Optional | Allowed policy | Allowed policy |
| Teacher | Assigned students | Yes | Own/allowed | Usually no hard delete |
| Guardian | Child visible | No | No | No |
| Student | Self visible | No | No | No |

---

# 128. Data Integrity Invariants

Invariant yang tidak boleh dilanggar:

1. submission institution = student institution;
2. teacher must belong to same institution;
3. teacher must be assigned when required;
4. stage belongs to method config used;
5. method config belongs to institution;
6. program belongs to institution;
7. position valid for mushaf;
8. progress state version cannot silently overwrite newer version;
9. guardian link must share institution context;
10. deleted entities cannot menerima aktivitas baru.

---

# 129. Validation Example — Submission

Pseudo:

```text
assert student.active
assert teacher.active
assert sameInstitution
assert teacherAssigned
assert stage.enabled
assert positionValid
assert unitCompatible
assert boundaryValid
assert expectedProgressVersion
```

Then:

```text
BEGIN
insert submission
insert assessment
update progress state
insert audit
COMMIT
```

---

# 130. Progress Rebuild Capability

Sediakan service future:

```text
rebuildProgressState(student_id, program_id)
```

Reads:

```text
submissions ordered by occurred_at + created_at
```

Recomputes:

```text
progress_states
```

Digunakan untuk recovery/diagnostic.

---

# 131. Historical Ordering

Gunakan:

```text
occurred_at
created_at
id
```

untuk stable ordering.

Jika backdated entry diperbolehkan, rebuild mungkin diperlukan.

---

# 132. Backdated Submission

MVP policy:

- teacher boleh input tanggal hari ini;
- backdate terbatas untuk admin/permission tertentu;
- backdate yang memengaruhi state harus trigger recalculation.

Detail policy dapat diputuskan saat implementation.

---

# 133. Duplicate Detection

Selain idempotency key, optional heuristic:

```text
same student
same stage
same range
same date
same teacher
```

Tampilkan warning, jangan selalu block.

---

# 134. Student Progress Summary View

Boleh buat SQL view:

```text
student_progress_summary
```

Menggabungkan:

- student;
- program;
- stage states;
- last activity.

View tidak menjadi source-of-truth.

---

# 135. Guardian Dashboard Query

Query:

```text
guardian
→ linked students
→ active enrollments
→ visible progress states
→ latest visible submissions
→ visible notes
```

Tidak query seluruh institution.

---

# 136. Student Dashboard Query

Query:

```text
current profile
→ student profile
→ active + historical enrollments
→ current program type
→ program-aware progress states
→ recent submissions
→ NgajiTrack Score (if enabled)
→ visible calendar events
→ targets
```

---

# 137. Teacher Session Query

Query:

```text
teacher
→ active assignments
→ selected group
→ program type
→ relevant Tahfiz/Reading config
→ enrolled students
→ current progress state
→ program-aware quick-input defaults
```

Optimalkan agar satu sesi tidak melakukan N+1 query besar.

---

# 138. Admin Dashboard Query

Query:

```text
institution
→ students count
→ active groups
→ program distribution
→ recent activity
→ Tahfiz stage progress summary
→ Quran Reading level/page summary
→ score summary (if enabled)
→ exam status
```

Advanced analytics ditunda.

---

# 139. N+1 Prevention

Gunakan:

- joins;
- batch fetch;
- RPC/service queries.

Jangan request progress per santri satu-satu dari client.

---

# 140. Data Privacy

Hindari menyimpan:

- password;
- private chat tidak diperlukan;
- dokumen identitas jika tidak ada kebutuhan;
- data kesehatan;
- informasi sensitif lain yang tidak relevan.

Collect minimum needed.

---

# 141. Exportability

Future export harus memungkinkan:

- student history;
- institution records;
- progress report.

Karena schema relational, data harus tetap dapat diekspor tanpa tergantung UI.

---

# 142. Archive Strategy

Institution dapat:

```text
status = ARCHIVED
```

Data tetap ada.

Student:

```text
status = GRADUATED/ARCHIVED
```

Tidak perlu memindahkan row ke archive table pada MVP.

---

# 143. Scaling Notes

Sampai skala besar:

- partition `submissions` by date/institution jika perlu;
- read replica;
- analytics replica;
- object storage;
- queue jobs;
- active-enrollment indexes agar alumni/history tidak ikut terbaca pada query kelas harian.

Jangan implementasikan prematurely.

---

# 144. Partition Candidate

Jika submissions mencapai puluhan/jutaan besar:

Candidate:

```text
submissions
audit_logs
notifications
```

Tetapi tunggu profiling nyata.

---

# 145. Database Documentation Rule

Setiap migration penting harus update:

- `DATABASE.md`;
- ERD bila relasi berubah;
- `METHODS.md` bila behavior berubah.

---

# 146. Coding Agent Rules — Database

Astra harus:

1. tidak mengubah schema production manual;
2. selalu membuat migration;
3. tidak drop column/table tanpa approval;
4. tidak rename field besar tanpa migration plan;
5. tidak menyimpan password;
6. tidak menghapus tenant filter;
7. tidak membuat generic JSON blob sebagai shortcut;
8. tidak hard-code lembaga;
9. tidak hard-code Daarut/Sulaimaniyah ke table khusus;
10. menambahkan test untuk constraints/security;
11. menjalankan staging migration sebelum production;
12. menjaga rollback/recovery plan.

---

# 147. Migration Safety

Untuk breaking change:

1. add new column;
2. backfill;
3. dual-read/write jika perlu;
4. validate;
5. switch;
6. drop old only setelah aman.

Jangan langsung destructive migration.

---

# 147A. Bulk Import / Onboarding Tables

Bulk onboarding adalah requirement MVP untuk lembaga besar.

## Table: `import_jobs`

```text
id                      uuid PK
institution_id          uuid FK
created_by              uuid FK profiles
import_type             text NOT NULL
source_file_path        text NULL
status                  text NOT NULL
total_rows              integer DEFAULT 0
valid_rows              integer DEFAULT 0
invalid_rows            integer DEFAULT 0
matched_rows            integer DEFAULT 0
verification_rows       integer DEFAULT 0
new_identity_rows       integer DEFAULT 0
started_at              timestamptz NULL
completed_at            timestamptz NULL
created_at              timestamptz NOT NULL
updated_at              timestamptz NOT NULL
```

Status:

```text
UPLOADED
VALIDATING
READY_FOR_REVIEW
PROCESSING
COMPLETED
PARTIAL
FAILED
CANCELLED
```

## Table: `import_rows`

```text
id                      uuid PK
import_job_id           uuid FK
institution_id          uuid FK
row_number              integer NOT NULL
raw_data                jsonb NOT NULL
normalized_data         jsonb NULL
validation_status       text NOT NULL
match_status            text NULL
candidate_identity_id   uuid NULL
error_codes             jsonb DEFAULT '[]'
result_student_id       uuid NULL
created_at              timestamptz NOT NULL
updated_at              timestamptz NOT NULL
```

Import harus memiliki preview/validation sebelum commit massal.

---

# 147B. Existing Account Linking

## Table: `student_link_requests`

```text
id                      uuid PK
institution_id          uuid FK
student_id              uuid FK student_profiles
candidate_identity_id   uuid FK student_identities
status                  text NOT NULL
match_reason            jsonb NULL
requested_by            uuid FK profiles
verification_method     text NULL
verified_by             uuid NULL
requested_at            timestamptz NOT NULL
verified_at             timestamptz NULL
expires_at              timestamptz NULL
created_at              timestamptz NOT NULL
updated_at              timestamptz NOT NULL
```

Status:

```text
PENDING
NEEDS_VERIFICATION
APPROVED
REJECTED
EXPIRED
CANCELLED
```

Matching engine boleh membuat kandidat, tetapi tidak boleh auto-merge hanya karena similarity nama.

---

# 147C. Portable Tahfiz History

## Table: `history_share_consents`

```text
id                      uuid PK
student_identity_id     uuid FK student_identities
source_institution_id   uuid FK institutions
target_institution_id   uuid FK institutions
scope                   jsonb NOT NULL
status                  text NOT NULL
approved_by_profile_id  uuid NULL
approved_at             timestamptz NULL
revoked_at              timestamptz NULL
expires_at              timestamptz NULL
created_at              timestamptz NOT NULL
updated_at              timestamptz NOT NULL
```

Contoh scope:

```json
{
  "memorization_summary": true,
  "exam_milestones": true,
  "teacher_private_notes": false
}
```

Target institution tidak membaca raw tables source institution. Service menghasilkan snapshot sesuai consent.

---

# 147D. Baseline / Placement

## Table: `student_baselines`

```text
id                        uuid PK
institution_id            uuid FK
institution_enrollment_id uuid FK
student_id                uuid FK student_profiles
program_id                uuid FK NULL
method_config_id          uuid FK NULL
source_type               text NOT NULL
source_institution_id     uuid NULL
baseline_data             jsonb NOT NULL
verification_status       text NOT NULL
set_by                    uuid NULL
verified_by               uuid NULL
set_at                    timestamptz NOT NULL
created_at                timestamptz NOT NULL
updated_at                timestamptz NOT NULL
```

Source type:

```text
NEW_BEGINNER
PORTABLE_HISTORY
PLACEMENT_TEST
ADMIN_BASELINE
MIGRATED_DATA
```

Baseline menghasilkan initial progress state melalui service yang diaudit.

---

# 147E. Assisted Method Setup

Jika workflow request dibangun di dalam platform, gunakan:

## Table: `method_setup_requests`

```text
id                      uuid PK
institution_id          uuid FK
requested_by            uuid FK profiles
status                  text NOT NULL
title                   text NULL
description             text NULL
requirements            jsonb DEFAULT '{}'
assigned_to             uuid NULL
result_method_config_id uuid NULL
submitted_at            timestamptz NOT NULL
reviewed_at             timestamptz NULL
completed_at            timestamptz NULL
created_at              timestamptz NOT NULL
updated_at              timestamptz NOT NULL
```

Status:

```text
SUBMITTED
IN_REVIEW
NEEDS_INFO
CONFIGURING
WAITING_APPROVAL
APPROVED
PUBLISHED
CANCELLED
```

File/foto pendukung disimpan di object storage. Assisted Setup tetap menghasilkan Method Engine config, bukan custom code liar per lembaga.

---

# 147F. Cross-Account Consistency Rule

Semua role membaca source yang sama:

```text
submissions
progress_states
assessments
notes
method_configs
```

Tidak boleh ada `teacher_progress`, `guardian_progress`, dan `student_progress` sebagai source-of-truth berbeda. View/cache boleh ada untuk performa, tetapi bukan sumber resmi.

---

# 147G. Offline Sync Data Integrity

Flow:

```text
Local durable draft
→ queue operation
→ client_operations receipt
→ validate expected version
→ transaction
→ progress state update
→ sync success
```

Server wajib menjaga idempotency, ordering yang relevan, version check, authorization, audit, dan no silent overwrite.

---

# 148. Minimum MVP Tables

Table yang wajib sebelum pilot:

```text
profiles
institutions
roles
institution_members
platform_roles

student_identities
student_profiles
teacher_profiles
guardian_profiles
guardian_students

institution_enrollments
program_types
programs
groups
program_enrollments
group_memberships
teacher_assignments

quran_mushafs
quran_juz
quran_pages
quran_surahs

reading_method_configs
reading_method_levels

method_presets
method_preset_stages
method_configs
method_stages
method_rules

grading_schemes
quick_notes

learning_sessions
submissions
assessments
notes
submission_quick_notes
progress_states
student_stage_settings

exams
exam_attempts
exam_results

score_formula_versions
program_score_settings
ngajitrack_score_snapshots
calendar_events

poster_assets
institution_poster_templates

import_jobs
import_rows
student_link_requests
student_baselines
client_operations

audit_logs
```

`history_share_consents` diperlukan sebelum Portable Tahfiz History dibuka ke pengguna nyata.

`method_setup_requests` boleh ditunda jika Assisted Setup awal diproses oleh support manual.

---

# 149. Tables That May Wait Until After MVP

Tergantung scope pilot:

```text
notifications
feature_flags
institution_feature_flags
submission_segments
quran_ayahs
quran_page_ayah_ranges
method_setup_requests
poster_generation_events
advanced_poster_editor_history
personal_mode_tables
mushaf_reader_preferences
```

---

# 150. MVP Database Completion Criteria

Database dianggap siap ketika:

- [ ] multi-tenant isolation bekerja;
- [ ] semua role punya relationship yang benar;
- [ ] student/teacher/guardian dapat dihubungkan;
- [ ] program/group berjalan;
- [ ] `program_types` membedakan TAHFIZ dan QURAN_READING;
- [ ] satu ustaz dapat membuka kelas berbeda dengan config berbeda tanpa data bercampur;
- [ ] reading method config dapat menyimpan level/jilid dan page boundary tanpa hard-code global;
- [ ] Quran Reading quick progress `+1/+2/ULANG` menghasilkan submission + progress state yang benar;
- [ ] boundary antar level Quran Reading tervalidasi;
- [ ] mushaf & page mapping valid;
- [ ] NgajiTrack Standard preset seeded;
- [ ] Daarut reference seeded;
- [ ] Sulaimaniyah reference seeded;
- [ ] method config dapat di-copy per lembaga;
- [ ] stage dapat di-rename;
- [ ] submission dapat disimpan;
- [ ] assessment dapat disimpan;
- [ ] quick notes bekerja;
- [ ] progress state update transactional;
- [ ] half-page/juz quantity akurat;
- [ ] cycle state dapat disimpan;
- [ ] exam result dapat disimpan;
- [ ] NgajiTrack Score menyimpan formula version + snapshot komponen;
- [ ] score lama tetap dapat dijelaskan setelah formula berubah;
- [ ] calendar event dapat dikaitkan ke santri/group/program tanpa mengganti source-of-truth akademik;
- [ ] poster template dan asset dapat disimpan;
- [ ] backend dapat generate poster tanpa menyimpan file final permanen;
- [ ] watermark NgajiTrack selalu dipaksakan server-side pada poster;
- [ ] correction tercatat audit;
- [ ] soft delete bekerja;
- [ ] RLS test lulus;
- [ ] duplicate/idempotency test lulus;
- [ ] optimistic concurrency test lulus;
- [ ] backup/restore diuji;
- [ ] satu global student identity dapat terhubung ke record beberapa lembaga tanpa tenant leakage;
- [ ] enrollment lama dapat ditutup tanpa menghapus histori;
- [ ] enrollment baru dapat dibuat di lembaga lain;
- [ ] group membership menyimpan histori perpindahan;
- [ ] bulk import mengelompokkan valid/match/verification/new/error;
- [ ] matching nama saja tidak dapat auto-link;
- [ ] linking existing account membutuhkan verification flow;
- [ ] baseline placement dapat dibuat dan diaudit;
- [ ] retry offline tidak membuat duplicate submission;
- [ ] stale offline operation menghasilkan conflict, bukan silent overwrite;
- [ ] progres yang disimpan ustaz terbaca konsisten oleh admin/santri/wali sesuai permission;
- [ ] alumni/read-only history tidak ikut query kelas aktif kecuali diminta;
- [ ] Super Admin sensitive progress/score review tercatat di audit;
- [ ] tidak ada tabel Personal Mode atau Mushaf reader yang secara tidak sengaja masuk MVP.

---

# 151. Final Database Principle

NgajiTrack tidak dibangun sebagai kumpulan form.

Database harus merepresentasikan:

> **siapa belajar, di lembaga mana, mengikuti program apa, menggunakan metode/config apa, berada di tahap atau level apa, melakukan aktivitas apa, dan bagaimana progresnya berubah dari waktu ke waktu.**

Dengan struktur ini:

- istilah lembaga boleh berbeda;
- UI boleh berubah;
- PWA boleh diganti Flutter;
- Flutter boleh diganti native;
- metode tahfiz maupun metode baca baru boleh ditambah;
- user dapat berkembang;
- laporan dapat berubah;

tanpa kehilangan struktur inti data.

Target database bukan hanya:

> **“bisa menyimpan input.”**

Targetnya adalah:

> **menjadi fondasi jangka panjang NgajiTrack yang tetap rapi ketika platform berkembang dari satu lembaga menjadi ribuan lembaga, santri berpindah antar lembaga, dan input tetap aman walaupun koneksi internet tidak stabil.**

---

# 151A. v1.2 Scope Decisions

Keputusan yang harus dianggap final untuk implementasi database MVP saat dokumen ini dibuat:

1. **Institution-first** — belum ada Personal Mode.
2. **Multi-program** — Tahfiz dan Quran Reading berada dalam backend yang sama.
3. **One source of truth** — Quran Reading tetap memakai `submissions` + `progress_states`, bukan database kedua.
4. **Program-aware UI** — database menyediakan tipe/config; Flutter menentukan pengalaman yang sesuai.
5. **No hard-coded Iqra pagination** — setiap config/edisi dapat memiliki page boundary berbeda.
6. **NgajiTrack Score is versioned** — score tidak boleh menjadi angka opaque yang tidak dapat dijelaskan.
7. **Poster on-demand** — template/assets permanen, hasil final tidak permanen.
8. **Watermark enforced server-side** — tidak dapat dimatikan lewat client/template.
9. **Mushaf reader deferred** — Quran Core hanya reference untuk tracking pada MVP.
10. **Alumni retained, operationally filtered** — histori tetap ada tetapi query kelas aktif tidak membaca semua histori tanpa kebutuhan.

