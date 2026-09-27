-- ============================================================================
-- 20260101000400_enforce_rls_text_param.sql
-- Task 0.4 follow-up (PRD Bab 5.5, Bab 10.12, ADR-004)
-- Tujuan: memindahkan perubahan signature app.enforce_rls dari `regclass` ke
-- `text` ke migrasi BARU, karena 20260101000100 sudah ter-push ke origin/main
-- dengan signature `regclass` dan kini BEKU.
--
-- KENAPA `text`, BUKAN `regclass` (JANGAN "dirapikan" kembali): cast `text` ke
-- `regclass` terjadi pada saat ARGUMEN dievaluasi, yaitu SEBELUM body fungsi
-- berjalan. Dengan `regclass`, memanggil helper untuk tabel yang belum ada
-- (persis urutan Task 0.8 yang memanggil sebelum/bersamaan `create table`)
-- melempar `relation ... does not exist` dan menggagalkan transaksi migrasi
-- Task 0.8, sehingga guard skip di body TIDAK pernah tercapai. Dengan `text`,
-- argumen apa pun diterima; keberadaan tabel baru diperiksa di dalam body
-- lewat `to_regclass(p_table)`, yang mengembalikan NULL (bukan error) untuk
-- nama yang tidak dikenal.
--
-- CATATAN KOMPATIBILITAS: file ini MENGGANTIKAN overload `regclass` pada
-- environment yang sudah menjalankan 20260101000100 (via `create or replace`
-- untuk `text` + `drop function if exists app.enforce_rls(regclass)` di bawah).
-- File lama SENGAJA dibiarkan beku/tidak diubah agar tidak menimbulkan drift
-- pada environment yang sudah apply. Database baru: 20260101000100 membuat
-- `regclass`, lalu file ini menggantinya dengan `text`.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- app.enforce_rls(p_table text)
-- ----------------------------------------------------------------------------
-- Helper tunggal yang dipanggil Task 0.8 satu kali per tabel aplikasi supaya
-- tidak ada satu pun `enable row level security` yang terlupa. Aman dipanggil
-- berulang: `enable row level security` sifatnya idempotent.
-- FORCE row level security SENGAJA tidak dipakai: aplikasi terhubung langsung
-- sebagai role owner (Supabase `postgres`, lihat bentuk DATABASE_URL di
-- .env.example) dan migration/seed Drizzle berjalan sebagai role itu.
-- PRD Bab 10.2/ADR-004 hanya meminta RLS aktif sebagai lapisan kedua, bukan FORCE.
--
-- STATUS 2026-09-27 (D-03 / BE-001, diverifikasi ke database live).
-- Paragraf lama di blok ini menyebut FORCE sebagai bagian dari jalur upgrade, dan
-- itu tidak berlaku untuk database ini. Berkas ini sudah ter-apply, jadi koreksi
-- berikut hanya untuk pembaca; tidak ada DDL yang berubah.
--
-- 1. Role `postgres` yang dipakai `DATABASE_URL` MEMEGANG ATRIBUT `BYPASSRLS`
--    (rolsuper=false, rolbypassrls=true), dan ia juga owner 35/35 tabel. Jadi
--    jalur aplikasi melewati RLS dua kali, bukan sekali.
-- 2. `FORCE` hanya mencabut pengecualian OWNER; ia tidak menundukkan role
--    ber-atribut `BYPASSRLS`. Untuk kredensial sekarang FORCE tidak mengubah apa-
--    apa, termasuk pada jalur migrasi/seed yang tidak akan ditolak.
-- 3. Untuk role NON-owner, RLS sudah berlaku begitu `enable` di-set. FORCE tidak
--    perlu agar policy berjalan pada role itu; yang menentukan adalah role-nya:
--    bukan owner, dan tidak memegang BYPASSRLS.
-- 4. Role itu sudah ada: `snapbox_app` (`20260101000800_app_dml_role.sql`),
--    anggota `authenticated` sehingga 35 policy `TO authenticated` yang sudah ada
--    langsung berlaku padanya.
--
-- Sampai primitive itu ada, role itu belum boleh jadi `DATABASE_URL`: `app.tenant_id` belum pernah
-- di-set di kode aplikasi, jadi `app.current_tenant_id()` NULL dan setiap tabel
-- tenant mengembalikan nol baris. Fail-closed disengaja sampai primitive
-- per-request `set local app.tenant_id` ada.
--
-- Bukti (2026-09-27, lewat Supabase pooler sebagai `snapbox_app`): dengan
-- `app.tenant_id` = tenant A dan query TANPA predikat tenant, hanya 1 tenant
-- terlihat dan 0 baris tenant lain; query identik sebagai `postgres` melihat 4
-- tenant. Plan-nya memuat filter policy:
--   Filter: (app.is_ceo() OR ((booths.tenant_id IS NOT NULL)
--           AND (booths.tenant_id = app.current_tenant_id())))
-- Pemanggil tetap memakai literal nama tabel biasa:
--     select app.enforce_rls('public.booths');
-- Fungsi ini TIDAK dipanggil untuk tabel apa pun di file ini.

