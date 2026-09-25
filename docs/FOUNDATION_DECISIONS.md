# Keputusan backend foundation

Sumber produk: kelima dokumen v1.2 di direktori ini. Instruksi eksplisit pengguna membatasi fase ini; requirement MVP lain tidak otomatis masuk implementasi.

1. Pengguna menyetujui `guardian_profiles.profile_id` nullable sebelum aktivasi. Link guardian-student memakai `PENDING`, `VERIFIED`, `REVOKED`; hanya VERIFIED memberi akses.
2. `supabase/migrations/` merupakan satu-satunya sumber schema yang dapat dieksekusi. Folder `database/migrations` dalam arsitektur bersifat rekomendasi dan tidak diduplikasi.
3. Status institution mencakup DRAFT dan PENDING_VERIFICATION dari onboarding, selain TRIAL/ACTIVE/SUSPENDED/ARCHIVED. Akses operasional mensyaratkan ACTIVE/TRIAL.
4. Role platform terpisah. SUPER_ADMIN tidak boleh masuk `institution_members`. Platform role hanya dapat diberikan server tepercaya; tidak ada self-promotion lewat metadata auth.
5. Pembuatan membership dan pengaitan identitas/login harus melalui server tepercaya setelah verifikasi. Fase ini belum membangun invitation/matching UI atau workflow verifikasi lengkap. Direct client write ke identity/account binding ditolak. UUID bukan bukti verifikasi.
6. Tenant-scoped foreign key memakai pasangan institution_id + id, serta student/program yang sesuai untuk hierarki enrollment. Perpindahan menutup row lama lalu membuat row baru, bukan mengganti owner row lama.
7. Referensi method_config/reading_method_config/mushaf ditambahkan pada fase konfigurasi terkait, bukan UUID tanpa FK atau tabel placeholder pada fase ini. Program type sudah disediakan.
8. Audit otomatis mencatat perubahan administratif secara atomik. Client tidak dapat menulis/mengubah audit. Snapshot data global tidak dibuka ke admin tenant melalui audit global.
9. Super Admin mengelola lembaga dan membership; tidak mendapatkan SELECT bebas ke data santri lintas tenant. Review sensitif beralasan dan diaudit merupakan workflow tersendiri yang belum dibuka.
10. Semua tabel penting mendukung soft delete. Hard delete history dilarang untuk client, FK tidak memakai destructive cascade. Timestamp menggunakan timestamptz.
11. Profil global hanya dapat dibaca pemiliknya; nama lokal santri ada pada student_profiles. Direktori profil global tidak dibuka ke tenant.
12. `group_memberships.program_id` ditambahkan agar FK composite dapat memastikan kelas dan enrollment berada di program yang sama. `groups.status` mengikuti DRAFT/ACTIVE/INACTIVE/ARCHIVED pada onboarding.
13. Soft delete client memakai RPC `soft_delete_record`, karena SELECT RLS tetap menyembunyikan row terhapus. Restore hanya untuk server tepercaya dengan audit; closed enrollment tetap read-only.
14. Membership dan pengaitan global yang belum mempunyai workflow verifikasi lengkap hanya diprovision server/operator tepercaya. Ini pembatasan akses fase foundation, bukan implementasi invitation atau pencocokan identitas otomatis.

## Keputusan disetujui — migrasi 7 (2026-09-24)

