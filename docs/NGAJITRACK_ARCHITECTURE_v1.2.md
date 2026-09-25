# NgajiTrack — Technical Architecture

**Document:** `ARCHITECTURE.md`  
**Product:** NgajiTrack  
**Parent Brand:** Aseera  
**Status:** Draft v1.2 — Flutter-First Multi-Program Architecture + Offline-Resilient Teaching
**Depends on:** `PRODUCT_SPEC.md`  
**Purpose:** Menjadi acuan teknis utama agar seluruh implementasi NgajiTrack konsisten, aman, modular, mudah diuji, dan dapat berkembang dengan Flutter untuk pengguna lapangan serta web admin tanpa membangun ulang core system.

---

# 1. Architecture Goals

Arsitektur NgajiTrack harus memenuhi tujuan berikut:

1. **Satu backend untuk semua client.**
2. **Satu sumber kebenaran data.**
3. **Isolasi data antar lembaga.**
4. **Role & permission diverifikasi di backend.**
5. **Program/method engine tidak hard-coded ke satu pesantren atau satu jenis pembelajaran.**
6. **UI ustaz sangat cepat dan mobile-first.**
7. **Frontend dapat diganti tanpa membangun ulang backend.**
8. **Mudah menambahkan metode tahfiz maupun metode baca Al-Qur'an baru.**
9. **Semua perubahan data penting dapat diaudit.**
10. **MVP tetap sederhana, tetapi fondasi production-ready.**
11. **Tahfiz dan Quran Reading berbagi backend/source-of-truth yang sama.**
12. **UI dapat berbeda berdasarkan role + program yang sedang dibuka.**
13. **Personal Mode dan built-in Mushaf reader dapat ditambahkan nanti tanpa menjadi scope MVP sekarang.**

Prinsip utama:

> **Frontend boleh berubah. Core business logic dan data tidak boleh bergantung pada satu frontend.**

---

# 2. High-Level Architecture

```text
                           NGAJITRACK
                               │
                ┌──────────────┴──────────────┐
                │                             │
         WEB / PWA CLIENTS              FUTURE MOBILE APP
                │                             │
    ┌───────────┼───────────┐                 │
    │           │           │                 │
 Super Admin  Admin      Ustaz/Wali/       Flutter
    Web       Lembaga      Santri           Android/iOS
               Web          PWA                │
    └───────────┴───────────┴─────────────────┘
                               │
                         API / SERVICE LAYER
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
       Auth               Business Logic          Security
        │                      │                      │
        │             Tahfiz Method Engine           │
        │                      │                      │
        └──────────────────────┼──────────────────────┘
                               │
                            DATABASE
                         PostgreSQL Core
                               │
       ┌───────────────────────┼────────────────────────┐
       │                       │                        │
    Storage                Audit Log                Backups
       │                       │                        │
       └───────────────────────┴────────────────────────┘
```

---

# 3. Recommended MVP Stack

Stack ini direkomendasikan untuk MVP. Implementasi boleh berubah jika ada alasan teknis kuat, tetapi perubahan harus terdokumentasi.

## 3.1 Database

**PostgreSQL**

Alasan:

- relational data cocok untuk lembaga, santri, wali, ustaz, program, dan progres;
- strong consistency;
- foreign key;
- transaction;
- indexing;
- mudah digunakan untuk reporting;
- scalable;
- tidak mengunci sistem ke frontend tertentu.

Untuk MVP, PostgreSQL dapat dikelola melalui **Supabase**.

---

## 3.2 Backend Platform

**Supabase** direkomendasikan untuk MVP karena menyediakan:

- PostgreSQL;
- authentication;
- Row Level Security;
- storage;
- realtime jika dibutuhkan;
- edge/server functions;
- migration-friendly workflow.

NgajiTrack tetap harus dirancang agar business logic tidak bergantung sepenuhnya pada fitur proprietary Supabase.

---

## 3.3 Admin Web

Direkomendasikan:

**Next.js + TypeScript**

Digunakan terutama untuk:

- Super Admin;
- Admin Lembaga;
- bulk onboarding;
- konfigurasi program/metode;
- reporting;
- poster template/branding management.

Alasan:

- routing dan data table jelas;
- server/client rendering;
- cocok untuk dashboard desktop;
- mudah diuji;
- kuat untuk bulk action dan administration.

---

## 3.4 Styling / Design System

Direkomendasikan:

- Tailwind CSS atau equivalent utility-based system;
- reusable component library;
- NgajiTrack Design Tokens.

Tidak boleh membuat style berbeda-beda di setiap halaman tanpa sistem.

Contoh token:

```text
spacing
radius
typography
surface
success
warning
danger
brand
```

---

## 3.5 Flutter Mobile App — MVP Client

**Flutter** menjadi client utama untuk Ustaz, Wali, dan Santri pada MVP.

Flutter **tidak boleh** memiliki source-of-truth atau business rule resmi yang berbeda dari backend. Namun Flutter boleh memiliki:

- secure auth/session storage;
- local durable database/cache;
- draft input ustaz;
- sync queue;
- cached roster/config;
- role/program-aware UI;
- optimistic feedback yang aman.

Flutter bertanggung jawab untuk pengalaman lokal dan offline-resilient. Validasi final, permission, progress calculation resmi, audit, dan transaction tetap berada di backend.

---

# 4. Repository Structure

Direkomendasikan menggunakan monorepo.

```text
ngajitrack/
│
├── apps/
│   ├── admin-web/
│   └── mobile/                 # Flutter — MVP untuk ustaz/wali/santri
│
├── packages/
│   ├── ui/
│   ├── domain/
│   ├── api-client/
│   ├── validation/
│   └── config/
│
├── backend/
│   ├── services/
│   ├── functions/
│   ├── policies/
│   └── jobs/
│
├── database/
│   ├── migrations/
│   ├── seeds/
│   ├── policies/
│   └── fixtures/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── security/
│   └── e2e/
│
├── docs/
│   ├── PRODUCT_SPEC.md
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   └── METHODS.md
│
└── README.md
```

Jika MVP memakai satu Next.js app terlebih dahulu, pemisahan logis tetap harus dijaga walaupun belum menjadi beberapa app fisik.

---

# 5. Application Boundaries

NgajiTrack dibagi menjadi beberapa domain.

```text
Identity
Institution
Membership
People
Program
Quran Reference
Tahfiz Method
Quran Reading
Learning Session
Progress
Assessment
NgajiTrack Score
Calendar
Poster
Reporting
Audit
Notification
```

Setiap domain memiliki tanggung jawab sendiri.

---

# 6. Identity Domain

Tanggung jawab:

- authentication;
- user account;
- profile;
- session;
- password reset;
- account status.

Authentication identity **tidak sama** dengan role.

Contoh:

```text
Auth User
   │
   └── Profile
         │
         └── Institution Membership(s)
                   │
                   └── Role(s)
```

Tidak gunakan:

```text
users.role = "teacher"
```

sebagai satu-satunya role model.

---

# 7. Institution Domain

Setiap data operasional harus terkait ke `institution_id` jika relevan.

Contoh:

```text
Institution
 ├── Programs
 ├── Groups / Halaqah
 ├── Members
 ├── Students
 ├── Teachers
 ├── Guardians
 ├── Tahfiz Method Config
 ├── Reading Method Config
 ├── Poster Templates
 └── Reports
```

Rule utama:

> **Data lembaga A tidak boleh dapat dibaca atau dimodifikasi oleh user lembaga B.**

---

# 8. Multi-Tenant Architecture

NgajiTrack adalah sistem multi-tenant.

MVP menggunakan:

> **Shared database, shared schema, tenant isolation via institution_id + backend policies.**

Contoh:

```text
students
---------
id
institution_id
...
```

Tidak membuat database fisik terpisah per lembaga pada MVP.

Alasan:

- lebih sederhana;
- lebih murah;
- reporting global lebih mudah;
- scale masih sangat cukup;
- maintenance lebih ringan.

