# Kontrak backend Web Admin dan Flutter

## Addendum Migration 11 (2026-09-26)

Struktur akademik, learning type jamak, governance satu Mudir aktif, scope Wakil dan inheritance konfigurasi telah ditambahkan. Kontrak RPC/permission serta batas operasional terbaru ada di [MIGRATION_11.md](MIGRATION_11.md). Approval/provisioning STANDARD existing di bawah tetap berlaku; leadership tidak otomatis mendapat approval WALI atau Admin. Migration 1–10 tidak diubah.


Versi kontrak: migration 1–10. Dokumen ini tidak mengimplementasikan UI atau mengklaim deployment production.

## Transport dan identitas

Client memakai Supabase Auth dan PostgREST dengan publishable/anon key serta `Authorization: Bearer <access_token>` milik pengguna. `service_role`, password database, signing secret, dan token invitation tidak boleh masuk bundle, analytics, URL query, atau log. Token invitation dikirim dalam body RPC melalui TLS; simpan hanya selama proses aktivasi.

`profiles.id` berbeda dari `auth.users.id`. Otorisasi selalu menurunkan profile dari `auth.uid()`; field metadata Auth, pilihan role pada UI, UUID yang dikirim client, atau hasil pencarian nama bukan bukti kewenangan. Membership role digabung sesuai tenant; tidak ada satu role permanen pada account.

## Operasi existing

| Operasi | Jalur dan hasil | Scope |
|---|---|---|
| Login, refresh, logout | Supabase Auth; session/token standar Auth | Pemilik akun |
| Profil pribadi | SELECT/PATCH `profiles`; array record PostgREST | Pemilik profil; kolom update yang telah di-grant saja |
| Daftar lembaga | RPC `my_institutions()`; array proyeksi lembaga | Membership aktif pengguna |
| Membuat lembaga | RPC `create_institution(code,institution_name,kind,admin_profile)`; UUID | SUPER_ADMIN; admin awal terverifikasi |
| Status lembaga | RPC `set_institution_status(tenant_id,new_status)`; void | SUPER_ADMIN |
| Struktur program/kelas, enrollment, assignment | Tabel public dengan RLS dan validation trigger | INSTITUTION_ADMIN pada tenant tujuan |
| Pindah kelas | RPC `move_student_group(enrollment_id,target_group_id)`; UUID placement | Admin tenant, enrollment operasional, program yang sama |
| Menutup enrollment | RPC `end_institution_enrollment(enrollment_id,closure_reason)`; void | Admin tenant; atomik, retry ENDED idempotent |
| Soft delete | RPC `soft_delete_record(entity_table,record_id)`; void | Scope admin yang diizinkan; histori terminal tidak dapat dihapus |
| Histori/audit | SELECT sesuai RLS | Tenant sendiri atau izin pribadi/wali yang masih sah |
| Expiry | `expire_institution_enrollments(batch_size)`; integer | Scheduler khusus/server tepercaya; dilarang untuk client |

Field user tidak memiliki direktori profil/identity global. TEACHER hanya memperoleh scope assignment operasionalnya. GUARDIAN memerlukan membership aktif dan hubungan VERIFIED beserta izin akses data. STUDENT memperoleh konteks identitasnya. SUPER_ADMIN bukan akses bebas histori santri. ADMIN diberikan eksplisit, bukan akibat role lain.

## Approval temporary/holiday

`institution_enrollments` dibuat oleh admin lembaga tujuan B dengan status PENDING. `started_at` inklusif, `scheduled_end_at` eksklusif menurut timezone B; `ended_at` adalah tanggal penutupan aktual. Enrollment A tidak otomatis berubah.

| RPC | Parameter | Hasil |
|---|---|---|
| `set_enrollment_approval_policy` | `tenant_id`, `requirements`, `program_id=null` | void; hanya admin tenant B |
| `request_enrollment_approval` | `enrollment_id`, `program_id=null` | UUID request; retry scope yang masih terbuka mengembalikan UUID sama |
| `my_enrollment_approval_requests` | tidak ada | Array informasi minimum: request/enrollment ID, nama santri/lembaga/program, tanggal, mask persyaratan |
| `decide_enrollment_approval` | `request_id`, `party`, `approved` | void; retry keputusan identik oleh actor sama idempotent |
| `cancel_enrollment_approval` | `request_id` | void; admin B, sebelum scope aktif; lalu boleh membuat request baru |

