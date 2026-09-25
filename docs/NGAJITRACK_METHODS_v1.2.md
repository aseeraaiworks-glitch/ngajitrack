# NgajiTrack — Learning Methods Specification

**Document:** `METHODS.md`  
**Product:** NgajiTrack  
**Parent Brand:** Aseera  
**Status:** Draft v1.2 — Multi-Program Learning Engine + Quran Reading + Offline-Resilient Teaching  
**Depends on:** `PRODUCT_SPEC.md`, `ARCHITECTURE.md`, `DATABASE.md`  
**Purpose:** Menjadi acuan logika metode pembelajaran NgajiTrack agar program Tahfiz dan Quran Reading, preset bawaan, metode Daarut Tahfiz Al Ikhlas, metode Sulaimaniyah, konfigurasi Iqra/metode baca sejenis, metode custom lembaga, Assisted Setup, perpindahan santri antar-lembaga, dan input ustaz yang tahan gangguan internet dapat berjalan konsisten di backend, Admin Web, dan Flutter.

---

# 1. Tujuan Dokumen

Dokumen ini menjelaskan:

1. struktur **Program-Aware Learning Engine** dan **Tahfiz Method Engine**;
2. preset utama NgajiTrack;
3. mapping metode Daarut Tahfiz Al Ikhlas;
4. mapping metode Sulaimaniyah;
5. aturan progres;
6. aturan transisi tahap;
7. cara sistem memberi rekomendasi target;
8. cara ustaz melakukan input cepat;
9. cara santri/wali melihat progres;
10. batas apa yang boleh diubah lembaga;
11. validasi dan edge case;
12. test case yang wajib sebelum MVP;
13. struktur Quran Reading/Iqra-style;
14. quick input halaman untuk kelas baca Al-Qur'an;
15. hubungan metode dengan NgajiTrack Score, kalender, dan poster tanpa menjadikannya source-of-truth baru.

Prinsip utama:

> **Program dan metode lembaga boleh berbeda, tetapi source-of-truth, keamanan, dan logika inti NgajiTrack harus tetap konsisten.**

---

# 2. Prinsip Dasar Learning / Method Engine

NgajiTrack tidak boleh memiliki logika seperti:

```text
if institution == "Daarut Tahfiz":
    ...
```

atau:

```text
if institution == "Sulaimaniyah":
    ...
```

Yang benar untuk Tahfiz:

```text
Method Preset
    ↓
Method Config milik lembaga
    ↓
Stage
    ↓
Rule
    ↓
Progress Unit
    ↓
Student Progress State
```

Untuk Quran Reading:

```text
Program Type
    ↓
Reading Method Config
    ↓
Level / Jilid
    ↓
Page Boundary
    ↓
Assessment / Issue Tag
    ↓
Student Progress State
```

Nama lembaga atau nama metode tidak menentukan logic dengan `if institution == X`.

---

# 2A. Program Types

Fondasi MVP mengenali minimal:

```text
TAHFIZ
QURAN_READING
CUSTOM
```

`program_type` menentukan keluarga engine dan UI operasional, bukan role pengguna.

Contoh:

```text
TEACHER + TAHFIZ
→ Tahfiz quick input

TEACHER + QURAN_READING
→ level/page quick input
```

Satu ustaz dapat mengajar kedua jenis program pada kelas berbeda tanpa membuat akun baru.

---

# 3. Struktur Umum Metode

Setiap metode terdiri dari:

```text
METHOD
│
├── STAGE
│   ├── type
│   ├── display name
│   ├── order
│   ├── unit
│   └── enabled
│
├── RULES
│   ├── progression
│   ├── review
│   ├── target
│   ├── boundary
│   └── transition
│
├── ASSESSMENT
│
└── CURRENT STATE
```

---

# 4. Stage Type Internal

Stage type internal Tahfiz harus stabil dan tidak berubah karena rename lembaga. Quran Reading tidak wajib memakai stage Tahfiz; normalnya menggunakan level/jilid + current page.

Minimum type:

```text
NEW_MEMORIZATION
RECENT_REVIEW
LONG_TERM_REVIEW
EXAM
FINAL_PREPARATION
COMPLETION
CYCLE
REVIEW
```

Future:

```text
TAHSIN
ATTENDANCE
CUSTOM_TRACK
```

---

# 5. Display Name vs Internal Type

Contoh:

```text
Internal:
NEW_MEMORIZATION

NgajiTrack default:
Hafalan Baru

Daarut:
Sabaq

Lembaga lain:
Setoran Baru
```

Backend bekerja berdasarkan `NEW_MEMORIZATION`.

User melihat label sesuai lembaganya.

---

# 6. Progress Units

Method Engine minimum mendukung:

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

Sistem harus memvalidasi unit terhadap rule stage/config. Untuk Quran Reading, unit utama MVP adalah `PAGE` di dalam level/jilid yang dikonfigurasi.

---

# 6A. Quran Reading / Iqra-Style Model

Program `QURAN_READING` dirancang untuk pembelajaran baca Al-Qur'an seperti Iqra dan metode sejenis.

Pilihan label awal yang dapat didukung:

```text
Iqra
Ummi
Qiroati
Tilawati
Yanbu'a
Custom
```

Nama tersebut adalah **label metode yang digunakan lembaga**, bukan klaim bahwa NgajiTrack terafiliasi atau terintegrasi resmi dengan pemilik metode.

MVP tidak menyalin:

- isi buku;
- teks latihan;
- ilustrasi;
- scan halaman;
- desain/layout proprietary;
- kurikulum proprietary yang tidak memiliki izin.

NgajiTrack hanya mencatat progres administratif.

Struktur minimum:

```text
Reading Method Config
  ├── Level/Jilid 1
  │     ├── page_start
  │     └── page_end
  ├── Level/Jilid 2
  └── ...
```

Jumlah halaman **tidak boleh di-hard-code universal** karena dapat berbeda menurut metode/edisi.

### Current State

Contoh:

```json
{
  "type": "READING_LEVEL_PAGE",
  "level_code": "IQRA_3",
  "current_page": 22,
  "last_completed_page": 21,
  "last_result": "LANCAR"
}
```

### Quick Input

Target input normal tetap **2–5 detik per santri**.

```text
Aisyah
Iqra 3 — mulai Hal. 18

[ +1 ] [ +2 ] [ ULANG ] [ DETAIL ]
```

Tombol dapat diakumulasi seperti kalkulator:

```text
+2
+2
= +4 halaman
```

Contoh:

```text
Mulai: Hal. 18
Selesai: Hal. 21
Posisi berikutnya: Hal. 22
```

`ULANG` berarti submission/aktivitas tetap disimpan, tetapi current page tidak maju.

### Detail / Issue Tags

`DETAIL` hanya dibuka jika perlu.

Quick issue tags awal dapat meliputi:

```text
Kelancaran
Makhraj
Panjang-pendek
Huruf tertukar
Lainnya
```

Mengetik kata/bacaan spesifik yang bermasalah bersifat opsional.

Prinsip:

> **Kasus normal cukup tap. Detail hanya untuk pengecualian.**

---

# 7. NgajiTrack Standard Preset

Preset utama NgajiTrack menggunakan nama netral:

1. **Hafalan Baru**
2. **Penguatan**
3. **Murajaah Berkala**
4. **Ujian Tahfiz**
5. **Pemantapan Akhir**
6. **Khatam / Final Tahfiz**

Mapping internal:

```text
Hafalan Baru
→ NEW_MEMORIZATION

Penguatan
→ RECENT_REVIEW

Murajaah Berkala
→ LONG_TERM_REVIEW

Ujian Tahfiz
→ EXAM

Pemantapan Akhir
→ FINAL_PREPARATION

Khatam / Final Tahfiz
→ COMPLETION
```

---

# 8. Filosofi Preset NgajiTrack

Preset utama harus:

