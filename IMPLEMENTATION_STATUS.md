# Status implementasi NgajiTrack

## Checkpoint 12.1–12.2 selesai (2026-09-29)

- Scaffold `apps/web` tersedia: Next.js 16.3.7/TypeScript/App Router, pnpm workspace, Tailwind semantic tokens, UI reusable, pemisahan application/domain/data, environment validation dan Supabase browser/server adapters. Tidak memakai nama admin-web.
- Authentication: email/password akun existing, logout scope local, persistence/refresh cookie SSR, verified own-profile, protected `/app`, redirect allowlist, loading/error/access state dan indikator offline dasar. Tidak ada signup atau halaman bisnis.
- Hasil final: build produksi PASS; lint 0 error/0 warning; typecheck PASS; unit boundary 11/11; browser Chromium 16/16; SQL foundation schema 11 53/53; Auth/JWT/API 24/24. Tidak ada test gagal/skipped pada hasil final. Dependency audit tidak menemukan kerentanan dikenal.
- Putaran browser awal 13/16 menemukan race logout lintas tab ketika SDK belum terinisialisasi dan dua selector alert ambigu; diperbaiki, kemudian seluruh 16 test lulus. Profil kini menunggu INITIAL_SESSION sebelum tampil. Token kedaluwarsa, refresh gagal, forged cookie, logout/back, pergantian akun dan cross-user RLS teruji.
- Acceptance reducer membersihkan data pada pergantian mode/institution/account dan menolak respons generation lama. Switcher 12.3 belum dibuat; query per-mode dan acceptance browser switcher sebenarnya tetap pekerjaan checkpoint berikutnya, bukan diklaim selesai.
- Migration dibuat/applied: **tidak ada**. Migration 1–11 identik; tidak mengubah schema/RLS/RPC. Auth/PostgREST/database test terpisah; fixture utama public/Auth identik setelah setiap runner dan container test dibersihkan.
- File: apps/web/** (source/config/unit/E2E), pnpm-workspace.yaml, package/lock, .gitignore, scripts/test-web.mjs, scripts/web-local.mjs, helper test auth-api-lab, README, docs/MILESTONE_12.md, status/test report/security audit. Generated Next files, environment, reports dan credential tetap diabaikan.
- Security audit: 94 kandidat file dipindai sebelum finalisasi dokumentasi; 0 temuan pola secret/path sensitif; 12/12 probe ignore. Public environment hanya menerima publishable key; tidak ada service_role/DB credential dalam aplikasi. Repository GitHub terverifikasi private, main, izin push tersedia. Index diaudit ulang sebelum commit.
- Batas: baru Chromium lokal desktop/mobile viewport; belum staging/production/Firefox/WebKit. Auth backend yang gagal memberikan error generik; production HTTPS/reverse proxy/CSP perlu ditinjau saat deployment. Tidak ada durable offline storage/sync, context UI, dashboard, Web Admin business pages atau Flutter. Tidak ada blocker terbuka untuk scope 12.1–12.2.
- Publikasi: commit/push biasa ke private main setelah seluruh pemeriksaan lulus; hash/sinkronisasi dilaporkan melalui hasil Git agar tidak menyimpan hash commit diri sendiri dalam file.
- Langkah tepat berikutnya: verifikasi HEAD = remote main dan working tree clean, laporkan hasil, lalu **BERHENTI**. Jangan mulai checkpoint 12.3 tanpa instruksi berikutnya.

## Migration 11 — finalisasi selesai (2026-09-26)

Checkpoint ini menggantikan langkah berikutnya pada histori di bawah.

- Dibuat dan applied: `20260926001100_academic_governance.sql`. Supabase lokal utama memiliki migration 1–11; Migration 1–10 identik dengan HEAD sebelumnya. Tidak ada apply remote/cloud dan tidak ada reset fixture.
- Struktur additive: program_learning_types, institution_levels, program_levels; groups.program_level_id nullable tanpa tebakan level; membership_scopes private; case/invitation governance; registry dan version konfigurasi; audit permission/context.
- MUDIR maksimal satu ACTIVE per lembaga melalui unique index. Replacement atomik menjaga histori; recovery membutuhkan alasan/bukti dan verifikasi platform, requester tidak dapat memverifikasi dirinya sendiri. WAKIL_MUDIR mendukung scope institution/program/multiple, expiry dan revocation. Direct mutation/soft-delete tidak melewati governance.
- RLS monitoring hanya membaca konteks yang sah; multi-role tidak memperluas scope kepemimpinan atau approval WALI/Admin. Invitation snapshot role/scope/recipient/masa jabatan tidak dapat ditamper atau di-replay. Approval/provisioning STANDARD 9–10 dan scheduler existing dipertahankan.
- Inheritance konfigurasi: Institution → Level → Program → Program+Level, version/provenance tersimpan. Registry key pedagogis produksi belum diisi; tidak menebak target/workflow produk.
- Hasil: governance/akademik 29/29; native upgrade 20/20; foundation schema 11 53/53; Auth/JWT/PostgREST 24/24; concurrency schema 11 6/6; scheduler 13/13 dengan periodic/retry/backlog pada schema 11; post-apply utama 9/9. Baseline historis 76/76 native/embedded dan 76/76 embedded juga lulus. Detail cakupan di TEST_REPORT.md.
- Concurrency dan scheduler schema 11 selesai setelah apply utama. Pada finalisasi bukti diperiksa, tidak mengulang migration/test yang sudah tuntas. Verifikasi read-only utama 9/9 diulang untuk memastikan state checkpoint; probe JSONB installed function juga lulus.
- Lint exit 0, tanpa error, dua warning implicit text → jsonb pada inisialisasi konstanta '{}' untuk result/sources dalam effective_learning_config. Bukan input dinamis; resolver/inheritance dan probe read-only menghasilkan JSON object sesuai contract. Tidak memerlukan perubahan migration yang sudah applied.
- Seluruh nilai kolom lama public/private/Auth tetap sama berdasarkan snapshot hash. Policy RLS lama dan job cron 15 menit/batch 500 tetap ada; role scheduler hanya EXECUTE expiry tanpa CRUD/private workflow. Kelas lama tidak diberi level dan tidak ada pimpinan yang ditunjuk otomatis pada fixture utama.
- File baru: migration 11; docs/MIGRATION_11.md; scripts/test-governance.mjs, test-governance-regression.mjs, upgrade-snapshot.mjs, verify-governance-local.mjs. File diperbarui: README, package.json, docs/BACKEND_CONTRACT.md, FOUNDATION_DECISIONS.md, HARDENING.md; runner upgrade/scheduler/workflow SQL/API; tests/concurrency.test.mjs dan foundation.test.mjs; status, test report, security audit.
- Security: 59 kandidat file ditinjau/dipindai; tidak ditemukan secret tersimpan. Satu pola URL lab dikonfirmasi memakai password acak runtime, bukan literal credential. Sepuluh probe ignore lulus. Repository target terverifikasi private, push diizinkan; .env/keys/reports/cache/runtime tetap dikecualikan.
- Publikasi: checkpoint ini disiapkan untuk commit/push biasa ke main tanpa force; hash dan konfirmasi sinkronisasi dilaporkan setelah publikasi, dapat dilacak melalui git log/origin/main.
- Gap tersisa: email delivery/account-less invitation, layanan operasional verifikasi bukti/rate limit recovery, definisi pedagogis konkret, academic period, approval pimpinan yang didefinisikan eksplisit di masa depan, staging/production. Dua warning lint kosmetik dicatat. Tidak ada test gagal atau keputusan produk baru yang tertunda untuk scope ini.
- Langkah tepat berikutnya: commit dan push checkpoint yang sudah diaudit, verifikasi origin/main dan working tree, laporkan hasil lalu BERHENTI. Jangan mulai Web Admin/Flutter atau milestone baru.


## Hardening 4–5 — upgrade native, approval dan provisioning selesai (2026-09-25)

Checkpoint ini menggantikan langkah berikutnya pada bagian histori di bawah.

- Migration 9 (20260925000900_enrollment_approvals.sql) dan 10 (20260925001000_verified_provisioning.sql) telah applied pada Supabase lokal utama melalui migration up --local. History lengkap 1–10; migration 1–8 tidak diubah. Tidak ada apply remote/cloud.
- Default temporary/holiday: WALI VERIFIED. Admin B memilih eksplisit WALI, LEMBAGA_A, WALI+LEMBAGA_A, atau NONE. Program mewarisi dan hanya memperketat; penggabungan persyaratan juga mencegah override lama melemahkan pengetatan lembaga.
- Request/decision disimpan private, RLS aktif, tidak ada direct grant kepada client atau service_role. RPC terbatas memeriksa tenant dan actor; approval A memerlukan admin berwenang pada satu asal dengan enrollment operasional identity yang sama. Approval wali memakai hubungan VERIFIED dan membership aktif; diperiksa ulang sebelum aktivasi. Proyeksi approver tidak membuka histori tenant lain.
- ACTIVE temporary/holiday existing dipertahankan sebagai LEGACY_APPROVAL_EXCEPTION yang diaudit, bukan approval buatan; data enrollment dan histori ENDED tidak ditulis ulang. Exception program tidak berlaku untuk record program baru, termasuk di program yang sama.
- Perubahan konteks/tanggal PENDING membatalkan request lama, termasuk bila nilai dikembalikan. Konteks ACTIVE dibekukan: tutup record lama dan buat record baru dengan approval baru. Ini mempertahankan immutability tujuan/program existing. Penutupan tidak mencabut role lain atau enrollment A.
- Provisioning tersedia melalui RPC server-only untuk issuance/verifikasi binding dan RPC recipient-bound untuk redeem. Token acak sekali pakai, hash SHA-256, expiry terbatas; membership/binding/consume/audit atomik. Replay, penerima salah, expiry, revocation, dan rollback kegagalan diuji. ADMIN harus diminta eksplisit; SUPER_ADMIN tidak dapat diprovision lewat invitation.
- Kontrak client: docs/BACKEND_CONTRACT.md mencakup operasi/signature, response/error native PostgREST, scope role, transisi approval, provisioning tepercaya, serta larangan service_role di client.
- Test final: native upgrade/approval 20/20; foundation 53/53 (51 native di schema 1–10 + 2 test embedded historis yang eksplisit); Auth/JWT/PostgREST workflow 18/18; primary read-only verification 8/8. Lint public/private exit 0 tanpa temuan. Tidak ada failure/skipped pada hasil final.
- Upgrade native dimulai dari migration 6 berisi fixture, dilanjutkan 7, 8, 9, 10; kolom/status/tanggal existing dipertahankan, REGULAR default benar, ACTIVE legacy/ENDED tetap utuh. Auth/PostgREST memakai container terpisah dengan JWT login asli, bukan JWT fabrikasi.
- Fixture utama public/auth.users, kebijakan RLS produk, serta job cron 15 menit/batch 500 identik sebelum/sesudah apply. Role scheduler tetap hanya EXECUTE worker expiry, tanpa CRUD atau administrative workflow. Main memiliki dua REGULAR ACTIVE dan dua temporary/holiday ENDED; tidak memerlukan audit exception tambahan.
- Pengembangan menemukan search_path koneksi Auth lab membuat history migrasi tidak terbaca; diperbaiki pada koneksi lab ke schema auth. Review akhir menutup reuse legacy exception untuk record program baru; regression tambahan lulus. Tidak mengubah konfigurasi Auth utama atau HBA.
- File baru: dua migration; scripts/auth-api-lab.mjs, test-approval-upgrade.mjs, test-workflow-api.mjs, test-workflow-regression.mjs, verify-workflow-local.mjs; docs/BACKEND_CONTRACT.md. File diperbarui: scripts/scheduler-lab.mjs (parameter versi awal), package.json, README.md, docs/HARDENING.md, docs/FOUNDATION_DECISIONS.md, docs/LOCAL_SUPABASE_VERIFY.md, IMPLEMENTATION_STATUS.md, TEST_REPORT.md, SECURITY_AUDIT.md.
- Bukti lokal diabaikan Git: reports/workflow-upgrade.txt, workflow-api.txt, workflow-foundation.txt, workflow-primary.txt, workflow-primary-before.json, workflow-lint.txt.
- Batas: pengiriman email/SMS dan UI verifikasi tidak dibuat; server/operator tetap wajib membuktikan kepemilikan identitas sebelum memanggil RPC verified. Service_role tetap server-only. Tidak ada staging/production, backup/restore, portable history sharing, Web Admin atau Flutter UI. Verifikasi utama SQL/RLS + health/anon read-only; skenario login/provisioning HTTP mutatif dijalankan pada lab terpisah agar fixture utama utuh.
- Audit Git final: 53 file index dipindai, 0 temuan pola secret, 0 path terlarang; 9 probe ignore lulus. Repository target terverifikasi private dengan izin push; migration 1–8 unchanged. Publikasi melalui commit main tanpa force; hash/status push dilaporkan setelah verifikasi remote.
- Langkah tepat berikutnya: laporkan hasil checkpoint, hash commit, status push dan working tree, lalu berhenti. Tidak mulai milestone berikutnya.


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
