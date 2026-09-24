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
| `packages/auth`   | Pembungkus Firebase (client + admin) dan kontrak custom claims.                                |
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
pnpm --filter @snapbox/db generate   # hanya bila schema berubah
pnpm --filter @snapbox/db migrate    # DIRECT_URL, koneksi direct PostgreSQL
pnpm --filter @snapbox/db seed       # isi tabel plans
pnpm dev
```

Web berjalan di <http://localhost:3000>. Cek konektivitas dependensi lewat `/api/health`.

### Supabase (lokal)

Urutan ini penting: migrasi infra harus jalan **sebelum** migrasi tabel.
`DATABASE_URL` memakai Supabase Session Pooler untuk runtime. `DIRECT_URL` memakai
koneksi database langsung untuk Drizzle migration, push, studio, dan seed.
Jika `DIRECT_URL` kosong, tooling fallback ke `DATABASE_URL`, yang hanya aman bila
URL tersebut bukan transaction-mode pooler.

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
berjalan lebih dulu. Skema Drizzle sendiri hanya memakai tipe core
(`gen_random_uuid()`, `pgEnum`) dan tanpa helper `app.*` tetap terbuat, tetapi
policy RLS per-tabel yang ditambahkan Task 0.8 memanggil helper schema `app`
sehingga aliran itu gagal dengan `function app.current_tenant_id() does not exist`.

Kiosk desktop:

```bash
pnpm --filter @snapbox/desktop tauri:dev
```

## Perintah

| Perintah                             | Fungsi                                                                                                                     |
| :----------------------------------- | :------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                           | Jalankan semua paket dalam mode watch.                                                                                     |
| `pnpm build`                         | Build seluruh workspace.                                                                                                   |
| `pnpm lint`                          | ESLint, tanpa warning yang ditoleransi.                                                                                    |
| `pnpm typecheck`                     | `tsc --noEmit` per paket.                                                                                                  |
| `pnpm format`                        | Rapikan dengan Prettier.                                                                                                   |
| `pnpm --filter @snapbox/db studio`   | Buka Drizzle Studio.                                                                                                       |
| `pnpm --filter @snapbox/db generate` | Generate migration dari `packages/db/src/schema.ts`.                                                                       |
| `pnpm --filter @snapbox/db migrate`  | Terapkan migration baseline + RLS dengan `DIRECT_URL`.                                                                     |
| `pnpm --filter @snapbox/db seed`     | Upsert tiga plan canonical setelah migration.                                                                              |
| `pnpm check:firebase-project-id`     | Jaga project id Firebase tetap konsisten antara `supabase/config.toml` dan env.                                            |
| `pnpm check:claims-sync`             | Jaga nama claim di `packages/auth/src/claims.ts` dan `packages/shared/src/auth.ts` tetap sinkron.                          |
| `pnpm check:infra-drafts`            | Validasi draf JSON Cloudflare di `infra/cloudflare/` terhadap PRD 8.2: JSON parse, paritas path, konsistensi pengecualian. |
| `pnpm supabase:start`                | Nyalakan stack Supabase lokal.                                                                                             |
| `pnpm supabase:stop`                 | Hentikan stack Supabase lokal.                                                                                             |
| `pnpm supabase:status`               | Tampilkan URL lokal + kunci anon/service_role.                                                                             |
| `pnpm supabase:db:push`              | Kirim `supabase/migrations` ke project remote (butuh `supabase link`).                                                     |
| `pnpm supabase:db:reset`             | Reset DB lokal lalu terapkan ulang `supabase/migrations`.                                                                  |

### Supabase: yang dikonfigurasi Task 0.4

- pg_cron + pg_net + pgcrypto diaktifkan (`supabase/migrations/20260101000000_enable_extensions.sql`).
- Enam bucket Storage privat (frames, branding, attract, soft-copies, reports, logs) dengan limit MIME/ukuran per-bucket dan policy prefix tenant draft (`supabase/migrations/20260101000200_storage_buckets.sql`).
- Realtime Broadcast/Presence dengan policy draft pada `realtime.messages` (`supabase/migrations/20260101000300_realtime.sql`).
- Firebase third-party auth diaktifkan supaya Realtime bisa mengotorisasi koneksi.
- Fungsi helper RLS di schema `app` (`supabase/migrations/20260101000100_rls_foundation.sql`).
- **Tidak ada tabel aplikasi dan tidak ada RLS policy pada tabel aplikasi yang dibuat di Task 0.4**. Task 0.8 membuatnya lewat `packages/db/migrations/`.

### Drizzle dan RLS (Task 0.8)

- `packages/db/migrations/0000_smiling_hawkeye.sql` adalah baseline yang dihasilkan dari 31 tabel `src/schema.ts`.
- `packages/db/migrations/0001_rls_and_realtime.sql` mengaktifkan RLS, membuat policy tenant/parent/platform, dan menambahkan policy `snapbox_realtime_booth_select` setelah tabel `booths` tersedia.
- Acceptance query:

  ```sql
  select * from pg_policies where policyname = 'snapbox_realtime_booth_select';
  ```

- RLS sengaja memakai `ENABLE`, bukan `FORCE`, sesuai ADR. Jalur owner/direct dan `service_role` tetap bypass; hardening dedicated non-owner DML role dikerjakan kemudian.

### Firebase (identity provider, Task 0.5)

Firebase adalah penyedia identitas tunggal (PRD 10.3); Supabase hanya memverifikasi JWT-nya untuk
Realtime, dan bukan IdP.

- Paket `packages/auth` (nama `@snapbox/auth`) memiliki empat subpath impor: `.`, `./claims`,
  `./admin`, dan `./client`.
- Barrel akar sengaja tidak mereekspor `./admin`, jadi bundle browser tidak akan pernah menarik
  `firebase-admin`. Impor `@snapbox/auth/admin` hanya dari server, `@snapbox/auth/client` hanya
  dari browser.
- Kontrak klaim kanonik ada di `packages/auth/src/claims.ts`.

Aturan DUA klaim, bagian yang paling mudah salah:

- Claim `role` wajib bernilai `'authenticated'`. Supabase menimpanya dengan peran sesi Postgres,
  jadi nilai aplikasi di sana akan hilang.
- Peran aplikasi hidup di claim `app_role` (`CEO` | `OWNER` | `STAFF`).
- Alasan lengkapnya di [docs/ADR-003-firebase-auth.md](./docs/ADR-003-firebase-auth.md).

Env: tiga variabel server `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`,
`FIREBASE_ADMIN_PRIVATE_KEY`, dan empat variabel client `NEXT_PUBLIC_FIREBASE_API_KEY`,
`NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`,
`NEXT_PUBLIC_FIREBASE_APP_ID`. Semuanya sudah ada di `.env.example` sejak Task 0.1, jadi Task 0.5
tidak menambah variabel baru. Repo ini sengaja tidak menyimpan berkas JSON service account.

Dua penjaga menjaga konsistensi:

- `pnpm check:firebase-project-id` menjaga project id Firebase agar sama antara
  `supabase/config.toml` dan env.
- `pnpm check:claims-sync` menjaga nama claim di `packages/auth/src/claims.ts` dan
  `packages/shared/src/auth.ts` agar tidak melenceng.

```bash
# Konsol Firebase (sekali): buat project, aktifkan provider Email/Password,
# lalu unduh kredensial. Rincian lengkap ada di docs/ADR-003-firebase-auth.md.
cp .env.example .env.local     # isi FIREBASE_ADMIN_* dan NEXT_PUBLIC_FIREBASE_*
pnpm check:firebase-project-id
pnpm check:claims-sync
```

### Observability & Edge (Task 0.6)

Sentry web diinisialisasi di `apps/web/src/instrumentation*` dan dibungkus lewat `apps/web/next.config.ts` (sourcemap upload mati tanpa `SENTRY_AUTH_TOKEN`). Sentry kiosk diinisialisasi di `apps/desktop/vite.config.ts` + `apps/desktop/src/main.tsx`. Runbook WAF, rate limit, dan Turnstile ada di `infra/cloudflare/README.md`; deploy Vercel di `apps/web/vercel.json` + `apps/web/VERCEL.md`. Semua tanpa DSN berarti SDK inert, jadi build tetap lulus tanpa rahasia. Env yang dipakai sudah ada di `.env.example`: `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `VITE_SENTRY_DSN`, dan `VITE_SENTRY_RELEASE`.