- mudah dipahami lembaga baru;
- tidak terlalu identik dengan satu pesantren;
- dapat di-rename;
- dapat diaktif/nonaktif;
- mendukung perubahan target;
- tetap memiliki struktur data konsisten.

Lembaga tidak harus memakai semua tahap.

Contoh:

```text
Hafalan Baru      ON
Penguatan         ON
Murajaah Berkala  ON
Ujian Tahfiz      ON
Pemantapan Akhir  OFF
Final Tahfiz      ON
```

---

# 9. Allowed Institution Customization

Lembaga boleh mengubah:

Untuk Tahfiz:

```text
display_name
stage_order
stage_enabled
progress_unit
default_target
assessment_scheme
quick_notes
visibility
transition_rule tertentu
review_window
exam_block
```

Untuk Quran Reading:

```text
method_label
level/jilid names
level order
page_start
page_end
assessment scheme
quick notes
issue tags
visibility
```

Perubahan boundary level yang sudah memiliki progres aktif harus melalui validasi/versioning.

Lembaga tidak boleh mengubah:

```text
tenant security
audit
ownership model
core identity
backend authorization
historical integrity
```

---

# 10. Per-Student Override

Target tertentu dapat berbeda per santri.

Contoh:

```text
Santri A:
Murajaah Berkala = 1 juz/hari

Santri B:
Murajaah Berkala = 2 juz/hari

Santri C:
Murajaah Berkala = 3 juz/hari
```

Override disimpan di `student_stage_settings`.

---

# 11. Metode Referensi: Daarut Tahfiz Al Ikhlas

Metode ini memiliki lima komponen utama:

1. Sabaq
2. Sabqi
3. Manzil
4. Mukammal
5. Syahadah, dengan fase pemantapan sebelum Syahadah

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

---

# 12. Sabaq — Definisi

Sabaq adalah:

> setoran hafalan baru.

Karakter utama:

- berbasis halaman;
- progres linear;
- posisi terakhir disimpan;
- target berikutnya dapat direkomendasikan otomatis;
- ustaz idealnya tidak perlu memilih ulang halaman dari nol.

---

# 13. Sabaq — State

Contoh state:

```json
{
  "type": "PAGE_PROGRESS",
  "juz": 8,
  "page_in_juz": 13,
  "mushaf_id": "..."
}
```

---

# 14. Sabaq — Smart Recommendation

Input:

```text
current progress:
Juz 8
Page 13
```

Output:

```text
recommendation:
Juz 8
Page 14
```

Jika target normal lembaga 1 halaman:

```text
suggested quantity:
1 PAGE
```

---

# 15. Sabaq — Quick Input

UI ustaz:

```text
Ahmad
Juz 8
Terakhir: 13/20

[ +½ ] [ +1 ] [ +2 ] [ Lainnya ]
```

Tap boleh berulang:

```text
+1
+1
= +2
```

Draft:

```text
Awal: 13/20
Tambahan: +2
Hasil: 15/20
```

---

# 16. Sabaq — Boundary

Jika:

```text
18/20
+1
+1
```

hasil:

```text
20/20
```

Tap lagi tidak langsung lanjut otomatis.

Return:

```text
JUZ_COMPLETED
REQUIRES_NEXT_JUZ_CONFIRMATION
```

UI:

> Juz selesai. Lanjut ke juz berikutnya?

---

# 17. Sabaq — Ulang

`Ulang` bukan quantity.

Jika santri tidak menambah hafalan baru:

```text
quantity = 0
result = ULANG
```

Progress state tidak maju.

Submission tetap tersimpan sebagai aktivitas.

---

# 18. Sabaq — Half Page

Contoh:

```text
current = page 8.0
+0.5
```

Sistem perlu menyimpan posisi presisi.

Rekomendasi implementasi:

- quantity = 0.50 PAGE;
- position detail dapat memiliki fraction.

Contoh:

```json
{
  "juz": 7,
  "page_in_juz": 8,
  "fraction": 0.5
}
```

Atau normalized page offset internal.

Implementasi final harus konsisten di seluruh sistem.

---

# 19. Sabqi — Definisi

Sabqi adalah:

> murajaah hafalan baru sekitar 10 lembar ke belakang dari hafalan terbaru.

Nilai 10 lembar adalah referensi metode Daarut.

Di NgajiTrack:

```text
review_window = configurable
```

---

# 20. Sabqi — Rule

Contoh rule:

```json
{
  "window": 10,
  "unit": "SHEET",
  "direction": "BACKWARD",
  "anchor": "LATEST_NEW_MEMORIZATION"
}
```

---

# 21. Sabqi — Anchor

Anchor utama:

```text
latest NEW_MEMORIZATION progress
```

Sabqi tidak bergerak independen tanpa hubungan dengan hafalan baru.

Contoh:

```text
Sabaq terbaru:
Juz 8, page 14
```

Sistem menghitung range review ke belakang.

---

# 22. Sabqi — Cross-Juz

Jika jendela review melewati batas juz:

behavior harus configurable.

Contoh:

```json
{
  "cross_juz": true
}
```

Jika `true`:

range terus mundur ke juz sebelumnya.

Jika `false`:

range berhenti di awal juz.

MVP harus menunggu validasi detail lembaga untuk default final.

---

# 23. Sabqi — UI Ustaz

Jangan minta ustaz menghitung range manual.

UI:

```text
Penguatan Hari Ini

Juz 8 Page 14
← 10 lembar ke belakang

[ Lancar ] [ Cukup ] [ Ulang ]
```

Detail range dapat dibuka jika diperlukan.

---

# 24. Sabqi — Progress

Sabqi bukan progres hafalan baru.

Jangan mengubah state Sabaq ketika Sabqi selesai.

Sabqi memiliki state aktivitas/review sendiri.

---

# 25. Manzil — Definisi

Manzil adalah:

> murajaah hafalan lama secara berurutan dengan target harian berdasarkan kemampuan/jumlah hafalan santri.

Target dapat:

```text
1 juz
1.5 juz
2 juz
3 juz
```

atau nilai lain sesuai lembaga.

---

# 26. Manzil — Student-Level Target

Contoh:

```json
{
  "daily_target": 2,
  "unit": "JUZ",
  "rotation": "SEQUENTIAL"
}
```

Target disimpan per santri bila berbeda.

---

# 27. Manzil — Rotation

State:

```json
{
  "type": "ROTATION",
  "next_juz": 5,
  "daily_target": 2,
  "unit": "JUZ"
}
```

Sistem merekomendasikan:

```text
Hari ini:
Juz 5–6
```

Jika selesai:

```text
next_juz = 7
```

---

# 28. Manzil — Wrap Around

Jika santri memiliki hafalan sampai juz tertentu:

contoh:

```text
hafalan tersedia = Juz 1–10
current rotation = Juz 9
target = 2 juz
```

Target:

```text
Juz 9–10
```

Hari berikutnya:

```text
Juz 1–2
```

Wrap-around harus mengikuti batas hafalan yang memang sudah dimiliki santri.

---

# 29. Manzil — Partial Completion

Jika target:

```text
2 juz
```

tetapi santri hanya selesai:

```text
1.5 juz
```

Submission menyimpan actual quantity.

Policy next target dapat:

```text
CONTINUE_REMAINING
```

atau:

```text
ADVANCE_NEXT_DAY
```

Default harus configurable.

---

# 30. Mukammal — Definisi

Mukammal adalah:

> ujian hafalan yang disimak serius oleh ustaz/penguji.

Jenis referensi:

- 1 juz penuh;
- blok 5 juz.

---

# 31. Mukammal — One Juz Exam

Contoh:

```text
Mukammal Juz 8

Range:
Juz 8

Examiner:
Ustaz X

Result:
Lulus / Ulang
```

---

# 32. Mukammal — 5 Juz Milestone

Contoh blok:

```text
1–5
6–10
11–15
16–20
21–25
26–30
```

