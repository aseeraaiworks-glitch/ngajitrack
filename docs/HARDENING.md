# Backend hardening lokal

## Addendum Migration 11 (2026-09-26)

Struktur akademik, learning type jamak, governance satu Mudir aktif, scope Wakil dan inheritance konfigurasi telah ditambahkan. Kontrak RPC/permission serta batas operasional terbaru ada di [MIGRATION_11.md](MIGRATION_11.md). Approval/provisioning STANDARD existing di bawah tetap berlaku; leadership tidak otomatis mendapat approval WALI atau Admin. Migration 1–10 tidak diubah.


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

## Finalisasi migration 9–10

- `pnpm test:upgrade`: cluster PostgreSQL terpisah, fixture existing pada migration 6, upgrade 7–10, 20 assertion native. Menguji exception legacy, histori ENDED, guard approval, kebijakan, pemisahan tenant dan worker expiry setelah guard baru.
- `pnpm test:workflow-sql`: schema 1–10 pada cluster kosong terpisah, 53 regresi foundation. 51 native; dua test replay/reuse fixture secara eksplisit embedded dan tetap memakai migration 1–7. Suite enrollment historis tidak dijalankan sebagai bukti kontrak baru karena konversi ACTIVE tanpa approval kini memang dilarang.
- `pnpm test:workflow-api`: GoTrue dan PostgREST asli dengan image versi yang sama seperti stack utama, database/role/secret/port lab tersendiri. 18 skenario login JWT, RLS, approval, invitation, identity reuse, tiga role, duplicate redemption bersamaan, rollback atomik, refresh/logout. Hanya schema Auth dan metadata versi migrasi yang disalin; bukan akun/data utama. Semua akun dan credential sintetis dibuat per run.
- Auth lab menggunakan connection `search_path=auth` agar membaca history schema Auth yang benar. Konfigurasi mengikuti [sumber Supabase Auth v2.196.0](https://github.com/supabase/auth/blob/v2.196.0/internal/storage/dial.go). Autoconfirm hanya untuk test sintetis. Tidak ada SMTP/email/SMS yang dikirim.
- `node scripts/verify-workflow-local.mjs --baseline` hanya untuk pre-apply utama yang masih pada versi 1–8, dan mensyaratkan nol temporary/holiday ACTIVE. Jika ada data aktif tersebut, verifier berhenti agar delta audit legacy ditinjau; migration sendiri tetap mendukungnya dan diuji di lab. Baseline berisi fingerprint/metadata, bukan isi data atau credential.
- `pnpm verify:workflow-local`: delapan pemeriksaan read-only pasca-apply terhadap baseline lokal; tidak cocok untuk instalasi baru tanpa baseline. Memeriksa versi lengkap, fingerprint, RLS, cron, privileges dan health Auth/anonymous API. Tidak membuat user/session utama.
- Raw reports disimpan di `reports/workflow-*.txt` dan baseline JSON yang diabaikan Git. Catat ringkasan dalam TEST_REPORT.md. Cleanup hanya container/network/database milik run; fixture utama harus identik.
- Migration 1–8 tetap utuh. Migration 9–10 adalah ordered migrations, bukan script replay idempotent. Supabase migration history mengendalikan apply satu kali; jangan menjalankan SQL yang sama ulang pada instance applied.
- Selesai pada lokal saja; tidak ada deployment remote, UI, kanal pengiriman invitation, atau bypass verifikasi identitas otomatis.
