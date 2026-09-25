# NgajiTrack — Product Specification (MVP)

**Document:** `PRODUCT_SPEC.md`  
**Product:** NgajiTrack  
**Parent Brand:** Aseera  
**Status:** Draft v1.2 — Multi-Program Learning, Program-Aware UX, Score Foundation & Poster System  
**Purpose:** Dokumen acuan utama untuk desain, pengembangan, testing, dan evaluasi MVP NgajiTrack.

---

## 1. Product Summary

NgajiTrack adalah platform monitoring pembelajaran Al-Qur'an untuk lembaga seperti pesantren, TPA/TPQ, SDIT, rumah tahfiz, dan lembaga pendidikan Al-Qur'an lainnya. Platform tidak dibatasi hanya pada tahfiz; NgajiTrack juga mendukung pembelajaran baca Al-Qur'an tingkat dasar seperti Iqra dan metode sejenis melalui model progres yang sederhana, cepat, dan dapat dikonfigurasi.

NgajiTrack bukan sekadar aplikasi pencatatan digital. Tujuan utamanya adalah:

- mempercepat proses input ustaz;
- mengurangi pencatatan manual berulang;
- menjaga struktur data santri tetap rapi;
- memberi akses progres yang jelas kepada santri dan wali;
- memberi lembaga fleksibilitas untuk menyesuaikan sistem tahfiz maupun pembelajaran baca Al-Qur'an mereka;
- memungkinkan UI dan alur input berbeda sesuai role dan jenis program tanpa memisahkan backend;
- tetap mempertahankan satu fondasi data dan arsitektur yang konsisten;
- dapat berkembang dari web/PWA ke aplikasi Android dan iOS tanpa membangun sistem dari nol.

Prinsip utama produk:

> **Fleksibel di belakang, sederhana di depan.**

Admin boleh memiliki konfigurasi yang cukup kuat. Ustaz harus dapat melakukan input dengan cepat dan minim mengetik. Santri dan wali harus dapat memahami progres tanpa harus memahami struktur teknis sistem.

---

## 2. Product Vision

Menjadi platform monitoring tahfiz dan pembelajaran Al-Qur'an yang dapat menyesuaikan metode lembaga, bukan memaksa seluruh lembaga mengikuti satu format yang sama.

NgajiTrack harus mampu mendukung:

- metode tahfiz berbasis halaman;
- metode tahfiz berbasis ayat;
- metode berbasis juz;
- metode murajaah bertingkat;
- metode putaran;
- ujian tahfiz;
- tahap pemantapan hafalan;
- kebutuhan custom lembaga tanpa membuat data menjadi tidak terstruktur;
- program baca Al-Qur'an berbasis jilid/level dan halaman seperti Iqra serta metode lain yang digunakan lembaga;
- pengalaman ustaz yang berubah otomatis sesuai program yang sedang dibuka.

---

## 3. Product Goals — MVP

MVP NgajiTrack harus membuktikan 7 hal:

1. **Lembaga dapat mengatur sistem pembelajaran Al-Qur'annya sendiri tanpa bantuan developer untuk kebutuhan normal.**
2. **Ustaz dapat mencatat progres lebih cepat daripada pencatatan manual di kertas.**
3. **Santri dan wali dapat melihat progres yang benar dan mudah dipahami.**
4. **Data antar lembaga benar-benar terisolasi dan aman.**
5. **Dua metode tahfiz yang berbeda dapat berjalan di dalam satu sistem backend yang sama.**
6. **Program Tahfiz dan program Baca Al-Qur'an dapat berjalan dalam backend yang sama dengan UI ustaz yang berbeda sesuai program.**
7. **Riwayat santri tetap utuh saat santri lulus/pindah dan dapat menjadi arsip read-only tanpa mengganggu data aktif.**

Target UX utama:

> Input setoran normal oleh ustaz idealnya selesai dalam **2–5 detik**.

---

## 4. Non-Goals — MVP

Fitur berikut **tidak menjadi prioritas MVP** dan ditunda ke fase sesudah validasi:

- payment gateway;
- invoice otomatis;
- subscription billing penuh;
- leaderboard nasional;
- gamification kompleks;
- chat internal;
- AI recommendation;
- marketplace;
- payroll;
- sertifikat digital tingkat lanjut;
- custom report builder bebas;
- template builder ala Google Forms;
- full offline untuk seluruh fitur/platform (namun **offline-resilient teacher input** wajib di MVP);
- advanced analytics;
- aplikasi native Android/iOS terpisah;
- fitur enterprise berskala besar;
- **Personal Mode / penggunaan individu non-lembaga**;
- **built-in Mushaf reader** untuk seluruh role;
- editor poster bebas setingkat Canva secara penuh (fondasi template dan generator boleh disiapkan lebih dulu).

Fitur-fitur tersebut boleh ditambahkan setelah MVP stabil.

---

## 5. User Roles

NgajiTrack memiliki 5 role utama.

### 5.1 Super Admin

Super Admin dikelola oleh pihak NgajiTrack/Aseera.

Tanggung jawab:

- membuat dan mengelola lembaga;
- mengaktifkan/nonaktifkan lembaga;
- membuat atau menunjuk Admin Lembaga;
- melihat status penggunaan sistem;
- melihat audit dasar;
- mengelola preset metode bawaan NgajiTrack;
- melihat statistik platform secara global;
- melakukan tindakan administratif tingkat platform.

Super Admin **tidak boleh** dapat melihat password pengguna dalam bentuk teks asli.

### 5.2 Admin Lembaga

Admin Lembaga mengelola sistem milik lembaganya sendiri.

Tanggung jawab:

- profil lembaga;
- program tahfiz;
- kelompok/halaqah;
- ustaz;
- santri;
- wali;
- hubungan wali–santri;
- penempatan ustaz;
- enrolment santri ke program;
- konfigurasi metode tahfiz;
- konfigurasi program baca Al-Qur'an (Iqra/metode lain/custom);
- penamaan tahapan;
- standar penilaian;
- quick notes bawaan lembaga;
- laporan progres;
- monitoring santri;
- bulk import/onboarding santri;
- mengatur struktur kelas/halaqah dan penempatan santri;
- mengelola proses linking akun santri existing ke lembaganya;
- meminta **Assisted Setup** metode kepada tim NgajiTrack bila tidak ingin menyusun sendiri;
- mengatur branding lembaga untuk poster progres, termasuk logo, warna, dan template yang diizinkan.

Admin Lembaga hanya boleh mengakses data lembaganya sendiri.

### 5.3 Ustaz/Ustazah

Ustaz adalah pengguna operasional utama saat sesi belajar.

Kebutuhan utama:

- melihat daftar santri;
- memulai sesi kelas/halaqah;
- melihat progres terakhir santri;
- input hafalan/murajaah dengan sangat cepat;
- minim mengetik;
- menggunakan quick notes;
- undo/reset jika salah tap;
- melihat riwayat;
- melihat target berikutnya;
- masuk ke Mode Mengajar/Focus Teaching Mode;
- mendapatkan UI input yang otomatis menyesuaikan jenis program kelas, misalnya Tahfiz atau Baca Al-Qur'an.

Ustaz hanya boleh melihat santri/kelas yang ditugaskan kepadanya. Secara default, ustaz **tidak menjadi pemilik struktur resmi kelas**; perubahan keanggotaan kelas/halaqah dilakukan oleh Admin Lembaga, sementara ustaz dapat mengusulkan perubahan bila diperlukan.

### 5.4 Wali

Wali fokus pada monitoring anak.

Kebutuhan utama:

- melihat progres hafalan anak;
- melihat aktivitas/setoran terbaru;
- melihat catatan ustaz;
- melihat target;
- melihat riwayat;
- melihat progres sesuai metode lembaga;
- melihat visual progres halaman/juz bila relevan;
- melihat kalender/jadwal yang relevan;
- melihat NgajiTrack Score dan komponennya bila program/lembaga mengaktifkannya.

Dashboard wali harus mengikuti struktur metode lembaga.

### 5.5 Santri

Santri fokus pada progres dirinya sendiri.

Kebutuhan utama:

- melihat posisi hafalan;
- melihat target berikutnya;
- melihat riwayat;
- melihat status murajaah;
- melihat progres visual;
- melihat catatan yang memang boleh dilihat;
- melihat kalender/jadwal yang relevan;
- melihat NgajiTrack Score dan komponennya bila program/lembaga mengaktifkannya.

Santri hanya boleh melihat datanya sendiri.

---

## 6. Identity & Membership Model

NgajiTrack tidak menggunakan satu role permanen langsung di akun.

Struktur yang disarankan:

```text
User
  ↓
Institution Membership
  ↓
Role
```

Alasan: satu orang secara nyata dapat memiliki lebih dari satu hubungan. Contoh: menjadi ustaz di lembaga A sekaligus menjadi wali di lembaga B.

---

## 7. NgajiTrack Default Tahfiz Preset

Preset utama NgajiTrack mengambil logika tahfiz bertahap, namun **tidak memakai nama Sabaq, Sabqi, Manzil, Mukammal sebagai label default**.

Nama bawaan NgajiTrack:

1. **Hafalan Baru**
2. **Penguatan**
3. **Murajaah Berkala**
4. **Ujian Tahfiz**
5. **Pemantapan Akhir**
6. **Khatam / Final Tahfiz**

Nama ini adalah label default. Lembaga dapat mengubah nama sesuai istilah mereka sendiri.

Contoh:

```text
NgajiTrack Default      Lembaga A
------------------------------------
Hafalan Baru            Sabaq
Penguatan               Sabqi
Murajaah Berkala        Manzil
Ujian Tahfiz            Mukammal
Pemantapan Akhir        Persiapan Syahadah
Khatam / Final          Syahadah
```

Secara internal sistem harus tetap mengenali fungsi tahap, meskipun label tampilannya diubah.

Contoh tipe internal:

```text
NEW_MEMORIZATION
RECENT_REVIEW
LONG_TERM_REVIEW
EXAM
FINAL_PREPARATION
COMPLETION
```

---

## 8. Customization Philosophy

Lembaga **boleh menyesuaikan sistem**, tetapi tidak diberi kebebasan tanpa batas.

Yang boleh disesuaikan:

- nama tahap;
- aktif/nonaktif tahap;
- urutan tahap;
- unit progres;
- target;
- standar nilai;
- quick notes;
- aturan review;
- syarat ujian;
- syarat naik tahap;
- visibilitas ke wali/santri;
- istilah yang digunakan lembaga.

Yang tidak boleh diubah sembarangan:

- struktur security;
- isolasi data antar lembaga;
- identitas inti record;
- audit log;
- ownership data;
- primary relation antar entitas;
- rule permission backend.

---

## 9. Supported Progress Units

MVP harus mampu mendukung unit:

- ayat;
- halaman;
- setengah halaman;
- lembar;
- juz;
- setengah juz;
- multi-juz;
- putaran/cycle;
- custom unit terbatas.

Contoh:

```text
1 lembar = 2 halaman
```

Hubungan seperti ini sebaiknya ditentukan melalui konfigurasi lembaga/mushaf, bukan dianggap universal.

---

## 9A. Learning Program Types

NgajiTrack menggunakan konsep **program-aware experience**. Satu lembaga dapat memiliki beberapa jenis program dan setiap kelas/halaqah terhubung ke satu jenis program aktif.

Jenis minimum yang perlu didukung oleh fondasi:

```text
TAHFIZ
QURAN_READING
CUSTOM
```

### Tahfiz

Digunakan untuk hafalan baru, penguatan, murajaah, ujian, pemantapan, dan final/khatam sesuai konfigurasi lembaga.

### Quran Reading

Digunakan untuk pembelajaran baca Al-Qur'an tingkat dasar/bertahap seperti Iqra dan metode sejenis. Untuk MVP, NgajiTrack **tidak menyalin isi buku, halaman, materi, desain, atau kurikulum proprietary**. Sistem hanya mencatat progres administratif yang ditentukan lembaga.

Metode/label yang dapat disediakan sebagai pilihan awal:

```text
Iqra
Ummi
Qiroati
Tilawati
Yanbu'a
Custom
```

Nama metode digunakan sebagai identitas konfigurasi lembaga, bukan klaim afiliasi atau integrasi resmi.

Data minimum program baca Al-Qur'an:

```text
method_label
level_or_volume
current_page
start_page
end_page
status
assessment
optional_issue_tag
optional_note
```

Jumlah halaman per jilid/level **tidak boleh di-hard-code sebagai standar universal**. Admin Lembaga menentukan struktur level/jilid dan jumlah halaman sesuai buku/edisi yang benar-benar mereka gunakan.

---

## 10. Quran & Mushaf Model

NgajiTrack harus memiliki layer data referensi Al-Qur'an tersendiri untuk pemetaan juz, surah, ayat, dan halaman yang diperlukan oleh tracking tahfiz. **Layer ini bukan berarti MVP memiliki built-in Mushaf reader.** Fitur membaca mushaf penuh di dalam aplikasi ditunda ke fase berikutnya.

Entitas minimum:

```text
quran_mushafs
quran_juz
quran_pages
quran_surahs
quran_ayah_ranges
```

Lembaga harus dapat menentukan mushaf/standar halaman yang dipakai. NgajiTrack tidak boleh berasumsi semua mushaf memiliki pagination yang identik.

---

## 11. Reference Method A — Daarut Tahfiz Al Ikhlas

Metode ini menjadi salah satu referensi utama desain engine NgajiTrack.

### 11.1 Sabaq

