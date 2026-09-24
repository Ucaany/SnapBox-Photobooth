# Recap Task 0.3: Font & Layout Primitives

Catatan status Task 0.3 terhadap PRD baris 1968. Dokumen ini melengkapi
`docs/PHASE-0.md` (tidak menggantikannya) dan mencatat keadaan working tree pada
saat commit. Tanda centang berarti deliverable sudah ada di repo.

## Status Task 0.3

PRD baris 1968: _"Load Space Grotesk + Inter + JetBrains Mono. Setup root
layout, theme provider, toast provider, motion wrapper."_

Empat permintaan `Setup ...` dipetakan berikut, ditambah satu mandat font:

| Permintaan PRD (baris 1968) | Berkas konkret                                                             | Status                                  |
| :-------------------------- | :------------------------------------------------------------------------- | :-------------------------------------- |
| Load tiga font              | `apps/web/src/app/layout.tsx` (next/font) + `apps/web/src/app/globals.css` | Ada                                     |
| Setup root layout           | `apps/web/src/app/layout.tsx`                                              | Ada                                     |
| Theme provider              | `apps/web/src/components/theme-provider.tsx`                               | Ada                                     |
| Toast provider              | `packages/ui/src/components/toast.tsx`                                     | Ada, permukaan berubah (lihat bagian 4) |
| Motion wrapper              | `packages/ui/src/components/motion.tsx`                                    | Ada                                     |

Checkbox Task 0.3 di PRD belum dicentang karena PRD milik user.

## Tiga Font

`next/font/google`, `subsets: ['latin']`, `display: 'swap'`, self-hosted (tanpa
request runtime ke Google, relevan untuk CSP kiosk).

| Keluarga       | Bobot       | Variabel next/font (`layout.tsx:18-37`) | Token konsumen (`globals.css:77-79`) |
| :------------- | :---------- | :-------------------------------------- | :----------------------------------- |
| Space Grotesk  | 500/600/700 | `--font-space-grotesk`                  | `--font-display`                     |
| Inter          | 400/500/600 | `--font-inter`                          | `--font-sans`, `--base-font-family`  |
| JetBrains Mono | 400/500     | `--font-jetbrains-mono`                 | `--font-mono`                        |

`--base-font-family` (`globals.css:53`) memakai `var(--font-inter, 'Inter')`
sebagai slot nama literal supaya deklarasi tetap valid di konsumen non-Next.

**Regresi DM Sans (sudah dipulihkan).** Pass migrasi komponen neobrutalism.dev
sempat mengganti ketiga keluarga ini dengan DM Sans. Itu melanggar PRD Bab 4
baris 219-224 (Heading Space Grotesk, Body Inter, Mono JetBrains Mono). Setup
next/font tiga keluarga sudah **dipulihkan**; `grep "DM Sans"` di seluruh repo
tidak menemukan sisa.

## ThemeProvider

`apps/web/src/components/theme-provider.tsx`, **tanpa** `next-themes`.

| Aspek              | Nilai                                                                |
| :----------------- | :------------------------------------------------------------------- |
| Union `Theme`      | `'light' \| 'dark'` (`:15`), tetapi token warna `dark` belum ada     |
| Kunci localStorage | `snapbox-theme` (`THEME_STORAGE_KEY`, `:18`)                         |
| FOWT               | `themeInitScript` (`:42`) blocking di `<head>` sebelum paint pertama |
| Preferensi sistem  | `prefers-color-scheme` dihormati saat `theme === null` (`:103-108`)  |
| Efek `'dark'`      | Hanya `data-theme` + `style.colorScheme`, bukan warna                |
| `ThemeToggle`      | Ada (`theme-toggle.tsx`), **tidak** dipasang di layout akar          |

`themeInitScript` adalah string skrip, bukan komponen React, agar dipasang lewat
`<script dangerouslySetInnerHTML>` tanpa memaksa layout jadi client component.
Provider tidak bisa memikulnya karena provider baru jalan setelah hydration.

## Toast Provider: Permukaan Saat Ini

**Penting.** `packages/ui/src/components/toast.tsx` di working tree **bukan lagi**
toast neobrutalism buatan tangan Task 0.3. Ia sudah digantikan oleh set berbasis
`@base-ui/react/toast` hasil migrasi komponen neobrutalism.dev. Versi buatan
tangan hanya tersisa di commit baseline `1d53d2d`. Keduanya dibedakan di bawah
tanpa menebak.

| Hal              | Lama (baseline `1d53d2d`, diklaim PHASE-0.md Task 0.3)                                     | Saat ini (working tree)                                                                                                                                                                              |
| :--------------- | :----------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Basis            | Buatan tangan, `framer-motion` + `createPortal`, tanpa library toast                       | `@base-ui/react/toast` + `lucide-react`                                                                                                                                                              |
| Ekspor           | `ToastProvider`, `ToastViewport`, `useToast`; tipe `Toast`, `ToastOptions`, `ToastVariant` | `Toaster`, `Toast`, `ToastAction`, `ToastClose`, `ToastContent`, `ToastDescription`, `ToastPortal`, `ToastProvider`, `ToastTitle`, `ToastViewport`, `createToastManager`, `toast`, `useToastManager` |
| Varian           | `default` / `success` / `danger` / `warning`                                               | Tidak ada union varian; ikon per `type`: `success` / `info` / `warning` / `error` / `loading`                                                                                                        |
| Perilaku PRD 234 | `danger` persistent (`duration: 0`), sisanya 3 detik                                       | Tidak dikodekan eksplisit; mengikuti default base-ui (`timeout: 5000`, `limit: 3`)                                                                                                                   |
| Stack cap        | 3                                                                                          | 3 (default base-ui `limit`, `ToastProvider.js:24-25`)                                                                                                                                                |
| Portal / a11y    | Portal ke `document.body`, `role="alert"` untuk danger, reduced-motion aware               | `ToastPortal`/`ToastViewport` base-ui; tidak ada `role="alert"` eksplisit di berkas                                                                                                                  |

