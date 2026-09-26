'use client';
/**
 * Machine Manager — daftar booth realtime (PRD Task 2.3).
 *
 * Realtime hanya memicu refetch; angka yang tampil selalu berasal dari server
 * (`router.refresh()`). Status online ditandai teks + ikon + warna, bukan warna
 * saja (PRD Bab 4 aksesibilitas).
 */
import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button, Card, CardContent, Input } from '@snapbox/ui';
import { cn } from '@snapbox/ui/lib/cn';

import {
  createBoothWithPairing,
  regeneratePairingSession,
} from '@/app/(owner-dashboard)/owner-dashboard/machines/actions';
import type {
  MachineListData,
  MachineListRow,
  PairingSessionResult,
} from '@/lib/owner-dashboard/machine-contract';
import { useBoothRealtime } from './use-booth-realtime';

type Props = { data: MachineListData; tenantId: string };

const STATUS_LABEL: Record<MachineListRow['displayStatus'], string> = {
  ONLINE: 'Online',
  OFFLINE: 'Offline',
  MAINTENANCE: 'Maintenance',
  UNPAIRED: 'Belum terhubung',
};

const STATUS_CLASS: Record<MachineListRow['displayStatus'], string> = {
  ONLINE: 'bg-green-200',
  OFFLINE: 'bg-red-200',
  MAINTENANCE: 'bg-amber-200',
  UNPAIRED: 'bg-secondary-background',
};

