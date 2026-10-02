# Milestone 13 — Admin Lembaga Foundation

## Scope 13.1 — Organization Structure Management

Hanya struktur lembaga: Program organisasi → Tingkatan → Kelas/Halaqah. Tidak ada manajemen santri, teaching, invitation UI, Wali/Santri flow, analytics, laporan, offline sync, Flutter, atau Milestone 13.2.

Halaman `/app/i/[institutionId]/as/[membershipId]/structure` memakai App Shell dan design tokens Milestone 12. Navigasi **Struktur lembaga** muncul hanya untuk konteks INSTITUTION_ADMIN yang tervalidasi. Tiga bagian sederhana: Program, Tingkatan, Kelas/Halaqah. Daftar kartu responsif, pencarian nama, badge status, dialog tambah/edit, konfirmasi nonaktif/aktif, toast, loading, empty, error, permission denied dan retry memakai komponen existing. ID teknis tidak ditampilkan sebagai label pengguna.

## Model dan batas kontrak existing

| Model | Operasi 13.1 | Batas yang dipertahankan |
| --- | --- | --- |
| `programs` | Daftar, tambah, edit nama/deskripsi, aktif/nonaktif | Program organisasi berbeda dari learning type. `program_type_id` primary wajib saat create; trigger existing menyinkronkan `program_learning_types`. Learning type tambahan existing tidak dihapus/ditulis ulang. Tidak ada metadata bebas/permission settings |
| `institution_levels` | Daftar, tambah/edit nama/kode/urutan, aktif/nonaktif | Kode wajib dan unik per institution, termasuk record nonaktif. Form menerima kode huruf Latin/angka/underscore/hyphen, maksimal 32 karakter, urutan 0–9999 |
| `program_levels` | Hubungkan tingkatan ke program, nonaktif/aktif | Unique tenant/program/level; tidak upsert diam-diam. Pelepasan berarti nonaktif, bukan DELETE. FK/histori tetap utuh. Relasi lama dapat diaktifkan kembali |
| `groups` | Daftar, tambah nama/program/tingkatan, edit nama/tingkatan yang diizinkan, aktif/nonaktif | Program kelas immutable. Setelah memiliki placement, tingkatan immutable termasuk NULL → level. Buat kelas baru untuk konteks berikutnya. NULL ditampilkan sebagai “Tingkatan belum ditentukan”; tidak ada tebakan/backfill |

Nama program dan kelas **tidak unique** pada schema existing; create dengan nama sama menghasilkan record terpisah, bukan overwrite. Konflik kode tingkatan/relasi mengembalikan pesan untuk memakai record existing. Tidak menambahkan unique constraint baru yang belum diputuskan.

Nonaktif tidak menghapus data, menutup enrollment, mengubah role, atau mengganti konteks histori. Menonaktifkan relasi/tingkatan mencegah pemilihan baru melalui form; guard database kelas memerlukan relasi/tingkatan aktif saat konteks tersebut dipasang. Hubungan kelas existing tetap tersimpan. Rename/penonaktifan kelas tidak mengirim ulang `program_level_id` yang tidak berubah, sehingga administrasi histori tidak terhalang oleh parent yang telah nonaktif.

## Data access dan permission

Alur: UI → `organization-api` → route `structure/data` → `organizationContext` → `organization-repository` → Supabase client dengan JWT pengguna → RLS/FK/trigger/audit existing. Komponen UI tidak melakukan query Supabase. Tidak ada service role, secret server baru, privileged proxy, atau perubahan backend.

GET dan POST memeriksa akun/profil aktif, membership milik caller, institution, role admin dan konteks server terbaru. GET memeriksa konteks kembali setelah membaca data. Mode Wali/Mudir/Wakil/Teacher/Student tidak membuka endpoint ini, termasuk bila akun juga memiliki role admin terpisah. Frontend tidak mengubah union permission database; pengguna yang memiliki role admin harus masuk mode admin untuk operasi ini. RLS tetap menolak write dari akun tanpa admin melalui direct PostgREST sekalipun.

SELECT/PATCH selalu membatasi institution dan ID yang relevan. INSERT mengisi institution dari konteks server, bukan body. Read paged 250 record dengan urutan stabil menghindari pemotongan diam-diam oleh batas default PostgREST. Payload hanya kolom struktur; tidak mengambil roster, histori santri, data wali, atau union business data. Read gagal sebagian tidak digabung dengan dataset lama.

