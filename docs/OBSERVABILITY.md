# Observability web — Milestone 12.6

Integrasi memakai SDK resmi @sentry/nextjs 11.2.0 dan API transport @sentry/core 11.2.0 dengan inisialisasi eksplisit pada client, Node server dan Edge. Hook `onRequestError` menangkap kegagalan request/render; `error.tsx` dan `global-error.tsx` melaporkan exception sambil mempertahankan pesan aman dan retry. Kegagalan lookup context yang tertangkap juga dilaporkan setelah pemeriksaan sesi. Auth, permission, query intent, RLS dan backend migration tidak berubah.

## Environment

| Variable | Pemakaian |
| --- | --- |
| NEXT_PUBLIC_SENTRY_DSN | Opsional. Salin DSN project Sentry yang sebenarnya dari pengelola deployment; kosong berarti SDK tidak diinisialisasi dan tidak mengirim event. Tidak ada nilai contoh/credential buatan yang disimpan. |
| NEXT_PUBLIC_SENTRY_ENVIRONMENT | development, test, atau production. Default mengikuti NODE_ENV (production atau development); runner uji selalu menetapkan test. |
| NEXT_PUBLIC_SENTRY_RELEASE | Opsional: versi semver sederhana atau Git SHA 7–40 karakter. Default 0.1.0, dikirim sebagai ngajitrack-web@versi. CI sebaiknya memakai SHA build agar event dan source map cocok. |
| SENTRY_UPLOAD_SOURCEMAPS | Default tidak aktif. Set true hanya pada build CI yang memang akan upload source map. |
| SENTRY_AUTH_TOKEN | Secret build CI saja, wajib bila upload aktif. Jangan memakai prefix NEXT_PUBLIC dan jangan simpan di repository/runtime client. |
| SENTRY_ORG / SENTRY_PROJECT | Identitas project untuk upload CI, wajib bila upload aktif. |

Public variables dibekukan oleh Next saat build; ubah konfigurasi lalu build ulang. DSN client/server memakai konfigurasi yang sama. DSN produksi/development wajib HTTPS tanpa private password/query/hash. HTTP hanya diizinkan untuk 127.0.0.1 dengan environment test agar receiver uji lokal dapat dipakai. Environment dan release invalid menggagalkan konfigurasi dengan pesan generik, tanpa mencetak nilainya.

Jangan mengisi DSN placeholder untuk mengaktifkan production. Gunakan project/environment yang sesuai deployment, dan bila perlu project Sentry terpisah untuk development/production. Tidak ada token Sentry diperlukan untuk capture error; auth token hanya untuk upload build. Environment file tetap diabaikan Git.

## Kebijakan payload minimum

`beforeSend` membentuk event baru dari field yang diizinkan, kemudian transport melakukan pemeriksaan kedua pada payload akhir. Tidak menggunakan blacklist yang hanya menebak nama field sensitif.

Yang boleh dikirim: ID event acak, waktu, environment/release, runtime client/server/edge, route template tanpa ID/query, kelas error bawaan, pesan tetap `Unexpected application error`, maksimum tiga exception dengan 30 frame kode masing-masing, koordinat bundle Next dan debug ID source map yang valid. Absolute filesystem path, function name, locals dan source snippets dibuang. Pesan exception bebas diganti, sehingga data personal yang kebetulan masuk dalam Error.message juga tidak dikirim.

Yang dibuang: user (termasuk internal ID/IP/name/email), request/URL/query/body/header/cookie, access/refresh token, authorization, password/DB credential/service-role key, form data, phone/full name, catatan hafalan/data Qur'an, extra/context arbitrer, transaction/fingerprint bebas, breadcrumbs, module/server metadata dan attachment. Envelope hanya boleh berisi error event; item session, log, trace, metric, profile, replay, feedback dan client report tidak diteruskan. Metadata envelope di luar ID event dan waktu dibuang.

