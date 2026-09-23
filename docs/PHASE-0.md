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
| Komponen neobrutalism (Button, Card, Dialog, dst.)     | Berbagi file token warna dengan Tailwind; token butuh halaman nyata untuk diuji.                                                                               | Task 0.2          |
| `prettier-plugin-tailwindcss`                          | Butuh `@import "tailwindcss"` dan daftar class nyata agar urutannya bermakna.                                                                                  | Task 0.2          |
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

### Detail

**Dua aliran migrasi, satu database.** Ada dua direktori migrasi yang menulis ke
Postgres yang sama, dan urutannya bukan preferensi:

| Urutan | Direktori                  | Isi                                                                                                   | Pemilik  |
| :----- | :------------------------- | :---------------------------------------------------------------------------------------------------- | :------- |
| 1      | `supabase/migrations/*`    | Infra: extension (pg_cron/pg_net/pgcrypto), helper RLS schema `app`, bucket Storage, policy Realtime. | Task 0.4 |
| 2      | `packages/db/migrations/*` | Tabel aplikasi + RLS per-tabel.                                                                       | Task 0.8 |

`supabase/migrations` **wajib** lebih dulu: tabel Drizzle memakai tipe/extension
yang diaktifkan di aliran pertama (`pgcrypto` untuk default kolom, helper
`app.current_tenant_id()` untuk policy per-tabel). Menjalankan Drizzle lebih dulu
gagal dengan `extension ... does not exist`.

**Kenapa Task 0.4 tidak membuat tabel.** `packages/db/src/schema.ts` adalah
sumber kebenaran tunggal untuk tabel aplikasi (PRD Bab 10.12). Membuat tabel di
`schema.sql`/`supabase/migrations` akan menciptakan definisi kedua yang menyimpang
diam-diam. Karena itu Task 0.4 hanya menyiapkan rumah (extension, schema, bucket,
naskah Realtime) dan Task 0.8 mengisi tabelnya dari Drizzle.

**Supabase Auth bukan IdP.** Firebase adalah identity provider (PRD Bab 10.3).
Blok `[auth]` ada hanya supaya Realtime bisa menukar token Firebase menjadi JWT
bertanda tangan Supabase (`[auth.third_party.firebase]`) dan supaya
`supabase start` bisa hidup. Registrasi lokal dimatikan (`enable_signup = false`).

**Pooler.** `[db.pooler]` dimatikan karena PgBouncer/Supavisor adalah urusan
platform ter-hosting (PRD Bab 10.4); lokal konek langsung ke port 54322.

### Batas sengaja

| Ditunda                                           | Alasan                                                         | Dikerjakan di                          |
| :------------------------------------------------ | :------------------------------------------------------------- | :------------------------------------- |
| Supabase Auth dipangkas sampai hanya Firebase     | Realtime butuh blok `[auth]` dasar untuk hidup saat ini        | Fase 6                                 |
| pg_cron job (subscription expiry, cleanup)        | Tabel & handler belum ada                                      | Fase 3/6/8                             |
| Browser-direct Storage upload (signed upload URL) | Aplikasi mengunggah lewat server dengan `service_role`         | saat upload besar/desktop dioptimalkan |
| RLS policy pada tabel aplikasi                    | Milik Drizzle, sumber kebenaran di `packages/db/src/schema.ts` | Task 0.8                               |
| Remote project + env Vercel                       | Butuh keputusan akun/organisasi, di luar repo                  | Task 0.9                               |

### Verifikasi

| Perintah / Berkas       | Hasil                                                             |
| :---------------------- | :---------------------------------------------------------------- |
| `supabase/config.toml`  | TOML valid, diparse dengan parser TOML (smol-toml 1.4.2)          |
| `package.json`          | JSON valid (`JSON.parse`), lima skrip `supabase:*` ada            |
| `supabase start`        | belum dijalankan di lingkungan ini (butuh akun Supabase + Docker) |
| `supabase status`       | belum dijalankan (tanpa Docker; bukan bukti kegagalan config)     |
| `supabase/migrations/*` | dibuat task paralel, tidak diverifikasi ulang di sini             |

Checkbox Task 0.4 di PRD (baris 1969) belum dicentang; PRD milik user.
