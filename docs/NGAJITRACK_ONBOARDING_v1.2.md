# NgajiTrack — ONBOARDING.md

**Status:** Draft v1.2 — Multi-Program Institution Onboarding + Flutter Activation + Transfer-Safe Identity  
**Scope:** MVP institution-first + scalable foundation  
**Product Principle:** **cepat, aman, massal, tidak membingungkan, program-aware, dan tetap terhubung antar-role**

---

# 1. Purpose

Dokumen ini mendefinisikan seluruh alur onboarding NgajiTrack dari saat sebuah lembaga pertama kali mendaftar sampai ustaz, santri, wali, dan admin dapat menggunakan platform secara aktif untuk program Tahfiz maupun Quran Reading.

Onboarding harus mendukung:

- lembaga kecil maupun besar;
- ratusan hingga ribuan santri;
- santri baru maupun santri yang sudah pernah memakai NgajiTrack;
- satu orang dengan lebih dari satu role;
- perpindahan santri antar-lembaga;
- Assisted Setup metode;
- bulk import;
- class/halaqah assignment;
- fast activation;
- persistent login;
- keamanan data antar-lembaga;
- histori tahfiz yang tetap utuh;
- pemilihan jenis program sebelum konfigurasi metode;
- pengalaman Flutter untuk ustaz, santri, dan wali;
- onboarding Quran Reading/Iqra-style tanpa hard-code jumlah halaman;
- arsitektur yang tetap siap menambah fitur masa depan tanpa memasukkan Personal Mode ke MVP.

Onboarding bukan sekadar membuat akun.

Target akhirnya adalah:

```text
Lembaga siap
→ program type siap
→ metode/config siap
→ struktur kelas siap
→ ustaz siap
→ santri siap
→ wali siap
→ semua akun terhubung
→ kegiatan belajar dapat dimulai
```

---

# 2. Core Onboarding Principles

## 2.1 Admin controls institution structure

Admin Lembaga adalah pihak utama yang mengelola:

- profil lembaga;
- program;
- metode;
- kelas/halaqah;
- ustaz;
- santri;
- penempatan santri;
- hubungan wali;
- status aktif/nonaktif.

Ustaz tidak menjadi default owner struktur resmi lembaga.

## 2.2 Bulk before manual

NgajiTrack harus mengutamakan onboarding massal.

Jika lembaga memiliki 800 santri, admin tidak boleh diwajibkan menginput 800 akun satu per satu.

## 2.3 Existing users should not start over

Jika santri sudah memiliki akun NgajiTrack:

```text
akun lama tetap
→ histori lama tetap
→ enrollment baru dibuat
```

Bukan:

```text
buat akun baru lagi
```

## 2.4 One person, one identity, multiple contexts

Satu orang dapat memiliki:

- role Ustaz di Lembaga A;
- role Wali di Lembaga B;
- role Admin + Ustaz pada lembaga yang sama.

Tidak perlu akun login terpisah.

## 2.5 Secure by default

Matching akun tidak boleh hanya berdasarkan nama.

Linking tidak boleh dilakukan secara diam-diam bila identitas belum cukup terverifikasi.

## 2.6 Program before method

Admin tidak langsung dipaksa memilih metode sebelum konteks program jelas.

Urutan:

```text
Buat Program
→ pilih Program Type
   ├── TAHFIZ
   ├── QURAN_READING
   └── CUSTOM
→ pilih/config metode yang relevan
```

Contoh:

```text
TAHFIZ
→ NgajiTrack Standard / Daarut / Sulaimaniyah / Custom

QURAN_READING
→ Iqra / Ummi / Qiroati / Tilawati / Yanbu'a / Custom
```

Nama metode Quran Reading hanya digunakan sebagai label/config lembaga. NgajiTrack tidak menyalin isi buku atau materi proprietary.

---

## 2.6 Fast after first activation

Setelah login/aktivasi pertama:

- session disimpan dengan aman;
- user tidak login ulang setiap membuka aplikasi;
- role/workspace terakhir diingat;
- app shell tampil cepat;
- data terbaru refresh di belakang.

---

# 3. Entry Screen

Saat membuka NgajiTrack pertama kali pada produk institution-first, tampilkan tiga jalur utama:

```text
[ Masuk ]
[ Aktivasi Akun ]
[ Daftarkan Lembaga ]
```

Penjelasan:

### Masuk
Untuk user yang sudah memiliki akun aktif.

### Aktivasi Akun
Untuk ustaz, santri, atau wali yang telah ditambahkan/diundang lembaga tetapi belum mengaktifkan login.

### Daftarkan Lembaga
Untuk pihak yang ingin membuat workspace lembaga baru. Tidak ada jalur Personal Mode pada MVP saat ini.

---

# 4. Institution Registration Flow

Flow:

```text
Daftarkan Lembaga
→ data lembaga
→ data admin pertama
→ verifikasi
→ institution workspace dibuat
→ onboarding checklist
```

Data minimum:

```text
Nama lembaga
Jenis lembaga
Alamat umum
Nomor kontak
Nama admin
Email/nomor HP admin
Password / secure auth
```

Jenis lembaga dapat mencakup:

```text
Pesantren
TPA/TPQ
Rumah Tahfiz
Sekolah/SDIT
Lembaga Qur'an
Lainnya
```

Status lembaga:

```text
DRAFT
PENDING_VERIFICATION
TRIAL
ACTIVE
SUSPENDED
ARCHIVED
```

---

# 5. First Admin Setup

Setelah lembaga dibuat, Admin Lembaga melihat onboarding checklist:

```text
1. Lengkapi profil lembaga
2. Buat program
3. Pilih jenis program
4. Pilih / susun metode atau config
5. Buat kelas/halaqah
6. Tambah ustaz
7. Import/tambah santri
8. Tempatkan santri ke kelas
9. Hubungkan wali
10. Review
11. Mulai
```

Checklist bersifat progress-based.

Admin dapat keluar dan melanjutkan nanti tanpa kehilangan state.

---

# 6. Program & Method Setup

Setelah program dibuat dan `program_type` dipilih, setup mengikuti tipe program.

### Program Type: TAHFIZ

Dapat menggunakan:

```text
NgajiTrack Standard
Daarut Reference
Sulaimaniyah Reference
Custom
```

### Program Type: QURAN_READING

Dapat menggunakan label/config:

```text
Iqra
Ummi
Qiroati
Tilawati
Yanbu'a
Custom
```

Untuk Quran Reading, admin mengatur struktur level/jilid dan page boundary sesuai buku/edisi yang benar-benar digunakan. Jumlah halaman tidak boleh diasumsikan universal.

Ada dua jalur setup.

## 6.1 Self-Service Setup

Admin dapat:

```text
Pilih program type
→ pilih preset/config awal
→ duplicate bila Tahfiz
→ atur stage Tahfiz ATAU level/jilid Quran Reading
→ atur target / page boundary
→ atur assessment
→ preview
→ publish
```

## 6.2 Assisted Setup

Jika lembaga tidak ingin repot:

```text
Request Assisted Setup
→ kirim SOP/foto buku monitoring/contoh laporan
→ tim NgajiTrack review
→ config dibuat
→ preview
→ revisi
→ approval
→ publish
```

Bahan yang dapat dikirim:

- foto buku monitoring;
- SOP;
- contoh rekap;
- istilah lembaga;
- aturan hafalan;
- struktur jilid/level dan halaman untuk Quran Reading bila relevan;
- aturan murajaah;
- aturan ujian;
- target;
- standar kelulusan;
- contoh alur santri.

**Rule:** Assisted Setup menghasilkan konfigurasi Learning/Method Engine, bukan custom code khusus satu lembaga sebagai jalur normal.

---

# 7. Program Creation

Lembaga dapat memiliki satu atau lebih program.

Contoh:

```text
Tahfiz Reguler
Tahfiz Intensif
Quran Reading / Iqra
Tahsin
Murajaah
Kelas Anak
```

Program menentukan:

- `program_type`;
- Tahfiz method config ATAU Quran Reading config;
- Quran reference/mushaf mapping bila tracking Tahfiz membutuhkannya;
- grading scheme;
- target default;
- visibility;
- aturan khusus program.

Built-in Mushaf reader bukan bagian onboarding MVP.

---

# 8. Class / Halaqah Creation

Admin Lembaga membuat kelas/halaqah yang selalu terhubung ke satu program aktif. Program tersebut menentukan UI dan logic operasional kelas.

Data:

```text
Nama kelas/halaqah
Program
Ustaz utama
Ustaz tambahan
Kapasitas
Jadwal opsional
Status
```

Contoh:

```text
Halaqah Umar
Kelas Tahfiz A
Kelompok Putra 1
```

Status:

```text
DRAFT
ACTIVE
INACTIVE
ARCHIVED
```

---

# 9. Teacher Onboarding

Ustaz tidak mendaftar bebas ke sebuah lembaga sebagai default.

Flow:

```text
Admin menambahkan ustaz
→ invitation dibuat
→ ustaz menerima link/kode
→ aktivasi akun
→ login di Flutter
→ assignment kelas muncul
```

Jika ustaz sudah memiliki akun NgajiTrack:

```text
invite
→ verified link
→ institution membership ditambahkan
```

Tidak perlu membuat akun baru.

---

# 10. Teacher Activation

Metode aktivasi dapat menggunakan:

- invitation link;
- activation code;
- verified email;
- verified phone.

Setelah aktivasi:

```text
Ustaz login
→ memilih role/workspace bila perlu
→ melihat "Kelas Saya"
```

Ustaz tidak perlu:

- membuat ulang profil lembaga;
- mencari kelas manual;
- memasukkan santri sendiri satu per satu.

---

# 11. Student Onboarding — Manual

Untuk lembaga kecil, admin dapat menambahkan santri satu per satu.

Field minimum:

```text
Nama santri
ID/NIS lembaga — opsional/tergantung lembaga
Tanggal lahir — bila diperlukan
Gender — bila digunakan
Program
Kelas
Baseline awal sesuai program — opsional saat onboarding
Nomor wali — opsional saat awal
NgajiTrack ID — opsional
```

NgajiTrack ID tidak wajib.

---

# 12. Student Onboarding — Bulk Import

Untuk lembaga besar:

```text
Download template
→ isi data
→ upload CSV/XLSX
→ validate
→ preview
→ matching
→ confirmation
→ create/link
```

Kolom contoh:

```text
Nama
NIS/ID lokal
NISN (opsional)
Tanggal lahir
Program
Kelas
Baseline awal sesuai program — opsional saat onboarding
Nomor wali
Email wali
NgajiTrack ID (opsional)
```

---

# 13. Bulk Import Result

Setelah upload:

```text
Total: 1.000 santri

720 siap dibuat
160 akun existing ditemukan
70 perlu verifikasi
30 data duplikat
20 data invalid
```

Admin tidak perlu membuka semua row satu per satu.

Admin hanya fokus pada:

- error;
- possible duplicate;
- verification needed.

---

# 14. Student Identity Matching

Matching kandidat dapat memakai:

- NgajiTrack ID;
- verified phone;
- verified email;
- NISN bila relevan;
- tanggal lahir;
- kombinasi data lain.

Tidak boleh:

```text
Nama sama
→ auto-link
```

Nama hanya salah satu sinyal.

---

# 15. Matching Result States

Gunakan status:

```text
NO_MATCH
POSSIBLE_MATCH
NEEDS_VERIFICATION
VERIFIED_LINK
```

### NO_MATCH
Buat identitas/profil baru.

### POSSIBLE_MATCH
Ada kandidat, tetapi belum cukup aman.

### NEEDS_VERIFICATION
Butuh konfirmasi user/wali/admin melalui flow aman.