Rule harus configurable.

Jangan hard-code semua lembaga pasti sama.

---

# 33. Mukammal — Eligibility

Contoh rule:

```json
{
  "exam_type": "FIVE_JUZ",
  "requires_completed_range": true,
  "block_size": 5
}
```

Sistem dapat menandai santri:

```text
Eligible for exam
```

tetapi tidak otomatis menyatakan lulus.

---

# 34. Mukammal — Result

Minimum:

```text
PASS
REPEAT
INCOMPLETE
```

Optional:

```text
score
mistake_count
notes
```

---

# 35. Persiapan Syahadah — Definisi

Fase ini adalah:

> pemantapan besar sebelum ujian/khataman akhir.

Contoh peningkatan target dari pengalaman referensi:

```text
1.5 juz
2 juz
3 juz
5 juz
10 juz
15 juz
```

Urutan ini **tidak boleh di-hard-code** sebagai hukum universal.

---

# 36. Persiapan Syahadah — Levels

Representasi generic:

```text
LEVEL 1
LEVEL 2
LEVEL 3
...
READY
```

Setiap level memiliki:

```text
target_quantity
unit
pass_rule
```

Contoh:

```json
{
  "level": 3,
  "target_quantity": 3,
  "unit": "JUZ"
}
```

---

# 37. Persiapan Syahadah — Transition

Contoh:

```text
Level 1
→ lulus beberapa kali / sesuai policy
→ Level 2
```

Transition rule harus configurable.

Tidak boleh otomatis naik hanya karena satu submission jika lembaga tidak menginginkan.

---

# 38. Syahadah — Definisi

Syahadah adalah:

> tahap akhir/khataman besar, membaca hafalan 1–30 juz di depan guru/penguji dan dapat disaksikan orang ramai.

Untuk MVP:

- record milestone;
- date;
- examiner;
- result;
- notes;
- completion state.

Sertifikat otomatis belum wajib.

---

# 39. Metode Referensi: Sulaimaniyah

Konsep utama:

> hafalan dilakukan melalui sistem putaran halaman dari belakang setiap juz.

Contoh konseptual:

```text
Putaran 1:
halaman terakhir setiap juz
Juz 1 → Juz 30

Putaran 2:
halaman sebelumnya
Juz 1 → Juz 30

Putaran 3:
halaman sebelumnya lagi
...
```

---

# 40. Sulaimaniyah — State Model

Minimum:

```json
{
  "type": "CYCLE",
  "cycle": 1,
  "page_in_juz": 20,
  "current_juz": 1,
  "completed_juz_in_cycle": []
}
```

---

# 41. Sulaimaniyah — Progression

Contoh:

```text
Cycle page 20

Juz 1 selesai
→ Juz 2
→ Juz 3
...
→ Juz 30
```

Setelah Juz 30:

```text
cycle complete
```

Kemudian:

```text
page_in_juz 20
→ page_in_juz 19
```

---

# 42. Sulaimaniyah — Cycle Number

`cycle` dan `page_in_juz` tidak selalu harus dianggap identik.

Contoh:

```text
Cycle 1 = page 20
Cycle 2 = page 19
```

Tetapi sistem sebaiknya menyimpan keduanya agar lebih jelas.

---

# 43. Sulaimaniyah — Config

Contoh rule:

```json
{
  "juz_order": "ASC",
  "page_direction": "DESC",
  "start_page_in_juz": 20,
  "end_page_in_juz": 1
}
```

Jika mushaf berbeda:

```text
start_page_in_juz
```

harus mengikuti config mushaf/lembaga.

---

# 44. Sulaimaniyah — UI Ustaz

Contoh:

```text
Ahmad

Putaran 4
Halaman: 17
Juz aktif: 12

[ Selesai Juz 12 ]
[ Sebagian ]
[ Ulang ]
```

Setelah selesai:

```text
Next:
Juz 13
```

---

# 45. Sulaimaniyah — Cycle Completion

Ketika:

```text
current_juz = 30
result = complete
```

engine:

1. tandai cycle selesai;
2. pindah ke page berikutnya sesuai direction;
3. reset current_juz;
4. clear completed_juz_in_cycle;
5. tulis audit/history;
6. update current state.

---

# 46. Sulaimaniyah — Page Boundary

Jika page terakhir yang harus dipelajari telah selesai:

```text
method completion candidate
```

Sistem tidak langsung menyatakan selesai seluruh program jika ada stage ujian/review lain.

Transition mengikuti config method.

---

# 47. NgajiTrack Standard vs Reference Preset

NgajiTrack Standard:

```text
netral
mudah dipahami
default untuk lembaga baru
```

Daarut Reference:

```text
mencontoh logika nyata Daarut Tahfiz
```

Sulaimaniyah Reference:

```text
mencontoh logika putaran
```

Semua menggunakan engine yang sama.

---

# 48. Custom Method Strategy

MVP tidak menyediakan “buat metode bebas tanpa batas”.

Ada dua jalur konfigurasi:

### 48.1 Self-Service

Admin Lembaga:

1. pilih preset terdekat;
2. duplicate;
3. rename stage;
4. enable/disable stage;
5. atur target;
6. atur review window;
7. atur assessment;
8. atur transition yang didukung engine;
9. preview;
10. publish.

### 48.2 Assisted Setup

Jika lembaga tidak ingin menyusun sendiri, lembaga dapat meminta tim NgajiTrack membantu.

Bahan yang dapat dikirim:

- foto buku monitoring;
- SOP tahfiz;
- contoh laporan;
- istilah internal;
- target hafalan;
- sistem murajaah;
- aturan ujian;
- aturan naik tahap;
- standar penilaian;
- contoh alur santri nyata.

Flow:

```text
Lembaga kirim sistem
→ Tim NgajiTrack analisis
→ Konfigurasi dibuat di Method Engine
→ Preview
→ Revisi
→ Approval
→ Publish
```

### Rule Assisted Setup

Assisted Setup **bukan** custom coding per lembaga.

Jika kebutuhan suatu lembaga tidak dapat direpresentasikan:

```text
Need baru
→ evaluasi sebagai capability reusable
→ bila layak, capability ditambahkan ke core Method Engine
→ baru digunakan oleh lembaga
```

Hindari:

```text
if institution == "X"
```

atau script arbitrary milik satu tenant.

---

# 49. Method Copy Behavior

Saat lembaga memilih preset:

```text
Preset
→ copy to method_config
→ copy stages
→ copy rules
```

Setelah itu:

perubahan lembaga tidak mengubah preset global.

---

# 50. Preset Versioning

Preset dapat memiliki:

```text
version 1
version 2
```

Lembaga yang sudah menggunakan v1 tidak otomatis dipaksa pindah v2.

Upgrade harus explicit.

---

# 51. Historical Integrity

Submission Tahfiz menyimpan:

```text
method_config_id
stage_id
```

Submission Quran Reading menyimpan:

```text
reading_method_config_id
level/position reference
```

Semua submission juga menyimpan `program_id` agar konteks historis tetap jelas.

Jika lembaga rename stage kemudian:

history tetap dapat ditafsirkan dengan benar.

---

# 52. Student Enrollment Method

Config/metode aktif selalu mengikuti **enrollment/program pada lembaga saat ini**, bukan akun global santri.

Saat santri masuk program:

```text
institution enrollment
→ program enrollment
→ method_config
→ baseline
→ initial progress state
```

Jika santri pindah lembaga:

```text
Method Lembaga A → tetap melekat pada histori A
Method Lembaga B → menjadi method aktif baru
```

Jangan:

- memindahkan histori A menjadi histori B;
- mengubah `institution_id` pada submission lama;
- memaksa Lembaga B memakai metode Lembaga A.

Jika program di lembaga yang sama mengganti method, gunakan migration/transition process dan pertahankan history lama.

---

# 53. Initial State

