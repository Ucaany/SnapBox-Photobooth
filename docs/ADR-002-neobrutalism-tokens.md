# ADR-002: Sistem Token dan Komponen Neobrutalism.dev

## Status

Diterima. Menggantikan keputusan design system Task 0.2 di PRD Bab 4.

## Konteks

Task 0.2 di PRD Bab 4 menetapkan design system milik SnapBox sendiri: sembilan
warna semantik berprefix `--color-snapbox-*`, border 3-4px, shadow 6px, dan
tipografi Space Grotesk / Inter / JetBrains Mono. Sebagian fondasi itu sudah
masuk repo sebelum penggantian (alias `--border-snapbox*`, `--shadow-snapbox*`,
`--radius-snapbox`, kelas utility `.nb-*`).

Pemilik proyek kemudian memutuskan mengganti total sistem UI ke
neobrutalism.dev (repo `ekmas/neobrutalism-components`) tanpa terkecuali, dengan
alasan kecepatan: pustaka itu sudah menyediakan 62 komponen jadi dengan konvensi
styling yang konsisten. Keputusan ini disengaja dan diambil pemilik, bukan
kecelakaan implementasi. ADR ini mencatat keputusan, penyimpangan sadar dari
referensi, dan konsekuensinya supaya tidak dikira kelalaian.

## Keputusan

Sistem token, komponen, dan konvensi styling berasal dari neobrutalism.dev.

- **Token SnapBox lama dihapus**: `--color-snapbox-*`, kelas `.nb-*`,
  `--border-snapbox*`, `--shadow-snapbox*`, dan `--radius-snapbox` tidak lagi
  dipakai.
- **Token kanonik sekarang** didefinisikan di blok `:root` dan di-mapping ke
  Tailwind lewat `@theme inline` di `packages/ui/src/styles.css` dan
  `apps/web/src/app/globals.css`: `--main`, `--background`,
  `--secondary-background`, `--foreground`, `--main-foreground`, `--border`,
  `--ring`, `--overlay`, `--shadow`, `--border-radius: 5px`,
  `--spacing-boxShadowX` / `--spacing-boxShadowY`, `--font-weight-base` /
  `--font-weight-heading`, dan `--chart-1`..`--chart-5`.
- **Komponen**: `packages/ui/src/components/` berisi 65 berkas, yaitu 64 berkas
  `.tsx` plus barrel `index.ts` yang bertipe `.ts` (bukan `.tsx`). Dari 64
  berkas `.tsx` itu, 63 adalah komponen referensi neobrutalism.dev dan satu
  berkas (`motion.tsx`) adalah artefak Task 0.3 yang bukan dari referensi, lihat
  bagian penyimpangan. Komponen memakai primitif `@base-ui/react` (36 berkas
  mengimpornya).
- **Galeri**: rute `/` di `apps/web/src/app/page.tsx` menampilkan seluruh
  komponen sebagai bukti visual.

## Penyimpangan yang disengaja

Bagian ini adalah alasan ADR ada. Tiap butir adalah keputusan sadar dengan
konsekuensi yang harus diterima, bukan bug.

### Palet

Palet tetap default biru referensi: `--main: hsl(217, 100%, 66%)` (kira-kira
`#5294ff`), `--background: hsl(214, 95%, 93%)` (kira-kira `#dcebfe`). Bukan
kuning SnapBox `#FFDD00`. Ini keputusan sadar pemilik: kurva belajar nol lebih
diutamakan daripada identitas di tahap ini.

Konsekuensi: galeri terasa seperti salinan referensi, bukan identitas SnapBox.
Ini melanggar semangat R-20/R-30 antislop (anti template generik) kecuali
dibenarkan sebagai galeri internal, yang memang status halaman `/` sekarang
(noindex). Rebranding ke identitas SnapBox memerlukan `DESIGN.md` dan ditunda.

Catatan konsistensi: `apps/web/src/app/layout.tsx` masih memakai
`themeColor: '#FFDD00'`, yang tidak konsisten dengan palet CSS biru dan perlu
diselesaikan (samakan ke biru, atau ganti palet ke kuning). Baris ini WARISAN
Task 0.3, bukan produk penggantian neobrutalism.

### Tipografi

Kode memakai Space Grotesk + Inter + JetBrains Mono, sesuai mandat PRD Bab 4,
bukan DM Sans + Space Mono milik referensi. Token `--font-display`, `--font-sans`,
`--font-mono`, dan `--base-font-family` merujuk variabel yang di-set oleh
`next/font`, dengan nama keluarga literal di slot fallback `var()` agar deklarasi
tetap valid bila variabel tidak terdefinisi (konsumen non-Next seperti kiosk).

### Tap target

Skala ukuran tombol digeser satu langkah dari referensi (default `h-10` menjadi
`h-11`, seterusnya) untuk memenuhi mandat PRD 44x44px. Referensi neobrutalism
mengasumsikan tinggi 40px, jadi ini penyimpangan sadar, bukan kealpaan.
Pseudo-element transparan `before:h-11` memperluas hit-area varian kecil
(`xs`, `sm`, ikon kecil) tanpa mengubah tinggi kotak visual. Lihat komentar di
`packages/ui/src/components/button.tsx`.

### Kontras error

Warna error referensi diganti karena gagal WCAG AA di atas `--background`:

- `text-red-500` menjadi `text-red-700`: 3.15:1 gagal 4.5:1, `red-700` menjadi
  5.31:1.
- `bg-red-500` + `text-white` menjadi `bg-red-700`: 3.82:1 gagal 4.5:1,
  `red-700` menjadi 6.42:1.

