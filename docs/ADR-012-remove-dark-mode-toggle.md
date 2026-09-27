# ADR-012: Hapus Toggle Dark Mode Sampai Tokennya Ada

## Status

Diterima. Menjawab `AUDIT/11_DECISIONS_REQUIRED.md` D-13.
Tanggal: 2026-09-27.

## Konteks

`ThemeToggle` dan `themeInitScript` menulis `data-theme="dark"` dan
`style.colorScheme = 'dark'`. **`globals.css` tidak memuat satu pun aturan
`[data-theme='dark']`, `.dark`, atau `prefers-color-scheme`** (grep: 0
cocok). Toggle hanya dirender di header CEO; header Owner tidak punya.

## Keputusan

**Hapus toggle.**

1. `ThemeToggle` dihapus dari header CEO.
2. Penulisan `data-theme` dan `style.colorScheme` dihapus dari
   `themeInitScript`. Tanpa ada consumer, menulisnya hanya menambah state
   yang tidak dibaca siapa pun.
3. `themeColor: '#FFDD00'` di root layout diselaraskan dengan palet biru
   (ADR-005). Ini juga menutup F-14, yang masih kontradiktif dengan dashboard
   biru.
4. Token dark mode **tidak** ditulis sekarang. Kalau suatu saat dibutuhkan,
   itu ADR baru: satu token `.dark` yang sejati, bukan toggle yang
   menggantarkan scrollbar.

## Alasan

Toggle yang hanya mengubah warna scrollbar dan kontrol form native adalah
rendering dark **sebagian** — lebih buruk daripada tidak ada, karena
meyakinkan ke pengguna bahwa ada dua tema sementara isinya satu. Dan
biayanya bukan nol: setiap kombinasi warna/estado yang belum diuji akan
salah di tempat yang tidak terlihat di screenshot.

## Konsekuensi

- Menghapus satu kontrol yang tidak berfungsi, dan menutup kontradiksi
  `themeColor`.
- `data-theme` tidak lagi ada di DOM. Kalau tabrakan nama dengan library
  lain pernah muncul, ini merekamnya.
- Dark mode kembali menjadi proposals untuk Fasa 6, dengan token sungguhan.
