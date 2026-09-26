'use client';

import { Badge, Button } from '@snapbox/ui';

type SubscriptionData = Awaited<
  ReturnType<typeof import('@/lib/owner-dashboard/subscription-server').getOwnerSubscription>
>;
type Invoice = SubscriptionData['invoices'][number];

const statusLabels: Record<Invoice['status'], string> = {
  ACTIVE: 'Aktif',
  EXPIRING: 'Segera berakhir',
  GRACE_PERIOD: 'Masa tenggang',
  PENDING: 'Menunggu pembayaran',
  EXPIRED: 'Kedaluwarsa',
  SUSPENDED: 'Ditangguhkan',
  CANCELLED: 'Dibatalkan',
};

function formatDate(value: string | null) {
  if (!value) return 'Belum ditetapkan';
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date(value));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

function invoiceStatus(invoice: Invoice) {
  if (invoice.paidAt) return 'Lunas';
  if (invoice.status === 'PENDING' && invoice.invoiceId) return 'Menunggu';
  return statusLabels[invoice.status] ?? invoice.status;
}

export function SubscriptionView({ data }: { data: SubscriptionData }) {
  const current = data.invoices[0] ?? null;

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-sm font-medium tracking-[0.18em] uppercase">
            Akun & penagihan
          </p>
          <h1 className="text-3xl font-bold">Langganan</h1>
          <p className="text-muted-foreground mt-1">
            Status plan SnapBox dan riwayat invoice Pakasir B2B.
          </p>
        </div>
        <Badge variant="neutral">Checkout draft</Badge>
      </header>

      {current ? (
        <section
          aria-labelledby="current-subscription"
          className="border-4 border-border bg-main p-5 shadow-[6px_6px_0_0_var(--color-border)] sm:p-7"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold tracking-wide uppercase">Plan saat ini</p>
              <h2 id="current-subscription" className="mt-1 text-3xl font-bold">
                {current.planName}
              </h2>
              <p className="font-mono text-sm">{current.planTier}</p>
            </div>
            <span className="inline-flex min-h-11 items-center border-2 border-border bg-background px-3 font-bold">
              {statusLabels[current.status] ?? current.status}
            </span>
          </div>
          <dl className="mt-6 grid gap-4 border-t-2 border-border pt-5 sm:grid-cols-3">
            <div>
              <dt className="text-sm">Biaya per bulan</dt>
              <dd className="text-xl font-bold">{formatMoney(current.monthlyPrice)}</dd>
            </div>
            <div>
              <dt className="text-sm">Tanggal mulai</dt>
              <dd className="font-semibold">{formatDate(current.validFrom)}</dd>
            </div>
            <div>
              <dt className="text-sm">Berlaku sampai</dt>
              <dd className="font-semibold">{formatDate(current.validUntil)}</dd>
            </div>
          </dl>
          <div className="mt-5 flex flex-wrap gap-3">
            {current.paymentUrl ? (
              <Button
                type="button"
                variant="neutral"
                render={
                  <a href={current.paymentUrl} target="_blank" rel="noopener noreferrer">
                    Lanjutkan pembayaran
                  </a>
                }
              />
            ) : null}
            <Button type="button" variant="neutral" disabled title="Checkout Owner belum tersedia.">
              Perpanjang (segera hadir)
            </Button>
          </div>
        </section>
      ) : (
        <section className="border-4 border-border p-6 shadow-[6px_6px_0_0_var(--color-border)]">
          <h2 className="text-xl font-bold">Belum ada langganan</h2>
          <p className="mt-2">Belum ditemukan subscription atau invoice untuk tenant ini.</p>
        </section>
      )}

      <section aria-labelledby="plan-options" className="space-y-3">
        <div>
          <h2 id="plan-options" className="text-xl font-bold">
            Pilihan plan
          </h2>
          <p className="text-muted-foreground text-sm">
            Harga mengikuti katalog plan aktif. Perubahan masih draft.
          </p>
        </div>
        {data.plans.length ? (
          <div className="overflow-x-auto border-2 border-border">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">Plan SnapBox dan harga bulanan</caption>
              <thead>
                <tr className="bg-main">
                  {['Plan', 'Tier', 'Harga bulanan', 'Aksi'].map((label) => (
                    <th key={label} scope="col" className="border-2 border-border px-3 py-2">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.plans.map((plan) => (
                  <tr key={plan.id}>
                    <td className="border-2 border-border px-3 py-2 font-semibold">{plan.name}</td>
                    <td className="border-2 border-border px-3 py-2">{plan.tier}</td>
                    <td className="border-2 border-border px-3 py-2">
                      {formatMoney(plan.priceMonthly)}
                    </td>
                    <td className="border-2 border-border px-3 py-2">
                      <Button
                        type="button"
                        variant="neutral"
                        disabled
                        title="Checkout Owner belum tersedia."
                      >
                        {current?.planTier === plan.tier
                          ? 'Plan aktif'
                          : 'Upgrade / downgrade draft'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>Belum ada katalog plan aktif.</p>
        )}
      </section>

      <section aria-labelledby="addons" className="border-2 border-border p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 id="addons" className="text-xl font-bold">
              Add-on perangkat
            </h2>
            <p className="text-muted-foreground text-sm">
              Aktif saat ini: {data.addOnDevices} perangkat tambahan.
            </p>
          </div>
          <Button type="button" variant="neutral" disabled title="Checkout Owner belum tersedia.">
            Tambah add-on (draft)
          </Button>
        </div>
        <p className="mt-3 text-sm">Harga add-on ditampilkan saat checkout tersedia.</p>
      </section>

      <section aria-labelledby="invoice-history" className="space-y-3">
        <div>
          <h2 id="invoice-history" className="text-xl font-bold">
            Histori invoice
          </h2>
          <p className="text-muted-foreground text-sm">
            Data subscription tenant ini; status lunas hanya dari catatan pembayaran server.
          </p>
        </div>
        {data.invoices.length ? (
          <div className="overflow-x-auto border-2 border-border">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">Histori invoice langganan Pakasir</caption>
              <thead>
                <tr className="bg-main">
                  {['Invoice', 'Plan', 'Nominal', 'Status', 'Dibuat', 'Dibayar', 'Aksi'].map(
                    (label) => (
                      <th key={label} scope="col" className="border-2 border-border px-3 py-2">
                        {label}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((invoice, index) => (
                  <tr key={invoice.id} className={index % 2 ? 'bg-secondary-background' : ''}>
                    <td className="border-2 border-border px-3 py-2 font-mono">
                      {invoice.invoiceId ?? 'Belum diterbitkan'}
                    </td>
                    <td className="border-2 border-border px-3 py-2">{invoice.planName}</td>
                    <td className="border-2 border-border px-3 py-2">
                      {formatMoney(invoice.amount)}
                    </td>
                    <td className="border-2 border-border px-3 py-2">{invoiceStatus(invoice)}</td>
                    <td className="border-2 border-border px-3 py-2">
                      {formatDate(invoice.createdAt)}
                    </td>
                    <td className="border-2 border-border px-3 py-2">
                      {formatDate(invoice.paidAt)}
                    </td>
                    <td className="border-2 border-border px-3 py-2">
                      {invoice.paymentUrl ? (
                        <a
                          className="inline-flex min-h-11 items-center underline"
                          href={invoice.paymentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Buka pembayaran
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="border-2 border-dashed border-border p-5">Belum ada invoice.</p>
        )}
      </section>

      <p className="border-l-4 border-border pl-3 text-sm" role="note">
        Checkout perpanjangan, perubahan plan, dan pembelian add-on belum terhubung ke Pakasir.
        Tombol draft tidak membuat invoice atau mengubah langganan.
      </p>
    </div>
  );
}
