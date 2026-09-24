-- ============================================================================
-- 20260101000300_realtime.sql
-- Task 0.4 (Supabase Setup) - PRD Bab 10.6, ADR-011
-- Tujuan: naskah otorisasi Realtime Broadcast/Presence. File ini TIDAK
-- membuat/mengubah/menghapus tabel aplikasi apa pun.
-- Urutan: `supabase/migrations/*` dijalankan LEBIH DULU, lalu
-- `packages/db/migrations/*` (Drizzle) menyusul di database yang sama.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Nama channel berasal dari packages/shared/src/events.ts:
--   booth:{id}, tenant:{id}, user:{id}, broadcast:all
-- Transport yang dipakai adalah Broadcast dan Presence, BUKAN Postgres Changes.
-- Karena itu TIDAK ada `alter publication supabase_realtime add table` di sini:
-- tabel aplikasi tidak pernah dikirim sebagai replikasi perubahan.
--
-- Channel `booth:{id}`: policy-nya dibuat di aliran Drizzle (Task 0.8), BUKAN di
-- sini, karena tabel `public.booths` belum ada saat migration ini berjalan.
--
-- `[auth.third_party.firebase]` di config.toml membuat Supabase MEMVALIDASI
-- JWT Firebase secara langsung (tanpa penukaran token) sehingga Realtime
-- mengautorisasi koneksi memakai sesi Firebase itu (bukan Supabase Auth).
-- ----------------------------------------------------------------------------

do $$
begin
  if to_regclass('realtime.messages') is not null then
    execute 'alter table realtime.messages enable row level security';
  end if;
end
$$;

