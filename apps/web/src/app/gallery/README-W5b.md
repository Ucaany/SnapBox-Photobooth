# Kontrak W5b: section Overlay dan Navigasi

Berkas ini milik W5a. Jangan diubah isinya tanpa mencatat alasannya. Isinya
adalah kontrak yang harus dipenuhi agar galeri tetap tersusun rapi.

## Berkas yang harus dibuat W5b

1. `apps/web/src/app/gallery/overlays-section.tsx`
2. `apps/web/src/app/gallery/navigation-section.tsx`

## Ekspor yang harus disediakan

Kedua berkas wajib `'use client'` dan mengekspor komponen tanpa prop:

```tsx
export function OverlaysSection() {
  /* ... */
}
export function NavigationSection() {
  /* ... */
}
```

Komponen boleh merender satu section dengan heading sendiri. Pakai `font-heading
text-xl md:text-2xl` untuk judul dan `text-sm` untuk isi, jangan `text-5xl` atau
lebih. Setiap section diberi `aria-labelledby` ke id headingnya, dan id heading
harus sama dengan nilai `id` pada entri daftar section.

## Cara `component-gallery.tsx` mengimpornya

Di `apps/web/src/app/component-gallery.tsx` sudah ada dua baris import yang
dikomentari:

```tsx
// import { OverlaysSection } from './gallery/overlays-section';
// import { NavigationSection } from './gallery/navigation-section';
```

Di array `SECTION_HANDLES` juga sudah ada dua entri yang dikomentari:

```tsx
// { id: 'overlays', label: 'Overlay', content: <OverlaysSection /> },
// { id: 'navigation', label: 'Navigasi', content: <NavigationSection /> },
```

W5b cukup membuka komentar pada dua import dan dua entri tersebut. Setelah itu
navigasi anchor, penyorotan section aktif (IntersectionObserver), dan footer
otomatis ikut menangani section baru tanpa perubahan lain.

## Aturan yang berlaku untuk section W5b

- R-26: tidak ada kontrol mati. Setiap tombol, tab, accordion, dialog, dan menu
  harus benar-benar berfungsi.
- R-27: sediakan kondisi kosong, memuat, dan galat untuk tampilan data.
- R-32: semua kontrol terjangkau papan tik dan fokus selalu terlihat.
- R-03: grid `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`, tanpa overflow
  horizontal, tap target minimal 44px.
- R-25: kontras teks minimal WCAG AA.
- R-02: dilarang karakter em dash di seluruh teks yang tampil.
- R-15 dan R-16: tanpa label CTA generik dan tanpa kata seperti "seamless",
  "revolutionary", "cutting edge".
- EYEBROW RESTRAINT: galeri sudah memakai sebagai besar kuota label kecil.
  Pakai judul section biasa, jangan tambah label uppercase kecil baru.
- Warna dan token: pakai kelas yang tersedia (`bg-main`, `bg-background`,
  `bg-secondary-background`, `text-foreground`, `border-border`, `shadow-shadow`,
  `rounded-base`, `bg-chart-1..5`). Jangan ubah palet.