Fungsi: hafalan baru.

Karakteristik:

- berbasis halaman;
- progres linear;
- sistem mengingat posisi terakhir;
- input berikutnya disarankan otomatis.

Contoh:

```text
Progres terakhir:
Juz 8 — Halaman 13

Saran hari ini:
Juz 8 — Halaman 14
```

### 11.2 Sabqi

Fungsi: murajaah hafalan baru/dekat.

Karakteristik:

- mengambil rentang hafalan terbaru ke belakang;
- referensi praktik: ±10 lembar ke belakang dari hafalan terbaru;
- rule harus configurable;
- perilaku saat melewati batas juz harus mengikuti aturan lembaga.

### 11.3 Manzil

Fungsi: murajaah hafalan lama secara berurutan.

Target dapat berbeda antar santri:

- 1 juz/hari;
- 1,5 juz/hari;
- 2 juz/hari;
- 3 juz/hari;
- target lain sesuai kebutuhan.

Sistem harus mampu mengingat rotasi terakhir dan menyarankan target berikutnya.

### 11.4 Mukammal

Fungsi: ujian tahfiz.

Bentuk:

- ujian 1 juz penuh;
- ujian blok 5 juz, misalnya 1–5, 6–10, 11–15, 16–20, 21–25, 26–30.

Aturan blok harus configurable.

Data minimum:

- santri;
- rentang juz;
- tanggal;
- penguji;
- status;
- catatan;
- nilai;
- jumlah/kategori kesalahan bila lembaga menggunakannya.

### 11.5 Persiapan Syahadah

Fungsi: pemantapan hafalan sebelum tahap akhir.

Target dapat meningkat bertahap, misalnya:

- 1,5 juz;
- 2 juz;
- 3 juz;
- 5 juz;
- 10 juz;
- 15 juz;
- target lanjutan;
- ready for final.

Urutan dan angka harus configurable karena dapat berbeda antar lembaga.

### 11.6 Syahadah

Fungsi: tahap akhir/khataman besar.

Contoh konteks:

- membaca hafalan dari juz 1–30;
- dilakukan di depan guru/penguji;
- dapat melibatkan audiens.

MVP hanya perlu menyimpan milestone dan hasil. Sistem sertifikasi lanjutan ditunda.

---

## 12. Reference Method B — Sulaimaniyah

Metode ini menggunakan pendekatan putaran halaman.

Konsep utama:

- santri menghafal halaman tertentu pada seluruh juz dalam satu putaran;
- dimulai dari bagian belakang setiap juz;
- setelah satu putaran selesai, berpindah ke halaman sebelumnya;
- berlanjut sampai seluruh halaman selesai.

Contoh konseptual:

```text
Putaran 1:
Page-in-juz 20
Juz 1 → 30

Putaran 2:
Page-in-juz 19
Juz 1 → 30

Putaran 3:
Page-in-juz 18
...
```

Nomor halaman dan aturan detail harus configurable sesuai standar mushaf/metode lembaga.

State minimum:

```text
current_cycle
current_page_in_juz
current_juz
completed_juz_in_cycle
```

NgajiTrack tidak cukup hanya menyimpan “sudah hafal X juz”. Sistem harus memahami posisi santri di dalam putaran.

---

## 13. Tahfiz Method Engine

NgajiTrack membutuhkan engine yang menghubungkan:

```text
PROGRAM
  ↓
METHOD
  ↓
STAGE
  ↓
RULE
  ↓
PROGRESS UNIT
  ↓
PROGRESS STATE
```

Engine harus mampu:

- menjalankan preset NgajiTrack;
- menjalankan preset metode referensi;
- menerima custom label lembaga;
- menghasilkan target berikutnya;
- menentukan progress state;
- memvalidasi input;
- menghindari progress yang tidak logis;
- menyimpan riwayat.

Tidak boleh ada logic seperti:

```text
if institution == "Daarut Tahfiz":
    ...
```

Metode harus berbasis konfigurasi/preset.

---

## 14. Teacher Experience — Core Principle

Ustaz tidak boleh merasa sedang mengisi database.

UI ustaz harus terasa seperti:

> **menandai progres santri.**

Prinsip:

- quick tap;
- minim keyboard;
- default otomatis;
- hanya isi pengecualian;
- satu layar per sesi;
- tidak kembali ke dashboard setiap santri;
- Save & Next;
- Undo;
- Reset;
- history tersedia tetapi tidak mengganggu flow utama.

---

## 15. Quick Input — Page Based

Untuk hafalan berbasis halaman, UI utama ustaz menggunakan **akumulasi tap**.

Contoh:

```text
Ahmad
Juz 7
Progress terakhir: 8/20

Tambah progres hari ini:

[ +½ ] [ +1 ] [ +2 ] [ Lainnya ]
```

Tombol dapat ditekan berkali-kali.

Contoh:

```text
Tap +1
Tap +1

Draft:
+2 halaman

Hasil sementara:
8/20 → 10/20
```

---

## 15A. Quick Input — Quran Reading / Iqra-style

Untuk kelas baca Al-Qur'an, target UX tetap **2–5 detik per santri** untuk kondisi normal.

UI default harus sangat sedikit tombol dan menggunakan akumulasi tap. Contoh:

```text
Aisyah
Iqra 3 — mulai Hal. 18

[ +1 ] [ +2 ] [ ULANG ] [ DETAIL ]
```

Tombol `+1` dan `+2` dapat ditekan berulang seperti operasi penjumlahan.

Contoh:

```text
+2
+2
= +4 halaman

Mulai Hal. 18
Selesai Hal. 21
Posisi berikutnya: Hal. 22
```

Jika `ULANG` dipilih, halaman tidak otomatis maju. Sistem dapat menampilkan issue tag cepat seperti:

```text
Kelancaran
Makhraj
Panjang-pendek
Huruf tertukar
Lainnya
```

Mengetik kata/bacaan spesifik yang bermasalah **opsional**, hanya digunakan jika ustaz memang membutuhkan detail. Prinsip utama tetap:

> **Tap untuk kasus normal, detail hanya untuk pengecualian.**

Semua tap tetap mengikuti Draft/Undo/Reset dan offline-resilient flow.

---

## 16. Draft Before Save

Semua input akumulatif wajib memiliki state draft.

Contoh:

```text
Progres awal      8/20
Tambahan          +2
Hasil sementara   10/20
```

Tidak boleh langsung commit setiap tap ke database. Commit dilakukan saat tindakan simpan.

---

## 17. Undo, Reset, Manual Edit

MVP minimal memiliki:

### Undo
Membatalkan tap terakhir.

### Reset
Menghapus seluruh perubahan draft sesi tersebut.

### Manual Edit
Digunakan bila kasus tidak dapat diselesaikan dengan quick input.

---

## 18. Page Boundary Behavior