Contoh Tahfiz new memorization:

```json
{
  "juz": 1,
  "page_in_juz": 0
}
```

Contoh Quran Reading:

```json
{
  "level_code": "IQRA_1",
  "current_page": 1
}
```

Initial position dapat berasal dari:

```text
NEW_BEGINNER
ADMIN_BASELINE
PORTABLE_HISTORY
PLACEMENT_TEST
MIGRATED_DATA
```

Initial state harus memiliki sumber yang dapat diaudit.

---

# 54. Existing Student Onboarding

Santri lama tidak harus mulai dari nol, baik pada Tahfiz maupun Quran Reading.

Admin dapat mengisi contoh:

```text
Current memorization:
Juz 8 page 13

Manzil position:
Juz 5

Exam milestone:
1–5
```

Namun untuk santri yang berasal dari lembaga lain, data lama **tidak otomatis menjadi state aktif**.

Flow yang benar:

```text
Portable summary / data admin
→ review
→ placement/baseline decision
→ initial state Lembaga B
```

Lembaga baru dapat memilih melakukan placement test karena standar kelancaran/metode dapat berbeda.

---

# 55. Baseline Record

Baseline harus menjelaskan:

```text
source_type
source_reference
verified_by
verified_at
method_config_id
resulting_initial_state
```

Simpan event:

```text
INITIAL_STATE
```

agar history menjelaskan mengapa current state dimulai dari posisi tertentu.

### 55.1 Portable History Is Not Active Method State

Riwayat tahfiz portable adalah **referensi**, bukan progress state aktif secara otomatis.

Contoh:

```text
Portable summary:
hafal sampai Juz 10 di Lembaga A

Lembaga B:
placement test → baseline diset Juz 8
```

Kedua informasi tetap dapat hidup tanpa saling menimpa.

---

# 56. Smart Recommendation Engine

Input:

```text
student state
program type
relevant method/stage or reading config
mushaf (Tahfiz bila relevan)
level/page boundary (Quran Reading bila relevan)
recent history
```

Output:

```text
recommended target
recommended quantity
warnings
```

Engine tidak melakukan save.

---

# 57. Recommendation Example — Hafalan Baru

```text
Current:
Juz 7 / Page 8

Output:
Juz 7 / Page 9
Suggested:
+1 PAGE
```

---

# 58. Recommendation Example — Manzil

```text
Current rotation:
next_juz = 5

Daily target:
2 JUZ

Output:
Juz 5–6
```

---

# 59. Recommendation Example — Sulaimaniyah

```text
Cycle:
page 17

Current juz:
12

Output:
Juz 13 / page 17
```

---

# 59A. Recommendation Example — Quran Reading

```text
Current:
Iqra 3 / Page 22

Config:
level_end = 32

Output:
Start from Page 22
Quick actions: +1 / +2 / ULANG / DETAIL
```

Recommendation tidak menentukan bahwa santri "pasti harus naik". Hasil listening/assessment ustaz tetap menentukan apakah current page maju atau diulang.

---

# 60. Recommendation Must Be Confirmable

Tidak boleh:

```text
recommendation = automatic truth
```

Teacher tetap punya:

```text
Confirm
Edit
Ulang
```

---

# 61. Teacher Quick Input Philosophy

Urutan prioritas:

1. tap;
2. select;
3. quick note;
4. voice-to-text future;
5. typing terakhir.

Keyboard tidak boleh menjadi kebutuhan utama untuk setoran normal, baik Tahfiz maupun Quran Reading.

---

# 62. Draft Action Model

Contoh:

```text
actions:
+1
+1
+0.5

Quran Reading example:
+2
+2
```

Derived Tahfiz:

```text
quantity = 2.5
```

Derived Quran Reading:

```text
quantity = 4 PAGE
```

Undo:

```text
actions.pop()
```

---

# 63. Reset

Reset hanya menghapus draft current student.

Tidak menghapus submission sebelumnya.

---

# 64. Save

Saat Save:

client mengirim:

```text
student
program
program_type
stage OR reading_method_config/level
quantity
start state
expected version
assessment/result
quick notes / issue tags
client_request_id
```

Server:

1. validate;
2. recalculate;
3. compare;
4. save;
5. update state;
6. audit;
7. return next recommendation/next state according to program.

---

# 65. Save & Next

Setelah save success:

```text
next student
```

UI tidak kembali ke dashboard.

---

# 66. Exception-First Assessment

Default:

```text
normal result
```

Teacher hanya memilih jika ada pengecualian.

Tetapi lembaga boleh mewajibkan explicit assessment.

Setting:

```text
assessment_mode:
DEFAULT_NORMAL
REQUIRE_SELECTION
```

---

# 67. Quick Notes Layers

Order:

```text
Teacher personal
Institution default
NgajiTrack global
```

Teacher personal dapat ditambah/hapus oleh ustaz.

Institution default dikelola admin.

Global dari NgajiTrack.

---

# 68. Default Quick Notes NgajiTrack

Contoh:

```text
Sangat baik
Kurang lancar
Perbaiki tajwid
Perbaiki makharij
Perlu murajaah
Ulang besok
Perbaiki panjang-pendek
Huruf masih tertukar
```

Label dapat diubah/ditambah lembaga.

---

# 69. Santri UI Principle

Santri tidak melakukan input akademik utama.

Santri melihat:

```text
current progress sesuai program
target
NgajiTrack Score bila aktif dan relevan
calendar/jadwal visible
recent activity
history
teacher notes visible to student
```

---

# 70. Wali UI Principle

Wali tidak melihat raw database.

Wali melihat ringkasan yang mudah dipahami.

Contoh Tahfiz page-based:

```text
Juz 7
8/20 halaman selesai
Target berikutnya: halaman 9
```

Contoh Quran Reading:

```text
Iqra 3
Halaman terakhir: 21
Posisi berikutnya: 22
Status terakhir: Lancar
```

---

# 71. Progress Map — Tahfiz

Untuk 20 halaman:

```text
01 ✓ 02 ✓ 03 ✓ 04 ✓ 05 ✓
06 ✓ 07 ✓ 08 ✓ 09 ● 10 ○
11 ○ 12 ○ 13 ○ 14 ○ 15 ○
16 ○ 17 ○ 18 ○ 19 ○ 20 ○
```

UI ini viewer.

Teacher tidak diwajibkan input melalui grid.

---

# 72. Dashboard Method-Aware

UI membaca stage config.

Contoh Daarut:

```text
Sabaq
Sabqi
Manzil
Mukammal
```

NgajiTrack Standard:

```text
Hafalan Baru
Penguatan
Murajaah Berkala
Ujian Tahfiz
```

Sulaimaniyah:

```text
Putaran
Halaman Aktif
Juz Aktif
Ujian
```

Quran Reading / Iqra-style:

```text
Metode
Jilid / Level
Halaman Aktif
Status terakhir
Target berikutnya
```

---

# 73. Stage Visibility

Stage dapat punya:

```json
{
  "student": true,
  "guardian": true,
  "teacher": true,
  "admin": true
}
```

Contoh internal note stage dapat disembunyikan dari wali.

---

# 74. Assessment Visibility

Institution dapat mengatur:

```text
show exact score to guardian?
show only status?
hide internal examiner notes?
```

MVP minimal mendukung visibility note. Jika NgajiTrack Score aktif, visibility komponen score juga harus mengikuti konfigurasi program/lembaga.

---

# 75. Teaching Mode

Saat kelas:

```text
Start Session
→ Focus Mode
→ Student Queue
→ Quick Input
→ Save & Next
→ End Session
```

Program/Learning Engine menentukan isi quick input berdasarkan role + program + active config.

---

# 76. Android Focus Mode — Flutter MVP

Flutter app Android dapat:

- immersive fullscreen;
- optional DND setelah permission;
- restore state;
- screen wake.

Method logic tidak berubah.

---

