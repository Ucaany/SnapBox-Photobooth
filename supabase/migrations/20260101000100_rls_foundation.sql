-- ============================================================================
-- 20260101000100_rls_foundation.sql
-- Task 0.4 (Supabase Setup) - PRD Bab 5.5, Bab 10.12, ADR-004
-- Tujuan: menyediakan helper RLS (schema `app`) yang menjadi fondasi migration
-- Drizzle di Task 0.8. File ini TIDAK menyentuh kolom tabel aplikasi apa pun.
-- ============================================================================

-- Schema `app` hanya menampung fungsi helper RLS. Tidak ada tabel, tidak ada
-- data, sehingga aman untuk di-revoke dari publik.
create schema if not exists app;
comment on schema app is 'Fungsi helper RLS SnapBox. Tidak menyimpan data apa pun.';

-- ----------------------------------------------------------------------------
-- app.current_tenant_id()
-- ----------------------------------------------------------------------------
-- Mengembalikan tenant aktif dari klaim JWT Supabase (`request.jwt.claims`),
-- dengan urutan sumber: (1) klaim top-level `tenant_id`, (2) klaim bertingkat
-- `app_metadata.tenant_id` (Firebase custom claim yang bisa disurface Supabase
-- untuk `[auth.third_party.firebase]`), (3) fallback GUC `app.tenant_id`.
-- DRAFT: jalur klaim di sini WAJIB diverifikasi terhadap bentuk token Firebase
-- third-party yang sebenarnya saat Realtime dipasang (Fase 3/6).
-- Ini HANYA jaring pengaman: service layer WAJIB selalu mengirim
-- `session.tenant_id` dan tidak boleh memercayai input klien (PRD Bab 5.5).
-- Fallback GUC dipakai ketika koneksi role RLS-enforced (bukan service_role)
-- hendak menegakkan RLS, dengan men-set nilai per request:
--     set local app.tenant_id = '<uuid-tenant>';
-- `set local` otomatis kembali ke nilai semula di akhir transaksi, jadi nilai
-- tidak bocor antar request pada koneksi pool.
create or replace function app.current_tenant_id()
returns uuid
language sql
security invoker
stable
parallel safe
set search_path = pg_catalog, pg_temp
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::json ->> 'tenant_id',
    nullif(current_setting('request.jwt.claims', true), '')::json -> 'app_metadata' ->> 'tenant_id',
    nullif(current_setting('app.tenant_id', true), '')
  )::uuid
$$;

comment on function app.current_tenant_id() is
  'Tenant aktif dari klaim JWT: top-level tenant_id, lalu app_metadata.tenant_id, terakhir GUC app.tenant_id. DRAFT: urutan jalur klaim harus diverifikasi terhadap token Firebase third-party saat Realtime dipasang (Fase 3/6). Service layer tetap sumber otorisasi utama (PRD Bab 5.5).';

-- ----------------------------------------------------------------------------
-- app.is_ceo()
-- ----------------------------------------------------------------------------
-- True bila role pada klaim JWT adalah CEO. Role platform ini boleh melihat
-- lintas tenant (kebutuhan operasional SnapBox), jadi dipakai sebagai klausa
-- bypass di seluruh policy Task 0.8. Urutan sumber sama dengan tenant id:
-- (1) klaim top-level `role`, (2) klaim bertingkat `app_metadata.role`, lalu
-- (3) fallback GUC `app.role`. DRAFT: jalur klaim bertingkat ini harus
-- diverifikasi terhadap bentuk token Firebase third-party saat Realtime
-- dipasang (Fase 3/6).
create or replace function app.is_ceo()
returns boolean
language sql
security invoker
stable
set search_path = pg_catalog, pg_temp
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role',
    nullif(current_setting('request.jwt.claims', true), '')::json -> 'app_metadata' ->> 'role',
    nullif(current_setting('app.role', true), '')
  ) = 'CEO'
$$;

comment on function app.is_ceo() is
  'True bila pemanggil ber-role CEO: klaim JWT role, lalu app_metadata.role, terakhir GUC app.role. DRAFT: jalur klaim bertingkat harus diverifikasi terhadap token Firebase third-party saat Realtime dipasang (Fase 3/6).';

-- ----------------------------------------------------------------------------
-- app.enforce_rls(p_table regclass)
-- ----------------------------------------------------------------------------
-- Helper tunggal yang dipanggil Task 0.8 satu kali per tabel aplikasi supaya
-- tidak ada satu pun `enable row level security` yang terlupa. Aman dipanggil
-- berulang: `enable row level security` sifatnya idempotent.
-- FORCE row level security SENGAJA tidak dipakai: aplikasi terhubung langsung
-- sebagai role owner (Supabase `postgres`, lihat bentuk DATABASE_URL di
-- .env.example) dan migration/seed Drizzle berjalan sebagai role itu. Dengan
-- FORCE, tabel owner ikut tunduk RLS dan jalur langsung tersebut akan ditolak
-- sebelum ada policy. PRD Bab 10.2/ADR-004 hanya meminta RLS aktif sebagai
-- lapisan kedua, bukan FORCE.
-- ponytail: ceiling = jalur direct/owner dan service_role-bypass harus tetap
-- jalan; jalur upgrade = baru tambahkan mode `force` pada ALTER TABLE setelah
-- SEMUA akses memakai role non-owner dengan policy eksplisit.
-- Fungsi ini TIDAK dipanggil untuk tabel apa pun di file ini.
create or replace function app.enforce_rls(p_table regclass)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, pg_temp
as $$
declare
  v_schema text;
