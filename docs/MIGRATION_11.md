# Migration 11 — struktur akademik dan governance kepemimpinan

Keputusan pengguna 2026-09-26. Migration additive: `20260926001100_academic_governance.sql`. Migration 1–10 tidak diubah. Tidak ada UI, analytics, laporan produk, academic-period engine, atau pengiriman email.

## Struktur dan kompatibilitas

- `programs` tetap mewakili program organisasi. `program_types` tetap menjadi katalog learning type dengan seed TAHFIZ, QURAN_READING, CUSTOM.
- `program_learning_types` menghubungkan satu program dengan beberapa learning type. Backfill hanya menyalin relasi primary existing. `programs.program_type_id` tetap required sebagai primary untuk kompatibilitas client lama; trigger menyinkronkan primary ke relasi aktif. Primary aktif tidak boleh dinonaktifkan. Client baru mengirim primary saat membuat program, lalu menambah learning type lain melalui tabel relasi.
- `institution_levels` adalah katalog tingkatan akademik milik lembaga. `program_levels` menghubungkan program dengan tingkatan; tingkatan yang sama bisa digunakan beberapa program. Ini bukan jilid Iqra atau level metode baca.
- `groups.program_level_id` nullable; FK composite memastikan tenant dan program sama. Tidak ada tebakan level untuk kelas lama. Ownership/relationship tabel akademik immutable; nonaktifkan relasi dan buat konteks baru jika diperlukan.
- Jika kelas sudah mempunyai placement, level kelas tidak dapat diganti, termasuk NULL menjadi level. Buat kelas/placement berikutnya. Trigger dan row lock menserialisasi placement pertama dengan edit level yang bersamaan. Histori tetap utuh. Model academic period dapat ditambahkan lewat migration berikutnya.
- ID, membership, enrollment, data Auth, approval, invitation STANDARD dan histori existing dipertahankan. Penambahan role/reference tidak membuat membership baru secara otomatis.

## Permission dan scope

Role adalah membership per lembaga, bukan atribut permanen profile. MUDIR/WAKIL_MUDIR dapat digabung dengan GUARDIAN, TEACHER, STUDENT, atau INSTITUTION_ADMIN tanpa menggabungkan kewenangannya.

| Konteks | Kewenangan Migration 11 |
| --- | --- |
| MUDIR + scope INSTITUTION aktif | Monitoring seluruh program; memulai replacement; mengundang/mencabut scope Wakil |
| WAKIL_MUDIR + scope INSTITUTION aktif | Monitoring seluruh program, tanpa delegasi atau konfigurasi admin |
| WAKIL_MUDIR + satu/beberapa scope PROGRAM aktif | Monitoring gabungan program yang diberikan |
| Scope tidak ada/belum mulai/expired/revoked | Tidak memberikan permission monitoring kepemimpinan |
| INSTITUTION_ADMIN | Operasional existing; mengelola struktur akademik dan menerbitkan konfigurasi pembelajaran |
| GUARDIAN/TEACHER/STUDENT | Jalur personal/assignment existing; tidak memperluas scope kepemimpinan |
| SUPER_ADMIN | Verifikasi onboarding/recovery dengan referensi bukti; bukan penunjukan Mudir secara bebas |

`private.membership_scopes` menyimpan scope dan histori pencabutan. Membership Wakil yang tidak lagi mempunyai scope boleh tetap ACTIVE tetapi tidak mendapat permission leadership. Program scope hanya berlaku untuk program aktif. MUDIR hanya dapat memakai scope INSTITUTION tanpa expiry; jabatan berakhir melalui replacement/recovery.

Permission adalah pemeriksaan eksplisit pada RPC/helper dan RLS, bukan metadata bebas. Migration ini tidak menambahkan grant approval kepemimpinan. Approval temporary/holiday tetap memakai kontrak Migration 9: WALI VERIFIED dan/atau admin lembaga asal sesuai konfigurasi. Role pimpinan saja tidak dapat memutus approval tersebut. Permission approval pimpinan di masa depan memerlukan perubahan contract yang eksplisit.

Monitoring menambahkan SELECT policy pada program, kelas, enrollment program, placement, dan assignment guru. Data siswa untuk monitoring tersedia melalui proyeksi terbatas `monitor_students`; tidak ada perluasan baca identity global, histori tenant lain, atau data wali. Tidak ada policy write operasional baru untuk pimpinan. Metadata tingkatan/learning type juga dapat dibaca melalui konteks program personal/assignment yang sudah sah.

