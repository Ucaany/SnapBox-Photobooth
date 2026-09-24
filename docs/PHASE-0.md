# Fase 0: Fondasi Arsitektur & Infrastruktur

Catatan progres per task. Tanda centang berarti deliverable sudah ada di repo dan
terverifikasi lokal.

## Task 0.1: Repo & Tooling

- [x] Monorepo pnpm workspaces + Turborepo.
- [x] `apps/web` Next.js 15 App Router + React 19.
- [x] `apps/desktop` Tauri v2 (frontend Vite + `src-tauri`).
- [x] `packages/db` skema Drizzle (31 tabel, PRD Bab 10.12).
- [x] `packages/ui` paket komponen bersama.
- [x] `packages/shared` kontrak Zod, event catalog, RBAC.
- [x] TypeScript strict dengan flag tambahan di atas `strict`.
- [x] ESLint 9 flat config, Prettier, Husky pre-commit, commitlint.

### Batas sengaja

| Ditunda                                                | Alasan                                                                                                                                                         | Dikerjakan di     |
| :----------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------- |
| ~~Komponen neobrutalism (Button, Card, Dialog, dst.)~~ | **Selesai Task 0.2**: 62 komponen referensi neobrutalism.dev masuk `packages/ui`; lihat ADR-002.                                                               | Selesai           |
| ~~`prettier-plugin-tailwindcss`~~                      | **Selesai Task 0.2**: plugin aktif di `.prettierrc.json` dengan `tailwindStylesheet` menunjuk `apps/web/src/app/globals.css`.                                  | Selesai           |
| Ikon aplikasi Tauri (isi sesungguhnya)                 | Yang ada sekarang stub kotak `#111111` supaya `tauri::generate_context!` bisa kompilasi. Bukan logo, bukan wordmark: identitas visual belum diputuskan (R-23). | Task 0.2 / Fase 4 |
| Adapter hardware, single-instance lock, secure storage | Butuh crate vendor dan pengujian di perangkat fisik.                                                                                                           | Fase 4            |
| Migrasi SQL yang di-generate                           | Perlu koneksi Supabase; skema sudah siap di `packages/db/src/schema.ts`.                                                                                       | Task 0.8          |
| `turbo.json` task `test`                               | Belum ada test runner yang dipilih di stack PRD.                                                                                                               | Fase 7            |

### Verifikasi

| Perintah                               | Hasil                               |
| :------------------------------------- | :---------------------------------- |
| `pnpm install`                         | OK, lockfile tersimpan              |
| `pnpm typecheck`                       | 5/5 paket PASS                      |
| `pnpm lint`                            | 5/5 paket PASS (`--max-warnings=0`) |
| `pnpm --filter @snapbox/web build`     | PASS, 4 rute (2 statis, 1 dinamis)  |
| `pnpm --filter @snapbox/desktop build` | PASS, Vite 33 modul                 |
| `cargo check --all-targets`            | PASS                                |
| `cargo fmt --check`                    | PASS                                |
| `cargo clippy -- -D warnings`          | PASS                                |

Guardrail ESLint diuji dengan file probe sementara: pelanggaran `node:child_process`,
`any`, dan variabel tak terpakai semuanya tertangkap. File probe sudah dihapus.

## Task 0.2: Design System Neobrutalism

- [x] **Selesai.** Sistem UI diganti total ke neobrutalism.dev (repo
      `ekmas/neobrutalism-components`). Direktori
      `packages/ui/src/components/` berisi 65 berkas total: 64 berkas `.tsx`
      plus barrel `index.ts` yang bertipe `.ts`. Dari 64 berkas `.tsx`, 63
      adalah komponen referensi neobrutalism.dev dan `motion.tsx` adalah artefak
      Task 0.3.
- [x] Token kanonik neobrutalism.dev di `packages/ui/src/styles.css` dan
      `apps/web/src/app/globals.css`: `--main`, `--background`,
      `--secondary-background`, `--foreground`, `--main-foreground`, `--border`,
      `--ring`, `--overlay`, `--shadow`, `--border-radius: 5px`,
      `--spacing-boxShadowX` / `--spacing-boxShadowY`, `--font-weight-base` /
      `--font-weight-heading`, `--chart-1`..`--chart-5`. Token SnapBox lama
      (`--color-snapbox-*`, `.nb-*`, `--border-snapbox*`, `--shadow-snapbox*`,
      `--radius-snapbox`) dihapus.
- [x] Primitive `@base-ui/react` (36 berkas mengimpornya) menggantikan Radix;
      Radix dihapus dari dependensi.
- [x] Galeri komponen di rute `/` (`apps/web/src/app/page.tsx`, noindex) dengan
      tiga bagian di `apps/web/src/app/gallery/`.
- [x] `prettier-plugin-tailwindcss` aktif, `tailwindStylesheet` menunjuk
      `apps/web/src/app/globals.css`.

Keputusan arsitektur, penyimpangan sadar dari referensi, dan konsekuensinya
dokumentasi lengkap di `docs/ADR-002-neobrutalism-tokens.md`. Ringkas: palet
tetap biru default referensi (bukan kuning SnapBox), tipografi tetap tiga font
PRD Bab 4, skala tap target digeser satu langkah untuk 44px, kontras error
dinaikkan ke `red-700`, impor internal relatif, dan `apps/web/globals.css`
menyalin blok token (bukan impor) karena Tailwind v4 membuang `@theme` pada
import `tailwindcss` ganda.

### Batas sengaja

| Ditunda                                                   | Alasan                                                                                                                                                                    | Dikerjakan di                    |
| :-------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------- |
| `--color-sidebar` belum didefinisikan                     | `sidebar.tsx` memakai `bg-sidebar`, tapi variabelnya tidak ada sehingga class itu tidak ter-emit. Sidebar belum dipakai web.                                              | saat Sidebar dipasang di web     |
| `motion.tsx` status belum diputuskan                      | Ada di `packages/ui/src/components/`, bukan dari referensi, tidak dikonsumsi komponen lain. Artefak Task 0.3.                                                             | saat fitur pertama butuh motion  |
| `themeColor: '#FFDD00'` tidak konsisten dengan palet biru | Warisan Task 0.3 di `apps/web/src/app/layout.tsx`; palet CSS sekarang biru.                                                                                               | saat menyamakan identitas visual |
| Palet belum di-rebrand ke identitas SnapBox               | Masih biru referensi; butuh `DESIGN.md` sebelum halaman publik.                                                                                                           | sebelum halaman publik           |
| 7 berkas gagal `prettier --check`                         | Pra-eksisting: 4 di `apps/desktop/src-tauri/gen/**` (generated) + 3 sumber (`packages/db/src/schema.ts`, `packages/shared/src/auth.ts`, `packages/shared/src/domain.ts`). | saat menyentuh berkas itu        |

### Verifikasi

| Pemeriksaan                            | Hasil           |
| :------------------------------------- | :-------------- |
| `pnpm typecheck`                       | PASS, 5/5 paket |
| `pnpm lint`                            | PASS, 5/5 paket |
| `pnpm --filter @snapbox/web build`     | PASS            |
| `pnpm --filter @snapbox/desktop build` | PASS            |
| Kontrol interaktif diuji di galeri     | 208 kontrol     |
| Overlay menutup dengan ESC             | 10/10 overlay   |
| Anchor valid                           | 26/26           |
| Overflow di 5 breakpoint               | 0 overflow      |
| Tap target gagal                       | 126 menjadi 0   |
| Kontras teks                           | semua >= 4.5:1  |
| Em dash di seluruh teks UI             | 0               |
| Buzzword                               | 0               |

