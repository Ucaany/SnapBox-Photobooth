'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import type {
  TransactionFilters,
  TransactionRow,
} from '@/lib/owner-dashboard/transaction-contract';

type Props = {
  initial: TransactionFilters;
  rows: TransactionRow[];
  total: number;
  pages: number;
  booths: { id: string; name: string }[];
};
const statuses = ['PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUNDED'];
const methods = ['CASH', 'QRIS_MIDTRANS', 'QRIS_XENDIT', 'QRIS_DOKU', 'QRIS_PAKASIR', 'VOUCHER'];
const labels: Record<string, string> = {
  PENDING: 'Menunggu',
  PAID: 'Dibayar',
  FAILED: 'Gagal',
  EXPIRED: 'Kedaluwarsa',
  CANCELLED: 'Dibatalkan',
  REFUNDED: 'Dikembalikan',
  CASH: 'Tunai',
  QRIS_MIDTRANS: 'QRIS Midtrans',
  QRIS_XENDIT: 'QRIS Xendit',
  QRIS_DOKU: 'QRIS Doku',
  QRIS_PAKASIR: 'QRIS Pakasir',
  VOUCHER: 'Voucher',
};
const control =
  'min-h-11 border-2 border-foreground bg-background px-3 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600';

export function TransactionsView({ initial, rows, total, pages, booths }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  function apply(form: FormData) {
    const query = new URLSearchParams();
    for (const key of ['status', 'method', 'boothId', 'from', 'to'] as const) {
      const value = String(form.get(key) ?? '');
      if (value) query.set(key, value);
    }
    query.set('page', '1');
    router.push(`/owner-dashboard/transactions?${query}`);
  }
  function exportHref() {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(initial)) if (value) params.set(key, String(value));
    return `/owner-dashboard/transactions/export?${params}`;
  }
  function exportZip() {
    startTransition(async () => {
      try {
        const response = await fetch('/owner-dashboard/transactions/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...initial, ids: selected }),
        });
        if (!response.ok) throw new Error((await response.json()).message ?? 'Ekspor gagal.');
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'transaksi-snapbox.zip';
        anchor.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Ekspor gagal. Coba kembali.');
      }
    });
  }
  const allSelected = rows.length > 0 && rows.every((row) => selected.includes(row.id));
  return (
    <div className="space-y-6">
      <header className="border-b-4 border-foreground pb-5">
        <p className="text-sm font-semibold">Penjualan / Owner</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Transaksi</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Telusuri pembayaran berdasarkan status, metode, tanggal, dan booth. Ekspor hanya memuat
          data tenant Anda.
        </p>
      </header>
      <form
        action={apply}
        className="grid grid-cols-1 gap-3 border-2 border-foreground bg-brand-mist p-4 sm:grid-cols-2 lg:grid-cols-6"
      >
        <label className="grid gap-1 text-sm font-semibold">
          Status
          <select name="status" defaultValue={initial.status ?? ''} className={control}>
            <option value="">Semua status</option>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {labels[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Metode
          <select name="method" defaultValue={initial.method ?? ''} className={control}>
            <option value="">Semua metode</option>
            {methods.map((value) => (
              <option key={value} value={value}>
                {labels[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Booth
          <select name="boothId" defaultValue={initial.boothId ?? ''} className={control}>
            <option value="">Semua booth</option>
            {booths.map((booth) => (
              <option key={booth.id} value={booth.id}>
                {booth.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Dari
          <input type="date" name="from" defaultValue={initial.from ?? ''} className={control} />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Sampai
          <input type="date" name="to" defaultValue={initial.to ?? ''} className={control} />
        </label>
        <div className="flex items-end">
          <button
            className={`${control} w-full bg-brand-primary font-bold hover:translate-x-0.5 hover:translate-y-0.5`}
          >
            Terapkan filter
          </button>
        </div>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="text-sm font-semibold">
          {total.toLocaleString('id-ID')} transaksi · halaman {initial.page} dari {pages}
        </p>
        <div className="flex flex-wrap gap-2">
          <a href={exportHref()} className={`${control} inline-flex items-center font-semibold`}>
            Unduh CSV
          </a>
          <button
            disabled={pending || selected.length === 0}
            onClick={exportZip}
            className={`${control} bg-brand-primary font-bold disabled:opacity-60`}
          >
            ZIP pilihan ({selected.length})
          </button>
        </div>
      </div>
      {message && (
        <p
          role="status"
          aria-live="polite"
          className="border-2 border-foreground bg-brand-surface p-3"
        >
          {message}
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        ZIP berisi manifest CSV. Foto tidak disertakan karena penyimpanan foto transaksi belum
        memiliki kontrak bucket privat yang terverifikasi.
      </p>
      {rows.length === 0 ? (
        <div className="border-2 border-dashed border-foreground p-8">
          <h2 className="text-xl font-bold">Belum ada transaksi</h2>
          <p className="mt-2">Transaksi akan tampil setelah tercatat untuk tenant ini.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border-2 border-foreground">
          <table className="w-full min-w-[950px] border-collapse text-left text-sm">
            <thead className="bg-brand-primary">
              <tr>
                <th className="border-2 border-foreground p-3">
                  <input
                    aria-label="Pilih transaksi di halaman ini"
                    type="checkbox"
                    checked={allSelected}
                    onChange={(event) =>
                      setSelected(
                        event.target.checked
                          ? [...new Set([...selected, ...rows.map((row) => row.id)])]
                          : selected.filter((id) => !rows.some((row) => row.id === id)),
                      )
                    }
                  />
                </th>
                {['Kode / Waktu', 'Booth / Outlet', 'Paket', 'Nominal', 'Metode', 'Status'].map(
                  (title) => (
                    <th key={title} className="border-2 border-foreground p-3">
                      {title}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id} className={index % 2 ? 'bg-brand-mist' : 'bg-brand-surface'}>
                  <td className="border-2 border-foreground p-3">
                    <input
                      aria-label={`Pilih transaksi ${row.code}`}
                      type="checkbox"
                      checked={selected.includes(row.id)}
                      onChange={(event) =>
                        setSelected(
                          event.target.checked
                            ? [...selected, row.id]
                            : selected.filter((id) => id !== row.id),
                        )
                      }
                    />
                  </td>
                  <td className="border-2 border-foreground p-3">
                    <strong>{row.code}</strong>
                    <time className="mt-1 block text-xs" dateTime={row.createdAt}>
                      {new Intl.DateTimeFormat('id-ID', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(row.createdAt))}
                    </time>
                  </td>
                  <td className="border-2 border-foreground p-3">
                    {row.booth}
                    <span className="block text-xs">{row.outlet ?? 'Tanpa outlet'}</span>
                  </td>
                  <td className="border-2 border-foreground p-3">
                    {row.packageName ?? 'Paket tidak tercatat'}
                  </td>
                  <td className="border-2 border-foreground p-3 font-semibold">
                    Rp {Number(row.amount).toLocaleString('id-ID')}
                  </td>
                  <td className="border-2 border-foreground p-3">
                    {labels[row.method] ?? row.method}
                  </td>
                  <td className="border-2 border-foreground p-3">
                    <span className="inline-block border-2 border-foreground px-2 py-1 font-semibold">
                      {labels[row.status] ?? row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <nav aria-label="Halaman transaksi" className="flex justify-between gap-3">
        <a
          aria-disabled={initial.page <= 1}
          className={`${control} inline-flex items-center ${initial.page <= 1 ? 'pointer-events-none opacity-50' : ''}`}
          href={pageHref(initial, initial.page - 1)}
        >
          Sebelumnya
        </a>
        <a
          aria-disabled={initial.page >= pages}
          className={`${control} inline-flex items-center ${initial.page >= pages ? 'pointer-events-none opacity-50' : ''}`}
          href={pageHref(initial, initial.page + 1)}
        >
          Berikutnya
        </a>
      </nav>
    </div>
  );
}

function pageHref(filters: TransactionFilters, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, page }))
    if (value) params.set(key, String(value));
  return `/owner-dashboard/transactions?${params}`;
}