Jika progres mencapai akhir halaman dalam satu juz, sistem tidak otomatis melompat tanpa konfirmasi.

Contoh:

```text
18/20
+1
+1
= 20/20
```

Jika ustaz mencoba menambah lagi, tampilkan:

> **Juz ini selesai. Lanjut ke juz berikutnya?**

---

## 19. Assessment

Assessment harus dapat dikonfigurasi.

Preset sederhana:

```text
Lancar
Cukup
Ulang
```

Alternatif:

```text
A
B
C
D
```

atau:

```text
1–100
```

Kategori tambahan dapat diaktifkan, seperti kelancaran, tajwid, fashahah, dan makharij.

---

## 20. Exception-First Input

NgajiTrack menggunakan prinsip:

> **Record the exception, not everything.**

Jika kondisi normal sudah sesuai default lembaga, ustaz tidak perlu menekan semuanya.

---

## 21. Quick Notes

NgajiTrack menyediakan quick notes bawaan.

Contoh:

- Sangat baik
- Kurang lancar
- Perbaiki tajwid
- Perbaiki makharij
- Perlu murajaah
- Ulang besok

Ustaz dapat menambah quick notes personal miliknya sendiri. Admin lembaga juga dapat menyediakan quick notes default untuk seluruh lembaga.

---

## 22. Teaching Session Flow

```text
Buka NgajiTrack
  ↓
Mulai Sesi
  ↓
Pilih Halaqah / Kelas
  ↓
Santri pertama
  ↓
Smart recommendation
  ↓
Quick input
  ↓
Assessment / quick note bila perlu
  ↓
Save & Next
  ↓
Santri berikutnya
```

---

## 23. Smart Continue

NgajiTrack mengingat progres terakhir dan menyarankan target berikutnya secara otomatis.

Contoh:

```text
Kemarin:
Juz 7 — Halaman 8

Hari ini:
Saran → Halaman 9
```

---

## 24. Class Quick View

MVP dapat memiliki mode cepat dari daftar:

```text
Ahmad      +1    Lancar
Aisyah     +1    Lancar
Fahri      Ulang Cukup
Zaid       +2    Lancar
```

Detail dibuka hanya jika diperlukan.

---

## 25. Focus Teaching Mode

NgajiTrack harus memiliki konsep **Mode Mengajar**.

Tujuan:

- mengurangi distraksi;
- menjaga fokus ustaz saat menyimak;
- membuat NgajiTrack menjadi UI dominan selama sesi.

Fitur:

- fullscreen/immersive mode bila platform mendukung;
- status bar disembunyikan saat mode aktif bila memungkinkan;
- UI quick input langsung tampil;
- layar tidak dipenuhi elemen non-esensial;
- tombol jelas untuk mengakhiri sesi.

### Android

Jika izin pengguna tersedia:

- Do Not Disturb dapat diintegrasikan sesuai kemampuan Android;
- immersive fullscreen dapat digunakan;
- sistem harus mengembalikan state sebelumnya setelah sesi berakhir.

### iOS

Implementasi harus mengikuti batasan platform Apple. Tidak boleh menjanjikan kontrol DND yang sama dengan Android jika OS tidak mengizinkan.

Mode Mengajar harus bersifat **opsional** untuk ustaz.

---

## 26. Student Progress UI

Santri menggunakan UI progres visual, bukan quick input. Tampilan harus **program-aware**: santri Tahfiz melihat progres hafalan/murajaah, sedangkan santri Quran Reading melihat metode, jilid/level, halaman terakhir, dan progres menuju level berikutnya.

Untuk sistem 20 halaman per juz:

```text
JUZ 7

01 ✓  02 ✓  03 ✓  04 ✓  05 ✓
06 ✓  07 ✓  08 ✓  09 ●  10 ○
11 ○  12 ○  13 ○  14 ○  15 ○
16 ○  17 ○  18 ○  19 ○  20 ○
```

UI ini hanya viewer progres. Santri tidak boleh mengubah progress record ustaz.

---

## 27. Guardian Progress UI

Wali menggunakan pola visual serupa santri, dengan tambahan:

- aktivitas terbaru;
- catatan ustaz;
- target;
- history;
- ringkasan progres.

Dashboard wali harus **menyesuaikan metode lembaga**.

---

## 28. Institution Monitoring

Admin Lembaga harus dapat melihat progres santri.

MVP minimal:

- progres individual;
- progres per halaqah;
- posisi hafalan;
- aktivitas terbaru;
- status ujian;
- santri yang tidak ada progres dalam periode tertentu;
- ringkasan kelas;
- kalender/jadwal dasar santri/kelas;
- NgajiTrack Score dan komponennya untuk program yang mengaktifkannya.

Advanced analytics dapat ditunda.

---

## 29. Core Data Entities

Database minimum:

```text
profiles
institutions
institution_members
students
teachers
guardians
guardian_students
groups
teacher_assignments
programs
program_enrollments
program_types

reading_method_configs
reading_progress_states

method_presets
method_configs
method_stages
method_rules

quran_mushafs
quran_juz
quran_pages
quran_surahs
quran_ayah_ranges

learning_sessions
submissions
assessments
progress_states
quick_notes
notes

ngajitrack_score_snapshots
student_calendar_events
institution_poster_templates
poster_assets

audit_logs
```

Nama final table dapat berubah saat technical design, tetapi domain concept-nya harus tetap ada.

---

## 30. Progress State

Riwayat tidak boleh dihitung ulang dari nol setiap kali halaman dibuka. Setiap santri memiliki `progress_state` yang menyimpan posisi terkini. Riwayat detail tetap disimpan di `submissions`.

---

## 31. Data Security

Mandatory:

- data antar lembaga terisolasi;
- permission diverifikasi backend;
- frontend tidak menjadi satu-satunya pengaman;
- santri hanya melihat dirinya;
- wali hanya melihat anak yang terhubung;
- ustaz hanya melihat assignment;
- Admin Lembaga hanya melihat lembaganya;
- Super Admin memiliki kontrol platform sesuai kebutuhan, termasuk akses review progres/score santri bila diperlukan untuk operasional NgajiTrack, tetapi akses sensitif harus dibatasi oleh permission, tujuan yang sah, dan audit log.

---

## 32. Password & Authentication

Password tidak pernah disimpan sebagai plaintext.

Tidak ada fitur:

> “Lihat password.”

Admin hanya dapat melakukan reset password atau tindakan recovery yang aman.

---

## 33. Audit Trail

Perubahan data penting harus tercatat.

Contoh:

```text
Before:
Juz 5, Page 8

After:
Juz 5, Page 9

Changed by:
Teacher X

Timestamp:
...
```

Audit minimal mencatat actor, action, entity, old value, new value, timestamp, dan institution.

---

## 34. Soft Delete

Data tahfiz penting tidak boleh langsung hilang permanen hanya karena tombol delete.

Gunakan konsep seperti:

```text
deleted_at
deleted_by
```

---

## 35. Architecture Principle

NgajiTrack dibangun dengan:

```text
Frontend
   ↓
Backend / API / Business Logic
   ↓
Database
```

Web, PWA, Flutter, dan native app di masa depan harus menggunakan backend yang sama.

Tidak boleh ada business logic utama yang hanya hidup di Flutter atau hanya hidup di web.

---

## 36. Platform Strategy

### MVP

- **Flutter mobile app** untuk Ustaz, Wali, dan Santri;
- Web Admin responsive untuk Super Admin dan Admin Lembaga;
- satu backend dan database yang sama untuk seluruh role;
- Flutter menggunakan role/context-aware navigation sehingga pengalaman dapat berbeda tanpa membuat database terpisah.

### Setelah MVP tervalidasi

Platform dapat diperluas ke iOS, web/PWA tambahan, atau client lain menggunakan backend yang sama. Jika client berubah, database dan business logic inti tidak perlu dibangun ulang.

---

## 37. Environment

Wajib tersedia:

```text
Development
Staging
Production
```

Tidak boleh testing berbahaya langsung di Production.

---

## 38. MVP Build Order

### Phase 0 — Specification

Buat:

- `PRODUCT_SPEC.md`
- `ARCHITECTURE.md`
- `DATABASE.md`
- `METHODS.md`

### Phase 1 — Foundation

- repo;
- environments;
- database;
- auth;
- migrations;
- basic logging;
- test framework.

### Phase 2 — Institution Core

- institutions;
- membership;
- role;
- program;
- halaqah;
- assignments.

### Phase 3 — User Core

- santri;
- ustaz;
- wali;
- guardian relationship;
- enrollment.

### Phase 4 — Quran Reference Core

- juz;
- surah;
- ayat;
- halaman/reference mapping seperlunya;
- konfigurasi mushaf/standar halaman untuk tracking;
- **tidak membangun built-in Mushaf reader pada MVP**.

### Phase 5 — Program & Method Engine

- program types (Tahfiz / Quran Reading / Custom);
- presets;
- stages;
- rules;
- progress units;
- progress state;
- submissions.

### Phase 6 — NgajiTrack Default Preset

- Hafalan Baru;
- Penguatan;
- Murajaah Berkala;
- Ujian Tahfiz;
- Pemantapan Akhir;
- Final.

### Phase 7 — Daarut Tahfiz Reference Preset

Implementasikan behavior Sabaq, Sabqi, Manzil, Mukammal, Persiapan Syahadah, dan Syahadah.

### Phase 8 — Sulaimaniyah Reference Preset

Implementasikan cycle, page-in-juz, current juz, completion state, dan progression rule.

### Phase 9 — Admin UI

Super Admin dan Admin Lembaga.

### Phase 10 — Teacher Mode (Program-Aware)

- teaching session;
- quick input;
- accumulative tap;
- draft;
- undo;
- reset;
- smart continue;
- quick notes;
- Save & Next;
- class quick view;
- Tahfiz quick input;
- Quran Reading quick input (`+1`, `+2`, `ULANG`, `DETAIL`).

### Phase 11 — Santri & Wali

- program-aware progress viewer;
- history;
- target;
- notes;
- kalender/jadwal dasar;
- NgajiTrack Score viewer bila aktif;
- institution-specific dashboard.

### Phase 12 — Reports & Poster Foundation

- individual progress report;
- basic PDF;
- class summary;
- poster progress generator berbasis template;
- basic institution branding;
- watermark logo NgajiTrack wajib pada hasil poster.

### Phase 13 — QA & Security

- permission;
- cross-institution access;
- duplicate input;
- progress boundary;
- audit;
- restore;
- concurrency;
- invalid state.

---

## 39. Pilot Data

Sebelum data nyata, staging harus memiliki minimal 2 lembaga dummy.

### Dummy Institution A

Metode: Daarut Tahfiz-style

- 30 santri;
- beberapa ustaz;
- beberapa wali.

### Dummy Institution B

Metode: Sulaimaniyah-style

- 30 santri;
- beberapa ustaz;
- beberapa wali.

### Dummy Institution C

Metode: Quran Reading / Iqra-style

- minimal 20 santri;
- minimal 1 kelas baca Al-Qur'an;
- struktur jilid/level dan halaman configurable;
- quick input `+1`, `+2`, `ULANG`, `DETAIL`.

Simulasikan minimal 1 bulan data.

---

## 40. Pilot Metrics

Yang diukur:

### Teacher Efficiency

- waktu input per santri;
- jumlah tap;
- jumlah keyboard usage;
- jumlah salah input;
- jumlah undo/reset;
- waktu satu sesi kelas.

### Admin Usability

- waktu setup lembaga;
- kesulitan konfigurasi metode;
- jumlah bantuan yang diperlukan.

### Guardian Clarity

- apakah wali memahami progres;
- apakah istilah mudah dipahami;
- apakah data yang ditampilkan cukup.

### Reliability

- data tidak hilang;
- progress state konsisten;
- tidak terjadi cross-institution leak.

---

## 41. MVP Success Criteria

MVP dinyatakan siap pilot nyata jika:

- [ ] Super Admin dapat membuat lembaga.
- [ ] Admin Lembaga dapat mengatur program dan halaqah.
- [ ] Ustaz, santri, dan wali dapat dihubungkan.
- [ ] Satu akun dapat memiliki membership yang benar.
- [ ] NgajiTrack default preset berjalan.
- [ ] Daarut Tahfiz-style preset berjalan.
- [ ] Sulaimaniyah-style preset berjalan.
- [ ] Ustaz dapat input dengan quick tap.
- [ ] Tombol akumulatif bekerja.
- [ ] Undo/reset bekerja.
- [ ] Draft tidak langsung commit.
- [ ] Smart Continue bekerja.
- [ ] Progress state otomatis berubah.
- [ ] Wali melihat progres anaknya.
- [ ] Santri melihat progres dirinya.
- [ ] Admin Lembaga melihat progres lembaganya.
- [ ] Dashboard mengikuti metode/program lembaga.
- [ ] Kelas Tahfiz dan Quran Reading menghasilkan UI ustaz yang berbeda sesuai kebutuhan.
- [ ] Quick input Quran Reading `+1/+2/ULANG/DETAIL` bekerja dengan akumulasi tap.
- [ ] Jumlah halaman per jilid/level Quran Reading dapat dikonfigurasi lembaga.
- [ ] Permission backend berfungsi.
- [ ] Cross-institution access ditolak.
- [ ] Password tidak dapat dibaca.
- [ ] Audit log berfungsi.
- [ ] Basic report tersedia.
- [ ] Fondasi NgajiTrack Score dapat menyimpan snapshot dan komponen penilaian.
- [ ] Poster progres dapat dihasilkan on-demand dari template tanpa menyimpan file final permanen.
- [ ] Watermark logo NgajiTrack selalu muncul kecil di pojok bawah poster.
- [ ] Backup/recovery dasar tersedia.
- [ ] Staging test lolos.
- [ ] Bulk import santri dapat diproses dalam batch.
- [ ] Akun santri existing dapat di-link secara aman ke lembaga baru.
- [ ] Histori lembaga lama tidak hilang saat santri pindah/tamat.
- [ ] Enrollment lembaga baru tidak menimpa enrollment lama.
- [ ] Semua role membaca progres dari satu source of truth.
- [ ] Input ustaz auto-save sebagai draft lokal sebelum konfirmasi.
- [ ] Internet terputus tidak menghilangkan draft/setoran yang belum tersinkron.
- [ ] Queue sync tidak membuat submission ganda.
- [ ] Konflik sinkronisasi terdeteksi dan tidak silent overwrite.
- [ ] UI menggunakan design system reusable.

