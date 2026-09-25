# Laporan pengujian backend foundation

## Hardening 3 — scheduler expiry selesai (2026-09-25)

- Migration baru: supabase/migrations/20260925000800_expiry_scheduler.sql, sudah applied pada Supabase lokal utama. Migration 1–7 tidak berubah (SHA-256 identik). Tidak ada migration remote/cloud applied.
- Satu job aktif ngajitrack-expire-enrollments, interval 15 menit, batch 500. Execution role ngt_expiry_scheduler memakai worker existing; tidak SET ROLE service_role dan tidak mengubah worker/tabel/RLS produk.
- Role LOGIN tanpa password diperlukan pg_cron, menggunakan koneksi loopback internal yang sudah ada. Tidak mengubah HBA atau membuka trust baru. Login melalui port database publik ditolak; tidak memiliki SUPERUSER/BYPASSRLS/CREATEROLE/CREATEDB, membership role lain, CRUD tabel produk, atau akses pengelolaan cron. Client tidak dapat mengasumsikan role tersebut atau memanggil worker/cron.
- PostgreSQL memberi operator pembuat role (postgres) ADMIN-only membership otomatis, dengan SET=false dan INHERIT=false. Ini hak administrasi operator atas role, bukan privilege scheduler. Pemeriksaan migration menerima hanya bentuk tersebut; client/member lain tetap ditolak.
- Pembuktian mekanisme role terlebih dahulu lulus di container terpisah; migration 8 baru dibuat sesudah pembuktian. Scheduler final 13/13 lulus; verifikasi instance utama 8/8 lulus, termasuk replay migration transaksional oleh operator non-superuser.
- Eksekusi periodik nyata, rollback kegagalan/retry, duplikasi/no-op, akses saat scheduler terlambat, batas batch, serta backlog 1.101 dengan hasil 500,500,101,0 lulus. Audit closure tepat satu per enrollment. Interval test dipercepat 1 detik hanya di lab/probe; job utama tetap 15 menit.
- Probe cron sementara di instance utama benar-benar berhasil sebagai role khusus, kemudian di-unschedule. Tidak ada probe job tersisa. Kondisi probe mensyaratkan nol fixture jatuh tempo; worker mengembalikan 0. Fingerprint seluruh data public/auth.users dan kebijakan RLS/grant tabel produk sebelum/sesudah identik.
- Regresi foundation sebelumnya 76/76 (73 native + 3 embedded) dan concurrency 6/6 lulus pada perubahan runner; tidak diulang tanpa alasan pada kelanjutan apply. Scheduler 13/13 diulang setelah penyesuaian pemeriksaan operator. Lint public/private setelah apply: exit 0 tanpa temuan.
- Apply pertama gagal pada assertion membership operator dan rollback utuh: tidak ada role/extension/migration 8 yang tertinggal. Setelah koreksi assertion, uji instalasi aktual dalam transaksi + rollback lulus, apply kedua berhasil. Kesalahan awal harness/sintaks saat pengembangan diperbaiki; hasil final tidak memiliki kegagalan.
- Bukti lokal (diabaikan Git): reports/scheduler-role-proof.txt, scheduler-test.txt, scheduler-foundation-regression.txt, scheduler-concurrency-regression.txt, scheduler-apply.txt, scheduler-local-verification.json, scheduler-primary-periodic.json, scheduler-lint.txt, scheduler-migrations.json.
- File berubah: migration 8; scripts/scheduler-lab.mjs, prove-scheduler-role.mjs, test-scheduler.mjs, verify-scheduler-local.mjs, probe-scheduler-local.mjs; scripts/local-sandbox.mjs, tests/database.mjs, package.json; docs/SCHEDULER_PROPOSAL.md, docs/HARDENING.md, README.md; IMPLEMENTATION_STATUS.md dan TEST_REPORT.md.
- Batas: cron diuji nyata dengan interval dipercepat; belum menunggu satu siklus penuh 15 menit di utama. Timeout role 60 detik, lock timeout 5 detik; kegagalan dicatat cron.job_run_details dan dicoba pada run berikutnya. Monitoring/retensi log cron operasional masih manual. Konfigurasi autentikasi scheduler pada staging/cloud harus diverifikasi tersendiri.
- Langkah tepat berikutnya: laporkan milestone ini dan berhenti. Milestone 4 (upgrade native berisi data), milestone 5 (kontrak client), Web Admin dan Flutter tidak dikerjakan.

## Histori checkpoint sebelumnya

## Hardening 2 — concurrency native (2026-09-25)

