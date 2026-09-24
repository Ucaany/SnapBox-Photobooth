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
  -- 52428800 = 50 MiB, batas eksplisit PRD Bab 6.E (video attract mp4 max 50MB), bukan angka bulat sembarang.
  ('attract',     'attract',     false, 52428800,  array['video/mp4', 'video/webm', 'image/png', 'image/jpeg']),
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
-- BENTUK KANONIK: `tenant/{tenantId}/<bucket>/...` -- prefiks tenant konsisten
-- untuk semua bucket, dengan subfolder per-bucket. Contoh bucket `frames`:
-- `tenant/{tenantId}/frames/{uuid}.png`; begitu pula `tenant/{tenantId}/reports/`,
-- `tenant/{tenantId}/soft-copies/`, dst. Ini satu-satunya bentuk yang seragam
-- dengan PRD Bab 6.T (baris ~599: `tenant/{tenantId}/frames/`).
-- CATATAN KESELARASAN DOKUMEN (tidak ada drift tersisa): PRD Bab 6.C (baris
-- ~371) sudah memakai bentuk kanonik `tenant/{tenant_id}/frames/{uuid}.png`,
-- dan PRD Bab 6.T (baris ~599) memakai `tenant/{tenantId}/frames/` -- keduanya
-- konsisten dengan bentuk kanonik di atas. Task 2.5 (baris ~2007) hanya
-- menyebut "storage upload ke Supabase bucket `frames`" tanpa path eksplisit,
-- jadi tidak ada konflik. DRAFT: validasi MIME/ukuran/dimensi di aplikasi
-- (Task 2.5: max 5MB, min 800x600, MIME PNG/JPG) tetap penegak utama; limit
-- bucket hanya plafon.
-- CATATAN `attract`: PRD Bab 6.T tidak menyediakan subfolder khusus untuk video
-- attract; dipakai `tenant/{tenantId}/attract/` sebagai tambahan yang konsisten
-- dengan bentuk kanonik di atas.
-- Aplikasi membangun path ini di server dari `session.tenant_id` -- TIDAK pernah
-- dari input klien. Policy di bawah hanya jaring pengaman: `service_role`
-- melewati RLS pada `storage.objects`, sehingga penegakkan sebenarnya ada di
-- pembangkit signed URL dan otorisasi service layer (ADR-004).

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
  v_policy_count integer;
begin
  if to_regclass('storage.objects') is null then
    raise notice 'storage.objects tidak ada, policy storage dilewati';
    return;
  end if;

  -- Satu sumber kebenaran: turunkan daftar bucket dari tabel `storage.buckets`
  -- yang sudah diisi blok `insert` di atas, bukan dari array literal kedua.
  -- Satu sumber = tidak ada drift: menambah bucket cukup lewat blok `insert`
  -- (atau migration baru), loop policy otomatis mengikuti.
  -- ponytail: filter `in (...)` di bawah masih literal; jalur upgrade = tambahkan
  -- kolom penanda policy (mis. `snapbox_has_policy`) di masa depan bila daftarnya
  -- bertumbuh sehingga loop bisa menyaring lewat predikat itu.

  -- Gagal keras di sini benar: bila bucket belum ada, loop di bawah beriterasi nol
  -- kali dan TIDAK membuat satu pun policy, padahal migration tetap sukses -- prefix
  -- tenant tanpa proteksi dan tanpa suara. `raise exception` menghentikan migration
  -- supaya kondisi itu tidak lolos. Ini aman: blok `insert ... on conflict` di atas
  -- berjalan LEBIH DULU di migration yang sama, jadi barisnya sudah terlihat di sini.
  if (select count(*) from storage.buckets
        where id in ('frames', 'branding', 'attract', 'soft-copies', 'reports', 'logs')) <> 6 then
    raise exception 'Bucket SnapBox tidak lengkap (harus 6); policy Storage TIDAK dibuat. Periksa blok insert di atas.';
  end if;

  for v_bucket in
    select id from storage.buckets
     where id in ('frames', 'branding', 'attract', 'soft-copies', 'reports', 'logs')
     order by id
  loop
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

  -- Verifikasi pasca-loop: pastikan policy benar-benar terdaftar, bukan hanya
  -- "loop selesai". Pola `like` memakai underscore TER-ESCAPE (`\_`) karena nama
  -- seperti `snapbox_frames_select` mengandung underscore literal, sehingga `_`
  -- tidak boleh berlaku sebagai wildcard satu karakter.
  select count(*) into v_policy_count
    from pg_catalog.pg_policies
   where schemaname = 'storage'
     and tablename = 'objects'
     and policyname like 'snapbox\_%';
  if v_policy_count < 12 then
    raise exception 'Hanya % policy SnapBox terbuat (harus >= 12); proteksi prefix tenant Storage tidak lengkap.', v_policy_count;
  end if;
end
$$;