Namun keamanan tenant wajib diuji secara khusus.

---

# 9. Row Level Security

Jika menggunakan Supabase/Postgres RLS:

RLS harus menjadi lapisan keamanan utama untuk akses langsung database/API.

Contoh aturan konseptual:

### Admin Lembaga

```text
can_read(row)
IF membership.user_id = auth.user_id
AND membership.institution_id = row.institution_id
AND membership.role = INSTITUTION_ADMIN
```

### Teacher

```text
can_read(student)
IF teacher is assigned to student's group/program
```

### Guardian

```text
can_read(student)
IF guardian_students.guardian_id belongs to auth.user
AND guardian_students.student_id = student.id
```

### Student

```text
can_read(student)
IF student.user_id = auth.user_id
```

Frontend visibility bukan security.

---

# 10. API / Service Layer

Frontend tidak boleh melakukan operasi kompleks dengan menulis ke banyak tabel secara langsung.

Gunakan service/use-case layer.

Contoh service:

```text
createInstitution()
assignTeacher()
enrollStudent()
startTeachingSession()
recordSubmission()
recordReadingProgress()
completeSubmission()
calculateNextTarget()
getStudentProgress()
calculateNgajiTrackScore()
createCalendarEvent()
generateProgressPoster()
createExamResult()
```

Satu service dapat:

- validasi request;
- cek permission;
- membuka transaction;
- menjalankan business rule;
- update progress state;
- menulis audit log;
- mengembalikan result.

---

# 11. Transaction Rule

Operasi penting harus atomic.

Contoh `completeSubmission()`:

```text
BEGIN

1. validate user + tenant
2. validate assignment/enrollment
3. validate program type + relevant config
4. create submission
5. create assessment/note bila ada
6. update progress_state
7. update derived score input/state bila relevan
8. create audit_log
9. mark idempotent operation processed

COMMIT
```

Jika langkah state/audit gagal:

```text
ROLLBACK
```

Tidak boleh ada submission tercatat tetapi progress_state gagal berubah.

---

# 12. Program-Aware Learning Engine Architecture

NgajiTrack memiliki **Program-Aware Learning Engine** sebagai core domain.

Engine memilih behavior berdasarkan `program_type`:

```text
TAHFIZ
→ Tahfiz Method Engine

QURAN_READING
→ Quran Reading Engine

CUSTOM
→ capability/config yang diizinkan
```

Tahfiz tetap menggunakan preset/stage/rule. Quran Reading menggunakan konfigurasi metode + level/jilid + halaman tanpa menyalin isi buku.

Struktur konseptual:

```text
Method Preset
    │
    ├── Stage Definitions
    │
    ├── Progress Unit
    │
    ├── Rules
    │
    └── Transition Rules
             │
             ↓
      Institution Config
             │
             ↓
        Student State
```

---

# 12A. Quran Reading Engine Architecture

Quran Reading digunakan untuk Iqra dan metode baca Al-Qur'an sejenis.

Struktur konseptual:

```text
Program Type: QURAN_READING
        ↓
Reading Method Config
        ↓
Level / Jilid Definitions
        ↓
Current Page State
        ↓
Quick Input
```

MVP hanya mencatat progres administratif:

```text
method label
level/jilid
page
result/status
issue tag opsional
note opsional
```

Tidak menyimpan isi buku, scan halaman, layout, atau materi proprietary pihak ketiga.

Quick input default:

```text
[ +1 ] [ +2 ] [ ULANG ] [ DETAIL ]
```

`+1` dan `+2` dapat ditap berulang. Semua hasil tetap masuk ke pipeline `submissions + progress_states` yang sama dengan Tahfiz, bukan database paralel.

Boundary page/level berasal dari config lembaga dan **tidak boleh hard-coded secara universal**.

---

# 13. Method Preset vs Institution Config

## Method Preset

Template bawaan.

Contoh:

```text
NGAJITRACK_STANDARD
DAARUT_REFERENCE
SULAIMANIYAH_REFERENCE
```

## Institution Config

Copy/configuration milik lembaga.

Contoh:

```text
Preset:
NGAJITRACK_STANDARD

Renames:
NEW_MEMORIZATION → "Setoran Baru"
RECENT_REVIEW → "Murajaah Dekat"
```

Lembaga boleh mengubah label dan konfigurasi yang diizinkan tanpa mengubah preset global.

---

# 14. Stage Identity

Stage memiliki:

```text
id
method_config_id
stage_type
display_name
position
enabled
progress_unit
rules
visibility
```

`stage_type` stabil secara internal.

Contoh:

```text
NEW_MEMORIZATION
RECENT_REVIEW
LONG_TERM_REVIEW
EXAM
FINAL_PREPARATION
COMPLETION
CYCLE
```

`display_name` boleh diubah.

---

# 15. Rule Storage

Rule tidak boleh seluruhnya disimpan sebagai arbitrary executable code.

Gunakan declarative configuration.

Contoh:

```json
{
  "window": 10,
  "unit": "SHEET",
  "direction": "BACKWARD",
  "cross_juz": true
}
```

Business engine membaca konfigurasi tersebut.

Keuntungan:

- aman;
- dapat divalidasi;
- mudah dipindahkan;
- mudah ditampilkan ke admin;
- tidak membiarkan lembaga menjalankan code custom.

---

# 16. Progress State Architecture

Ada dua kategori data:

## Event / History

Contoh:

```text
submissions
assessments
exams
```

History bersifat append-oriented.

## Current State

Contoh:

```text
progress_states
```

State menyimpan posisi terkini.

Contoh:

```text
Student:
Ahmad

TAHFIZ / NEW_MEMORIZATION:
Juz 8 / Page 14

atau

QURAN_READING:
Iqra 3 / Page 22
```

Jangan hitung ulang seluruh histori setiap kali dashboard dibuka.

---

# 17. Event + State Consistency

Saat submission dibuat:

```text
Submission Event
      │
      ↓
Method Engine
      │
      ↓
Updated Progress State
```

Jika perlu recovery:

```text
History Events
      │
      ↓
Rebuild Progress State
```

Artinya history harus cukup lengkap untuk melakukan rekonstruksi.

---

# 18. Submission Architecture

Submission adalah record aktivitas belajar resmi, baik Tahfiz maupun Quran Reading.

Contoh field konseptual:

```text
id
institution_id
student_id
teacher_id
program_id
group_id
stage_id (nullable untuk Quran Reading)
method_config_id / reading_method_config_id
session_id

start_position
end_position
quantity

assessment
notes

occurred_at
created_at
updated_at
deleted_at
```

Position tidak boleh hanya text bebas.

---

# 19. Quran Position Model

Position harus berupa structured reference.

Contoh page-based:

```json
{
  "mushaf_id": "...",
  "juz": 7,
  "page_in_juz": 9
}
```

Contoh ayah-based:

```json
{
  "surah": 2,
  "ayah_start": 1,
  "ayah_end": 10
}
```

Contoh Sulaimaniyah:

```json
{
  "cycle": 4,
  "page_in_juz": 17,
  "juz": 12
}
```

Jangan simpan hanya:

```text
"Juz 7 halaman 9"
```

sebagai string utama.

Text hanya untuk display.

---

### Quran Reading position

```json
{
  "type": "READING_PAGE",
  "reading_method_config_id": "...",
  "level_id": "...",
  "level_code": "IQRA_3",
  "page": 18
}
```

Posisi Quran Reading divalidasi terhadap level/page config lembaga.

---

# 20. Draft Architecture for Quick Input

Tap ustaz tidak langsung menulis permanent progress.

Flow:

```text
Current Progress
      │
      ↓
Local / Session Draft
      │
 +1 / +1 / +0.5
      │
      ↓
Preview New State
      │
      ↓
Confirm / Save
      │
      ↓
Backend Transaction
```

Draft MVP untuk Flutter **harus berada di local durable storage**, bukan hanya RAM/frontend state.

Minimal menyimpan:

