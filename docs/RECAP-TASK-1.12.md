# Recap Task 1.12: Database Migrations - Auth & Tenant

Catatan status Task 1.12 terhadap PRD baris 1994. Melengkapi
`.kilo/plans/1790336355024-task-1-12-auth-tenant-migrations.md` (tidak
menggantikannya). Tanda centang berarti deliverable sudah ada di repo.

## Status Task 1.12

PRD baris 1994: _"Migrations untuk `users`, `tenants`, `plans`,
`b2b_subscriptions`, `activity_logs`, `notifications`, `broadcasts`, `promos`.
RLS policy untuk tenant tables. Seed plan 3 tier + 3 tenant sample."_

Interpretasi yang dipakai: **gap-closure**. Sebagian besar deliverable sudah ada
di repo sebelum task ini; yang benar-benar kurang hanya tiga hal (baris tabel
berlatar abu di bawah).

| Deliverable PRD                                 | Berkas konkret                                                                 | Status               |
| :---------------------------------------------- | :----------------------------------------------------------------------------- | :------------------- |
| DDL 8 tabel + enums + index                     | `packages/db/src/schema.ts`, `packages/db/migrations/0000_smiling_hawkeye.sql` | Sudah ada (pra-1.12) |
| RLS 8 tabel + policy tenant/users/notifications | `packages/db/migrations/0001_rls_and_realtime.sql`                             | Sudah ada (pra-1.12) |
| `activity_logs` immutable                       | `packages/db/migrations/0003_activity_logs_immutable.sql`                      | Sudah ada (pra-1.12) |
| `promos` kode case-insensitive                  | `packages/db/migrations/0004_promo_code_case_insensitive.sql`                  | Sudah ada (pra-1.12) |
| Seed plan 3 tier                                | `packages/db/src/seed.ts`                                                      | Sudah ada (pra-1.12) |
| **Seed 3 tenant sample**                        | `packages/db/src/seed.ts`                                                      | **Baru di 1.12**     |
| **RLS policy `broadcasts` tenant-scoped**       | `supabase/migrations/20260101000600_broadcast_tenant_scope.sql`                | **Baru di 1.12**     |
| **Test invariant migration + seed**             | `packages/db/seed-invariants.test.mjs`                                         | **Baru di 1.12**     |

Checkbox Task 1.12 di PRD belum dicentang karena PRD milik user (aturan sama
dengan `docs/RECAP-TASK-0.3.md`).

## 1. Migration baru: scope baca broadcast

`supabase/migrations/20260101000600_broadcast_tenant_scope.sql`

`0001_rls_and_realtime.sql` menaruh `broadcasts` di daftar platform-only dengan
policy CEO-only (`using (app.is_ceo())`). Itu benar untuk tulis, tetapi membuat
tenant sasaran tidak bisa membaca pengumuman yang memang dialamatkan kepadanya
(PRD Task 1.9: broadcast ke "semua/tenant terpilih").

File baru menambah **satu policy SELECT** `snapbox_broadcasts_tenant_read`:

```sql
using (
  target_all
  or (
    target_tenant_ids is not null
    and app.current_tenant_id() is not null
    and jsonb_exists(target_tenant_ids, app.current_tenant_id()::text)
  )
)
```

| Aspek                          | Nilai                                                                                |
| :----------------------------- | :----------------------------------------------------------------------------------- |
| Jenis policy                   | `for select to authenticated` (tidak menyentuh INSERT/UPDATE/DELETE)                 |
| `jsonb_exists` vs operator `?` | Pakai `jsonb_exists(...)` eksplisit agar tidak ambigu terhadap placeholder parameter |
| Fail-closed                    | `app.current_tenant_id()` NULL (anon/tanpa klaim) membuat predikat false             |
| Baris platform tanpa target    | `target_all = false` dan `target_tenant_ids is null` tetap tak terjangkau tenant     |
| Policy CEO lama                | `snapbox_broadcasts_ceo` TIDAK di-drop; ia pemberi akses penuh CEO                   |
| `app.enforce_rls`              | Tidak diulang (sudah dijalankan `0001`)                                              |

## 2. Seed 3 tenant sample

`packages/db/src/seed.ts`

