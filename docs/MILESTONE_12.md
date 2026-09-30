# Milestone 12 — fondasi aplikasi web multi-role

## Checkpoint aktif: 12.3 context bootstrap (2026-10-01)

Bootstrap memakai backend migration 1–11 tanpa perubahan schema, RPC atau RLS. Tidak ada migration baru. Pemilihan konteks awal sudah tersedia; full role/context switcher 12.4 belum dibuat.

Alur: `/login` → `/app` memverifikasi Auth dan profile → context kosong menampilkan state khusus → satu konteks valid tanpa preferensi invalid masuk otomatis → beberapa konteks membuka `/app/select-context` → pilihan masuk `/app/i/[institutionId]/as/[membershipId]`. Deep link selalu menjalankan bootstrap baru dan mencocokkan kedua ID terhadap konteks milik caller; ID tidak diteruskan sebagai grant/role. Link salah menampilkan permission-denied generik tanpa data tenant tujuan.

Sumber data, semuanya melalui session user dan RLS:

1. Profile minimal dengan `auth_user_id` sesuai caller. Profil missing/disabled ditampilkan eksplisit, tanpa silent provisioning.
2. `my_institutions()` memberi proyeksi terbatas lembaga aktif, bukan SELECT seluruh tabel institutions.
3. `institution_members` dibatasi `profile_id` sendiri, institution IDs hasil RPC, status ACTIVE, joined_at yang sudah mulai, ended_at/deleted_at NULL; join role mengambil code/name backend.
4. Membership MUDIR/WAKIL_MUDIR memakai `my_leadership_scopes()`. RPC menyaring revoked/start/expiry. Hasil dijoin lagi ke membership dan tenant yang tepat, expiry dicek saat membentuk model.
5. Karena RPC scope belum menyaring program nonaktif, query metadata programs hanya memakai ID scope tersebut, institution IDs sah, is_active=true dan deleted_at=NULL. Tidak ada broad program query. Program tidak aktif menghilangkan scope tersebut dari model, tanpa mengubah grant backend.

Satu selectable context mewakili **satu membership**, dengan institutionId/name, membershipId, roleCode/label backend, leadershipScopes, programScopeIds, scopeKind, revalidateAt dan metadata presentation/queryIntent. Multi-role tetap menjadi beberapa context; beberapa scope program Wakil menjadi satu context dengan daftar program eksplisit. No scope tidak pernah diartikan institution-wide. Role tidak dikenal/platform-only tidak dibuat menjadi context lembaga.

Metadata queryIntent membedakan institution operations, institution monitoring, scoped monitoring, guardian relationships, teacher assignments dan student identity. Metadata ini hanya tujuan query/presentasi; belum ada query dashboard/roster/anak. Tidak memberikan permission approval. RLS tetap memeriksa setiap operasi di milestone berikutnya.

Preferensi lokal hanya menyimpan pasangan institutionId/membershipId dengan key per auth user, tidak menyimpan role, token, scope atau data bisnis. Setiap bootstrap memeriksa ulang pasangan tersebut; invalid dihapus dan user memilih kembali (termasuk bila hanya satu context tersisa). Untuk beberapa context, preferensi valid hanya menandai pilihan terakhir; tidak melewati halaman pilihan dan tidak memilih privilege tertinggi. Storage tidak tersedia tidak menghalangi penggunaan aplikasi.

Navigasi context memakai dokumen baru sehingga response/router state context sebelumnya tidak dipakai lagi. Context reducer tetap membersihkan payload dan menolak generation lama. Logout/account change membersihkan state dan preferensi caller; back/forward cache memicu revalidasi. Context aktif dengan expiry yang diketahui memicu bootstrap ulang pada batas expiry. Scope/revocation/perubahan program diperiksa ulang pada bootstrap/navigasi; tidak ada subscription realtime private table. Snapshot context bukan jaminan akses sampai refresh berikutnya; backend tetap final authority.

