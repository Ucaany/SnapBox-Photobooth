import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { SubscriptionView } from '@/components/owner-dashboard/subscription-view';
import { getOwnerSubscription } from '@/lib/owner-dashboard/subscription-server';
import { requireOwnerTenant } from '@/lib/owner-dashboard/outlet-server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Langganan',
  description: 'Status langganan, invoice, dan paket SnapBox.',
  robots: { index: false, follow: false },
};

export default async function OwnerSubscriptionPage() {
  const auth = await requireOwnerTenant();
  if (!auth) redirect('/unauthorized');
  return <SubscriptionView data={await getOwnerSubscription(auth.tenantId)} />;
}