Catatan Task 0.2: PRD Bab 4 sekarang usang untuk token, warna, border, dan
shadow (lihat ADR-002). Checkbox Task 0.2 di PRD milik user, belum dicentang.

## Task 0.3: Font & Layout Primitives

- [x] Font Space Grotesk (500/600/700), Inter (400/500/600), JetBrains Mono
      (400/500) via `next/font/google`, self-hosted — **sudah ada dari kerja
      sebelumnya**, dipetakan ke `--font-space-grotesk` / `--font-inter` /
      `--font-jetbrains-mono` di `layout.tsx` dan ke token `--font-display` /
      `--font-sans` / `--font-mono` di `globals.css`.
- [x] `ThemeProvider`, `useTheme`, `themeInitScript` di
      `apps/web/src/components/theme-provider.tsx`, tanpa dependency
      `next-themes`.
- [x] `ThemeToggle` di `apps/web/src/components/theme-toggle.tsx` (belum
      dipasang di layout akar).
- [x] `ToastProvider`, `ToastViewport`, `useToast`, tipe `ToastOptions` /
      `ToastVariant` di `packages/ui/src/components/toast.tsx`, tanpa library
      toast.
- [x] Primitif motion di `packages/ui/src/components/motion.tsx`: varian
      `fadeIn`, `slideUp`, `staggerContainer`, `staggerItem` dan komponen
      `FadeIn`, `Stagger`, `StaggerItem`, `PageTransition`.
- [x] Komposisi layout akar: `ThemeProvider` (luar) → `ToastProvider` (dalam),
      `suppressHydrationWarning` di `<html>`, skrip tema blocking di `<head>`.
- [x] Barrel `packages/ui/src/components/index.ts` diperbarui; `@snapbox/ui`
      mereekspor semuanya.

### Detail

**ThemeProvider.** Tidak memakai `next-themes`. Terdiri dari provider client,
hook `useTheme`, dan `themeInitScript` — string skrip blocking yang dipasang di
`<head>` sebelum paint pertama untuk mencegah kedipan tema terang (FOWT); skrip
tidak bisa lewat provider karena provider baru jalan setelah hydration. Union
`Theme` adalah `'light' | 'dark'`, tetapi token warna `dark` **belum ada** di
`globals.css`: `theme === 'dark'` baru mengganti atribut `data-theme` dan
`colorScheme`, bukan warna. Kunci `localStorage` adalah `snapbox-theme`;
`prefers-color-scheme` dihormati saat user belum memilih (`theme === null`).

**ThemeToggle.** Sudah ada tapi sengaja **tidak** dipasang di layout akar;
tempatnya di header/dashboard pada fase berikutnya. Ikon digambar inline, bukan
`lucide-react`, supaya `apps/web` tidak bergantung pada hoisting pnpm.

**ToastProvider.** Neobrutalism, tanpa dependency library toast. Varian
`default` / `success` / `danger` / `warning`. `danger` persistent (duration 0)
dan memakai `role="alert"`; varian lain auto-dismiss 3 detik (PRD baris 234).
Stack dibatasi 3 toast. Dirender lewat portal ke `document.body` setelah mount,
dengan `AnimatePresence` + `useReducedMotion` dari framer-motion.

**Primitif motion.** `MotionProvider` sengaja **tidak** dibuat — `useReducedMotion()`
sudah bekerja per-komponen dan framer-motion sendiri menonaktifkan animasi saat
`prefers-reduced-motion: reduce`, jadi `MotionConfig` hanya lapisan tanpa nilai.
Seluruh komponen reduced-motion aware. Widget konkret (marquee, countdown) tidak
di sini — milik task fiturnya.

### Batas sengaja

| Ditunda                                           | Alasan                                            | Dikerjakan di                |
| :------------------------------------------------ | :------------------------------------------------ | :--------------------------- |
| Token warna `dark` (baru union `Theme` yang siap) | Belum ada desain dark web; dark hanya untuk kiosk | Fase 5 (kiosk theme dari DB) |
| Hierarki tenant/booth theme (ADR-005)             | Butuh tabel tenant + server-side theme            | Fase 1/5                     |
| `ThemeToggle` dipasang di UI                      | Belum ada header/dashboard                        | Fase 1                       |
| Widget marquee & countdown kiosk                  | Bukan primitif; milik fitur                       | Fase 5/6                     |
| Toast `promise()` / action button / posisi kustom | YAGNI, belum ada pemanggil                        | saat dibutuhkan              |

### Verifikasi

| Perintah                           | Hasil                                                  |
| :--------------------------------- | :----------------------------------------------------- |
| `pnpm typecheck`                   | PASS, 5/5 paket (2 cache hit, 3 eksekusi)              |
| `pnpm lint`                        | PASS, 5/5 paket (`--max-warnings=0`)                   |
| `pnpm --filter @snapbox/web build` | PASS, Next.js 15.5.26, 4 halaman (2 statis, 1 dinamis) |

Task 0.3 selesai. Checkbox Task 0.3 di PRD (baris 1968) belum dicentang karena
PRD bersifat milik user; catatan ini adalah acuan bahwa deliverable-nya sudah
ada dan terverifikasi lokal.

## Task 0.8: Drizzle Base & Migration Harness

- [x] `packages/db` package, Drizzle schema, client, config, migration, dan seed placeholder.
- [x] `packages/db/migrations/0000_smiling_hawkeye.sql`: baseline 31 tabel, enum, index, constraint, dan foreign key dari `src/schema.ts`.
- [x] `packages/db/migrations/0001_rls_and_realtime.sql`: RLS policy tenant/parent/platform dan policy Realtime `booth:{id}`.
- [x] Pooler contract: `DATABASE_URL` untuk runtime Session Pooler; `DIRECT_URL` untuk Drizzle tooling dan seed.
- [x] Seed idempotent tiga plan canonical.

### Verifikasi Task 0.8

| Pemeriksaan                           | Hasil                                               |
| :------------------------------------ | :-------------------------------------------------- |
| `pnpm --filter @snapbox/db generate`  | PASS, 31 tabel terdeteksi dan baseline dibuat       |
| `pnpm --filter @snapbox/db typecheck` | dijalankan setelah perubahan ini                    |
| `pnpm --filter @snapbox/db lint`      | dijalankan setelah perubahan ini                    |
| Supabase local migration + seed       | bergantung Docker/Supabase CLI dan env koneksi      |
| Remote migration                      | belum dijalankan, tidak ada project remote ter-link |

Kueri acceptance policy Realtime:

```sql
select * from pg_policies where policyname = 'snapbox_realtime_booth_select';
```

`supabase/migrations/*` wajib diterapkan sebelum `packages/db/migrations/*` karena
policy RLS memanggil helper schema `app`.

## Task 0.4: Supabase Setup

- [x] `supabase/config.toml`: stack lokal Postgres 15, Storage, Realtime, Inbucket;
      pooler dimatikan untuk lokal; analytics dimatikan.
- [x] `supabase/.gitignore`: hanya state CLI (`.branches`, `.temp`, `.env*`,
      `*.log`) yang diabaikan; `migrations/` tetap dilacak.
- [x] `.gitignore` akar: dua baris state CLI Supabase ditambahkan.
- [x] `package.json` akar: lima skrip `supabase:*`. **Tanpa** dependency
      `supabase` — CLI global/`npx`, bukan paket workspace.
