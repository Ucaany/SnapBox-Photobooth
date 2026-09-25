'use client';

import * as React from 'react';

import { ActivityLogView } from './views/activity-log-view';
import { BroadcastView } from './views/broadcast-view';
import { DashboardView } from './views/dashboard-view';
import { DevicesView } from './views/devices-view';
import { PromosView } from './views/promos-view';
import { SecurityView } from './views/security-view';
import { SettingsView } from './views/settings-view';
import { SystemHealthView } from './views/system-health-view';
import { TenantsView } from './views/tenants-view';

/**
 * Pemetaan slug segmen ke view. Satu sumber untuk 11 route CEO.
 *
 * Komponen ini klien karena setiap view memakai state (filter, form, toggle);
 * server page hanya memvalidasi slug lalu merender `<CeoView slug={...} />`.
 * Fungsi pencarian dipisah ke `.ts` bebas-klien supaya server bisa memakainya
 * untuk `generateMetadata` dan `notFound()` tanpa melanggar batas klien/server.
 *
 * `plans` TIDAK ada di sini: sejak Task 1.5 route eksplisit
 * `plans/page.tsx` yang membaca tabel `plans` nyata, dan slug ini hanya bisa
 * sampai catch-all bila rute eksplisit dihapus — dalam kondisi itu 404 lebih
 * benar daripada menampilkan editor tanpa data.
 *
 * `subscriptions` juga TIDAK ada di sini sejak Task 1.6: route eksplisit
 * `subscriptions/page.tsx` membaca `b2b_subscriptions` dan mengoper barisnya ke
 * komponen klien, sehingga view skeleton lama tidak lagi dipakai.
 */
const VIEWS: Record<string, React.ComponentType> = {
  '': DashboardView,
  tenants: TenantsView,
  devices: DevicesView,
  broadcast: BroadcastView,
  promos: PromosView,
  'activity-log': ActivityLogView,
  settings: SettingsView,
  'system-health': SystemHealthView,
  security: SecurityView,
};

/** Merender view untuk satu slug. `fallback` dipakai bila slug tidak dikenal. */
export function CeoView({ slug, fallback = null }: { slug: string; fallback?: React.ReactNode }) {
  const View = VIEWS[slug];
  return View ? <View /> : <>{fallback}</>;
}