- draft id;
- student/session/program;
- actions;
- assessment/quick notes;
- base progress version;
- local sync status.

Backend tidak perlu menerima setiap tap. Confirm menghasilkan queued operation yang idempotent.

---

# 21. Undo Architecture

Sebelum save:

```text
actions = [+1, +1, +0.5]

Undo:
actions = [+1, +1]
```

Sesudah save:

tidak gunakan simple frontend undo.

Gunakan:

- edit submission;
- correction flow;
- audit log.

Perubahan permanent harus tercatat.

---

# 22. Smart Continue Architecture

Input:

```text
student
method
stage
current_progress
institution_rules
```

Output:

```text
recommended_next_position
recommended_quantity
warnings
```

Contoh:

```text
Current: Juz 7 / 8
Recommendation: Juz 7 / 9
```

Recommendation tidak sama dengan automatic commit.

Teacher tetap mengonfirmasi.

---

# 23. Boundary Rules

Engine harus menangani:

- akhir halaman satu juz;
- akhir juz;
- awal juz berikutnya;
- setengah halaman;
- rentang lintas juz;
- completion;
- exam eligibility;
- cycle completion;
- invalid backward movement;
- akhir jilid/level Quran Reading;
- jumlah halaman berbeda antar config/edisi;
- `ULANG` yang tidak boleh memajukan current page.

Contoh:

```text
18/20 + 2 = 20/20
```

Jika ada tap berikutnya:

```text
return:
REQUIRES_NEXT_JUZ_CONFIRMATION
```

---

# 24. Daarut Reference Architecture

Mapping:

```text
Sabaq
→ NEW_MEMORIZATION

Sabqi
→ RECENT_REVIEW

Manzil
→ LONG_TERM_REVIEW

Mukammal
→ EXAM

Persiapan Syahadah
→ FINAL_PREPARATION

Syahadah
→ COMPLETION
```

Nama aslinya disimpan sebagai reference preset, bukan nama default platform.

---

# 25. Sulaimaniyah Reference Architecture

Membutuhkan cycle state.

```text
Cycle
  ├── page_in_juz
  ├── current_juz
  ├── completed_juz
  └── completion
```

Contoh progression:

```text
cycle page 20:
Juz 1 → Juz 2 → ... → Juz 30

complete
↓
cycle page 19
```

Engine tidak boleh menganggap progression linear page biasa.

---

# 26. Teaching Session Architecture

`learning_session` merepresentasikan satu sesi kelas/halaqah.

Contoh:

```text
Session
 ├── Institution
 ├── Group
 ├── Teacher
 ├── Program
 ├── Started At
 ├── Ended At
 └── Status
```

Status:

```text
ACTIVE
COMPLETED
CANCELLED
```

Submission dapat terkait dengan session. Saat session dibuka, client menerima `program_type` dan config/capabilities yang menentukan UI input.

---

# 27. Focus Teaching Mode Architecture

Mode Mengajar adalah fitur client-side + OS integration.

### Flutter / Android MVP

- immersive/minimal UI;
- screen wake handling bila sesuai;
- optional DND integration hanya setelah izin pengguna dan sesuai API Android;
- restore previous OS/app state setelah session.

### iOS / Future Platform

- mengikuti API resmi platform;
- tidak mengasumsikan kemampuan DND yang sama dengan Android.

### Web/PWA Optional

Jika client web/PWA ditambahkan:
- fullscreen/wake lock hanya bila browser mendukung;
- tidak menjadi ketergantungan untuk core teaching flow.

Rule:

> Mode Mengajar tidak boleh membuat perangkat sulit dikembalikan ke keadaan normal.

---

# 28. UI Architecture by Role

## Super Admin

Desktop-first.

```text
Overview
Institutions
Users
Method Presets
Audit
System
```

## Institution Admin

Desktop-first, responsive.

```text
Overview
Students
Teachers
Guardians
Groups
Programs
Methods
Poster Templates
Reports
Settings
```

## Teacher

Mobile-first.

```text
Home
My Classes
Teaching Session
Program-Aware Quick Input
Student Detail
History
```

## Guardian

Mobile-first.

```text
Home
Child Progress
Activity
Calendar
Notes
History
```

## Student

Mobile-first.

```text
Home
My Progress
NgajiTrack Score (if enabled)
Calendar
Targets
History
```

---

# 29. Dashboard Adaptation

Dashboard tidak hard-coded satu metode.

Frontend menerima:

```text
program_type
capabilities
active config
enabled stages/levels
display names
progress format
```

Kemudian render berdasarkan capability.

Contoh:

```text
Daarut-style:
Hafalan Baru
Penguatan
Murajaah Berkala
Ujian

Sulaimaniyah-style:
Putaran
Halaman
Juz Aktif
Status Putaran

Quran Reading / Iqra-style:
Jilid / Level
Halaman Saat Ini
+1 / +2
Ulang / Detail
```

---

# 30. Capability-Based Rendering

Daripada:

```text
if method == "sulaimaniyah"
```

gunakan:

```text
capabilities:
- TAHFIZ_PAGE_PROGRESS
- CYCLE_PROGRESS
- EXAM
- READING_LEVEL_PAGE_PROGRESS
- QUICK_REPEAT
- SCORE_VIEW
- CALENDAR_VIEW
```

UI menggunakan capabilities.

Ini menjaga sistem tetap extensible.

---

# 31. Quick Notes Architecture

Ada 3 level quick notes:

```text
Global NgajiTrack Default
        ↓
Institution Default
        ↓
Teacher Personal
```

Saat ditampilkan:

1. teacher personal;
2. institution;
3. global.

Duplicate labels dapat di-deduplicate.

---

# 32. Notification Architecture

MVP tidak perlu kompleks.

Rancang abstraction:

```text
NotificationService
```

Channel masa depan:

```text
IN_APP
PUSH
EMAIL
WHATSAPP (future / external integration)
```

Business logic hanya meminta:

```text
notify(...)
```

bukan langsung memanggil vendor tertentu.

---

# 33. Reporting Architecture

Report tidak membaca UI state.

Report membaca:

- submissions;
- progress state;
- assessment;
- program/config;
- score snapshots bila fitur aktif;
- calendar source bila report membutuhkan jadwal.

MVP report:

```text
Student Progress
Class Summary
```

PDF generation dapat menjadi server-side job.

---

# 34. Storage Architecture

Object Storage MVP dibatasi untuk file yang benar-benar diperlukan:

- avatar/profile image jika digunakan;
- institution logo/branding;
- poster template assets;
- generated report yang memang perlu dipertahankan.

Poster progres final **tidak disimpan permanen**. Poster dirender on-demand, dikirim ke client untuk download/share, lalu temporary output dibuang.

Jangan menambahkan video/foto aktivitas santri sebagai kebutuhan default.

Jangan simpan binary file besar di PostgreSQL row. File metadata tetap di database.

---

# 35. Audit Architecture

Event yang wajib audit:

- create/update/delete institution;
- role assignment;
- student data change;
- teacher assignment;
- method config change;
- submission correction;
- exam result change;
- account status change;
- sensitive Super Admin student progress/score review;
- score formula/config change;
- poster template change;
- progress poster generation bila audit operasional diperlukan.

Format:

```text
actor_id
institution_id
action
entity_type
entity_id
old_value
new_value
created_at
```

Data audit tidak boleh dapat diubah user biasa.

---

# 36. Soft Delete Architecture

Entitas penting menggunakan:

```text
deleted_at
deleted_by
```

Query normal otomatis mengecualikan deleted rows.

Hard delete hanya melalui maintenance khusus dan policy terkontrol.

---

# 37. Concurrency

Kasus:

Ustaz A dan Ustaz B membuka santri yang sama.

NgajiTrack harus mencegah silent overwrite.

Gunakan salah satu:

- optimistic concurrency;
- version number;
- updated_at comparison.

Contoh:

```text
progress_state.version = 12
```

Client mengirim expected version 12.

