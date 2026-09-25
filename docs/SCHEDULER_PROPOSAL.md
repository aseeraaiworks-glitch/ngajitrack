# Desain scheduler expiry yang disetujui dan diterapkan

Konfigurasi final: satu job ngajitrack-expire-enrollments setiap 15 menit, command select public.expire_institution_enrollments(500). Ini memperbarui status tersimpan; batas akses tetap ditentukan started_at/scheduled_end_at dalam zona waktu institution, tanpa menunggu cron.

## Privilege

- ngt_expiry_scheduler: LOGIN, password NULL, NOINHERIT, NOSUPERUSER, NOBYPASSRLS, NOCREATEROLE, NOCREATEDB, NOREPLICATION; tidak menjadi member role lain. Tidak menggunakan service_role. Login diperlukan pg_cron, bukan akun aplikasi.
- Untuk operasi aplikasi, hanya USAGE public dan EXECUTE worker existing SECURITY DEFINER. Tidak ada CRUD produk, akses helper private atau API pengelolaan cron.
- Operator postgres mempunyai ADMIN-only membership otomatis PostgreSQL 16+, tanpa SET/INHERIT. Scheduler tidak mendapatkan hak postgres. Kemampuan SET operator dan izin cron scheduler selama registrasi bersifat sementara dalam transaksi dan dicabut sebelum commit.
- PUBLIC/anon/authenticated/authenticator tidak dapat mengelola cron. Client tidak mempunyai membership scheduler dan tidak bisa memanggil worker.
- Worker service_role existing tetap tersedia untuk server yang sudah terotorisasi pada migration 7; scheduler baru tidak menggunakan credential/role tersebut. Tidak mengubah RLS produk.

## Prasyarat runtime dan keamanan koneksi

pg_cron harus tersedia dalam preload dan dipasang di cron.database_name. Runtime lokal memakai cron.use_background_workers=off dan cron.host=localhost. HBA lokal existing mengizinkan loopback internal; tidak ada HBA baru atau trust luas yang ditambahkan. Port publik menggunakan autentikasi password sehingga role tanpa password gagal login dari luar container; ini diuji aktual. Jangan menyalin asumsi lokal ke staging/cloud tanpa verifikasi. Migration tidak menyimpan secret atau mengubah autentikasi host.

## Idempotensi dan beban

Registrasi nama job yang sama memperbarui job role tersebut tanpa duplikat; konflik owner/database serta privilege drift ditolak. Worker menerima batch 1–1000; jadwal tetap 500 per run, bukan loop tanpa batas. Backlog bertahan untuk run berikutnya. Timeout statement 60 detik dan lock 5 detik membatasi pekerjaan; retry pada jadwal berikutnya, dengan rollback audit/data bila transaksi gagal. Root dan turunan ditutup atomik; row ENDED tidak diproses ulang.

## Verifikasi

13 assertion scheduler di container terpisah mencakup retry periodik, dua tipe enrollment, backlog 1.101, duplikasi, audit dan least privilege. 8 pemeriksaan setelah apply utama membuktikan fixture/ACL/RLS identik dan replay oleh operator asli. Probe cron nyata di utama sukses lalu dihapus; job normal tidak diubah intervalnya. Test periodik memakai interval 1 detik; konfigurasi normal 15 menit diverifikasi di katalog.

Rujukan: [pg_cron](https://github.com/citusdata/pg_cron), [Supabase Cron](https://supabase.com/docs/guides/cron).
