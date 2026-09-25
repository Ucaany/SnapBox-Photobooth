import type { MetadataRoute } from 'next';

import { getSiteUrl } from '@/lib/public-metadata';

/**
 * Robots default. Mengizinkan rute publik (termasuk landing, harga, fitur,
 * dokumentasi, dan unduh) tetapi melarang area privat: API, galeri internal,
 * dashboard, dan tautan unduhan bertoken (`/download/`).
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
