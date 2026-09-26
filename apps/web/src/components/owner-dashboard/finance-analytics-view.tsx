'use client';

import { useState } from 'react';
import {
  CartesianGrid,
  Cell,
  Funnel,
  FunnelChart,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CONVERSION_FUNNEL,
  FINANCE_PERIODS,
  FINANCE_SUMMARY,
  OUTLET_BREAKDOWN,
  PAYMENT_METHODS,
  REVENUE_7_DAYS,
  REVENUE_30_DAYS,
  WEEKLY_RETENTION,
  type FinancePeriod,
} from '@/lib/owner-dashboard/finance-analytics-demo';

const money = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});
const periodLabels: Record<FinancePeriod, string> = {
  daily: 'Harian',
  weekly: 'Mingguan',
  monthly: 'Bulanan',
};

export function FinanceView() {
  const [period, setPeriod] = useState<FinancePeriod>('monthly');
  const summary = FINANCE_SUMMARY[period];

  return (
    <div className="space-y-7">
      <PageHeading
        eyebrow="Keuangan"
        title="Ringkasan keuangan"
        description="Pendapatan dan biaya gateway pada data contoh terstruktur."
      />
      <DemoNotice />
      <div className="flex flex-wrap gap-2" aria-label="Periode ringkasan">
        {FINANCE_PERIODS.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={period === item}
            onClick={() => setPeriod(item)}
            className={`min-h-11 border-2 border-foreground px-4 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${period === item ? 'bg-primary text-primary-foreground shadow-[3px_3px_0_0_currentColor]' : 'bg-background'}`}
          >
            {periodLabels[item]}
          </button>
        ))}
      </div>
      <section
        aria-label={`Ringkasan ${periodLabels[period].toLowerCase()}`}
        className="grid gap-4 sm:grid-cols-3"
      >
        <Metric
          label="Pendapatan"
          value={money.format(summary.revenue)}
          note={periodLabels[period]}
        />
        <Metric
          label="Biaya gateway"
          value={money.format(summary.gatewayFee)}
          note="Nilai contoh"
        />
        <Metric
          label="Transaksi"
          value={summary.transactions.toLocaleString('id-ID')}
          note="Berhasil, contoh"
        />
      </section>
      <section aria-labelledby="outlet-breakdown-title" className="space-y-3">
        <div>
          <p className="text-sm font-semibold tracking-wide uppercase">
            Rincian pendapatan bulanan
          </p>
          <h2 id="outlet-breakdown-title" className="text-2xl font-bold">
            Per outlet dan booth
          </h2>
        </div>
        <div className="overflow-x-auto border-2 border-foreground">
          <table className="w-full min-w-[34rem] border-collapse text-left">
            <thead className="bg-secondary-background">
              <tr>
                <th className="p-3">Outlet / booth</th>
                <th className="p-3 text-right">Pendapatan contoh</th>
              </tr>
            </thead>
            <tbody>
              {OUTLET_BREAKDOWN.flatMap((outlet) => [
                <tr key={outlet.name} className="border-t-2 border-foreground font-bold">
                  <th className="p-3">{outlet.name}</th>
                  <td className="p-3 text-right">{money.format(outlet.revenue)}</td>
                </tr>,
                ...outlet.booths.map((booth) => (
                  <tr key={booth.name} className="border-t border-border">
                    <th scope="row" className="p-3 pl-7 font-normal">
                      {booth.name}
                    </th>
                    <td className="p-3 text-right">{money.format(booth.revenue)}</td>
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export function AnalyticsView() {
  const [days, setDays] = useState<7 | 30>(7);
  const revenue = days === 7 ? REVENUE_7_DAYS : REVENUE_30_DAYS;
  const chartLabel = days === 7 ? 'Hari' : 'Tanggal contoh';

  return (
    <div className="space-y-7">
      <PageHeading
        eyebrow="Analitik"
        title="Performa transaksi"
        description="Tren pendapatan, metode bayar, konversi sesi, dan pelanggan kembali."
      />
      <DemoNotice />
      <section
        aria-labelledby="revenue-chart-title"
        className="border-2 border-foreground p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold tracking-wide uppercase">Pendapatan</p>
            <h2 id="revenue-chart-title" className="text-xl font-bold">
              Tren {days} hari
            </h2>
          </div>
          <div className="flex gap-2" aria-label="Rentang tren pendapatan">
            {([7, 30] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={days === value}
                onClick={() => setDays(value)}
                className={`min-h-11 border-2 border-foreground px-4 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${days === value ? 'bg-primary text-primary-foreground' : 'bg-background'}`}
              >
                {value} hari
              </button>
            ))}
          </div>
        </div>
        <div
          className="mt-5 h-64 w-full"
          role="img"
          aria-label={`Grafik pendapatan contoh ${days} hari. ${revenue.map((point) => `${chartLabel} ${point.day}: ${money.format(point.revenue)}`).join('; ')}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={revenue} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                interval={days === 30 ? 4 : 0}
                tickFormatter={(value) => (days === 7 ? `H${value}` : `${value}`)}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={54}
                tickFormatter={(value) => `${Math.round(Number(value) / 1_000_000)} jt`}
              />
              <Tooltip
                formatter={(value) => money.format(Number(value))}
                labelFormatter={(value) => `${chartLabel} ${value}`}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                name="Pendapatan"
                stroke="var(--chart-1)"
                strokeWidth={3}
                dot={{ r: days === 7 ? 3 : 0 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <DataSummary
          rows={revenue.map(({ day, revenue: amount }) => [
            `${chartLabel} ${day}`,
            money.format(amount),
          ])}
        />
      </section>
      <div className="grid gap-5 xl:grid-cols-2">
        <section
          aria-labelledby="payment-chart-title"
          className="border-2 border-foreground p-4 sm:p-5"
        >
          <p className="text-sm font-semibold tracking-wide uppercase">Komposisi pembayaran</p>
          <h2 id="payment-chart-title" className="text-xl font-bold">
            Metode contoh
          </h2>
          <div
            className="mt-2 h-56"
            role="img"
            aria-label={`Diagram metode pembayaran: ${PAYMENT_METHODS.map(({ name, value }) => `${name} ${value}%`).join(', ')}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={PAYMENT_METHODS}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="48%"
                  outerRadius="78%"
                  paddingAngle={2}
                >
                  <LabelList
                    dataKey="value"
                    position="outside"
                    formatter={(value) => `${value}%`}
                  />
                  {PAYMENT_METHODS.map((item) => (
                    <Cell
                      key={item.name}
                      fill={item.fill}
                      stroke="var(--background)"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map((item) => (
              <li
                key={item.name}
                className="flex items-center justify-between border-t border-border py-2"
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="size-3 border border-foreground"
                    style={{ backgroundColor: item.fill }}
                  />
                  {item.name}
                </span>
                <strong>{item.value}%</strong>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="funnel-title" className="border-2 border-foreground p-4 sm:p-5">
          <p className="text-sm font-semibold tracking-wide uppercase">Konversi sesi</p>
          <h2 id="funnel-title" className="text-xl font-bold">
            Alur contoh
          </h2>
          <p className="mt-1 text-sm">
            Definisi contoh: sesi dimulai, pembayaran dimulai, transaksi berhasil.
          </p>
          <div
            className="mt-3 h-52"
            role="img"
            aria-label={`Funnel contoh: ${CONVERSION_FUNNEL.map(({ stage, count }) => `${stage}, ${count}`).join('; ')}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <FunnelChart>
                <Tooltip />
                <Funnel
                  dataKey="count"
                  data={CONVERSION_FUNNEL}
                  isAnimationActive={false}
                  fill="var(--chart-1)"
                >
                  <LabelList
                    position="right"
                    dataKey="stage"
                    fill="var(--foreground)"
                    stroke="none"
                  />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </div>
          <DataSummary
            rows={CONVERSION_FUNNEL.map(({ stage, count }) => [
              stage,
              count.toLocaleString('id-ID'),
            ])}
          />
        </section>
      </div>
      <section aria-labelledby="retention-title" className="border-2 border-foreground p-4 sm:p-5">
        <p className="text-sm font-semibold tracking-wide uppercase">Pelanggan kembali</p>
        <h2 id="retention-title" className="text-xl font-bold">
          Retensi mingguan contoh
        </h2>
        <p className="mt-1 text-sm">Persentase kohor contoh yang kembali pada minggu berikutnya.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {WEEKLY_RETENTION.map(({ week, returned }, index) => (
            <div key={week} className="border-t-2 border-foreground pt-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">{week}</span>
                <strong className="text-2xl">{returned}%</strong>
              </div>
              <div
                className="mt-2 h-3 border border-foreground"
                role="meter"
                aria-label={`Retensi ${week}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={returned}
              >
                <div className="bg-primary h-full" style={{ width: `${returned}%` }} />
              </div>
              {index > 0 && <p className="mt-1 text-sm">dari minggu pertama</p>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="border-b-2 border-foreground pb-5">
      <p className="text-sm font-semibold tracking-wide uppercase">{eyebrow}</p>
      <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
      <p className="text-muted-foreground mt-1 max-w-2xl">{description}</p>
    </header>
  );
}

function DemoNotice() {
  return (
    <aside
      className="border-2 border-foreground bg-secondary-background p-3 font-medium"
      role="note"
    >
      Data contoh terstruktur, bukan data transaksi bisnis aktual.
    </aside>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <article className="border-2 border-foreground p-4">
      <p className="font-semibold">{label}</p>
      <p className="mt-2 text-2xl font-bold break-words sm:text-3xl">{value}</p>
      <p className="text-muted-foreground mt-1 text-sm">{note}</p>
    </article>
  );
}

function DataSummary({ rows }: { rows: [string, string][] }) {
  return (
    <details className="mt-3 border-t border-border pt-2">
      <summary className="min-h-11 cursor-pointer py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2">
        Lihat nilai data
      </summary>
      <dl className="grid gap-x-4 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex justify-between gap-3 border-t border-border py-2 text-sm"
          >
            <dt>{label}</dt>
            <dd className="text-right font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
