'use client';

import { useState } from 'react';

const MAX_EXPORT_ROWS = 5_000;
const DAILY_ROWS = [
  { date: '2026-09-20', transactions: 18, revenue: 1_260_000, method: 'QRIS' },
  { date: '2026-09-21', transactions: 22, revenue: 1_540_000, method: 'Tunai' },
  { date: '2026-09-22', transactions: 15, revenue: 1_050_000, method: 'QRIS' },
  { date: '2026-09-23', transactions: 27, revenue: 1_890_000, method: 'Kartu' },
  { date: '2026-09-24', transactions: 21, revenue: 1_470_000, method: 'QRIS' },
  { date: '2026-09-25', transactions: 30, revenue: 2_100_000, method: 'Tunai' },
  { date: '2026-09-26', transactions: 24, revenue: 1_680_000, method: 'QRIS' },
] as const;
const PERIODS = { '7 hari': 7, '30 hari': 30, '90 hari': 90 } as const;
type Period = keyof typeof PERIODS;

function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function ReportsView() {
  const [period, setPeriod] = useState<Period>('7 hari');
  const [frequency, setFrequency] = useState('Mingguan');
  const [time, setTime] = useState('09:00');
  const [scheduled, setScheduled] = useState(false);
  const days = PERIODS[period];
  const rows = Array.from({ length: Math.min(days, MAX_EXPORT_ROWS) }, (_, index) => ({
    ...DAILY_ROWS[index % DAILY_ROWS.length]!,
    transactions: DAILY_ROWS[index % DAILY_ROWS.length]!.transactions + Math.floor(index / 7),
    revenue: DAILY_ROWS[index % DAILY_ROWS.length]!.revenue + Math.floor(index / 7) * 75_000,
    date: new Date(Date.UTC(2026, 8, 26 - days + index + 1)).toISOString().slice(0, 10),
  }));
  const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const totalTransactions = rows.reduce((sum, row) => sum + row.transactions, 0);

  function downloadCsv() {
    const contents = [
      ['Tanggal', 'Transaksi', 'Pendapatan (IDR)', 'Metode pembayaran'],
      ...rows.map((row) => [row.date, row.transactions, row.revenue, row.method]),
    ]
      .map((row) => row.map(csvCell).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(
      new Blob(['\uFEFF', contents], { type: 'text/csv;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `laporan-demo-${days}-hari.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }

  return (
    <main className="space-y-7">
      <header className="no-print">
        <p className="text-muted-foreground text-sm font-semibold tracking-[0.18em] uppercase">
          Insight
        </p>
        <h1 className="text-3xl font-bold">Laporan</h1>
        <p className="text-muted-foreground">Ringkasan bisnis, ekspor data, dan jadwal laporan.</p>
      </header>

      <aside
        className="border-2 border-amber-500 bg-amber-50 p-4 text-sm text-amber-950"
        role="note"
      >
        <strong>Data demo.</strong> Jadwal hanya tersimpan selama halaman terbuka; laporan tidak
        dikirim melalui email.
      </aside>

      <section className="no-print grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <div className="space-y-4 border-2 border-foreground p-5 shadow-[4px_4px_0_0_currentColor]">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Ringkasan transaksi</h2>
              <p className="text-muted-foreground text-sm">
                Angka sintetis untuk pratinjau ekspor.
              </p>
            </div>
            <label className="font-semibold">
              Periode
              <select
                className="mt-1 block min-h-11 border-2 border-foreground bg-background px-3"
                value={period}
                onChange={(event) => setPeriod(event.target.value as Period)}
              >
                {Object.keys(PERIODS).map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>
          <dl className="grid grid-cols-2 gap-3">
            <div className="border-2 border-foreground p-4">
              <dt className="text-sm">Transaksi</dt>
              <dd className="text-2xl font-bold">{totalTransactions}</dd>
            </div>
            <div className="border-2 border-foreground p-4">
              <dt className="text-sm">Pendapatan demo</dt>
              <dd className="text-xl font-bold">
                {new Intl.NumberFormat('id-ID', {
                  style: 'currency',
                  currency: 'IDR',
                  maximumFractionDigits: 0,
                }).format(totalRevenue)}
              </dd>
            </div>
          </dl>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
              <caption className="sr-only">Contoh data laporan harian</caption>
              <thead>
                <tr className="border-b-2 border-foreground">
                  <th className="p-2">Tanggal</th>
                  <th className="p-2">Transaksi</th>
                  <th className="p-2">Pendapatan</th>
                  <th className="p-2">Pembayaran</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 7).map((row, index) => (
                  <tr className="border-b" key={`${row.date}-${index}`}>
                    <td className="p-2">{row.date}</td>
                    <td className="p-2">{row.transactions}</td>
                    <td className="p-2">{row.revenue.toLocaleString('id-ID')}</td>
                    <td className="p-2">{row.method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground text-xs">
            Ekspor dibatasi maksimal {MAX_EXPORT_ROWS.toLocaleString('id-ID')} baris.
          </p>
        </div>

        <div className="space-y-5 border-2 border-foreground p-5 shadow-[4px_4px_0_0_currentColor]">
          <div>
            <h2 className="text-xl font-bold">Jadwal laporan</h2>
            <p className="text-muted-foreground text-sm">Simulasi preferensi pengiriman.</p>
          </div>
          <label className="block font-semibold">
            Frekuensi
            <select
              className="mt-1 block min-h-11 w-full border-2 border-foreground bg-background px-3"
              value={frequency}
              onChange={(event) => setFrequency(event.target.value)}
            >
              <option>Harian</option>
              <option>Mingguan</option>
              <option>Bulanan</option>
            </select>
          </label>
          <label className="block font-semibold">
            Waktu pengiriman
            <input
              className="mt-1 block min-h-11 w-full border-2 border-foreground bg-background px-3"
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
            />
          </label>
          <button
            className="min-h-11 w-full border-2 border-foreground bg-yellow-400 px-4 font-bold hover:bg-yellow-300 focus-visible:outline-2 focus-visible:outline-offset-2"
            type="button"
            onClick={() => setScheduled((value) => !value)}
          >
            {scheduled ? 'Nonaktifkan jadwal demo' : 'Aktifkan jadwal demo'}
          </button>
          <p role="status" aria-live="polite" className="min-h-6 text-sm font-semibold">
            {scheduled
              ? `${frequency}, pukul ${time} · simulasi aktif di halaman ini.`
              : 'Jadwal demo nonaktif.'}
          </p>
        </div>
      </section>

      <section className="no-print flex flex-wrap gap-3" aria-label="Ekspor laporan">
        <button
          className="min-h-11 border-2 border-foreground bg-foreground px-5 font-bold text-background focus-visible:outline-2 focus-visible:outline-offset-2"
          type="button"
          onClick={downloadCsv}
        >
          Unduh CSV
        </button>
        <button
          className="min-h-11 border-2 border-foreground px-5 font-bold focus-visible:outline-2 focus-visible:outline-offset-2"
          type="button"
          onClick={() => window.print()}
        >
          Cetak / Simpan PDF
        </button>
      </section>

      <section className="print-report hidden space-y-4" aria-label="Laporan untuk dicetak">
        <p>
          <strong>DATA DEMO — BUKAN DATA PRODUKSI</strong>
        </p>
        <h1 className="text-2xl font-bold">Laporan transaksi · {period}</h1>
        <p>
          Periode pratinjau: {rows[0]?.date} – {rows.at(-1)?.date} · {rows.length} baris
        </p>
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Transaksi</th>
              <th>Pendapatan (IDR)</th>
              <th>Pembayaran</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.date}-print-${index}`}>
                <td>{row.date}</td>
                <td>{row.transactions}</td>
                <td>{row.revenue}</td>
                <td>{row.method}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