begin
  select n.nspname
    into v_schema
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where c.oid = p_table
     and c.relkind in ('r', 'p');

  if v_schema is null then
    raise notice 'app.enforce_rls: % bukan tabel yang dikenal, dilewati', p_table;
    return;
  end if;

  if v_schema in ('pg_catalog', 'information_schema') or v_schema like 'pg\_%' then
    raise notice 'app.enforce_rls: % berada di schema sistem, dilewati', p_table;
    return;
  end if;

  -- Hanya enable, bukan force: koneksi owner/direct (Drizzle migration) dan
  -- jalur service_role harus tetap bekerja tanpa policy.
  execute format('alter table %s enable row level security', p_table);
end
$$;

comment on function app.enforce_rls(regclass) is
  'Mengaktifkan RLS (tanpa FORCE) pada tabel aplikasi. Dipanggil sekali per tabel oleh Task 0.8 agar tidak ada ENABLE RLS yang terlupa. FORCE sengaja tidak dipakai agar koneksi owner/Drizzle dan service_role tetap bekerja.';

-- ----------------------------------------------------------------------------
-- KONVENSI BENTUK POLICY UNTUK TASK 0.8 (tidak diimplementasikan di sini)
-- ----------------------------------------------------------------------------
-- Semua policy memakai role `authenticated`. Cross-tenant access tetap
-- dipetakan ke 404 oleh service layer (ADR-004); RLS ini lapisan kedua.
--
-- a. Tabel tenant dengan `tenant_id NOT NULL` (mis. booths, outlets, packages,
--    frames, devices, subscriptions, transactions, ...):
--      using (app.is_ceo() or tenant_id = app.current_tenant_id())
--
-- b. Tabel tenant dengan `tenant_id` NULLABLE (users, promos, activity_logs,
--    notifications, device_logs). Baris dengan tenant_id null adalah baris
--    platform (mis. user internal SnapBox), jadi harus ikut diizinkan:
--      using (app.is_ceo() or tenant_id is null or tenant_id = app.current_tenant_id())
--
-- c. Tabel tanpa `tenant_id` yang menggantung pada parent (frame_versions,
--    booth_frames, kiosk_theme_versions, paper_logs) memerlukan klausa exists:
--      using (exists (
--        select 1 from <parent> p
--        where p.id = <child>.<fk_parent>
--          and (app.is_ceo() or p.tenant_id = app.current_tenant_id())
--      ))
--
-- d. device_calibrations tidak punya jalur tenant sama sekali (dikunci oleh
--    device_fingerprint). Tabel ini HANYA boleh diakses lewat otorisasi service
--    layer; jangan berikan policy berbasis tenant untuknya.

-- ----------------------------------------------------------------------------
-- Hak eksekusi fungsi helper
-- ----------------------------------------------------------------------------
-- `authenticated` WAJIB diberi execute pada app.current_tenant_id()/app.is_ceo():
-- policy RLS di storage (20260101000200) dan realtime (20260101000300) dideklarasikan
-- `to authenticated` dan memanggil kedua fungsi itu DI DALAM ekspresi USING.
-- Postgres memeriksa hak EXECUTE atas nama role yang mengevaluasi policy, jadi
-- tanpa grant ini query lewat role tersebut gagal dengan `permission denied for
-- function app.current_tenant_id()`. Revoke dari PUBLIC tetap dilakukan agar
-- akses default tidak terbuka lebar.
-- PUBLIC adalah pseudo-role privilege, BUKAN baris di pg_roles, sehingga revoke
-- dari public di bawah sengaja TIDAK dibungkus guard `if exists`/pg_roles dan
-- selalu dijalankan (guard `pg_roles` untuk public akan diam-diam terlewat dan
-- meninggalkan default PUBLIC EXECUTE).
-- app.enforce_rls(regclass) tetap dibatasi service_role saja: ia helper
-- migration, bukan ekspresi policy, jadi tidak boleh dipanggil anon/authenticated.
-- Guard `if exists` untuk role Supabase lain dipakai agar file ini juga jalan di
-- Postgres polos.
revoke execute on function app.current_tenant_id() from public;
revoke execute on function app.is_ceo() from public;
revoke execute on function app.enforce_rls(regclass) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function app.current_tenant_id() from anon;
    revoke execute on function app.is_ceo() from anon;
    revoke execute on function app.enforce_rls(regclass) from anon;
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function app.current_tenant_id() to authenticated;
    grant execute on function app.is_ceo() to authenticated;
    revoke execute on function app.enforce_rls(regclass) from authenticated;
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function app.current_tenant_id() to service_role;
    grant execute on function app.is_ceo() to service_role;
    grant execute on function app.enforce_rls(regclass) to service_role;
  end if;
end
$$;
