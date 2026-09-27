# ADR-017: Tiga Tabel Telemetry Pulang ke Snapshot Drizzle

## Status

Diterima. Menjawab `AUDIT/11_DECISIONS_REQUIRED.md` D-10.
Tanggal: 2026-09-27.

## Konteks

`security_events`, `auth_sessions`, dan `system_health_checks`
dideklarasikan di `packages/db/src/schema.ts` tapi tidak ada di **satu pun**
snapshot Drizzle (`meta/` hanya memuat 0000, 0002, 0004).

Sementara itu `supabase/migrations/20260101000500:10-13` menyatakan
invariant:

> _"tidak boleh ada migration Drizzle yang membuat tabel ini lagi"_

karena dua sumber DDL dengan `IF NOT EXISTS` membuat yang kedua menjadi
no-op senyap dengan kemungkinan drift kolom.

## Ini landmine bertanggal

`pnpm --filter @snapbox/db generate` berikutnya akan mendiff terhadap
snapshot terbaru (`0004`), yang mendahului ketiga tabel itu, dan akan
menghasilkan `CREATE TABLE` untuk ketiganya. Migration hasilnya lalu
no-op terhadap `00500`, dan `recordWafEvent` / `recordHealthHeartbeat` /
`recordAuthSession` mulai melempar karena kolom tidak cocok — menjatuhkan
**ingest WAF tepat saat dibutuhkan**.

## Keputusan

**Opsi A — pulihkan paritas snapshot.**

`security_events`, `auth_sessions`, dan `system_health_checks` dibuat
hadir di snapshot Drizzle, sehingga generator melihatnya dan **tidak**
menghasilkan DDL untuk ketiganya.

Alasan memilih A, bukan B (hapus dari `schema.ts`): ketiganya **dipakai
dengan Drizzle** di `health-security-server.ts`, yang men-select
`authSessions` dan menulis `revokedAt`. Menghapusnya dari `schema.ts`
akan memutus kode yang bekerja. Paritas snapshot menyelesaikan masalah
tanpa merusak konsumen.

## Konsekuensi

- `drizzle-kit generate` menjadi aman dijalankan. B-15 terblokir hilang.
- Satu-satunya sumber DDL untuk ketiga tabel itu menjadi ambigu lagi:
  `schema.ts` mendefinisikannya, `00500` yang menerapkannya. Ini trade-off
  yang diterima secara sadar, bukan yang terlewati. Konsekuensinya: perubahan
  DDL di masa depan harus dilakukan di kedua tempat, atau di `00500` dengan
  migration baru.
- Menjalankan `generate` **sebelum** keputusan ini diterapkan adalah
  perubahan yang tidak bisa dibatalkan. Lakukan paritas dulu.

## Verifikasi

Setelah paritas: `pnpm --filter @snapbox/db generate` harus menghasilkan
migration yang **kosong** untuk ketiga tabel itu.
