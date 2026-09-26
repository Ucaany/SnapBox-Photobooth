export type FinancePeriod = 'daily' | 'weekly' | 'monthly';

export const FINANCE_PERIODS: readonly FinancePeriod[] = ['daily', 'weekly', 'monthly'];

export const FINANCE_SUMMARY: Record<
  FinancePeriod,
  { revenue: number; gatewayFee: number; transactions: number }
> = {
  daily: { revenue: 1_840_000, gatewayFee: 42_320, transactions: 23 },
  weekly: { revenue: 12_460_000, gatewayFee: 286_580, transactions: 154 },
  monthly: { revenue: 48_920_000, gatewayFee: 1_125_160, transactions: 612 },
};

export const OUTLET_BREAKDOWN = [
  {
    name: 'Contoh Outlet A',
    revenue: 25_380_000,
    booths: [
      { name: 'Booth 01', revenue: 14_220_000 },
      { name: 'Booth 02', revenue: 11_160_000 },
    ],
  },
  {
    name: 'Contoh Outlet B',
    revenue: 16_740_000,
    booths: [
      { name: 'Booth 03', revenue: 9_120_000 },
      { name: 'Booth 04', revenue: 7_620_000 },
    ],
  },
  {
    name: 'Contoh Outlet C',
    revenue: 6_800_000,
    booths: [{ name: 'Booth 05', revenue: 6_800_000 }],
  },
];

export const REVENUE_30_DAYS = Array.from({ length: 30 }, (_, index) => {
  const day = index + 1;
  return { day, revenue: 1_120_000 + ((day * 173_000 + (day % 4) * 91_000) % 1_420_000) };
});

export const REVENUE_7_DAYS = REVENUE_30_DAYS.slice(-7);

export const PAYMENT_METHODS = [
  { name: 'QRIS', value: 48, fill: 'var(--chart-1)' },
  { name: 'Tunai', value: 27, fill: 'var(--chart-2)' },
  { name: 'Kartu', value: 15, fill: 'var(--chart-3)' },
  { name: 'Transfer', value: 10, fill: 'var(--chart-4)' },
];

export const CONVERSION_FUNNEL = [
  { stage: 'Sesi dimulai', count: 1_000 },
  { stage: 'Pembayaran dimulai', count: 640 },
  { stage: 'Transaksi berhasil', count: 512 },
];

export const WEEKLY_RETENTION = [
  { week: 'Minggu 1', returned: 100 },
  { week: 'Minggu 2', returned: 38 },
  { week: 'Minggu 3', returned: 24 },
  { week: 'Minggu 4', returned: 17 },
];

export function validateFinanceAnalyticsDemo() {
  return (
    REVENUE_7_DAYS.length === 7 &&
    REVENUE_30_DAYS.length === 30 &&
    CONVERSION_FUNNEL.every(
      (stage, index, values) => index === 0 || stage.count <= values[index - 1]!.count,
    ) &&
    PAYMENT_METHODS.reduce((total, method) => total + method.value, 0) === 100 &&
    WEEKLY_RETENTION.every(({ returned }) => returned >= 0 && returned <= 100) &&
    OUTLET_BREAKDOWN.reduce((total, outlet) => total + outlet.revenue, 0) ===
      FINANCE_SUMMARY.monthly.revenue &&
    OUTLET_BREAKDOWN.every(
      (outlet) =>
        outlet.booths.reduce((total, booth) => total + booth.revenue, 0) === outlet.revenue,
    )
  );
}
