# Audit sebelum publikasi Git

## Checkpoint 12.6 (2026-10-02)

- 151 kandidat source/config/docs/test dipindai: 0 temuan pola JWT, private key, private API/GitHub/Sentry token, literal DSN atau path sensitif. 12/12 probe ignore lulus. .env*, credential/key, .next, reports, browser output, cache/log dan runtime tetap dikecualikan. Index diperiksa ulang sebelum commit; audit pola dilengkapi review diff, bukan jaminan seluruh format secret.
- SDK @sentry/nextjs dan transport API @sentry/core dipin 11.2.0. Core sudah dependency SDK, ditambahkan langsung karena kode mengimpor API tersebut. pnpm menambah pengecualian release-age untuk 14 package Sentry versi tepat 11.2.0, bukan wildcard/global bypass. pnpm audit --audit-level high tidak menemukan kerentanan dikenal; Next/Supabase tidak di-upgrade.
- Default SDK integrations dimatikan. Hanya error monitoring diperlukan yang diinisialisasi; server OpenTelemetry, trace propagation, breadcrumbs, replay, logs, metrics, session tracking, attachments dan client reports tidak dikirim. Tidak memakai setUser; account/profile/membership/institution tidak menjadi identity telemetry.
- beforeSend membentuk event baru dari allowlist. Transport memeriksa ulang dan hanya mengirim envelope error tanpa request/body/header/cookie/token/PII, pesan bebas, locals/source snippets atau arbitrary context. HTTP memakai credentials omit/no-referrer; tidak meneruskan header aplikasi. Unit memeriksa payload HTTP akhir, bukan hanya return value sanitizer. Public generated source map pada build tanpa upload: 0.
- DSN opsional, tidak disimpan dalam repository. SENTRY_AUTH_TOKEN hanya untuk opt-in CI upload, tidak menjadi NEXT_PUBLIC atau config.env. Source map/debug ID support disiapkan; upload ke project nyata belum dilakukan. Metadata jaringan HTTP tetap diproses penerima; pengaturan retensi/PII/IP dan akses project Sentry perlu ditinjau saat deployment.
- Receiver Sentry dan protocol key acak hanya lab loopback; bukan project/credential produksi. Runner mengosongkan DSN dan token upload yang diwarisi. Tidak ada public test route, tunnel atau endpoint administrative dalam aplikasi. Laporan tidak merekam payload session/telemetry mentah.
- Auth, role/scope, context URL validation, queries, switcher, shell dan Migration 1–11 tidak diubah. Satu tambahan pada catch bootstrap melaporkan unexpected lookup failure setelah pemeriksaan sesi; tidak mengubah keputusan permission. RLS tetap final authority, scope UI tidak mengubah grant database. Review source tidak menemukan logging session/token atau penggunaan service_role dalam aplikasi.
- Acceptance tanpa DSN 71/71 dan SDK enabled 6/6 lulus dengan audit envelope/query akhir serta fingerprint fixture utama identik. Salah login, no-context dan denied tidak menghasilkan crash; client/server/route/boundary failure tertangkap tanpa pesan bebas/identitas/session lama. Private repository, branch main dan izin push diverifikasi sebelum publikasi.

## Checkpoint 12.5 (2026-10-01)

