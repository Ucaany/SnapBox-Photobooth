-- Rekonsiliasi DDL yang tercatat "sudah jalan" padahal tidak, plus paritas
-- snapshot. Dua masalah berbeda yang kebetulan bertemu di tempat yang sama.
--
-- ===================== MASALAH 1: JURNAL SENGAJA MENYALAKAN =====================
--
-- Migrator Drizzle hanya menjalankan entri journal yang `when`-nya LEBIH BESAR
-- dari `created_at` terakhir di `drizzle.__drizzle_migrations`. Entri 0005/0006/
-- 0007 sebelumnya memakai nilai `when` sintetis (1790483809134/135/136, berbeda
-- 1 ms satu sama lain) yang justru LEBIH KECIL dari `created_at` yang sudah
-- tercatat di database (1790516100000). Akibatnya `drizzle-kit migrate`
-- menganggap semua entri sudah berlaku dan tidak menjalankan apa pun, diam-diam.
-- Tidak ada error, tidak ada warning.
--
-- Yang tercatat di database nyata (diverifikasi 2026-09-27 lewat SELECT
-- read-only, bukan lewat menjalankan migrasi):
--   - `promos_code_lower_idx` MASIH ADA, padahal 0004 sudah `DROP INDEX IF
--     EXISTS` dan membuat `promos_tenant_code_lower_idx` +
--     `promos_global_code_lower_idx`. Dua index itu tidak ada di database mana
--     pun, jadi keunikan kode promo yang case-insensitive -- jaminan utama
--     Task 1.10 -- TIDAK AKTIF. `PROMO2026` dan `promo2026` masih bisa hidup
--     berdampingan.
--   - `kiosk_themes` masih membawa default palet lama (#FFDD00/#8B5CF6/#FFFEF5),
--     bukan palet biru 0006 (#5294FF/#1D4ED8/#DCEBFE). Setiap tema kiosk baru
--     yang dibuat owner dirender kuning/violet.
--   - index redemption tidak ada -> sequential scan per redemption.
--
-- Semua perintah di bawah memakai `if [ not ] exists`, jadi berkas ini aman
-- dijalankan setelah 0004/0006/0007 benar-benar jalan: setiap statement jadi
-- no-op.
--
-- ===================== KOREKSI `when` PADA 2026-09-27 =====================
--
-- Versi pertama berkas ini menaikkan `when` 0005-0008 ke 1790516200000-003 --
-- nilai yang DITUJUHKAN di atas `created_at` 1790516100000 supaya 0008 benar-
-- benar dijalankan. Yang tidak dihitung: nilai itu 7,6 jam DI MASA DEPAN.
--
-- Kenapa itu berbahaya, bukan sekadar "aneh". drizzle-kit menstempel
-- `when = Date.now()` pada migrasi yang di-generate berikutnya, dan migrator
-- hanya menjalankan entri yang `when` lebih besar dari `created_at` terakhir di
-- database. Konsekuensinya:
--
--   Empat baris di `drizzle.__drizzle_migrations` SUDAH tercatat -- dibaca
--   read-only pada 2026-09-27 -- dengan `created_at` 1790516100000 dan
--   1790516200000-003. Selama baris-beris itu masih ada, SETIAP migrasi yang
--   di-generate dengan `Date.now()` akan terlihat lebih tua dan DILEWATI tanpa
--   error, sampai jam dinding melewati 13:36:40Z.
--
-- Jam TIDAK meleset: `now()` database dan jam mesin ini cocok dalam 103 ms
-- (1790488941212 vs 1790488941315). Jadi ini bukan clock skew yang perlu
-- ditoleransi; ini tanggal masa depan yang salah.
--
-- Yang dilakukan di sini: `when` 0005-0008 dikembalikan ke waktu nyata
-- (1790488800000-003 = 2026-09-27T06:00:00Z), monoton, dan tidak masa depan.
-- 0008 SUDAH dijalankan di database itu, jadi menurunkan `when` tidak
-- membatalkannya: entri dengan `when` <= `created_at` terakhir tetap dilewati,
-- dan itu justru yang benar untuk migrasi yang sudah dipakai.
--
-- Yang BELUM selesai dan butuh otorisasi owner: empat baris masa depan di
-- `drizzle.__drizzle_migrations` itu masih ada. Repo tidak bisa menyentuhnya --
-- menulis ulang riwayat migrasi production adalah keputusan operasional, bukan
-- sesuatu yang boleh dikerjakan agen. Selama belum diperbaiki, migrasi baru yang
-- di-generate sebelum 2026-09-27T13:36:40Z akan dilewati diam-diam. Setelah jam
-- itu, `Date.now()` melampaui 1790516200003 dan generate berikutnya normal.
-- Perbaikannya: `update drizzle.__drizzle_migrations set created_at = <waktu
-- nyata> where created_at > <sekarang>`, hanya setelah migration berjalan, dan
-- hanya dengan keputusan eksplisit.
--
-- ========================= MASALAH 2: PARITAS SNAPSHOT =========================
--
-- `security_events`, `auth_sessions`, dan `system_health_checks` dideklarasikan
-- di `packages/db/src/schema.ts` tapi TIDAK PERNAH ada di snapshot mana pun
-- (`meta/` hanya punya 0000/0002/0004). DDL tunggalnya adalah
-- `supabase/migrations/20260101000500_system_health_security.sql`, yang dengan
-- tegas melarang migration Drizzle membuat ulang ketiganya.
--
-- Akibatnya `drizzle-kit generate` berikutnya mendeteksi ketiganya sebagai tabel
-- baru dan emit `CREATE TABLE` polos -- TANPA `if not exists`, jadi bukan no-op
-- senyap, tapi GAGAL keras dengan "relation already exists" -- bersama
-- `DROP INDEX "promos_code_lower_idx"` dan index/palet lain. WAF ingest dan
-- health probe ikut rusak karena generate tidak pernah sampai selesai.
--
-- Pasangan berkas ini adalah `meta/0008_snapshot.json`: snapshot itu mewakili
-- keadaan `schema.ts` yang SEKARANG (35 tabel, termasuk ketiga tabel telemetry).
-- Karena snapshot terbaru kini sama persis dengan `schema.ts`, `drizzle-kit
-- generate` menghasilkan diff KOSONG dan tidak akan pernah mengulang DDL milik
-- 00500.
--
-- Yang TIDAK dilakukan di sini, dan itu disengaja: ketiga tabel telemetry tidak
-- pernah di-`create`. Berkas ini hanya MEMASTIKAN mereka ada, dan gagal keras
-- kalau tidak -- supaya 00500 yang hilang ketahuan sekarang, bukan sebagai error
-- `CREATE TABLE` yang muncul berminggu-minggu kemudian saat generate dijalankan.

-- 1. Jaga batas kepemilikan DDL: 00500 yang creating tiga tabel ini.
do $$
declare
  v_missing text;
begin
  select string_agg(t, ', ')
    into v_missing
    from unnest(array['security_events', 'auth_sessions', 'system_health_checks']) as t
   where to_regclass('public.' || t) is null;

  if v_missing is not null then
    raise exception
      'Tabel telemetry tidak ada: %. supabase/migrations/20260101000500_system_health_security.sql belum jalan -- jalankan ITU, jangan dibuat ulang di sini.', v_missing;
  end if;
end
$$;

-- 2. 0004 (kode promo case-insensitive) tercatat jalan tapi tidak berefek.
drop index if exists public.promos_code_lower_idx;

create unique index if not exists promos_tenant_code_lower_idx
  on public.promos (tenant_id, lower(code)) where tenant_id is not null;
create unique index if not exists promos_global_code_lower_idx
  on public.promos (lower(code)) where tenant_id is null;

-- 3. 0006 (default palet kiosk biru, D-01).
alter table public.kiosk_themes alter column primary_color    set default '#5294FF';
alter table public.kiosk_themes alter column accent_color     set default '#1D4ED8';
alter table public.kiosk_themes alter column background_color set default '#DCEBFE';

-- 4. Index yang dideklarasikan schema.ts tapi tidak pernah ada. 00500 membuat
--    `security_events_type_created_idx` dan `..._provider_event_idx`, tapi TIDAK
--    `security_events_severity_idx`, dan tidak ada migration lain yang membuatnya.
create index if not exists security_events_severity_idx
  on public.security_events (severity);

-- 5. Index redemption. 0007 sudah membawa perintah yang sama setelah koreksi
--    2026-09-27 -- bentuknya diubah dari (tenant_id, promo_id, customer_email)
--    menjadi (promo_id, customer_email) supaya cocok dengan query di
--    `promos/actions.ts:166`, yang tidak memfilter tenant_id. Disalin di sini
--    agar 0008 tidak bergantung pada urutan eksekusi 0007; `if not exists`
--    membuat tumpang tindihnya no-op.
create index if not exists redemption_promo_customer_idx
  on public.promo_redemptions (promo_id, customer_email);
