-- ============================================================================
-- 20260101000600_broadcast_tenant_scope.sql
-- Task 1.12 (PRD Task 1.9) - scope baca `broadcasts` untuk tenant penerima.
--
-- SUMBER DDL TUNGGAL. Tabel `public.broadcasts` sudah dibuat di
-- `packages/db/migrations/0000_smiling_hawkeye.sql` dan RLS-nya sudah diaktifkan
-- `packages/db/migrations/0001_rls_and_realtime.sql`. File ini HANYA menambah
-- policy, tidak ada `create table` / `alter table` DDL di sini.
--
-- Latar: `0001` menaruh `broadcasts` di daftar platform-only (CEO-only). Itu
-- benar untuk tulis, tetapi Task 1.9 mengirim pengumuman ke "semua tenant" atau
-- "tenant terpilih", dan tenant penerima harus bisa membacanya lewat jalur
-- non-owner (PostgREST/Realtime), bukan hanya lewat service role.
--
-- Perubahan HANYA memperluas SELECT. Jalur tulis tetap service layer sebagai
-- owner, dan `with check (app.is_ceo())` dari policy `snapbox_broadcasts_ceo`
-- (`0001:129-138`) tetap satu-satunya yang berlaku untuk `authenticated`.
--
-- Idempotent: `drop policy if exists` lalu `create policy`.
-- ============================================================================

-- Broadcast massal (`target_all = true`) memang pengumuman publik ke semua
-- tenant; isinya bukan data milik tenant lain, jadi aman terlihat.
drop policy if exists snapbox_broadcasts_tenant_read on public.broadcasts;

create policy snapbox_broadcasts_tenant_read on public.broadcasts
  for select to authenticated
  using (
    target_all
    or (
      target_tenant_ids is not null
      and app.current_tenant_id() is not null
      and jsonb_exists(target_tenant_ids, app.current_tenant_id()::text)
    )
  );

comment on policy snapbox_broadcasts_tenant_read on public.broadcasts is
  'Task 1.12: tenant penerima boleh SELECT broadcast target_all atau yang mencantumkan tenant-nya di target_tenant_ids. Fail-closed bila app.current_tenant_id() NULL.';