### VERIFIED_LINK
Boleh dihubungkan ke global identity existing.

---

# 16. Student Account Activation

Data santri dapat dibuat sebelum santri memiliki akun login.

Flow:

```text
Student record exists
→ learning can be tracked
→ login activation later
```

Saat aktivasi:

```text
activation
→ auth profile dibuat/ditautkan
→ student identity terhubung
→ Flutter dashboard aktif
→ progress view mengikuti program
```

Ini penting untuk santri kecil yang belum menggunakan HP sendiri.

---

# 17. Guardian Onboarding

Wali dihubungkan ke santri oleh lembaga.

Flow:

```text
Admin tambah/link wali
→ invitation
→ wali aktivasi
→ child link terverifikasi
→ Flutter dashboard anak muncul
→ view mengikuti program anak
```

Wali tidak boleh bebas memasukkan nama anak lalu melihat data tanpa verification.

---

# 18. One Guardian, Multiple Children

Satu wali dapat memiliki banyak anak.

Contoh:

```text
Wali: Ahmad
├── Ali — Pesantren A
├── Aisyah — SDIT B
└── Hasan — Rumah Tahfiz C
```

Satu login cukup.

Dashboard dapat menyediakan switch child.

---

# 19. One User, Multiple Roles

Contoh:

```text
Akun Faris
├── Ustaz — Lembaga A
└── Wali — Lembaga B
```

Setelah login:

```text
Pilih workspace / role
```

atau buka role terakhir.

Gunakan:

```text
Switch Role
Switch Workspace
```

tanpa logout.

---

# 20. Class Assignment

Setelah santri dibuat/link:

```text
Admin
→ pilih kelas
→ bulk select santri
→ assign
```

Admin dapat memindahkan santri.

Perpindahan:

```text
membership lama closed
→ membership baru dibuat
```

Histori kelas tidak di-overwrite.

---

# 21. Teacher Permission in Class Structure

Default:

```text
Admin Lembaga = structural owner
Ustaz = operational user
```

Ustaz dapat:

- melihat santri yang ditugaskan;
- menjalankan sesi;
- input progres;
- mengatur urutan antrean;
- menandai santri bermasalah;
- mengusulkan pindah/tambah santri.

Ustaz tidak otomatis dapat:

- menghapus santri dari lembaga;
- memindahkan santri antar-kelas;
- mengubah program;
- mengubah struktur resmi.

---

# 22. Guardian Link Verification

Guardian linking dapat menggunakan:

- nomor HP terverifikasi;
- email;
- invitation code;
- QR invitation;
- admin-assisted verification.

Hubungan wali-santri memiliki status:

```text
PENDING
VERIFIED
REVOKED
```

---

# 22A. Optional Feature Setup During Onboarding

Beberapa fitur boleh dikonfigurasi saat onboarding tetapi **tidak boleh menghambat lembaga mulai operasional**.

### NgajiTrack Score

Untuk program Tahfiz yang mengaktifkannya:

```text
Enable Score?
→ choose approved formula version/default
→ configure visibility
→ save
```

Score bukan syarat minimal untuk kelas mulai.

### Calendar

Admin dapat menambahkan jadwal kelas/setoran/ujian, tetapi kalender juga bukan blocker onboarding.

### Poster Branding

Admin dapat menambahkan:

```text
logo lembaga
warna brand
template default
```

Poster final dibuat on-demand. Watermark resmi NgajiTrack tetap dipaksakan server-side dan tidak dapat dimatikan oleh lembaga.

---

# 23. Start-of-Learning Readiness Check

Sebelum lembaga mulai aktif:

```text
Program type valid? ✓
Tahfiz method / Quran Reading config active? ✓
Program active? ✓
Class active? ✓
Teacher assigned? ✓
Students assigned? ✓
Required baseline set? ✓
```

Jika semua selesai:

```text
[ Mulai Operasional ]
```

---

# 24. Student Transfer — Existing NgajiTrack Account

