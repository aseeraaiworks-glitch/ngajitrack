# NgajiTrack by Aseerakarsa
**Live:** https://aseerakarsa.com | **Contact:** astra@aseerakarsa.com | **Since:** Sep 2024

> Al-Qur'an habit tracker - Bandar Lampung, Indonesia

---

Backend Supabase/PostgreSQL migration 1–11 dan aplikasi web multi-role di `apps/web`, berdasarkan dokumen dalam `docs/` serta keputusan pengguna. Fondasi Auth/context/App Shell/Sentry 12.1–12.6 dilanjutkan dengan pengelolaan struktur lembaga (13.1): program, tingkatan, relasi program-level dan kelas/halaqah. Tidak ada Flutter, Personal Mode, Mushaf reader, teaching flow, analytics, laporan produk atau pembayaran.

Status lengkap dan langkah melanjutkan ada di [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).

## Checkpoint aplikasi — 13.1

Panduan fondasi: [MILESTONE_12.md](docs/MILESTONE_12.md). Kontrak, permission dan batas struktur lembaga: [MILESTONE_13.md](docs/MILESTONE_13.md).

```sh
pnpm install --frozen-lockfile
pnpm dev:web:local
```

Supabase lokal existing harus aktif. Buka `http://127.0.0.1:3000/login` dan gunakan akun existing. Perintah lokal membaca publishable key ke memori; tidak menulis credential. Setelah login, aplikasi memuat membership/scope backend, memilih satu context valid atau menampilkan halaman pilihan. Shell memakai sidebar desktop dan drawer tablet/mobile. Tombol **Ganti konteks** memvalidasi ulang lembaga, peran dan fokus program sebelum berpindah; URL setiap tab tetap independen. Navigasi menuju ringkasan/pilihan context yang sudah tersedia. Online/Offline hanya menunjukkan koneksi perangkat; sinkronisasi offline belum tersedia. Pengujian browser: `pnpm test:web` memakai environment terpisah tanpa DSN dan tidak mereset fixture utama.

Mode Admin Lembaga memiliki menu **Struktur lembaga**. Operasi memakai JWT pengguna, validasi konteks server dan RLS existing. Penonaktifan mempertahankan histori; perpindahan konteks akademik kelas lama mengikuti guard backend. Tidak ada migration tambahan.

Sentry tidak aktif bila DSN kosong. Panduan aktivasi env, privacy dan optional source-map CI: [OBSERVABILITY.md](docs/OBSERVABILITY.md). `node scripts/test-web.mjs --monitoring` menguji SDK enabled melalui receiver lokal, tanpa mengirim data ke project eksternal. Berhenti setelah 13.1; belum memulai 13.2.

## Backend — migration 1–11

Migration 11 terpasang lokal: struktur program/learning type/tingkatan, scope kepemimpinan, governance satu Mudir aktif, dan inheritance konfigurasi. Migration 1–10 tidak diubah. Detail schema, RPC, governance, gap dan perintah uji: [MIGRATION_11.md](docs/MIGRATION_11.md). Kontrak client existing tetap ada di [BACKEND_CONTRACT.md](docs/BACKEND_CONTRACT.md).

Runner terkini yang dapat diulang tanpa reset fixture utama:

```sh
pnpm test:governance
pnpm test:upgrade
pnpm test:workflow-sql
pnpm test:workflow-api
pnpm test:governance-concurrency
pnpm test:governance-scheduler
pnpm verify:governance-local
```

Verifier utama memakai baseline sebelum upgrade 10 → 11 yang tersimpan lokal di reports/. Lihat [TEST_REPORT.md](TEST_REPORT.md) untuk hasil dan batas verifikasi.

Runner test/test:isolated/test:concurrency historis tetap menguji kontrak 1–7; test:scheduler menguji v8. Gunakan runner governance/workflow di atas untuk schema 11. Jangan menjalankan runner API lama terhadap instance utama atau db reset untuk mengulang test.

## Isi proyek

```text
docs/                       spesifikasi asli + keputusan + panduan operasi
apps/web/                   Next.js multi-role: auth + context + responsive shell
supabase/config.toml        konfigurasi Supabase lokal
supabase/migrations/        sebelas migrasi SQL berurutan
supabase/seed.sql           tanpa akun/data dummy permanen
tests/                     fixture sintetis, auth shim, matriks keamanan
scripts/                   pemeriksaan migrasi + runner PostgreSQL native
reports/                   bukti hasil pengujian implementasi
```

Tabel inti: `profiles`, `institutions`, `roles`, `institution_members`, `platform_roles`, `student_identities`, `student_profiles`, `teacher_profiles`, `guardian_profiles`, `guardian_students`, `institution_enrollments`, `program_types`, `programs`, `groups`, `program_enrollments`, `group_memberships`, `teacher_assignments`, `audit_logs`.

## Menjalankan test tanpa Docker

Prasyarat: Node.js dan pnpm sesuai `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm test
```

