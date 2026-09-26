import type { Metadata } from 'next';

import { findOwnerNavItem } from '@/components/owner-dashboard/content';
import { getOwnerLayoutData } from '@/lib/owner-dashboard/owner-layout-data';

const item = findOwnerNavItem('');

export const metadata: Metadata = {
  title: item?.title ?? 'Dashboard',
  description: item?.description,
};

export default async function OwnerDashboardPage() {
  await getOwnerLayoutData({ allowInactiveSubscription: false });
  return (
    <section className="owner-intro">
      <div>
        <p>Operasional</p>
        <h1>Dashboard Owner</h1>
        <span>Ringkasan operasional akan tersedia di sini.</span>
      </div>
    </section>
  );
}
