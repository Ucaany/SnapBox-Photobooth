# ADR-013: Gate `/gallery` di Luar Development

## Status

Diterima. Menjawab `AUDIT/11_DECISIONS_REQUIRED.md` D-15.
Tanggal: 2026-09-27. Dieksekusi lebih dulu dari ADR-011.

## Konteks

`app/gallery/` adalah katalog design system internal, sekitar 4.200 baris.
Route ini **tidak ada di matcher middleware**, jadi tidak punya auth dan tidak
punya pemeriksaan peran. `robots.ts` dan `noindex` bersifat advisory
terhadap crawler, **bukan** access control.

Route ini **tidak tertaut** — 3 hit grep, semuanya komentar — sehingga
pengunjung anonim mana pun yang mengetik `/gallery` mendapatinya, termasuk
20 nama tenantdummy dan chunk berat (`@tanstack/react-table`,
`react-day-picker`, `recharts`, `react-hook-form`, `zod`) yang disajikan
sebagai unduhan publik.

## Bukti runtime (2026-09-27)

```
GET /gallery  ->  200, 293.646 byte, anonim
grep token=|X-Amz-Signature  ->  0   (tidak ada kebocoran signed URL)
```

Soal kebocoran signed URL, `/gallery` **bersih** — dan itu harus dicatat,
karena itu bagian yang benar. Masalahnya ada di tempat lain: dari 40 route
yang diaudit, **`/gallery` adalah yang terburuk**, dan satu-satunya dengan
pelanggaran **critical**:

```
aria-allowed-attr[critical]        aria-required-children[critical] x2
button-name[critical]              label[critical]
aria-prohibited-attr[serious]       scrollable-region-focusable[serious] x2
color-contrast[serious] x2          empty-table-header[minor]
landmark-main-is-top-level / landmark-no-duplicate-main / landmark-unique
```

Empat aturan critical di satu rute publik anonim, sementara `/`, `/harga`,
`/kamera`, `/kontak`, `/unduh-aplikasi`, `/login`, `/unauthorized`, dan
`/docs/troubleshooting` semuanya **CLEAN**.

## Keputusan

1. `app/gallery/page.tsx` memanggil `notFound()` kecuali
   `NODE_ENV === 'development'`. Katalog tetap hidup untuk pengembangan.
2. Terapkan juga ke sub-halaman `/gallery/*` bila ada.
3. Rute ini **dihapus dari sitemap** dan dari `robots.txt` allowlist. Ia
   sudah tidak ada di navigasi; ini membuat mesin pencari tidak wasting
   crawl di 404.
4. **Tidak dihapus** —primitive di `packages/ui` yang menyertainya masih
   dipakai (lihat ADR-011).
5. Perkecil `/gallery` di luar development **bukan** hanya `noindex`.

## Konsekuensi

- Menutup 4 pelanggaran a11y critical yang dapat dijangkau anonim.
- Menghentikan sekitar 400 KB gzip chart code yang dikirim ke pengunjung
  anonim pada rute yang tidak pernah ditautkan.
- Gate bersifat **bolak-balik** — hanya satu kondisi di satu berkas. Menghapus
  katalog adalah keputusan yang lebih besar dan tidak dibenarkan sekarang.
- 41 dari 64 primitive kehilangan alasan keberadaannya yang tercatat. Konsekuensi
  itu dihitung di ADR-011, bukan alasan menunda gate ini.