Scenario:

```text
Ahmad
Lembaga A → tamat
Lembaga B → masuk
```

Flow:

```text
Enrollment A closed
→ account Ahmad tetap
→ B import/add Ahmad
→ matching finds existing identity
→ verification
→ new enrollment B
→ baseline/placement
→ class assignment
```

Tidak membuat akun baru.

---

# 25. Transfer Data Isolation

Lembaga B tidak otomatis melihat:

- private teacher notes dari A;
- internal admin notes A;
- audit logs A;
- seluruh submission raw A.

Yang dapat dibagikan adalah portable summary sesuai permission/consent.

---

# 26. Portable Learning History

Dengan consent:

```text
Student/Wali allows sharing
→ summary generated
→ target institution sees approved scope
```

Untuk Tahfiz, summary dapat berisi:

- milestone;
- total hafalan;
- posisi terakhir;
- ujian yang lulus;
- periode belajar.

Untuk Quran Reading, portable summary dapat berkembang kemudian menjadi ringkasan level/jilid/halaman terakhir yang sudah diverifikasi. Ini tidak otomatis menjadi state aktif lembaga baru.

Tidak harus berisi:

- private teacher notes;
- internal disciplinary data;
- raw admin comments.

---

# 27. Placement / Baseline in New Institution

Lembaga B dapat:

```text
Accept portable baseline
OR
Do placement test
OR
Set new verified baseline
```

Karena standar metode/program dapat berbeda, portable history tidak otomatis menjadi active progress.

---

# 28. New Institution, New Method

Contoh:

```text
Lembaga A = Daarut-style
Lembaga B = Sulaimaniyah-style
```

Expected:

```text
History A tetap Daarut-style
B menggunakan method B
B menentukan baseline sendiri
```

Tidak boleh:

```text
Sabaq/Sabqi otomatis muncul di B
```

jika B tidak menggunakannya.

Contoh Quran Reading:

```text
Lembaga A = Iqra
Lembaga B = metode baca lain
```

History A tetap historis. B menetapkan config dan baseline sendiri sesuai buku/metode yang dipakai.

---

# 29. Fast Login Experience

Setelah aktivasi pertama:

```text
Flutter app open
→ secure session restored
→ last workspace loaded
→ cached shell shown
→ background refresh
```

User tidak diminta login setiap kali.

Target pengalaman:

```text
buka
→ langsung masuk
```

bukan:

```text
buka
→ loading panjang
→ login lagi
→ loading lagi
```

---

# 30. Persistent Session

Gunakan:

- refresh token aman;
- short-lived access token;
- secure local storage;
- secure cookie di web bila sesuai;
- auto refresh.

Logout terjadi ketika:

- user memilih logout;
- security policy memerlukan;
- session revoked;
- device change/high-risk event.

---

# 31. Optional Biometric / PIN Unlock

Untuk keamanan tambahan:

```text
App open
→ biometric/PIN
→ dashboard
```

Biometric/PIN adalah local unlock.

Bukan pengganti server auth.

---

# 32. Last Workspace Restore

Simpan:

- role terakhir;
- lembaga terakhir;
- kelas terakhir;
- program terakhir;
- child terakhir untuk wali;
- teaching session aktif.

Contoh:

```text
Ustaz sedang di Kelas Tahfiz A
→ app tertutup
→ app dibuka
→ kembali cepat ke Kelas Tahfiz A
```

---

# 33. Offline-Resilient Teacher Start

Jika ustaz sudah pernah membuka kelas sebelumnya:

client menyimpan cache minimum:

```text
class roster
program type
Tahfiz method config OR Quran Reading config
stage/level config
quick notes
grading scheme
last synced progress
```

Jika internet hilang setelah kelas dibuka:

```text
teacher can continue
```

---

# 34. Teacher Draft Autosave During Onboarding/Use

Saat menginput:

```text
+1
+½
+2
ULANG
assessment
quick note / issue tag
```

langsung:

```text
save local draft
```

Sebelum server confirmation.

Jika app tertutup:

```text
draft recoverable
```

---

# 35. Offline Confirmation

Jika internet hilang:

```text
Confirm
→ local finalize
→ queue
→ status "Menunggu sinkronisasi"
→ teacher continues
```

Saat internet kembali:

```text
auto retry
→ server validates
→ sync
```

---

# 36. Sync Status Copy

Gunakan bahasa sederhana:

```text
Draft
Tersimpan di perangkat
Menunggu sinkronisasi
Tersinkron
Perlu ditinjau
```

Jangan tampilkan istilah teknis seperti:

```text
HTTP 409
RLS error
transaction failed
```

ke user biasa.

---

# 37. Onboarding UI Principles

UI onboarding harus:

- clean;
- modern;
- sedikit teks;
- satu keputusan utama per langkah;
- progress jelas;
- mobile-friendly;
- tidak terasa seperti form pemerintah panjang;
- menyimpan draft otomatis.

Contoh:

```text
Langkah 4 dari 8
Tambah Ustaz
```

bukan satu halaman dengan 40 field.

---

# 38. Admin Onboarding Dashboard

Contoh:

```text
Setup NgajiTrack

✓ Profil lembaga
✓ Program
✓ Jenis Program
✓ Metode / Config
✓ Kelas
○ Ustaz
○ Santri
○ Wali
○ Review

75% selesai
```

---

# 39. Bulk Action UX

Admin harus dapat:

```text
Select all
Assign class
Assign program
Set baseline
Activate
Deactivate
Send invite
Resend invite
Export errors
```

Tidak perlu klik tiap santri.

---

# 40. Invitation States

Gunakan status:

```text
NOT_INVITED
INVITED
DELIVERED
ACTIVATED
EXPIRED
FAILED
```

Admin dapat resend.

---

# 41. Incomplete Onboarding

User boleh berhenti dan lanjut nanti.

State:

```text
ONBOARDING_IN_PROGRESS
```

Aplikasi menyimpan posisi terakhir.

---

# 42. Institution Activation Rule

Tidak semua setup harus 100% sempurna sebelum lembaga dapat pilot.

Minimum:

```text
Institution verified
Admin active
At least 1 program
Program type valid
Relevant method/config active
At least 1 class
At least 1 teacher
At least 1 student
```

---

# 43. Duplicate Prevention

Bulk import harus mendeteksi:

- same local ID;
- same NgajiTrack ID;
- same verified contact;
- possible duplicate identity.

Jangan membuat duplicate hanya karena user menekan import dua kali.

Gunakan idempotent import processing.

---

# 44. Audit Requirements

Audit minimal untuk:

- identity link;
- identity unlink;
- class move;
- role change;
- guardian link;
- portable history share;
- baseline approval;
- institution activation;
- program type/config publication;
- baseline approval;
- sensitive identity/history linking.

---

# 45. Security Boundaries

Admin Lembaga A tidak boleh:

- melihat roster Lembaga B;
- mencari private data global sembarangan;
- membaca full history lembaga lama tanpa consent;
- bypass verification.

Teacher hanya melihat assigned scope dan config program yang relevan.

Guardian hanya melihat linked children.

Student hanya melihat own scope.

---

# 46. Privacy During Matching

Saat kandidat akun existing ditemukan, lembaga tidak perlu melihat informasi sensitif lengkap.

Contoh UI:

```text
Kemungkinan akun existing ditemukan.
Verifikasi diperlukan.
```

Bukan:

```text
Ini seluruh histori pengguna tersebut.
```

---

# 47. Assisted Setup Onboarding SLA State

Jika feature dibuat:

```text
SUBMITTED
IN_REVIEW
NEEDS_INFO
CONFIGURING
WAITING_APPROVAL
APPROVED
PUBLISHED
```

Admin dapat melihat status tanpa bertanya ke support setiap saat.

---

# 48. Failure Recovery

Jika bulk import gagal:

