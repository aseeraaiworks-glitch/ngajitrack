# Status implementasi NgajiTrack

## Hardening 2 — concurrency native (2026-09-25)

Selesai: 6/6 test multikoneksi PostgreSQL lulus. Dua worker membagi batch tanpa closure/audit ganda; worker melewati root terkunci admin; admin menunggu worker atau admin lain lalu idempotent; perpindahan kelas setelah closure ditolak; closure yang menunggu perpindahan kelas menutup placement baru. Overlap dibuktikan lewat pg_stat_activity wait_event_type=Lock, bukan urutan panggilan semata. Fixture utama identik sesudah setiap skenario. Bukti lokal: reports/hardening-concurrency.txt.

File berubah: tests/concurrency.test.mjs, package.json, docs/HARDENING.md, IMPLEMENTATION_STATUS.md, TEST_REPORT.md. Tidak ada perubahan schema/security atau migration. Ini enam interleaving terkontrol, bukan pembuktian semua kemungkinan race. Langkah berikutnya: pemasangan dan pengujian scheduler expiry lokal.


## Hardening 1 — environment uji berulang (2026-09-25)

Selesai: scripts/local-sandbox.mjs dan scripts/test-isolated.mjs membuat database ngt_test_<UUID> terpisah, menyalin schema Auth tanpa pengguna/data dan menerapkan migration 1–7. Tidak melakukan reset pada postgres utama. Database uji milik run dihapus setelah selesai; fingerprint seluruh data public dan auth.users utama diperiksa tetap identik. Dua putaran test masing-masing 76/76 lulus (73 native + 3 embedded eksplisit), tanpa kegagalan. Bukti lokal reports/hardening-isolated.txt dan hardening-isolated-repeat.txt.

File berubah: kedua runner baru, package.json, IMPLEMENTATION_STATUS.md, TEST_REPORT.md, docs/HARDENING.md. Tidak ada migration atau perubahan grants/schema aplikasi. Batas: ini environment SQL native; tidak menjalankan instance Auth/PostgREST kedua. Langkah berikutnya: test concurrency multikoneksi untuk expiry dan penutupan.


Tanggal: 2026-09-24. Fase: **backend foundation Supabase/PostgreSQL**.

## Checkpoint publikasi GitHub — 2026-09-25

- Prioritas saat ini hanya backup source ke repository private https://github.com/aseeraaiworks-glitch/ngajitrack.git; backend tidak diubah.
- Audit calon commit tidak menemukan secret; .gitignore diperketat dan contoh password database di README dibersihkan. Rincian: SECURITY_AUDIT.md.
- File lokal/generated reports, cache, environment, credential dan signing key dikecualikan tanpa dihapus.
- File berubah pada checkpoint: .gitignore, README.md, IMPLEMENTATION_STATUS.md; file baru SECURITY_AUDIT.md. Migration dan logic backend tetap sama. Tidak ada migration applied atau test backend diulang untuk perubahan dokumentasi/ignore ini.
- Identitas Git dan autentikasi GitHub kini tersedia. Repository target terverifikasi private, izin push tersedia, remote kosong. Branch main/origin siap untuk initial commit dan push tanpa force. File staged diaudit ulang; tidak ada secret terdeteksi.
- Checkpoint source siap dipublikasikan melalui initial commit main. Hasil push diverifikasi dengan mencocokkan HEAD dan refs/heads/main pada origin; lihat riwayat Git untuk hash final. Jangan melanjutkan fitur backend/UI dalam pekerjaan publikasi ini.

## Checkpoint teknis terakhir

**Checkpoint aktif: milestone Supabase lokal LULUS untuk migration 1–7, SQL native/RLS, Auth/JWT/API, dan temporary/holiday enrollment. Tidak ada Flutter/UI yang dibuat.**

## Checkpoint Supabase lokal — selesai (2026-09-24)

