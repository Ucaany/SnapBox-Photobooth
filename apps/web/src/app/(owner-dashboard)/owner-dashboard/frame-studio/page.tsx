import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { FrameStudioView } from '@/components/owner-dashboard/frame-studio-view';
import { listOwnerFrames } from '@/lib/owner-dashboard/frame-server';
import { requireOwnerTenant } from '@/lib/owner-dashboard/outlet-server';

export const metadata: Metadata = { title: 'Frame Studio' };

export default async function FrameStudioPage() {
  const auth = await requireOwnerTenant();
  if (!auth) redirect('/unauthorized');
  return <FrameStudioView data={await listOwnerFrames(auth.tenantId)} />;
}