---

## 42. Product Design Principles

1. **Simple by Default** — tampilkan hal paling penting lebih dulu.
2. **Progressive Disclosure** — detail hanya muncul saat diperlukan.
3. **Tap Before Type** — jika bisa tap, jangan paksa mengetik.
4. **Smart Defaults** — gunakan data sebelumnya untuk rekomendasi.
5. **Exception First** — catat penyimpangan, bukan semua hal normal.
6. **Role-Specific UI** — UI tiap role boleh berbeda.
7. **Method-Aware** — UI mengikuti metode lembaga.
8. **Safe by Architecture** — security tidak bergantung pada UI.
9. **Mobile-First for Field Users** — ustaz, wali, santri diprioritaskan untuk HP.
10. **Maintainable** — hindari solusi cepat yang menyulitkan scale.
11. **Clean & Modern** — visual harus ringan, rapi, profesional, dan tidak terasa seperti template dashboard generik.
12. **One Design System, Different Experiences** — branding dan komponen konsisten, tetapi tiap role memiliki UX sesuai tugasnya.
13. **Offline-Resilient for Teaching** — kelas tidak boleh berhenti hanya karena koneksi internet tiba-tiba hilang.
14. **Revisable UI** — layout dan visual harus dibangun dari komponen reusable agar dapat diiterasi tanpa mengubah core data.
15. **Program-Aware UI** — role yang sama dapat melihat UI berbeda sesuai program/kelas yang sedang dibuka.
16. **No Forced Gamification** — jangan menambahkan streak atau mekanisme yang mendorong user membuka aplikasi hanya demi mempertahankan angka.

---

## 43. Naming & Brand

Nama produk: **NgajiTrack**  
Parent brand: **Aseera**

NgajiTrack harus memiliki identitas visual sendiri, tetapi tetap dapat menunjukkan afiliasi ke Aseera secara proporsional.

---

## 44. Future Expansion

Setelah MVP tervalidasi:

- Personal Mode / penggunaan individu non-lembaga;
- built-in Mushaf reader resmi;
- payment gateway;
- invoice otomatis;
- subscription;
- Home Supervisor;
- push notification;
- full offline sync untuk seluruh fitur (setelah offline-resilient teacher input MVP terbukti);
- advanced report;
- institutional analytics;
- parent activity tracking;
- certificate;
- advanced poster editor drag-and-drop (shape, gradient, layer, font, shadow, border, opacity, asset library);
- additional tahfiz presets;
- API integration;
- enterprise controls;
- multi-branch institution;
- advanced disaster recovery;
- observability;
- scale infrastructure.

---

## 45. Product Rule for Future Development

Setiap fitur baru harus menjawab:

1. Masalah nyata apa yang diselesaikan?
2. Role mana yang membutuhkan?
3. Apakah fitur mempercepat atau justru memperumit?
4. Apakah bisa dibuat sebagai konfigurasi tanpa merusak core?
5. Apakah menambah risiko security?
6. Apakah berdampak ke metode lembaga lain?
7. Apakah kompatibel dengan web dan mobile?
8. Apakah membutuhkan perubahan database?
9. Apakah perlu audit?
10. Apakah layak masuk MVP atau sebaiknya ditunda?

Jika sebuah fitur hanya “terlihat keren” tetapi tidak menyelesaikan kebutuhan nyata, fitur tidak menjadi prioritas.

---

## 46. Final MVP Product Statement

NgajiTrack MVP adalah platform pembelajaran Al-Qur'an multi-lembaga dengan satu sistem backend yang aman, mendukung program Tahfiz dan Quran Reading yang dapat disesuaikan, memiliki preset bawaan NgajiTrack, dan memberi ustaz pengalaman input cepat berbasis tap yang menyesuaikan jenis program.

MVP harus membuktikan bahwa:

> **NgajiTrack dapat mengubah proses pencatatan pembelajaran Al-Qur'an dari pekerjaan administratif yang lambat menjadi aktivitas yang cepat, konsisten, dan tetap mengikuti metode masing-masing lembaga.**

---

## 47. Assisted Setup / Custom Method Setup

NgajiTrack menyediakan dua jalur konfigurasi metode lembaga.

### 47.1 Self-Service

Admin Lembaga dapat memilih preset NgajiTrack lalu menyesuaikan nama tahap, aktif/nonaktif tahap, urutan, unit progres, target, review window, standar penilaian, quick notes, visibilitas, dan transition rule yang didukung Method Engine.

### 47.2 Assisted Setup oleh Tim NgajiTrack

Jika lembaga tidak ingin repot menyusun sendiri, lembaga dapat meminta tim NgajiTrack menyiapkan konfigurasi. Mereka dapat mengirim foto buku/lembar monitoring, SOP tahfiz, contoh laporan, istilah internal, target hafalan, sistem murajaah, aturan ujian, standar kelulusan, tahapan pemantapan, dan contoh alur santri nyata.

Alur:

```text
Lembaga mengirim sistem
→ Tim NgajiTrack menganalisis
→ Konfigurasi dibuat dengan Method Engine
→ Preview
→ Revisi
→ Approval lembaga
→ Publish
```

Assisted setup normalnya menghasilkan **konfigurasi**, bukan custom code khusus satu lembaga. Jika kebutuhan baru belum dapat direpresentasikan oleh Method Engine, kebutuhan tersebut dievaluasi sebagai capability baru yang reusable untuk seluruh platform.

---

## 48. Bulk Onboarding untuk Lembaga Besar

NgajiTrack harus mengasumsikan satu lembaga dapat memiliki puluhan, ratusan, atau ribuan santri. Admin Lembaga tidak boleh diwajibkan membuat akun satu per satu.

Flow minimum:

```text
Upload/Import
→ Validate
→ Preview
→ Match existing accounts
→ Group results
→ Verification
→ Create/link records
→ Enrollment
→ Class/Halaqah assignment
```