Selesai: 6/6 test multikoneksi PostgreSQL lulus. Dua worker membagi batch tanpa closure/audit ganda; worker melewati root terkunci admin; admin menunggu worker atau admin lain lalu idempotent; perpindahan kelas setelah closure ditolak; closure yang menunggu perpindahan kelas menutup placement baru. Overlap dibuktikan lewat pg_stat_activity wait_event_type=Lock, bukan urutan panggilan semata. Fixture utama identik sesudah setiap skenario. Bukti lokal: reports/hardening-concurrency.txt.

File berubah: tests/concurrency.test.mjs, package.json, docs/HARDENING.md, IMPLEMENTATION_STATUS.md, TEST_REPORT.md. Tidak ada perubahan schema/security atau migration. Ini enam interleaving terkontrol, bukan pembuktian semua kemungkinan race. Langkah berikutnya: pemasangan dan pengujian scheduler expiry lokal.


## Hardening 1 — environment uji berulang (2026-09-25)

Selesai: scripts/local-sandbox.mjs dan scripts/test-isolated.mjs membuat database ngt_test_<UUID> terpisah, menyalin schema Auth tanpa pengguna/data dan menerapkan migration 1–7. Tidak melakukan reset pada postgres utama. Database uji milik run dihapus setelah selesai; fingerprint seluruh data public dan auth.users utama diperiksa tetap identik. Dua putaran test masing-masing 76/76 lulus (73 native + 3 embedded eksplisit), tanpa kegagalan. Bukti lokal reports/hardening-isolated.txt dan hardening-isolated-repeat.txt.

File berubah: kedua runner baru, package.json, IMPLEMENTATION_STATUS.md, TEST_REPORT.md, docs/HARDENING.md. Tidak ada migration atau perubahan grants/schema aplikasi. Batas: ini environment SQL native; tidak menjalankan instance Auth/PostgREST kedua. Langkah berikutnya: test concurrency multikoneksi untuk expiry dan penutupan.


Tanggal: 2026-09-24. Scope: backend foundation saja.

## Checkpoint terbaru — integrasi Supabase lokal LULUS

Tanggal 2026-09-24. Docker 29.8.0 (Client/Server), WSL2, CLI 2.117.0; PostgreSQL 17.6. Layanan dijalankan di instance lokal ngajitrack, tanpa remote project.

| Pemeriksaan | Hasil aktual | Bukti |
|---|---|---|
| Startup + migration 1–7 | Applied; history cocok; migration up tidak memiliki pending | reports/local-migrations.json |
| Migration SHA-256 | Seluruh 7 identik sebelum/sesudah | reports/local-migration-hashes-before.json dan after.json |
| SQL regression runner | 76/76 pass, 0 fail/skipped, 27,920 detik | reports/local-native-test.tap |
| Auth/JWT/PostgREST HTTP | 17/17 pass, 0 fail, 6,843 detik | reports/local-api-test.json |
| Lint schema public/private | Exit 0; results kosong; tidak ada warning/error | reports/local-lint.txt |
| Pemeriksaan akhir database/Auth | Auth HTTP 200; 18 tabel RLS, 9 akun sintetis, 2 institution, 7 migration | reports/local-database-summary.json |
| Port publik stack | Semuanya 127.0.0.1, bukan 0.0.0.0 | reports/local-runtime.txt |

**Pemisahan mesin test:** 73 dari 76 test SQL benar-benar dijalankan di PostgreSQL native. Tiga pengecualian eksplisit memakai PGlite: replay database bersih, reuse ID Auth fixture, dan upgrade berisi data migration 6 ke 7. Suite SQL mengatur role/klaim database; 17 check HTTP menggunakan JWT asli hasil login Supabase Auth dan koneksi PostgREST terpisah, tanpa Auth shim/fallback embedded.

Cakupan nyata yang lulus:

- Satu identity SANTRI aktif A+B; WALI+USTAZ pada institution sama; WALI A/USTAZ B; tiga role lintas konteks; assignment ADMIN tetap khusus.
- RLS membatasi SELECT/INSERT/UPDATE/RPC lintas tenant; identity binding dan direktori global terlindungi; assigned teacher/VERIFIED guardian dibatasi konteks yang sah.
- TEMPORARY/HOLIDAY wajib jadwal valid; awal/akhir dan timezone dipatuhi. Saat scheduled_end_at tercapai, operasi ditolak walaupun status masih ACTIVE dan worker belum dipanggil.
- Worker hanya service_role, menutup dua enrollment lewat API lalu retry menghasilkan 0. WALI/USTAZ yang valid tetap memiliki akses; ENDED tidak dapat diaktifkan ulang.
- Suite native membuktikan penutupan awal, pembatalan sebelum mulai, atomic rollback, liburan berikutnya memakai record baru dan identity lama, serta enrollment tenant asal tidak otomatis dicabut.
- Auth trigger satu profil per akun; role metadata tidak memberi ADMIN; password salah dan JWT palsu ditolak; refresh valid, logout membatalkan refresh session; profile disabled membatasi data meskipun JWT masih ada.

