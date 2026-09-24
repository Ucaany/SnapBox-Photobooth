-- ============================================================================
-- 20260101000100_rls_foundation.sql
-- Task 0.4 (Supabase Setup) - PRD Bab 5.5, Bab 10.12, ADR-004
-- Tujuan: menyediakan helper RLS (schema `app`) yang menjadi fondasi migration
-- Drizzle di Task 0.8. File ini TIDAK menyentuh kolom tabel aplikasi apa pun.
--
-- PENTING - STATUS PENGEDITAN IN-PLACE (baca sebelum menyunting ulang).
-- File ini BELUM pernah di-apply ke environment bersama mana pun. Bukti: tidak
-- ada remote yang ter-link (`supabase projects list` gagal dengan "Access token
-- not provided"; tidak ada project ref di config.toml), dan `supabase/.temp/`
-- HANYA berisi `cli-latest` (tidak ada `.branches`, tidak ada metadata project).
-- Karena itu pengeditan in-place di berkas ini aman SEKARANG: belum ada riwayat
-- migrasi yang tercatat di environment mana pun, jadi tidak ada environment yang
-- memakai versi lama fungsi di bawah.
--
-- ATURAN SETELAH ENVIRONMENT PERTAMA PUSH: begitu satu environment saja pernah
-- menjalankan `supabase db push`/`migration up` dengan file ini, file ini menjadi
-- BEKU. Migrasi yang sudah tercatat TIDAK akan dijalankan ulang, sehingga
-- mengedit berkas ini TIDAK akan memperbaiki environment tersebut (perubahan
-- hanya terlihat di database baru). Setiap perubahan perilaku helper `app.*`
-- SESUDAH itu WAJIB lewat migrasi BARU bernomor lebih tinggi
-- (mis. `20260101000400_*.sql`) yang memakai `create or replace function`.
-- ============================================================================

-- Schema `app` hanya menampung fungsi helper RLS. Tidak ada tabel, tidak ada
-- data, sehingga aman untuk di-revoke dari publik.
create schema if not exists app;
comment on schema app is 'Fungsi helper RLS SnapBox. Tidak menyimpan data apa pun.';

-- ----------------------------------------------------------------------------
-- app.current_tenant_id()
-- ----------------------------------------------------------------------------
-- Mengembalikan tenant aktif dari klaim JWT Supabase (`request.jwt.claims`),
-- COALESCE berlapis agar token bentuk lama maupun baru sama-sama bekerja:
--   (1) klaim top-level `tenant_id` (custom claim Firebase tampil di top-level,
--       bukan di klaim metadata bawaan Supabase),
--   (2) klaim bertingkat `app_metadata.tenant_id` (bentuk bawaan Supabase),
--   (3) GUC `app.tenant_id` (di-set per request, lihat catatan di bawah).
-- Fallback dipertahankan SENGAJA: environment yang sudah memakai token bentuk
-- lama tidak boleh kehilangan scope tenant hanya karena kontrak klaim berubah;
-- token dengan sumber baru tetap menang lewat urutan di atas.
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
    -- Lapis 1: klaim top-level `tenant_id` (custom claim Firebase tampil di
    -- top-level token; metadata bawaan Supabase tidak dijangkau token third-party).
    nullif(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'tenant_id', ''),
    -- Lapis 2: klaim `app_metadata.tenant_id` (bentuk bawaan Supabase).
    nullif(nullif(current_setting('request.jwt.claims', true), '')::json -> 'app_metadata' ->> 'tenant_id', ''),
    -- Lapis 3: GUC `app.tenant_id`, di-set per request (`set local`, lihat catatan di atas).
    nullif(current_setting('app.tenant_id', true), '')
  )::uuid
$$;
comment on function app.current_tenant_id() is
  'Tenant aktif dari klaim JWT, berlapis: top-level tenant_id, lalu app_metadata.tenant_id, terakhir GUC app.tenant_id. Fallback dipertahankan agar token bentuk lama maupun baru sama-sama bekerja. DRAFT: jalur klaim harus diverifikasi terhadap token Firebase third-party saat Realtime dipasang (Fase 3/6). Service layer tetap sumber otorisasi utama (PRD Bab 5.5).';