- 138 kandidat source/config/docs/test dipindai: 0 temuan pola secret atau path sensitif; 12/12 probe ignore lulus. Index diperiksa ulang sebelum commit. .env*, credential/key, generated Next output, cache/log, reports dan output browser tetap dikecualikan. Scan berbasis pola dilengkapi review source/diff; bukan jaminan semua format secret.
- Shell menerima context hasil validasi server dan memeriksa kecocokan context key aktif sebelum menampilkan tenant/role/navigation. Invalidasi switcher menghilangkan label/link/payload lama. Menu hanya berisi route ringkasan/pilihan context existing; tidak membuka operasi baru atau mengambil union permission. Program focus dipertahankan dalam link tervalidasi.
- Auth/session, domain context, bootstrap/repository, cookie, URL validation, abort/generation dan backend tetap memakai contract existing. Tidak ada service_role/credential baru dalam aplikasi. Migration 1–11, schema/RLS/RPC dan dependency tidak berubah; dependency audit bersih. Error boundary generik tidak memperlihatkan detail upstream atau shell yang belum lolos verifikasi.
- Avatar memakai inisial profile sendiri, tanpa network image. Sidebar/menu hanya menyimpan state sementara per dokumen. Toast saat ini hanya informasi koneksi umum; tidak menyimpan data bisnis atau klaim sinkronisasi. Theme hanya token architecture, tanpa storage/preference baru.
- Harness browser memakai scope revocation melalui RPC governance lab, bukan perubahan pada fixture utama. Fault profile lookup dan pemulihannya hanya gateway loopback lab dengan kontrol tetap/token acak runtime. Tidak ada test route atau administrative operation baru pada aplikasi.
- GitHub tujuan terverifikasi private, main, izin push tersedia. Revoke saat idle masih mengikuti revalidation boundary 12.4; RLS tetap pemeriksa setiap operasi, bukan hidden menu. Tidak melakukan deployment atau mengklaim offline sync.

## Checkpoint 12.4 (2026-10-01)

- 117 kandidat source/config/docs/test diperiksa: 0 temuan pola JWT/private key/private API key/credential atau path sensitif; 12/12 probe ignore lulus. Index diperiksa ulang sebelum commit. .env*, keys, credential, generated output, cache/log, reports dan output browser tetap dikecualikan. Scan pola dilengkapi review diff; bukan jaminan semua format secret.
- Switcher memakai GET session-bound dengan bootstrap baru, no-store/private, tanpa mutasi membership/role atau penggunaan service_role. URL/preference optional program focus harus cocok dengan tenant, membership dan program scope aktif yang dikembalikan backend; fokus hanya mempersempit DTO. Parameter program ganda/asing ditolak. Endpoint tidak menerima caller identity atau memberikan grant.
- Dialog memuat pilihan ulang saat dibuka dan dipilih. Revoke/partial scope change membatalkan presentasi lama. Pending switch membuang payload/generation lama; AbortController dan generation menolak respons terlambat. Navigasi dokumen baru membuang state/router cache. URL per tab tetap independen, sedangkan logout/account change tetap berlaku lintas tab.
- Tidak ada query bisnis union role atau broad monitoring preload. Gateway test memeriksa actual own-profile/own-membership dan active scoped-program filters. Batas pembacaan anak/monitoring bisnis masih harus diterapkan pada repository yang baru akan dibuat pada milestone berikutnya.
- Revocation test memakai satu endpoint kontrol fixture di gateway loopback terpisah, hanya menerima satu operasi tetap dan token acak runtime. RPC pencabutan dijalankan sebagai Mudir fixture. Tidak ada test hook, privileged key, password/token literal, atau administrative endpoint baru dalam aplikasi Next.
- GitHub target kembali terverifikasi private/main dengan izin push. Dependency audit tidak menemukan kerentanan dikenal. Migration 1–11, RLS/RPC produk dan dependency identik. Revalidasi scope saat idle belum realtime; backend tetap boundary otorisasi setiap operasi.

## Checkpoint 12.3 (2026-10-01)

