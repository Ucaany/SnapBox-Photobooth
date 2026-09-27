-- ============================================================================
-- 20260101000800_app_dml_role.sql
-- D-03 (AUDIT/11) / BE-001 (AUDIT/08) -- role DML khusus aplikasi.
--
-- TUJUAN. Membuat role non-owner untuk `DATABASE_URL` aplikasi, supaya RLS
-- benar-benar menjadi security boundary di jalur aplikasi, bukan hanya di jalur
-- PostgREST/Realtime.
--
-- ---------------------------------------------------------------------------
-- KONDISI SEBENARNYA, diverifikasi ke database live 2026-09-27
-- ---------------------------------------------------------------------------
--
-- (1) `DATABASE_URL` aplikasi connect sebagai `postgres`, dan `postgres` memegang
--     ATRIBUT `BYPASSRLS`:
--         current_user = postgres   rolsuper = false   rolbypassrls = TRUE
--     Ia juga OWNER dari 35/35 tabel aplikasi. Jadi jalur aplikasi melewati RLS
--     dua kali: sekali karena owner, sekali lagi karena atribut BYPASSRLS.
--
-- (2) `service_role` juga `rolbypassrls = true`, dan `postgres` adalah member-nya.
--
-- (3) KONSEKUENSI UNTUK `FORCE ROW LEVEL SECURITY`. `FORCE` hanya mencabut
--     pengecualian OWNER. Ia tidak menundukkan role ber-atribut `BYPASSRLS`.
--     Karena `postgres` punya atribut itu, `FORCE` di 35 tabel ini tidak
--     mengubah apa-apa bagi kredensial sekarang, termasuk bagi jalur
--     migrasi/seed. Jadi pembatas yang benar-benar memikul beban ada satu:
--     role aplikasi harus (a) bukan owner dan (b) tidak memegang BYPASSRLS.
--     Keduanya dipenuhi role di bawah.
--
--     `FORCE` tetap layak diaktifkan kemudian sebagai defence-in-depth kalau
--     atribut BYPASSRLS di `postgres` suatu saat dilepas. Tapi itu tambahan,
--     bukan syarat, dan FORCE tidak boleh-gerbang role.
--
-- ---------------------------------------------------------------------------
-- MENGAPA ROLE INI ANGGOTA `authenticated`
-- ---------------------------------------------------------------------------
-- 35 dari 36 policy RLS aplikasi ditulis `FOR ALL TO authenticated`; satu lagi
-- untuk `anon,authenticated`. Policy hanya berlaku untuk role yang disebutnya.
-- Role baru yang tidak menjadi anggota `authenticated` tidak cocok dengan policy
-- mana pun, dan RLS pada tabel tanpa policy yang cocok berarti DENY SEMUA.
-- Jadi keanggotaan itu wajib: dialah yang membuat policy yang sudah ada dan
-- sudah direview berlaku untuk role ini, tanpa menyalin teks policy.
--
-- Yang tidak diambil: keanggotaan `service_role` (BYPASSRLS) maupun `postgres`.
-- Role ini tidak boleh pernah punya jalur melewati RLS.
--
-- ---------------------------------------------------------------------------
-- HAK AKSES
-- ---------------------------------------------------------------------------
-- Dialihkan lewat keanggotaan `authenticated`, yang sudah memegang `usage on
-- schema public` dan DML pada tabel aplikasi (0001:25-26). Tidak ada grant DDL,
-- tidak ada hak membuat schema, tidak ada bypass.
--
-- PASSWORD SENGAJA TIDAK ADA DI BERKAS INI. Role dibuat tanpa password;
-- password di-set di luar repo:
--     alter role snapbox_app password '<nilai dari secret manager>';
--
-- NAMA LEWAT POOLER. Supabase pooler mewajibkan username `<role>.<project-ref>`,
-- jadi `DATABASE_URL` aplikasi harus menjadi
--     postgres://snapbox_app.<project-ref>:<password>@<pooler-host>:6543/postgres
-- bukan `postgres://postgres.<project-ref>:...`.
--
-- ---------------------------------------------------------------------------
-- YANG BELUM AMAN -- sengaja dibiarkan fail-closed, bukan diworkaround
-- ---------------------------------------------------------------------------
-- Role ini belum boleh dipakai sebagai `DATABASE_URL`. Tiga hal belum ada dan
-- ketiganya akan mematikan aplikasi, bukan hanya policy:
--
--   a) `app.tenant_id` tidak pernah di-set di mana pun pada kode aplikasi (nol
--      kemunculan `set_config` / `set local`). `app.current_tenant_id()` karena
--      itu selalu NULL, sehingga setiap policy tenant menghasilkan
--      `tenant_id = NULL` -> NULL -> tidak ada baris yang lolos. Aplikasi akan
--      membaca NOL BARIS di setiap tabel, bukan error.
--   b) `device_calibrations` punya RLS ON tanpa satu pun policy, jadi deny
--      total untuk role non-owner (BE-029, belum diputuskan).
--   c) `security_events`, `auth_sessions`, `system_health_checks` hanya punya
--      policy SELECT, sehingga jalur tulisnya ditolak.
--
-- Semuanya dilaporkan di AUDIT/14 bagian 2 dan harus diputuskan sebelum
-- `DATABASE_URL` dialihkan. Memperbaiki (a) butuh primitive per-request
-- (`set local app.tenant_id` di dalam transaksi) yang belum ada di repo ini.
-- ============================================================================

