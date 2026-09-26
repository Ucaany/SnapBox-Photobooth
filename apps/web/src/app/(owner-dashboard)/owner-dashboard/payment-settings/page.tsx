import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PaymentSettingsView } from '@/components/owner-dashboard/payment-settings-view';
import { getOwnerPaymentSettings } from '@/lib/owner-dashboard/payment-server';
import { requireOwnerTenant } from '@/lib/owner-dashboard/outlet-server';
export const metadata: Metadata = { title: 'Payment gateway' };
export default async function PaymentSettingsPage() {
  const auth = await requireOwnerTenant();
  if (!auth) redirect('/unauthorized');
  return <PaymentSettingsView configs={(await getOwnerPaymentSettings(auth.tenantId)).configs} />;
}