Diubah antara lain di `context-menu.tsx`, `field.tsx`, `form.tsx`,
`questionnaire.tsx`, `radio-group.tsx`. Sebagian pemakaian `red-500` untuk
border invalid masih tersisa (`checkbox.tsx`, `input-group.tsx`,
`input-otp.tsx`, `textarea.tsx`); itu border, bukan teks, jadi ambang kontras
teks tidak berlaku dan sengaja tidak diubah.

### Primitif

`@base-ui/react` menggantikan Radix. Radix dihapus dari dependensi
`packages/ui/package.json` dan tidak ada lagi di `package.json` mana pun.

### Impor internal

Impor antar-komponen ditulis relatif (bukan alias `@/`) supaya paket jalan di
`apps/web` (Next) dan `apps/desktop` (Vite) tanpa konfigurasi alias tambahan.
Sekitar 60 berkas memakai impor relatif `from '../`.

### `motion.tsx`

Berkas `packages/ui/src/components/motion.tsx` ada dan diekspor lewat barrel
`index.ts`, tetapi BUKAN dari referensi neobrutalism dan tidak dikonsumsi
komponen lain (hanya dirinya sendiri dan barrel yang menyebutnya). Statusnya
artefak dari Task 0.3. Ini dicatat sebagai pertanyaan terbuka: putuskan
pada saat fitur pertama butuh wrapping motion, jangan dihapus sekarang.

### Variabel `--color-sidebar`

`--color-sidebar` tidak didefinisikan di blok token, jadi `bg-sidebar` tidak
ter-emit oleh Tailwind. `sidebar.tsx` memakai `bg-sidebar` di dua tempat. Sidebar
belum dipakai di web. Ini utang kecil: definisikan variabel bila Sidebar
benar-benar dipasang.

### Instalasi token ganda

Tailwind v4 diam-diam membuang `@theme` bila `@import "tailwindcss"` muncul dua
kali (diuji dengan compiler Tailwind 4.3.3). Karena `packages/ui/src/styles.css`
sendiri sudah meng-import `tailwindcss`, `apps/web/src/app/globals.css` TIDAK
bisa melakukan `@import '@snapbox/ui/styles.css'`: itu akan membuat import ganda
dan membuang seluruh tema kustom (`--color-main`, `--color-foreground`, dst.),
sehingga `bg-main` dan `text-foreground` tidak ter-generate sama sekali tanpa
error. Solusinya: `apps/web/src/app/globals.css` MENYALIN blok token, bukan
mengimpor.

Jangan "merapikan" ini menjadi satu impor kecuali sudah diverifikasi dengan
compiler Tailwind v4 bahwa perilaku ganda-import berubah atau konfigurasi lain
membuatnya aman.

Karena dua file token ini harus tetap identik, perubahan token di
`packages/ui/src/styles.css` WAJIB disalin ulang ke
`apps/web/src/app/globals.css`. Penjaga sinkronisasinya adalah
`npm run check:token-sync` (`scripts/check-token-sync.mjs`), skrip Node tanpa
dependensi yang membandingkan blok `:root`, `@theme inline`, `@layer base`,
`@utility`, dan `@layer components` kedua file dan keluar non-nol bila berbeda.
Jalankan skrip itu setiap kali token berubah, karena `styles.css` sendiri bukan
yang dikompilasi web.

### `tw-animate-css`

`tw-animate-css` wajib di-import di entry point Tailwind setiap konsumen. Animasi
overlay neobrutalism (`animate-in`, `fade-in-0`, `zoom-in-95`,
`slide-in-from-top-1`) berasal dari paket itu, bukan core Tailwind v4. Tanpa
import itu semua animasi overlay (Dialog, Select, Dropdown, Tooltip) jadi no-op
TANPA error apa pun, sehingga mudah terlewat.

## Konsekuensi

Konsumen baru `@snapbox/ui` (web Next maupun kiosk Vite) WAJIB:

1. Mengimpor stylesheet token (`apps/web` menyalin blok; konsumen lain perlu
   mekanisme setara karena alasan import ganda di atas).
2. Mengimpor `tw-animate-css`.
3. Menyediakan tiga variabel CSS font `--font-space-grotesk`, `--font-inter`,
   `--font-jetbrains-mono`, mis. via `next/font`, agar tipografi sesuai mandat.

PRD Bab 4 sekarang usang untuk bagian token, warna, border, dan shadow: sembilan
warna `--color-snapbox-*`, border 3-4px, dan shadow 6px di bab itu tidak lagi
menggambarkan kode. Mandat tipografi (tiga font) dan tap target 44px di bab yang
sama masih berlaku dan tetap dipatuhi.

## Alternatif yang ditolak

- **Mempertahankan token SnapBox dengan struktur komponen referensi.**
  Ditolak: memaksa setiap komponen referensi dipetakan ke token SnapBox berarti
  memelihara lapisan terjemahan di 62 komponen, dan setiap pembaruan referensi
  menjadi porting manual. Biaya pemeliharaan melebihi manfaat identitas pada
  tahap ini.
- **Alias token (`--main: var(--main-snapbox)`).**
  Ditolak: menghasilkan sistem token ganda yang keduanya "benar", dengan satu
  sebagai alias tipis. Ini menyembunyikan token mana yang sebenarnya dipakai dan
  membuat pencarian warna di kode menyesatkan. Menghapus token lama lebih jujur.
- **Menurunkan toolchain root agar cocok dengan versi referensi (zod 4 menjadi 3,
  ESLint 9 menjadi 8).**
  Ditolak: versi referensi lebih rendah daripada yang sudah dipakai repo
  (`zod` 4.6.5, `eslint` 9.39.5). Menurunkan toolchain seluruh monorepo demi satu
  pustaka UI berarti kehilangan perbaikan dan fitur di semua paket lain, dan
  mengunci repo ke belakang. Penyimpangan kecil pada tema dan aksesibilitas lebih
  murah daripada regresi toolchain.