Jika server sudah 13:

```text
409 CONFLICT
```

User diminta refresh/review.

---

# 38. Idempotency

Operasi create submission harus mampu mencegah double-submit akibat:

- jaringan lambat;
- user double tap;
- retry browser.

Request memiliki idempotency key.

Contoh:

```text
client_request_id
```

Request sama tidak menghasilkan dua submission.

---

# 39. Validation Layers

Validasi dilakukan di:

### UI
untuk pengalaman pengguna.

### API/service
untuk business rule.

### Database
untuk constraint terakhir.

Contoh:

```text
page_in_juz > 0
page_in_juz <= configured_page_count

reading_page >= configured_level_start
reading_page <= configured_level_end
```

Jangan hanya mengandalkan frontend.

---

# 40. Security Architecture

Mandatory:

- HTTPS;
- secure auth session;
- short-lived access token;
- refresh token handling aman;
- RLS/policy;
- server-side authorization;
- input validation;
- rate limiting untuk endpoint sensitif;
- audit;
- no plaintext password;
- secret tidak dikirim ke frontend.

---

# 41. Sensitive Data

Minimalisasi data pribadi.

Hanya simpan data yang memang dibutuhkan.

Jangan menjadikan NgajiTrack tempat menyimpan dokumen sensitif lembaga jika tidak diperlukan MVP.

Future privacy policy harus menjelaskan:

- data apa yang disimpan;
- siapa dapat melihat;
- berapa lama disimpan;
- proses deletion/export.

---

# 42. Password Architecture

Password dikelola oleh auth provider.

Database aplikasi tidak menyimpan:

```text
plain_password
```

Admin hanya memiliki:

```text
reset password
invite user
disable account
```

Tidak ada:

```text
show password
```

---

# 43. Session Management

User session harus mendukung:

- logout;
- expiry;
- revoke;
- password reset revocation;
- disabled account denial.

Future:

- device list;
- remote logout;
- MFA untuk admin.

---

# 44. Environment Architecture

## Development

- local/dev database;
- dummy data;
- bebas eksperimen.

## Staging

- mirip production;
- tidak berisi data pengguna nyata;
- QA;
- demo.

## Production

- data real;
- migration terkontrol;
- backup;
- monitoring.

Environment credential tidak boleh sama.

---

# 45. Database Migration Rule

Semua perubahan schema melalui migration.

Tidak:

> buka dashboard database lalu edit tabel production manual tanpa migration.

Folder:

```text
database/migrations/
```

Migration:

- versioned;
- reviewed;
- reproducible;
- tested staging terlebih dahulu.

---

# 46. Seed Data

Seed harus tersedia untuk:

```text
Program types
NgajiTrack standard method
Daarut reference
Sulaimaniyah reference
Quran Reading demo config (Iqra-style)
Quran reference test data
Score formula version
Dummy institutions
Dummy users
```

Seed production harus terpisah dari test fixtures.

---

# 47. Testing Strategy

## Unit Test

Untuk:

- progress math;
- stage transition;
- cycle logic;
- Quran Reading page/level boundary;
- score calculation/versioning;
- assessment rules.

## Integration Test

Untuk:

- create submission;
- record Quran Reading progress;
- update progress;
- calculate/store score snapshot;
- calendar event visibility;
- poster render/watermark;
- permissions;
- audit.

## Security Test

Khusus:

- institution A cannot read institution B;
- guardian A cannot read student B;
- teacher cannot access unassigned group.

## E2E

Flow:

```text
Admin creates program/class
Teacher records Tahfiz or Quran Reading progress
Student sees program-aware progress
Guardian sees child progress
Score/calendar update if enabled
```

---

# 48. Critical Test Cases

Wajib sebelum pilot:

1. +1 ditekan dua kali → +2.
2. Undo menghapus action terakhir.
3. Reset menghapus semua draft.
4. Double submit tidak membuat duplicate.
5. Page 20 tidak overflow diam-diam.
6. Completion pindah tahap sesuai rule.
7. Sulaimaniyah cycle berpindah benar.
8. Sabqi range dihitung sesuai config.
9. Manzil rotation berjalan benar.
10. Guardian tidak dapat melihat santri lain.
11. Teacher tidak dapat melihat group lain.
12. Admin lembaga tidak dapat melihat tenant lain.
13. Submission correction tercatat audit.
14. Disabled user tidak dapat login.
15. Deleted record tidak tampil di UI normal.
16. Quran Reading `+2 +2` menghasilkan +4 halaman.
17. Quran Reading `ULANG` tidak memajukan halaman.
18. Boundary level/jilid tidak overflow diam-diam.
19. Program TAHFIZ tidak menerima Reading config dan sebaliknya.
20. Score snapshot menyimpan formula version yang digunakan.
21. Poster generator selalu menambahkan watermark resmi NgajiTrack.
22. Poster final tidak tersimpan permanen.
23. Alumni tidak muncul pada query roster aktif kecuali diminta.
24. Sensitive Super Admin progress/score review menghasilkan audit log.

---

# 49. Performance Targets — MVP

Target awal:

### Teacher Quick Input

- screen interaction terasa instant;
- save normal < 1 detik pada koneksi baik;
- optimistic feedback diperbolehkan jika aman;
- tidak ada full page reload.

### Dashboard

- initial useful content < 2–3 detik pada koneksi normal;
- pagination untuk dataset besar.

### Database

Index minimal untuk:

```text
institution_id
student_id
teacher_id
group_id
program_id
program_type_id
created_at
stage_id
state_key
status
```

Index final ditentukan melalui query profiling.

---

# 50. Caching

MVP tidak perlu distributed cache kompleks.

Boleh gunakan:

- browser/client cache;
- server query cache terkontrol;
- static config cache.

Progress state harus tetap konsisten dan tidak boleh stale terlalu lama.

---

# 51. Offline Strategy

Full offline untuk seluruh platform **bukan MVP**, tetapi **offline-resilient teacher input adalah requirement MVP**.

Flutter teacher client wajib memiliki local durable store untuk:

- class roster aktif;
- relevant program/method config;
- last synced progress;
- draft;
- sync queue;
- idempotency/client operation ids.

Flow:

```text
tap
→ durable local draft
→ confirm locally
→ queue
→ sync when possible
→ server transaction
→ acknowledgement
```

Conflict detection menggunakan base/server version. Queue tidak dihapus sebelum server acknowledgement.

Admin/reporting dapat tetap online-first.

---

# 52. Optional Web/PWA Strategy

PWA bukan client utama Ustaz/Wali/Santri pada MVP Flutter-first, tetapi dapat ditambahkan sebagai client tambahan.

PWA:

- installable;
- icon;
- app-like shell;
- responsive;
- manifest;
- service worker;
- offline shell minimal.

Namun PWA tidak dianggap sama dengan native app untuk semua OS capability.

---

# 53. Mobile Migration Strategy

Ketika Flutter dibuat:

```text
Flutter App
    │
    ├── API Client
    ├── Auth
    ├── UI
    └── Local State
           │
           ↓
     Same Backend/API
```

Tidak memindahkan:

- method rules;
- permission;
- final validation;
- progress calculation source-of-truth

ke Flutter.

---

# 54. Native Migration Strategy

Jika suatu hari pindah:

```text
Android Kotlin
iOS Swift
```

yang diganti hanya client layer.

Backend tetap:

```text
Auth
API
Business Rules
Database
Audit
```

Ini adalah alasan utama architecture separation sejak MVP.

---

# 55. Observability

MVP minimal:

- application error log;
- server/function error;
- failed request;
- auth failure;
- database error;
- audit event.

Future:

- Sentry;
- performance tracing;
- uptime alert;
- dashboard incident.

Tidak log password/token.

---

# 56. Backup & Recovery

Production wajib memiliki:

- regular database backup;
- restore procedure;
- storage backup strategy;
- tested restore.

Backup tanpa pernah diuji restore dianggap belum cukup.

---

# 57. Error Handling