Tidak ada assertion yang gagal pada suite SQL/API. Masalah lingkungan yang ditemukan: PATH sesi belum diperbarui; opsi default binding bridge di Docker Desktop tidak cukup; Vector gagal mengakses Docker logs. Recreate awal gateway kehilangan sertifikat lokal; diperbaiki dengan pemulihan stack dan penyalinan direktori sertifikat pada helper. Test API dijalankan setelah gateway healthy. Re-run helper pada binding yang sudah benar lulus tanpa recreate.

Runtime akhir: layanan inti healthy dan port loopback. Vector sengaja dikecualikan (--exclude vector); pengumpulan log terpusat belum teruji. Fixture HTTP committed tetap tersimpan: sembilan akun sintetis dan dua institution. Tidak ada reset data setelah pengujian. Kredensial tidak disimpan di laporan; raw startup log dihapus setelah mengambil ringkasan aman.

Batas yang belum diuji: scheduler periodik (worker baru dipanggil manual), race/concurrency multikoneksi, upgrade berisi data di native, backup/restore serta staging/production. Hasil ini menuntaskan milestone lokal yang diminta, bukan verifikasi kesiapan production menyeluruh.

Langkah tepat berikutnya: laporkan checkpoint; pekerjaan backend berikutnya scheduler periodik dan concurrency dengan database/fixture lokal terkontrol. Tidak melanjutkan Flutter/UI.

---

## Histori persiapan — Supabase lokal saat itu BLOCKED

Belum ada migration diterapkan pada Supabase nyata dan belum ada assertion Auth/JWT/API/RLS melalui HTTP yang dijalankan. Tidak ada fixture HTTP committed. Hasil embedded di bawah tidak menggantikan integrasi nyata.

| Pemeriksaan | Hasil aktual |
|---|---|
| Docker/Podman | Tidak ditemukan |
| WSL status/list | Belum terpasang |
| Instalasi WSL dari sesi sekarang | Exit 1, WSL tetap belum terpasang |
| Virtualisasi | Windows melaporkan firmware virtualization False, hypervisor False, SLAT True |
| Privilege shell | Bukan Administrator |
| `supabase start` | Exit 1, LegacyDockerLifecycleInspectError: Docker/Podman tidak ditemukan |
| Auth health localhost:54321 | ECONNREFUSED |
| `node --check scripts/test-api.mjs` | Lulus syntax check; bukan bukti integrasi |
| `node scripts/test-api.mjs` | Exit 2 / BLOCKED: konfigurasi runtime lokal belum tersedia; 0 check, 0 pass, 0 fail |
| `node scripts/test-postgres.mjs` | Exit 1 sebelum test: URL database lokal belum tersedia |

Runner API baru mempersiapkan 17 skenario HTTP: login/JWT tervalidasi Auth, profil hasil trigger, role metadata tidak memberi ADMIN, password salah/JWT palsu, refresh, anon denial, scope admin tenant, cross-tenant writes, assigned teacher/verified guardian, kombinasi SANTRI/WALI/USTAZ, identity binding, jadwal kedaluwarsa, service-only expiry, histori ENDED, revocation per role, disabled profile, logout/refresh invalidation. Skenario tersebut **belum dieksekusi** terhadap layanan nyata.

Laporan mesin runner: `reports/local-api-test.json`. Runner menolak endpoint nonlokal/database tidak kosong dan tidak melakukan reset otomatis. Auth users dan fixture committed akan ditinggalkan pada database lokal sintetis ketika integrasi benar-benar dijalankan. Password/key/token tidak ditulis ke laporan.

File test berubah: fixture menerima ID hasil real Auth API, ditambah satu regression test embedded untuk jalur reuse ID. Migration 1–7 tidak diubah. Panduan prasyarat dan runbook: `docs/LOCAL_SUPABASE_VERIFY.md`.

Regresi terbaru: **76 tests, 76 pass, 0 fail, 0 skipped**, exit 0; terdiri dari 53 test foundation dan 23 test enrollment. Durasi 29,524 detik. Mesin embedded PGlite; bukti mentah `reports/local-preparation-regression.tap`. Test tambahan membuktikan fixture memakai ulang ID Auth yang telah disediakan tanpa menduplikasi akun.

Langkah berikutnya pada checkpoint historis saat itu: aktifkan virtualisasi firmware, siapkan WSL dan Docker engine, lalu jalankan migration 1–7 serta suite native/API sesuai runbook.

## Histori checkpoint migrasi 7

## Hasil

