'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@snapbox/ui';
import type { OwnerDevicesData, OwnerDeviceRow } from '@/lib/owner-dashboard/device-contract';
import { revokeOwnerDevice } from '@/app/(owner-dashboard)/owner-dashboard/devices/actions';

function relativeTime(value: string | null) {
  if (!value) return 'Belum ada';
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  return minutes < 1
    ? 'Baru saja'
    : minutes < 60
      ? `${minutes} menit lalu`
      : `${Math.floor(minutes / 60)} jam lalu`;
}

export function DevicesView({ data }: { data: OwnerDevicesData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState('');
  const quota =
    data.quota.limit === null
      ? 'Tidak tersedia'
      : data.quota.limit === -1
        ? 'Tanpa batas'
        : `${data.quota.used} / ${data.quota.limit}`;
  function revoke(device: OwnerDeviceRow) {
    if (!window.confirm(`Lepas perangkat dari ${device.boothName}? Sesi aktif akan ditutup.`))
      return;
    startTransition(async () => {
      const result = await revokeOwnerDevice(device.id);
      setMessage(result.message);
      if (result.ok) router.refresh();
    });
  }
  return (
    <div className="space-y-6">
      <header>
        <p className="text-muted-foreground text-sm font-medium tracking-[0.18em] uppercase">
          Operasional
        </p>
        <h1 className="text-3xl font-bold">Perangkat</h1>
        <p className="text-muted-foreground">Perangkat aktif yang dipasangkan ke booth Anda.</p>
      </header>
      <section
        className="flex flex-wrap items-center justify-between gap-3 border-4 border-border p-4 shadow-[6px_6px_0_0_var(--color-border)]"
        aria-label="Kuota perangkat"
      >
        <div>
          <strong>Kuota: {quota}</strong>
          <p className="text-sm">Add-on aktif: {data.addOnDevices}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="inline-flex min-h-11 items-center border-2 border-border px-4 font-semibold"
            href="/owner-dashboard/subscription"
          >
            Perpanjang
          </Link>
          <Link
            className="inline-flex min-h-11 items-center border-2 border-border bg-main px-4 font-semibold shadow-[3px_3px_0_0_var(--color-border)]"
            href="/owner-dashboard/subscription"
          >
            Upgrade add-on
          </Link>
        </div>
        <p className="basis-full text-sm">
          Checkout dan perubahan kuota ditangani melalui langganan.
        </p>
      </section>
      {message && (
        <p role="status" aria-live="polite">
          {message}
        </p>
      )}
      {data.devices.length === 0 ? (
        <p className="border-2 border-dashed border-border p-6">Belum ada perangkat aktif.</p>
      ) : (
        <div className="overflow-x-auto border-2 border-border">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">Perangkat aktif tenant</caption>
            <thead>
              <tr className="bg-main">
                {['Perangkat', 'Booth', 'Platform / versi', 'Heartbeat', 'Status', 'Aksi'].map(
                  (label) => (
                    <th key={label} scope="col" className="border-2 border-border px-3 py-2">
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {data.devices.map((device, index) => (
                <tr key={device.id} className={index % 2 ? 'bg-secondary-background' : ''}>
                  <td className="border-2 border-border px-3 py-2">{device.fingerprintMasked}</td>
                  <td className="border-2 border-border px-3 py-2">
                    <Link
                      className="underline"
                      href={`/owner-dashboard/machines/${device.boothId}`}
                    >
                      {device.boothName}
                    </Link>
                  </td>
                  <td className="border-2 border-border px-3 py-2">
                    {device.platform ?? '—'} / {device.appVersion ?? '—'}
                  </td>
                  <td className="border-2 border-border px-3 py-2">
                    {relativeTime(device.lastHeartbeatAt)}
                  </td>
                  <td className="border-2 border-border px-3 py-2">
                    {device.status === 'ONLINE' ? 'Online' : 'Offline'}
                  </td>
                  <td className="border-2 border-border px-3 py-2">
                    <Button
                      type="button"
                      variant="neutral"
                      disabled={pending}
                      onClick={() => revoke(device)}
                      className="min-h-11"
                    >
                      Lepas
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pending && <p role="status">Memproses pelepasan perangkat…</p>}
    </div>
  );
}
