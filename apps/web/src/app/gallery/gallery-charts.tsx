'use client';

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
  ChartTooltip,
  ChartTooltipContent,
} from '@snapbox/ui';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import type { ChartConfig } from '@snapbox/ui';

const SESSION_TREND = [
  { hari: 'Senin', sesi: 82 },
  { hari: 'Selasa', sesi: 96 },
  { hari: 'Rabu', sesi: 74 },
  { hari: 'Kamis', sesi: 120 },
  { hari: 'Jumat', sesi: 158 },
  { hari: 'Sabtu', sesi: 214 },
  { hari: 'Minggu', sesi: 196 },
];

const OUTLET_REVENUE = [
  { outlet: 'Grand Indonesia', pendapatan: 12400000 },
  { outlet: 'Kota Kasablanka', pendapatan: 9800000 },
  { outlet: 'Senayan Park', pendapatan: 7400000 },
];

const CHART_SESSIONS_CONFIG = {
  sesi: { label: 'Sesi foto', color: 'var(--chart-1)' },
} satisfies ChartConfig;

const CHART_REVENUE_CONFIG = {
  pendapatan: { label: 'Pendapatan (Rupiah)', color: 'var(--chart-5)' },
} satisfies ChartConfig;

/**
 * Dua grafik dipisah ke berkas sendiri bersama `recharts`.
 *
 * Berkas ini di-`lazy` dari `primitives-section.tsx` lewat `next/dynamic`
 * (`ssr: false`) supaya `recharts` (sekitar 218 kB) keluar dari jalur kritis
 * halaman `/`. Grafik baru dimuat setelah hidrasi, saat memang dibutuhkan.
 */
export function SessionTrendChart() {
  return (
    <div className="rounded-base border-2 border-border bg-secondary-background p-4">
      <ChartContainer config={CHART_SESSIONS_CONFIG} className="h-56 w-full">
        <AreaChart accessibilityLayer data={SESSION_TREND} margin={{ left: 8, right: 8 }}>
          <ChartStyle id="chart-sesi" config={CHART_SESSIONS_CONFIG} />
          <CartesianGrid vertical={false} />
          <XAxis dataKey="hari" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} width={32} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Area
            dataKey="sesi"
            type="monotone"
            fill="var(--color-sesi)"
            fillOpacity={0.4}
            stroke="var(--color-sesi)"
            strokeWidth={2}
          />
        </AreaChart>
      </ChartContainer>
      <ChartLegend content={<ChartLegendContent nameKey="sesi" />} />
    </div>
  );
}

export function OutletRevenueChart() {
  return (
    <div className="rounded-base border-2 border-border bg-secondary-background p-4">
      <ChartContainer config={CHART_REVENUE_CONFIG} className="h-56 w-full">
        <BarChart accessibilityLayer data={OUTLET_REVENUE} margin={{ left: 8, right: 8 }}>
          <ChartStyle id="chart-pendapatan" config={CHART_REVENUE_CONFIG} />
          <CartesianGrid vertical={false} />
          <XAxis dataKey="outlet" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} width={56} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="pendapatan" fill="var(--color-pendapatan)" radius={4} />
        </BarChart>
      </ChartContainer>
      <ChartLegend content={<ChartLegendContent nameKey="pendapatan" />} />
    </div>
  );
}