- Docker Client/Server 29.8.0, WSL2 docker-desktop berjalan, Supabase CLI 2.117.0, PostgreSQL native 17.6.
- Startup menerapkan migration 1–7 pada database lokal. Perintah migration up --local berikutnya tidak menemukan migration pending; migration list --local mengonfirmasi tujuh versi. Tidak ada migration baru/diubah; SHA-256 sebelum/sesudah identik.
- Suite SQL: 76/76 lulus, 0 gagal/skipped (73 test PostgreSQL native; 3 test replay/upgrade/reuse fixture sengaja memakai embedded terpisah). Bukti: reports/local-native-test.tap.
- Suite HTTP nyata: 17/17 lulus, 0 gagal. Akun dibuat melalui Auth, password login menghasilkan JWT asli, kemudian PostgREST menguji tenant isolation dan kombinasi role. Bukti: reports/local-api-test.json.
- Verifikasi mencakup SANTRI A+B, WALI+USTAZ satu tenant, lintas tenant dan tiga role; metadata tidak memberi ADMIN; scope assignment/VERIFIED guardian; JWT palsu/password salah, refresh/logout dan profile disabled.
- Temporary/holiday: expiry menghentikan operasi sebelum worker berjalan; service-only worker menutup histori tanpa mencabut role lain; penutupan awal, periode berikutnya dengan identity existing, timezone dan histori read-only lulus pada suite native.
- Pemeriksaan akhir: Auth health HTTP 200; 18 tabel public dengan RLS aktif; 9 akun sintetis, 2 institution, 7 versi migration (reports/local-database-summary.json).
- Lint public/private: tidak ada temuan warning/error, exit 0. Bukti: reports/local-lint.txt.
- Masalah setup terselesaikan: PATH sesi lama diperbarui; port binding default Docker Desktop tidak mengikuti opsi bridge, sehingga helper khusus lokal mengikat port secara eksplisit ke 127.0.0.1. Kong sempat kehilangan sertifikat saat recreate awal; dipulihkan lewat stop/start dengan volume dipertahankan dan helper diperbaiki untuk membawa sertifikat.
- Vector gagal mengakses sumber Docker logs (Network unreachable), sehingga startup akhir memakai --exclude vector. Ini membatasi pengumpulan log terpusat, bukan hasil Auth/API/database. Layanan inti healthy; runtime tetap berjalan.
- Database lokal sekarang berisi sembilan akun Auth sintetis dan fixture dua institution dari suite HTTP. Tidak ada data production/remote. Runner berikutnya akan menolak database tidak kosong; jangan reset tanpa memeriksa bahwa instance tetap lokal sekali pakai.
- File baru: scripts/bind-local-ports.mjs, reports/local-native-test.tap, reports/local-lint.txt, reports/local-migrations.json, reports/local-runtime.txt, reports/local-start-summary.txt, reports/local-migration-hashes-before.json, reports/local-migration-hashes-after.json, reports/local-database-summary.json.
- File diperbarui: .gitignore, README.md, docs/LOCAL_SUPABASE_VERIFY.md, reports/local-api-test.json, IMPLEMENTATION_STATUS.md, TEST_REPORT.md. Schema dan test assertions tidak perlu diperbaiki.
- Isu tersisa: Vector/centralized logs, penjadwalan worker periodik, concurrency multikoneksi, dan staging/backup-restore belum diuji. Pemanggilan worker pada checkpoint ini manual lewat SQL/API, bukan scheduler periodik.
- **Langkah tepat berikutnya:** laporkan checkpoint ini; pekerjaan backend berikutnya adalah memasang/menguji jadwal expiry dan concurrency pada lokal, dengan fixture terpisah atau reset lokal yang telah diverifikasi. Jangan mulai Flutter/UI atau fitur produk lain.

## Histori checkpoint migrasi 7 — selesai di embedded

