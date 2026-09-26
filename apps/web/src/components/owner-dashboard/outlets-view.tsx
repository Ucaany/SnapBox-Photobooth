'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  createOutlet,
  setOutletActive,
  updateOutlet,
} from '@/app/(owner-dashboard)/owner-dashboard/outlets/actions';
import type { OutletListRow } from '@/lib/owner-dashboard/outlet-contract';

type Props = { outlets: OutletListRow[]; quota: { used: number; limit: number | null } };
const blank = {
  name: '',
  address: '',
  latitude: '',
  longitude: '',
  picName: '',
  picPhone: '',
  isActive: true,
};
export function OutletsView({ outlets, quota }: Props) {
  const [rows, setRows] = useState(outlets);
  const [form, setForm] = useState<typeof blank>(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const visible = rows.filter((row) => includeInactive || row.isActive);
  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = editing
        ? await updateOutlet({ ...form, id: editing })
        : await createOutlet(form);
      setMessage(result.message);
      if (result.ok) window.location.reload();
    });
  }
  function toggle(row: OutletListRow) {
    if (!window.confirm(`${row.isActive ? 'Nonaktifkan' : 'Aktifkan'} outlet ${row.name}?`)) return;
    startTransition(async () => {
      const result = await setOutletActive(row.id, !row.isActive);
      setMessage(result.message);
      if (result.ok)
        setRows((current) =>
          current.map((item) =>
            item.id === row.id ? { ...item, isActive: !item.isActive } : item,
          ),
        );
    });
  }
  return (
    <div className="space-y-8">
      <header>
        <p className="text-muted-foreground text-sm font-medium tracking-[0.18em] uppercase">
          Operasional
        </p>
        <h1 className="text-3xl font-bold">Outlet</h1>
        <p className="text-muted-foreground">Kelola lokasi operasional photobooth.</p>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-3 border-2 border-foreground p-4">
        <span>
          Kuota:{' '}
          {quota.limit === null
            ? 'Tidak tersedia'
            : quota.limit === -1
              ? 'Tanpa batas'
              : `${quota.used} / ${quota.limit}`}
        </span>
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
          />{' '}
          Tampilkan nonaktif
        </label>
      </div>
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="outlet-list-title">
          <h2 id="outlet-list-title" className="mb-3 text-xl font-bold">
            Daftar outlet
          </h2>
          {visible.length === 0 ? (
            <p className="border-2 border-dashed p-6">Belum ada outlet aktif.</p>
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
                      <p className="text-muted-foreground text-sm">
                        {row.address || 'Alamat belum diisi'} · {row.boothCount} booth
                      </p>
                    </div>
                    <span className="text-sm">{row.isActive ? 'Aktif' : 'Nonaktif'}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      className="inline-flex min-h-11 items-center border-2 border-foreground px-3 font-semibold underline-offset-4 hover:underline"
                      href={`/owner-dashboard/outlets/${row.id}`}
                    >
                      Lihat detail
                    </Link>
                    <button
                      className="min-h-11 border-2 border-foreground px-3 font-semibold"
                      onClick={() => {
                        setEditing(row.id);
                        setForm({
                          name: row.name,
                          address: row.address ?? '',
                          latitude: row.latitude ?? '',
                          longitude: row.longitude ?? '',
                          picName: row.picName ?? '',
                          picPhone: row.picPhone ?? '',
                          isActive: row.isActive,
                        });
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="min-h-11 border-2 border-foreground px-3"
                      onClick={() => toggle(row)}
                    >
                      {row.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        <form onSubmit={submit} className="space-y-4 border-2 border-foreground p-5">
          <h2 className="text-xl font-bold">{editing ? 'Edit outlet' : 'Tambah outlet'}</h2>
          {(['name', 'address', 'latitude', 'longitude', 'picName', 'picPhone'] as const).map(
            (field) => (
              <label key={field} className="block text-sm font-semibold">
                {field === 'name'
                  ? 'Nama outlet'
                  : field === 'picName'
                    ? 'Nama PIC'
                    : field === 'picPhone'
                      ? 'Telepon PIC'
                      : field === 'address'
                        ? 'Alamat'
                        : field === 'latitude'
                          ? 'Latitude'
                          : 'Longitude'}
                <input
                  required={field === 'name'}
                  className="mt-1 min-h-11 w-full border-2 border-foreground px-3 font-normal"
                  value={form[field]}
                  onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                />
              </label>
            ),
          )}
          <div className="flex gap-2">
            <button
              disabled={pending}
              className="min-h-11 border-2 border-foreground bg-foreground px-4 font-bold text-background"
            >
              {pending ? 'Menyimpan...' : 'Simpan outlet'}
            </button>
            {editing && (
              <button
                type="button"
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