create or replace function app.enforce_rls(p_table text)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, pg_temp
as $$
declare
  v_oid regclass;
  v_schema text;
  v_relkind "char";
begin
  -- `to_regclass` mengembalikan NULL (bukan error) bila nama tidak dikenal,
  -- jadi tabel yang belum ada benar-benar dilewati di sini. Nilai OID hasil
  -- resolve dipakai untuk query katalog, bukan string mentah.
  v_oid := to_regclass(p_table);

  if v_oid is null then
    raise notice 'app.enforce_rls: tabel % belum ada atau tidak dikenal, dilewati', p_table;
    return;
  end if;

  select n.nspname, c.relkind
    into v_schema, v_relkind
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where c.oid = v_oid;

  if v_relkind not in ('r', 'p') then
    raise notice 'app.enforce_rls: % bukan tabel biasa, dilewati (relkind=%)', p_table, v_relkind;
    return;
  end if;

  if v_schema in ('pg_catalog', 'information_schema') or v_schema like 'pg\_%' then
    raise notice 'app.enforce_rls: % berada di schema sistem, dilewati', p_table;
    return;
  end if;

  -- Hanya enable, bukan force: koneksi owner/direct (Drizzle migration) dan
  -- jalur service_role harus tetap bekerja tanpa policy.
  -- Identifier di-quote lewat `%I` pada schema dan nama tabel (bukan `%s`),
  -- supaya nama berkarakter khusus tidak menjadi SQL dinamis mentah.
  execute format(
    'alter table %I.%I enable row level security',
    v_schema,
    (select c.relname from pg_class c where c.oid = v_oid)
  );
end
$$;

comment on function app.enforce_rls(text) is
  'Mengaktifkan RLS (tanpa FORCE) pada tabel aplikasi. Dipanggil sekali per tabel oleh Task 0.8 agar tidak ada ENABLE RLS yang terlupa. Parameter text (bukan regclass) supaya tabel yang BELUM ADA dilewati dengan aman: regclass akan error saat argumen dievaluasi, sebelum guard di body tercapai. Nama di-resolve lewat to_regclass(); NULL berarti tabel belum ada/tidak dikenal dan fungsi hanya raise notice lalu return. Contoh: select app.enforce_rls(''public.booths''). FORCE sengaja tidak dipakai agar koneksi owner/Drizzle dan service_role tetap bekerja. Catatan: owner melewati RLS tanpa FORCE, jadi helper ini bukan security boundary tunggal; upgrade path = dedicated non-owner DML role untuk aplikasi + force row level security.';

-- Hapus overload `regclass` lama (dibuat 20260101000100) pada environment yang
-- sudah apply versi lama. Dijalankan SETELAH `text` dibuat supaya database yang
-- hanya pernah punya `text` tetap aman (no-op). Idempotent lewat `if exists`.
drop function if exists app.enforce_rls(regclass);

-- ----------------------------------------------------------------------------
-- Hak akses fungsi helper app.enforce_rls(text)
-- ----------------------------------------------------------------------------
-- Sama seperti 20260101000100: revoke dari PUBLIC selalu dijalankan karena
-- PUBLIC adalah pseudo-role (bukan baris pg_roles), sedangkan guard `if exists`
-- dipakai untuk role Supabase lain agar file ini juga jalan di Postgres polos.
-- app.enforce_rls(text) tetap dibatasi service_role saja: ia helper migration,
-- bukan ekspresi policy, jadi tidak boleh dipanggil anon/authenticated.
revoke execute on function app.enforce_rls(text) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function app.enforce_rls(text) from anon;
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke execute on function app.enforce_rls(text) from authenticated;
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function app.enforce_rls(text) to service_role;
  end if;
end
$$;