Tidak ada `setUser` atau pengaitan account/institution/membership ke Sentry. Logout tidak meninggalkan identitas telemetry karena identitas tersebut tidak pernah direkam. Transport memakai credentials omit, no-referrer dan tidak meneruskan header aplikasi. Seperti layanan HTTP lain, endpoint tujuan tetap memproses IP jaringan/metadata protokol; pengelola project perlu meninjau retensi, akses anggota dan pengaturan IP/PII Sentry sebelum aktivasi production. Ini bukan klaim anonimitas jaringan.

Minimisasi ini sengaja mengurangi detail debugging: gunakan release, jenis error, route template dan posisi bundle. Sanitizer mempertahankan debug ID dan code-file yang dinormalisasi agar symbolication melalui source map memungkinkan; verifikasi end-to-end di project Sentry asli masih diperlukan ketika kredensial deployment tersedia.

## Jenis error dan fitur yang tidak aktif

Capture: unexpected exception client, unhandled promise rejection, unexpected server/runtime/render failure, error boundary dan kegagalan context lookup yang tidak disebabkan sesi invalid.

Tidak dianggap crash: login salah, validasi form biasa, no profile/context/institution, permission denied, scope revoked yang ditangani, serta redirect/not-found Next dan AbortError. Flow tersebut memakai response/state existing. Filter AuthApiError normal 400/401/403 juga disediakan; gangguan server bukan otomatis diabaikan.

Default integrations dimatikan. Client hanya memakai global exception/rejection handlers, browser API error capture dan deduplication. Node hanya handler exception/rejection, ditambah hook request Next. OpenTelemetry setup server dimatikan. Tidak mengaktifkan tracing/performance sampling, trace propagation, session replay, profiling, logs, metrics, session tracking, breadcrumbs DOM/console/network atau feedback. Tidak ada public test route, tunnel route atau monitoring dashboard dalam aplikasi.

## Source map dan build

`withSentryConfig` dari `@sentry/nextjs/config` dipakai hanya bila upload diaktifkan eksplisit. Tanpa upload, konfigurasi build biasa dipertahankan; tidak menerbitkan browser source map. Upload memerlukan seluruh variable CI di atas dan DSN valid, build telemetry dimatikan, source map hasil plugin dihapus setelah upload. Token tidak dimasukkan ke config.env atau bundle. Source map mengandung kode aplikasi: akses project Sentry harus dibatasi. Tidak ada upload otomatis dari test lokal.

## Pengujian

```sh
pnpm test:web:unit
pnpm test:web
node scripts/test-web.mjs --monitoring
```

Unit menguji redaction mendalam, expected error, DSN/release/environment, source-map metadata dan payload HTTP final. Suite browser default menjalankan acceptance Milestone 12 tanpa DSN. Mode --monitoring menjalankan suite khusus pada build produksi dengan receiver envelope loopback terpisah. Public protocol key acak hanya ada dalam memori selama lab; bukan credential/project Sentry palsu dan tidak mengarah ke layanan eksternal. Runner mengosongkan DSN/token upload yang mungkin diwarisi dari environment shell.

Receiver test hanya menerima envelope error, memeriksa header dan metadata, serta menyediakan pembacaan hasil dengan token kontrol runtime. Receiver bukan route Next/production. Browser melempar exception melalui Playwright; server failure memakai fault profile lookup lab existing. Laporan tidak menyimpan payload telemetry, Auth session, token, atau password fixture. Semua fixture dibuat di database terpisah; runner memeriksa fingerprint instance utama dan membersihkan container lab.

Finalisasi 2026-10-02: unit 51/51 (termasuk delapan privacy/config/transport), acceptance tanpa DSN 71/71 dan browser SDK enabled 6/6 lulus. Capture client exception/rejection, server/route/boundary/handled service failure, expected-error exclusion, logout privacy serta retry telah diperiksa melalui HTTP receiver lokal. Hasil acceptance dan keterbatasan aktual dicatat di TEST_REPORT.md. Tidak ada DSN produksi yang dikonfigurasi oleh checkpoint ini. Aktivasi layanan Sentry, upload/symbolication nyata dan verifikasi Edge deployment dilakukan saat environment deployment tersedia.

Referensi resmi: [manual setup Next.js](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/), [filtering](https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/filtering/), serta types/source SDK versi yang dipin pada lockfile.