- [x] Empat migrasi infra: `20260101000000_enable_extensions.sql`,
      `20260101000100_rls_foundation.sql`, `20260101000200_storage_buckets.sql`,
      `20260101000300_realtime.sql`.
- [x] README: prasyarat CLI, urutan menjalankan lokal, baris tabel `Perintah`,
      ringkasan konfigurasi, dan tabel batas sengaja.

- [x] Koreksi lanjutan pada migrasi: policy `presence` INSERT ditambahkan agar
      Presence klien berfungsi; grant `USAGE` pada schema `app` ditambahkan di
      samping `EXECUTE`; konvensi baris platform `tenant_id IS NULL` dipersempit
      (tidak lagi fail-open).

### Detail

**Dua aliran migrasi, satu database.** Ada dua direktori migrasi yang menulis ke
Postgres yang sama, dan urutannya bukan preferensi:

| Urutan | Direktori                  | Isi                                                                                                                                               | Pemilik  |
| :----- | :------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------ | :------- |
| 1      | `supabase/migrations/*`    | Infra: helper RLS schema `app` (dipanggil policy per-tabel), bucket Storage, policy Realtime, extension (pg_cron/pg_net prasyarat job terjadwal). | Task 0.4 |
| 2      | `packages/db/migrations/*` | Tabel aplikasi + RLS per-tabel.                                                                                                                   | Task 0.8 |

`supabase/migrations` **wajib** lebih dulu bukan karena tabel Drizzle butuh
extension (skema hanya memakai tipe core: `gen_random_uuid()`, `pgEnum`),
melainkan karena policy RLS per-tabel (Task 0.8) memanggil helper schema `app`.
Menjalankan Drizzle lebih dulu gagal dengan
`function app.current_tenant_id() does not exist`.

**Kenapa Task 0.4 tidak membuat tabel.** `packages/db/src/schema.ts` adalah
sumber kebenaran tunggal untuk tabel aplikasi (PRD Bab 10.12). Membuat tabel di
`schema.sql`/`supabase/migrations` akan menciptakan definisi kedua yang menyimpang
diam-diam. Karena itu Task 0.4 hanya menyiapkan rumah (extension, schema, bucket,
naskah Realtime) dan Task 0.8 mengisi tabelnya dari Drizzle.

**Supabase Auth bukan IdP.** Firebase adalah identity provider (PRD Bab 10.3).
`[auth.third_party.firebase]` membuat Supabase memvalidasi JWT Firebase secara
langsung (tanpa penukaran token) sehingga Realtime bisa mengotorisasi sesi
Firebase; blok `[auth]` dasar ada supaya `supabase start` bisa hidup. Registrasi
lokal dimatikan (`enable_signup = false`). Kontrak klaim Firebase (DRAFT,
diverifikasi Fase 3/6): blocking function WAJIB mengeluarkan DUA klaim sekaligus, yaitu
`role` (agar Supabase memilih role Postgres `authenticated`) dan `app_role` (role
aplikasi CEO/OWNER/STAFF). `role` TIDAK dipakai untuk role aplikasi: Supabase
selalu mengisinya dengan role Postgres sesi, dan `app_metadata.role` tidak
terjangkau untuk token Firebase third-party.

**Pooler.** `[db.pooler]` dimatikan karena PgBouncer/Supavisor adalah urusan
platform ter-hosting (PRD Bab 10.4); lokal konek langsung ke port 54322.

**Serah terima policy booth (Task 0.8).** Penundaan policy Realtime
`booth:{id}` dijaga komentar + `raise notice` di
`supabase/migrations/20260101000300_realtime.sql`, bukan oleh item terlacak.
Supaya reorder atau migrasi ganda tidak diam-diam menghilangkan policy ini,
syarat penerimaan Task 0.8: policy `snapbox_realtime_booth_select` pada
`realtime.messages` WAJIB ada setelah migrasi Drizzle. Buktikan dengan
menempel kueri berikut apa adanya:

```sql
select * from pg_policies where policyname = 'snapbox_realtime_booth_select';
```

### Batas sengaja

| Ditunda                                           | Alasan                                                                                                  | Dikerjakan di                                                                                                 |
| :------------------------------------------------ | :------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------ |
| Supabase Auth dipangkas sampai hanya Firebase     | Realtime butuh blok `[auth]` dasar untuk hidup saat ini                                                 | Fase 6                                                                                                        |
| pg_cron job (subscription expiry, cleanup)        | Tabel & handler belum ada                                                                               | Fase 3/6/8                                                                                                    |
| Browser-direct Storage upload (signed upload URL) | Aplikasi mengunggah lewat server dengan `service_role`                                                  | saat upload besar/desktop dioptimalkan                                                                        |
| RLS policy pada tabel aplikasi                    | Milik Drizzle, sumber kebenaran di `packages/db/src/schema.ts`                                          | Task 0.8                                                                                                      |
| Policy Realtime channel booth:{id}                | Dibuat aliran Drizzle (Task 0.8) karena tabel public.booths belum ada saat supabase/migrations berjalan | Task 0.8; WAJIB diverifikasi: `select * from pg_policies where policyname = 'snapbox_realtime_booth_select';` |
| Remote project + env Vercel                       | Butuh keputusan akun/organisasi, di luar repo                                                           | Task 0.9                                                                                                      |

### Verifikasi

| Perintah / Berkas       | Hasil                                                                       |
| :---------------------- | :-------------------------------------------------------------------------- |
| `supabase/config.toml`  | TOML valid, diparse dengan parser TOML (smol-toml 1.9.0)                    |
| `package.json`          | JSON valid (`JSON.parse`), lima skrip `supabase:*` ada                      |
| `supabase start`        | belum dijalankan di lingkungan ini (butuh akun Supabase + Docker)           |
| `supabase status`       | belum dijalankan (tanpa Docker; bukan bukti kegagalan config)               |
| `supabase/migrations/*` | dibuat task paralel, tidak diverifikasi ulang di sini                       |
| Review kode             | dua putaran review; rincian temuan di deskripsi PR (tidak disimpan di repo) |

Checkbox Task 0.4 di PRD (baris 1969) belum dicentang; PRD milik user.

## Task 0.5: Firebase Setup

- [x] `packages/auth` paket baru: pembungkus `firebase-admin` (server) dan
      `firebase` (browser), dengan empat subpath ekspor (`.`, `./admin`,
      `./client`, `./claims`).
- [x] `packages/auth/src/claims.ts`: kontrak klaim kanonik
      (`firebaseClaimsSchema`, `SUPABASE_POSTGRES_ROLE`, `buildCustomClaims`,
      `toCustomClaims`).
- [x] `packages/shared/src/auth.ts`: `customClaimsSchema` diperluas dengan
      `appRole`; `Session`, `hasPermission`, `canAccessTenant`, dan
      `ROLE_PERMISSIONS` tidak berubah.
- [x] `packages/auth/src/admin.ts`: init Admin SDK lazy dari `FIREBASE_ADMIN_*`
      dengan cache `globalThis`.
- [x] `packages/auth/src/client.ts`: init Client SDK dari
      `NEXT_PUBLIC_FIREBASE_*` lewat akses properti statis.
- [x] `packages/auth/src/index.ts`: barrel yang SENGAJA tidak mereekspor
      `admin`/`client`.
- [x] `packages/auth/README.md`: aturan pemisahan server/klien.
- [x] `scripts/check-claims-sync.mjs` + skrip root `check:claims-sync` yang
      membandingkan nama klaim kedua skema.
