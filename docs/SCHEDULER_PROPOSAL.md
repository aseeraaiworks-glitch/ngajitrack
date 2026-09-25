# Usulan scheduler expiry — menunggu keputusan

Tanggal 2026-09-25. Belum ada perubahan extension, schema, grant, job atau migration yang diterapkan.

## Fakta inspeksi lokal

pg_cron tersedia dan tercantum dalam shared_preload_libraries, tetapi belum ada di pg_extension. Foundation saat ini menyediakan expire_institution_enrollments(integer), executable hanya untuk service_role (selain owner database). Job scheduler belum ada.

## Perubahan minimum yang diusulkan

- Migration 8 operasional baru, mempertahankan migration 1–7. Aktifkan pg_cron dan schema operasional cron; tidak mengubah tabel atau RLS produk.
- Satu job bernama ngajitrack-expire-enrollments setiap satu menit; satu pemanggilan batch 100 per run. Backlog diproses run berikutnya; akses operasional tetap ditolak saat scheduled_end_at tercapai.
- Job dikelola owner database postgres sebagai operator tepercaya. Command memakai transaction dengan SET LOCAL ROLE service_role sebelum memanggil RPC worker existing. Tidak memberikan role/grant tambahan kepada client. Worker existing tetap SECURITY DEFINER sebagaimana migration 7.
- Schema/API pengelolaan cron tertutup bagi PUBLIC, anon dan authenticated; tidak mengekspos scheduler lewat PostgREST atau menyimpan token/password pada SQL job.
- Registrasi job idempotent, tanpa membuat duplikat; kegagalan dicatat dalam cron.job_run_details. Run berikutnya menjadi retry; tidak melakukan loop retry tanpa batas.
- Uji periodik pertama diarahkan ke database disposable (bukan fixture utama), termasuk expiry dua tipe, retry/no-op, penolakan client mengelola job, dan penonaktifan/cleanup job test. Aktivasi job aplikasi dilakukan setelah bukti test dan fingerprint fixture utama aman.

## Keputusan yang diperlukan

Setujui penambahan pg_cron/schema cron, model operator postgres dengan command service_role, dan interval satu menit/batch 100 sebagai konfigurasi awal lokal. Ini menambah komponen eksekusi SQL otomatis dan batas izin operasional baru. Instruksi pengguna meminta berhenti bila ada perubahan schema/security yang membutuhkan keputusan; karena itu migration belum dibuat.

Rujukan: https://supabase.com/docs/guides/cron dan https://supabase.com/docs/guides/cron/install