do $$
begin
  -- Idempoten: role sudah ada (environment pernah apply berkas ini) -> no-op.
  if not exists (select 1 from pg_roles where rolname = 'snapbox_app') then
    execute $create$
      create role snapbox_app
        login
        nosuperuser
        inherit
        nocreatedb
        nocreaterole
        nobypassrls
        noreplication
        connection limit 20
    $create$;
  end if;
end
$$;

comment on role snapbox_app is
  'Least-privilege DML role untuk DATABASE_URL aplikasi (D-03/BE-001). Non-owner, NOBYPASSRLS, tanpa hak DDL. Anggota authenticated supaya 35 policy RLS existing berlaku padanya. Password tidak disimpan di repo. Belum aman dipakai sebagai DATABASE_URL: app.tenant_id belum pernah di-set oleh aplikasi, device_calibrations tidak punya policy, dan tiga tabel telemetry tidak punya policy tulis.';

-- Keanggotaan authenticated = satu-satunya jalan policy RLS existing berlaku.
grant authenticated to snapbox_app;

-- Jaga invariant: role ini tidak boleh pernah bisa melewati RLS. Kalau ada yang
-- menambah `grant service_role to snapbox_app` (atau membership lain yang
-- membawa BYPASSRLS/superuser), seluruh keputusan D-03 jadi tidak berarti.
-- Failing keras, bukan memberi notice.
do $$
declare
  v_bypass_memberships text;
begin
  select string_agg(format('%I -> %I', child.rolname, parent.rolname), ', ')
    into v_bypass_memberships
    from pg_auth_members m
    join pg_roles child on child.oid = m.member
    join pg_roles parent on parent.oid = m.roleid
   where child.rolname = 'snapbox_app'
     and (parent.rolbypassrls or parent.rolsuper);

  if v_bypass_memberships is not null then
    raise exception
      'snapbox_app punya membership yang melewati RLS: %. Cabut membership itu; role DML aplikasi wajib tetap tunduk RLS.', v_bypass_memberships;
  end if;

  if exists (select 1 from pg_roles where rolname = 'snapbox_app' and rolbypassrls) then
    raise exception 'snapbox_app punya atribut BYPASSRLS. RLS tidak akan berlaku; cabut atributnya.';
  end if;
end
$$;