Error harus memiliki:

```text
code
message
context
```

Contoh:

```text
PROGRESS_BOUNDARY_REACHED
PERMISSION_DENIED
CONCURRENT_UPDATE
INVALID_METHOD_RULE
```

UI kemudian menerjemahkan ke pesan manusia.

---

# 58. Feature Flags

Fitur eksperimental dapat menggunakan feature flag.

Contoh:

```text
FOCUS_MODE
CLASS_QUICK_VIEW
QURAN_READING
NGAJITRACK_SCORE
PROGRESS_POSTER
SULAIMANIYAH_PRESET
```

Berguna agar fitur dapat diuji terbatas tanpa mengubah semua user sekaligus.

---

# 59. MVP Deployment Architecture

Contoh:

```text
                 Users
                   │
        ┌──────────┴──────────┐
        │                     │
   Flutter App            Admin Web
Ustaz/Wali/Santri     Super/Admin Lembaga
        │                     │
        └──────────┬──────────┘
                   │
              Backend/API
                   │
               Supabase
        ├── Auth
        ├── PostgreSQL
        ├── Storage
        └── Functions
```

Exact hosting vendor dapat diputuskan ketika implementation dimulai.

---

# 60. Deployment Pipeline

Alur:

```text
Developer/Astra
   ↓
Pull Request / Change Review
   ↓
Automated Tests
   ↓
Deploy Staging
   ↓
QA
   ↓
Approve
   ↓
Deploy Production
```

Tidak deploy production langsung dari perubahan yang belum diuji.

---

# 61. Build Order — Architecture View

## Step 1
Foundation

```text
Repo
Env
DB
Auth
Migration
Testing
```

## Step 2
Tenant & Roles

```text
Institution
Membership
Permissions
```

## Step 3
People

```text
Teacher
Student
Guardian
Relationships
```

## Step 4
Program

```text
Program Types
Program
Group
Assignment
Enrollment
```

## Step 5
Quran Reference + Quran Reading Config

```text
Quran reference mapping
Reading Method Config
Level/Jilid
Page Boundary
```

Built-in Mushaf reader tidak dibangun.

## Step 6
Learning Engines

```text
Tahfiz Preset/Config/Stage/Rule
Quran Reading progression
Program-aware Progress State
```

## Step 7
Submission Engine

```text
Session
Draft
Submission
Assessment
State Update
Audit
```

## Step 8
Role + Program-Aware UIs

```text
Admin Web
Flutter Teacher
Flutter Guardian
Flutter Student
Tahfiz UI
Quran Reading UI
```

## Step 9
Score + Calendar + Poster Foundation

## Step 10
Reports

## Step 11
Security + QA + Pilot

---

# 62. Architecture Review Gates

Sebelum pindah fase, cek:

### Gate A — Foundation

- migration works;
- environments separated;
- auth works.

### Gate B — Multi-Tenant

- tenant leakage test = pass.

### Gate C — Learning Engines

- Daarut reference = pass;
- Sulaimaniyah reference = pass;
- Quran Reading/Iqra-style = pass;
- no cross-program config mixing.

### Gate D — Teacher UX

- quick input target tercapai untuk Tahfiz dan Quran Reading.

### Gate E — Pilot

- backup tested;
- audit tested;
- permission tested;
- report works.

---

# 63. Rules for Astra / Coding Agent

Astra harus mengikuti aturan:

1. Baca semua file `/docs` sebelum perubahan besar.
2. Jangan mengubah domain model tanpa menjelaskan alasan.
3. Jangan membuat business rule hanya di frontend.
4. Jangan hard-code nama pesantren, metode baca, atau jumlah halaman Iqra/edisi tertentu sebagai universal.
5. Jangan hard-code label user-facing jika bisa dari config.
6. Semua schema change melalui migration.
7. Semua endpoint sensitif membutuhkan authorization.
8. Tambahkan test untuk bug yang diperbaiki.
9. Jangan menghapus audit.
10. Jangan memasukkan secret ke source code.
11. Jangan menulis production data untuk testing.
12. Jangan membuat fitur non-MVP tanpa instruksi; khususnya Personal Mode dan built-in Mushaf reader tetap deferred.
13. Preserve backward compatibility jika data sudah ada.
14. Jelaskan migration impact sebelum perubahan breaking.
15. Prioritaskan readability daripada clever code.

---

# 64. Architecture Decision Records

Keputusan besar sebaiknya dicatat di:

```text
docs/adr/
```

Contoh:

```text
ADR-001-use-postgresql.md
ADR-002-multi-tenant-shared-schema.md
ADR-003-progress-event-plus-state.md
ADR-004-method-engine-declarative-rules.md
ADR-005-flutter-first-field-client.md
ADR-006-program-aware-tahfiz-and-quran-reading.md
ADR-007-on-demand-poster-no-permanent-output.md
```

Tujuan:

Agar beberapa bulan kemudian tim tahu **kenapa** keputusan dibuat.

---

# 65. MVP Architecture Success Criteria

Architecture dianggap siap MVP jika:

- [ ] Satu backend melayani semua role.
- [ ] Database tenant-safe.
- [ ] Authentication terpisah dari membership/role.
- [ ] Program-aware learning engine configurable.
- [ ] TAHFIZ dan QURAN_READING berjalan pada backend yang sama.
- [ ] Quran Reading level/page config tidak hard-coded.
- [ ] Flutter role/program-aware navigation berjalan.
- [ ] NgajiTrack standard preset berjalan.
- [ ] Daarut reference berjalan tanpa hard-coded institution.
- [ ] Sulaimaniyah reference berjalan dengan cycle logic.
- [ ] Progress event + current state konsisten.
- [ ] Quick input menggunakan draft.
- [ ] Undo/reset aman.
- [ ] Boundary validation bekerja.
- [ ] Audit tersedia.
- [ ] Soft delete tersedia.
- [ ] Migration workflow tersedia.
- [ ] Development/Staging/Production terpisah.
- [ ] Security tests lulus.
- [ ] Flutter menggunakan backend tanpa business-rule fork.
- [ ] Offline-resilient teacher input menggunakan local durable storage + sync queue.
- [ ] NgajiTrack Score versioned dan explainable.
- [ ] Kalender memiliki visibility/ownership yang benar.
- [ ] Poster on-demand selalu memakai watermark server-side dan output final tidak permanen.
- [ ] Personal Mode dan built-in Mushaf tidak ikut MVP.

---

# 66. Final Architecture Principle

NgajiTrack harus dibangun sebagai:

> **Satu platform pembelajaran Al-Qur'an multi-lembaga dengan backend terpusat, learning engine yang fleksibel, data terstruktur, dan client yang dapat dikembangkan tanpa merusak core system.**

Jika suatu keputusan teknis membuat NgajiTrack:

- lebih sulit menambahkan lembaga;
- lebih sulit menambahkan program/metode;
- lebih sulit mengganti frontend;
- lebih sulit menjaga data aman;

maka keputusan tersebut harus dievaluasi ulang.

Target MVP bukan hanya **“berhasil jalan”**.

Targetnya adalah:

> **berhasil jalan dengan fondasi yang cukup rapi untuk terus dikembangkan.**
---

# REVISION v1.1 — Product Architecture Update

Bagian ini mengunci keputusan arsitektur terbaru NgajiTrack. Jika ada bagian lama yang bertentangan dengan bagian revisi ini, **bagian revisi ini menjadi acuan terbaru**.

## A. Architecture Goals

NgajiTrack harus dirancang agar:

1. satu backend menjadi source of truth untuk seluruh role;
2. UI berbeda per role tetapi data tetap terhubung;
3. satu lembaga dapat memiliki ratusan atau ribuan santri;
4. satu santri dapat memiliki histori lintas lembaga tanpa mencampur data tenant;
5. ustaz tetap dapat menginput ketika internet tiba-tiba hilang;
6. retry tidak membuat data ganda;
7. konflik data tidak ditimpa diam-diam;
8. login terasa cepat setelah aktivasi pertama;
9. UI dapat direvisi tanpa membongkar business logic;
10. Program/Learning Engine tetap menjadi pusat variasi program dan metode lembaga;
11. Assisted Setup menghasilkan configuration, bukan custom code liar;
12. Astra/coding agent wajib menguji alur end-to-end, bukan hanya komponen terpisah.