- Dibuat: `supabase/migrations/20260924000700_temporary_enrollments.sql`.
- Diterapkan hanya pada database embedded sementara; belum Supabase lokal/remote.
- Selesai: enrollment_type, scheduled_end_at, reason, ENDED, pemeriksaan waktu tenant, penutupan atomik, worker expiry service-only, RLS ustaz dan guard turunan; zona waktu valid dan stabil ketika jadwal terbuka.
- started_at/ended_at tetap date; hanya satu jadwal akhir baru. Tidak ada pasangan start_at/end_at. ENDED read-only, termasuk setelah pembatalan sebelum tanggal mulai.
- Role SANTRI/WALI/USTAZ tidak eksklusif; penutupan hanya memengaruhi enrollment terkait. ADMIN tetap assignment terpisah. Tidak ada fitur pricing/billing atau sharing histori baru.
- Enam migration sebelumnya dipertahankan tanpa perubahan, dibuktikan dengan SHA-256 identik sebelum/sesudah.
- File berubah: migrasi baru, `tests/enrollments.test.mjs`, `tests/database.mjs`, `package.json`, `scripts/test-postgres.mjs`, `docs/FOUNDATION_DECISIONS.md`, `docs/OPERATIONS.md`, `README.md`, berkas status ini, `TEST_REPORT.md`, `reports/migration-7-test.tap`.
- Test putaran awal: 69 pass, 0 fail. Test final: 75 pass, 0 fail, 0 skipped; termasuk upgrade berisi data, RLS, multi-role, expiry, rollback atomik, pembatalan awal, timezone, dan batas batch.
- Replay tujuh migrasi lulus; 18 tabel tetap mempunyai RLS. Native runner dicoba tetapi terblokir sebelum test karena tidak ada NGAJITRACK_TEST_DATABASE_URL (exit 1), bukan kegagalan assertion database.
- Isu terbuka: worker belum dijadwalkan di runtime; integrasi Auth/JWT/API, PostgreSQL native dan concurrency multikoneksi belum diuji. Waktu akses operasional tidak bergantung pada worker.
- Langkah tepat berikutnya: laporkan checkpoint migrasi 7 kepada pengguna dan berhenti. Pada milestone berikutnya, jalankan Supabase lokal, apply tujuh migrasi, test native/Auth/JWT/API, pasang/uji pemanggilan worker periodik dan concurrency. Jangan mulai sebelum laporan checkpoint ini diberikan.

## Pekerjaan selesai

- Proyek dibuat di `outputs/ngajitrack`; Git diinisialisasi, belum ada commit/remote.
- Lima spesifikasi v1.2 disalin tanpa perubahan ke `docs/`; SHA-256 sesuai seluruh file asal. Manifest disimpan.
- Supabase CLI 2.117.0 berhasil menjalankan `init`; satu direktori migrasi resmi tersedia.
- 18 tabel foundation: profiles, institutions, roles, institution_members, platform_roles, student_identities, student_profiles, teacher_profiles, guardian_profiles, guardian_students, institution_enrollments, program_types, programs, groups, program_enrollments, group_memberships, teacher_assignments, audit_logs.
- Auth trigger membuat profil tanpa mengambil role dari metadata pengguna. Satu akun dapat mempunyai beberapa role/context; platform role tidak menjadi membership tenant.
- Guardian login nullable; relationship PENDING/VERIFIED/REVOKED. Hanya VERIFIED dengan izin dan membership aktif memberi akses anak.
- Seed TAHFIZ, QURAN_READING, CUSTOM dan lima role referensi ada dalam migrasi.
- Composite FK memeriksa tenant, student, enrollment, program, dan kelas. Owner/history tidak dapat dipindahkan lewat UPDATE.
- History enrollment ditutup dan dipertahankan; perpindahan kelas atomik dan retry idempotent.
- Soft delete, live-parent validation, indexes, actor/timestamp server-side, dan audit append-only.
- RLS aktif pada semua tabel; explicit grants, private authorization helpers, no anon access, no client self-promotion/global identity claiming.
- Command: create_institution, my_institutions, set_institution_status, move_student_group, soft_delete_record.
- Test fixtures sintetis untuk dua tenant, beberapa role, program, kelas, santri, dan wali; test menggunakan authenticated/anon untuk membuktikan allow/deny.
- Runner matriks Supabase PostgreSQL lokal disiapkan dengan transaction rollback dan pemeriksaan database kosong.
- Tidak membangun fitur di luar foundation yang diminta.

## Migrasi dibuat

| Berkas | Status |
|---|---|
| `20260923000100_identity_tenants.sql` | Applied native; replay embedded lulus |
| `20260923000200_people.sql` | Applied native; replay embedded lulus |
| `20260923000300_programs_enrollments.sql` | Applied native; replay embedded lulus |
| `20260923000400_integrity_audit.sql` | Applied native; replay embedded lulus |
| `20260923000500_rls.sql` | Applied native; replay embedded lulus |
| `20260923000600_commands_indexes.sql` | Applied native; replay embedded lulus |
| `20260924000700_temporary_enrollments.sql` | Applied native; replay embedded dan upgrade dari migrasi 6 lulus |

## Migrasi sudah diterapkan

- **Database uji sementara PostgreSQL 18.3 / PGlite 0.5.8:** ketujuh migrasi, replay database bersih, serta upgrade berisi data dari migration 6 berhasil.
- **Supabase lokal PostgreSQL 17.6:** ketujuh migrasi diterapkan dan tercatat; tidak ada migration pending.
- **Staging/production/remote:** tidak ada migrasi diterapkan, tidak ada project remote ditautkan.