POST memakai JSON dengan allowlist field per operasi, UUID validation, batas nama/deskripsi dan pemeriksaan Origin terhadap Host + scheme. Host publik harus dipertahankan oleh deployment proxy; tidak ada wildcard origin atau kepercayaan otomatis pada arbitrary X-Forwarded-Host. Ini pemeriksaan route khusus, bukan asumsi bahwa Next Server Actions melindungi route handler. Rujukan prinsip origin/host: [Next.js security](https://nextjs.org/blog/security-nextjs-server-components-actions).

Response GET berupa object `{programs,levels,relations,groups,learningTypes}`; POST sukses `{ok:true}`. Error aplikasi `{error:{code,message}}`: invalid/rule 400, denied 403, conflict/duplicate/relationship 409, unavailable 503. Sesi hilang menggunakan redirect login existing. Raw SQL details, constraints dan error backend tidak dikirim ke UI.

Update program/kelas memakai compare-and-set `updated_at`; kelas juga mengikat konteks tingkatan awal. Level/relasi tidak memiliki revision column sehingga compare-and-set memakai seluruh field editable awal. Nol row hasil UPDATE adalah conflict/unavailable, bukan sukses. Ini melindungi form aplikasi dari overwrite stale; tidak menambah revision enforcement global bagi client backend lain. Perubahan A→B→A pada level/relasi tidak dapat dibedakan dari snapshot awal, tetapi snapshot nilai editable kembali identik.

Setelah mutation, muat ulang data server. Bila response mutation hilang, jangan retry create otomatis: buang form lama, muat ulang daftar lalu rekonsiliasi hasil. Reload, focus kembali, gagal validasi dan context switch membuang dataset/form lama; generation + AbortController menolak respons terlambat. Pergantian konteks memakai document navigation existing. Tidak ada optimistic tenant mutation, cache lintas konteks, antrean offline, atau klaim sinkronisasi offline.

Expected validation/conflict/permission errors tidak dikirim sebagai crash Sentry. Unexpected service failure hanya dilaporkan dengan error generik melalui filter existing; body/nama program/tingkatan/kelas tidak disertakan. Konfigurasi DSN opsional/replay off tetap dipertahankan.

## Validasi dan checkpoint

**13.1 selesai, 2026-10-02.** Production build tanpa DSN dan dengan Sentry aktif PASS; lint/typecheck PASS; unit 58/58; browser lengkap 91/91 (20 organisasi + 71 regression existing); SQL/RLS 53/53; Auth/JWT/API 24/24; Sentry receiver 7/7. Perbaikan terakhir hanya layout kolom pencarian mobile, diverifikasi dengan build/typecheck dan satu test responsif tambahan 1/1. Tidak ada dependency baru, secret terkonfirmasi atau perubahan Migration 1–11. Fixture utama identik setelah semua runner.

Hasil final, iterasi perbaikan, audit security dan publikasi dicatat pada `TEST_REPORT.md` dan `IMPLEMENTATION_STATUS.md`. Test baru mencakup CRUD UI/API, kelima role non-admin, mode non-admin pada akun multi-role, tenant mismatch, duplicate contract, histori NULL, optimistic concurrency dua admin, switching/revocation, state UI, mobile, keyboard dan Sentry expected-error exclusion. Suite Auth/context/switcher/shell existing tetap dijalankan.

Tidak ada migration baru; Migration 1–11 tetap utuh. Tidak diperlukan backend contract/RLS baru untuk scope di atas. Penggantian program kelas lama, hard-delete, uniqueness nama baru, atau perubahan hak operasional memerlukan keputusan dan perubahan backend terpisah; tidak diselundupkan sebagai validasi UI.

Batas verifikasi: Chromium lokal; deployment proxy/public origin, browser lain, Sentry hosted/source-map production belum diverifikasi. Context revoke saat halaman idle diperiksa pada batas revalidation/focus/request; bukan push realtime. Tidak ada blocker untuk scope 13.1. Setelah publikasi Git terverifikasi, berhenti; jangan mulai 13.2 tanpa instruksi baru.
