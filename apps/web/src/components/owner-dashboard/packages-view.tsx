'use client';

import { useState, useTransition } from 'react';
import {
  createPackage,
  deletePackage,
  setPackageActive,
  updatePackage,
} from '@/app/(owner-dashboard)/owner-dashboard/packages/actions';
import type { OwnerPackage, PackageBooth } from '@/lib/owner-dashboard/package-contract';

const blank = {
  name: '',
  price: '',
  boothId: '',
  poseCount: 1,
  printCount: 1,
  retakeLimit: -1,
  includeGif: true,
  printSize: '4x6' as '2x6' | '4x6',
  sortOrder: 0,
  isActive: true,
};
type Form = typeof blank;

export function PackagesView({
  data,
}: {
  data: { packages: OwnerPackage[]; booths: PackageBooth[] };
}) {
  const [rows, setRows] = useState(data.packages);
  const [form, setForm] = useState<Form>(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const visible = rows.filter((row) => includeInactive || row.isActive);

  function edit(row: OwnerPackage) {
    setEditing(row.id);
    setForm({
      name: row.name,
      price: row.price,
      boothId: row.boothId ?? '',
      poseCount: row.poseCount,
      printCount: row.printCount,
      retakeLimit: row.retakeLimit,
      includeGif: row.includeGif,
      printSize: row.printSize as Form['printSize'],
      sortOrder: row.sortOrder,
      isActive: row.isActive,
    });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = editing
        ? await updatePackage({ ...form, id: editing })
        : await createPackage(form);
      setMessage(result.message);
      if (result.ok) window.location.reload();
    });
  }

  function toggle(row: OwnerPackage) {
    startTransition(async () => {
      const result = await setPackageActive(row.id, !row.isActive);
      setMessage(result.message);
      if (result.ok)
        setRows((current) =>
          current.map((item) => (item.id === row.id ? { ...item, isActive: !row.isActive } : item)),
        );
    });
  }

  function remove(row: OwnerPackage) {
    if (!window.confirm(`Hapus paket ${row.name}?`)) return;
    startTransition(async () => {
      const result = await deletePackage(row.id);
      setMessage(result.message);
      if (result.ok) setRows((current) => current.filter((item) => item.id !== row.id));
    });
  }

  const inputClass =
    'mt-1 min-h-11 w-full border-2 border-foreground bg-background px-3 font-normal focus-visible:outline-2 focus-visible:outline-offset-2';
  return (
    <div className="space-y-8">
      <header>
        <p className="text-muted-foreground text-sm font-medium tracking-[0.18em] uppercase">
          Penjualan
        </p>
        <h1 className="text-3xl font-bold">Paket</h1>
        <p className="text-muted-foreground">Atur harga dan isi paket tenant atau booth.</p>
      </header>
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="package-list-title">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 id="package-list-title" className="text-xl font-bold">
              Daftar paket
            </h2>
            <label className="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(event) => setIncludeInactive(event.target.checked)}
              />
              Tampilkan nonaktif
            </label>
          </div>
          {visible.length === 0 ? (
            <p className="border-2 border-dashed p-6">
              {rows.length ? 'Tidak ada paket aktif.' : 'Belum ada paket.'}
            </p>
          ) : (
            <div className="space-y-3">
              {visible.map((row) => (
                <article
                  key={row.id}
                  className="border-2 border-foreground p-4 shadow-[4px_4px_0_0_currentColor]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold">{row.name}</h3>
                      <p>
                        Rp {Number(row.price).toLocaleString('id-ID')} ·{' '}
                        {row.boothName ?? 'Semua booth'}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {row.poseCount} pose · {row.printCount} cetak ·{' '}
                        {row.retakeLimit < 0 ? 'Retake tanpa batas' : `${row.retakeLimit} retake`} ·{' '}
                        {row.printSize} · GIF {row.includeGif ? 'ya' : 'tidak'}
                      </p>
                    </div>
                    <span>{row.isActive ? 'Aktif' : 'Nonaktif'}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      disabled={pending}
                      className="min-h-11 border-2 border-foreground px-3 font-semibold"
                      onClick={() => edit(row)}
                    >
                      Edit
                    </button>
                    <button
                      disabled={pending}
                      className="min-h-11 border-2 border-foreground px-3"
                      onClick={() => toggle(row)}
                    >
                      {row.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                    <button
                      disabled={pending}
                      className="min-h-11 border-2 border-foreground px-3 focus-visible:outline-2 focus-visible:outline-offset-2"
                      onClick={() => remove(row)}
                    >
                      Hapus
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        <form onSubmit={submit} className="space-y-4 border-2 border-foreground p-5">
          <h2 className="text-xl font-bold">{editing ? 'Edit paket' : 'Tambah paket'}</h2>
          <label className="block text-sm font-semibold">
            Nama paket
            <input
              required
              maxLength={100}
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="block text-sm font-semibold">
            Harga (Rp)
            <input
              required
              inputMode="decimal"
              placeholder="25000"
              className={inputClass}
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </label>
          <label className="block text-sm font-semibold">
            Cakupan
            <select
              className={inputClass}
              value={form.boothId}
              onChange={(e) => setForm({ ...form, boothId: e.target.value })}
            >
              <option value="">Semua booth tenant</option>
              {data.booths.map((booth) => (
                <option key={booth.id} value={booth.id}>
                  {booth.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-semibold">
              Jumlah pose
              <input
                type="number"
                min={1}
                max={1000}
                required
                className={inputClass}
                value={form.poseCount}
                onChange={(e) => setForm({ ...form, poseCount: Number(e.target.value) })}
              />
            </label>
            <label className="block text-sm font-semibold">
              Jumlah cetak
              <input
                type="number"
                min={1}
                max={1000}
                required
                className={inputClass}
                value={form.printCount}
                onChange={(e) => setForm({ ...form, printCount: Number(e.target.value) })}
              />
            </label>
          </div>
          <label className="block text-sm font-semibold">
            Batas retake
            <select
              className={inputClass}
              value={form.retakeLimit}
              onChange={(e) => setForm({ ...form, retakeLimit: Number(e.target.value) })}
            >
              <option value={-1}>Tanpa batas</option>
              {[0, 1, 2, 3, 5, 10].map((limit) => (
                <option key={limit} value={limit}>
                  {limit}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold">
            Ukuran cetak
            <select
              className={inputClass}
              value={form.printSize}
              onChange={(e) => setForm({ ...form, printSize: e.target.value as Form['printSize'] })}
            >
              <option value="2x6">2x6</option>
              <option value="4x6">4x6</option>
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2 font-semibold">
            <input
              type="checkbox"
              checked={form.includeGif}
              onChange={(e) => setForm({ ...form, includeGif: e.target.checked })}
            />
            Termasuk GIF
          </label>
          <label className="block text-sm font-semibold">
            Urutan
            <input
              type="number"
              min={-10000}
              max={10000}
              className={inputClass}
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
            />
          </label>
          <label className="flex min-h-11 items-center gap-2 font-semibold">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Aktif
          </label>
          <div className="flex gap-2">
            <button
              disabled={pending}
              className="min-h-11 border-2 border-foreground bg-foreground px-4 font-bold text-background"
            >
              {pending ? 'Menyimpan...' : 'Simpan paket'}
            </button>
            {editing && (
              <button
                type="button"
                disabled={pending}
                className="min-h-11 border-2 border-foreground px-4"
                onClick={() => {
                  setEditing(null);
                  setForm(blank);
                }}
              >
                Batal
              </button>
            )}
          </div>
          <p role="status" aria-live="polite">
            {message}
          </p>
        </form>
      </div>
    </div>
  );
}