## File checkpoint awal (enam migrasi)

- `docs/NGAJITRACK_*_v1.2.md` (5 salinan asli), `docs/SOURCE_MANIFEST.json`.
- `docs/FOUNDATION_DECISIONS.md`, `docs/OPERATIONS.md` (termasuk ERD/matriks akses).
- `supabase/config.toml`, `supabase/seed.sql` dan 6 berkas `supabase/migrations/*.sql`.
- `tests/bootstrap.sql`, `tests/database.mjs`, `tests/fixture.mjs`, `tests/foundation.test.mjs`.
- `scripts/check-migrations.mjs`, `scripts/test-postgres.mjs`.
- `package.json`, `pnpm-lock.yaml`, `.gitignore`, `README.md`, `IMPLEMENTATION_STATUS.md`.
- `reports/TEST_RESULTS.md`, `reports/embedded-test.tap`.

## Test lulus

- SQL runner native: 76 tests, 76 pass, 0 fail/skipped; 73 native + 3 embedded eksplisit. Perintah: node scripts/test-postgres.mjs dengan URL lokal dari CLI status. Bukti reports/local-native-test.tap.
- Auth/JWT/PostgREST: 17 checks, 17 pass, 0 fail; node scripts/test-api.mjs. Bukti reports/local-api-test.json.
- Supabase lint public/private: exit 0, results kosong; reports/local-lint.txt.
- Regresi embedded checkpoint sebelumnya tetap 76/76, tersimpan di reports/local-preparation-regression.tap; laporan migration 7 historis 75/75 tetap tersedia.

## Kegagalan ditemukan dan diselesaikan

| Checkpoint | Hasil dan perbaikan |
|---|---|
| 1 — inspeksi/tooling | Path executable CLI awal keliru; diperbaiki menjadi `node_modules/supabase/dist/supabase.js`; init berhasil |
| 2–3 — schema | Empat migrasi awal berhasil, 18 tabel mempunyai RLS, akses client tetap tertutup |
| 4 — policy/test awal | 31/45 lulus; TG_ARGV NULL pada trigger UPDATE, execute grant bawaan PUBLIC, dan perbedaan SQLSTATE RESTRICT ditemukan |
| 4 — perbaikan | 44/45 lulus; trigger/grants diperbaiki; SQLSTATE 23503/23001 diterima untuk FK RESTRICT yang benar-benar menolak |
| 5 — soft delete | RPC terotorisasi menggantikan direct soft-delete UPDATE yang tertolak SELECT RLS; 48/48 lulus |
| 5 — native runner/coverage | Fixture transaction dan test profile/teacher tambahan; 51/51 lulus |
| Final — reference audit | Audit global reference ditambah; 52/52 lulus, bukti tersimpan |

RLS tidak pernah dimatikan untuk membuat test lulus. Pada checkpoint awal, perbaikan dilakukan pada migrasi yang belum dirilis dan direplay dari awal. Sejak checkpoint 7, keenam migrasi itu tidak diubah; perubahan ditambahkan sebagai forward migration.

## Isu belum selesai / batas verifikasi

1. Vector dikecualikan dari runtime lokal karena koneksi Docker logs gagal. Log container tetap dapat dibaca memakai Docker; agregasi log belum terverifikasi.
2. Worker expiry telah lulus native SQL dan HTTP service_role, tetapi pemanggilan periodik belum dipasang. Batas akses waktu tetap bekerja walaupun worker terlambat.
3. Suite memakai koneksi secara sekuensial; concurrency multikoneksi belum terbukti. Upgrade berisi data migration 6 ke 7 masih diuji embedded; startup native menguji apply bersih 1–7.
4. Staging/production, backup/restore, invitation/matching/verifikasi identity, review sensitif Super Admin belum masuk checkpoint ini.
5. Quran reference/config, method engine, Flutter/UI, Score, kalender, poster, laporan produk dan payment tetap di luar scope.

## Langkah berikutnya yang tepat

Laporkan hasil milestone lokal. Lanjutkan hanya pekerjaan backend yang disepakati; langkah teknis berikutnya adalah scheduler expiry periodik dan concurrency multikoneksi. Gunakan docs/LOCAL_SUPABASE_VERIFY.md untuk menjalankan ulang setelah memeriksa fixture lokal; jangan menganggap database sekarang kosong.
