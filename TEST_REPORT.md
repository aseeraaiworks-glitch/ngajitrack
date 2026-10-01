# Laporan pengujian NgajiTrack

## Checkpoint 12.5 — hasil final App Shell (2026-10-01)

| Pemeriksaan | Hasil | Cakupan/perintah |
| --- | --- | --- |
| Lint | PASS, 0 error/0 warning | pnpm lint:web; diulang setelah koreksi test urutan program |
| Typecheck | PASS | web-local typegen + tsc --noEmit; build produksi final juga TypeScript; tsc diulang saat finalisasi |
| Production build | PASS | pnpm test:web membangun Next produksi sebelum Chromium |
| Unit | 43/43 PASS | pnpm test:web:unit; 39 existing + 4 navigation/token |
| Browser/E2E | 71/71 PASS, 0 skipped | pnpm test:web; 53 existing + 18 shell; Chromium produksi, 3,9 menit |
| Query-intent integration | PASS | Audit actual request own-profile/own-membership/scoped program; tanpa business union preload atau silent profile provisioning |
| SQL/RLS schema 11 | 53/53 PASS | node scripts/test-workflow-regression.mjs; 51 native + 2 embedded historis eksplisit |
| Auth/JWT/PostgREST backend | 24/24 PASS | node scripts/test-workflow-api.mjs; tenant/role/scope/approval/provisioning |
| Main fixture preservation | PASS | Fingerprint public/Auth identik sebelum/sesudah SQL/API/browser; container lab dibersihkan |
| Dependency audit | PASS | pnpm audit --audit-level high: No known vulnerabilities found |
| Secret/ignore audit | PASS | 138 kandidat, 0 temuan pola secret/path sensitif; 12/12 probe ignore; index diperiksa sebelum commit |
| Migration/dependency diff | PASS | Migration 1–11, schema/RLS/RPC, manifest/lock dan domain context/bootstrap/repository tidak berubah |

Delapan belas test browser baru: sidebar desktop collapse/expand dan lebar content; drawer mobile 320/390/768px tanpa horizontal overflow, keyboard/focus trap/return/Escape dan target sentuh; drawer ditutup pada resize desktop; enam role navigation (Admin/Mudir/Wakil/Wali/Ustaz/Santri) dengan scoped URL; pending switch menghilangkan identitas/link/content lama dan memunculkan loading; pencabutan scope melalui RPC lab menutup navigasi lama tetapi mempertahankan Wali; foreign tenant deep link ditolak; online/offline dan dismiss toast; reduced motion dan override token dark; dialog profile/logout/back; invalid session/reload; no-context tanpa role navigation; error profile server generik dan retry yang memulihkan shell setelah layanan kembali.

Empat unit baru memastikan navigation hanya context terpilih (enam role), program focus tetap sempit, context kosong/invalid/unknown tidak mendapat privileged navigation, serta contrast teks/status/button minimal 4.5:1 pada palette light dan dark yang disiapkan. Seluruh test unit Auth/reducer/context/switcher existing tetap dijalankan.

Iterasi pengujian dicatat: putaran browser pertama 70/71, satu fault lookup sekali jalan ternyata dipulihkan oleh retry SDK. Fault dibuat persisten sampai pemulihan eksplisit. Targeted error-boundary run berikutnya 0/1 mengungkap reset tidak memuat ulang data server; memakai callback retry Next yang melakukan refresh + reset, dengan reload fallback. Putaran lengkap berikutnya 70/71: error/retry lulus, satu test existing program jamak mengasumsikan urutan metadata yang tidak dijamin backend. Assertion kini membandingkan set lengkap (tanpa program kurang/lebih), tidak memperlonggar scope atau mengubah query. Hasil putaran final dicatat pada tabel di atas.

Error AuthApiError negative refresh dan Profile could not be loaded pada fault injection adalah expected; detail upstream tidak ditampilkan di UI. Warning FORCE_COLOR/NO_COLOR hanya output runner. Tidak ada test endpoint pada aplikasi; kontrol restore/revoke fixed-action hanya gateway lab loopback dengan token acak runtime. Login/JWT normal berasal dari Auth lab, bukan service_role di client. Fixture utama tidak di-reset.