# 77. PWA Focus Mode — Optional/Future

Jika PWA client ditambahkan, PWA dapat:

- request fullscreen;
- wake lock jika tersedia;
- minimal chrome UI;
- teacher session layout.

OS limitations harus dihormati.

---

# 78. Attendance

Attendance bukan bagian utama Method Engine.

Jika future dibutuhkan:

buat domain attendance terpisah.

Jangan campur hadir/tidak hadir sebagai tahfiz progress.

---

# 79. Method State Invariants

Tidak boleh:

1. current state menunjuk stage disabled;
2. position melebihi mushaf;
3. cycle page invalid;
4. current juz > 30;
5. submission stage berbeda method config;
6. teacher update student tenant lain;
7. quantity negatif kecuali correction flow khusus;
8. exam pass tanpa exam attempt;
9. completion tanpa rule terpenuhi jika rule wajib;
10. silent state overwrite;
11. Quran Reading page di luar boundary level;
12. program TAHFIZ memakai reading config atau QURAN_READING memakai Tahfiz stage secara tidak valid;
13. `ULANG` memajukan current page tanpa explicit override.

---

# 80. Correction Flow

Jika ustaz salah input setelah save:

```text
Open history
→ Correct
→ enter reason optional/required
→ backend validates
→ update/correction
→ audit
→ rebuild state if needed
```

Jangan menggunakan frontend Undo setelah permanent save.

---

# 81. Correction Example

Salah:

```text
+2 halaman
```

Seharusnya:

```text
+1 halaman
```

System:

1. correction;
2. audit old/new;
3. recalc later state if affected.

---

# 82. Backdated Input

Jika input tanggal lalu:

- harus restricted;
- dapat memengaruhi recommendation;
- dapat memerlukan rebuild state.

MVP sebaiknya admin/authorized role only.

---

# 83. Method Transition

Transition antara stage tidak selalu otomatis.

Mode:

```text
AUTO
MANUAL_APPROVAL
EXAM_REQUIRED
```

Contoh:

```text
Final Preparation
→ Completion
```

mungkin membutuhkan approval.

---

# 84. Stage Completion

Stage dapat selesai karena:

```text
target reached
exam passed
manual approval
cycle completed
```

Rule config menentukan.

---

# 85. New Memorization Completion

Jika Juz 1–30 selesai:

jangan otomatis anggap seluruh program selesai.

Method mungkin masih membutuhkan:

```text
Final Preparation
Final Exam
Syahadah
```

---

# 86. Recent Review Completion

RECENT_REVIEW biasanya continuous.

Tidak perlu “selesai permanen”.

State selalu mengikuti hafalan terbaru.

---

# 87. Long-Term Review Completion

LONG_TERM_REVIEW bersifat rotation.

Satu putaran selesai bukan berarti stage selesai permanen.

Rotation berulang.

---

# 88. Exam Stage

EXAM memiliki milestone.

Contoh:

```text
Juz 1 passed
Juz 2 passed
...
Block 1–5 passed
```

State menyimpan milestone.

---

# 89. Final Preparation State

Contoh:

```json
{
  "current_level": 3,
  "target_quantity": 5,
  "unit": "JUZ",
  "status": "ACTIVE"
}
```

---

# 90. Completion State

Contoh:

```json
{
  "status": "COMPLETED",
  "completed_at": "...",
  "final_result": "PASS"
}
```

---

# 91. Sulaimaniyah Review

Detail murajaah Sulaimaniyah dapat berbeda di lapangan.

MVP:

- jangan invent rule yang belum tervalidasi;
- gunakan stage REVIEW generic;
- rules dapat diisi setelah observasi/wawancara.

Important:

> Jangan menebak detail metode yang belum diketahui hanya untuk melengkapi sistem.

---

# 92. Unknown Rules Policy

Jika aturan lembaga belum jelas:

gunakan:

```text
UNCONFIGURED
```

bukan asumsi.

Admin harus melengkapi sebelum stage digunakan.

---

# 93. Method Validation Before Publish

Admin config:

```text
Draft
→ Validate
→ Publish
```

Validation checks:

- stage order;
- required stage;
- unit compatibility;
- missing rule;
- invalid page count;
- invalid exam block;
- conflicting transition;
- invalid reading level order;
- invalid `page_start/page_end`;
- missing Quran Reading config untuk program QURAN_READING.

---

# 94. Draft Method Config

Perubahan method config tidak langsung berdampak production.

Status:

```text
DRAFT
ACTIVE
ARCHIVED
```

---

# 95. Active Config

Program hanya menggunakan config ACTIVE.

Jika config baru:

buat version baru atau controlled update.

---

# 96. Custom Rename Example

NgajiTrack Standard:

```text
Hafalan Baru
Penguatan
Murajaah Berkala
Ujian Tahfiz
```

Institution rename:

```text
Setoran
Ulang Dekat
Murajaah Lama
Tes Juz
```

Internal type tidak berubah.

---

# 97. Custom Target Example

Institution A:

```text
New memorization:
1 page/day
```

Institution B:

```text
New memorization:
0.5 page/day
```

Institution C:

```text
New memorization:
target manual
```

---

# 98. Custom Assessment Example

Institution A:

```text
Lancar / Cukup / Ulang
```

Institution B:

```text
A / B / C / D
```

Institution C:

```text
0–100
```

Method Engine hanya perlu status/score via scheme.

---

# 99. Method Capability Flags

Recommended capability model:

```text
TAHFIZ_PAGE_PROGRESS
AYAH_PROGRESS
JUZ_ROTATION
CYCLE_PROGRESS
EXAM
FINAL_STAGE
QUICK_INCREMENT
REVIEW_WINDOW
READING_LEVEL_PAGE_PROGRESS
QUICK_REPEAT
SCORE_VIEW
CALENDAR_VIEW
POSTER_GENERATION
```

Frontend render berdasarkan capability.

---

# 100. Capability Example — Daarut

```text
TAHFIZ_PAGE_PROGRESS
JUZ_ROTATION
EXAM
FINAL_STAGE
QUICK_INCREMENT
REVIEW_WINDOW
```

---

# 101. Capability Example — Sulaimaniyah

```text
TAHFIZ_PAGE_PROGRESS
CYCLE_PROGRESS
EXAM
```

---

# 102. Capability Example — Quran Reading / TPA

```text
READING_LEVEL_PAGE_PROGRESS
QUICK_INCREMENT
QUICK_REPEAT
CALENDAR_VIEW
```

---

# 103. API Concept

Example:

```text
GET /students/:id/learning-state
GET /students/:id/recommendation
POST /sessions
POST /submissions
POST /reading-progress
POST /submissions/:id/correct
GET /students/:id/progress
GET /students/:id/score
GET /students/:id/calendar
POST /posters/generate
```

Exact route may differ.

---

# 104. Recommendation Response

Example:

```json
{
  "stage": "NEW_MEMORIZATION",
  "display_name": "Hafalan Baru",
  "current": {
    "juz": 7,
    "page": 8
  },
  "recommended": {
    "juz": 7,
    "page": 9
  },
  "quick_actions": [
    {"type":"ADD","value":0.5,"unit":"PAGE"},
    {"type":"ADD","value":1,"unit":"PAGE"},
    {"type":"ADD","value":2,"unit":"PAGE"}
  ]
}
```

---

# 105. Submission Request Example

```json
{
  "student_id": "...",
  "stage_id": "...",
  "session_id": "...",
  "quantity": 2,
  "unit": "PAGE",
  "expected_progress_version": 12,
  "assessment": "LANCAR",
  "quick_note_ids": [],
  "client_request_id": "..."
}
```

---

# 106. Submission Response Example

```json
{
  "submission_id": "...",
  "progress_version": 13,
  "previous_state": {
    "juz": 7,
    "page": 8
  },
  "new_state": {
    "juz": 7,
    "page": 10
  },
  "next_recommendation": {
    "juz": 7,
    "page": 11
  }
}
```

