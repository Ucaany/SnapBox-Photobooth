import type { Metadata } from 'next';

import { CeoDashboardClientShell } from '@/components/ceo-dashboard/ceo-dashboard-client-shell';

/**
 * Layout rute dashboard CEO (PRD Task 1.3).
 *
 * Server component: menetapkan metadata `noindex` dan merender batas klien
 * shell (sidebar + header). Halaman anak masuk lewat `children` sehingga tetap
 * server-rendered.
 *
 * Otorisasi TIDAK dilakukan di sini. Gate peran CEO sudah dipegang
 * `middleware.ts` (snapshot sesi) dan wajib diulang oleh handler/route privat
 * yang menyentuh DB.
 *
 * `force-dynamic` WAJIB di level layout, bukan hanya di halaman: seluruh rute di
 * bawah `/ceo-dashboard` berada di balik sesi, dan sebagian halaman anak
 * (Task 1.4) membaca `plans` dari DB. Tanpa ini Next mencoba memprerender
 * segmen saat build, ketika sesi dan kredensial DB tidak tersedia, sehingga
 * build gagal. Halaman skeleton sendiri tidak menyentuh DB.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'Super Admin', template: '%s | SnapBox Super Admin' },
  robots: { index: false, follow: false },
};

export default function CeoDashboardLayout({ children }: { children: React.ReactNode }) {
  return <CeoDashboardClientShell>{children}</CeoDashboardClientShell>;
}
