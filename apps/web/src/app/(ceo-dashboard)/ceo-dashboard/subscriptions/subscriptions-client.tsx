'use client';

import {
  Badge,
  Button,
  Input,
  NativeSelect,
  NativeSelectOption,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@snapbox/ui';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { PageIntro, StatusBadge, toneForStatus } from '@/components/ceo-dashboard/panel';
import { CONTOH_INVOICES } from '@/components/ceo-dashboard/example-data';
import {
  INVOICE_DISPLAY_STATUSES,
  type InvoiceDisplayStatus,
  type InvoiceRow,
  type SubscriptionActionResult,
} from '@/lib/ceo-dashboard/subscription-contract';

import { createInvoice, retryInvoice } from './actions';

/**
 * Tabel invoice langganan B2B (PRD Task 1.6).
 *
 * Dua sumber baris yang TIDAK boleh tercampur:
 * - `rows` NYATA dari `b2b_subscriptions`; baris ini boleh ditagih/ditagih ulang
 *   lewat Server Action.
 * - fallback data contoh, hanya dipakai ketika DB kosong. Baris contoh TIDAK
 *   pernah dikirim ke action: tidak ada id DB yang bisa dipakai, dan tombolnya
 *   dinonaktifkan dengan alasan eksplisit.
 *
 * Tidak ada optimisme palsu: status `Lunas` hanya datang dari webhook
 * terverifikasi, dan UI menunggu hasil action sebelum menyatakan sukses.
 */

/** Lima row contoh diubah ke bentuk tabel supaya rendering tetap satu jalur. */
const EXAMPLE_ROWS: readonly InvoiceRow[] = CONTOH_INVOICES.map((invoice) => ({
  id: invoice.id,
  tenantId: '',
  tenantName: invoice.tenant,
  planTier: '—',
  planName: '—',
  periodLabel: invoice.period,
  amount: 0,
  amountLabel: invoice.amount,
  status: invoice.status,
  rawStatus: 'PENDING',
  issuedAt: invoice.issuedAt,
  paidAt: null,
  invoiceId: invoice.invoiceNo,
  paymentUrl: null,
  retryable: false,
  isExample: true,
}));

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

interface RowFeedback {
  readonly tone: 'ok' | 'error';
  readonly message: string;
}

export function SubscriptionsClient({ rows }: { rows: readonly InvoiceRow[] }) {
  const usingExample = rows.length === 0;
  const data = usingExample ? EXAMPLE_ROWS : rows;

  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'' | InvoiceDisplayStatus>('');
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<RowFeedback | null>(null);

  const router = useRouter();

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.filter((row) => {
      if (statusFilter && row.status !== statusFilter) return false;
      if (needle) {
        const haystack = `${row.tenantName} ${row.invoiceId ?? ''} ${row.planName}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [data, query, statusFilter]);

  async function runAction(kind: 'create' | 'retry', row: InvoiceRow) {
    if (pendingId || row.isExample) return;
    setPendingId(row.id);
    setFeedback(null);

    try {
      const action = kind === 'create' ? createInvoice : retryInvoice;
      const result: SubscriptionActionResult = await action({ subscriptionId: row.id });
      if (!result.ok) {
        setFeedback({ tone: 'error', message: result.message });
        return;
      }
      setFeedback({ tone: 'ok', message: result.message });
      router.refresh();
    } catch {
      setFeedback({
        tone: 'error',
        message: 'Permintaan gagal karena gangguan koneksi. Coba lagi.',
      });
    } finally {
      setPendingId(null);
    }
  }

  const activeFilterCount = (statusFilter ? 1 : 0) + (query ? 1 : 0);

  return (
    <>
      <PageIntro
        title="Langganan global"
        description="Invoice B2B lintas tenant, status pembayaran, dan invoice gagal."
      >
        <Badge variant="neutral" title="Integrasi Pakasir masih draft sandbox.">
          Integrasi sandbox - draft
        </Badge>
      </PageIntro>

      <section className="ceo-panel" aria-label="Filter invoice">
        <div className="ceo-toolbar">
          <div className="ceo-field ceo-field-search">
            <label className="ceo-label" htmlFor="invoice-search">
              Cari invoice
            </label>
            <Input
              id="invoice-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari tenant atau nomor invoice"
              autoComplete="off"
            />
          </div>

          <div className="ceo-field">
            <label className="ceo-label" htmlFor="invoice-status">
              Filter status
            </label>
            <NativeSelect
              id="invoice-status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as '' | InvoiceDisplayStatus)}
            >
              <NativeSelectOption value="">Semua</NativeSelectOption>
              {INVOICE_DISPLAY_STATUSES.map((status) => (
                <NativeSelectOption key={status} value={status}>
                  {status}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          {activeFilterCount > 0 ? (
            <div className="ceo-toolbar-actions">
              <Button
                type="button"
                variant="noShadow"
                size="default"
                onClick={() => {
                  setQuery('');
                  setStatusFilter('');
                }}
              >
                Reset ({activeFilterCount})
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      {feedback ? (
        <p
          className={feedback.tone === 'ok' ? 'ceo-feedback' : 'ceo-feedback ceo-feedback-error'}
          role={feedback.tone === 'ok' ? 'status' : 'alert'}
          aria-live="polite"
        >
          {feedback.message}
        </p>
      ) : null}

      <div className="ceo-table-wrap">
        {filtered.length === 0 ? (
          <p className="ceo-table-state" role="status">
            Tidak ada invoice yang cocok dengan filter.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Invoice</TableHead>
                <TableHead scope="col">Tenant</TableHead>
                <TableHead scope="col">Periode</TableHead>
                <TableHead scope="col">Nilai</TableHead>
                <TableHead scope="col">Status</TableHead>
                <TableHead scope="col">Diterbitkan</TableHead>
                <TableHead scope="col">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => {
                const pending = pendingId === row.id;
                const canRetry = !row.isExample && row.retryable;
                const canCreate = !row.isExample && row.retryable && !row.invoiceId;

                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="ceo-cell-stack">
                        {row.invoiceId ? (
                          <span className="ceo-mono ceo-cell-strong">{row.invoiceId}</span>
                        ) : (
                          <span className="ceo-muted">Belum diterbitkan</span>
                        )}
                        {row.isExample ? <span className="ceo-cell-sub">Data contoh</span> : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="ceo-cell-stack">
                        <span className="ceo-cell-strong">{row.tenantName}</span>
                        <span className="ceo-cell-sub">
                          {row.planName} - {row.planTier}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{row.periodLabel}</TableCell>
                    <TableCell className="ceo-mono">{row.amountLabel}</TableCell>
                    <TableCell>
                      <StatusBadge tone={toneForStatus(row.status)}>{row.status}</StatusBadge>
                    </TableCell>
                    <TableCell>{formatDateTime(row.issuedAt)}</TableCell>
                    <TableCell>
                      <div className="ceo-inline-actions">
                        {row.paymentUrl ? (
                          <Button
                            variant="neutral"
                            size="default"
                            render={
                              <a href={row.paymentUrl} target="_blank" rel="noopener noreferrer">
                                Buka bayar
                              </a>
                            }
                          />
                        ) : null}

                        {canCreate ? (
                          <Button
                            type="button"
                            variant="reverse"
                            size="default"
                            disabled={pending}
                            onClick={() => runAction('create', row)}
                          >
                            {pending ? 'Memproses...' : 'Buat invoice'}
                          </Button>
                        ) : null}

                        {canRetry && row.invoiceId ? (
                          <Button
                            type="button"
                            variant="reverse"
                            size="default"
                            disabled={pending}
                            onClick={() => runAction('retry', row)}
                          >
                            {pending ? 'Memproses...' : 'Tagih ulang'}
                          </Button>
                        ) : null}

                        {!row.isExample && !row.retryable ? (
                          <span className="ceo-muted">Tidak perlu ditagih</span>
                        ) : null}

                        {row.isExample ? (
                          <span className="ceo-muted" title="Baris contoh tidak tersambung ke DB.">
                            Contoh
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        <p className="ceo-table-count" role="status">
          Menampilkan {filtered.length} dari {data.length} invoice{usingExample ? ' contoh' : ''}.
        </p>
      </div>

      <p className="ceo-footnote">
        {usingExample
          ? 'Belum ada langganan nyata di database, sehingga tabel menampilkan data contoh dan tombol aksi dinonaktifkan. '
          : 'Nilai dan periode berasal dari tabel b2b_subscriptions. '}
        Aktivasi langganan hanya terjadi lewat webhook Pakasir terverifikasi; endpoint dan
        verifikasi HMAC masih draft sandbox.
      </p>
    </>
  );
}
