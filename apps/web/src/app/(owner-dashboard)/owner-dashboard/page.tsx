import type { Metadata } from 'next';

import { findOwnerNavItem } from '@/components/owner-dashboard/content';
import { getOwnerLayoutData } from '@/lib/owner-dashboard/owner-layout-data';

const item = findOwnerNavItem('');

export const metadata: Metadata = {
  title: item?.title ?? 'Dashboard',
  description: item?.description,
};

export default async function OwnerDashboardPage() {
  const data = await getOwnerLayoutData();
  return (
    <section className="owner-intro">
      <div>
        <p>Operasional</p>
        <h1>Dashboard Owner</h1>
        <span>Ringkasan operasional SnapBox Anda.</span>
      </div>
      <aside>
        <p>Pemilik: {data.ownerName}</p>
        <p>Plan: {data.planName ?? 'Belum tersedia'}</p>
        <p>Perangkat aktif: {data.deviceUsage}</p>
        <p>
          Kuota perangkat:{' '}
          {data.deviceQuota === null
            ? 'Tidak tersedia'
            : data.deviceQuota === -1
              ? 'Tak terbatas'
              : data.deviceQuota}
        </p>
      </aside>
    </section>
  );
}
