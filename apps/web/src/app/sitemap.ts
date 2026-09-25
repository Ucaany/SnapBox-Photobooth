import type { MetadataRoute } from 'next';

import { PUBLIC_ROUTES, type PublicRoute, type PublicRouteHref } from '@/content/public';
import { getSiteUrl } from '@/lib/public-metadata';

type SitemapEntry = MetadataRoute.Sitemap[number];

/**
 * Change frequency per rute publik. Halaman sistem (troubleshooting, unduh)
 * lebih jarang berubah daripada halaman marketing. Nilai bertipe literal agar
 * cocok dengan union `changeFrequency` milik Next.js.
 */
const CHANGE_FREQUENCY: Readonly<Record<PublicRouteHref, SitemapEntry['changeFrequency']>> = {
  '/': 'weekly',
  '/tentang': 'monthly',
  '/fitur': 'monthly',
  '/harga': 'monthly',
  '/kamera': 'monthly',
  '/kontak': 'monthly',
  '/docs/troubleshooting': 'monthly',
  '/unduh-aplikasi': 'weekly',
};

/**
 * Prioritas relatif. Beranda tertinggi, lalu rute konversi, lalu rute
 * informasi. Rentang valid Next.js adalah 0.0 sampai 1.0.
 */
const PRIORITY: Readonly<Record<PublicRouteHref, number>> = {
  '/': 1,
  '/harga': 0.9,
  '/fitur': 0.8,
  '/kontak': 0.8,
  '/kamera': 0.6,
  '/unduh-aplikasi': 0.6,
  '/tentang': 0.5,
  '/docs/troubleshooting': 0.5,
};

/**
 * Sitemap hanya memuat delapan rute publik dari `PUBLIC_ROUTES`. Rute internal
 * (`/gallery`, `/api/*`, dashboard, dan tautan privat seperti `/download/`)
 * bukan tujuan publik, jadi tidak pernah dimasukkan di sini.
 *
 * URL absolut dibangun dari `getSiteUrl()` (membaca `NEXT_PUBLIC_APP_URL`)
 * supaya tidak ada basis URL yang di-derive ulang.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl: string = getSiteUrl();
  const lastModified: Date = new Date();

  return PUBLIC_ROUTES.map((route: PublicRoute) => ({
    url: `${baseUrl}${route.href === '/' ? '' : route.href}`,
    lastModified,
    changeFrequency: CHANGE_FREQUENCY[route.href],
    priority: PRIORITY[route.href],
  }));
}