15. Satu identity/profile dapat aktif di beberapa lembaga sekaligus. SANTRI, WALI, dan USTAZ tidak eksklusif, termasuk pada lembaga yang sama. Role berasal dari membership dan relationship/assignment; ADMIN tetap memerlukan pemberian role terotorisasi tersendiri. Izin beberapa role yang sah digabung.
16. Bergabung ke B bukan instruksi transfer dari A. Enrollment A tidak otomatis ditutup. Satu profil lokal per identity per tenant dan satu enrollment ACTIVE per santri lokal tetap berlaku; beberapa program menggunakan enrollment lembaga yang sama.
17. `institution_enrollments.enrollment_type` adalah REGULAR/TEMPORARY/HOLIDAY. Data existing menjadi REGULAR tanpa mengubah status/tanggal/history. `reason` menyimpan alasan mengikuti enrollment, sedangkan `completion_reason` mencatat alasan penutupan.
18. Hanya tiga kolom tanggal canonical: `started_at` awal berlaku inklusif, `scheduled_end_at` batas berlaku eksklusif, `ended_at` tanggal pemrosesan penutupan aktual. Semuanya date menurut zona waktu lembaga. Tidak ada `start_at`/`end_at` baru. TEMPORARY/HOLIDAY wajib memiliki tanggal mulai dan jadwal akhir yang finite dan terurut. Audit mempertahankan timestamp pemrosesan yang presisi.
19. Status ACTIVE saja tidak cukup untuk operasi: tanggal mulai harus tercapai dan scheduled_end_at belum tercapai. Jalur histori pribadi/wali tetap mengikuti izin lama, terpisah dari roster ustaz. Kedaluwarsa tidak bergantung pada keberhasilan scheduler.
20. ENDED adalah status terminal read-only pada ketiga tingkat enrollment. Penutupan atomik hanya menutup turunan PENDING/ACTIVE milik enrollment tersebut, termasuk yang sudah soft-deleted. Tidak menyentuh profil global, membership role, hubungan wali, teacher assignment, atau enrollment lembaga lain. Pembatalan sebelum mulai boleh memiliki tanggal penutupan lebih awal daripada tanggal mulai yang direncanakan.
21. Jadwal dapat diubah secara terotorisasi dan diaudit sebelum kedaluwarsa. Setelah kedaluwarsa, tanggal/peruntukan enrollment tidak dapat digeser untuk menghidupkan akses kembali. Periode liburan berikutnya membuat row enrollment baru dengan identity dan profil lokal existing.
22. Zona waktu harus valid. Perubahan zona waktu ditolak selama lembaga mempunyai enrollment terjadwal PENDING/ACTIVE yang belum soft-deleted, agar perubahan zona tidak menghidupkan kembali periode yang kedaluwarsa. Penyesuaian zona dilakukan setelah periode terkait ditutup.
23. `expire_institution_enrollments` adalah worker batch terotorisasi service_role, bukan RPC pengguna biasa. Pemasangan jadwal pemanggilan pada runtime Supabase belum dilakukan pada checkpoint ini; akses tetap dibatasi waktu walaupun worker belum dipanggil. Native scheduler dan concurrency multikoneksi masuk gate integrasi berikutnya.
24. Tidak membuka sharing histori atau direktori identity lintas tenant. Consent/portable summary dan pricing/billing tetap di luar scope. Semua enam migration sebelumnya dipertahankan; perubahan hanya melalui forward migration 7.

Rujukan teknis: [Supabase migrations](https://supabase.com/docs/guides/local-development/database-migrations), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [PGlite](https://pglite.dev/docs/).

## Keputusan disetujui — migration 9–10 (2026-09-25)

25. Default persetujuan temporary/holiday WALI VERIFIED; NONE hanya konfigurasi eksplisit admin tujuan. Program mewarisi dan hanya memperketat kebijakan lembaga; tidak ada override untuk melonggarkan.
26. B membuat enrollment/periode. A hanya satu asal terverifikasi dengan identity yang sama; persetujuan diberikan admin A yang masih berwenang. Approval wali membutuhkan hubungan VERIFIED dan membership aktif. Tidak membuka histori lintas lembaga.
27. PENDING baru/existing mengikuti guard approval. Perubahan konteks PENDING membatalkan request lama. ACTIVE yang berubah konteks ditutup lalu dibuat record baru untuk approval ulang, mempertahankan ownership/history immutable. Approval aktif dicabut melalui penutupan terotorisasi.
28. Temporary/holiday ACTIVE sebelum upgrade mendapat exception legacy yang diaudit, bukan approval buatan. Tidak memutus akses sah sampai closure/expiry. Exception program hanya untuk record existing; record program baru harus mengikuti approval. ENDED tetap utuh.
29. Provisioning dan binding melalui trusted server yang memverifikasi bukti, kemudian invitation recipient-bound dengan token sekali pakai/expiry/hash. Redeem atomik, diaudit, tidak membuat identity baru untuk role/tenant tambahan. Role ADMIN eksplisit; service_role tidak berada di client. Pengiriman email/SMS dan UI verifikasi belum diimplementasikan.
30. Poin 23 merupakan histori sebelum scheduler: worker sekarang juga dapat dijalankan role scheduler khusus migration 8, interval 15 menit/batch 500. Private workflow migration 9–10 tidak memberi akses tambahan kepada scheduler.
