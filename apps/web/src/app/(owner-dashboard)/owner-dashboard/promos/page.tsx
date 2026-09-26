import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PromosView } from '@/components/owner-dashboard/promos-view';
import { requireOwnerTenant } from '@/lib/owner-dashboard/outlet-server';
import { hasPromoEntitlement, listOwnerPromos } from '@/lib/owner-dashboard/promo-server';
export const metadata: Metadata = { title: 'Promo' };
export default async function PromosPage() {
  const auth = await requireOwnerTenant();
  if (!auth) redirect('/unauthorized');
  const enabled = await hasPromoEntitlement(auth.tenantId);
  return (
    <PromosView enabled={enabled} rows={enabled ? await listOwnerPromos(auth.tenantId) : []} />
  );
}
