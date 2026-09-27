import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { ComponentGallery } from './component-gallery';

/**
 * Galeri komponen neobrutalism `@snapbox/ui` — katalog internal.
 *
 * KEPUTUSAN D-15: `/gallery` hanya hidup di luar produksi. Di setiap lingkungan
 * lain route ini memanggil `notFound()`, jadi aplikasi sendiri yang menolak —
 * bukan crawler, bukan header, bukan middleware.
 *
 * Kenapa `notFound()` dan bukan auth. Galeri tidak punya data[PII] dan tidak
 * perlu sesi; yang tidak boleh terjadi adalah penyajiannya ke anonim di
 * produksi. `notFound()` menutupnya tanpa perlu auth, tanpa menambah round-trip,
 * dan tanpa memindahkan katalog ke tempat lain. Preview dan test ikut tertutup,
 * karena keduanya bukan `development`.
 *
 * Kenapa TIDAK di middleware. Matcher `middleware.ts` hanya memuat route privat
 * yang butuh pemeriksaan peran. Menaruh `/gallery` di sana akan menambah
 * invokasi Edge untuk sesuatu yang putuskannya satu baris, dan lebih buruk:
 * apa pun yang lolos dari matcher (path variant, rewrite) akan lolos dari gate
 * juga. Gate di route tidak punya celah itu.
 *
 * CATATAN PENTING — `robots: { index: false }` di bawah BUKAN kontrol akses.
 * `robots.txt` dan `noindex` hanya permintaan sopan kepada crawler yang patuh;
 * keduanya diabaikan oleh klien mana pun yang tidak-patuh, dan keduanya tidak
 * menambah satu pun pemeriksaan auth. Kalau halaman ini masih publik, tidak ada
 * bedanya dengan tidak menuliskan keduanya. Satu-satunya kontrol akses yang
 * berlaku di repo ini adalah pemeriksaan sesi di server dan `notFound()` di
 * route.
 *
 * KONSEKUENSI YANG TERCATAT (D-15 / D-11). Galeri adalah satu-satunya konsumen
 * 41 dari 64 primitive di `packages/ui`. Keputusan ini belum mempersempit mana
 * yang benar-benar dibutuhkan produk; penghapusan yang mengikuti adalah
 * pekerjaan Fase 4 (P-F-09 butir 6 dan 8), bukan bagian dari gating ini. Yang
 * sudah jelas: primitive yang HANYA dilayani galeri sekarang tidak dibenarkan
 * keberadaannya di produksi, dan BPD harus ditinjau ulang saat library menyusut.
 */
/**
 * Metadata juga digate, bukan hanya komponennya.
 *
 * `export const metadata` adalah konstanta, jadi Next.js membacanya dan
 * menyerializannya ke payload RSC SEBELUM komponen halaman berjalan. Akibatnya
 * `notFound()` di komponen menolak halamannya, tapi judul dan deskripsinya
 * tetap bocor di badan respons 404 — terbukti: `/gallery` membalas 404 dengan
 * `"Galeri Komponen | SnapBox Photobooth"` di dalamnya. Itu bukan kebocoran
 * konten, tapi ia tetap mengonfirmasi ke anonim bahwa route-nya ada, dan itu
 * persis kebocoran yang harus dicegah gate ini.
 *
 * `generateMetadata` dievaluasi sebelum halaman, jadi gate bisa ikut di sana.
 */
export function generateMetadata(): Metadata {
  if (process.env.NODE_ENV !== 'development') {
    return { robots: { index: false, follow: false } };
  }

  return {
    title: 'Galeri Komponen',
    description:
      'Katalog komponen neobrutalism SnapBox: aksi, formulir, data, umpan balik, navigasi, dan overlay.',
    // Bukan kontrol akses. Lihat catatan panjang di atas: gate sebenarnya ada
    // di `notFound()` dan di `generateMetadata()` di bawah.
    robots: { index: false, follow: false },
  };
}

export default function Page() {
  if (process.env.NODE_ENV !== 'development') notFound();

  return <ComponentGallery />;
}