-- ----------------------------------------------------------------------------
-- app.is_ceo()
-- ----------------------------------------------------------------------------
-- True bila pemanggil adalah CEO. DUA syarat, bukan satu:
--   (1) klaim role aplikasi = 'CEO' (fallback berlapis, lihat di bawah), DAN
--   (2) BILA tabel `public.users` sudah ada, ADA baris user yang cocok dengan
--       `auth.uid()` (klaim `sub`) yang ber-role CEO dan belum dinonaktifkan.
-- Syarat (2) menghentikan kepercayaan buta pada klaim tunggal: token yang
-- memalsukan/menambah klaim `app_role` tetap ditolak bila tidak ada baris server
-- yang mengonfirmasinya.
--
-- Sumber klaim role aplikasi (urutan jelas, fallback berlapis agar token bentuk
-- lama maupun baru sama-sama bekerja):
--   (1) klaim top-level `app_role` -- kontrak kanonik Firebase custom claim,
--   (2) klaim top-level `role` -- token lama; pada sesi Firebase selalu berisi
--       role Postgres (`authenticated`), jadi TIDAK pernah cocok 'CEO' dan hanya
--       bernilai untuk token lama/anon yang mengangkut role aplikasi di sini,
--   (3) klaim bertingkat `app_metadata.role` -- bentuk bawaan Supabase,
--   (4) GUC `app.role` -- di-set per request untuk koneksi role RLS-enforced.
-- Semua lapis dibungkus nullif(...,'') agar string kosong tidak menang atas
-- lapis berikutnya.
--
-- KENAPA `plpgsql` + `EXECUTE` (JANGAN "dirapikan" kembali ke `language sql`):
-- `language sql` mem-parse-analysis body SAAT `CREATE FUNCTION` (bukan saat
-- dipanggil). Setiap relasi yang disebut di body -- termasuk `public.users` di
-- dalam `exists (...)` -- di-resolve pada saat definisi. Guard runtime seperti
-- `to_regclass('public.users') is null or exists (select 1 from public.users ...)`
-- TIDAK menolong: parser menyentuh `public.users` lebih dulu, sehingga
-- `create or replace function app.is_ceo()` sendiri GAGAL dengan
-- `ERROR: relation "public.users" does not exist` pada database yang belum
-- menjalankan Task 0.8. Ini sudah dibuktikan lewat eksekusi Postgres 15.19:
-- fungsi benar-benar tidak tercipta, jadi migrasi tidak bisa di-push ke
-- environment baru.
-- Karena itu fungsi ini `language plpgsql` dan memakai `EXECUTE` atas SQL
-- verifikasi server. Rencana query-nya baru dibuat di dalam `EXECUTE`, yaitu
-- pada saat eksekusi (lazy), sehingga `public.users` hanya disentuh setelah
-- guard `to_regclass('public.users') is null` lolos.
-- PERINGATAN EKSPLISIT: mengubah fungsi ini kembali ke `language sql` akan
-- MERUSAK `create or replace function` pada database tanpa `public.users`
-- (persis error di atas). `plpgsql` di sini WAJIB, bukan preferensi gaya.
-- TODO (Task 0.8): saat `public.users` tersedia, verifikasi server aktif
-- otomatis. WAJIB diverifikasi lewat test: user NON-CEO dengan klaim
-- `app_role='CEO'` palsu harus DITOLAK, dan user CEO asli harus lolos.
-- KENAPA BUKAN `role` saja: lihat (2) di atas.
-- Jalur klaim baseline WAJIB diverifikasi terhadap bentuk token Firebase
-- third-party yang sebenarnya saat Realtime dipasang (Fase 3/6).
--
-- PERINGATAN `security invoker` + RLS REKURSIF (dibuktikan lewat eksekusi):
-- fungsi ini `security invoker`, jadi `select ... from public.users` di dalam
-- `EXECUTE` berjalan sebagai PEMANGGIL dan tunduk RLS `public.users`. Bila
-- policy `public.users` memanggil `app.is_ceo()` (persis konvensi yang
-- didokumentasikan di bawah, blok (b), untuk `users`), evaluasinya REKURSIF
-- TAK TERBATAS dan Postgres melempar `stack depth limit exceeded` (sudah
-- direproduksi pada PostgreSQL 15.19 dengan role non-owner). Karena itu Task
-- 0.8 WAJIB memilih salah satu:
--   (i) policy `public.users` TIDAK memanggil `app.is_ceo()` sama sekali
--       (paling sederhana: scoping `users` murni via `firebase_uid`/tenant,
--       tanpa cabang CEO), ATAU
--   (ii) ubah fungsi ini menjadi `security definer` dengan owner tabel
--       (mis. `postgres`). Owner melewati RLS non-FORCE, sehingga SELECT
--       bersarang tidak memicu policy dan rekursi hilang; `search_path` sudah
--       dikunci ke `pg_catalog, pg_temp` sehingga aman-untuk-definer.
-- Rekomendasi: (ii) bila `users` memang perlu jalur CEO; (i) bila tidak.
-- JANGAN pakai `security invoker` + cabang `app.is_ceo()` di policy `users`.
create or replace function app.is_ceo()
returns boolean
language plpgsql
security invoker
stable
set search_path = pg_catalog, pg_temp
as $$
declare
  v_claim boolean;
  v_confirmed boolean;
