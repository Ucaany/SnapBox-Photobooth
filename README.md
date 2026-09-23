# SnapBox Photobooth

Platform SaaS multi-tenant untuk bisnis photobooth, plus aplikasi kiosk desktop Tauri v2 yang
mengeksekusi kamera dan printer secara lokal.

Dokumen acuan tunggal: [PRD_SnapBox_Photobooth_Platform_SaaS_Manajemen_Photobooth_Multi-Tenant_Kiosk_Desktop.md](./PRD_SnapBox_Photobooth_Platform_SaaS_Manajemen_Photobooth_Multi-Tenant_Kiosk_Desktop.md).

## Status

Fase 0 (Fondasi Arsitektur & Infrastruktur) sedang berjalan. Belum ada fitur bisnis.
Rincian progres per task: [docs/PHASE-0.md](./docs/PHASE-0.md).

## Struktur

| Path              | Isi                                                                                            |
| :---------------- | :--------------------------------------------------------------------------------------------- |
| `apps/web`        | Next.js 15 App Router: landing publik, dashboard CEO/Owner/Staff, konsol perangkat, route API. |
| `apps/desktop`    | Tauri v2: frontend kiosk (Vite + React) dan `src-tauri` (Rust, hardware engine).               |
| `packages/db`     | Skema Drizzle + migrasi Supabase PostgreSQL.                                                   |
| `packages/ui`     | Komponen UI neobrutalism bersama.                                                              |
| `packages/shared` | Skema Zod, tipe domain, event catalog realtime, standar error API.                             |

## Prasyarat

- Node.js >= 20.11
- pnpm 12.x (`corepack enable` bila belum ada)
- Rust >= 1.77 dan toolchain Tauri (hanya bila menyentuh `apps/desktop`)
- Supabase CLI (`brew install supabase/tap/supabase`) untuk Task 0.4. Paket `supabase` sengaja **tidak** dijadikan dependency workspace: CLI dipasang global (atau lewat `npx`) agar lockfile tidak menarik binary platform.

## Menjalankan

```bash
pnpm install
cp .env.example .env.local     # lalu isi nilainya
pnpm --filter @snapbox/db generate   # buat berkas migrasi dari skema
pnpm --filter @snapbox/db migrate    # terapkan ke database
pnpm --filter @snapbox/db seed       # isi tabel plans
pnpm dev
```

Web berjalan di <http://localhost:3000>. Cek konektivitas dependensi lewat `/api/health`.

### Supabase (lokal)

Urutan ini penting: migrasi infra harus jalan **sebelum** migrasi tabel.

1. Pasang CLI sekali, lalu nyalakan stack lokal (Postgres 15, Storage, Realtime).
2. Terapkan migrasi infra Supabase ke database lokal.
3. Baru jalankan migrasi Drizzle dari `packages/db` di atas database yang sama.

```bash
supabase start                        # nyalakan stack lokal (Postgres 15, Storage, Realtime)
pnpm supabase:db:reset                # terapkan supabase/migrations ke DB lokal
pnpm --filter @snapbox/db migrate     # Drizzle (Task 0.8) di atas DB yang sama
```

Dua aliran migrasi berbagi satu database, jadi urutannya bukan preferensi:
`supabase/migrations/*` (extension, bucket, Realtime, helper RLS) **wajib**
berjalan lebih dulu karena tabel Drizzle bergantung pada extension dan helper
tersebut. Menjalankan Drizzle lebih dulu hanya menghasilkan kegagalan
`extension ... does not exist`.

Kiosk desktop:

```bash
pnpm --filter @snapbox/desktop tauri:dev
```

## Perintah

| Perintah                           | Fungsi                                                                 |
| :--------------------------------- | :--------------------------------------------------------------------- |
| `pnpm dev`                         | Jalankan semua paket dalam mode watch.                                 |
| `pnpm build`                       | Build seluruh workspace.                                               |
| `pnpm lint`                        | ESLint, tanpa warning yang ditoleransi.                                |
| `pnpm typecheck`                   | `tsc --noEmit` per paket.                                              |
| `pnpm format`                      | Rapikan dengan Prettier.                                               |
| `pnpm --filter @snapbox/db studio` | Buka Drizzle Studio.                                                   |
| `pnpm supabase:start`              | Nyalakan stack Supabase lokal.                                         |
| `pnpm supabase:stop`               | Hentikan stack Supabase lokal.                                         |
| `pnpm supabase:status`             | Tampilkan URL lokal + kunci anon/service_role.                         |
| `pnpm supabase:db:push`            | Kirim `supabase/migrations` ke project remote (butuh `supabase link`). |
| `pnpm supabase:db:reset`           | Reset DB lokal lalu terapkan ulang `supabase/migrations`.              |

### Supabase: yang dikonfigurasi Task 0.4

- pg_cron + pg_net + pgcrypto diaktifkan (`supabase/migrations/20260101000000_enable_extensions.sql`).
- Enam bucket Storage privat (frames, branding, attract, soft-copies, reports, logs) dengan limit MIME/ukuran per-bucket dan policy prefix tenant draft (`supabase/migrations/20260101000200_storage_buckets.sql`).
- Realtime Broadcast/Presence dengan policy draft pada `realtime.messages` (`supabase/migrations/20260101000300_realtime.sql`).
- Firebase third-party auth diaktifkan supaya Realtime bisa mengotorisasi koneksi.
- Fungsi helper RLS di schema `app` (`supabase/migrations/20260101000100_rls_foundation.sql`).
- **Tidak ada tabel aplikasi dan tidak ada RLS policy pada tabel aplikasi yang dibuat di Task 0.4** — itu Task 0.8 (Drizzle).

### Batas sengaja

| Ditunda                                                | Alasan                                                               | Dikerjakan di                          |
| :----------------------------------------------------- | :------------------------------------------------------------------- | :------------------------------------- |
| Browser-direct Storage upload (signed upload URL)      | Aplikasi mengunggah lewat server dengan `service_role`               | saat upload besar/desktop dioptimalkan |
| RLS policy pada tabel aplikasi                         | Milik Drizzle, sumber kebenaran tabel di `packages/db/src/schema.ts` | Task 0.8                               |
| Firebase provider dinonaktifkan penuh di Auth Supabase | Realtime butuh JWT bertanda tangan Supabase                          | Fase 6                                 |
| pg_cron job (subscription expiry, cleanup)             | Tabel & handler belum ada                                            | Fase 3/6/8                             |
| Remote project + env Vercel                            | Butuh keputusan akun/organisasi, di luar repo                        | Task 0.9                               |

## Aturan kerja

Kontribusi mengikuti aturan eksekusi bertahap di PRD Bab 11. Dua aturan yang paling sering
dilanggar dan paling mahal akibatnya:

1. **Isolasi tenant diverifikasi di server.** `session.tenant_id` harus sama dengan
   `resource.tenant_id`. Pelanggaran dibalas 404, bukan 403 (PRD Bab 5.5).
2. **Status pembayaran hanya berubah dari webhook terverifikasi.** Klien kiosk tidak pernah
   memutuskan `PAID` (ADR-002).

Keputusan arsitektur tercatat di [docs/adr/](./docs/adr/). Setiap keputusan visual atau teknis
besar wajib punya alasan tertulis satu baris di sana.