---

## B. Updated High-Level Architecture

```text
                    ┌──────────────────────────────┐
                    │         CLIENT LAYER         │
                    │                              │
                    │  Admin Web / Responsive Web  │
                    │  Teacher Mobile/PWA/App      │
                    │  Student Mobile/PWA/App      │
                    │  Guardian Mobile/PWA/App     │
                    └──────────────┬───────────────┘
                                   │
                      Secure API / Auth Session
                                   │
                    ┌──────────────▼───────────────┐
                    │      APPLICATION LAYER       │
                    │                              │
                    │ Auth / Membership / RBAC     │
                    │ Institution / Enrollment     │
                    │ Class / Halaqah              │
                    │ Program/Learning Engine       │
                    │ Learning / Submission        │
                    │ Progress Engine              │
                    │ Bulk Onboarding              │
                    │ Identity Linking             │
                    │ Portable History             │
                    │ Sync / Conflict Service      │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │        DATA LAYER            │
                    │                              │
                    │ PostgreSQL / Supabase        │
                    │ RLS / Transactions           │
                    │ Object Storage               │
                    │ Audit Logs                   │
                    └──────────────────────────────┘
```

Tidak ada database terpisah untuk Ustaz, Santri, Wali, atau Admin.

---

## C. Cross-Account Consistency

Semua role membaca state resmi dari sumber yang sama.

Contoh:

```text
Ustaz menyimpan setoran
        ↓
Submission Service
        ↓
Database transaction
        ↓
submissions + progress_states + audit
        ↓
┌────────────┬────────────┬────────────┐
│ Admin View │ Santri View│ Wali View  │
└────────────┴────────────┴────────────┘
```

Perbedaan antar-role hanyalah:

- permission;
- projection;
- visibility;
- UX.

**Rule:** jangan membuat `teacher_progress`, `guardian_progress`, dan `student_progress` sebagai source-of-truth yang berbeda.

Cache/view boleh digunakan untuk performance, tetapi data resmi tetap satu.

---

## D. Identity & Multi-Institution Model

Pisahkan:

```text
Auth Identity
      ↓
Global NgajiTrack Identity
      ↓
Institution-Specific Student Record
      ↓
Institution Enrollment
      ↓
Program Enrollment
      ↓
Class/Halaqah Membership
```

### D.1 Global Identity

Satu santri dapat memiliki satu identitas NgajiTrack yang mengikuti dirinya lintas lembaga.

### D.2 Institution Record

Setiap lembaga tetap memiliki:

- NIS/ID lokal;
- profil administratif lokal;
- enrollment sendiri;
- class/halaqah sendiri;
- method config sendiri;
- progress aktif sendiri.

### D.3 Transfer

Saat santri pindah:

```text
Enrollment A → COMPLETED/GRADUATED/TRANSFERRED
History A     → tetap read-only

Enrollment B → baru
Method B     → mengikuti lembaga B
Baseline B   → hasil portable history / placement test
```

Jangan memindahkan row lama hanya dengan mengganti `institution_id`.

---

## E. Bulk Onboarding Architecture

NgajiTrack harus mampu menangani import santri dalam batch.

Pipeline:

```text
Upload CSV/XLSX
    ↓
Parse
    ↓
Normalize
    ↓
Validate
    ↓
Identity Matching
    ↓
Preview Result
    ↓
Admin Confirmation
    ↓
Create / Link
    ↓
Enrollment
    ↓
Class Assignment
```

Status row minimal:

```text
VALID_NEW
MATCHED_EXISTING
NEEDS_VERIFICATION
POSSIBLE_DUPLICATE
INVALID
```

### E.1 Large Institution Rule

Jangan memproses seluruh batch sebagai satu request HTTP panjang.

Gunakan:

- background job;
- chunk/batch processing;
- progress status;
- resumable processing;
- per-row error capture;
- idempotency.

Admin harus dapat melihat hasil tanpa membuka santri satu per satu.

---

## F. Account Matching & Verification

Matching engine hanya menghasilkan kandidat.

Auto-link tidak boleh terjadi hanya karena nama sama.

Sinyal matching dapat mencakup:

- NgajiTrack ID;
- phone/email terverifikasi;
- NISN jika relevan;
- tanggal lahir;
- data verifikasi lain yang sesuai.

Flow:

```text
Candidate found
    ↓
Confidence check
    ↓
Needs verification?
    ├── Yes → verification request
    └── No  → verified link
```

Semua linking penting harus diaudit.

---

## G. Class / Halaqah Ownership

Struktur resmi kelas dikelola oleh Admin Lembaga.

```text
Admin Lembaga
    ├── create class
    ├── assign teacher
    ├── add/remove/move student
    └── publish structure
```

Ustaz:

```text
Teacher
    ├── run teaching session
    ├── manage queue/order
    ├── input progress
    ├── mark operational issue
    └── request class change
```

Perubahan struktural tidak dilakukan bebas oleh ustaz kecuali role/permission memang mengizinkan.

---

## H. Assisted Method Setup Architecture

Ada dua jalur:

```text
Self-Service
Institution Admin → Method Builder → Preview → Publish
```

atau:

```text
Assisted Setup
Institution → submit SOP/photos/rules
           → NgajiTrack team review
           → configure Method Engine
           → preview
           → revision
           → approval
           → publish
```

**Rule penting:** Assisted Setup normalnya tidak menghasilkan fork/custom code khusus per lembaga.

Jika kebutuhan baru muncul:

```text
Need cannot be represented
    ↓
Evaluate as reusable platform capability
    ↓
Add to Method Engine
    ↓
All institutions can benefit
```

---

## I. Local-First Teacher Input

Teacher input harus tahan terhadap koneksi buruk.

### I.1 Local Durable Draft

Setiap perubahan saat sesi:

- +½;
- +1;
- +2;
- ULANG / repeat state;
- assessment;
- quick note;
- manual correction;

disimpan langsung ke local durable storage.

Contoh state:

```text
DRAFT
LOCAL_SAVED
READY_TO_SYNC
PENDING_SYNC
SYNCED
CONFLICT
FAILED_RETRYABLE
```

Jangan hanya menyimpan draft di memory RAM.

### I.2 Confirmation Flow

```text
Teacher taps Confirm
        ↓
Finalize local draft
        ↓
Create queued operation
        ↓
Attempt sync
        ├── online  → send now
        └── offline → keep queue
```

Ustaz boleh lanjut ke santri berikutnya walaupun sync belum selesai.

### I.3 Background Sync

Ketika koneksi kembali:

```text
Connectivity restored
    ↓
Sync worker wakes
    ↓
Send queued operation
    ↓
Server validates
    ↓
Commit transaction
    ↓
Return server version
    ↓
Mark local item SYNCED
```

### I.4 Idempotency

Setiap queued operation memiliki:

```text
client_operation_id
client_request_id
```

Server menyimpan receipt.

Retry request yang sama harus mengembalikan hasil yang sama, bukan membuat submission baru.

### I.5 Conflict Detection

Client menyertakan:

```text
base_progress_version
```

Server membandingkan dengan:

```text
current_progress_version
```

Jika berbeda dan perubahan tidak aman untuk auto-merge:

```text
CONFLICT
```

Tidak boleh silent overwrite.

---

## J. Offline Scope for MVP

MVP tidak harus membuat seluruh platform full offline.

Prioritas:

> **Sesi input ustaz harus tetap dapat berjalan dan input tidak hilang ketika internet tiba-tiba putus.**

Cache minimum teacher client:

- current class;
- student roster;
- last synced progress;
- active program type + relevant Tahfiz/Reading config;
- grading scheme;
- quick notes;
- pending drafts;
- pending sync queue.