Permukaan ekspor saat ini dibaca dari `packages/ui/src/components/index.ts:447-461`
dan `toast.tsx:218-232`. Tidak ada `useToast`, `ToastOptions`, atau `ToastVariant`
lagi; yang tersedia `toast` singleton + `useToastManager` (`toast.tsx:19,215-216`).

Komposisi: `ToastProvider` kini hanya pembungkus `ToastPrimitive.Provider`
(`toast.tsx:21-23`), **tanpa** viewport. Portal + viewport + daftar toast
dirangkai oleh `Toaster` (`toast.tsx:202-213`) dan baru dirender di
`apps/web/src/app/component-gallery.tsx:129`. Layout akar masih membungkus
children dengan `ToastProvider`, jadi rute di luar galeri belum merender viewport.

## Primitif Motion

`packages/ui/src/components/motion.tsx`, semua reduced-motion aware.

| Kategori | Nama                                                                                     |
| :------- | :--------------------------------------------------------------------------------------- |
| Varian   | `fadeIn`, `slideUp`, `staggerContainer`, `staggerItem` (`:21-57`)                        |
| Komponen | `FadeIn` (`:101`), `Stagger` (`:129`), `StaggerItem` (`:157`), `PageTransition` (`:180`) |

`MotionProvider` sengaja **tidak** dibuat (`:201-208`): `useReducedMotion()`
sudah bekerja per-komponen dan framer-motion menonaktifkan animasi saat
`prefers-reduced-motion: reduce`, jadi `MotionConfig` hanya lapisan tanpa nilai.
Widget konkret (marquee, countdown) bukan primitif dan tidak ada di sini.

## Komposisi Root Layout

`apps/web/src/app/layout.tsx` tetap server component.

- `<html lang="id-ID" suppressHydrationWarning>` (`:73-74`) — atribut server dan
  klien memang sengaja berbeda karena skrip tema mengubah `data-theme` sebelum
  hydration.
- Skrip tema blocking di `<head>` (`:82-84`).
- Urutan provider: `ThemeProvider` (luar) → `ToastProvider` (dalam) (`:92-94`).
- `<body className="bg-background font-sans text-foreground antialiased">` (`:85`).

## Keadaan Repo Saat Commit

Working tree jauh lebih besar dari Task 0.3. Perubahan konkuren yang ikut di
commit ini:

- Migrasi komponen neobrutalism.dev memperluas `@snapbox/ui` menjadi 64 berkas
  di `packages/ui/src/components` (termasuk `index.ts`), dengan `@base-ui/react`,
  `@tanstack/react-table`, `embla-carousel-react`, `input-otp`, `recharts`, dll.
- `apps/web/src/app/foundations-gallery.tsx` **dihapus**, digantikan
  `component-gallery.tsx` + `apps/web/src/app/gallery/*`.
- Berkas Task 0.4 (Supabase: `supabase/config.toml` + empat migrasi) dan
  `.env.example`, plus suntingan `docs/PHASE-0.md` dan `README.md`.

Recap ini di-commit bersama seluruh working tree dalam satu commit. Kepemilikan
Task 0.3 terbatas pada font, layout akar, theme provider, primitif motion, dan
toast provider seperti di atas; sebagian toast sudah tergantikan migrasi.

## Verifikasi

| Perintah                           | Hasil                                     |
| :--------------------------------- | :---------------------------------------- |
| `pnpm typecheck`                   | PASS, 5/5 paket                           |
| `pnpm lint`                        | PASS, 5/5 paket (`--max-warnings=0`)      |
| `pnpm --filter @snapbox/web build` | PASS, Next.js 15.5.26, 4/4 halaman statis |
| `grep "DM Sans"` seluruh repo      | Tidak ada sisa                            |

## Batas Sengaja

| Ditunda                                           | Alasan                                            | Dikerjakan di                |
| :------------------------------------------------ | :------------------------------------------------ | :--------------------------- |
| Token warna `dark` (baru union `Theme` yang siap) | Belum ada desain dark web; dark hanya untuk kiosk | Fase 5 (kiosk theme dari DB) |
| Hierarki tenant/booth theme (ADR-005)             | Butuh tabel tenant + server-side theme            | Fase 1/5                     |
| `ThemeToggle` dipasang di UI                      | Belum ada header/dashboard                        | Fase 1                       |
| Widget marquee & countdown kiosk                  | Bukan primitif; milik fitur                       | Fase 5/6                     |
| Toast `promise()` / action button / posisi kustom | YAGNI, belum ada pemanggil                        | saat dibutuhkan              |

---

Tidak ada remote yang dikonfigurasi pada repo ini, jadi commit ini bersifat lokal.
