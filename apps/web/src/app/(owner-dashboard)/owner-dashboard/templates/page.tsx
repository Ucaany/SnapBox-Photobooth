import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { TemplatesView } from '@/components/owner-dashboard/templates-view';
import { listOwnerTemplates } from '@/lib/owner-dashboard/template-server';
import { requireOwnerTenant } from '@/lib/owner-dashboard/outlet-server';

export const metadata: Metadata = { title: 'Template' };

export default async function TemplatesPage() {
  const auth = await requireOwnerTenant();
  if (!auth) redirect('/unauthorized');
  return <TemplatesView templates={await listOwnerTemplates(auth.tenantId)} />;
}
