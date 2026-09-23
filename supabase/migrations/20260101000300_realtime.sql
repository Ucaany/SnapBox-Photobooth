-- ============================================================================
-- 20260101000300_realtime.sql
-- Task 0.4 (Supabase Setup) - PRD Bab 10.6, ADR-011
-- Tujuan: naskah otorisasi Realtime Broadcast/Presence. File ini TIDAK
-- membuat/mengubah/menghapus tabel aplikasi apa pun.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Nama channel berasal dari packages/shared/src/events.ts:
--   booth:{id}, tenant:{id}, user:{id}, broadcast:all
-- Transport yang dipakai adalah Broadcast dan Presence, BUKAN Postgres Changes.
-- Karena itu TIDAK ada `alter publication supabase_realtime add table` di sini:
-- tabel aplikasi tidak pernah dikirim sebagai replikasi perubahan.
--
-- `[auth.third_party.firebase]` di config.toml memungkinkan token Firebase
-- ditukar menjadi JWT bertanda tangan Supabase yang dipakai Realtime untuk
-- mengautentikasi koneksi (sesi aplikasi Firebase, bukan Supabase Auth).
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
-- bypass RLS, jadi tidak ada policy INSERT yang dibuat: klien browser TIDAK
-- boleh mem-publish, dan `service_role` tidak butuh policy. Bila Realtime
-- versi saat ini tidak mengekspos `realtime.topic()`, seluruh blok dilewati
-- dan dicatat via `raise notice` (bukan stub deny-all) agar kegagalan
-- konfigurasi terlihat, bukan diam-diam terkunci.
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
  execute $pol$
    create policy snapbox_realtime_select on realtime.messages
      for select to authenticated
      using (
        realtime.topic() = 'tenant:' || app.current_tenant_id()::text
        or realtime.topic() = 'user:' || coalesce(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub', '')
        or realtime.topic() = 'broadcast:all'
        or app.is_ceo()
      )
  $pol$;
  execute $cmt$
    comment on policy snapbox_realtime_select on realtime.messages is
      'DRAFT defense-in-depth: terima siaran channel tenant/user milik pemanggil atau broadcast:all. Publish tetap service_role-only dari server.'
  $cmt$;

  -- Channel booth divalidasi lewat tabel public.booths. Nama kolom di bawah
  -- WAJIB selaras dengan packages/db/src/schema.ts (booths.id, booths.tenant_id).
  -- Policy dibuat hanya bila tabel sudah ada; migration ini dijalankan SETELAH
  -- Task 0.8 membuat tabel aplikasi.
  if to_regclass('public.booths') is not null then
    execute 'drop policy if exists snapbox_realtime_booth_select on realtime.messages';
    execute $pol$
      create policy snapbox_realtime_booth_select on realtime.messages
        for select to authenticated
        using (
          exists (
            select 1
              from public.booths b
             where b.id::text = split_part(realtime.topic(), ':', 2)
               and realtime.topic() like 'booth:%'
               and (app.is_ceo() or b.tenant_id = app.current_tenant_id())
          )
        )
    $pol$;
    execute $cmt$
      comment on policy snapbox_realtime_booth_select on realtime.messages is
        'DRAFT defense-in-depth: terima channel booth:<id> hanya bila booth milik tenant pemanggil. Kolom mengikuti packages/db/src/schema.ts. Publish tetap service_role-only dari server.'
    $cmt$;
  else
    raise notice 'public.booths belum ada, policy booth realtime dilewati (jalankan setelah Task 0.8)';
  end if;
end
$$;