- 109 kandidat source/config/docs/test diperiksa: 0 temuan pola secret atau path sensitif; 12/12 probe ignore lulus. .env*, keys, credential, .next, runtime/cache/log, node_modules, reports dan Playwright output tetap dikecualikan. Index dipindai ulang sebelum commit.
- Context berasal dari own profile (auth_user_id), my_institutions, own active membership+role dan my_leadership_scopes. Program scope harus hadir pada query metadata program aktif dengan IDs eksplisit. Tidak ada pembacaan full institutions atau union business data; audit request pada lab menguji filter yang benar-benar dikirim aplikasi.
- URL/preference hanya pasangan ID yang harus cocok dengan hasil bootstrap baru. Tidak percaya role Auth metadata, role query parameter atau role tersimpan. Context/capability frontend tidak mengganti RLS, tidak memberi approval pimpinan, dan tidak menggunakan service_role. Multi-role tidak digabung menjadi role buatan.
- Session diverifikasi sebelum dan sesudah bootstrap; error query gagal tertutup. Logout/account change menghapus state/preference; context change membuang state lama dan memakai navigasi baru. No profile tidak memicu provisioning.
- Test fixture/governance dibuat hanya di lab; secret/password/token acak di memori. Fault injection hanya gateway test. Tidak ada credential/token disimpan dalam preferensi (dua ID saja), source, trace/video/storageState atau laporan.
- Migration 1–11, backend RLS/RPC, package manifest/lock tetap tidak berubah. Dependency audit tidak menemukan kerentanan dikenal. GitHub target kembali terverifikasi private, default main, push permission tersedia.
- Batas audit berbasis pola dan review source, bukan jaminan semua format secret. Context snapshot perlu divalidasi ulang setiap bootstrap; backend tetap membatasi akses bila grant berubah setelah snapshot. Tidak melakukan deployment.

## Checkpoint 12.1–12.2 (2026-09-29)

- 94 kandidat source/config/docs/test dipindai; tidak ditemukan pola JWT, private key, GitHub/private API key, AWS/Google credential atau path sensitif. 12/12 probe ignore lulus. Index diperiksa lagi sebelum commit. Scan berbasis pola dilengkapi review source, bukan jaminan semua format secret.
- `.env*`, private keys, credential, runtime/cache/log, `.next`, generated next-env/types, node_modules, screenshot reports, Playwright output dan tsbuildinfo tidak masuk commit. Tidak menyimpan contoh password/key nyata dalam README atau dokumentasi.
- Web menerima hanya HTTPS origin (HTTP loopback lokal) dan publishable key. Legacy JWT key/private key ditolak sebelum build/start. Server client memakai session pengguna; tidak ada service_role, DB password, server provisioning atau administrative RPC dalam bundle web.
- Secret Auth/Postgres dan password akun sintetis lab dihasilkan runtime. Token expired test ditandatangani hanya dengan secret lab yang baru dibuat; tidak mengekspor signing key. CLI status lokal dibaca ke memori, hanya URL/publishable key diteruskan, hasil raw tidak dicetak/disimpan. Trace/video/storageState dimatikan.
- Protected data memakai Auth getUser dan RLS, query auth_user_id eksplisit dengan kolom profil minimum. Role/context UI tidak mengubah privilege backend; belum ada query data role. No-store, SameSite, Secure pada HTTPS, redirect allowlist, error generik, pembersihan session/state lintas akun/tab dan penolakan late response diuji.
- `pnpm audit --audit-level high`: No known vulnerabilities found. Lockfile disimpan; lifecycle script unrs-resolver tidak dijalankan (binding prebuilt tersedia, lint/typecheck/build lulus). Pengecualian release-age yang ditulis pnpm terbatas pada versi Next 16.3.7 yang dipin, bukan wildcard/global bypass.
- GitHub target terverifikasi private, default main, permission push tersedia. Tidak mengubah migration 1–11 atau backend RLS/RPC. Tidak melakukan deployment. Production HTTPS, reverse proxy dan CSP tetap perlu verifikasi deployment terpisah.

## Finalisasi Migration 11 (2026-09-26)