Test memakai PostgreSQL melalui PGlite, membuat database sementara, mereplay migrasi, lalu menjalankan query menggunakan role `authenticated`/`anon`. Auth shim dalam `tests/bootstrap.sql` hanya meniru kontrak `auth.users` dan `auth.uid()`; file itu **bukan migrasi aplikasi**.

## Menjalankan Supabase lokal

Prasyarat tambahan: Docker Desktop yang berjalan. Ikuti [runbook](docs/LOCAL_SUPABASE_VERIFY.md) untuk membuat network loopback dan memperbarui PATH sesi sebelum menjalankan perintah berikut. Helper binding saat ini khusus Windows Docker Desktop.

```sh
pnpm exec supabase start --network-id ngajitrack-local --exclude vector
node scripts/bind-local-ports.mjs
```

Untuk mengulang migrasi dari awal pada database **lokal sekali pakai**:

```sh
pnpm exec supabase db reset --local
```

Perintah reset menghapus data lokal. Jangan memakai `--linked` atau URL remote untuk reset.

Setelah database lokal kosong dan migrasi diterapkan, jalankan matriks yang sama pada PostgreSQL Supabase. Ambil konfigurasi lokal di memori; jangan cetak atau simpan output status yang memuat kredensial:

```powershell
$ngtRuntime = pnpm exec supabase status -o json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Local Supabase is not ready' }
$env:NGAJITRACK_TEST_DATABASE_URL = $ngtRuntime.DB_URL
pnpm test:postgres
Remove-Item Env:NGAJITRACK_TEST_DATABASE_URL
$ngtRuntime = $null
```

Runner menolak host nonlokal dan database yang sudah mempunyai profil/lembaga. Fixture berada dalam transaction dan di-rollback; runner native tidak mengubah schema atau membuat auth shim. Satu test replay tetap menggunakan database embedded bersih dan diberi nama demikian.

## Operasi yang tersedia

| Command | Akses | Efek |
|---|---|---|
| `create_institution(code,institution_name,kind,admin_profile)` | SUPER_ADMIN | Membuat lembaga dan admin pertama secara atomik |
| `my_institutions()` | User aktif | Proyeksi terbatas lembaga sesuai membership |
| `set_institution_status(tenant_id,new_status)` | SUPER_ADMIN | Mengubah status lembaga dengan audit |
| `move_student_group(enrollment_id,target_group_id)` | Admin tenant | Menutup membership kelas lama dan membuat yang baru; retry ke kelas sama tidak menduplikasi |
| `soft_delete_record(entity_table,record_id)` | Admin tenant | Soft delete tabel pada allowlist; row tetap tersembunyi dari SELECT |
| `end_institution_enrollment(enrollment_id,closure_reason)` | Admin tenant | Menutup enrollment dan program/kelas turunannya tanpa mencabut role lain |
| `expire_institution_enrollments(batch_size)` | Server service_role atau role expiry khusus | Menutup batch enrollment jatuh tempo; cron role khusus menjalankan batch 500 setiap 15 menit |

CRUD administratif lain memakai tabel public dengan grant dan RLS. Akun/identity binding, platform-role provisioning, serta pembuatan membership dilakukan server tepercaya setelah verifikasi. `service_role` tidak boleh dipakai client.

## Batas hasil verifikasi

Checkpoint terbaru: Supabase lokal **LULUS**, migration 1–7 applied pada PostgreSQL 17.6. Suite SQL 76/76 (73 native + 3 embedded eksplisit), Auth/JWT/PostgREST nyata 17/17, lint tanpa temuan. Port lokal terikat 127.0.0.1; Vector dikecualikan karena masalah sumber log Docker. Prasyarat dan urutan verifikasi ada di [docs/LOCAL_SUPABASE_VERIFY.md](docs/LOCAL_SUPABASE_VERIFY.md). Status runner API tersimpan di `reports/local-api-test.json`.

Matriks embedded terbaru: 76/76 test lulus, termasuk migrasi 7 dan upgrade berisi data dari migrasi 6; lihat `TEST_REPORT.md`. `reports/TEST_RESULTS.md` menyimpan hasil checkpoint enam migrasi sebelumnya. Supabase lokal kini berjalan; database berisi fixture API sintetis sehingga test ulang membutuhkan pemeriksaan/penyiapan instance lokal kosong. Tidak ada migrasi staging/production. Scheduler periodik dan enam interleaving concurrency sudah diuji; backup/restore belum teruji.

Panduan bootstrap, recovery, dan batas izin ada di [docs/OPERATIONS.md](docs/OPERATIONS.md). Perbedaan terencana dari spesifikasi tercatat di [docs/FOUNDATION_DECISIONS.md](docs/FOUNDATION_DECISIONS.md).

Laporan mentah dalam reports/ adalah artefak lokal yang dikecualikan dari Git. Ringkasan hasil pengujian yang dapat dibagikan tersedia di TEST_REPORT.md.

Checkpoint scheduler: migration 8 applied lokal; 13/13 test scheduler dan 8/8 verifikasi utama lulus. Lihat docs/SCHEDULER_PROPOSAL.md dan docs/HARDENING.md. Upgrade native berisi data dan kontrak client belum dikerjakan.
