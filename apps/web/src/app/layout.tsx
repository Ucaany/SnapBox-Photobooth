import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import { ToastProvider } from '@snapbox/ui';

import { ThemeProvider, themeInitScript } from '@/components/theme-provider';
import { getSiteUrl } from '@/lib/public-metadata';

import './globals.css';

/**
 * Font di-self-host lewat next/font sehingga tidak ada request ke Google di
 * runtime (relevan untuk CSP kiosk).
 *
 * Tiga keluarga font sesuai mandat PRD Bab 4 (Tipografi):
 * - `--font-space-grotesk` -> heading (dikonsumsi `--font-display`).
 * - `--font-inter`         -> body (dikonsumsi `--font-sans` dan `--base-font-family`).
 * - `--font-jetbrains-mono`-> teknis/mono (dikonsumsi `--font-mono`).
 */
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-space-grotesk',
  weight: ['500', '600', '700'],
});

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  weight: ['400', '500', '600'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
  weight: ['400', '500'],
});

/**
 * Metadata dasar. Halaman publik menimpanya lewat `generateMetadata`
 * (PRD Bab 8.1). Dashboard bersifat `noindex` dan mengaturnya sendiri.
 */
export const metadata: Metadata = {
  title: {
    default: 'SnapBox Photobooth',
    template: '%s | SnapBox Photobooth',
  },
  description:
    'Platform SaaS manajemen photobooth multi-tenant: atur harga, frame, tema kiosk, dan pantau seluruh booth dari satu dasbor.',
  // Basis URL bersama dengan sitemap/robots; `metadataBase` wajib `URL`,
  // jadi hasil string `getSiteUrl()` dibungkus.
  metadataBase: new URL(getSiteUrl()),
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#FFDD00',
};

/**
 * Layout akar App Router — tetap server component.
 *
 * Tema dan toast adalah client component; mengimpornya dari server component
 * sah selama layout sendiri tidak diberi `'use client'`, sehingga metadata,
 * viewport, dan font tetap di-render server.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `suppressHydrationWarning` wajib: skrip init tema mengubah `data-theme`
    // dan `style.colorScheme` di `<html>` sebelum hydration, jadi atribut
    // server dan klien memang sengaja berbeda.
    <html
      lang="id-ID"
      suppressHydrationWarning
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable} scroll-smooth`}
    >
      {/*
        Skrip blocking di dalam `<head>` menerapkan tema tersimpan sebelum
        paint pertama, mencegah kedipan tema terang (FOWT). Tidak bisa lewat
        provider karena provider baru jalan setelah hydration — terlambat.
      */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        suppressHydrationWarning
        className="bg-background font-sans text-foreground antialiased"
      >
        {/*
          Urutan provider: ThemeProvider terluar karena tema mengendalikan
          seluruh pohon, lalu ToastProvider di dalamnya supaya toast mewarisi
          tema. ToastProvider merender portal + viewport sendiri, jadi harus
          dekat akar agar portal tidak terpotong stacking context.
        */}
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