- [x] `docs/ADR-003-firebase-auth.md`: keputusan klaim ganda `role`/`app_role`,
      rasional Supabase, dan langkah konsol manual.
- [x] Tanpa variabel env baru: semua var sudah ada di
      `packages/shared/src/env.ts` dan `.env.example` sejak Task 0.1.

### Detail

**Satu klaim untuk Postgres, satu untuk aplikasi.** Klaim `role` WAJIB bernilai
`'authenticated'` karena Supabase selalu menimpanya dengan peran Postgres sesi,
dan `app_metadata.role` tidak terjangkau lewat `[auth.third_party.firebase]`.
Peran aplikasi diletakkan di `app_role`. Wire memakai snake_case
(`app_role`, `tenant_id`, `parent_tenant_id`), tipe aplikasi memakai camelCase
(`appRole`, `tenantId`, `parentTenantId`), dan satu-satunya tempat konversinya
boleh terjadi adalah `toCustomClaims`. `firebaseClaimsSchema` memakai
`z.literal('authenticated')` supaya salah isi gagal saat parse. Rasional penuh
dan alternatif yang ditolak ada di ADR-003, tidak diulang di sini.

**Kontrak di dua tempat yang sengaja.** `packages/auth/src/claims.ts` memegang
skema wire dan invariant; `packages/shared/src/auth.ts` memegang tipe yang
menghadap aplikasi. Invarian yang dijaga keduanya: CEO `tenant_id` dan
`parent_tenant_id` keduanya `null`; OWNER `tenant_id` non-null; STAFF keduanya
non-null. Penjaga `scripts/check-claims-sync.mjs` ada supaya kedua skema tidak
menyimpang diam-diam: ia membandingkan pasangan snake_case (`app_role`,
`tenant_id`, `parent_tenant_id`) dengan kembaran camelCase-nya (`appRole`,
`tenantId`, `parentTenantId`), dan gagal bila salah satu sisi hilang.

**`role` di `Session` sengaja tetap peran aplikasi.** Grep menunjukkan tidak ada
konsumen `CustomClaims` di luar `packages/shared`: hanya `packages/auth` yang
mengimpornya, dan `packages/auth` belum dikonsumsi apa pun. Jadi menambahkan
`appRole` tidak merusak pemanggil, dan `hasPermission`/`canAccessTenant` tetap
membaca `Session.role` sebagai peran aplikasi. `customClaimsSchema` sekarang juga
punya `role: userRoleSchema` di samping `appRole`, supaya objeknya tetap
self-consistent dengan `Session`.

**Akses env statis di `client.ts`.** Next.js hanya meng-inline
`process.env.NEXT_PUBLIC_*` pada akses properti statis; akses dinamis (indeks
variabel atau mengoper seluruh `process.env`) tidak di-inline sehingga nilainya
`undefined` di bundle. Karena itu ketujuh nilai dibaca lebih dulu ke objek
literal, baru di-parse dengan `publicEnvSchema`.

**Kredensial tanpa berkas JSON.** Tiga var `FIREBASE_ADMIN_*` diteruskan ke
`cert({ projectId, clientEmail, privateKey })`. Literal `\n` di
`FIREBASE_ADMIN_PRIVATE_KEY` dinormalisasi dengan `replace(/\\n/g, '\n')` karena
`.env` tidak bisa memuat newline asli. Tidak ada service-account JSON di repo;
langkah membuat key ada di ADR-003. Singleton Admin SDK disimpan di `globalThis`
saat non-production supaya hot reload Next dev tidak membuat app ganda.

**Blocking function ditunda.** Blocking function Firebase (Identity Platform)
wajib mengeluarkan DUA klaim saat token dicetak, tetapi butuh paket Identity
Platform berbayar, jadi penyebarannya ditunda. Bentuk klaim yang wajib
dihasilkan sudah dicatat di ADR-003 supaya implementer berikutnya tidak salah.
Jalur cadangannya klaim dicetak lewat `setCustomUserClaims` saat provisioning.

**Catatan DRAFT Task 0.4.** Kontrak klaim yang masih berstatus DRAFT di section
Task 0.4 (baris 221-226) sekarang diselesaikan oleh ADR-003. Section lama tidak
diubah karena ditulis oleh task lain: teksnya dibiarkan apa adanya, dan ADR-003
yang menjadi acuan.

### Batas sengaja

| Ditunda                                                    | Alasan                                                                                    | Dikerjakan di   |
| :--------------------------------------------------------- | :---------------------------------------------------------------------------------------- | :-------------- |
| Firebase blocking function (Identity Platform)             | Butuh paket berbayar; bentuk klaim sudah dicatat di ADR-003                               | Fase 1/3        |
| Login page, middleware, provisioning staff, undangan staff | Task 0.5 infrastruktur saja; PRD menaruhnya di Fase 1                                     | Fase 1          |
| Revocation refresh token + cek versi klaim                 | Yang ada hanya `setUserDisabled` dan helper tanam klaim; sisanya menunggu kebutuhan nyata | saat dibutuhkan |
| Sentry/Vercel/Cloudflare                                   | Task terpisah                                                                             | Task 0.6        |
| `packages/auth` belum dikonsumsi `apps/web`                | Belum ada fitur auth, jadi dependensi ditambahkan saat Fase 1 membutuhkannya              | Fase 1          |

### Verifikasi

| Perintah                                                                                                                           | Hasil                                                                                                                                                           |
| :--------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install`                                                                                                                     | exit 0; 7 workspace project; `ERR_PNPM_IGNORED_BUILDS` hilang; `unrs-resolver` postinstall jalan                                                                |
| `pnpm install --frozen-lockfile`                                                                                                   | exit 0; lockfile up to date, tidak ada drift                                                                                                                    |
| `pnpm typecheck --force`                                                                                                           | GAGAL: 5/6 paket; `@snapbox/desktop` merah (`Cannot find module '@sentry/react'`, `'@sentry/vite-plugin'`), exit 2 (defect sibling Sentry)                      |
| `pnpm lint --force`                                                                                                                | 6/6 paket lolos dengan `--max-warnings=0`, exit 0                                                                                                               |
| `pnpm --filter @snapbox/web build`                                                                                                 | exit 0; `next build` sukses, 5 rute statis, `withSentryConfig` dari `@sentry/nextjs/config` berjalan (defect sibling sebelumnya sudah diperbaiki sibling)       |
| `node scripts/check-claims-sync.mjs`                                                                                               | OK: 4 klaim sinkron (`role`, `app_role`, `tenant_id`, `parent_tenant_id`), exit 0                                                                               |
| `pnpm check:firebase-project-id`                                                                                                   | OK: project_id konsisten (top-level = firebase = "snapbox"); `NEXT_PUBLIC_FIREBASE_PROJECT_ID` tidak diset, perbandingan env dilewati oleh skrip, exit 0        |
| `pnpm check:token-sync`                                                                                                            | OK: lima token CSS sinkron antara `styles.css` dan `globals.css`, exit 0                                                                                        |
| `pnpm format:check`                                                                                                                | GAGAL: 101 berkas, exit 2; semua pra-eksisting (4 `apps/desktop/src-tauri/gen/**`, 3 sumber Task 0.2, plus berkas sibling Sentry/Vercel), bukan defect Task 0.5 |
| `ls packages/auth/src`                                                                                                             | `admin.ts`, `claims.ts`, `client.ts`, `index.ts`                                                                                                                |
| `npx prettier --check 'packages/auth/**/*.ts' 'packages/auth/**/*.md' docs/ADR-003-firebase-auth.md scripts/check-claims-sync.mjs` | `packages/auth/**`, `scripts/check-claims-sync.mjs` lolos; `docs/ADR-003-firebase-auth.md` gagal (berkas milik task lain, tidak disentuh di sini), exit 1       |

