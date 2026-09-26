import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { KioskThemeView } from '@/components/owner-dashboard/kiosk-theme-view';
import { loadOwnerKioskTheme } from '@/lib/owner-dashboard/kiosk-theme-server';
import { requireOwnerTenant } from '@/lib/owner-dashboard/outlet-server';

export const metadata: Metadata = { title: 'Tema kiosk' };

export default async function KioskThemePage() {
  const auth = await requireOwnerTenant();
  if (!auth) redirect('/unauthorized');
  const data = await loadOwnerKioskTheme(auth.tenantId);
  return <KioskThemeView data={data} />;
}