Admin/reporting dapat tetap membutuhkan internet pada MVP.

---

## K. Fast Login & Fast App Startup

Setelah aktivasi/login pertama, pengalaman membuka aplikasi harus terasa cepat seperti aplikasi komunikasi modern.

### K.1 Persistent Session

Gunakan:

- secure refresh token;
- short-lived access token;
- automatic token refresh;
- secure storage pada mobile;
- httpOnly secure cookie untuk web jika sesuai arsitektur.

User tidak diminta login ulang setiap membuka aplikasi.

### K.2 Startup Strategy

Jangan menunggu seluruh API selesai sebelum menampilkan UI.

Flow:

```text
App open
   ↓
Load secure session
   ↓
Load cached app shell + last workspace
   ↓
Render immediately
   ↓
Refresh data in background
```

Target UX:

- app shell muncul cepat;
- dashboard terakhir dapat tampil dari cache;
- data terbaru menyusul;
- status stale/sync ditampilkan jika diperlukan.

### K.3 Last Context Restore

Simpan secara lokal:

- last role;
- last institution;
- last class;
- last open screen;
- current teaching session bila masih valid.

Contoh:

```text
Ustaz sedang input Kelas A
→ app tertutup
→ buka lagi
→ kembali ke Kelas A / sesi aktif
```

Jika konteks sudah expired, fallback aman ke dashboard.

### K.4 Multi-Role Switching

Satu akun dapat memiliki beberapa role.

Tidak perlu logout-login.

Gunakan:

```text
Switch Role / Switch Workspace
```

Permission tetap dihitung server-side.

### K.5 Optional Local Unlock

Untuk keamanan tambahan:

```text
Biometric / PIN
```

boleh digunakan sebagai local unlock.

Ini **bukan** pengganti server authentication.

---

## L. UI Architecture & Revisability

Gunakan reusable design system.

Layer:

```text
Design Tokens
    ↓
Base Components
    ↓
Domain Components
    ↓
Role Screens
```

Tokens:

- colors;
- spacing;
- typography;
- radius;
- elevation;
- motion.

Base components:

- buttons;
- inputs;
- cards;
- tabs;
- dialogs;
- toast;
- loaders;
- empty state;
- error state.

Domain components:

- progress card;
- student row;
- quick input;
- juz progress map;
- sync status;
- class roster.

Tujuan:

> UI dapat direvisi besar tanpa mengubah database/business logic.

---

## M. Role-Specific Frontend Strategy

### M.1 Admin Lembaga / Super Admin

Prioritas:

- web-first;
- responsive;
- table/filter/bulk actions;
- reporting;
- onboarding;
- method configuration.

### M.2 Ustaz

Prioritas:

- mobile-first;
- minimal typing;
- tap-before-type;
- quick continuation;
- offline-resilient session.

### M.3 Santri

Prioritas:

- program-aware progress visual;
- target;
- calendar;
- NgajiTrack Score bila aktif;
- history;
- milestone.

### M.4 Wali

Prioritas:

- child summary;
- clear progress;
- calendar;
- NgajiTrack Score bila aktif;
- simple terminology;
- visibility controlled by institution.

Semua frontend tetap menggunakan design system yang sama.

---

## N. Realtime vs Revalidation

Tidak semua data perlu realtime socket.

Gunakan prinsip:

- teacher submission: commit immediately when online;
- admin/student/guardian: refresh/revalidate quickly;
- realtime channel hanya untuk area yang benar-benar memberi manfaat.

Contoh prioritas realtime:

- active teaching session;
- sync status;
- class operational state.

Contoh yang cukup dengan revalidation:

- monthly report;
- historical dashboard;
- settings.

Tujuan: stabilitas lebih penting daripada memaksa semua layar realtime.

---

## O. Server Transaction Boundaries

Operasi penting harus transactional.

Contoh submission:

```text
BEGIN
  verify tenant + permission
  verify enrollment + assignment
  verify program type + relevant config/stage
  verify base version
  insert submission
  insert assessment/note
  update progress_state
  create audit
  mark client_operation processed
COMMIT
```

Jika salah satu gagal:

```text
ROLLBACK
```

Tidak boleh progress berubah tetapi submission gagal tercatat, atau sebaliknya.

---

## P. Astra / Coding Agent Execution Rules

Astra harus bekerja sebagai engineering agent, bukan sekadar page generator.

Sebelum implementasi besar:

1. inspect existing code;
2. inspect schema;
3. inspect current tests;
4. propose minimal compatible change;
5. implement;
6. run automated tests;
7. run migration checks;
8. run permission/RLS checks;
9. test end-to-end flow;
10. verify mobile/responsive behavior;
11. verify offline/retry behavior bila terkait;
12. verify cross-role result.

Astra tidak boleh:

- membuat tabel paralel tanpa alasan;
- mem-bypass RLS hanya agar fitur “jalan”;
- menaruh business rule kritis hanya di UI;
- membuat custom logic `if institution == X`;
- membuat duplicate submission saat retry;
- menganggap fitur selesai hanya karena satu layar terlihat benar.

---

## Q. Mandatory End-to-End Scenarios

### Q.1 New Institution

```text
Register institution
→ admin activation
→ choose program type + self-configure relevant method
→ create class
→ add teacher
→ import students
→ assign class
→ start teaching
```

### Q.2 Existing Student

```text
Import student
→ candidate global identity found
→ verification
→ link
→ create institution enrollment
→ baseline/placement
→ active learning
```

### Q.3 Transfer

```text
Graduate from A
→ A history remains
→ join B
→ new enrollment
→ B method applied
→ optional portable summary
```

### Q.4 Offline Teaching

```text
Open class
→ input student A
→ internet disappears
→ local draft saved
→ confirm queued
→ continue student B
→ internet returns
→ queue sync
→ no duplicates
→ admin/student/guardian receive updated state
```

### Q.5 Quran Reading Quick Input

```text
Open Quran Reading class
→ load level/page config
→ student starts at page 18
→ tap +2
→ tap +2
→ preview page 18–21
→ confirm
→ progress next position becomes 22
→ guardian/student view updates
```

`ULANG` must create activity/history without advancing current page.

### Q.6 Poster Generation

```text
Select achievement
→ authorize requester
→ load student + institution data
→ load published template
→ render dynamic fields
→ force official NgajiTrack watermark
→ stream/download result
→ dispose temporary output
```

Final poster is not stored permanently.

### Q.7 Score Update

```text
Verified Tahfiz assessment/submission
→ calculate using active formula version
→ create score snapshot
→ expose components according to visibility
→ historical snapshot keeps formula version
```

---

### Q.8 Fast Reopen

```text
User already authenticated
→ app open
→ session restored
→ cached shell shown
→ last workspace restored
→ background refresh
```

---

## R. Performance Principles

Optimasi awal difokuskan pada perceived performance.

Prioritas:

- fast app shell;
- lazy load non-critical data;
- cache safe read models;
- batch API;
- indexed tenant queries;
- pagination;
- avoid N+1;
- background refresh;
- optimistic/local-first UX only where safe.

Jangan membuat startup tergantung pada puluhan API sequential.

---

## S. Observability & Stability

Production minimal harus memiliki:

- structured logs;
- error tracking;
- request correlation ID;
- sync failure logs;
- background job status;
- database slow query monitoring;
- migration logging;
- audit logs untuk perubahan sensitif.

Untuk sync/offline, observability harus dapat menjawab:

```text
Apakah operasi diterima?
Apakah sudah diproses?
Apakah duplicate?
Apakah conflict?
Apakah retry masih pending?
```

---

## T. Failure Handling

Tidak ada silent failure.

Jika gagal:

- tampilkan status yang dimengerti user;
- pertahankan draft/data yang bisa dipulihkan;
- log diagnostic;
- beri retry bila aman;
- jangan menghapus local queue sebelum server acknowledgement.

