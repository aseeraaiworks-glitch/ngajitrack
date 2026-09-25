# Backend hardening lokal

Jalankan dari root project dengan Docker tersedia pada PATH dan Supabase lokal ngajitrack berjalan.

- node scripts/test-isolated.mjs: membuat database SQL terpisah, replay migration, menjalankan regresi, menghapus hanya database milik run. Dapat diulang tanpa reset fixture utama.
- Database utama hanya dibaca untuk schema Auth dan fingerprint. Tidak ada akun Auth/data utama yang disalin. Privilege role Supabase tetap berasal dari cluster lokal existing; tidak mengubah role cluster.
- URL koneksi hanya berada dalam memori/environment proses anak, tidak ditulis ke repo. Output pengujian berada dalam reports/ yang diabaikan Git.
- Bila proses dibunuh, database ngt_test_<UUID> dapat tertinggal. Jangan menghapus otomatis berdasarkan prefix: identifikasi run dan periksa koneksi/data sebelum cleanup manual.
- Test SQL memakai request claims database; tidak mengklaim sebagai test HTTP/JWT baru. Tiga test historis tetap embedded dan diberi nama eksplisit.

- node --test --test-concurrency=1 tests/concurrency.test.mjs: enam interleaving nyata; test menggunakan database unik per skenario dan memeriksa wait_event_type=Lock.

## Scheduler migration 8

- node scripts/prove-scheduler-role.mjs: pembuktian awal mekanisme role pada cluster sementara.
- node scripts/test-scheduler.mjs: 13 assertion migration 8 pada container PostgreSQL terpisah; butuh image database Supabase lokal. Container sementara menggunakan tmpfs, bind loopback dan credential admin acak di memori; dihapus setelah test.
- node scripts/verify-scheduler-local.mjs: pemeriksaan pasca-apply dengan baseline lokal reports/scheduler-primary-before.json yang disimpan sebelum apply. Bukan runner untuk database kosong tanpa baseline. Tidak mereset fixture.
- node scripts/probe-scheduler-local.mjs: probe cron singkat pada utama, hanya bila tidak ada enrollment jatuh tempo; job probe dihapus di finally. Jangan gunakan untuk load test atau saat ada pengguna lain yang menulis data.
- Runner SQL historis secara eksplisit mereplay migration foundation 1–7 saja. PGlite tidak mendukung pg_cron; hasil 76 test bukan bukti migration 8. Migration 8 diverifikasi terpisah pada cluster nyata.
- Migration 8 harus diterapkan di cron.database_name, bukan database ngt_test_<UUID> pada cluster utama. Role cluster dan job tidak dibuat oleh runner sandbox SQL.
- Status job dan kegagalan tersedia di cron.job dan cron.job_run_details untuk operator. Retensi log cron belum dijadwalkan; tinjau ukuran log secara berkala. Operator yang menghentikan job harus memakai fungsi cron melalui administrasi tepercaya, tidak memberi akses cron kepada client.
- Tidak ada perubahan HBA otomatis. Jika prasyarat koneksi internal berbeda, berhenti dan evaluasi sebelum aktivasi. Jangan membuka trust publik atau menyimpan password di job.
