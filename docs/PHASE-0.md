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
      `ekmas/neobrutalism-components`). 64 berkas `.tsx` di
      `packages/ui/src/components/` (62 komponen referensi, plus barrel
      `index.ts` dan artefak `motion.tsx`).
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