## Governance Mudir

Partial unique index memastikan **maksimal satu membership MUDIR ACTIVE non-deleted per institution**, bahkan jika account sedang nonaktif. Scope yang hilang tidak membuat slot Mudir kedua otomatis tersedia. Histori dipertahankan; jalur penutupan adalah governance.

1. **Pertama:** Admin lembaga membuat case ONBOARDING untuk penerima yang ditetapkan lembaga. Operator SUPER_ADMIN memverifikasi bukti institusional. Setelah verified, requester yang masih berwenang atau verifier dapat menerbitkan invitation. Penerima menerima invitation.
2. **Normal:** Mudir aktif membuat case REPLACEMENT. Case menyimpan membership dan ID scope jabatan saat itu. Penerimaan invitation menonaktifkan Mudir lama, mencabut scope lama, mengaktifkan Mudir baru, mengonsumsi token/case, dan menulis audit dalam satu transaksi.
3. **Recovery oleh Admin:** Admin mengajukan case RECOVERY beralasan. Tidak ada grant sebelum operator platform memverifikasi bukti. Permintaan belum sama dengan authorization untuk mengangkat seseorang.
4. **Recovery oleh perwakilan:** profile terverifikasi dapat mengirim klaim perwakilan dengan alasan dan referensi bukti melalui RPC khusus. Klaim itu tidak memberikan membership atau akses data lembaga. Operator harus membuktikan kewenangan institusional, bukan hanya kepemilikan email. Requester tidak boleh memverifikasi buktinya sendiri, meski mempunyai role platform.

Case berlaku tujuh hari; invitation berlaku 24 jam dan tetap tunduk pada expiry case. Case atau undangan jabatan lama tidak menjadi valid kembali ketika orang yang sama kembali menjabat. Penerima harus mempunyai profile aktif dan akun terverifikasi saat invitation diterbitkan. Jalur administratif tidak menggunakan account bersama.

Guard membership memakai permit private sekali pakai yang terikat transaction ID dan payload. Tidak ada GUC/client flag untuk bypass. Direct INSERT/UPDATE/DELETE leadership dan RPC soft-delete existing tidak dapat melewati governance. Semua command sensitif menggunakan institution row lock; unique index menjadi lapisan enforcement tambahan.

## Invitation dan audit

Snapshot private memuat tenant, recipient, role, scope, inviter, jabatan inviter, serta expiry. FK composite menolak scope program/tenant yang salah. Token acak hanya dikembalikan saat issuance; database menyimpan SHA-256, audit tidak menyimpan token. Recipient tidak mengirim role/scope saat redeem.

Jalur STANDARD Migration 10 dipertahankan sebagai fungsi internal private di balik signature public lama. Fungsi internal tidak bisa dieksekusi client atau service_role. Issuance STANDARD tetap server-only; tidak dapat menerbitkan role kepemimpinan.

Audit menambah `permission_code`, `actor_membership_id`, dan `authorization_scope`. Case, snapshot invitation, scope/revocation dan version konfigurasi tetap tersimpan. Referensi bukti harus berupa opaque document/case reference, bukan credential atau isi dokumen sensitif. Penyimpanan/verifikasi bukti dan rate limiting pengajuan recovery tetap tanggung jawab layanan operasional tepercaya.

## Konfigurasi pembelajaran

`private.learning_config_versions` menyimpan versi published immutable dengan satu current version per scope dan learning type. Publikasi berikutnya me-retire versi sebelumnya; histori tidak ditimpa. `private.learning_setting_definitions` adalah registry key/type yang hanya dapat diubah melalui migration/operator database tepercaya.

Resolver menggabungkan **Institution → Level → Program → Program+Level**. Nilai paling spesifik menang per key; array/object menggantikan keseluruhan nilai key, bukan deep merge. Hasil menyertakan `sources` per key berupa ID versi asal dan `schema_version: 1`.

Registry pada Migration 11 sengaja belum memiliki key pedagogis produksi. Tidak ada aturan target/metode/workflow yang ditebak. Unknown key dan tipe JSON salah ditolak. Test memakai key sintetis hanya di lab. Penetapan key, range nilai, required field, dan validasi domain konkret merupakan pekerjaan lanjutan sebelum engine pembelajaran; tidak ada metadata yang bisa mengubah permission, RLS, atau approval.