Nilai kebijakan: `WALI`, `LEMBAGA_A`, `WALI+LEMBAGA_A`, `NONE`. Default tanpa konfigurasi adalah WALI. Mask internal/proyeksi: 0 NONE, 1 WALI, 2 LEMBAGA_A, 3 keduanya. Program tanpa override mewarisi lembaga; override hanya menambah persyaratan. NONE harus dipilih eksplisit oleh admin B dan diaudit. Pengetatan lembaga berlaku pada aktivasi yang masih pending; request lama yang tidak mencakup persyaratan baru harus dibatalkan dan dibuat ulang. Pelonggaran konfigurasi tidak menghapus syarat yang sudah disnapshot pada request lama.

Approval lembaga berlaku untuk aktivasi enrollment lembaga. Approval program berlaku untuk penambahan enrollment pada program itu; satu persetujuan program tidak membuka program lain. Admin A harus masih berwenang pada satu `previous_institution_id` yang berbeda dari B; hubungan asal dibuktikan oleh enrollment operasional identity yang sama di A. Binding identity dibuat jalur server terverifikasi, bukan klaim B. Wali harus mempunyai hubungan VERIFIED pada identity yang sama, profil/membership aktif; otoritas diperiksa kembali sebelum aktivasi.

Setelah persyaratan terpenuhi, admin B melakukan PATCH `status=ACTIVE`; guard database juga memeriksa direct SQL/API. NONE tetap membutuhkan request eksplisit, tidak merupakan bypass. Request program dapat dibuat setelah root aktif dan sebelum membuat program enrollment. Penolakan menghalangi aktivasi; admin dapat membatalkan request dan mengajukan ulang tanpa mengubah histori keputusan.

Perubahan tanggal, asal, tipe, alasan, atau `source_type` ketika PENDING membatalkan request terkait, termasuk bila nilainya dikembalikan seperti semula. Tujuan, santri, dan hubungan program existing immutable. Untuk konteks enrollment aktif yang berubah: tutup record lama, buat record baru, minta approval baru. Ini berlaku pula untuk legacy exception. Setelah aktif, pencabutan menggunakan penutupan terotorisasi; tidak mengubah keputusan terdahulu.

Temporary/holiday ACTIVE sebelum migration 9 mendapat `LEGACY_APPROVAL_EXCEPTION`, bukan approval buatan. Program yang sudah ACTIVE saat upgrade turut dicatat; record program baru tidak tercakup, termasuk pada program yang sama. Data enrollment existing dan ENDED tidak ditulis ulang. Waktu akses tetap berhenti saat jadwal berakhir meskipun scheduler terlambat. Penutupan tidak mencabut WALI/TEACHER atau enrollment lembaga lain.

## Invitation, linking, provisioning

Alur implementasi tersedia sebagai RPC database; pengiriman email/SMS, UI verifikasi, dan penyimpanan dokumen bukti bukan bagian milestone ini. Operator/server harus memverifikasi bukti melalui kanal tepercaya sebelum memanggil RPC server-only. Jangan meneruskan body client langsung menggunakan service_role.