**75 tests, 75 pass, 0 fail, 0 skipped.** Terdiri dari 52 test foundation existing dan 23 test enrollment/role baru. Mesin: PostgreSQL 18.3 melalui PGlite 0.5.8. Bukti mentah: `reports/migration-7-test.tap`.

| Pemeriksaan | Hasil |
|---|---|
| Seluruh suite `node --test --test-reporter=tap --test-concurrency=1 tests/foundation.test.mjs tests/enrollments.test.mjs` | Lulus, exit 0 |
| `node scripts/check-migrations.mjs` | Lulus: replay tujuh migrasi, 18 tabel dengan RLS aktif |
| Upgrade database berisi fixture dari migration 6 ke 7 | Lulus: kolom legacy/status/histori dan jumlah audit tidak berubah; tipe existing REGULAR |
| SHA-256 keenam migration existing | Identik sebelum dan sesudah pekerjaan |
| `node scripts/test-postgres.mjs` | Terblokir sebelum test: exit 1, `No database URL was provided.` |

Putaran awal 69/69 lulus. Setelah review, ditambahkan pengujian zona waktu, pembatalan sebelum mulai, batas mulai, PENDING kedaluwarsa, rollback atomik, dan batas batch. Putaran final 75/75 lulus. Tidak ada kegagalan assertion pada kedua putaran tersebut.

## Cakupan tambahan

- SANTRI aktif di A/B memakai satu identity, tanpa penutupan otomatis di A.
- WALI + USTAZ pada lembaga sama; pencabutan link wali tidak mencabut assignment ustaz.
- WALI A + USTAZ B dengan scope akses terpisah.
- SANTRI + WALI + USTAZ lintas konteks tanpa akun tambahan atau privilege ADMIN.
- Pengakhiran assignment ustaz mempertahankan akses wali yang sah.
- Temporary/holiday wajib periode valid, finite, terurut; tidak ada pasangan start_at/end_at duplikat.
- Sebelum started_at tidak mendapat akses operasional.
- Tepat scheduled_end_at dan setelahnya: roster ustaz serta mutasi turunan/pindah kelas ditolak walaupun status tersimpan masih ACTIVE; histori wali tetap tersedia sesuai izin.
- Zona waktu lembaga dipakai terlepas dari timezone session; diuji Pacific/Kiritimati dan Etc/GMT+12. Zona tidak valid dan pergantian zona ketika jadwal terbuka ditolak.
- Enrollment kedaluwarsa tidak dapat dihidupkan lewat penggeseran jadwal atau perubahan tipe.
- Penutupan lebih awal/ulang dan pembatalan rencana sebelum mulai: tanggal aktual di-stamp server, turunan ditutup, audit tidak digandakan.
- Penutupan manual maupun worker mempertahankan role WALI/USTAZ, guardian link, teacher assignment dan enrollment lembaga lain.
- Direct UPDATE ENDED tidak melewati penutupan hierarki; histori ENDED tidak bisa direaktivasi atau soft-delete.
- Worker menutup ACTIVE/PENDING kedaluwarsa, memvalidasi ukuran batch, idempotent, mencatat SYSTEM dan tanggal proses sebenarnya.
- Kegagalan child closure sintetis me-rollback parent, turunan, dan audit.
- Liburan berikutnya membuat enrollment/program/class baru dengan identity/profil lokal yang sama.
- Admin tenant lain, role biasa, dan anon tidak dapat menutup/mengubah/membaca enrollment asing atau memanggil worker service-only.

## Batas verifikasi

Hasil embedded tidak membuktikan integrasi Supabase Auth/JWT/PostgREST atau konfigurasi PostgreSQL 17 native. Runner native sudah mencakup kedua suite, tetapi belum memiliki URL database lokal. Tidak menyalakan Supabase, memasang Docker, menghubungkan project remote, atau menerapkan migration ke remote.

Worker expiry tersedia dan diuji; pemanggilan periodik belum dipasang. Keamanan masa berlaku tidak menunggu worker, tetapi perubahan status tersimpan menjadi ENDED tetap memerlukan worker/command penutupan.

Row locking dan rollback diuji pada embedded satu koneksi; concurrency beberapa koneksi dan scheduler nyata tetap milestone berikutnya. Matching/verifikasi identity otomatis serta consent sharing belum dibangun. Provisioning role/link tetap server-only setelah verifikasi.

## Langkah berikutnya

Laporkan hasil migrasi 7 dan berhenti pada checkpoint ini. Setelah melanjutkan milestone Supabase lokal: apply seluruh migration, jalankan `pnpm test:postgres`, uji Auth/JWT/API dan RLS multi-tenant nyata, pasang/uji worker periodik, uji concurrency, lalu perbarui laporan ini dan IMPLEMENTATION_STATUS.md.