Bukti lokal diabaikan Git: reports/web-12.5-e2e.txt, web-12.5-error-retry.txt, web-12.5-e2e-final.txt, web-12.5-sql.txt, web-12.5-api.txt; screenshot web-shell-desktop.png, web-shell-mobile.png dan web-shell-drawer.png diperiksa visual. Suite akhir dijalankan ulang sesudah koreksi assertion; file laporan final berisi putaran terakhir. Saat melanjutkan sesi, log mengonfirmasi test 69–71, audit gateway dan cleanup sudah selesai; tidak mengulang suite yang lulus. Typecheck dan pemeriksaan Git diulang saat finalisasi. Scheduler/concurrency/upgrade historis tidak diulang karena backend tidak berubah.

Batas: Chromium lokal, belum browser lain/deployment; contrast test palette bukan audit aksesibilitas menyeluruh. Revoke idle mengikuti bootstrap/switcher/submit/reload/known expiry, bukan subscription realtime. Online indicator bukan API health/sync; dark mode baru token readiness. Belum ada query bisnis anak/monitoring/roster, sehingga isolasi query bisnis tersebut tidak diklaim telah diuji.

Seluruh hasil final lulus, tanpa test gagal/skipped. Langkah tepat berikutnya: audit index, commit/push private main, verifikasi HEAD/remote/working tree lalu **BERHENTI sebelum 12.6**. Sentry dan fitur lain tidak dimulai.

## Checkpoint 12.4 — hasil final (2026-10-01)

| Pemeriksaan | Hasil | Cakupan/perintah |
| --- | --- | --- |
| Lint | PASS, 0 error/0 warning | pnpm lint:web |
| Typecheck | PASS | web-local typegen + tsc --noEmit; diulang setelah perbaikan, build final juga TypeScript |
| Production build | PASS | pnpm test:web membangun Next produksi sebelum Chromium; context-options dinamis |
| Unit | 39/39 PASS | pnpm test:web:unit; 31 existing + 8 switch/scope/request |
| Browser/E2E | 53/53 PASS, 0 skipped | pnpm test:web; 38 existing + 15 switcher; putaran final 2,6 menit |
| Query-intent integration | PASS | Gateway mengaudit own-profile/own-membership, filter active scoped-program eksplisit; tanpa query business union role |
| SQL/RLS schema 11 | 53/53 PASS | node scripts/test-workflow-regression.mjs; 51 native + 2 embedded historis eksplisit |
| Auth/JWT/PostgREST backend | 24/24 PASS | node scripts/test-workflow-api.mjs; tenant/role/scope/approval/provisioning |
| Main fixture preservation | PASS | Fingerprint public/Auth sama sebelum/sesudah setiap runner; lab dibersihkan |
| Dependency audit | PASS | pnpm audit --audit-level high: No known vulnerabilities found |
| Secret/ignore audit | PASS | 117 kandidat, 0 temuan pola secret/path sensitif, 12/12 probe ignore; staged index diperiksa ulang |
| Migration/dependency diff | PASS | Migration 1–11, schema/RLS/RPC produk, manifest/lock tidak berubah |

Lima belas test browser baru: Mudir → Wali → Mudir; Admin ↔ Ustaz pada lembaga sama; lembaga A ↔ B; Wakil satu program dengan reload; Wakil program A → B → seluruh program assigned; Wakil institution-wide tanpa scope buatan; scope dicabut via RPC saat menu terbuka lalu fresh submit/deep link ditolak; preference program invalid; foreign program/parameter ganda/foreign membership/cross-tenant; menu lama terlambat sesudah cancel/reopen; pending switch menyembunyikan mode lama dan response yang dibatalkan tidak menavigasi; dua tab independen plus logout/preference cleanup; keyboard/focus/Escape/mobile/reduced-motion; error validasi/retry; endpoint authenticated/no-store/GET-only.

Unit baru menguji narrowing seluruh DTO (IDs, scope records, labels), program yang tidak ditugaskan, larangan program focus pada relationship/institution scope, state generation berbeda antarprogram, preference invalid, scope order vs revocation/expiry, serta late result ketika transport mengabaikan abort. Test reducer existing tetap memuat payload sintetis mode lama dan membuktikan pembersihan/penolakan generation sebelumnya. Tidak mengklaim pengujian query bisnis yang belum dibuat.

Putaran browser awal 50/53: implicit label select menyertakan teks option dalam pencarian label dan native dialog membiarkan Tab melewati kontrol terakhir. Asosiasi label dibuat eksplisit dengan htmlFor/id, focus wrap ditambahkan; hasil final 53/53. Pemeriksaan abort sebelum redirect/hasil JSON serta pesan pembatalan yang netral masuk build final. Warning FORCE_COLOR dan error AuthApiError pada negative refresh fixture adalah expected; tidak ada test gagal/skipped pada putaran final.