---

# 106A. Quran Reading Request Example

```json
{
  "student_id": "...",
  "program_id": "...",
  "reading_method_config_id": "...",
  "level_id": "...",
  "session_id": "...",
  "actions": [
    {"type":"ADD_PAGE","value":2},
    {"type":"ADD_PAGE","value":2}
  ],
  "expected_progress_version": 7,
  "assessment": "LANCAR",
  "issue_tags": [],
  "client_request_id": "..."
}
```

Expected:

```text
start page = 18
quantity = 4
last completed = 21
next current page = 22
```

Jika result `ULANG`, quantity dapat 0 dan current page tetap.

---

# 107. Conflict Response

Jika version berubah:

```text
409 CONFLICT
```

UI:

> Progres santri berubah dari perangkat lain. Muat ulang data terbaru.

---

# 108. Method Engine Test Categories

Wajib ada:

```text
progress tests
boundary tests
review tests
rotation tests
cycle tests
exam tests
transition tests
quran-reading tests
score integration tests
calendar visibility tests
poster generation tests
permission tests
correction tests
```

---

# 109. Test — Repeated Quick Tap

Given:

```text
current page = 8
```

Actions:

```text
+1
+1
```

Expect:

```text
draft = +2
new page = 10
```

---

# 110. Test — Undo

Actions:

```text
+1
+1
+0.5
Undo
```

Expect:

```text
+2
```

---

# 111. Test — Reset

Actions:

```text
+1
+1
Reset
```

Expect:

```text
0
```

State database unchanged.

---

# 112. Test — Page Boundary

Given:

```text
18/20
```

Actions:

```text
+2
```

Expect:

```text
20/20
completed current juz
```

Another `+1`:

Expect:

```text
confirmation required
```

---

# 113. Test — Ulang

Given:

```text
page 8
```

Result:

```text
ULANG
```

Expect:

```text
page remains 8
submission exists
```

---

# 113A. Test — Quran Reading Repeated Tap

Given:

```text
Iqra 3
current page = 18
level end = 32
```

Actions:

```text
+2
+2
```

Expect:

```text
quantity = 4
completed pages = 18–21
next page = 22
```

---

# 113B. Test — Quran Reading Ulang

Given:

```text
current page = 22
```

Action:

```text
ULANG
```

Expect:

```text
submission exists
current page remains 22
result = ULANG
```

---

# 113C. Test — Quran Reading Level Boundary

Given:

```text
current page = 31
level end = 32
```

Action:

```text
+2
```

Expect:

```text
stop at 32
level completion candidate
next level requires configured transition/confirmation
```

No silent overflow.

---

# 114. Test — Sabqi Window

Given:

```text
latest new memorization position
```

Rule:

```text
10 SHEETS BACKWARD
```

Expect:

range correctly calculated against mushaf.

---

# 115. Test — Manzil Rotation

Given:

```text
next_juz = 5
target = 2
```

Expect:

```text
5–6
```

After complete:

```text
next_juz = 7
```

---

# 116. Test — Manzil Wrap

Given:

```text
memorized through Juz 10
next_juz = 9
target = 2
```

Expect:

```text
9–10
```

Next:

```text
1–2
```

---

# 117. Test — Mukammal Block

Given:

```text
completed 1–5
```

Rule:

```text
block size = 5
```

Expect:

```text
eligible for 1–5 exam
```

---

# 118. Test — Final Preparation

Given:

```text
level 2 passed
```

Transition:

```text
manual approval
```

Expect:

system does not auto-promote until approval.

---

# 119. Test — Sulaimaniyah Progress

Given:

```text
page = 20
current juz = 12
```

Complete:

Expect:

```text
current juz = 13
```

---

# 120. Test — Sulaimaniyah Cycle Completion

Given:

```text
page 20
current juz 30
```

Complete:

Expect:

```text
page 19
current juz 1
new cycle
```

---

# 121. Test — Method Rename

Rename:

```text
Hafalan Baru
→ Setoran
```

Expect:

- backend type remains `NEW_MEMORIZATION`;
- history unchanged;
- UI label becomes `Setoran`.

---

# 122. Test — Disable Stage

If stage disabled:

- new submissions rejected;
- history remains viewable;
- progress state preserved/archive behavior defined.

---

# 123. Test — Change Unit

Changing active stage:

```text
PAGE → AYAH
```

may be breaking.

System should not allow silent change if active student states exist.

Require migration/explicit conversion.

---

# 124. Breaking Method Changes

Examples:

- unit change;
- reorder with dependency;
- cycle direction change;
- review anchor change.

Must require:

```text
new config version
```

or migration.

---

# 125. Safe Method Changes

Examples:

```text
rename display label
change quick notes
change visibility
change UI order
```

Can apply without historical migration.

---

# 126. Method Config Version Strategy

Example:

```text
Method v1
active until Dec 2026

Method v2
active Jan 2027
```

Existing submission references v1.

New activity references v2.

---

# 127. Future Method Marketplace

Not MVP.

Possible future:

- NgajiTrack published method templates;
- institutions duplicate;
- never execute arbitrary code.

---

# 128. Future Home Supervisor

Can map to additional stage/source.

But guardian input must not silently modify official teacher-verified progress.

Recommended distinction:

```text
OFFICIAL
HOME_REPORTED
```

Teacher may verify future.

---

# 129. Offline-Resilient Teacher Input — MVP

Offline-resilient teacher input merupakan requirement MVP.

Method Engine tetap server-authoritative, tetapi teacher client harus dapat menyimpan intent secara lokal.

### 129.1 Local Durable Draft

Setiap aksi seperti:

```text
+½
+1
+2
ULANG
DETAIL / issue tag
assessment
quick note
manual correction
```

langsung disimpan ke local durable draft.

Status lokal:

```text
DRAFT
LOCAL_SAVED
READY_TO_SYNC
PENDING_SYNC
SYNCED
CONFLICT
FAILED_RETRYABLE
```

### 129.2 Confirm While Offline

Saat ustaz menekan Save/Save & Next:

```text
draft
→ finalized locally
→ queued operation
→ teacher may continue
```

Jika internet tidak ada:

```text
PENDING_SYNC
```

bukan error yang memaksa kelas berhenti.

### 129.3 Server Revalidation

Ketika online:

```text
queued operation
→ server revalidates:
   - tenant
   - teacher assignment
   - enrollment
   - method config/version
   - stage
   - base progress version
   - boundary
→ transaction
→ new progress state
```

### 129.4 Idempotency

Retry menggunakan:

```text
client_operation_id
client_request_id
```

Operasi yang sama tidak boleh menghasilkan submission ganda.

### 129.5 Conflict

Jika progress server telah berubah:

```text
base_progress_version != current_server_version
```

dan perubahan tidak aman untuk auto-merge:

```text
CONFLICT
```

Ustaz diminta review.

Tidak boleh silent overwrite.

### 129.6 Cached Method Data

Teacher client minimal menyimpan:

- active program type;
- active Tahfiz method config OR Quran Reading config;
- relevant stage/level config;
- quick actions;
- grading scheme;
- quick notes;
- class roster;
- last synced progress state;
- pending drafts.

Tujuan:

> internet tiba-tiba hilang tidak menghilangkan input dan tidak menghentikan sesi mengajar.

---

# 130. Flutter App Contract

Flutter receives:

```text
method config
capabilities
recommendations
quick actions
```

Flutter does not duplicate learning math as official source-of-truth. Local preview boleh dihitung untuk UX, tetapi backend tetap authoritative.

---

# 131. UX Rule for Method Complexity

Admin dapat melihat:

```text
rules
targets
stages
config
```

Teacher should not.

Teacher sees:

```text
what to do now
```

Guardian sees:

```text
what the progress means
```

Student sees:

```text
where I am and what is next
```

---

