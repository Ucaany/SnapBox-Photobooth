import { z } from 'zod';

const date = z.iso.date().optional().or(z.literal(''));
const transactionFilterObject = z.object({
  status: z.enum(['PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUNDED']).optional(),
  method: z
    .enum(['CASH', 'QRIS_MIDTRANS', 'QRIS_XENDIT', 'QRIS_DOKU', 'QRIS_PAKASIR', 'VOUCHER'])
    .optional(),
  boothId: z.uuid().optional(),
  from: date,
  to: date,
  page: z.coerce.number().int().min(1).max(100_000).default(1),
});
export const transactionFilterSchema = transactionFilterObject.refine(
  ({ from, to }) => !from || !to || from <= to,
  {
    message: 'Tanggal awal harus sebelum atau sama dengan tanggal akhir.',
    path: ['to'],
  },
);

export const transactionExportSchema = transactionFilterObject
  .omit({ page: true })
  .extend({ ids: z.array(z.uuid()).max(500).optional() });

export type TransactionFilters = z.infer<typeof transactionFilterSchema>;
export type TransactionExportFilters = z.infer<typeof transactionExportSchema>;
export type TransactionRow = {
  id: string;
  code: string;
  booth: string;
  outlet: string | null;
  packageName: string | null;
  amount: string;
  method: string;
  status: string;
  createdAt: string;
  paidAt: string | null;
  hasPhotos: boolean;
};

export const TRANSACTIONS_PER_PAGE = 25;
export const TRANSACTION_EXPORT_LIMIT = 5_000;

export function csvCell(value: unknown): string {
  let text = String(value ?? '');
  if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