- job tidak langsung dihapus;
- row error tetap terlihat;
- admin dapat download error report;
- proses dapat diulang secara aman.

Jika activation link expired:

```text
Resend invitation
```

Jika verification gagal:

```text
retry / alternate verification
```

---

# 49. Onboarding Analytics

Metric penting:

```text
institution signup completion rate
time to first active class
teacher activation rate
student activation rate
guardian activation rate
bulk import error rate
identity-link verification rate
time from registration to first submission
program setup completion rate
Quran Reading setup error rate
```

Tujuan analytics adalah menemukan friction.

---

# 50. Onboarding Success Definition

Sebuah lembaga dianggap onboarded jika:

```text
admin aktif
program aktif
program type valid
relevant method/config aktif
class aktif
teacher assigned
students assigned
minimum account links ready
first teaching session can start
```

---

# 51. End-to-End Scenario — New Institution

```text
Register
→ verify admin
→ create institution
→ create program
→ choose program type
→ choose preset/config
→ create class
→ invite teacher
→ import 500 students
→ resolve 20 duplicates
→ link 60 existing accounts
→ assign all to classes
→ invite guardians
→ start teaching
```

---

# 52. End-to-End Scenario — Small Institution

```text
Register
→ choose NgajiTrack preset
→ create one class
→ add one teacher
→ add 20 students manually
→ link 20 guardians
→ start
```

---

# 52A. End-to-End Scenario — Quran Reading Institution

```text
Register
→ create Program "Iqra Dasar"
→ choose QURAN_READING
→ choose label Iqra
→ configure Jilid 1–6
→ configure page boundaries
→ create class
→ invite teacher
→ add/import students
→ set baseline jilid/page if needed
→ teacher opens Flutter class
→ quick input +1 / +2 / ULANG
→ student/wali see updated level/page
```

NgajiTrack tidak memerlukan isi buku Iqra untuk menjalankan flow ini.

---

# 53. End-to-End Scenario — Transfer Student

```text
Student finishes Institution A
→ history archived/read-only
→ Institution B imports student
→ existing account candidate found
→ verification
→ new enrollment
→ portable summary optional
→ placement test
→ baseline B
→ class assignment
→ learning begins
```

---

# 54. End-to-End Scenario — Multi-Role User

```text
Faris logs in
→ last workspace = Ustaz / Institution A
→ opens class
→ later switches role
→ Wali / Institution B
→ sees child dashboard
```

Tidak logout.

---

# 55. End-to-End Scenario — Offline Teaching

```text
Teacher opens class online
→ cache ready
→ input Student 1
→ internet drops
→ draft local
→ confirm
→ pending sync
→ Student 2
→ Student 3
→ internet returns
→ background sync
→ no duplicate
→ admin/student/guardian receive updated state
```

---

# 56. Astra Implementation Rules

Astra harus memastikan onboarding tidak hanya terlihat bagus.

Setiap flow harus diuji hingga backend dan role terkait.

Astra wajib:

1. inspect schema;
2. preserve tenant isolation;
3. use existing identity model;
4. use idempotent batch processing;
5. build verification state;
6. build resumable onboarding;
7. test bulk import;
8. test duplicate handling;
9. test multi-role switching;
10. test persistent session;
11. test transfer scenario;
12. test offline teacher flow;
13. test cross-account visibility;
14. test failure states;
15. test responsive Admin Web;
16. test Flutter role/workspace restore;
17. test program-aware teacher UI;
18. test Quran Reading onboarding + baseline;
19. test Quran Reading quick input after onboarding.

Astra tidak boleh:

- membuat akun baru setiap institution import;
- link hanya berdasarkan nama;
- menyimpan role hanya di client;
- bypass verification;
- overwrite enrollment lama;
- memindahkan histori lintas tenant;
- membuat class ownership ambigu;
- memaksa full reload/login setiap app open;
- hard-code jumlah halaman Iqra/metode tertentu sebagai universal;
- membuat Personal Mode dari flow onboarding MVP;
- membuat built-in Mushaf reader sebagai syarat onboarding.