# 132. Product Rule

If a method configuration makes teacher input complicated:

> configuration is not finished.

NgajiTrack must translate complex institutional rules into simple daily actions.

---

# 133. MVP Required Methods

Before pilot, engine must support:

### 1. NgajiTrack Standard
- Hafalan Baru
- Penguatan
- Murajaah Berkala
- Ujian Tahfiz
- Pemantapan Akhir
- Completion

### 2. Daarut Reference
- Sabaq
- Sabqi
- Manzil
- Mukammal
- Persiapan Syahadah
- Syahadah

### 3. Sulaimaniyah Reference
- Cycle-based memorization
- configurable review placeholder
- exam
- completion

### 4. Quran Reading / Iqra-style
- configurable method label;
- configurable level/jilid;
- configurable page boundary;
- `+1`;
- `+2`;
- repeated tap;
- `ULANG`;
- `DETAIL` / issue tags;
- transition antar level.

---

# 134. MVP Unknowns to Validate

Hal yang belum boleh diasumsikan:

1. exact Sabqi cross-juz behavior;
2. exact rule naik target Persiapan Syahadah;
3. exact Sulaimaniyah review mechanism;
4. exact Sulaimaniyah exam progression;
5. institution-specific grading standards;
6. mushaf pagination variations;
7. whether half-page represented physically the same in all institutions;
8. exact jumlah halaman tiap metode/edisi Quran Reading;
9. assessment/issue tags mana yang benar-benar dibutuhkan ustaz TPA;
10. apakah beberapa lembaga memakai level non-linear atau skip page;
11. aturan transisi antar jilid yang berbeda antar metode.

Semua harus dapat dikonfigurasi atau divalidasi saat pilot.

---

# 135. Pilot Observation Checklist

Saat pilot, tanyakan:

- berapa detik ustaz input satu santri?
- tombol apa paling sering dipakai?
- field apa tidak pernah dipakai?
- apakah ustaz memahami draft?
- apakah status `tersimpan di perangkat` vs `tersinkron` dipahami?
- apakah Undo cukup?
- apakah Save & Next natural?
- apakah sesi tetap nyaman saat internet sengaja diputus?
- apakah retry menghasilkan duplicate?
- apakah conflict message dapat dipahami?
- apakah rekomendasi target akurat?
- apakah Sabqi calculation sesuai praktik?
- apakah Manzil rotation sesuai praktik?
- apakah wali memahami dashboard?
- apakah santri memahami target?
- apakah admin kesulitan setup metode?
- apakah Assisted Setup mudah dijelaskan ke lembaga?
- apakah lembaga pindahan memahami perbedaan portable history vs baseline aktif?
- apakah method lembaga baru benar-benar tidak tercampur dengan histori lembaga lama?
- apakah input Quran Reading normal benar-benar selesai 2–5 detik?
- apakah tombol `+1/+2/ULANG/DETAIL` cukup?
- apakah ustaz perlu mengetik kata bermasalah atau issue tag sudah cukup?
- apakah boundary level/jilid sesuai buku yang dipakai lembaga?
- apakah santri/wali memahami progres jilid + halaman?

---

# 136. Success Criteria — Method Engine

Method Engine MVP dianggap berhasil jika:

- [ ] preset dapat diduplikasi;
- [ ] stage dapat di-rename;
- [ ] stage dapat diaktif/nonaktif;
- [ ] unit page/juz/cycle berjalan;
- [ ] per-student target berjalan;
- [ ] repeated tap dihitung benar;
- [ ] Undo/Reset benar;
- [ ] draft tidak commit otomatis;
- [ ] smart continue benar;
- [ ] boundary aman;
- [ ] Daarut reference berjalan;
- [ ] Sulaimaniyah reference berjalan;
- [ ] Quran Reading/Iqra-style berjalan;
- [ ] program TAHFIZ dan QURAN_READING menggunakan backend/source-of-truth yang sama tanpa state bercampur;
- [ ] jumlah halaman level/jilid configurable dan tidak hard-coded global;
- [ ] `+1/+2` Quran Reading dapat diakumulasi;
- [ ] `ULANG` mencatat aktivitas tanpa memajukan page;
- [ ] boundary antar level aman;
- [ ] issue tags/detail bersifat exception-first;
- [ ] method-specific dashboard dapat dirender;
- [ ] history tetap benar setelah rename;
- [ ] config change tidak merusak history;
- [ ] teacher UX tetap sederhana;
- [ ] Assisted Setup menghasilkan config, bukan custom institution code;
- [ ] santri pindahan menggunakan method lembaga baru;
- [ ] portable history tidak otomatis menimpa baseline;
- [ ] placement/baseline dapat diverifikasi;
- [ ] local draft tetap ada saat internet hilang;
- [ ] Save & Next tetap dapat berlanjut ketika offline;
- [ ] queued submission tersinkron saat koneksi kembali;
- [ ] retry tidak membuat duplicate submission;
- [ ] stale offline submission menghasilkan conflict;
- [ ] progress hasil sync terlihat konsisten bagi Admin, Santri, dan Wali sesuai visibility;
- [ ] Flutter menerima UI/capability sesuai active program;
- [ ] Personal Mode tidak ikut dipaksakan ke Method Engine MVP;
- [ ] built-in Mushaf reader tidak menjadi dependency Method Engine.

---

# 137. Final Method Principle

NgajiTrack tidak boleh memaksa lembaga mengikuti satu cara tahfiz atau satu metode belajar baca Al-Qur'an.

Tetapi NgajiTrack juga tidak boleh menjadi sistem bebas tanpa struktur.

Prinsip akhirnya:

> **NgajiTrack menyediakan learning/method engine yang terstruktur, preset/config yang siap dipakai, dan ruang konfigurasi yang cukup agar lembaga dapat mempertahankan cara mengajar mereka sendiri.**

Bagi admin:

> fleksibel.

Bagi ustaz:

> tap, tap, selesai.

Bagi santri:

> jelas progresnya.

Bagi wali:

> mudah dipahami.

Bagi sistem:

> tetap rapi, aman, dan scalable.
---

# 138. Method Ownership Across Accounts

Method/reading config dimiliki oleh lembaga/program.

Role lain hanya menggunakan projection dari method tersebut.

```text
Admin Lembaga
→ configure/publish method

Ustaz
→ receive operational actions

Santri
→ receive progress/target view

Wali
→ receive simplified child-progress view
```

Jangan membuat versi metode terpisah untuk setiap role.

Semua role harus mengacu pada:

```text
same active program context
same relevant config/version
same semantic stage/level
```

dengan UI berbeda.

---

# 139. Method-Aware Cross-Account Flow

Contoh Daarut-style:

```text
Ustaz input Hafalan Baru
→ engine menghitung state
→ progress state berubah
→ Santri melihat progress map terbaru
→ Wali melihat ringkasan Hafalan Baru/Penguatan/Murajaah
→ Admin melihat rekap kelas
```

Contoh Sulaimaniyah-style:

```text
Ustaz input cycle/page/juz
→ engine update cycle state
→ Santri melihat putaran aktif
→ Wali melihat ringkasan yang mudah dipahami
→ Admin melihat distribusi progress
```

Contoh Quran Reading:

```text
Ustaz input +2 +2 pada Iqra 3
→ engine validasi boundary
→ submission tersimpan
→ current page berubah
→ Santri melihat posisi jilid/halaman terbaru
→ Wali melihat ringkasan yang mudah dipahami
→ Admin melihat progres kelas
```

Data tidak boleh diterjemahkan oleh masing-masing client dengan rumus sendiri.

Client menerima hasil/capability dari engine.

---

# 140. Method Publication Lifecycle

Tahfiz method config menggunakan lifecycle:

```text
DRAFT
→ VALIDATING
→ READY_FOR_PREVIEW
→ APPROVED
→ ACTIVE
→ SUPERSEDED
→ ARCHIVED
```