-- ----------------------------------------------------------------------------
-- Policy draft pada realtime.messages
-- ----------------------------------------------------------------------------
-- DRAFT / defense-in-depth. Publish dari server memakai `service_role` yang
-- bypass RLS, jadi tidak ada policy INSERT broadcast yang dibuat: klien browser
-- TIDAK boleh mem-publish, dan `service_role` tidak butuh policy. Bila Realtime
-- versi saat ini tidak mengekspos `realtime.topic()`, seluruh blok dilewati
-- dan dicatat via `raise notice` (bukan stub deny-all) agar kegagalan
-- konfigurasi terlihat, bukan diam-diam terkunci.
-- Policy SELECT bersifat SADAR-EXTENSION: `realtime.messages.extension`
-- membedakan family pesan, sehingga presence read (server-emitted) tidak lagi
-- tersaring oleh policy yang hanya menggantung pada topic.
-- Channel `user:` memakai klaim `sub` (subject) dari JWT, yaitu Firebase UID di
-- bawah third-party auth. Karena itu konvensi `user:{userId}` di
-- packages/shared/src/events.ts WAJIB mengisi suffix dengan Firebase UID, bukan
-- id internal lain, supaya policy ini cocok dengan channel yang di-subscribe klien.
do $$
begin
  if to_regclass('realtime.messages') is null then
    raise notice 'realtime.messages tidak ada, policy realtime dilewati';
    return;
  end if;

  if to_regprocedure('realtime.topic()') is null then
    raise notice 'realtime.topic() tidak tersedia, policy realtime dilewati';
    return;
  end if;

  execute 'drop policy if exists snapbox_realtime_select on realtime.messages';
  -- SELECT harus sadar-extension: presence_read (`presence_diff`/`presence_state`)
  -- adalah baris yang DIKIRIM SERVER pada `realtime.messages`, jadi policy SELECT
  -- yang hanya menggantung pada topic akan menyaring presence keluar. Cabang
  -- broadcast mempertahankan perilaku lama (termasuk `broadcast:all`); cabang
  -- presence HANYA mengizinkan channel tenant/user -- presence di channel global
  -- tetap dilarang, `broadcast:all` TIDAK masuk cabang presence.
  -- Terverifikasi dari docs Supabase (guides/realtime/authorization): satu-satunya
  -- nilai `realtime.messages.extension` untuk presence (track MAUPUN receive)
  -- adalah `presence`. Tidak ada literal `presence_diff`/`presence_state` yang
  -- didokumentasikan sebagai nilai kolom ini, jadi TIDAK dipakai.
  -- `app.is_ceo()` sengaja tetap di luar cabang extension (bypass family): CEO
  -- sudah memegang akses lintas-tenant, dan memaksanya ke salah satu family hanya
  -- akan mempersempit perilaku yang sudah berjalan tanpa manfaat keamanan.
  execute $pol$
    create policy snapbox_realtime_select on realtime.messages
      for select to authenticated
      using (
        (
          realtime.messages.extension = 'broadcast'
          and (
            realtime.topic() = 'tenant:' || app.current_tenant_id()::text
            or realtime.topic() = 'user:' || coalesce(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub', '')
            -- `broadcast:all` adalah kanal lintas-tenant; TIDAK boleh dibaca
            -- semua authenticated. Gerbang CEO: hanya `app.is_ceo()` yang lolos.
            or (realtime.topic() = 'broadcast:all' and app.is_ceo())
          )
        )
        or (
          realtime.messages.extension = 'presence'
          and (
            realtime.topic() = 'tenant:' || app.current_tenant_id()::text
            or realtime.topic() = 'user:' || coalesce(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub', '')
          )
        )
        or app.is_ceo()
      )
  $pol$;
  execute $cmt$
    comment on policy snapbox_realtime_select on realtime.messages is
      'DRAFT defense-in-depth: sadar-extension. Broadcast: channel tenant/user pemanggil, atau broadcast:all (khusus CEO via app.is_ceo()). Presence (extension=''presence''): channel tenant/user pemanggil saja, channel global dilarang. Publish tetap service_role-only dari server.'
  $cmt$;

  -- Presence track menulis ke realtime.messages dengan
  -- `extension = 'presence'`; tanpa policy INSERT, presence diam-diam mati.
  -- Policy ini HANYA mengizinkan presence; broadcast tetap service_role-only.
  -- Tidak ada policy untuk `broadcast:all`: presence di channel global tidak
  -- dibutuhkan (lihat PRD Bab 10.5, `tenant:{id}` = staff presence).
  execute 'drop policy if exists snapbox_realtime_presence_insert on realtime.messages';
  execute $pol$
    create policy snapbox_realtime_presence_insert on realtime.messages
      for insert to authenticated
      with check (
        realtime.messages.extension = 'presence'
        and (
          realtime.topic() = 'tenant:' || app.current_tenant_id()::text
          or realtime.topic() = 'user:' || coalesce(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub', '')
        )
      )
  $pol$;
  execute $cmt$
    comment on policy snapbox_realtime_presence_insert on realtime.messages is
      'DRAFT defense-in-depth: authenticated hanya boleh track presence pada channel tenant/user miliknya. Broadcast publish tetap service_role-only.'
  $cmt$;

  -- Channel `booth:{id}`: policy-nya TIDAK dibuat di sini karena migration ini
  -- berjalan LEBIH DULU daripada `packages/db/migrations/*` (Drizzle, Task 0.8)
  -- yang baru membuat `public.booths`. Karena itu `to_regclass('public.booths')`
  -- di sini SELALU null dan policy booth tidak akan pernah tercipta. Policy itu
  -- dimiliki aliran Drizzle (Task 0.8) dan WAJIB dibuat di sana SETELAH
  -- `public.booths` ada, dengan bentuk predikat berikut:
  --
  --   create policy snapbox_realtime_booth_select on realtime.messages
  --     for select to authenticated
  --     using (
  --       realtime.topic() like 'booth:%'
  --       and exists (
  --         select 1 from public.booths b
  --          where b.id::text = split_part(realtime.topic(), ':', 2)
  --            and (app.is_ceo() or b.tenant_id = app.current_tenant_id())
  --       )
  --     );
  --
  -- Policy booth adalah milik Task 0.8 (aliran Drizzle), BUKAN file ini. Bentuk
  -- finalnya WAJIB extension-scoped (memuat `realtime.messages.extension`) agar
  -- tidak memperlebar akses presence lintas channel.
  --
  -- Kenapa `drop` di sini, bukan `raise notice`: environment yang sudah pernah
  -- men-apply file LAMA dapat memiliki policy basi `snapbox_realtime_booth_select`
  -- yang dibuat versi sebelumnya dan TIDAK ter-scope extension -- policy itu
  -- memperlebar akses presence dan TIDAK ikut hilang karena file migrasi lama
  -- tidak dijalankan ulang. `drop policy if exists` membersihkan sisa itu di
  -- environment lama TANPA error bila policy tidak ada (idempotent), lalu Task 0.8
  -- membuat versi extension-scoped yang benar.
  --
  -- Kueri penerimaan untuk Task 0.8 (harus mengembalikan SATU baris setelah
  -- migrasi Drizzle):
  --   select * from pg_policies where policyname = 'snapbox_realtime_booth_select';
  execute 'drop policy if exists snapbox_realtime_booth_select on realtime.messages';
  raise notice 'policy booth:{id} dibersihkan bila ada; versi extension-scoped WAJIB dibuat oleh aliran Drizzle (Task 0.8) setelah public.booths ada. Tanpa itu channel booth:{id} DITOLAK untuk authenticated.';
end
$$;