Catatan pra-eksisting: `packages/shared/src/auth.ts` termasuk berkas gagal
`prettier --check` yang sudah terdaftar di Task 0.2, jadi statusnya memang tetap
gagal dan tidak boleh "diperbaiki" dengan memformat ulang.

Checkbox Task 0.5 di PRD (baris 1970) belum dicentang; PRD milik user.

### Catatan verifikasi

Dua blocker Task 0.5 ditemukan dan diperbaiki. Pertama, `pnpm-workspace.yaml` memuat string placeholder `set this to true or false` di `allowBuilds` sehingga `pnpm install` gagal `ERR_PNPM_IGNORED_BUILDS`; kini `'@firebase/util': true` (postinstall telemetri Firebase) dan `protobufjs: false` (postinstall hanya notifikasi funding). Kedua, `packages/auth/src/client.ts` butuh `window` tetapi `packages/auth/tsconfig.json` sengaja hanya `"lib": ["ES2023"]` tanpa DOM.

Perbaikan pertama yang dicoba adalah `/// <reference lib="dom" />` di baris pertama `client.ts`. Pendekatan itu DITOLAK: verifikator membuktikan referensi triple-slash bersifat program-wide, sehingga `lib.dom.d.ts` bocor ke seluruh program paket dan `admin.ts` ikut melihat `window` (probe `const probe = window.location;` pada `admin.ts` keluar 0). Boundary server tidak terjaga, jadi klaim awal bahwa pendekatan ini berhasil dicabut di sini.

Perbaikan final: DOM dipisah ke kompilasi terpisah. `packages/auth/tsconfig.json` tetap `"lib": ["ES2023"]` dengan `"exclude": ["src/client.ts"]`; `packages/auth/tsconfig.client.json` extends konfigurasi itu, menambah `"lib": ["ES2023", "DOM", "DOM.Iterable"]` dan hanya meng-`include` `src/client.ts`. Skrip `typecheck` paket menjalankan `tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.client.json`, sehingga tepat satu kompilasi melihat DOM. Bukti terukur pada kode final: probe `const probe = window.location;` pada `admin.ts` lalu `tsc --noEmit -p packages/auth/tsconfig.json` keluar bukan-nol (`error TS2304: Cannot find name 'window'` di `admin.ts(134,15)`), dan `grep "reference lib" packages/auth/src/client.ts` tidak menemukan apa pun. Guard `typeof window === 'undefined'` tetap ada di `client.ts`. `admin.ts` dipulihkan identik (md5 `3b8bb518d646c079064443f91bcca27c` sebelum dan sesudah probe, 132 baris).

Kegagalan `pnpm typecheck` kini berada di `@snapbox/desktop` (`Cannot find module '@sentry/react'` dan '@sentry/vite-plugin'): sibling menambah dependency itu ke `apps/desktop/package.json` dan kode `src/main.tsx` / `vite.config.ts`, tetapi `pnpm-lock.yaml` belum memuatnya sehingga paket tidak terpasang. Ini defect sibling, bukan Task 0.5. `pnpm --filter @snapbox/web build` kini exit 0 (sibling sudah memperbaiki impor ke `@sentry/nextjs/config`). Kegagalan `pnpm format:check` semuanya pra-eksisting: 4 berkas generated `apps/desktop/src-tauri/gen/**`, 3 berkas sumber yang sudah terdaftar gagal di Task 0.2 (`packages/db/src/schema.ts`, `packages/shared/src/auth.ts`, `packages/shared/src/domain.ts`), ditambah berkas sibling Sentry/Vercel. Tidak ada yang diperbaiki dengan memformat ulang.

## Task 0.6: Sentry + Vercel + Cloudflare

- [x] Sentry web (`@sentry/nextjs@11.0.0`): `apps/web/src/instrumentation-client.ts`
      (client init, DSN-gated, `tracesSampleRate` 0.1 prod / 1 dev, replay hanya
      saat error, `tunnel: '/monitoring-tunnel'`, `onRouterTransitionStart`),
      `apps/web/src/instrumentation.ts` (`register()` impor dinamis per
      `NEXT_RUNTIME`, `onRequestError`), `apps/web/src/sentry.server.config.ts`,
      `apps/web/src/sentry.edge.config.ts`.
- [x] `apps/web/next.config.ts` dibungkus `withSentryConfig` dari
      `@sentry/nextjs/config`; `tunnelRoute`, `widenClientFileUpload`,
      `sourcemaps.disable` tanpa token, `silent`, `telemetry: false`; `org` /
      `project` / `authToken` disebar hanya saat env ada.
- [x] `apps/web/src/app/global-error.tsx` — boundary error level akar,
      `Sentry.captureException` lewat `useEffect`, gaya memakai token yang ada.
- [x] `apps/web/src/app/api/sentry-example/route.ts` — GET yang melempar
      `SnapBox Sentry verification error`, `dynamic = 'force-dynamic'`. SEMENTARA.
- [x] Sentry desktop (`@sentry/react@11.0.0`, `@sentry/vite-plugin@5.4.0` dev):
      `apps/desktop/src/main.tsx` init sebelum `createRoot` (gated
      `VITE_SENTRY_DSN`, `release` dari `VITE_SENTRY_RELEASE`, `environment`
      `MODE`), `apps/desktop/vite.config.ts` (`sourcemap: 'hidden'` di prod,
      plugin gated token, `define` rilis), `apps/desktop/src/vite-env.d.ts` baru.
- [x] Cloudflare draft di `infra/cloudflare/`: `README.md` (runbook),
      `rate-limit-rules.json` (8 rule), `waf-custom-rules.json` (managed + 4
      custom), `turnstile-widget.json`, `workers/rate-limit-counter.md` (draft).
- [x] `apps/web/vercel.json` (hanya kunci schema-valid) dan `apps/web/VERCEL.md`.
- [x] `scripts/check-infra-drafts.mjs` + skrip `check:infra-drafts`, di-wire ke CI
      dan lint-staged.
- [x] Wiring: `engines.node` naik ke `>=22.12.0`, `turbo.json` `globalEnv`
      diperluas, `pnpm-workspace.yaml` `allowBuilds`/`minimumReleaseAgeExclude`,
      `.gitignore` `.env.sentry-build-plugin` + `.vercel`.
- [x] Tanpa env var baru: `NEXT_PUBLIC_SENTRY_DSN` dipakai ulang untuk
      client + server + edge web.

### Detail

**Kenapa DSN-gate.** Tanpa `NEXT_PUBLIC_SENTRY_DSN` (web) atau `VITE_SENTRY_DSN`
(desktop), `Sentry.init` tidak dipanggil sama sekali sehingga SDK inert: tidak ada
request keluar, tidak ada noise console, tidak ada ingest. Konsekuensinya
`next build` dan `vite build` WAJIB lulus di CI/PR yang tidak punya rahasia. Ini
bukan optimasi, melainkan syarat agar pipeline build tidak bergantung pada akun.