Perubahan besar tidak langsung mengubah config aktif.

Flow:

```text
Active v1
→ duplicate/edit Draft v2
→ validate
→ preview
→ approve
→ publish v2
```

Historical submission tetap menunjuk versi config yang berlaku saat submission dibuat. Quran Reading config juga harus versioned saat perubahan boundary/struktur dapat mengubah interpretasi histori.

---

# 141. Method Change Safety Classes

Perubahan dibagi:

### Safe

Contoh:

- rename display label;
- quick note;
- visual ordering yang tidak mengubah semantic meaning.

### Requires Validation

Contoh:

- target harian;
- review window;
- assessment threshold;
- transition rule.

### Breaking

Contoh:

- mengganti progress unit dari page menjadi cycle;
- mengubah semantic stage secara fundamental;
- menghapus stage yang masih memiliki active state.

Breaking change harus memakai migration plan.

---

# 142. Assisted Setup Governance

Tim NgajiTrack harus mencatat:

- siapa menganalisis;
- sumber aturan;
- rule mana yang confirmed;
- rule mana yang assumption;
- rule mana yang belum diketahui;
- config version;
- tanggal approval lembaga.

Jangan mengisi aturan yang tidak diketahui hanya agar setup terlihat selesai.

Status requirement dapat berupa:

```text
CONFIRMED
ASSUMED_FOR_PREVIEW
NEEDS_CONFIRMATION
NOT_SUPPORTED
```

Sebelum publish:

```text
NEEDS_CONFIRMATION
```

untuk rule kritis harus diselesaikan atau dinonaktifkan secara eksplisit.

---

# 143. Transfer & Method Isolation Test

Scenario:

```text
Ahmad — Lembaga A
Method: Daarut-style
Progress: Hafalan Baru Juz 8

Ahmad tamat
↓
join Lembaga B
Method: Sulaimaniyah-style
```

Expected:

```text
History A remains Daarut-style
Enrollment A read-only
Portable summary optional
Enrollment B gets Sulaimaniyah config
Baseline B determined independently
New submissions use B method_config
No A rule runs in B
```

Failure:

```text
B inherits Sabaq/Sabqi automatically
A submissions re-labeled as cycle
A records moved to B
```

Semua failure tersebut tidak diperbolehkan.

---

# 144. Offline Method Compatibility Test

Scenario:

```text
Teacher opens class online
→ method config v3 cached
→ internet disappears
→ teacher records 4 students
→ admin publishes method v4
→ teacher reconnects
```

Server harus menentukan secara eksplisit bagaimana operasi queued diproses.

Default safe policy:

```text
queued operation carries method_config_id + version
```

Jika perubahan v4 tidak memengaruhi semantic operation:

```text
server may accept using v3 context
```

Jika breaking:

```text
CONFLICT / REVIEW_REQUIRED
```

Jangan diam-diam menghitung intent v3 menggunakan rule v4.

---

# 145. UX Principle for Method Setup

Admin tidak perlu memahami internal enum seperti:

```text
RECENT_REVIEW
LONG_TERM_REVIEW
COMPLETION
```

UI menggunakan bahasa lembaga.

Internal semantic type tetap stabil untuk engine.

Contoh:

```text
Internal:
RECENT_REVIEW

Display:
Penguatan
Sabqi
Murajaah Dekat
```

Tujuannya:

> lembaga merasa sistem mengikuti cara mereka, sementara backend tetap terstruktur.

---

# 146. Current Product Rule

NgajiTrack bukan aplikasi yang memaksa semua lembaga memakai satu metode tahfiz atau metode baca.

NgajiTrack juga bukan builder tanpa batas.

Model yang dipilih:

```text
Program-Aware Learning Engine
+ Tahfiz Method Engine
+ Quran Reading Engine
+ ready-to-use presets/config
+ constrained customization
+ Assisted Setup
+ versioning
+ validation
+ portable history
+ institution-specific active method
+ offline-resilient teacher input
```

Prinsip:

> **program/metode boleh berbeda, histori harus tetap benar, input harus tetap aman, dan setiap akun harus melihat hasil yang konsisten dari source-of-truth yang sama.**
---

# REVISION v1.2 — Multi-Program Learning Rules Lock

Jika ada bagian lama yang bertentangan dengan bagian ini, **REVISION v1.2 menjadi acuan terbaru**.

## A. Program-Aware Rule

Runtime minimum:

```text
active role
+ active institution
+ active class/program
+ program_type
+ relevant config
= operational UI + validation rules
```

`TEACHER` bukan berarti selalu melihat UI Tahfiz. UI ditentukan lagi oleh program yang sedang dibuka.

---

## B. Quran Reading / Iqra Quick Flow

Kasus normal:

```text
Buka kelas
→ pilih/lanjut santri
→ tampil current level/page
→ tap +1 / +2 / ULANG
→ optional assessment
→ Save & Next
```

Target:

> **2–5 detik per santri untuk kasus normal.**

`DETAIL` hanya untuk pengecualian.

Repeated tap adalah akumulasi:

```text
+2 +2 = +4
```

Boundary harus dibaca dari config, bukan dari angka yang diasumsikan universal.

---

## C. NgajiTrack Score Relationship

NgajiTrack Score bukan Method Engine dan tidak menentukan posisi hafalan.

Flow:

```text
verified Tahfiz submissions/assessments
→ Score Calculation Service
→ formula version
→ score snapshot
```

Default initial weighting yang dipakai sebagai fondasi produk:

```text
Kualitas hafalan    35%
Retensi/murajaah    30%
Konsistensi         20%
Kecepatan progres   15%
```

Rules:

- jumlah juz ditampilkan terpisah;
- speed bukan lomba global;
- speed dibandingkan dengan target program yang relevan;
- formula harus versioned;
- score harus explainable;
- Quran Reading tidak wajib memakai NgajiTrack Score yang sama kecuali nanti ada formula terpisah yang benar-benar tervalidasi.

---

## D. Calendar Relationship

Calendar tidak mengubah progress state secara langsung.

```text
Calendar
→ schedule/reminder/projection

Submission/Exam
→ academic source-of-truth
```

Jadwal setoran atau ujian dapat menunjuk source domain, tetapi event kalender tidak menggantikan record akademik.

---

## E. Poster Relationship

Poster membaca data hasil/progres yang sudah ada.

```text
Progress / Milestone
→ approved template
→ institution branding
→ official NgajiTrack watermark
→ render on-demand
→ download/share
```

Poster tidak boleh mengubah progress.

Watermark NgajiTrack wajib, kecil, dan dipaksa server-side.

---

## F. Flutter-First Teaching

MVP teacher client adalah Flutter.

Local durable storage menyimpan intent/draft:

```text
tap
→ local durable draft
→ confirm locally
→ queued operation
→ sync
→ server revalidation
→ official submission/state
```

Flutter boleh menampilkan preview, tetapi server tetap authoritative.

---

## G. Deferred Product Scope

Method/Learning Engine MVP **tidak** membangun:

```text
Personal Mode
personal murajaah engine
personal memory health
personal streak
built-in Mushaf reader
mushaf audio/reader features
```

Quran reference mapping tetap boleh digunakan untuk Tahfiz tracking.

---

## H. v1.2 Required Test Additions

Wajib lulus:

```text
Quran Reading +1
Quran Reading +2
Quran Reading +2 +2
Quran Reading ULANG no-advance
Quran Reading level boundary
cross-program config rejection
offline Quran Reading queued submission
score formula version preservation
calendar does not mutate progress
poster generation does not mutate progress
poster watermark cannot be disabled
```

---

## I. v1.2 Final Rule

> **NgajiTrack boleh mendukung banyak cara belajar, tetapi setiap cara harus diterjemahkan menjadi input ustaz yang sederhana, data yang terstruktur, dan hasil yang konsisten untuk seluruh role.**
