import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { findNavItem } from '@/components/ceo-dashboard/content';
import { getSystemHealthSnapshot } from '@/lib/ceo-dashboard/health-security-server';

import { SystemHealthClient } from './system-health-client';

/**
 * `/ceo-dashboard/system-health` (PRD Task 1.11).
 *
 * Server component memuat heartbeat NYATA dari tabel `system_health_checks` dan
 * antrean webhook dari `webhook_events`/`webhook_failures`. Tidak ada fallback
 * data contoh: komponen tanpa heartbeat ditampilkan sebagai belum tersedia.
 *
 * Halaman ini SENGAJA tidak melakukan probe jaringan sinkron. Probe Sentry dan
 * dependency lain berjalan di job terjadwal lewat
 * `POST /api/internal/telemetry/heartbeat`, sehingga gangguan satu penyedia
 * eksternal tidak menambah latensi render CEO. Halaman hanya membaca hasilnya.
 *
 * Otorisasi: `getSystemHealthSnapshot` memanggil `requireCeo()` (ADR-004).
 */
const item = findNavItem('system-health');

export const metadata: Metadata = {
  title: item?.title ?? 'Kesehatan sistem',
  description: item?.description,
  robots: { index: false, follow: false },
};

export default async function SystemHealthPage() {
  if (!item) notFound();

  const snapshot = await getSystemHealthSnapshot();

  return <SystemHealthClient snapshot={snapshot} />;
}
