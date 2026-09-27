import 'server-only';

import { and, asc, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { booths, getDatabase, outlets, transactions } from '@snapbox/db';
import type {
  TransactionExportFilters,
  TransactionFilters,
  TransactionRow,
} from './transaction-contract';
import { TRANSACTIONS_PER_PAGE, TRANSACTION_EXPORT_LIMIT } from './transaction-contract';

function conditions(tenantId: string, filters: TransactionExportFilters) {
  return and(
    eq(transactions.tenantId, tenantId),
    filters.status ? eq(transactions.paymentStatus, filters.status) : undefined,
    filters.method ? eq(transactions.paymentMethod, filters.method) : undefined,
    filters.boothId ? eq(transactions.boothId, filters.boothId) : undefined,
    filters.from
      ? gte(transactions.createdAt, new Date(`${filters.from}T00:00:00.000Z`))
      : undefined,
    filters.to
      ? lt(
          transactions.createdAt,
          new Date(new Date(`${filters.to}T00:00:00.000Z`).getTime() + 86_400_000),
        )
      : undefined,
  );
}

const selection = {
  id: transactions.id,
  code: transactions.trxCode,
  booth: booths.name,
  outlet: outlets.name,
  packageName: transactions.packageName,
  amount: transactions.finalAmount,
  method: transactions.paymentMethod,
  status: transactions.paymentStatus,
  createdAt: transactions.createdAt,
  paidAt: transactions.paidAt,
  rawPhotoUrl: transactions.rawPhotoUrl,
  framedPhotoUrl: transactions.framedPhotoUrl,
  gifUrl: transactions.gifUrl,
};

export async function listOwnerTransactions(tenantId: string, filters: TransactionFilters) {
  const where = conditions(tenantId, filters);
  const db = getDatabase();
  const [rows, [total], boothRows] = await Promise.all([
    db
      .select(selection)
      .from(transactions)
      .innerJoin(booths, and(eq(booths.id, transactions.boothId), eq(booths.tenantId, tenantId)))
      .leftJoin(outlets, and(eq(outlets.id, booths.outletId), eq(outlets.tenantId, tenantId)))
      .where(where)
      .orderBy(desc(transactions.createdAt), desc(transactions.id))
      .limit(TRANSACTIONS_PER_PAGE)
      .offset((filters.page - 1) * TRANSACTIONS_PER_PAGE),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(transactions)
      .innerJoin(booths, and(eq(booths.id, transactions.boothId), eq(booths.tenantId, tenantId)))
      .where(where),
    db
      .select({ id: booths.id, name: booths.name })
      .from(booths)
      .where(eq(booths.tenantId, tenantId))
      .orderBy(asc(booths.name)),
  ]);
  return {
    rows: rows.map((row): TransactionRow => ({
      id: row.id,
      code: row.code,
      booth: row.booth,
      outlet: row.outlet,
      packageName: row.packageName,
      amount: row.amount,
      method: row.method,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      paidAt: row.paidAt?.toISOString() ?? null,
      hasPhotos: Boolean(row.rawPhotoUrl || row.framedPhotoUrl || row.gifUrl),
    })),
    total: total?.value ?? 0,
    pages: Math.max(1, Math.ceil((total?.value ?? 0) / TRANSACTIONS_PER_PAGE)),
    booths: boothRows,
  };
}

export async function exportOwnerTransactions(
  tenantId: string,
  filters: TransactionExportFilters,
  ids?: string[],
) {
  const query = getDatabase()
    .select(selection)
    .from(transactions)
    .innerJoin(booths, and(eq(booths.id, transactions.boothId), eq(booths.tenantId, tenantId)))
    .leftJoin(outlets, and(eq(outlets.id, booths.outletId), eq(outlets.tenantId, tenantId)))
    .where(
      and(
        conditions(tenantId, filters),
        ids?.length ? sql`${transactions.id} = any(${ids}::uuid[])` : undefined,
      ),
    );
  return query
    .orderBy(desc(transactions.createdAt), desc(transactions.id))
    .limit(TRANSACTION_EXPORT_LIMIT);
}
