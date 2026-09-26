'use client';
import { useState, useTransition } from 'react';
import {
  createPromo,
  deletePromo,
  togglePromo,
} from '@/app/(owner-dashboard)/owner-dashboard/promos/actions';
import type { OwnerPromoRow } from '@/lib/owner-dashboard/promo-contract';
const blank = {
  name: '',
  code: '',
  type: 'PERCENTAGE' as const,
  value: '10',
  minPurchase: '0',
  validFrom: new Date().toISOString(),
  validUntil: new Date(Date.now() + 86400000 * 30).toISOString(),
  quotaTotal: null as number | null,
  quotaPerCustomer: 1,
};
export function PromosView({
  enabled,
  rows: initial,
}: {
  enabled: boolean;
  rows: OwnerPromoRow[];
}) {
  const [rows, setRows] = useState(initial);
  const [form, setForm] = useState(blank);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState('');
  if (!enabled)
    return (
      <section className="space-y-3">
        <h1 className="text-3xl font-bold">Promo</h1>
        <p>Fitur promo tidak tersedia pada plan ini.</p>
      </section>
    );
  const input =
    'mt-1 min-h-11 w-full border-2 border-foreground bg-background px-3 focus-visible:outline-2 focus-visible:outline-offset-2';
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await createPromo(form);
      setMessage(r.message);
      if (r.ok) window.location.reload();
    });
  };
  const setField = (key: 'name' | 'code' | 'value' | 'minPurchase', value: string) =>
    setForm({ ...form, [key]: value });
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Promo & voucher</h1>
        <p>Kelola kode promo tenant.</p>
      </header>
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section className="space-y-3" aria-label="Daftar promo">
          {rows.length === 0 ? (
            <p className="border-2 border-dashed p-6">Belum ada promo.</p>
          ) : (
            rows.map((row) => (
              <article className="border-2 border-foreground p-4" key={row.id}>
                <div className="flex justify-between gap-3">
                  <div>
                    <h2 className="font-bold">{row.code}</h2>
                    <p>
                      {row.name ?? 'Tanpa nama'} ·{' '}
                      {row.type === 'PERCENTAGE'
                        ? `${row.value}%`
                        : `Rp ${Number(row.value).toLocaleString('id-ID')}`}
                    </p>
                    <p className="text-sm">
                      {row.status} · {row.quotaUsed} / {row.quotaTotal ?? 'tanpa batas'} ·{' '}
                      {row.redemptionCount} penukaran
                    </p>
                  </div>
                  <span>{row.isActive ? 'Aktif' : 'Nonaktif'}</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    className="min-h-11 border-2 border-foreground px-3"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await togglePromo({ promoId: row.id, isActive: !row.isActive });
                        setMessage(r.message);
                        if (r.ok)
                          setRows((x) =>
                            x.map((v) => (v.id === row.id ? { ...v, isActive: !v.isActive } : v)),
                          );
                      })
                    }
                  >
                    {row.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                  {row.isActive && (
                    <button
                      className="min-h-11 border-2 border-foreground px-3"
                      disabled={pending}
                      onClick={() => {
                        if (window.confirm('Nonaktifkan promo ini?'))
                          start(async () => {
                            const r = await deletePromo({ promoId: row.id });
                            setMessage(r.message);
                            if (r.ok)
                              setRows((x) =>
                                x.map((v) => (v.id === row.id ? { ...v, isActive: false } : v)),
                              );
                          });
                      }}
                    >
                      Hapus
                    </button>
                  )}
                </div>
              </article>
            ))
          )}
        </section>
        <form onSubmit={submit} className="space-y-4 border-2 border-foreground p-5">
          <h2 className="text-xl font-bold">Tambah promo</h2>
          <label className="block text-sm font-semibold">
            Nama
            <input
              className={input}
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
            />
          </label>
          <label className="block text-sm font-semibold">
            Kode
            <input
              className={input}
              required
              value={form.code}
              onChange={(e) => setField('code', e.target.value)}
            />
          </label>
          <label className="block text-sm font-semibold">
            Nilai
            <input
              className={input}
              required
              value={form.value}
              onChange={(e) => setField('value', e.target.value)}
            />
          </label>
          <label className="block text-sm font-semibold">
            Minimum pembelian
            <input
              className={input}
              required
              value={form.minPurchase}
              onChange={(e) => setField('minPurchase', e.target.value)}
            />
          </label>
          <label className="block text-sm font-semibold">
            Jenis
            <select
              className={input}
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })}
            >
              <option value="PERCENTAGE">Persentase</option>
              <option value="FIXED_AMOUNT">Nominal tetap</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              Mulai
              <input
                type="datetime-local"
                className={input}
                value={form.validFrom.slice(0, 16)}
                onChange={(e) =>
                  setForm({ ...form, validFrom: new Date(e.target.value).toISOString() })
                }
              />
            </label>
            <label>
              Berakhir
              <input
                type="datetime-local"
                className={input}
                value={form.validUntil.slice(0, 16)}
                onChange={(e) =>
                  setForm({ ...form, validUntil: new Date(e.target.value).toISOString() })
                }
              />
            </label>
          </div>
          <button
            className="min-h-11 border-2 border-foreground bg-foreground px-4 font-bold text-background"
            disabled={pending}
          >
            {pending ? 'Menyimpan...' : 'Simpan promo'}
          </button>
          <p role="status" aria-live="polite">
            {message}
          </p>
        </form>
      </div>
    </div>
  );
}