begin
  -- `coalesce(..., '')` WAJIB: tanpa itu, saat TIDAK ada klaim sama sekali seluruh
  -- ekspresi bernilai NULL, `v_claim := NULL = 'CEO'` jadi NULL, dan `if not NULL`
  -- TIDAK masuk cabang ini -- fungsi jatuh ke `return true`. Itu fail-open nyata
  -- (tanpa token apa pun is_ceo() bernilai true) dan sudah dibuktikan lewat
  -- eksekusi. Bungkus luar memaksa NULL -> '' -> false.
  v_claim := coalesce(
      coalesce(
        nullif(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'app_role', ''),
        nullif(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role', ''),
        nullif(nullif(current_setting('request.jwt.claims', true), '')::json -> 'app_metadata' ->> 'role', ''),
        nullif(current_setting('app.role', true), '')
      ),
      ''
    ) = 'CEO';

  if not v_claim then
    return false;
  end if;

  if to_regclass('public.users') is null then
    return true;
  end if;

  execute $q$
    select exists (
      select 1
        from public.users u
       where u.firebase_uid = (nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub')
         and u.role::text = 'CEO'
         and u.disabled = false
         and u.deleted_at is null
    )
  $q$ into v_confirmed;

  return v_confirmed;
end
$$;

comment on function app.is_ceo() is
  'True bila pemanggil CEO: klaim role aplikasi (app_role, lalu role token lama, app_metadata.role, terakhir GUC app.role) = CEO DAN -- bila tabel public.users sudah ada -- ada baris server dengan firebase_uid = klaim sub, role = CEO, belum disabled/deleted. Implementasi WAJIB plpgsql + EXECUTE agar resolusi public.users lazy; mengubahnya kembali ke language sql akan merusak create or replace function pada database tanpa public.users. Guard to_regclass membuat fungsi aman sebelum public.users ada (Task 0.8). DRAFT: bentuk klaim diverifikasi saat Realtime dipasang (Fase 3/6).';

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
-- KETERBATASAN (eksplisit): `DATABASE_URL` aplikasi connect sebagai owner
-- tabel, dan owner MELEWATI RLS kecuali FORCE di-set. Jadi helper ini, dengan
-- `enable` saja, TIDAK bisa menjadi security boundary tunggal: ia hanya
-- melindungi jalur non-owner (mis. PostgREST/Realtime via `authenticated`),
-- sedangkan jalur owner/`DATABASE_URL` tetap bebas. `enable` tanpa FORCE inert
-- di jalur owner/direct.
-- Jalur upgrade (konkret): buat role DML non-owner khusus aplikasi (role owner
-- dipertahankan HANYA untuk migration), arahkan `DATABASE_URL` aplikasi ke role
-- itu, lalu set `force row level security` untuk role tersebut sehingga policy
-- benar-benar berlaku di jalur aplikasi.
-- ponytail: ceiling = jalur direct/owner dan service_role-bypass harus tetap
-- jalan; jalur upgrade = dedicated non-owner DML role (owner dicadangkan untuk
-- migration) + `force row level security` untuk role itu, setelah SEMUA akses
-- memakai role non-owner dengan policy eksplisit.
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
  'Mengaktifkan RLS (tanpa FORCE) pada tabel aplikasi. Dipanggil sekali per tabel oleh Task 0.8 agar tidak ada ENABLE RLS yang terlupa. FORCE sengaja tidak dipakai agar koneksi owner/Drizzle dan service_role tetap bekerja. Catatan: owner melewati RLS tanpa FORCE, jadi helper ini bukan security boundary tunggal; upgrade path = dedicated non-owner DML role untuk aplikasi + force row level security.';

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
--    notifications, device_logs). Baris ber-`tenant_id` NULL adalah baris
--    platform-internal (mis. user internal SnapBox), sehingga HANYA boleh
--    dibaca oleh role platform. JANGAN pakai disjungsi telanjang
--    `tenant_id is null`: itu fail-open, karena membuat baris platform terbaca
--    oleh SETIAP user authenticated dari tenant mana pun.
--    Karena itu klausa tenant wajib menegasikan NULL secara eksplisit:
--      `tenant_id = app.current_tenant_id() and tenant_id is not null`
--    dan baris NULL hanya bisa dijangkau lewat jalur terpisah:
--    - users, notifications (punya kolom pemilik user; scoping per-user, BUKAN
--      per-tenant). Predikat berikut SENGAJA tidak memakai helper
--      app.current_user_id() karena helper itu BELUM ada di repo ini (yang
--      tersedia baru app.current_tenant_id(), app.is_ceo(), app.enforce_rls()).
--      Ditulis eksplisit dari klaim JWT `sub` (Firebase UID) supaya bisa
--      disalin apa adanya oleh Task 0.8.
--      Untuk `users`: `id` internal uuid TIDAK sama dengan Firebase UID, jadi
--      scope lewat kolom `firebase_uid` (packages/db/src/schema.ts:87,
--      `firebase_uid varchar(128) not null unique`):
--        using (app.is_ceo()
--               or (tenant_id = app.current_tenant_id() and not (tenant_id is null))
--               or (tenant_id is null
--                   and firebase_uid = (nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub')))
--      Untuk `notifications`: `user_id uuid` mereferensi `users.id`
--      (packages/db/src/schema.ts:663), yaitu uuid internal -- BUKAN Firebase
--      UID -- sehingga TIDAK bisa dibandingkan langsung dengan klaim `sub`.
--      Policy-nya harus menyelesaikan id internal pemanggil lewat
--      `users.firebase_uid` lebih dulu (dua langkah):
--        using (app.is_ceo()
--               or (tenant_id = app.current_tenant_id() and not (tenant_id is null))
--               or (tenant_id is null
--                   and exists (select 1 from users u
--                                where u.id = notifications.user_id
--                                  and u.firebase_uid = (nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub'))))
--      DRAFT: bila kelak helper khusus `app.current_user_id()` diperkenalkan
--      (menyelesaikan `sub` -> `users.id`), kedua predikat di atas sebaiknya
--      DISEDERHANAKAN memakai helper itu; sampai saat itu SQL WAJIB memakai
--      ekspresi eksplisit di atas karena helper tersebut belum ada. Pembuatan
--      helper bukan bagian dari migrasi ini (dimiliki Task 0.8).
--    - activity_logs (kolom pemilik `actor_user_id`) dan device_logs (kolom
--      `device_id`): tidak punya kolom pemilik yang layak untuk scoping
--      end-user, jadi baris NULL-tenant HANYA boleh dijangkau lewat app.is_ceo()
--      atau jalur service layer (service_role, yang bypass RLS). Klausa tenant-nya:
--        using (app.is_ceo()
--               or (tenant_id = app.current_tenant_id() and tenant_id is not null))
--    `with check` WAJIB mencerminkan predikat yang sama, supaya tenant tidak bisa
--    MENULIS `tenant_id = NULL` untuk lolos dari scope-nya sendiri.
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
-- Hak akses fungsi helper (schema `app`)
-- ----------------------------------------------------------------------------
-- Ada DUA privilege berbeda yang dibutuhkan agar policy `to authenticated` bisa
-- memanggil app.current_tenant_id()/app.is_ceo():
--   1. USAGE pada schema `app`. Karena kedua fungsi membawa
--      `set search_path = pg_catalog, pg_temp`, keduanya TIDAK di-inline planner,
--      sehingga pemanggilan fungsi di dalam ekspresi policy di-resolve ATAS NAMA
--      role pemanggil (bukan owner). Tanpa USAGE, policy langsung gagal dengan
--      `permission denied for schema app`.
--   2. EXECUTE pada fungsi itu sendiri. Postgres memeriksa hak EXECUTE atas nama
--      role yang mengevaluasi policy; tanpa grant ini query gagal dengan
--      `permission denied for function app.current_tenant_id()`.
-- Yang mudah terlupa adalah privilege USAGE schema: `create schema if not exists
-- app;` tidak memberi hak apa pun, dan EXECUTE saja TIDAK cukup. Keduanya wajib
-- diberikan ke `authenticated` (dan `service_role`) di bawah.
-- Policy RLS di storage (20260101000200) dan realtime (20260101000300)
-- dideklarasikan `to authenticated` dan memanggil kedua fungsi itu DI DALAM
-- ekspresi USING, jadi keduanya bergantung pada grant ini.
-- `anon` sengaja TIDAK diberi USAGE schema maupun EXECUTE fungsi: anon tidak
-- boleh mengevaluasi policy tenant sama sekali.
-- Revoke dari PUBLIC tetap dilakukan agar akses default tidak terbuka lebar.
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
    -- USAGE schema adalah privilege yang paling mudah terlupa; EXECUTE saja
    -- tidak cukup karena fungsi tidak di-inline planner.
    grant usage on schema app to authenticated;
    grant execute on function app.current_tenant_id() to authenticated;
    grant execute on function app.is_ceo() to authenticated;
    revoke execute on function app.enforce_rls(regclass) from authenticated;
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant usage on schema app to service_role;
    grant execute on function app.current_tenant_id() to service_role;
    grant execute on function app.is_ceo() to service_role;
    grant execute on function app.enforce_rls(regclass) to service_role;
  end if;
end
$$;
