-- ============================================================================
-- 20260101000000_enable_extensions.sql
-- Task 0.4 (Supabase Setup) - PRD Bab 10.1, Bab 10.7, Bab 11.2
-- Tujuan: mengaktifkan extension yang dibutuhkan SnapBox di Supabase.
-- File ini TIDAK membuat/mengubah/menghapus tabel aplikasi apa pun.
-- ============================================================================

-- pg_cron: penjadwal job in-database untuk pekerjaan terjadwal yang tidak
-- membutuhkan worker eksternal (PRD Bab 10.7 - retensi soft-copy, cleanup
-- pairing code kedaluwarsa, rollup laporan harian). Di Supabase extension ini
-- WAJIB dipasang di schema pg_catalog; memasangnya di schema lain membuat
-- pg_cron tidak menemukan tabel metadatanya sendiri.
create extension if not exists pg_cron with schema pg_catalog;

-- Supabase sudah menyediakan schema `extensions`; guard ini hanya agar file ini
-- juga jalan di Postgres polos.
create schema if not exists extensions;

-- pg_net: eksekusi HTTP non-blocking dari Postgres, dipakai oleh job pg_cron
-- saat perlu memanggil endpoint internal (mis. trigger laporan). Ditempatkan di
-- schema extensions sesuai konvensi Supabase.
create extension if not exists pg_net with schema extensions;

-- pgcrypto: dipakai untuk digest/bcrypt (pairing code hash, PIN hash operator)
-- dan random byte untuk token. Trik yang sama juga dipakai migration Drizzle
-- (Task 0.8) untuk default kolom, jadi extension harus ada lebih dulu.
create extension if not exists pgcrypto with schema extensions;
