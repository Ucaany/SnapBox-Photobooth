'use client';

import { useState, useTransition } from 'react';
import {
  createStaff,
  resendStaffInvite,
  setStaffActive,
  updateStaff,
} from '@/app/(owner-dashboard)/owner-dashboard/staff/actions';
import type { StaffListRow, StaffQuota } from '@/lib/owner-dashboard/staff-contract';

export function StaffView({
  initialStaff,
  initialQuota,
  companyName,
}: {
  initialStaff: StaffListRow[];
  initialQuota: StaffQuota;
  companyName: string;
}) {
  const [rows] = useState(initialStaff);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const visible = rows.filter((row) => includeInactive || !row.disabled);
  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = editing
        ? await updateStaff({ id: editing, fullName: name })
        : await createStaff({ fullName: name, email });
      setMessage(result.message);
      if (result.ok) window.location.reload();
    });
  }
  function action(
    result: Promise<ReturnType<typeof setStaffActive> extends Promise<infer T> ? T : never>,
  ) {
    startTransition(async () => setMessage((await result).message));
  }
  return (
    <div className="space-y-8">
      <header>
        <p className="text-muted-foreground text-sm font-medium tracking-[0.18em] uppercase">
          Akses tim
        </p>
        <h1 className="text-3xl font-bold">Staff</h1>
        <p className="text-muted-foreground">
          Kelola akses staff untuk {companyName}. Email tidak dapat diubah setelah undangan.
        </p>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-3 border-2 border-foreground p-4">
        <strong>
          Kuota:{' '}
          {initialQuota.limit === null
            ? 'Tidak tersedia'
            : initialQuota.limit === -1
              ? 'Tanpa batas'
              : `${initialQuota.used} / ${initialQuota.limit}`}
        </strong>
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(event) => setIncludeInactive(event.target.checked)}
          />{' '}
          Tampilkan nonaktif
        </label>
      </div>
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="staff-list-title">
          <h2 id="staff-list-title" className="mb-3 text-xl font-bold">
            Daftar staff
          </h2>
          {visible.length === 0 ? (
            <p className="border-2 border-dashed p-6">
              Belum ada staff {includeInactive ? '' : 'aktif'}.
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
                      <h3 className="font-bold">{row.fullName}</h3>
                      <p className="text-muted-foreground text-sm">{row.email}</p>
                    </div>
                    <span>{row.disabled ? 'Nonaktif' : 'Aktif'}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      className="min-h-11 border-2 border-foreground px-3 font-semibold"
                      onClick={() => {
                        setEditing(row.id);
                        setName(row.fullName);
                        setEmail('');
                      }}
                    >
                      Edit nama
                    </button>
                    <button
                      className="min-h-11 border-2 border-foreground px-3"
                      onClick={() => {
                        if (
                          window.confirm(
                            `${row.disabled ? 'Aktifkan' : 'Nonaktifkan'} ${row.fullName}?`,
                          )
                        )
                          action(setStaffActive({ id: row.id, isActive: row.disabled }));
                      }}
                    >
                      {row.disabled ? 'Aktifkan' : 'Nonaktifkan'}
                    </button>
                    {!row.disabled && (
                      <button
                        className="min-h-11 border-2 border-foreground px-3"
                        onClick={() => action(resendStaffInvite(row.id))}
                      >
                        Kirim ulang undangan
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        <form onSubmit={submit} className="space-y-4 border-2 border-foreground p-5">
          <h2 className="text-xl font-bold">{editing ? 'Edit staff' : 'Tambah staff'}</h2>
          <label className="block text-sm font-semibold">
            Nama lengkap
            <input
              required
              minLength={2}
              className="mt-1 min-h-11 w-full border-2 border-foreground px-3 font-normal"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          {!editing && (
            <label className="block text-sm font-semibold">
              Email
              <input
                required
                type="email"
                className="mt-1 min-h-11 w-full border-2 border-foreground px-3 font-normal"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
          )}
          <div className="flex gap-2">
            <button
              disabled={pending}
              className="min-h-11 border-2 border-foreground bg-foreground px-4 font-bold text-background"
            >
              {pending ? 'Menyimpan...' : 'Simpan staff'}
            </button>
            {editing && (
              <button
                type="button"
                className="min-h-11 border-2 border-foreground px-4"
                onClick={() => {
                  setEditing(null);
                  setName('');
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
