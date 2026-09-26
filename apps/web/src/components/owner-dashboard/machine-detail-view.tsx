'use client';
/**
 * Detail mesin (PRD Task 2.3, Bab 6.B/6.K).
 *
 * Menyediakan harga paket khusus booth, hitung/isi kertas, maintenance mode,
 * PIN Lock, lepas perangkat (revoke), riwayat sesi, dan QR pairing. Semua mutasi
 * melalui server action tenant-scoped; realtime hanya memicu rekonsiliasi.
 */
import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button, Card, CardContent, Input, Switch } from '@snapbox/ui';
import { cn } from '@snapbox/ui/lib/cn';

import {
  regeneratePairingSession,
  revokeBoothDevice,
  setPinLock,
  updateBooth,
  updateBoothPackagePrice,
} from '@/app/(owner-dashboard)/owner-dashboard/machines/actions';
import type { MachineDetail, PairingSessionResult } from '@/lib/owner-dashboard/machine-contract';
import { useBoothRealtime } from './use-booth-realtime';

type Props = {
  machine: MachineDetail;
  outlets: { id: string; name: string }[];
  tenantId: string;
};

const STATUS_LABEL: Record<MachineDetail['displayStatus'], string> = {
  ONLINE: 'Online',
  OFFLINE: 'Offline',
  MAINTENANCE: 'Maintenance',
  UNPAIRED: 'Belum terhubung',
};

function idr(value: string): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(
    Number(value),
  );
}