---

# 57. MVP Priority

Untuk MVP, prioritas onboarding:

```text
Institution registration
Admin activation
Program type setup
Tahfiz method / Quran Reading config
Program/class creation
Teacher invite
Student bulk import
Student manual add
Class assignment
Guardian link
Existing account linking
Persistent login
Transfer-safe enrollment model
Offline-resilient teacher input
```

Portable Learning History dapat dimulai dari summary Tahfiz sederhana sebelum berkembang ke domain lain.

---

# 57A. Explicit Deferred Onboarding Scope

MVP **tidak** menyediakan onboarding untuk:

```text
Personal Mode
personal Google Drive backup
personal memory map
personal streak
built-in Mushaf reader
mushaf reader preferences
```

Jika fitur tersebut dibuat nanti, onboarding baru ditambahkan melalui update aplikasi tanpa mengubah institution onboarding core.

---

# 58. Final Onboarding Principle

NgajiTrack harus membuat lembaga merasa:

> **“data kami banyak, tapi setup-nya tidak ribet.”**

Ustaz merasa:

> **“saya buka aplikasi, pilih kelas, dan UI-nya langsung sesuai cara mengajar kelas itu.”**

Santri merasa:

> **“akun saya tetap walaupun pindah lembaga.”**

Wali merasa:

> **“saya langsung melihat anak saya tanpa bingung.”**

Dan dari sisi sistem:

```text
satu identity
→ banyak context
→ role + program menentukan pengalaman
→ data tetap terisolasi
→ histori tetap utuh
→ onboarding bisa massal
→ login cepat
→ input tetap aman
```
---

# REVISION v1.2 — Onboarding Scope Lock

Jika ada bagian lama yang bertentangan dengan bagian ini, **REVISION v1.2 menjadi acuan terbaru**.

## A. Client Strategy

```text
Super Admin / Admin Lembaga
→ Admin Web

Ustaz / Santri / Wali
→ Flutter App
```

Field users tidak dipaksa memakai PWA pada MVP utama.

---

## B. Correct Setup Order

Urutan onboarding yang benar:

```text
Institution
→ Admin
→ Program
→ Program Type
→ Relevant Config
→ Class
→ Teacher
→ Students
→ Baseline
→ Guardians
→ Readiness Check
→ Start
```

Jangan memilih Tahfiz Method terlebih dahulu sebelum program type diketahui.

---

## C. Program Type Rules

```text
TAHFIZ
→ method_config

QURAN_READING
→ reading_method_config + levels/pages

CUSTOM
→ only supported configurable capabilities
```

Teacher UI diturunkan dari program yang sedang dibuka.

---

## D. Quran Reading Setup Rules

Admin mengatur:

```text
method label
level/jilid
level order
page_start
page_end
assessment
quick notes / issue tags
```

Tidak ada jumlah halaman universal.

Tidak ada kewajiban menyimpan isi buku.

Baseline Quran Reading dapat berupa:

```text
method config
level/jilid
current page
verification source
```

---

## E. Optional, Not Blocking

Fitur berikut bukan syarat operasional awal:

```text
NgajiTrack Score
Calendar
Poster Branding
Advanced Reports
Portable History Full Detail
```

Lembaga tetap dapat mulai mengajar setelah kebutuhan minimum terpenuhi.

---

## F. Required Minimum Readiness

```text
institution verified
admin active
program active
program_type valid
relevant config ACTIVE
class active
teacher assigned
at least one student assigned
required baseline valid
```

---

## G. Deferred Scope

Tidak ada onboarding Personal Mode atau built-in Mushaf reader pada MVP.

---

## H. Final Onboarding Rule

> **Onboarding harus membawa lembaga secepat mungkin dari “baru daftar” menjadi “kelas pertama bisa berjalan”, tanpa mengorbankan keamanan, histori, atau fleksibilitas program.**
