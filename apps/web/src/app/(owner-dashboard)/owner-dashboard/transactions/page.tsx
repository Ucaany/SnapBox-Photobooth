import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { TransactionsView } from '@/components/owner-dashboard/transactions-view';
import { requireOwnerTenant } from '@/lib/owner-dashboard/outlet-server';
import { listOwnerTransactions } from '@/lib/owner-dashboard/transaction-server';
import { transactionFilterSchema } from '@/lib/owner-dashboard/transaction-contract';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Transaksi' };

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await requireOwnerTenant();
  if (!auth) redirect('/unauthorized');
  const params = await searchParams;
  const parsed = transactionFilterSchema.safeParse({
    status: first(params.status),
    method: first(params.method),
    boothId: first(params.boothId),
    from: first(params.from),
    to: first(params.to),
    page: first(params.page),
  });
  const filters = parsed.success ? parsed.data : transactionFilterSchema.parse({});
  const data = await listOwnerTransactions(auth.tenantId, filters);
  return <TransactionsView initial={filters} {...data} />;
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
