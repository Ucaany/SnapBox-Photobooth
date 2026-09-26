import type { Metadata } from 'next';

import { ReportsView } from '@/components/owner-dashboard/reports-view';
import { getOwnerLayoutData } from '@/lib/owner-dashboard/owner-layout-data';

export const metadata: Metadata = {
  title: 'Laporan',
  description: 'Pratinjau, ekspor, dan atur jadwal laporan.',
};

export default async function ReportsPage() {
  await getOwnerLayoutData();
  return <ReportsView />;
}