function relativeTime(iso: string | null): string {
  if (!iso) return 'belum ada';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds} detik lalu`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} menit lalu`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} jam lalu`;
  return `${Math.floor(seconds / 86400)} hari lalu`;
}

export function MachinesView({ data, tenantId }: Props) {
  const router = useRouter();
  const realtime = useBoothRealtime(data.booths.map((booth) => booth.id));
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ name: '', outletId: '', locationTag: '' });
  const [pairing, setPairing] = useState<PairingSessionResult | null>(null);

  // Setiap event/kembalinya koneksi realtime memicu rekonsiliasi ke server.
  useEffect(() => {
    if (realtime.tick > 0) router.refresh();
  }, [realtime.tick, router]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createBoothWithPairing(form);
      setMessage(result.message);
      if (result.ok && result.boothId) {
        setForm({ name: '', outletId: '', locationTag: '' });
        const session = await fetch('/api/booth/pair-session', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ boothId: result.boothId }),
        }).then((response) => response.json() as Promise<PairingSessionResult>);
        setPairing(session);
        router.refresh();
      }
    });
  }

  function regenerate(boothId: string) {
    startTransition(async () => {
      const result = await regeneratePairingSession({ boothId });
      setMessage(result.message);
      if (result.ok) {
        const session = await fetch('/api/booth/pair-session', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ boothId }),
        }).then((response) => response.json() as Promise<PairingSessionResult>);
        setPairing(session);
      }
    });
  }

  const quotaText =
    data.quota.limit === null
      ? 'Tidak tersedia'
      : data.quota.limit === -1
        ? 'Tanpa batas'
        : `${data.quota.used} / ${data.quota.limit}`;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-sm font-medium tracking-[0.18em] uppercase">
            Operasional
          </p>
          <h1 className="text-3xl font-bold">Mesin</h1>
          <p className="text-muted-foreground">Pantau dan konfigurasi booth photobooth Anda.</p>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-2 border-2 border-border px-3 py-2 text-sm font-semibold',
            realtime.connected ? 'bg-green-200' : 'bg-amber-200',
          )}
          role="status"
          aria-live="polite"
        >
          <span aria-hidden="true">{realtime.connected ? '●' : '○'}</span>
          {realtime.connected ? 'Realtime aktif' : 'Realtime terputus — data dapat usang'}
        </span>
      </header>

      <Card className="border-4 shadow-[6px_6px_0_0_var(--color-border)]">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
          <span className="font-semibold">Kuota perangkat: {quotaText}</span>
          {data.quota.limit !== null && data.quota.limit !== -1 && (
            <span className="text-muted-foreground text-sm">
              Tambah add-on Rp99k/device bila kuota habis.
            </span>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <section aria-labelledby="machine-list-title">
          <h2 id="machine-list-title" className="mb-3 text-xl font-bold">
            Daftar booth
          </h2>
          {data.booths.length === 0 ? (
            <p className="border-2 border-dashed border-border p-6">
              Belum ada mesin. Tambah mesin pertama Anda di samping.
            </p>
          ) : (
            <div className="overflow-x-auto border-2 border-border">
              <table className="w-full border-collapse text-left text-sm">
                <caption className="sr-only">Booth tenant ini beserta status dan lokasinya</caption>
                <thead>
                  <tr className="bg-main">
                    {['Mesin', 'Lokasi', 'Status', 'Kertas', 'Heartbeat', ''].map((head) => (
                      <th key={head} scope="col" className="border-2 border-border px-3 py-2">
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.booths.map((booth, index) => {
                    const pct = booth.paperCapacity
                      ? Math.round((booth.paperCount / booth.paperCapacity) * 100)
                      : 0;
                    const lowPaper = pct <= 20;
                    return (
                      <tr
                        key={booth.id}
                        className={index % 2 === 1 ? 'bg-secondary-background' : ''}
                      >
                        <td className="border-2 border-border px-3 py-2">
                          <Link
                            className="font-semibold underline-offset-4 hover:underline"
                            href={`/owner-dashboard/machines/${booth.id}`}
                          >
                            {booth.name}
                          </Link>
                          {booth.pinLockEnabled && (
                            <span className="ml-2 border-2 border-border px-2 py-0.5 text-xs">
                              PIN Lock
                            </span>
                          )}
                        </td>
                        <td className="border-2 border-border px-3 py-2">
                          {booth.outletName ?? 'Tanpa outlet'}
                          {booth.locationTag ? ` · ${booth.locationTag}` : ''}
                        </td>
                        <td className="border-2 border-border px-3 py-2">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 border-2 border-border px-2 py-0.5 font-semibold',
                              STATUS_CLASS[booth.displayStatus],
                            )}
                          >
                            <span aria-hidden="true">
                              {booth.displayStatus === 'ONLINE' ? '●' : '○'}
                            </span>
                            {STATUS_LABEL[booth.displayStatus]}
                          </span>
                        </td>
                        <td className="border-2 border-border px-3 py-2">
                          <span className={lowPaper ? 'font-bold text-red-700' : ''}>
                            {booth.paperCount}/{booth.paperCapacity} ({pct}%)
                          </span>
                          {lowPaper && <span className="block text-xs">Kertas menipis</span>}
                        </td>
                        <td className="border-2 border-border px-3 py-2">
                          {relativeTime(booth.lastHeartbeatAt)}
                        </td>
                        <td className="border-2 border-border px-3 py-2">
                          <div className="flex flex-wrap gap-2">
                            <Link
                              className="inline-flex min-h-11 items-center border-2 border-border px-3 font-semibold"
                              href={`/owner-dashboard/machines/${booth.id}`}
                            >
                              Detail
                            </Link>
                            {booth.displayStatus === 'UNPAIRED' && (
                              <Button
                                type="button"
                                variant="neutral"
                                disabled={pending}
                                onClick={() => regenerate(booth.id)}
                              >
                                Kode pairing
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="space-y-6">
          <form
            onSubmit={submit}
            className="space-y-4 border-4 border-border bg-background p-5 shadow-[6px_6px_0_0_var(--color-border)]"
          >
            <h2 className="text-xl font-bold">Add New Device</h2>
            <p className="text-muted-foreground text-sm">
              Buat booth baru lalu tampilkan QR pairing (berlaku 10 menit, sekali pakai).
            </p>
            <label className="block text-sm font-semibold">
              Nama mesin
              <Input
                required
                className="mt-1"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>
            <label className="block text-sm font-semibold">
              Outlet
              <select
                className="mt-1 min-h-11 w-full border-2 border-border bg-background px-3 font-normal"
                value={form.outletId}
                onChange={(event) => setForm({ ...form, outletId: event.target.value })}
              >
                <option value="">Tanpa outlet</option>
                {data.outlets.map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>
                    {outlet.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              Tag lokasi
              <Input
                className="mt-1"
                value={form.locationTag}
                onChange={(event) => setForm({ ...form, locationTag: event.target.value })}
              />
            </label>
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? 'Memproses…' : 'Buat mesin + kode pairing'}
            </Button>
            <p role="status" aria-live="polite" className="min-h-5 text-sm">
              {message}
            </p>
          </form>

          {pairing?.ok && (
            <div className="space-y-3 border-4 border-border bg-main p-5 shadow-[6px_6px_0_0_var(--color-border)]">
              <h2 className="text-lg font-bold">Pairing QR</h2>
              {/* eslint-disable-next-line @next/next/no-img-element -- data URL PNG dari server, bukan aset optimasi */}
              <img
                src={pairing.qrDataUrl}
                alt="QR pairing booth; pindai dari SnapBox Desktop"
                className="mx-auto border-2 border-border bg-white p-2"
                width={220}
                height={220}
              />
              <p className="font-mono text-xs break-all">{pairing.boothId}</p>
              <p className="text-sm">
                Berlaku hingga {new Date(pairing.expiresAt).toLocaleTimeString('id-ID')}. Pindai
                dari Konsol Perangkat SnapBox Desktop.
              </p>
              {pairing.manualCode && <p className="font-mono text-lg">{pairing.manualCode}</p>}
            </div>
          )}
          {pairing && !pairing.ok && (
            <p className="border-4 border-border bg-red-200 p-4 font-semibold" role="alert">
              {pairing.message}
            </p>
          )}

          <p className="text-muted-foreground text-xs">
            Tenant <span className="font-mono">{tenantId.slice(0, 8)}</span> · konsumen QR
            (`/api/booth/pair`) dijalankan kiosk Fase 3.
          </p>
        </div>
      </div>
    </div>
  );
}