## Kontrak RPC tambahan

Semua RPC berikut memakai JWT authenticated; pengecekan kewenangan dilakukan kembali server-side. Client tidak memakai service_role.

| RPC / argumen | Hasil / otorisasi |
| --- | --- |
| `request_mudir_case(tenant_id, recipient_profile_id, purpose, reason)` | UUID case. REPLACEMENT: Mudir aktif; ONBOARDING/RECOVERY: Admin lembaga |
| `request_representative_recovery(tenant_id, recipient_profile_id, reason, evidence_reference)` | UUID pengajuan unverified; akun aktif terverifikasi; tidak memberikan akses tenant |
| `verify_mudir_case(case_id, evidence_reference)` | void. SUPER_ADMIN; hanya ONBOARDING/RECOVERY; bukti tidak boleh diverifikasi requester sendiri |
| `invite_leadership(tenant_id, recipient_profile_id, role_code, program_ids=null, case_id=null, scope_expires_at=null)` | `{invitation_id, token}`. Mudir memerlukan case; Wakil hanya oleh Mudir aktif. NULL program_ids berarti seluruh lembaga; array kosong ditolak. Scope Mudir tidak dapat dibatasi program/expiry |
| `accept_provisioning_invitation(token)` | Leadership: `{invitation_id, membership_id, institution_id, role_code}`; signature/response STANDARD existing tetap berlaku |
| `revoke_provisioning_invitation(invitation_id)` | void. Invitation leadership: Mudir aktif; STANDARD memakai aturan lama |
| `revoke_leadership_scope(scope_id)` | void. Mudir aktif mencabut scope Wakil; tidak untuk mencabut Mudir secara langsung |
| `my_leadership_scopes()` | Array `{scope_id,membership_id,institution_id,role_code,scope_type,program_id,expires_at}` milik caller dan belum revoked/expired |
| `monitor_students(tenant_id, program_id)` | Array `{student_id,display_name,program_enrollment_id,enrollment_status}`; Admin atau leadership dalam scope; di luar scope array kosong |
| `publish_learning_config(tenant_id,learning_type_id,scope_type,settings,level_id=null,program_id=null,program_level_id=null)` | UUID versi; Admin lembaga; scope INSTITUTION/LEVEL/PROGRAM/PROGRAM_LEVEL |
| `effective_learning_config(tenant_id,program_id,learning_type_id,program_level_id=null)` | `{settings,sources,schema_version}`; program yang terotorisasi melalui admin, leadership, assignment, atau personal context |

Response mengikuti PostgREST existing: UUID/JSON untuk hasil scalar, array untuk table-returning RPC, void HTTP 204. Error `{code,message,details,hint}`: 42501 → 403 untuk caller authenticated, 23514/22023 → 400, 23503/23505 → 409; tanpa JWT valid 401. Client harus menggunakan `code`, bukan mem-parsing kalimat error. Assignment berulang/replay bukan API untuk overwrite scope: revoke kemudian issue snapshot baru jika mengubah grant.

## Verifikasi dan pengoperasian

Perintah dari root repository, Docker Desktop aktif:

```sh
pnpm test:governance
pnpm test:upgrade
pnpm test:workflow-sql
pnpm test:workflow-api
pnpm test:governance-concurrency
pnpm test:governance-scheduler
pnpm verify:governance-local
```

Verifier utama membutuhkan `node scripts/verify-governance-local.mjs --baseline` **sebelum** upgrade dari versi 10. Bukti baseline berisi hash, daftar kolom/ID, dan metadata policy/job lokal; disimpan pada reports yang diabaikan Git. Setelah upgrade jangan menimpa baseline. Lab menjalankan PostgreSQL native terpisah, tidak mereset fixture utama. Runner concurrency mempersiapkan fixture expiry sebelum upgrade lalu menjalankan interleaving pada schema 11; runner scheduler mempertahankan uji instalasi v8 lalu menguji periodic/retry/backlog pada schema 11.

Gap terencana: email delivery/invitation untuk account yang belum ada, UI operasional recovery, definisi pedagogis konkret, approval pimpinan eksplisit di masa depan, academic period, staging/production. Tidak ada pekerjaan frontend atau milestone lanjutan yang dimulai.
