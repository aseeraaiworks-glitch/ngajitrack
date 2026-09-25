> Checkpoint aktif migration 1–10: gunakan docs/HARDENING.md dan docs/BACKEND_CONTRACT.md. Runbook di bawah adalah histori gate migration 1–7. Runner API lama menggunakan fixture kosong dan perilaku tanpa approval; jangan memakainya pada instance utama saat ini.

# Melanjutkan verifikasi Supabase lokal

Scope tetap backend foundation. Tidak ada Flutter/UI. Seluruh langkah memakai project lokal NgajiTrack; jangan memakai --linked atau kredensial cloud.

## Status terbaru (2026-09-24)

Docker 29.8.0 + WSL2 aktif. Migration 1–7 applied; SQL 76/76 (73 native + 3 embedded), API 17/17, lint tanpa temuan. Database sekarang berisi fixture sintetis. Prasyarat mesin di bawah adalah catatan historis, bukan blocker saat ini.

## Kendala mesin historis

- Docker/Podman tidak ditemukan, termasuk lokasi instalasi Docker yang umum.
- `wsl --status` dan `wsl --list --verbose`: WSL belum terpasang.
- `wsl --install --no-distribution --no-launch`: exit 1; WSL tetap belum terpasang.
- Windows melaporkan `VirtualizationFirmwareEnabled=False`, `HypervisorPresent=False`, SLAT tersedia. Aktivasi virtualisasi harus dilakukan pada BIOS/UEFI mesin.
- Sesi shell bukan Administrator. Setup WSL/fitur Windows memerlukan langkah administrator dan mungkin restart.
- `supabase start`: LegacyDockerLifecycleInspectError; runtime container tidak ditemukan.
- Auth lokal pada 127.0.0.1:54321: ECONNREFUSED.

## Prasyarat mesin (sudah diselesaikan)

1. Aktifkan Intel Virtualization Technology/VT-x pada BIOS/UEFI, simpan, lalu boot Windows.
2. Buka PowerShell sebagai Administrator dan jalankan `wsl --install --no-distribution`. Ikuti permintaan Windows dan restart jika diperlukan. Verifikasi `wsl --version` setelahnya.
3. Pasang Docker Desktop dari sumber resmi, gunakan backend WSL 2, jalankan sampai engine siap. Verifikasi `docker version` menampilkan bagian Client dan Server.

Rujukan: [Microsoft — Install WSL](https://learn.microsoft.com/en-us/windows/wsl/install), [Docker — Windows installation](https://docs.docker.com/desktop/setup/install/windows-install/), [Supabase — local development](https://supabase.com/docs/guides/local-development).

## Start dan apply migration

Dari root project, gunakan CLI lokal yang sudah terpasang. Pada Docker Desktop 29.8.0, opsi network saja ternyata tidak mengikat port host ke loopback. Helper bind-local-ports.mjs memperbaiki binding eksplisit dan menjaga named volumes serta sertifikat Kong; tunggu health check sebelum test. Helper khusus context Docker Desktop Linux engine lokal, bukan remote. Jalankan sebelum provisioning fixture. Setelah stop/start atau reset, periksa binding lagi. Vector dikecualikan karena gagal mengakses sumber log Docker; tidak mematikan RLS/Auth.

Jika sesi Codex memakai PATH lama setelah instalasi Docker, tambahkan untuk sesi PowerShell ini:

```powershell
$env:Path = "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin;$env:Path"
```

Network khusus tetap digunakan: Jika network sudah ada, periksa dahulu dan gunakan kembali bila konfigurasinya sesuai.

```powershell
docker network create --driver bridge --opt com.docker.network.bridge.host_binding_ipv4=127.0.0.1 ngajitrack-local
node node_modules/supabase/dist/supabase.js start --network-id ngajitrack-local --exclude vector
node scripts/bind-local-ports.mjs
node node_modules/supabase/dist/supabase.js migration up --local
node node_modules/supabase/dist/supabase.js migration list --local
```

History harus memuat tujuh versi dari folder supabase/migrations. Jangan mengedit migrasi lama bila ditemukan masalah native; catat failure dan gunakan forward fix yang direview.

## Native SQL dan Auth/JWT/PostgREST tests

`test:postgres` menjalankan suite SQL sebagai role database dengan klaim request; `test:api` berbeda: membuat akun melalui Auth Admin API lokal, login password, refresh/logout, lalu memakai JWT user melalui HTTP PostgREST. Tidak ada fallback embedded pada runner API.

Status CLI mengandung kredensial; tampung di memori, jangan cetak/commit JSON status tersebut. Runner API memakai ANON_KEY dan SERVICE_ROLE_KEY lokal dari output CLI.

```powershell
$ngtRuntime = node node_modules/supabase/dist/supabase.js status -o json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Local Supabase is not ready' }
$env:NGAJITRACK_TEST_DATABASE_URL = $ngtRuntime.DB_URL
$env:NGAJITRACK_TEST_API_URL = $ngtRuntime.API_URL
$env:NGAJITRACK_TEST_ANON_KEY = $ngtRuntime.ANON_KEY
$env:NGAJITRACK_TEST_SERVICE_ROLE_KEY = $ngtRuntime.SERVICE_ROLE_KEY
try {
  node scripts/test-postgres.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Native SQL suite failed' }
  node scripts/test-api.mjs
  if ($LASTEXITCODE -ne 0) { throw 'API suite did not pass; inspect reports/local-api-test.json' }
} finally {
  Remove-Item Env:NGAJITRACK_TEST_DATABASE_URL,Env:NGAJITRACK_TEST_API_URL,Env:NGAJITRACK_TEST_ANON_KEY,Env:NGAJITRACK_TEST_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
  $ngtRuntime = $null
}
```

Runner API memeriksa localhost port 54321/54322, history migration lengkap, dan database kosong (auth.users/profiles/institutions). Password acak, JWT dan key hanya disimpan dalam memori. Semua HTTP request menolak redirect dan memiliki timeout.

Fixture SQL dibuat lewat transaction; akses yang sedang diuji memakai JWT user, bukan service key. Service key hanya untuk pembuatan akun dan pengujian worker expiry yang memang service-only.

API membutuhkan fixture committed agar terlihat dari koneksi HTTP. Fixture sintetis ditinggalkan setelah test; tidak ada cleanup yang mematikan RLS/audit atau menghapus data diam-diam. Jika setup gagal di tengah, akun sintetis dapat sudah tercipta. Untuk mengulang, periksa bahwa database memang instance lokal sekali pakai ini, lalu `node node_modules/supabase/dist/supabase.js db reset --local` sebelum mengulang kedua suite. Reset menghapus seluruh data instance lokal tersebut.

## Bukti yang harus dicatat

- History migration 1–7 applied pada PostgreSQL native, versinya, dan hasil lint.
- Output suite SQL native serta `reports/local-api-test.json` berstatus PASS dengan jumlah check nyata.
- Multi-tenant, multi-role, VERIFIED guardian, assignment ustaz, identity reuse, no automatic ADMIN, schedule expiry, histori ENDED, revoked relationships, disabled profile, JWT tampering, refresh dan logout.
- Test scheduler runtime terpisah dari pemanggilan worker manual; pasang setelah hasil dasar SQL/API valid, lalu buktikan pemanggilan periodik.
- Concurrency beberapa koneksi masih perlu test tersendiri. Runner API sequential ini tidak membuktikan concurrency.
- Update IMPLEMENTATION_STATUS.md dan TEST_REPORT.md dengan hasil sebenarnya. Jangan menyebut status BLOCKED sebagai lulus.