Hasil batch minimal dikelompokkan menjadi: akun existing teridentifikasi, perlu verifikasi, belum memiliki akun, data tidak valid, dan potensi duplikat.

---

## 49. Identitas Santri: Global vs Lokal

NgajiTrack membedakan tiga identitas:

1. **ID/NIS Milik Lembaga** — nomor resmi/internal lembaga dan tidak dipaksa berubah.
2. **NgajiTrack Global Student Identity** — identitas portable dalam ekosistem NgajiTrack yang mengikuti santri lintas lembaga.
3. **Internal Database ID** — UUID teknis dan tidak perlu ditampilkan ke user.

NgajiTrack ID tidak wajib diisi saat pendaftaran ke lembaga baru. Bila tersedia, ID itu hanya mempercepat linking. NISN dapat menjadi salah satu sinyal matching bila tersedia, tetapi tidak boleh menjadi satu-satunya metode verifikasi.

---

## 50. Account Matching & Verification

Ketika lembaga mengimport santri baru, sistem boleh mencari kandidat akun existing. Matching tidak boleh hanya berdasarkan nama.

Sinyal matching dapat meliputi NgajiTrack ID, NISN bila tersedia dan penggunaannya sah, nomor HP/email terverifikasi, tanggal lahir, dan data relevan lain.

Status minimum:

```text
NO_MATCH
POSSIBLE_MATCH
NEEDS_VERIFICATION
VERIFIED_LINK
```

Sistem tidak boleh menggabungkan dua identitas secara diam-diam hanya karena similarity tinggi. Linking harus melalui verification flow yang sesuai.

---

## 51. Santri Tamat / Pindah Lembaga

Jika santri selesai dari Lembaga A lalu masuk Lembaga B:

```text
Akun NgajiTrack tetap
        │
        ├── Enrollment A
        │     status: GRADUATED / COMPLETED / TRANSFERRED
        │     histori: read-only
        │
        └── Enrollment B
              status: ACTIVE
              method: milik Lembaga B
              class: milik Lembaga B
              progress aktif: konteks Lembaga B
```

Data akademik lama tidak di-overwrite. Metode lembaga lama tidak otomatis menjadi metode aktif di lembaga baru.

---

## 52. Portable Tahfiz History

Santri dapat memiliki ringkasan riwayat tahfiz portabel. Dengan consent/verification yang sesuai, lembaga baru dapat menerima ringkasan seperti total hafalan, posisi terakhir, milestone, ujian yang pernah lulus, periode belajar, dan lembaga sumber.

Lembaga baru dapat menerima baseline, menerima sebagian, melakukan placement test, atau menetapkan baseline baru. Catatan internal lembaga lama tidak otomatis dibuka.

---

## 53. Ownership Kelas / Halaqah

Struktur resmi kelas/halaqah dikelola oleh **Admin Lembaga**. Admin dapat membuat kelas, menentukan ustaz, memasukkan/memindahkan santri, menutup kelas, dan melakukan bulk class assignment.

Ustaz dapat menjalankan sesi, mengatur urutan antrean, input progres, melihat santri yang ditugaskan, dan mengusulkan perubahan. Perubahan struktural tetap dilakukan/diapprove Admin Lembaga.

---

## 54. Cross-Account Consistency

Semua role harus membaca dan menulis ke **satu source of truth**.

```text
Ustaz input setoran
→ backend validasi
→ submission tercatat
→ progress state diperbarui
→ Admin Lembaga melihat progres terbaru
→ Santri melihat progres dirinya
→ Wali melihat progres anak sesuai visibility
```

Tidak ada database terpisah untuk ustaz, santri, wali, atau admin. UI boleh berbeda, tetapi data tetap terhubung. “Nyambung” tidak berarti semua role melihat semua data; permission tetap berlaku.

---

## 55. UI / UX Quality Standard

NgajiTrack harus tampil clean, modern, ringan, konsisten, profesional, mobile-first untuk ustaz/wali/santri, dan desktop-first tetapi responsive untuk admin.

Hindari dashboard terlalu padat, terlalu banyak card, warna berlebihan, icon tidak konsisten, form panjang, tampilan generik hasil template, dan teks teknis yang tidak perlu.

UI dibangun dari design system reusable: typography, spacing, color tokens, button, input, chips, cards, navigation, modal, toast, empty state, loading state, error state, dan progress component.

Tujuannya: UI dapat direvisi tanpa membongkar business logic atau database.

---

## 56. Auto-Saved Draft & Offline-Resilient Teaching

Karena jaringan di lapangan dapat tidak stabil, input ustaz harus bersifat **offline-resilient** sejak MVP.

### 56.1 Auto-Save Draft

Setiap perubahan penting pada sesi input, seperti `+½`, `+1`, `+2`, assessment, quick note, atau edit target, langsung disimpan sebagai **draft lokal yang durable** sebelum konfirmasi. Draft tidak boleh hanya hidup di memory sementara.

### 56.2 Confirm Tidak Bergantung pada Internet Langsung

```text
Draft lokal
→ Finalized locally
→ Sync queue
→ kirim ke backend
```

Jika internet tersedia: `SYNCED`. Jika internet hilang: `PENDING_SYNC`. Ustaz tetap dapat lanjut ke santri berikutnya.

### 56.3 Status Sinkronisasi

UI harus membedakan: Draft, Tersimpan di perangkat, Menunggu sinkronisasi, Tersinkron, dan Konflik/perlu perhatian. Jangan menyebut “tersinkron” jika data baru tersimpan lokal.

### 56.4 Cache Minimum Saat Sesi

Client ustaz minimal menyimpan/cache daftar santri kelas aktif, assignment, progress state terakhir yang berhasil disinkronkan, method config yang diperlukan, quick notes, grading scheme, serta draft/queue aktif.

### 56.5 Idempotent Sync

Setiap submission queued mempunyai `client_request_id` unik agar retry tidak menghasilkan submission ganda.

### 56.6 Conflict Detection

Jika server memiliki progress version lebih baru daripada draft offline, NgajiTrack tidak boleh melakukan silent overwrite. UI harus meminta review/merge yang aman.

### 56.7 Scope MVP

MVP tidak harus membuat seluruh platform full offline. Prioritasnya adalah **sesi input ustaz tidak kehilangan data dan tetap dapat berlanjut ketika internet tiba-tiba hilang**.

---

## 57. Stability & Engineering Execution Requirements

Astra/coding agent harus memperlakukan stabilitas end-to-end sebagai requirement produk, bukan sekadar membuat halaman berhasil tampil.

Sebelum fitur dianggap selesai, Astra harus memastikan UI flow, backend logic, permission, transaction, progress state, audit, error/loading state, retry, duplicate protection, offline queue, cross-account visibility, tenant isolation, test, dan staging flow semuanya benar.

### 57.1 Mandatory End-to-End Flow Test