**Kenapa upload source map mati tanpa token.** `sourcemaps: { disable: !SENTRY_AUTH_TOKEN }`
(web) dan plugin yang hanya dipasang bila token ada (desktop) memastikan build
tidak pernah GAGAL karena token hilang. Yang hilang hanya stack trace tak
minified; build lokal tanpa `.env` tetap sukses. Build ber-token tetap mengunggah.

**Rencana v10 vs realita v11.** Dua penyimpangan API dari rencana awal, keduanya
karena paket yang benar-benar terpasang adalah v11: (1) `withSentryConfig` hidup
di subpath `@sentry/nextjs/config`, bukan ekspor akar — v11 tidak punya ekspor
akar untuk fungsi ini, sehingga `import { withSentryConfig } from '@sentry/nextjs'`
gagal `TypeError: withSentryConfig is not a function`; (2) `sendDefaultPii`
DIHAPUS di v11 dan digantikan `dataCollection`. Gerbang PII (PRD Bab 8.7) karena
itu memakai `dataCollection: { userInfo: false, cookies: false, httpHeaders:
false, httpBodies: [], urlQueryParams: true }` — padanan terdekat `sendDefaultPii: false`.

**Kenapa `tunnelRoute`.** Event client dikirim lewat origin sendiri
(`/monitoring-tunnel`) supaya adblocker tidak memblokir request ke ingest Sentry.
Route ini harus dikecualikan dari `robots.txt` (Task 1.1) agar tidak diindeks, dan
sudah masuk skip rule Cloudflare (`waf-custom-rules.json`) supaya tidak kena
challenge/rate limit. `tunnel` hanya opsi client; config server/edge sengaja tidak
memakainya.

**Kenapa namespace `VITE_*` di desktop.** Vite hanya meng-inline prefix `VITE_`,
bukan `NEXT_PUBLIC_*`. Karena web dan desktop berbagi `.env.example`, kiosk
memakai `VITE_SENTRY_DSN` / `VITE_SENTRY_RELEASE` sendiri. `apps/desktop/src/vite-env.d.ts`
baru men-declare keduanya supaya `tsc --noEmit` mengenalnya tanpa `as string`.

**Kenapa `engines.node` dinaikkan.** Sentry 11.0.0 mensyaratkan Node `>=22.12.0`
pada jalur 22 (bukan `>=22.0.0`), jadi lantai versi dinaikkan agar install tidak
gagal di Node 22 lama.

**Kenapa `define` untuk release id.** Vite config menyematkan
`import.meta.env.VITE_SENTRY_RELEASE` dari nilai `release` yang sama dengan yang
dipakai plugin upload source map. Bundle client harus membawa release id yang
cocok dengan source map yang diunggah; tanpa `define`, `VITE_SENTRY_RELEASE`
hanya terisi bila variabelnya ada di `.env`, dan source map yang terunggah tidak
akan pernah ketemu dengan event-nya.

Section ini menggantikan baris "Sentry/Vercel/Cloudflare | Task terpisah | Task
0.6" yang dicatat Task 0.5.

### Batas sengaja

| Ditunda                                                       | Alasan                                                                 | Dikerjakan di                                 |
| :------------------------------------------------------------ | :--------------------------------------------------------------------- | :-------------------------------------------- |
| Capture panic Rust/Tauri                                      | Butuh crate `sentry` dan pengujian di perangkat fisik.                 | Fase 4/7                                      |
| Workers KV counter + rate limit per device                    | Draft desain saja; butuh Worker nyata yang menyuntik header identitas. | Task 7.1                                      |
| Provisioning env Vercel/Cloudflare/GitHub                     | Butuh akun dan keputusan organisasi.                                   | Task 0.9                                      |
| Apply WAF/Turnstile/DNS nyata                                 | Butuh zone + token; semua berkas masih DRAFT review-only.              | manual (runbook `infra/cloudflare/README.md`) |
| `robots.txt` exclusion untuk `/monitoring-tunnel`             | Milik task robots.txt.                                                 | Task 1.1                                      |
| `test` di `turbo.json`                                        | Belum ada test runner yang dipilih.                                    | Fase 7                                        |
| Sentry desktop tanpa error boundary/`onRouterTransitionStart` | API itu Next-only; React kiosk belum punya boundary sendiri.           | saat dibutuhkan                               |

`/api/sentry-example` sengaja ditambahkan sebagai bukti Fase 0; route ini HARUS
dihapus atau di-gate di akhir Fase 0 (lihat juga skip rule WAF dan daftar
pengecualian Turnstile yang menyebutnya sebagai sementara). Capture panic
Rust/Tauri ditunda: frontend kiosk sudah terhubung ke Sentry, tapi `src-tauri`
belum.

### Verifikasi

