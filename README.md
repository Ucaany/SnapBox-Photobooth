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

Kiosk desktop:

```bash
pnpm --filter @snapbox/desktop tauri:dev
```

## Perintah

| Perintah                           | Fungsi                                  |
| :--------------------------------- | :-------------------------------------- |
| `pnpm dev`                         | Jalankan semua paket dalam mode watch.  |
| `pnpm build`                       | Build seluruh workspace.                |
| `pnpm lint`                        | ESLint, tanpa warning yang ditoleransi. |
| `pnpm typecheck`                   | `tsc --noEmit` per paket.               |
| `pnpm format`                      | Rapikan dengan Prettier.                |
| `pnpm --filter @snapbox/db studio` | Buka Drizzle Studio.                    |

## Aturan kerja

Kontribusi mengikuti aturan eksekusi bertahap di PRD Bab 11. Dua aturan yang paling sering
dilanggar dan paling mahal akibatnya:

1. **Isolasi tenant diverifikasi di server.** `session.tenant_id` harus sama dengan
   `resource.tenant_id`. Pelanggaran dibalas 404, bukan 403 (PRD Bab 5.5).
2. **Status pembayaran hanya berubah dari webhook terverifikasi.** Klien kiosk tidak pernah
   memutuskan `PAID` (ADR-002).

Keputusan arsitektur tercatat di [docs/adr/](./docs/adr/). Setiap keputusan visual atau teknis
besar wajib punya alasan tertulis satu baris di sana.