export function MachineDetailView({ machine, outlets, tenantId }: Props) {
  const router = useRouter();
  const realtime = useBoothRealtime([machine.id]);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState('');
  const [pairing, setPairing] = useState<PairingSessionResult | null>(null);

  const [settings, setSettings] = useState({
    name: machine.name,
    outletId: machine.outletId ?? '',
    locationTag: machine.locationTag ?? '',
    paperCount: String(machine.paperCount),
    paperCapacity: String(machine.paperCapacity),
    maintenanceMode: machine.maintenanceMode,
  });
  const [pin, setPin] = useState('');
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(machine.packages.map((pkg) => [pkg.id, pkg.price])),
  );

  useEffect(() => {
    if (realtime.tick > 0) router.refresh();
  }, [realtime.tick, router]);

  function run(task: () => Promise<{ message: string; ok: boolean }>) {
    startTransition(async () => {
      const result = await task();
      setMessage(result.message);
      if (result.ok) router.refresh();
    });
  }

  function saveSettings(event: React.FormEvent) {
    event.preventDefault();
    run(() =>
      updateBooth({
        id: machine.id,
        name: settings.name,
        outletId: settings.outletId,
        locationTag: settings.locationTag,
        paperCount: settings.paperCount,
        paperCapacity: settings.paperCapacity,
        maintenanceMode: settings.maintenanceMode,
      }),
    );
  }

  function toggleMaintenance(next: boolean) {
    setSettings((current) => ({ ...current, maintenanceMode: next }));
    run(() =>
      updateBooth({
        id: machine.id,
        name: settings.name,
        outletId: settings.outletId,
        locationTag: settings.locationTag,
        maintenanceMode: next,
      }),
    );
  }

  function togglePinLock(next: boolean) {
    run(() => setPinLock({ boothId: machine.id, enabled: next, pin: pin || null }));
    if (!next) setPin('');
  }

  function revoke() {
    if (
      !window.confirm(
        `Lepas perangkat dari ${machine.name}? Kiosk akan kembali ke layar "Belum terhubung".`,
      )
    )
      return;
    run(() => revokeBoothDevice(machine.id));
  }

  function newPairing() {
    run(async () => {
      const result = await regeneratePairingSession({ boothId: machine.id });
      if (result.ok) {
        const session = await fetch('/api/booth/pair-session', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ boothId: machine.id }),
        }).then((response) => response.json() as Promise<PairingSessionResult>);
        setPairing(session);
      }
      return result;
    });
  }

  const pct = machine.paperCapacity
    ? Math.round((machine.paperCount / machine.paperCapacity) * 100)
    : 0;
  const lowPaper = pct <= machine.paperAlertThresholdPct;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/owner-dashboard/machines"
          className="text-sm font-semibold underline-offset-4 hover:underline"
        >
          ← Kembali ke daftar mesin
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <h1 className="text-3xl font-bold">{machine.name}</h1>
          <span
            className={cn(
              'inline-flex items-center gap-2 border-2 border-border px-3 py-1 font-semibold',
              machine.displayStatus === 'ONLINE' && 'bg-green-200',
              machine.displayStatus === 'OFFLINE' && 'bg-red-200',
              machine.displayStatus === 'MAINTENANCE' && 'bg-amber-200',
              machine.displayStatus === 'UNPAIRED' && 'bg-secondary-background',
            )}
          >
            <span aria-hidden="true">{machine.displayStatus === 'ONLINE' ? '●' : '○'}</span>
            {STATUS_LABEL[machine.displayStatus]}
          </span>
          {realtime.connected ? (
            <span className="text-sm">Realtime aktif</span>
          ) : (
            <span className="text-sm">Realtime terputus — data dapat usang</span>
          )}
        </div>
        <p className="text-muted-foreground mt-2">
          {machine.outletName ?? 'Tanpa outlet'}
          {machine.locationTag ? ` · ${machine.locationTag}` : ''} · Fingerprint{' '}
          <span className="font-mono">{machine.deviceFingerprintMasked ?? '—'}</span>
        </p>
      </div>

      <p role="status" aria-live="polite" className="min-h-5 font-semibold">
        {message}
      </p>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card className="border-4 shadow-[6px_6px_0_0_var(--color-border)]">
          <CardContent className="space-y-4 pt-6">
            <h2 className="text-xl font-bold">Konfigurasi booth</h2>
            <form onSubmit={saveSettings} className="space-y-4">
              <label className="block text-sm font-semibold">
                Nama mesin
                <Input
                  required
                  className="mt-1"
                  value={settings.name}
                  onChange={(event) => setSettings({ ...settings, name: event.target.value })}
                />
              </label>
              <label className="block text-sm font-semibold">
                Outlet
                <select
                  className="mt-1 min-h-11 w-full border-2 border-border bg-background px-3 font-normal"
                  value={settings.outletId}
                  onChange={(event) => setSettings({ ...settings, outletId: event.target.value })}
                >
                  <option value="">Tanpa outlet</option>
                  {outlets.map((outlet) => (
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
                  value={settings.locationTag}
                  onChange={(event) =>
                    setSettings({ ...settings, locationTag: event.target.value })
                  }
                />
              </label>
              <div className="flex flex-wrap gap-4">
                <label className="block text-sm font-semibold">
                  Sisa kertas
                  <Input
                    type="number"
                    min={0}
                    className="mt-1 w-32"
                    value={settings.paperCount}
                    onChange={(event) =>
                      setSettings({ ...settings, paperCount: event.target.value })
                    }
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Kapasitas
                  <Input
                    type="number"
                    min={1}
                    className="mt-1 w-32"
                    value={settings.paperCapacity}
                    onChange={(event) =>
                      setSettings({ ...settings, paperCapacity: event.target.value })
                    }
                  />
                </label>
              </div>
              <p className={lowPaper ? 'font-bold text-red-700' : ''}>
                {machine.paperCount}/{machine.paperCapacity} ({pct}%)
                {lowPaper ? ' — di bawah ambang peringatan.' : ''}
              </p>
              <div className="flex items-center gap-3">
                <Switch
                  id="maintenance-mode"
                  checked={settings.maintenanceMode}
                  onCheckedChange={toggleMaintenance}
                />
                <label htmlFor="maintenance-mode" className="font-semibold">
                  Maintenance mode
                </label>
              </div>
              <Button type="submit" disabled={pending}>
                {pending ? 'Menyimpan…' : 'Simpan konfigurasi'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-8">
          <Card className="border-4 shadow-[6px_6px_0_0_var(--color-border)]">
            <CardContent className="space-y-4 pt-6">
              <h2 className="text-xl font-bold">PIN Lock capture</h2>
              <p className="text-muted-foreground text-sm">
                Saat aktif, kiosk mengunci Alt+F4/Windows/Esc selama sesi foto.
              </p>
              <div className="flex items-center gap-3">
                <Switch
                  id="pin-lock"
                  checked={machine.pinLockEnabled}
                  disabled={pending || (!machine.pinLockEnabled && pin.length !== 6)}
                  onCheckedChange={togglePinLock}
                />
                <label htmlFor="pin-lock" className="font-semibold">
                  {machine.pinLockEnabled ? 'PIN Lock aktif' : 'PIN Lock nonaktif'}
                </label>
              </div>
              {!machine.pinLockEnabled && (
                <label className="block text-sm font-semibold">
                  PIN 6 digit (untuk mengaktifkan)
                  <Input
                    inputMode="numeric"
                    maxLength={6}
                    className="mt-1 font-mono"
                    value={pin}
                    onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
                  />
                </label>
              )}
            </CardContent>
          </Card>

          <Card className="border-4 shadow-[6px_6px_0_0_var(--color-border)]">
            <CardContent className="space-y-4 pt-6">
              <h2 className="text-xl font-bold">Perangkat</h2>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="font-semibold">Versi app</dt>
                <dd>{machine.appVersion ?? '—'}</dd>
                <dt className="font-semibold">Platform</dt>
                <dd>{machine.platform ?? '—'}</dd>
                <dt className="font-semibold">Heartbeat</dt>
                <dd>
                  {machine.lastHeartbeatAt
                    ? new Date(machine.lastHeartbeatAt).toLocaleString('id-ID')
                    : 'belum ada'}
                </dd>
              </dl>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="neutral" disabled={pending} onClick={newPairing}>
                  Kode pairing baru
                </Button>
                <Button
                  type="button"
                  variant="neutral"
                  disabled={pending}
                  onClick={revoke}
                  className="bg-red-200"
                >
                  Lepas perangkat
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {pairing?.ok && (
        <div className="space-y-3 border-4 border-border bg-main p-5 shadow-[6px_6px_0_0_var(--color-border)]">
          <h2 className="text-lg font-bold">Pairing QR</h2>
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL PNG dari server */}
          <img
            src={pairing.qrDataUrl}
            alt="QR pairing booth; pindai dari SnapBox Desktop"
            className="border-2 border-border bg-white p-2"
            width={220}
            height={220}
          />
          <p className="text-sm">
            Berlaku hingga {new Date(pairing.expiresAt).toLocaleTimeString('id-ID')}. Sekali pakai.
          </p>
        </div>
      )}
      {pairing && !pairing.ok && (
        <p className="border-4 border-border bg-red-200 p-4 font-semibold" role="alert">
          {pairing.message}
        </p>
      )}

      <section aria-labelledby="pkg-title">
        <h2 id="pkg-title" className="mb-3 text-xl font-bold">
          Harga paket per booth
        </h2>
        <p className="text-muted-foreground mb-3 text-sm">
          Hanya paket yang sudah dikhususkan untuk booth ini yang dapat diubah di sini.
        </p>
        {machine.packages.length === 0 ? (
          <p className="border-2 border-dashed border-border p-6">
            Belum ada paket. Buat paket di menu Paket terlebih dahulu.
          </p>
        ) : (
          <ul className="space-y-3">
            {machine.packages.map((pkg) => (
              <li
                key={pkg.id}
                className="flex flex-wrap items-end gap-3 border-2 border-border p-4"
              >
                <div className="grow">
                  <p className="font-bold">{pkg.name}</p>
                  <p className="text-muted-foreground text-sm">
                    {pkg.isOverride ? 'Khusus booth ini' : 'Mewarisi paket tenant'}:{' '}
                    {idr(pkg.price)}
                  </p>
                </div>
                {pkg.isOverride ? (
                  <>
                    <Input
                      className="w-40"
                      value={prices[pkg.id] ?? pkg.price}
                      onChange={(event) => setPrices({ ...prices, [pkg.id]: event.target.value })}
                    />
                    <Button
                      type="button"
                      variant="neutral"
                      disabled={pending}
                      onClick={() =>
                        run(() =>
                          updateBoothPackagePrice({
                            packageId: pkg.id,
                            price: prices[pkg.id] ?? pkg.price,
                          }),
                        )
                      }
                    >
                      Simpan harga
                    </Button>
                  </>
                ) : (
                  <span className="border-2 border-border px-3 py-1 text-sm">Tenant</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="session-title">
        <h2 id="session-title" className="mb-3 text-xl font-bold">
          Riwayat sesi
        </h2>
        {machine.sessions.length === 0 ? (
          <p className="border-2 border-dashed border-border p-6">Belum ada sesi tercatat.</p>
        ) : (
          <div className="overflow-x-auto border-2 border-border">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-main">
                  {['State', 'Aktor', 'Mulai', 'Selesai', 'Durasi'].map((head) => (
                    <th key={head} scope="col" className="border-2 border-border px-3 py-2">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {machine.sessions.map((session, index) => (
                  <tr key={session.id} className={index % 2 === 1 ? 'bg-secondary-background' : ''}>
                    <td className="border-2 border-border px-3 py-2 font-mono">{session.state}</td>
                    <td className="border-2 border-border px-3 py-2">{session.actor ?? '—'}</td>
                    <td className="border-2 border-border px-3 py-2">
                      {new Date(session.enterAt).toLocaleString('id-ID')}
                    </td>
                    <td className="border-2 border-border px-3 py-2">
                      {session.exitAt ? new Date(session.exitAt).toLocaleString('id-ID') : '—'}
                    </td>
                    <td className="border-2 border-border px-3 py-2">
                      {session.durationMs ? `${Math.round(session.durationMs / 1000)}s` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-muted-foreground text-xs">
        Tenant <span className="font-mono">{tenantId.slice(0, 8)}</span> · dibuka{' '}
        {new Date(machine.createdAt).toLocaleDateString('id-ID')}
      </p>
    </div>
  );
}
