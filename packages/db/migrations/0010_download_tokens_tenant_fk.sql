-- FK `download_tokens.tenant_id -> tenants.id`.
--
-- `packages/db/src/schema.ts` sudah mendeklarasikan `.references(() => tenants.id)`
-- untuk kolom ini, jadi `drizzle-kit generate` tidak pernah mengusulkan
-- constraint ini: snapshot dan schema sudah sepakat, dan itu membuat generate
-- buta. Yang tidak ada adalah DDL-nya. Tabel `download_tokens` dibuat oleh
-- baseline 0000 tanpa FK, dan tidak ada migration yang menambahkannya
-- (diverifikasi ke database live 2026-09-27: 19 tabel lain sudah punya FK
-- tenant, `download_tokens` satu-satunya yang tidak).
--
-- Ini persis kelas yang dijaga `scripts/check-tenant-fk.mjs`: guard membaca
-- TEKS schema, jadi ia bisa melihat tabel tanpa deklarasi FK, tapi tidak bisa
-- melihat tabel yang deklarasinya ada sementara DDL-nya tidak pernah dibuat.
-- Guard menutup yang pertama; berkas ini menutup yang kedua.
--
-- Idempotent lewat pemeriksaan `pg_constraint`, supaya migration yang dijalankan
-- dua kali tidak gagal. Tabel kosong di database yang diperiksa, jadi tidak ada
-- data yang perlu dirapikan.

do $$
begin
  if to_regclass('public.download_tokens') is null then
    raise notice 'download_tokens belum ada, dilewati';
    return;
  end if;

  if not exists (
    select 1
      from pg_constraint k
      join pg_class rel on rel.oid = k.conrelid
     where rel.relname = 'download_tokens'
       and k.contype = 'f'
       and k.confrelid = 'public.tenants'::regclass
  ) then
    alter table public.download_tokens
      add constraint download_tokens_tenant_id_tenants_id_fk
      foreign key (tenant_id) references public.tenants (id) on delete cascade;
  end if;
end
$$;