Untuk user-facing copy, hindari error teknis mentah.

Contoh:

```text
Menunggu koneksi
Tersimpan di perangkat
Sinkronisasi gagal — akan dicoba lagi
Perubahan perlu ditinjau
```

---

## U. Security Boundary

Security tetap server-side.

Client boleh menyembunyikan tombol, tetapi server tetap harus memverifikasi:

- siapa user;
- role aktif;
- institution membership;
- enrollment;
- class assignment;
- resource ownership;
- sharing consent;
- mutation permission;
- sensitive Super Admin review permission + audit requirement;
- poster watermark enforcement server-side.

Fast startup tidak boleh mengorbankan auth verification.

---

## V. Product Architecture Principle

Prinsip utama:

> **fleksibel di belakang, sederhana di depan.**

Dan untuk pengalaman pengguna:

```text
Admin:
atur sekali, sistem berjalan.

Ustaz:
buka cepat → UI sesuai program → tap → simpan → lanjut.

Santri:
langsung tahu posisi.

Wali:
langsung mengerti progres anak.

Ketika internet buruk:
input tetap aman.

Ketika santri pindah:
histori tetap utuh.

Ketika UI berubah:
core system tetap stabil.
```
---

# REVISION v1.2 — Flutter-First Multi-Program Architecture Lock

Bagian ini mengunci keputusan arsitektur terbaru. Jika ada bagian sebelumnya yang bertentangan dengan revisi ini, **REVISION v1.2 menjadi acuan terbaru**.

## A. MVP Client Strategy

```text
Super Admin / Admin Lembaga
→ Web Admin

Ustaz / Wali / Santri
→ Flutter App
```

PWA/web user client boleh ditambahkan kemudian, tetapi bukan jalur utama MVP.

Flutter wajib memakai backend/API dan database yang sama. Tidak ada database resmi terpisah per role.

---

## B. Program-Aware Runtime

Setelah login dan pemilihan workspace/context:

```text
User
→ Active Institution
→ Active Role
→ Active Class/Program
→ program_type
→ capabilities/config
→ render matching UI
```

Contoh:

```text
TEACHER + TAHFIZ
→ Tahfiz quick-input UI

TEACHER + QURAN_READING
→ Level/Page quick-input UI

STUDENT + TAHFIZ
→ Hafalan/Murajaah progress

STUDENT + QURAN_READING
→ Jilid/Level/Page progress
```

Role tidak menentukan satu UI statis. **Role + program/context** menentukan pengalaman.

---

## C. Quran Reading / Iqra Architecture

Untuk MVP, Quran Reading hanya membutuhkan:

```text
reading_method_config
reading_method_levels
page boundaries
submissions
assessments/issue tags
progress_states
```

Quick input:

```text
[ +1 ] [ +2 ] [ ULANG ] [ DETAIL ]
```

Akumulasi:

```text
+2 +2 = +4
```

Jumlah halaman per level/jilid berasal dari konfigurasi lembaga/edisi, bukan konstanta platform.

Nama Iqra/Ummi/Qiroati/Tilawati/Yanbu'a dapat digunakan sebagai label metode yang digunakan lembaga, tetapi sistem tidak menyimpan konten buku dan tidak mengklaim integrasi resmi.

---

## D. NgajiTrack Score Architecture

Score adalah derived, versioned educational metric.

```text
verified submissions/assessments
        ↓
score calculation service
        ↓
formula_version
        ↓
score snapshot
        ↓
role-aware projection
```

Default initial components:

```text
quality      35%
retention    30%
consistency  20%
speed        15%
```

Rules:

- jumlah hafalan tetap terpisah dari score;
- speed dibandingkan dengan target program yang relevan;
- formula changes create/version new formula;
- historical snapshot keeps formula version;
- client tidak menentukan official score;
- score harus explainable melalui component values.

---

## E. Calendar Architecture

Calendar adalah projection/scheduling layer, bukan source-of-truth akademik.

Event dapat berasal dari:

```text
setoran schedule
murajaah schedule
exam
target
institution activity
```

Event yang berasal dari domain lain menyimpan source reference. Menghapus tampilan kalender tidak boleh menghapus submission/exam history.

---

## F. Poster Generation Architecture

Poster progres menggunakan template permanen dan output sementara.

```text
request
→ permission
→ fetch student/institution/achievement
→ load template/assets
→ render server-side
→ force official NgajiTrack logo watermark
→ stream/download
→ dispose temp output
```

Permanent:

```text
template config
institution branding
poster assets
official NgajiTrack watermark asset
```

Not permanent:

```text
rendered poster output
```

Watermark hanya boleh kecil di bawah kiri/kanan, tetapi **tidak dapat dimatikan oleh tenant/client**.

Future editor dapat memiliki shape, gradient, layer, font, border, shadow, opacity, dan asset library tanpa mengubah prinsip render/security di atas.

---

## G. Storage Scope

Supabase/object storage MVP digunakan terutama untuk:

```text
avatars/
institution-branding/
poster-assets/
generated-reports/   # hanya jika memang perlu dipertahankan
```

Tidak ada kebutuhan default untuk video/foto aktivitas santri.

Generated progress poster tidak disimpan permanen.

---

## H. Alumni / Historical Data

```text
ACTIVE enrollment
→ operational query path

GRADUATED / COMPLETED / TRANSFERRED
→ historical read-only path
```

Data alumni tetap berada di server/database tetapi tidak memerlukan realtime subscription/background activity dan harus terfilter dari roster/query operasional aktif.

---

## I. Super Admin Sensitive Review

Super Admin dapat mereview progres/score jika fitur operasional membutuhkan, tetapi:

```text
permission check
→ purpose/context
→ read
→ audit event
```

Akses sensitif bukan alasan untuk menonaktifkan RLS secara global.

---

## J. Deferred Scope

Tidak dibangun pada MVP:

```text
Personal Mode
Built-in Mushaf Reader
Personal Google Drive backup
Memory Map personal
Streak/gamification personal
Mushaf audio/reader history
```

Quran reference mapping untuk tracking tetap boleh ada.

Jika fitur deferred dibangun nanti, implementasinya melalui migration/versioned app update tanpa memecahkan institution core.

---

## K. Astra Execution Priority

Dengan limit coding agent terbatas, urutan implementasi:

```text
1. Supabase project + migrations
2. Auth + profiles
3. tenant/membership/RLS
4. global student identity + institution records
5. program_types + programs/classes/enrollment
6. Tahfiz + Quran Reading configs
7. submissions + progress_states + audit
8. Flutter auth/workspace/role shell
9. teacher quick input + durable offline queue
10. student/guardian views
11. NgajiTrack Score foundation
12. calendar
13. reports + poster generation
14. QA/security/pilot
```

Astra dilarang melompat ke Personal Mode atau Mushaf reader sebelum scope berubah secara eksplisit.

---

## L. v1.2 Architecture Acceptance Criteria

- [ ] Flutter adalah field client utama.
- [ ] Admin web tetap memakai backend yang sama.
- [ ] `TAHFIZ` dan `QURAN_READING` memiliki config berbeda tetapi event/state pipeline yang sama.
- [ ] UI ustaz berubah berdasarkan program yang dibuka.
- [ ] Quran Reading `+1/+2/ULANG/DETAIL` bekerja 2–5 detik untuk kasus normal.
- [ ] Draft teacher tersimpan durable secara lokal.
- [ ] Queue sync idempotent dan conflict-aware.
- [ ] NgajiTrack Score dihitung server-side, versioned, dan explainable.
- [ ] Calendar tidak menduplikasi source-of-truth akademik.
- [ ] Poster final on-demand tidak disimpan permanen.
- [ ] Watermark official NgajiTrack enforced server-side.
- [ ] Alumni history tetap tersimpan tetapi tidak membebani roster aktif.
- [ ] Sensitive Super Admin review diaudit.
- [ ] Personal Mode tidak dibangun.
- [ ] Built-in Mushaf reader tidak dibangun.