- Audit 59 kandidat file: tidak ditemukan secret literal setelah review. Pemeriksaan mencakup JWT, private key, token GitHub/OpenAI/Supabase/AWS/Google, credential URL, serta path sensitif. Sepuluh probe ignore lulus; tidak ada .env, keys, local reports/cache/runtime, atau credential file yang masuk kandidat.
- Satu temuan awal credential-URL pada scripts/auth-api-lab.mjs adalah template dengan interpolasi password acak di memori (randomBytes/config lab). Tidak mengandung password tersimpan; file existing tersebut tidak diubah. Nilai runtime tidak dicetak pada audit ini. Logging kegagalan lab mengganti secret diketahui dengan REDACTED.
- Migration 1–10 diperiksa menggunakan Git object hash dan tetap identik. Migration 11 tidak menyimpan secret. Invitation menyimpan token hash, tidak token plaintext; permission/scopes tidak diambil dari metadata client.
- Tabel private deny direct CRUD untuk anon/authenticated/service_role. Leadership command memakai explicit authorization, transaction-bound permit, snapshot role/scope/epoch dan tenant locks. Satu Mudir aktif ditegakkan unique index. Role scheduler tetap expiry-only.
- Repository aseeraaiworks-glitch/ngajitrack terverifikasi private, branch utama main, izin push tersedia. Credential GitHub hanya dibaca ke memori melalui Git credential helper untuk verifikasi repository; tidak disimpan/dicetak.
- Lint JSON memperingatkan implicit cast konstanta '{}' yang valid, bukan input dinamis; test resolver terpasang lulus. Tidak ada perubahan security baru untuk menghilangkan warning.
- Hasil scan bersifat berbasis pola dan review source; bukan jaminan semua format secret. Scan ulang index dilakukan sebelum commit.


## Checkpoint migration 9–10

Scope final: dua migration, harness/test, kontrak dan dokumentasi. Credential lab dibuat acak di memori/environment proses; token invitation hanya hash dalam tabel private, tidak masuk audit. Client tidak mendapat service_role, issuance atau global binding permission. RLS dan explicit function grants diperiksa pada lab dan utama. `.env*`, keys, reports, cache, node_modules, local runtime dan log tetap dikecualikan. Audit staged sebelum commit memeriksa token/key/private-key/credential-URL serta daftar path; hasil final: 53 file index, 0 temuan pola secret, 0 pelanggaran path, 9 probe ignore lulus. Repository GitHub terverifikasi private dengan izin push. Tidak ada secret baru yang sengaja disimpan pada source.

Tanggal: 2026-09-25. Scope: file calon initial commit NgajiTrack; tidak mengubah logic backend.

## Hasil

- Tidak ditemukan secret pada file calon commit berdasarkan pemindaian pola dan peninjauan konfigurasi/dokumentasi.
- Pemeriksaan mencakup JWT, format token GitHub/OpenAI/Supabase/AWS/Google, private-key headers, URL dengan username/password, serta assignment password/key/token.
- Assignment konfigurasi memakai referensi environment. Password salah pada test adalah input sintetis untuk negative test, bukan credential. Role SQL service_role dan nama variabel key bukan nilai secret.
- Contoh URL dengan password database lokal di README diganti pembacaan CLI status ke memori. Output status tidak dicetak/disimpan.
- .gitignore tidak lagi mengecualikan .env.example dari aturan ignore; seluruh .env dan .env.* diabaikan.
- 13 probe git check-ignore lulus untuk env, signing key, credential, secret, dependencies, runtime Supabase, reports/log dan test output.
- reports/ tetap ada di disk tetapi tidak masuk Git. TEST_REPORT.md menyimpan ringkasan hasil yang dapat dibagikan.
- Kandidat: source/config tanpa credential, tujuh migration, fixture/test sintetis, package manifest/lock, lima source specification, keputusan/panduan, status dan laporan audit ini.
- Hasil scan bukan jaminan terhadap semua format secret; ulangi audit untuk perubahan baru sebelum push.

## Status publikasi

Verifikasi 2026-09-25: identitas author Git tersedia, autentikasi GitHub berhasil, repository target terverifikasi private dan akun memiliki izin push. Remote kosong sebelum initial commit. Branch main dan origin sudah disiapkan. File staged dipindai ulang sebelum commit; status publikasi akhir dapat diperiksa melalui git log dan origin/main.

Target: https://github.com/aseeraaiworks-glitch/ngajitrack.git

Publikasi memakai initial commit dan push main tanpa force. Token hanya digunakan di memori untuk verifikasi GitHub; tidak ditulis ke file atau laporan.