Semua akun dan scope sintetis dibuat di lab native/Auth/PostgREST terpisah. Satu scope dicabut lewat RPC berwenang setelah halaman/menu terbuka. Kontrol fixture hanya pada gateway loopback test dengan token acak memori; tidak ada test hook pada aplikasi produksi. Request normal memakai JWT Auth asli; tidak ada primary reset/fixture mutation. Tidak mengulang regresi concurrency/scheduler/upgrade historis karena backend tidak diubah.

Bukti lokal yang diabaikan Git: reports/web-12.4-e2e.txt (putaran awal), web-12.4-e2e-final.txt, web-12.4-sql.txt, web-12.4-api.txt, web-switcher-mobile.png (diperiksa visual). Batas: Chromium lokal dan data context summary; belum browser lain/deployment/query bisnis. Realtime scope updates tidak termasuk milestone ini; RLS tetap menolak operasi setelah pencabutan.

Langkah tepat berikutnya: commit/push checkpoint ke private main setelah audit index, verifikasi HEAD/remote dan working tree, laporkan lalu **BERHENTI sebelum 12.5**.

## Checkpoint 12.3 — hasil final (2026-10-01)

| Pemeriksaan | Hasil | Cakupan/perintah |
| --- | --- | --- |
| Lint | PASS, 0 error/0 warning | pnpm lint:web |
| Typecheck | PASS | web-local typegen + tsc --noEmit, serta TypeScript pada build final |
| Production build | PASS | pnpm test:web membangun Next sebelum Chromium; login/app/context routes dinamis |
| Unit | 31/31 PASS | pnpm test:web:unit; 11 existing + 20 context |
| Browser | 38/38 PASS, 0 skipped | pnpm test:web; 16 existing Auth + 22 context, putaran final 1,2 menit |
| Query-intent integration | PASS | Audit request gateway lab: own-profile/own-membership, explicit active scoped-program filter, tidak ada full institution/union business query |
| Missing-profile guard | PASS | Jumlah profile fixture tetap 0 setelah bootstrap; preference invalid dibuang |
| SQL/RLS foundation schema 11 | 53/53 PASS | node scripts/test-workflow-regression.mjs; 51 native + 2 embedded historis eksplisit |
| Auth/JWT/PostgREST backend | 24/24 PASS | node scripts/test-workflow-api.mjs; multi-role, tenant isolation, scope/revocation, approval/provisioning |
| Dependency audit | PASS | pnpm audit --audit-level high: No known vulnerabilities found |
| Secret/ignore audit | PASS | 109 kandidat, 0 temuan pola secret/path terlarang, 12/12 probe ignore; index diperiksa ulang |

Context browser: 0 institution dengan platform/Auth metadata yang tidak memberi context; 1 institution/1 role auto-select; beberapa institution; beberapa role tanpa privilege ranking; MUDIR+WALI terpisah dan tidak menyisakan tampilan mode sebelumnya; Wakil satu/multiple/institution scope; WAKIL+WALI; no scope/expired/revoked/inactive program tidak ditawarkan dan deep link ditolak; preference valid preselected, invalid dihapus dan minta pilihan ulang; deep link valid, foreign membership, mixed tenant IDs dan malformed IDs; logout/preference/back navigation; profil missing; context query error; invalidasi session selama bootstrap; keyboard/mobile.

Unit juga menguji scope/membership/tenant mismatch, membership future/ended/deleted/inactive, expiry tepat batas, partial scope removal, unknown/platform role, pemisahan queryIntent serta preference palsu tidak mengganti role. Sebelas test boundary lama tetap menguji generation yang mencegah late response mengisi state mode/account lain.

Dua putaran browser masing-masing 38/38. Putaran final dilakukan setelah penambahan pembersihan preference missing-profile/denied dan penguatan assertion own-profile/session-invalid; build final mengandung seluruh perubahan. Lint awal menolak setState langsung di effect; pembacaan preference kemudian memakai useSyncExternalStore, lint final bersih. Warning output warna dan AuthApiError pada negative refresh fixture adalah perilaku yang diharapkan.

Semua account, tenant, governance dan data scope dibuat di lab native terpisah, login/JWT normal berasal dari Auth. Fault injection 503 context lookup dan 401 Auth setelah lookup hanya terdapat dalam gateway test, tidak dalam aplikasi. Scope expired/revoked/program inactive menggunakan record nyata lab. Fingerprint fixture utama public/Auth tetap identik setelah semua runner; container test dibersihkan. Migration 1–11 dan backend RLS/RPC identik.

