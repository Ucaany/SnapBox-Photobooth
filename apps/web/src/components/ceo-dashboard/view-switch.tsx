'use client';

import * as React from 'react';

import { ActivityLogView } from './views/activity-log-view';
import { BroadcastView } from './views/broadcast-view';
import { DashboardView } from './views/dashboard-view';
import { DevicesView } from './views/devices-view';
import { SettingsView } from './views/settings-view';
import { TenantsView } from './views/tenants-view';

/**
 * Pemetaan slug segmen ke view skeleton. Satu sumber untuk route CEO yang masih
 * memakai data contoh.
 *
 * Komponen ini klien karena setiap view memakai state (filter, form, toggle);
 * server page hanya memvalidasi slug lalu merender `<CeoView slug={...} />`.
 *
 * `plans` (Task 1.5), `subscriptions` (Task 1.6), `promos` (Task 1.10), serta
 * `system-health` dan `security` (Task 1.11) TIDAK ada di sini: semuanya punya
 * route eksplisit yang membaca DB. Bila rute eksplisit dihapus, slug itu jatuh
 * ke catch-all dan 404, lebih benar daripada menampilkan skeleton tanpa data.
 */
const VIEWS: Record<string, React.ComponentType> = {
  '': DashboardView,
  tenants: TenantsView,
  devices: DevicesView,
  broadcast: BroadcastView,
  'activity-log': ActivityLogView,
  settings: SettingsView,
};

/** Merender view untuk satu slug. `fallback` dipakai bila slug tidak dikenal. */
export function CeoView({ slug, fallback = null }: { slug: string; fallback?: React.ReactNode }) {
  const View = VIEWS[slug];
  return View ? <View /> : <>{fallback}</>;
}