```text
Admin membuat lembaga
→ setup method
→ import santri
→ buat kelas
→ assign ustaz
→ ustaz mulai sesi
→ ustaz input
→ internet putus
→ draft tetap ada
→ internet kembali
→ submission sync
→ progress state update
→ santri melihat progres
→ wali melihat progres anak
→ admin melihat progres kelas
```

### 57.2 No Silent Failure

Jika sync, calculation, permission, atau update gagal, sistem harus menampilkan status, mempertahankan data yang dapat dipulihkan, mencatat error, dan tidak diam-diam membuang input user.

### 57.3 No Feature-by-Feature Isolation

Fitur yang mengubah data belum dianggap selesai sampai role lain yang bergantung pada data tersebut menerima hasil yang benar.

---

## 58A. NgajiTrack Score — Tahfiz Performance Foundation

NgajiTrack Score digunakan untuk menggambarkan **kualitas perjalanan/performa tahfiz**, bukan menggantikan informasi jumlah hafalan.

Contoh:

```text
Hafalan terverifikasi: 30 Juz
NgajiTrack Score: 9.275 / 10.000
```

Dua santri yang sama-sama 30 juz dapat memiliki score berbeda karena proses dan kualitasnya berbeda.

Default komponen awal:

```text
Kualitas hafalan        35%
Retensi / murajaah      30%
Konsistensi             20%
Kecepatan progres       15%
```

Prinsip wajib:

- jumlah juz ditampilkan terpisah dan **tidak dihitung dua kali** sebagai komponen score;
- speed tidak berarti “siapa paling cepat secara nasional”;
- speed dibandingkan dengan target program/lembaga yang relevan;
- santri yang lebih lambat tidak boleh otomatis dianggap buruk bila kualitas dan retensinya tinggi;
- score harus dapat dijelaskan melalui komponen-komponennya;
- snapshot historis score disimpan agar perubahan dapat diaudit;
- formula default dapat dikembangkan kemudian, tetapi perubahan formula harus versioned.

NgajiTrack Score terutama ditujukan untuk konteks lembaga karena inputnya dapat bersumber dari ustaz/assessment yang lebih terverifikasi.

---

## 58B. Student Calendar & Progress Timeline

Halaman santri dapat memiliki kalender untuk menampilkan:

- jadwal setoran;
- jadwal murajaah;
- ujian;
- target;
- kegiatan lembaga;
- histori progres pada tanggal tertentu.

Kalender bukan pengganti histori record. Event kalender harus terhubung ke source of truth yang relevan.

---

## 58C. Progress Poster Generator

NgajiTrack menyediakan fondasi poster progres yang dapat dibuat **on-demand**.

Flow:

```text
User memilih capaian
→ backend mengambil data santri
→ mengambil template + branding lembaga
→ render poster
→ kirim file ke client
→ user download/share
→ file final tidak disimpan permanen
```

Yang disimpan permanen:

- template;
- konfigurasi layout;
- logo lembaga;
- warna/branding;
- asset library yang diizinkan;
- metadata template.

Yang tidak wajib disimpan:

- file poster final hasil render.

### Dynamic Placeholder

Template dapat memiliki placeholder seperti:

```text
{{student_name}}
{{achievement}}
{{institution_name}}
{{date}}
{{class_name}}
```

### Watermark NgajiTrack

Setiap poster wajib memiliki **logo asli NgajiTrack sebagai watermark kecil** di pojok kiri bawah atau kanan bawah.

Aturan:

- tidak dapat dihapus oleh lembaga;
- tidak boleh menutupi konten utama;
- ukuran kecil dan proporsional;
- posisi terbatas pada area bawah kiri/kanan;
- asset logo berasal dari file resmi NgajiTrack.

### Institution Editor

Arah jangka panjang editor mencakup:

- text;
- shape;
- warna;
- gradient;
- border;
- shadow;
- opacity;
- layer;
- alignment;
- font;
- logo;
- background;
- asset library.

Untuk MVP, implementasi boleh dimulai dari template + konfigurasi branding yang lebih terbatas selama schema/layout model tidak mengunci pengembangan editor advanced di masa depan.

Asset library dapat berisi asset original, asset berlisensi jelas, asset SVG/code-generated, dan asset berbantuan AI yang telah dikurasi. Asset yang hak penggunaannya tidak jelas tidak boleh dimasukkan.

---

## 58D. Alumni / Historical Data Behavior

Santri yang lulus atau pindah tetap memiliki histori lembaga lama dalam kondisi **read-only**.

Alumni yang tidak aktif tidak perlu menjalankan proses realtime atau aktivitas backend terus-menerus. Namun record historisnya tetap tersimpan dan menggunakan kapasitas database/storage sesuai jenis datanya.

Query operasional kelas aktif harus dirancang agar histori alumni tidak memperlambat flow mengajar.

---

## 58E. Super Admin Progress Review

Super Admin dapat memiliki akses terkontrol untuk melihat progres, milestone, dan NgajiTrack Score santri bila diperlukan untuk operasional platform, program penghargaan, review kualitas data, atau kegiatan NgajiTrack.

Akses tersebut:

- bukan akses bebas tanpa tujuan;
- harus dicatat dalam audit log;
- mengikuti prinsip least privilege;
- tidak memberikan hak untuk mengubah record akademik resmi sembarangan;
- bila santri masih di bawah umur dan akan dihubungi untuk kegiatan di luar lembaga, komunikasi harus melalui mekanisme lembaga/wali yang sesuai.

---

## 58F. Explicitly Deferred Features

Keputusan scope saat ini:

### Personal Mode

**Ditunda.**

NgajiTrack tidak membangun Personal Mode non-lembaga pada MVP. Fondasi arsitektur boleh tetap modular agar mode baru dapat ditambahkan melalui versi aplikasi berikutnya tanpa membongkar core institution system.

### Built-in Mushaf Reader

**Ditunda.**

NgajiTrack tetap boleh memiliki Quran reference data untuk tracking tahfiz, tetapi tidak menyediakan layar mushaf penuh pada MVP. Integrasi mushaf resmi akan dievaluasi setelah sumber, lisensi, tashih/izin, dan kebutuhan produk jelas.

---

## 58. Updated Product Principle

NgajiTrack harus terasa sederhana bagi pengguna walaupun sistem di belakangnya kompleks.

```text
Admin:
atur sekali, sistem berjalan.

Ustaz:
tap → tap → selesai.

Santri:
langsung tahu posisi dan target.

Wali:
langsung memahami perkembangan anak.

Tim NgajiTrack:
dapat membantu setup tanpa custom code liar.
```

Ketika koneksi buruk:

```text
input tetap aman
→ kelas tetap berjalan
→ sinkronisasi menyusul
```

Platform harus dirancang agar **stabil, terhubung antar-role, mudah direvisi, dan terus dapat dikembangkan tanpa kehilangan fondasi data.**