1. Pengguna memiliki akun Auth baru atau existing yang telah diverifikasi. Trigger Auth membuat satu profile. Akun existing dipakai ulang.
2. Bila perlu, server memanggil `link_verified_student_identity(identity_id,profile_id,verification_reference)` setelah verifikasi kepemilikan identity. Fungsi tidak dapat mengganti pemilik existing atau melakukan merge. Unique constraint mencegah beberapa identity milik profile yang sama. Reference bukti harus berupa ID internal, bukan isi dokumen/secret.
3. Server memanggil `issue_verified_invitation(tenant_id,recipient_profile_id,role_code,authorized_by,verification_reference,student_id=null,student_identity_id=null,guardian_id=null,valid_hours=24)`. RPC memeriksa admin pemberi kewenangan, profil terverifikasi, tenant dan konsistensi binding. Role hanya STUDENT/TEACHER/GUARDIAN/INSTITUTION_ADMIN; tidak pernah SUPER_ADMIN. Assignment ADMIN adalah permintaan eksplisit tersendiri.
4. Hasil server-only adalah `{invitation_id,token,expires_at}`. Token acak sekali pakai, hanya hash SHA-256 tersimpan; expiry 1–168 jam. Server mengirimkannya hanya ke penerima terverifikasi melalui kanal aman. Jangan catat hasil issuance ke log.
5. Client login lalu memanggil `accept_provisioning_invitation(token)`. Recipient tidak dapat memilih ulang tenant, role, atau identity. Membership, profil lokal/binding, consume token, dan audit berada dalam satu transaksi. Hasil `{invitation_id,membership_id,institution_id,role_code}`. Dua redemption bersamaan hanya satu sukses.
6. STUDENT memakai identity existing yang sudah terikat ke penerima, kemudian menghubungkannya ke santri lokal. TEACHER/GUARDIAN membuat profil lokal bila belum ada; guardian nullable existing dapat ditautkan melalui ID yang ditentukan saat issuance. Ini tidak otomatis memverifikasi guardian-student relationship.
7. Admin dapat memanggil `revoke_provisioning_invitation(invitation_id)` sebelum token dipakai. Resend dilakukan dengan revoke token lama dan issuance baru. Role yang sudah nonaktif tidak direaktivasi otomatis saat redemption; perlu review admin eksplisit. Perubahan kewenangan pemberi invitation diperiksa kembali saat redemption.

## Response, error, retry

Ini memakai response native Supabase/PostgREST, bukan envelope HTTP buatan baru. SELECT mengembalikan array; RPC UUID mengembalikan JSON string; RPC JSONB mengembalikan object; RPC void HTTP 204 tanpa body. Mutasi tabel dapat memakai `Prefer: return=representation` untuk array hasil (INSERT 201, PATCH 200). Response kosong akibat RLS bukan bukti record global tidak ada.

Error PostgREST berbentuk `{code,message,details,hint}`. Client bercabang pada code/status, jangan parsing kalimat message atau menampilkan detail internal tanpa penyaringan.

| Code / status | Makna dan perilaku client |
|---|---|
| `42501`, HTTP 401/403 | Tidak terautentikasi/tidak berwenang atau objek tidak tersedia; jangan mencoba service_role |
| `23514`, HTTP 400 | Pelanggaran aturan workflow/approval/periode; perbaiki state/input, bukan retry buta |
| `22023`, HTTP 400 | Parameter tidak valid |
| `23505`, HTTP 409 | Konflik uniqueness; refresh state dan gunakan record existing |
| `23503`, HTTP 409 | Referensi tidak valid/masih dipakai |
| JWT/Auth 401 | Refresh session atau login kembali melalui SDK Auth |
| `40001` / `40P01` | Retry transaksi secara terbatas dengan backoff pada server; jangan mengulangi pengiriman invitation tanpa pengendalian |

Token sudah dikonsumsi selalu gagal pada redemption berikutnya. Jika response pertama hilang, refresh `my_institutions`/membership untuk rekonsiliasi; jangan menganggap token masih dapat dipakai. Issuance bukan endpoint idempotent: caller menyimpan invitation_id dan secara eksplisit mencabut token lama untuk resend. Seluruh write harus membatasi field yang dikirim sesuai operasi, tidak PATCH object hasil SELECT secara utuh.

## Batas rilis

Kontrak ini tidak memberi consent sharing histori, payment, portable summary, Web Admin, atau Flutter UI. Production memerlukan pengelolaan secret server, kanal pengiriman undangan/verifikasi, rate limiting dan deployment review tersendiri. Lab Auth memakai autoconfirm hanya untuk fixture sintetis terisolasi; itu bukan konfigurasi production.
