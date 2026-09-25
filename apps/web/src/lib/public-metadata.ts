import type { Metadata } from 'next';

import { PUBLIC_ROUTES, SITE, type PublicRouteHref, type PublicRoute } from '@/content/public';

/**
 * URL dasar situs. Membaca `NEXT_PUBLIC_APP_URL` dan membuang trailing slash
 * supaya penggabungan path relatif tidak menghasilkan `//`. Dipakai oleh
 * `Metadata.metadataBase`, `sitemap.ts`, dan `robots.ts` agar tidak drift.
 */
export function getSiteUrl(): string {
  const raw: string = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return raw.replace(/\/+$/, '');
}

const OG_SITE_NAME = 'SnapBox Photobooth' as const;
const OG_LOCALE = 'id_ID' as const;

function findRoute(href: PublicRouteHref): PublicRoute | undefined {
  return PUBLIC_ROUTES.find((route) => route.href === href);
}

/**
 * Membangun objek `Metadata` Next.js untuk satu rute publik dari
 * `PUBLIC_ROUTES`, sehingga judul, deskripsi, canonical, OpenGraph, dan Twitter
 * tidak bisa berbeda antar halaman.
 *
 * Rute tak dikenal jatuh ke default situs (`SITE`) dengan canonical relatif
 * yang diberikan, bukan throw, supaya render halaman tidak pernah gagal.
 *
 * CATATAN GAP: `openGraph.images` dan `twitter.images` sengaja tidak diisi
 * karena aset gambar OG belum ada (dependency gambar OG di-skip). Tambahkan
 * setelah aset resmi tersedia.
 */
export function buildPublicMetadata(href: PublicRouteHref): Metadata {
  const route: PublicRoute | undefined = findRoute(href);
  const title: string = route?.title ?? SITE.name;
  const description: string = route?.description ?? SITE.description;

  // Absolut, memakai aturan yang sama dengan `sitemap.ts`: rute beranda tidak
  // menambah path supaya tidak menghasilkan `//` atau canonical relatif.
  const canonical: string = `${getSiteUrl()}${href === '/' ? '' : href}`;

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        'id-ID': canonical,
      },
    },
    openGraph: {
      type: 'website',
      locale: OG_LOCALE,
      siteName: OG_SITE_NAME,
      title,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}
