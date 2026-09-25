# Backend hardening lokal

Jalankan dari root project dengan Docker tersedia pada PATH dan Supabase lokal ngajitrack berjalan.

- node scripts/test-isolated.mjs: membuat database SQL terpisah, replay migration, menjalankan regresi, menghapus hanya database milik run. Dapat diulang tanpa reset fixture utama.
- Database utama hanya dibaca untuk schema Auth dan fingerprint. Tidak ada akun Auth/data utama yang disalin. Privilege role Supabase tetap berasal dari cluster lokal existing; tidak mengubah role cluster.
- URL koneksi hanya berada dalam memori/environment proses anak, tidak ditulis ke repo. Output pengujian berada dalam reports/ yang diabaikan Git.
- Bila proses dibunuh, database ngt_test_<UUID> dapat tertinggal. Jangan menghapus otomatis berdasarkan prefix: identifikasi run dan periksa koneksi/data sebelum cleanup manual.
- Test SQL memakai request claims database; tidak mengklaim sebagai test HTTP/JWT baru. Tiga test historis tetap embedded dan diberi nama eksplisit.

- node --test --test-concurrency=1 tests/concurrency.test.mjs: enam interleaving nyata; test menggunakan database unik per skenario dan memeriksa wait_event_type=Lock.
