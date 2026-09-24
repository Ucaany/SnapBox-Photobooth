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
-- STATUS JUJUR: ini murni PROVISIONING. Saat file ini ditulis BELUM ADA job
-- terjadwal yang dibuat (`cron.schedule(...)` nol pemanggil di repo). Job
-- sebenarnya baru menyusul di fase berikutnya (retensi/cleanup/rollup).
create extension if not exists pg_cron with schema pg_catalog;

-- Supabase sudah menyediakan schema `extensions`; guard ini hanya agar file ini
-- juga jalan di Postgres polos.
create schema if not exists extensions;

-- pg_net: eksekusi HTTP non-blocking dari Postgres, dipakai oleh job pg_cron
-- saat perlu memanggil endpoint internal (mis. trigger laporan). Ditempatkan di
-- schema extensions sesuai konvensi Supabase.
-- STATUS JUJUR: sama seperti pg_cron, ini PROVISIONING. Belum ada pemanggil
-- `net.http_post(...)` di repo; dipakai nanti oleh job pg_cron di fase lanjut.
create extension if not exists pg_net with schema extensions;

-- pgcrypto: diaktifkan sebagai PERSIAPAN (provisioning) untuk hash kredensial
-- di Task 0.8 (pairing code hash, PIN hash operator) lewat digest()/crypt().
-- STATUS JUJUR: saat file ini ditulis BELUM ADA pemanggil di repo (nol pemanggil
-- crypt(), gen_salt(), digest(), atau hmac()). CATATAN PENTING: kolom UUID
-- TIDAK membutuhkan pgcrypto, karena `gen_random_uuid()` sudah core sejak
-- PostgreSQL 13 (lihat `major_version = 15` di config.toml). Jadi satu-satunya
-- alasan extension ini ada adalah hash kredensial Task 0.8 di atas.
create extension if not exists pgcrypto with schema extensions;

-- AUDIT: bila setelah Task 0.8 selesai ternyata tetap nol pemanggil untuk
-- salah satu extension di file ini (pgcrypto/pg_cron/pg_net), extension itu
-- boleh ditinjau untuk dihapus; jangan dipertahankan hanya karena "sudah ada".
