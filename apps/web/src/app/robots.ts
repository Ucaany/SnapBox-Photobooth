import type { MetadataRoute } from 'next';

import { getSiteUrl } from '@/lib/public-metadata';

/**
 * Robots default. Mengizinkan rute publik (termasuk landing, harga, fitur,
 * dokumentasi, dan unduh) tetapi melarang area privat: API, galeri internal,
 * dashboard, dan tautan unduhan bertoken (`/download/`).
 *
 * PENTING — INI BUKAN KONTROL AKSES. `robots.txt` adalah permintaan, bukan
 * pernyataan: crawler yang patuh memperhatikannya, crawler yang tidak patuh
 * mengabaikannya, dan siapa pun yang mengetik URL tidak pernah membaca
 * `DISALLOW` sama sekali. Setiap entri di `DISALLOW` di bawah perlu gate-nya
 * sendiri di aplikasi. `/gallery` punya: `notFound()` di
 * `app/gallery/page.tsx` menolaknya di setiap lingkungan yang bukan
 * `development`. Kalau sebuah area privat tidak punya gate, mendaftarkannya di
 * sini tidak menambah perlindungan apa pun — hanya menyesatkan.
 *
 * Rute hukum (mis. `/privacy`, `/terms`) sengaja tidak disebut karena belum
 * ada halamannya; memblokir URL yang tidak ada akan menyesatkan crawler.
 */
const DISALLOW: string[] = [
  '/api/',
  '/gallery',
  '/dashboard',
  '/admin',
  '/owner',
  '/outlet',
  '/download/',
  '/auth/',
];

export default function robots(): MetadataRoute.Robots {
  const baseUrl: string = getSiteUrl();

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: DISALLOW,
    },
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