Screenshot sintetis reports/web-context-mobile.png diperiksa visual dan diabaikan Git. Baru Chromium lokal, bukan Firefox/WebKit/production. Bootstrap belum memuat data bisnis anak/monitoring/roster; full switcher dan isolasi query bisnis selanjutnya tetap scope milestone lain. Regression scheduler/concurrency/upgrade historis tidak diulang karena backend tidak diubah.

Langkah tepat berikutnya: commit/push hasil yang lulus ke private main, verifikasi HEAD/remote/working tree, laporkan lalu BERHENTI sebelum 12.4.

## Checkpoint 12.1–12.2 — hasil final (2026-09-29)

| Pemeriksaan | Hasil final | Perintah / bukti |
| --- | --- | --- |
| Install lockfile | PASS | pnpm install --frozen-lockfile |
| Production build | PASS | pnpm test:web membangun Next production sebelum browser; route login/app dinamis |
| Lint | PASS, 0 warning/error | pnpm lint:web |
| Typecheck | PASS | web-local.mjs typegen + tsc --noEmit; build final juga menjalankan TypeScript |
| Unit boundary | 11/11 PASS | pnpm test:web:unit |
| Browser/Auth SSR | 16/16 PASS, 0 skipped | pnpm test:web, Chromium 153, production Next; putaran final 18,8 detik untuk browser |
| Foundation/RLS schema 11 | 53/53 PASS | node scripts/test-workflow-regression.mjs; 51 native + 2 embedded historis eksplisit |
| Auth/JWT/PostgREST backend | 24/24 PASS | node scripts/test-workflow-api.mjs; tenant/multi-role/approval/provisioning/governance |
| Dependency audit | PASS | pnpm audit --audit-level high: No known vulnerabilities found |
| Source/ignore audit | PASS | 94 kandidat, 0 temuan pola secret/path sensitif, 12/12 probe ignore; index diperiksa lagi sebelum commit |

Unit: redirect allowlist, error generik, konfigurasi environment/public key, context Mudir → Wali, institution switching, penolakan late response, account reset, logout, refresh account yang sama, larangan load tanpa account/context eksplisit. Ini acceptance pada state boundary; belum acceptance UI role switcher 12.3.

Browser: protected route tanpa login; password salah; login benar dan profil sendiri; reload; logout/cookie cleanup/back navigation/akun berbeda; logout lintas tab; expired signed token + refresh SSR nyata; expired session dengan refresh invalid; forged cookie/JWT invalid; profil nonaktif + logout; empat varian redirect berbahaya; query profile user lain ditolak RLS; pesan network error generik; mobile viewport/reduced motion/keyboard submit/offline indicator. Screenshot sintetis diperiksa visual di reports/web-login-mobile.png dan web-account-mobile.png (diabaikan Git).

Runner membuat akun melalui Auth lab. Untuk expiry, helper mengubah exp token lab dan menandatanganinya memakai secret lab; Auth menolaknya sebelum pengujian, lalu refresh token asli menghasilkan sesi baru. Tidak memakai JWT fabrikasi untuk login normal dan tidak memakai key utama. Trace/video/storageState tidak direkam. Lab gateway hanya loopback.

Putaran browser pertama 13/16: dua selector juga menangkap route announcer Next.js; satu race logout sebelum INITIAL_SESSION tab kedua. Selector diperjelas; provider kini menunggu inisialisasi SDK dan menutup tampilan bila sesi hilang. Putaran final 16/16. Warning lint PostCSS pada putaran awal diperbaiki; hasil lint final bersih. Log AuthApiError 400 pada negative refresh test adalah penolakan yang diharapkan, bukan test gagal; warning FORCE_COLOR/NO_COLOR hanya output runner.

Fixture utama public/Auth identik setelah semua runner; container test dihapus oleh harness. Migration 1–11, schema/RLS/RPC tidak diubah. Regresi historis concurrency/scheduler/upgrade tidak diulang karena tidak ada perubahan backend. Browser baru diuji Chromium lokal, bukan Firefox/WebKit/staging/production. Tidak mengklaim full mode switching, teaching/offline sync atau deployment selesai.

Langkah tepat berikutnya: publikasikan checkpoint yang seluruh test-nya lulus, verifikasi main sinkron/working tree clean, laporkan dan BERHENTI sebelum 12.3.

