import type { Metadata } from 'next';
import { FinanceView } from '@/components/owner-dashboard/finance-analytics-view';

export const metadata: Metadata = { title: 'Keuangan' };

export default function FinancePage() {
  return <FinanceView />;
}