### Batas sengaja

Daftar lengkap batas sengaja Task 0.4 (yang ditunda, alasannya, dan kapan
dikerjakan: browser-direct Storage upload, RLS policy pada tabel aplikasi,
pg_cron job, remote project + env Vercel, policy Realtime channel `booth:{id}`)
ada di satu tempat saja: [docs/PHASE-0.md](./docs/PHASE-0.md) section
"Batas sengaja". Di sana juga tercantum syarat penerimaan Task 0.8 untuk policy
`snapbox_realtime_booth_select`.

## Aturan kerja

Kontribusi mengikuti aturan eksekusi bertahap di PRD Bab 11. Dua aturan yang paling sering
dilanggar dan paling mahal akibatnya:

1. **Isolasi tenant diverifikasi di server.** `session.tenant_id` harus sama dengan
   `resource.tenant_id`. Pelanggaran dibalas 404, bukan 403 (PRD Bab 5.5).
2. **Status pembayaran hanya berubah dari webhook terverifikasi.** Klien kiosk tidak pernah
   memutuskan `PAID` (ADR-002).

Keputusan arsitektur tercatat di [docs/ADR-002-neobrutalism-tokens.md](./docs/ADR-002-neobrutalism-tokens.md). Setiap keputusan visual atau teknis
besar wajib punya alasan tertulis satu baris di sana. ADR-003 mencatat keputusan Firebase sebagai identity provider.
