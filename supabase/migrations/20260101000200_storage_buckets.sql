-- ============================================================================
-- 20260101000200_storage_buckets.sql
-- Task 0.4 (Supabase Setup) - PRD Bab 10.4, Bab 6.T
-- Tujuan: membuat enam bucket Storage privat beserta policy draft (defense in
-- depth). File ini TIDAK membuat/mengubah/menghapus tabel aplikasi apa pun.
-- ============================================================================

-- Enam bucket privat SnapBox (PRD Bab 10.4). Semua akses lewat signed URL.
-- `on conflict (id)` membuat file ini re-runnable sekaligus menegakkan ulang
-- limit dan mime types bila nilainya berubah.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('frames',      'frames',      false,  5242880,  array['image/png', 'image/jpeg', 'image/webp']),
  ('branding',    'branding',    false,  2097152,  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  ('attract',     'attract',     false, 104857600, array['video/mp4', 'video/webm', 'image/png', 'image/jpeg']),
  ('soft-copies', 'soft-copies', false, 26214400, array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/zip']),
  ('reports',     'reports',     false, 26214400, array['application/pdf', 'text/csv', 'application/zip']),
  ('logs',        'logs',        false, 26214400, array['text/plain', 'application/json', 'application/zip'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ----------------------------------------------------------------------------
-- Konvensi path (PRD Bab 6.T)
-- ----------------------------------------------------------------------------
-- Semua objek disimpan pada `tenant/{tenantId}/...`. Aplikasi membangun path
-- ini di server dari `session.tenant_id` -- TIDAK pernah dari input klien.
-- Policy di bawah hanya jaring pengaman: `service_role` melewati RLS pada
-- `storage.objects`, sehingga penegakkan sebenarnya ada di pembangkit signed
-- URL dan otorisasi service layer (ADR-004).

-- Supabase sudah mengaktifkan RLS pada storage.objects; statement di bawah
-- ada supaya file ini juga berjalan di Postgres polos.
do $$
begin
  if to_regclass('storage.objects') is not null then
    execute 'alter table storage.objects enable row level security';
  end if;
end
$$;

-- ----------------------------------------------------------------------------
-- Policy draft per bucket
-- ----------------------------------------------------------------------------
-- STATUS: DRAFT / defense-in-depth. Aplikasi mengakses Storage memakai
-- `service_role` (bypass RLS), jadi policy ini tidak menjadi kontrol akses
-- utama; signed URL tetap otoritatif. Sengaja TIDAK ada WITH CHECK yang bisa
-- mematahkan upload sah. Jalur upgrade: saat upload langsung dari browser
-- diperkenalkan, tambahkan policy UPDATE dan DELETE dengan predikat prefix
-- tenant yang sama.
do $$
declare
  v_bucket text;
  v_buckets text[] := array['frames', 'branding', 'attract', 'soft-copies', 'reports', 'logs'];
begin
  if to_regclass('storage.objects') is null then
    raise notice 'storage.objects tidak ada, policy storage dilewati';
    return;
  end if;

  foreach v_bucket in array v_buckets loop
    execute format('drop policy if exists %I on storage.objects', 'snapbox_' || v_bucket || '_select');
    execute format(
      'create policy %I on storage.objects for select to authenticated using (bucket_id = %L and name like %L || app.current_tenant_id()::text || %L)',
      'snapbox_' || v_bucket || '_select', v_bucket, 'tenant/', '/%'
    );
    execute format(
      'comment on policy %I on storage.objects is %L',
      'snapbox_' || v_bucket || '_select',
      'DRAFT defense-in-depth: baca objek hanya pada prefix tenant pemanggil. service_role bypass RLS; signed URL tetap kontrol akses otoritatif.'
    );

    execute format('drop policy if exists %I on storage.objects', 'snapbox_' || v_bucket || '_insert');
    execute format(
      'create policy %I on storage.objects for insert to authenticated with check (bucket_id = %L and name like %L || app.current_tenant_id()::text || %L)',
      'snapbox_' || v_bucket || '_insert', v_bucket, 'tenant/', '/%'
    );
    execute format(
      'comment on policy %I on storage.objects is %L',
      'snapbox_' || v_bucket || '_insert',
      'DRAFT defense-in-depth: tulis objek hanya pada prefix tenant pemanggil. service_role bypass RLS. Upgrade: tambah policy UPDATE/DELETE saat upload langsung browser diperkenalkan.'
    );
  end loop;
end
$$;