## Migration 11 — hasil final (2026-09-26)

| Suite | Hasil | Cakupan / bukti lokal yang diabaikan Git |
| --- | --- | --- |
| Governance/akademik | 29/29 PASS | reports/final-governance.txt; native upgrade 10 → 11, semua nilai lama public/private/Auth, relasi akademik, scopes, uniqueness, replacement/recovery, invitation, config, dua interleaving nyata |
| Native upgrade approval | 20/20 PASS | reports/governance-upgrade.txt; data existing 6 → 7 → 8 → 9 → 10 → 11, legacy exception, approval WALI/source, expiry |
| Foundation terkini | 53/53 PASS | reports/final-workflow.txt; 51 native pada schema 11 + dua test embedded historis eksplisit |
| Auth/JWT/PostgREST | 24/24 PASS | reports/final-api.txt; 18 kasus existing + enam kasus leadership/akademik; login Auth asli di lab terpisah |
| Concurrency schema 11 | 6/6 PASS | reports/final-concurrency.txt; selesai setelah apply utama, worker expiry khusus, closure/move, lock wait nyata |
| Scheduler | 13/13 PASS | reports/final-scheduler.txt; instalasi/privilege v8 lalu late expiry, periodic failure/retry, duplicate/backlog 1101 pada schema 11 |
| Instance utama pasca-apply | 9/9 PASS | reports/governance-primary.txt; diulang read-only saat finalisasi, data existing/policy/job/ACL/RLS/health/backfill |
| Baseline historis native | 76/76 PASS | reports/governance-legacy.txt; schema 1–7, 73 native + tiga embedded eksplisit |
| Baseline historis embedded | 76/76 PASS | reports/governance-embedded.txt; kontrak 1–7 tanpa Docker |
| JSONB installed resolver | PASS | Probe read-only saat finalisasi mengembalikan settings={}, sources={}, schema_version=1 |

Tidak ada failure/skipped pada hasil final. Suite historis tidak diklaim sebagai pengujian approval/governance baru. Semua container/database uji dibersihkan oleh harness; fixture utama tidak di-reset. Data public/private/Auth lama dipertahankan saat upgrade; hanya objek/reference additive yang ditambahkan. Audit yang sebelumnya ada dibandingkan memakai kolom lama, tanpa menulis ulang histori.

Kasus Migration 11 mencakup learning type jamak, shared level/program-level, kelas historis, first-placement race, multi-role, institution/program/multiple/no/expired/revoked scope, tampering, eskalasi, tenant isolation, inheritance/provenance, uniqueness index, atomic replacement, recovery terverifikasi, larangan self-verification, undangan stale setelah orang yang sama kembali menjabat, serta isolasi approval. Regresi API memastikan leadership tidak dapat menggantikan WALI/LEMBAGA_A.

Lint public/private selesai exit 0 tanpa error. Dua warning 42804 berasal dari deklarasi result jsonb:='{}' dan sources jsonb:='{}' dalam effective_learning_config. PostgreSQL mengonversi literal valid menjadi jsonb; tidak ada input pengguna atau SQL dinamis pada inisialisasi ini. Test inheritance dan probe function terpasang membuktikan objek JSON yang benar. Tidak dilakukan perubahan schema hanya untuk membungkam warning.

Saat pengembangan, assertion observasi concurrency sempat gagal karena pg_stat_activity tersimpan dalam snapshot transaksi pengamat; harness diperbaiki dengan pg_stat_clear_snapshot. Guard akademik juga ditinjau agar akses field record spesifik tabel tidak dievaluasi pada tabel lain. Hasil final di atas memakai perbaikan tersebut. Migration 11 sudah applied sekali di utama; finalisasi tidak mengulang apply.

Security review: no client/service_role CRUD pada tabel private workflow, leadership mutation hanya melalui governance, fixed search_path dan explicit EXECUTE grants, cron tetap expiry-only. Scan secret/path dan review satu temuan template URL runtime dijelaskan pada SECURITY_AUDIT.md. Migration 1–10 tidak berubah.

Batas pengujian: lokal PostgreSQL/Supabase; bukan staging/production atau pembuktian semua interleaving/performa. Tidak ada email delivery, UI recovery, fitur analytics/laporan, atau frontend. Registry konfigurasi produksi masih kosong sampai key dan aturan pedagogis disepakati.

Langkah tepat berikutnya: publikasikan checkpoint yang lulus test ke main, verifikasi push/working tree, laporkan, lalu berhenti.


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