File tambahan: domain/application-context, data/context-repository, application/bootstrap-context, features/context/*, shell/account-shell, dua route context, unit/context.test.ts, e2e/context.spec.ts dan fixture web-context-fixture.mjs. Tidak menambah package.

Pengujian memakai lab native/Auth/PostgREST existing. Governance pimpinan fixture melalui RPC onboarding/verifikasi/invitation/redeem, bukan role metadata Auth. Negative expiry/revoked/program disabled disiapkan hanya pada lab. Gangguan context query dan invalidasi session di tengah bootstrap memakai fault injection pada gateway lab (bukan endpoint test dalam aplikasi). Missing-profile fixture menonaktifkan trigger hanya saat satu signup lab dan mengaktifkannya kembali; runner memeriksa aplikasi tidak membuat profile tersebut diam-diam.

## Fondasi yang tetap berlaku dari 12.1–12.2

Implementasi berada di `apps/web`, memakai Next.js App Router + TypeScript, React, Tailwind dan Supabase SSR. Aplikasi ini milik seluruh role yang diizinkan backend; bukan aplikasi khusus Admin Lembaga. Migration 1–11, RLS, RPC dan fixture utama tidak diubah.

Tersedia: login email/password untuk akun existing, logout sesi browser saat ini, cookie session/persistence/refresh, protected `/app`, profil akun sendiri, redirect internal, loading/error/access state, indikator koneksi dasar. Halaman `/app` adalah konfirmasi akun, bukan dashboard bisnis.

Belum tersedia: full institution/role switcher (12.4), navigation bisnis, dashboard, manajemen akun, invitation UI, teaching flow, Flutter, Super Admin, analytics, laporan, offline storage/queue/sync. Tidak ada signup, forgot-password atau OAuth UI pada checkpoint ini.

## Struktur dan batas tanggung jawab

```text
apps/web/src/
  app/                  route/layout/loading/error
  application/          verifikasi akun dan orkestrasi profil
  domain/               DTO, safe redirect, reducer session/context
  data/                 query profil eksplisit dengan user client + RLS
  lib/supabase/         browser/server adapters
  features/auth/        form, logout, session provider
  features/shell/       indikator koneksi
  components/ui/        button, field, state card
  styles/               semantic tokens dan reduced motion
```

Semantic tokens memisahkan warna, tipografi, radius, shadow dan motion dari business logic. Layout responsif, label form, keyboard focus, live error/loading, skip link dan `prefers-reduced-motion` tersedia. Tidak ada library state/cache tambahan.

## Auth dan security

- Browser menggunakan `@supabase/ssr` cookie storage; server menggunakan client per request. Proxy me-refresh session, sedangkan data loader `/app` tetap memverifikasi `getUser()` melalui Auth pada setiap request. Layout/proxy atau state React bukan security boundary.
- Query profil memilih hanya `id, full_name, preferred_name`, memakai `auth_user_id = verified user.id`, `is_active = true`, dan `deleted_at IS NULL`. `profiles.id` tidak dianggap sama dengan ID Auth. Profil tidak tersedia menampilkan access state dan tetap dapat logout.
- Cookie SameSite=Lax; Secure pada HTTPS. Cookie tidak dibuat HttpOnly karena browser SDK perlu membaca/menulis sesi. Jangan menambah script pihak ketiga yang tidak tepercaya. Deployment wajib HTTPS dan konfigurasi reverse proxy yang benar; production deployment belum diuji.
- Halaman auth/protected dinamis dengan `private, no-store`; jangan cache respons berisi profil/Set-Cookie di CDN. Tidak ada token/JWT yang disimpan dalam React context, URL, source, atau application localStorage.
- Logout memakai scope `local` (sesi browser ini). Perubahan Auth membersihkan state; akun berbeda memakai navigasi penuh. Tab lain mengikuti event Auth; bfcache direvalidasi. Profil menunggu inisialisasi sesi browser sebelum tampil untuk menutup race logout saat hidrasi.
- Logout membuang sesi lokal dan mencabut refresh token sesi tersebut; access JWT yang sudah diterbitkan dapat tetap berlaku sampai expiry sesuai kontrak Supabase. Jangan menganggap logout sebagai revocation instan atas bearer token yang telah disalin.
- Redirect hanya menuju `/app` yang sudah diimplementasikan. Tujuan eksternal, protocol-relative, backslash, query/path lain semuanya kembali ke `/app`. Allowlist perlu diperluas eksplisit saat route baru ditambahkan.
- Error ke pengguna generik; detail database/upstream tidak ditampilkan. Client tidak memperoleh service_role, database password, permission provisioning atau privilege baru.

## Batas context untuk pengembangan berikutnya

Reducer menampung `userId`, `contextKey`, generation dan data presentasi di memori. Pergantian account/context mengosongkan data sebelum load; respons dari generation lama diabaikan. Reducer tidak menetapkan role aktif database dan tidak mengesahkan context yang dipilih.

Setiap repository bisnis berikutnya wajib memilih query/proyeksi sesuai mode, dengan filter institution/relationship/program eksplisit. Mode Wali membaca relasi anak VERIFIED; Mudir menggunakan monitoring yang diizinkan; Wakil hanya scope aktif. **Dilarang mengambil union seluruh data yang dapat dibaca lalu menyembunyikan sebagian di UI.** No scope tidak berarti full access. Memiliki context GUARDIAN/TEACHER/STUDENT tidak membuktikan hubungan anak/assignment/enrollment tertentu masih valid; query bisnis nanti wajib memeriksanya melalui backend.

Acceptance reducer memeriksa data mode/institution lama terhapus dan respons terlambat ditolak. Browser menguji selection/deep link antar-context, logout dan pergantian akun tanpa sisa tampilan. Pengujian penuh switcher 12.4 serta isolasi data dashboard/anak tetap menunggu implementasi fitur tersebut.

Repository/data adapter dipisahkan supaya durable storage, queue, retry dan conflict handling dapat ditambahkan kemudian. Tidak ada service worker, cache offline, fake sync status, atau antrean mutasi pada checkpoint ini.

## Menjalankan lokal

Prasyarat: Node 24, pnpm sesuai root packageManager, Supabase lokal existing aktif. Dari root:

```sh
pnpm install --frozen-lockfile
pnpm dev:web:local
```

`web-local.mjs` membaca CLI status ke memori lalu meneruskan **hanya** API URL dan publishable key ke Next. Tidak mencetak/menulis credential. Di Windows, bila Docker tidak ada pada PATH, tambahkan direktori `DockerDesktop/resources/bin` milik instalasi lokal ke PATH sesi shell terlebih dahulu. Buka `http://127.0.0.1:3000/login`, gunakan akun existing; tidak dibuat akun produksi/dummy permanen.

Konfigurasi manual/CI memakai dua environment variable:

| Variable | Isi |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Origin HTTPS Supabase; HTTP hanya loopback untuk lokal |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key `sb_publishable_…` |

Semua `.env*` tetap diabaikan Git. Legacy JWT anon key sengaja tidak diterima agar service_role JWT tidak keliru dibundle. Gunakan publishable key dari Supabase. Variabel `NEXT_PUBLIC_*` dimasukkan ke bundle saat build; rebuild jika target Supabase berubah. Jangan memakai hasil build test terisolasi untuk menjalankan aplikasi terhadap instance utama.

```sh
pnpm lint:web
pnpm typecheck:web
pnpm test:web:unit
pnpm build:web
```

`typecheck:web` dan `build:web` memerlukan environment di atas. Untuk membaca konfigurasi lokal tanpa membuat .env: `node scripts/web-local.mjs typegen` diikuti `pnpm --filter @ngajitrack/web exec tsc --noEmit`; build lokal memakai `node scripts/web-local.mjs build`.

## Test browser yang dapat diulang

```sh
pnpm --filter @ngajitrack/web exec playwright install chromium
pnpm test:web
```

Runner membuat database/container Auth/PostgREST terpisah, apply migration existing 1–11, dan memakai gateway loopback untuk path standar Supabase. Akun, password, JWT signing secret, publishable-key fixture dan refresh token hanya runtime. Fixture access token expired ditandatangani oleh lab sendiri dari token Auth lab; runner membuktikan Auth menolaknya sebelum menguji refresh SSR. Tidak menggunakan key produksi.

Runner membangun Next production, menguji Chromium, lalu menghentikan server/container milik run dan memeriksa fingerprint fixture utama identik. Screenshot hanya layar akun sintetis; trace/video/storageState dimatikan, reports/test-results diabaikan Git. Gateway lab tidak ditujukan untuk deployment produksi.

Rujukan implementasi: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Next.js App Router](https://nextjs.org/docs/app/getting-started/installation), [Next.js Playwright](https://nextjs.org/docs/app/guides/testing/playwright), [Tailwind Next.js](https://tailwindcss.com/docs/installation/framework-guides/nextjs).
