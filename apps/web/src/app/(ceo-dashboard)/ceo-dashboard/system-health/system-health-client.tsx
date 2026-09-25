'use client';

import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@snapbox/ui';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { PageIntro, Panel, StatusBadge } from '@/components/ceo-dashboard/panel';
import {
  type HealthStatus,
  type SystemHealthSnapshot,
} from '@/lib/ceo-dashboard/health-security-contract';

/**
 * Kesehatan sistem (PRD Task 1.11).
 *
 * Semua angka berasal dari heartbeat nyata di tabel `system_health_checks` dan
 * antrean webhook di `webhook_events`/`webhook_failures`. Komponen tanpa
 * heartbeat ditampilkan sebagai "Belum tersedia", bukan "Normal": dashboard
 * kosong tidak boleh terbaca sehat (R-17/R-36).
 */

const STATUS_TONES = {
  healthy: 'baik',
  degraded: 'waspada',
  outage: 'bahaya',
  unavailable: 'netral',
} as const satisfies Record<HealthStatus, string>;

function statusTone(status: HealthStatus) {
  return STATUS_TONES[status];
}

function formatDateTime(iso: string | null): string {
  if (!iso) return 'Belum ada heartbeat';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function formatLatency(latencyMs: number | null): string {
  return latencyMs === null ? '—' : `${latencyMs} ms`;
}

export function SystemHealthClient({ snapshot }: { snapshot: SystemHealthSnapshot }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const overallTone = statusTone(snapshot.overallStatus);
  const overallStatusLabel =
    snapshot.rows.length === 0
      ? 'Belum ada heartbeat'
      : (snapshot.rows.find((row) => row.status === snapshot.overallStatus)?.statusLabel ??
        snapshot.overallStatus);

  return (
    <main className="space-y-6">
      <PageIntro
        title="Kesehatan sistem"
        description="Status layanan, antrean webhook, dan heartbeat pekerjaan terjadwal."
      >
        <Button
          type="button"
          variant="neutral"
          size="default"
          disabled={pending}
          onClick={() => startTransition(() => router.refresh())}
        >
          {pending ? 'Memuat…' : 'Muat ulang'}
        </Button>
      </PageIntro>

      <section className="ceo-panel-static" aria-label="Ringkasan status keseluruhan">
        <div className="ceo-panel-static-head">
          <h3>Status keseluruhan</h3>
          <StatusBadge tone={overallTone}>{overallStatusLabel}</StatusBadge>
        </div>
        <p className="ceo-hint">
          Diambil {formatDateTime(snapshot.generatedAt)}. Status ini dihitung dari heartbeat
          terakhir per komponen, bukan dari pemantauan uptime eksternal.
        </p>
      </section>

      <Panel
        title="Layanan dan pekerjaan terjadwal"
        description="Heartbeat terakhir setiap komponen yang melapor."
        example={false}
        action={<span className="ceo-table-count">{snapshot.rows.length} komponen melapor</span>}
      >
        {snapshot.rows.length === 0 ? (
          <p className="ceo-table-state" role="status">
            Belum ada heartbeat. Job cron dan adapter health belum pernah melapor, jadi tidak ada
            status yang bisa ditampilkan.
          </p>
        ) : (
          <div className="ceo-table-wrap">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Komponen</TableHead>
                  <TableHead scope="col">Kunci</TableHead>
                  <TableHead scope="col">Status</TableHead>
                  <TableHead scope="col">Latensi</TableHead>
                  <TableHead scope="col">Sukses terakhir</TableHead>
                  <TableHead scope="col">Diamati</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshot.rows.map((row) => (
                  <TableRow key={row.checkKey}>
                    <TableCell className="ceo-cell-strong">{row.componentLabel}</TableCell>
                    <TableCell className="ceo-mono">{row.checkKey}</TableCell>
                    <TableCell>
                      <StatusBadge tone={statusTone(row.status)}>{row.statusLabel}</StatusBadge>
                    </TableCell>
                    <TableCell className="ceo-mono">{formatLatency(row.latencyMs)}</TableCell>
                    <TableCell>{formatDateTime(row.lastSuccessAt)}</TableCell>
                    <TableCell>{formatDateTime(row.observedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      <div className="ceo-grid-2">
        <Panel
          title="Antrean webhook"
          description="Dihitung dari tabel idempotensi dan dead-letter."
          example={false}
        >
          <ul className="ceo-stat-list">
            <li>
              <span>Belum diproses</span>
              <span className="ceo-mono">{snapshot.queue.pending}</span>
            </li>
            <li>
              <span>Gagal belum selesai</span>
              <span className="ceo-mono">{snapshot.queue.failedUnresolved}</span>
            </li>
            <li>
              <span>Tertua menunggu</span>
              <span className="ceo-mono">{formatDateTime(snapshot.queue.oldestPendingAt)}</span>
            </li>
            <li>
              <span>Terakhir diproses</span>
              <span className="ceo-mono">{formatDateTime(snapshot.queue.lastProcessedAt)}</span>
            </li>
          </ul>
          <p className="ceo-hint">
            Angka nol berarti antrean benar-benar kosong pada saat pembacaan, bukan data contoh.
          </p>
        </Panel>

        <Panel title="Sumber belum tersedia" description="Ditampilkan apa adanya." example={false}>
          {snapshot.unavailable.length === 0 ? (
            <p className="ceo-hint">Semua sumber telemetry yang dikonfigurasi aktif.</p>
          ) : (
            <ul className="ceo-policy">
              {snapshot.unavailable.map((note) => (
                <li key={note}>
                  <StatusBadge tone="netral">Belum tersedia</StatusBadge>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </main>
  );
}