| Aspek               | Nilai                                                                                                                                               |
| :------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tenant              | `Pixelbooth Indonesia` (GROWTH), `Snap Moment Studio` (ENTERPRISE), `Klik Klik Photobooth` (STARTER)                                                |
| Sumber data         | PRD Bab 9 baris 950-956, bukan data karangan baru                                                                                                   |
| Cakupan per tenant  | `tenants` + 1 owner `users` + 1 `b2b_subscriptions` ACTIVE + 1 `booths` UNPAIRED                                                                    |
| Idempotensi         | Cari dulu by `tenants.owner_email`, `users.email`, pasangan `(tenantId, planId)`, dan `(tenantId, name) + isNull(deviceFingerprint)` sebelum insert |
| `firebase_uid` seed | `seed:<slug>` - placeholder, bukan UID Firebase, tidak bisa login                                                                                   |
| Langganan           | `status = ACTIVE`, `validUntil = now + 365 hari`, `pakasir_invoice_id = NULL`, ditandai `notes = 'Seed Task 1.12 (data contoh)'`                    |
| Kuota tenant        | Diturunkan dari `plan.features`, sama seperti wizard provisioning                                                                                   |

## 3. Test invariant

`packages/db/seed-invariants.test.mjs` - 6 test berbasis teks berkas, tanpa DB
(konsisten dengan gaya `tests/smoke.test.mjs`):

1. `0000_smiling_hawkeye.sql` membuat kedelapan tabel Task 1.12.
2. `0001_rls_and_realtime.sql` memanggil `app.enforce_rls` untuk kedelapan tabel.
3. Seed memuat 3 tier plan dan 3 tenant contoh dari PRD Bab 9.
4. `firebase_uid` seed berbentuk `seed:<slug>`.
5. Seed tidak pernah **menulis** kolom secret/kredensial (cek bentukan
   assignment, bukan sekadar penyebutan nama).
6. Migration broadcast policy-only (setelah komentar dibuang), `SELECT`
   tenant-scoped, memakai `jsonb_exists` + `app.current_tenant_id()`, dan tidak
   men-drop policy CEO lama.

## Yang sengaja TIDAK dilakukan

| Tidak dilakukan                                                  | Alasan                                                                                                                                                            |
| :--------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create table` ulang untuk 8 tabel Task 1.12                     | DDL hidup di `packages/db/migrations/0000`; duplikasi `IF NOT EXISTS` jadi no-op senyap dan berisiko divergen (`20260101000500_system_health_security.sql:10-13`) |
| Migrasi Drizzle baru (`drizzle-kit generate`)                    | Schema tidak berubah, jadi diff kosong; menambah entri `_journal.json` tanpa guna                                                                                 |
| Seed `activity_logs`                                             | Tabel immutable dengan aktor user nyata (PRD Bab 8.8); audit palsu merusak arti audit trail                                                                       |
| UID Firebase nyata di seed                                       | Hanya placeholder `seed:<slug>`; tidak ada akun Firebase yang dibuat                                                                                              |
| Setel hash PIN / pairing code / fingerprint / kredensial gateway | Booth seed harus tidak bisa dipasangkan atau dipakai login                                                                                                        |

## Verifikasi

| Perintah                                           | Hasil                                                                                 |
| :------------------------------------------------- | :------------------------------------------------------------------------------------ |
| `pnpm --filter @snapbox/db typecheck`              | Lulus                                                                                 |
| `pnpm --filter @snapbox/db lint`                   | Lulus                                                                                 |
| `node --test packages/db/seed-invariants.test.mjs` | 6/6 lulus                                                                             |
| `node --test` (root)                               | 110/110 lulus                                                                         |
| Eksekusi seed tanpa `DATABASE_URL`                 | Gagal aman dengan pesan guard `DATABASE_URL belum diset...` (jalur `main()` tercapai) |

**Belum diverifikasi (butuh Docker, belum tersedia di lingkungan ini):**

- `pnpm --filter @snapbox/db seed` dua kali berturut-turut terhadap DB nyata
  (idempotensi baris).
- `supabase db reset` lokal: seluruh migrasi + seed berjalan berurutan.
- Verifikasi manual RLS tenant isolation di `psql` (tenant A membaca broadcast
  tenant B = 0 baris; tanpa klaim = 0 baris; owner/Drizzle melihat semua).

Daftar perintah verifikasi manual ada di `.kilo/plans/1790336355024-*.md`
bagian Validation.