| Perintah / Berkas                                                            | Hasil                                                                                                                                                      |
| :--------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node --version`                                                             | `v24.19.0` (memenuhi `>=22.12.0`)                                                                                                                          |
| `pnpm install`                                                               | PASS setelah `pnpm install --force`; lockfile menyimpan `@sentry/nextjs@11.0.0`, `@sentry/react@11.0.0`, `@sentry/vite-plugin@5.4.0`, `@sentry/cli@2.58.6` |
| `pnpm typecheck`                                                             | PASS 6/6 paket (turbo cache-hit; lihat catatan di bawah)                                                                                                   |
| `pnpm lint`                                                                  | PASS 6/6 paket (`--max-warnings=0`) (turbo cache-hit; lihat catatan di bawah)                                                                              |
| `pnpm --filter @snapbox/web build`                                           | PASS tanpa DSN/token (SDK inert); rute `/`, `/_not-found`, `/api/health`, `/api/sentry-example`, `/icon.svg` terbentuk                                     |
| `pnpm --filter @snapbox/desktop build`                                       | PASS, 4897 modul, `sourcemap: hidden` di prod                                                                                                              |
| `node scripts/check-infra-drafts.mjs`                                        | exit 0, `OK: draft Cloudflare lengkap...`                                                                                                                  |
| `pnpm check:token-sync`                                                      | PASS                                                                                                                                                       |
| `pnpm check:claims-sync`                                                     | PASS                                                                                                                                                       |
| `apps/web/.next/routes-manifest.json`                                        | berisi rewrite `/monitoring-tunnel` -> `o*.ingest.sentry.io` (tunnel aktif)                                                                                |
| `apps/web/src/app/api/health/route.ts`                                       | tidak berubah (bukan bagian Task 0.6)                                                                                                                      |
| `packages/shared/src/env.ts`                                                 | tidak berubah; tidak ada env var baru                                                                                                                      |
| Deploy Vercel + galeri `/` render                                            | belum dijalankan di lingkungan ini (butuh akun)                                                                                                            |
| `/api/sentry-example` event + source map resolve                             | belum dijalankan di lingkungan ini (butuh akun Sentry)                                                                                                     |
| Apply Cloudflare drafts                                                      | belum dijalankan di lingkungan ini (butuh zone + token)                                                                                                    |
| Terbitkan key Turnstile                                                      | belum dijalankan di lingkungan ini (butuh akun Cloudflare)                                                                                                 |
| `infra/cloudflare/{rate-limit-rules,waf-custom-rules,turnstile-widget}.json` | JSON valid (diparse di sini)                                                                                                                               |
| `apps/web/vercel.json`                                                       | JSON valid, hanya kunci `framework` + `regions`                                                                                                            |

Catatan verifikasi dingin: `pnpm typecheck`/`pnpm lint` untuk `@snapbox/web`
adalah turbo cache-hit; jalankan `pnpm turbo run typecheck lint --force` untuk
verifikasi dingin.

Catatan anomali cache pnpm: `pnpm install` pertama melaporkan "Already up to
date" padahal lockfile belum memuat `@sentry/vite-plugin`/`@sentry/cli`;
`pnpm install --force` memperbaikinya. Ini anomali cache pnpm, bukan kesalahan
manifes.

Catatan pra-eksisting: kegagalan `prettier --check` tetap sama seperti Task 0.5 —
4 berkas generated `apps/desktop/src-tauri/gen/**`, 3 berkas sumber yang sudah
terdaftar gagal di Task 0.2, plus berkas sibling. Tidak ada yang diformat ulang.

Checkbox Task 0.6 di PRD belum dicentang; PRD milik user.

## Task 0.7: CI/CD Skeleton

- [x] `tests/smoke.test.mjs`, smoke test dependency-free memakai `node:test` +
      `node:assert/strict`, 5 tes invarian repo (script workspace wajib di
      `package.json`, repo privat + `engines.node >=22.12.0`, glob `apps/*` +
      `packages/*` di `pnpm-workspace.yaml`, `bundle.targets` Tauri tepat `nsis` +
      `deb`, `beforeBuildCommand` Tauri).
- [x] Skrip root `test` di `package.json` menjadi `node --test` (kontrak CI).
      Tanpa dependency baru; tanpa skrip `test` per paket (itu Fase 7).
      `turbo.json` task `test` sengaja tetap ada.
- [x] `.github/workflows/ci.yml` diperluas: job `verify` kini menjalankan `Lint`,
      `Token sync guard`, `Claims sync guard`, `Infra drafts guard`, `Typecheck`,
      `Test` (`pnpm test`), `Build` (`pnpm build`, env `CI: 'true'`),
      `Format check`, tiap tahap bernama sehingga tampil independen di GitHub
      Checks. Job `rust` dipertahankan apa adanya. Job baru `preview` (khusus PR).
- [x] `.github/workflows/tauri.yml` baru: dipicu `workflow_dispatch` (input `ref`
      opsional) dan `push` tag `v*`; matriks `windows-latest`/`nsis` dan
      `ubuntu-latest`/`deb`; upload artefak installer tiap run sukses; job
      `release` (hanya tag `v*`, `contents: write`) membuat GitHub Release draft
      dan melampirkan installer.

### Detail

**Mengapa smoke test native.** Repo belum punya test runner. `node:test` bawaan
Node membuktikan wiring/invarian CI tanpa memilih framework Fase 7 secara
prematur. Tes sengaja stabil: hanya membaca manifes dan konfigurasi, tanpa
jaringan, kredensial, browser, atau Rust.

**Build di CI tanpa rahasia.** Sentry SDK bersifat DSN-gated (Task 0.6), jadi
`next build`/`vite build` lulus tanpa secret; hanya `SENTRY_AUTH_TOKEN` yang
diprobe dan ketiadaannya turun menjadi peringatan (bukan error). Karena itu job
`verify` tidak memuat secret apa pun; langkah Build hanya menyetel env inert
`CI: 'true'`.

**Preview PR-only, tidak pernah fork.** Job `preview` bergantung pada `verify`
dan dijaga
`if: github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository`,
sehingga PR dari fork tidak dapat menjalankan kode dengan secret repo. Tiga
secret `VERCEL_TOKEN`/`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` hanya dipetakan pada
langkah `Deploy preview` (bukan level job), sehingga langkah install tidak
menerimanya. Tiap langkah deploy dijaga `if: ${{ secrets.VERCEL_TOKEN != '' }}`.
Bila secret tidak ada, job menulis catatan "dilewati" ke summary, bukan gagal.
Deploy memakai `pnpm dlx vercel@48` dari `working-directory: apps/web` sehingga lockfile
tidak berubah. Token tidak pernah di-echo.

**Tauri hanya saat diminta.** Workflow Tauri tidak pernah jalan tiap PR:
pemicunya hanya dispatch manual atau tag `v*`. Matriks membangun installer NSIS
(Windows) dan `.deb` (Ubuntu); jalur bundle berasal dari `bundle.targets` di
`tauri.conf.json` (satu sumber kebenaran), sementara flag
`--bundles ${{ matrix.target }}` memilih target matriks. Cache Cargo memakai
`Swatinem/rust-cache` dengan `workspaces: apps/desktop/src-tauri`. Hanya job
`release` yang memegang `contents: write`; job `build` hanya `contents: read`.

**Least privilege + konkurensi.** `preview` memakai `contents: read` +
`pull-requests: write`; blok `concurrency` (`ci-${{ github.ref }}`,
cancel-in-progress) dan env telemetri lama dipertahankan.

### Batas sengaja

| Ditunda                                                                   | Alasan                                                     | Dikerjakan di                              |
| :------------------------------------------------------------------------ | :--------------------------------------------------------- | :----------------------------------------- |
| Signing/notarization installer + metadata auto-update                     | Butuh sertifikat & secret yang belum diputuskan            | Task 8.3 (disebut di komentar `tauri.yml`) |
| Cakupan fitur/unit/integrasi/E2E                                          | Smoke test hanya membuktikan wiring, bukan perilaku bisnis | Fase 7                                     |
| Akun/secret Vercel (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`) | Provisioning butuh akun & keputusan organisasi             | Task 0.9                                   |
| Fitur matrix Tauri lebih banyak (mis. arm64)                              | YAGNI sampai ada permintaan                                | saat dibutuhkan                            |

### Verifikasi

| Perintah                                                                   | Hasil                                                                                                                            |
| :------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test`                                                                | PASS, 5/5 tes (`node --test`)                                                                                                    |
| `node -e "const p=require('./package.json'); console.log(p.scripts.test)"` | `node --test`                                                                                                                    |
| `CI=true pnpm build`                                                       | PASS pada tree bersih tanpa secret (`2 successful, 2 total`); peringatan `No auth token provided` dari Sentry bersifat non-fatal |
| `pnpm --filter @snapbox/web build` (CI=true)                               | PASS                                                                                                                             |
| YAML `.github/workflows/ci.yml`                                            | diparse dengan PyYAML 6.0.3; jobs `verify`, `rust`, `preview`                                                                    |
| YAML `.github/workflows/tauri.yml`                                         | diparse dengan PyYAML 6.0.3; jobs `build` (matriks nsis/deb), `release`                                                          |
| `prettier --check` berkas tersentuh                                        | PASS (`ci.yml`, `tauri.yml`, `tests/smoke.test.mjs`, `package.json`)                                                             |
| Guard fork PR `preview`                                                    | `head.repo.full_name == github.repository`; tidak ada `pull_request_target`; token tidak pernah di-echo                          |
| Rilis Tauri                                                                | dijaga `startsWith(github.ref, 'refs/tags/v')`; hanya job `release` yang `contents: write`                                       |

Catatan: `pnpm build` lokal terpantau non-deterministik pada tree kotor/paralel
(error `ENOENT rename …/apps/web/.next/export/500.html`), tetapi selalu lulus
pada tree bersih dan pada `pnpm --filter @snapbox/web build`; runner CI selalu
checkout bersih sehingga risiko rendah. Bukan blocker, dicatat sebagai catatan
operasional. `pnpm build`/`pnpm --filter @snapbox/web build` mengakses
`next/font/google`; kegagalan jaringan sesaat bisa menggagalkan build web (di
luar cakupan task ini).

Checkbox Task 0.7 di PRD belum dicentang; PRD milik user.

## Task 0.9: Env Vault & Secret Strategy

Inventaris env kanonik, runbook rahasia, dokumentasi Vercel, dan guard otomatis
supaya `.env.example` tetap sinkron dengan kebijakan tanpa pernah menyentuh nilai
rahasia.

- [x] `.env.example` ditulis ulang sebagai inventaris kanonik: 33 variabel, satu
      assignment per nama, dikelompokkan `PUBLIC`, `SERVER_ONLY`, `ENCRYPTION`,
      `THIRD_PARTY`, `CLOUDFLARE`, `LINKS`, `DESKTOP`. Placeholder yang menyerupai
      kredensial diganti nilai jelas-palsu `replace-me-...`; bentuk `eyJhbGciOi`
      dan `AIzaSy` dihapus; `FIREBASE_ADMIN_PRIVATE_KEY` dipertahankan sebagai PEM
      berkutip dengan `\n` ter-escape yang kompatibel dengan loader
      `packages/auth/src/admin.ts`. Komentar per grup mencantumkan sumber, scope
      environment (`development`/`preview`/`production`), dan generator
      (`openssl rand -base64 32` untuk kunci enkripsi).
- [x] `docs/ENVIRONMENT-AND-SECRETS.md` dibuat sebagai runbook: model trust
      boundary, pemetaan env Vercel (rootDirectory `apps/web`, Build vs Runtime),
      minimum secret GitHub Actions (`VERCEL_TOKEN`, `VERCEL_ORG_ID`,
      `VERCEL_PROJECT_ID`, hanya job preview, PR fork tidak pernah menerima
      secret), secret store Supabase Edge Function (`supabase secrets set/list`,
      tanpa secret di `supabase/config.toml`, tanpa Edge Function palsu), prosedur
      lokal (`.env.example` -> `.env.local`), rotasi per kelas (third-party
      kuartalan, kompromi segera, token Vercel/GitHub, penggantian Firebase Admin
      key, penggantian service-role Supabase, overlap/revokasi signing key,
      `ENCRYPTION_MASTER_KEY` migrasi terkoordinasi dengan dual-read
      terdokumentasi tetapi implementasi ditunda ke fitur enkripsi), incident
      response, checklist penerimaan, dan perintah verifikasi anti-bocor.
- [x] `apps/web/VERCEL.md` diperbarui: inventaris env lengkap dalam 4 kategori
      (A public browser, B server runtime, C build-only, D optional tooling),
      masing-masing dengan kolom Environment/Scope/Secret; catatan bahwa nilai
      di-provision operator (bukan nilai mentah CI), `SENTRY_AUTH_TOKEN`
      build-only, pembedaan public vs secret, dan pointer ke runbook baru.
- [x] Guard `scripts/check-env-example.mjs`: memeriksa `.env.example` ada, setiap
      nama wajib punya tepat satu assignment, tidak ada duplikat, tidak ada pola
      literal berbentuk kredensial terlarang, dan bentuk placeholder PEM; skrip
      `check:env-example` ditambahkan ke `package.json` root; langkah
      `Env example guard` ditambahkan ke job `verify` di
      `.github/workflows/ci.yml`. Guard hanya membaca `.env.example`; tidak pernah
      membaca/mencetak `.env`, secret, atau nilai runtime.

### Detail

**Inventaris kanonik.** `.env.example` adalah satu-satunya sumber kebenaran nama
env; schema env tidak berubah dan tidak ada variabel baru — jumlah tetap 33, jadi
konsumen yang sudah ada tidak terpengaruh.

**Batas guard hanya nama.** Guard memvalidasi keberadaan, keunikan, dan bentuk
nama/pola, bukan nilai. Pesan kegagalan menyebut nama atau nomor baris + label
pola, tidak pernah mencetak nilai, sehingga aman dijalankan di CI publik.

**Rotasi kunci enkripsi = migrasi terkoordinasi.** Mengganti
`ENCRYPTION_MASTER_KEY` berarti ciphertext lama masih terikat kunci sebelumnya;
karena itu rotasi butuh dual-read/versioned ciphertext, yang didokumentasikan di
runbook tetapi diimplementasikan bersama fitur enkripsi sebelum rotasi produksi
pertama.

### Batas sengaja

| Ditunda                                                     | Alasan                                                        | Dikerjakan di                                 |
| :---------------------------------------------------------- | :------------------------------------------------------------ | :-------------------------------------------- |
| Provisioning akun/secret nyata (Vercel env, GitHub secrets) | Butuh akun & keputusan organisasi                             | manual / operator                             |
| Eksekusi CLI provider yang butuh kredensial                 | Tidak ada akun di repo; perintah tidak dieksekusi             | manual / operator                             |
| Supabase Edge Function                                      | Belum ada Edge Function, jadi tidak ada secret/migrasi palsu  | saat fitur Edge Function ditambahkan          |
| Dual-read/versioned ciphertext kunci enkripsi               | Rotasi harus terkoordinasi; implementasi milik fitur enkripsi | fitur enkripsi (sebelum rotasi produksi 1)    |
| Secret signing/notarization Tauri                           | Butuh sertifikat & keputusan release                          | Task 8.3                                      |
| Penerapan WAF/Turnstile/DNS                                 | Butuh akses akun Cloudflare                                   | manual (runbook `infra/cloudflare/README.md`) |

### Verifikasi

| Perintah                                                                                                                                      | Hasil                                                                                                                                                      |
| :-------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node scripts/check-env-example.mjs`                                                                                                          | exit 0, `OK: inventory .env.example lengkap (33 nama, tanpa duplikat, tanpa placeholder menyerupai kredensial).`                                           |
| Failure mode guard (via `node -e` sekali pakai)                                                                                               | nama hilang dilaporkan per nama, duplikat per nama, pola terlarang per nomor baris + label pola tanpa mencetak nilai; placeholder PEM berkutip valid lulus |
| `.env.example`                                                                                                                                | 33/33 nama wajib, tepat satu assignment masing-masing, 0 duplikat, 0 kecocokan `eyJhbGciOi` / `AIzaSy`                                                     |
| `package.json`                                                                                                                                | JSON valid; script `check:env-example` ada                                                                                                                 |
| `.github/workflows/ci.yml`                                                                                                                    | memuat langkah `Env example guard`                                                                                                                         |
| `npx prettier --check scripts/check-env-example.mjs package.json .github/workflows/ci.yml docs/ENVIRONMENT-AND-SECRETS.md apps/web/VERCEL.md` | PASS (setelah formatting)                                                                                                                                  |

Item MANUAL / OPERATOR tidak dieksekusi (tidak ada akun): provisioning env Vercel,
provisioning secret GitHub, link/secrets Supabase remote, satu deployment preview,
dan perintah CLI provider.

**Batas jujur.** Tidak ada akun nyata di repo; provisioning dan perintah CLI yang
butuh kredensial TIDAK dieksekusi. `docs/ENVIRONMENT-AND-SECRETS.md` murni
runbook/dokumentasi. Implementasi dual-read kunci enkripsi didokumentasikan, bukan
diimplementasikan (milik fitur enkripsi sebelum rotasi produksi pertama). Secret
code-signing/notarization Tauri di luar cakupan (Task 8.3). Tidak ada Supabase
Edge Function, jadi tidak ada secret/migrasi palsu yang dibuat.

Checkbox Task 0.9 di PRD belum dicentang; PRD milik user.
