'use client';

import {
  Progress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@snapbox/ui';
import * as React from 'react';

import { CONTOH_QUEUES, CONTOH_SERVICES } from '../example-data';
import { PageIntro, Panel, StatusBadge, toneForStatus } from '../panel';

/**
 * Kesehatan sistem (PRD Task 1.3).
 *
 * Status layanan adalah snapshot contoh. Uptime yang ditampilkan diberi penanda
 * "(contoh)" supaya tidak dibaca sebagai klaim ketersediaan nyata (R-17/R-36).
 */
export function SystemHealthView() {
  const [simulate, setSimulate] = React.useState(false);

  return (
    <>
      <PageIntro
        title="Kesehatan sistem"
        description="Status layanan, antrean webhook, dan jadwal cron."
      >
        <StatusBadge tone={simulate ? 'bahaya' : 'baik'}>
          {simulate ? 'Simulasi gangguan' : 'Semua contoh normal'}
        </StatusBadge>
      </PageIntro>

      <Panel
        title="Status layanan"
        description="Pemeriksaan health check nyata menyusul pada fase observability."
        action={
          <button
            type="button"
            className="ceo-inline-toggle"
            aria-pressed={simulate}
            onClick={() => setSimulate((value) => !value)}
          >
            {simulate ? 'Matikan simulasi gangguan' : 'Simulasikan gangguan'}
          </button>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Layanan</TableHead>
              <TableHead scope="col">Peran</TableHead>
              <TableHead scope="col">Status</TableHead>
              <TableHead scope="col">Latensi</TableHead>
              <TableHead scope="col">Uptime</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {CONTOH_SERVICES.map((service, index) => {
              const status = simulate && index === 2 ? 'Gangguan' : service.status;
              return (
                <TableRow key={service.id}>
                  <TableCell className="ceo-cell-strong">{service.name}</TableCell>
                  <TableCell>{service.role}</TableCell>
                  <TableCell>
                    <StatusBadge tone={toneForStatus(status)}>{status}</StatusBadge>
                  </TableCell>
                  <TableCell className="ceo-mono">{service.latency}</TableCell>
                  <TableCell className="ceo-mono">{service.uptime}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Panel>

      <div className="ceo-grid-2">
        <Panel
          title="Antrean pekerjaan"
          description="Antrean yang perlu dipantau setelah webhook aktif."
        >
          <ul className="ceo-queue">
            {CONTOH_QUEUES.map((queue) => (
              <li key={queue.id}>
                <div className="ceo-queue-head">
                  <span className="ceo-cell-strong">{queue.name}</span>
                  <span className="ceo-mono">Terakhir: {queue.lastRun}</span>
                </div>
                <div className="ceo-queue-counts">
                  <StatusBadge tone={queue.pending === '0' ? 'baik' : 'waspada'}>
                    {queue.pending} menunggu
                  </StatusBadge>
                  <StatusBadge tone={queue.failed === '0' ? 'baik' : 'bahaya'}>
                    {queue.failed} gagal
                  </StatusBadge>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Jadwal cron" description="Pekerjaan terjadwal pada basis data.">
          <ul className="ceo-cron">
            <li>
              <div className="ceo-cron-head">
                <span className="ceo-cell-strong">subscription-expiry</span>
                <span className="ceo-mono">Setiap jam</span>
              </div>
              <p className="ceo-hint">Menandai langganan kedaluwarsa dan memulai grace period.</p>
              <Progress value={100} aria-label="Progres contoh pekerjaan subscription-expiry" />
            </li>
            <li>
              <div className="ceo-cron-head">
                <span className="ceo-cell-strong">retention-cleanup</span>
                <span className="ceo-mono">Harian 02.00</span>
              </div>
              <p className="ceo-hint">Menghapus soft copy yang melewati retensi plan.</p>
              <Progress value={100} aria-label="Progres contoh pekerjaan retention-cleanup" />
            </li>
            <li>
              <div className="ceo-cron-head">
                <span className="ceo-cell-strong">heartbeat-timeout</span>
                <span className="ceo-mono">Setiap 5 menit</span>
              </div>
              <p className="ceo-hint">Menandai perangkat tanpa heartbeat sebagai offline.</p>
              <Progress value={100} aria-label="Progres contoh pekerjaan heartbeat-timeout" />
            </li>
          </ul>
        </Panel>
      </div>

      <p className="ceo-footnote">
        Semua status pada halaman ini dihasilkan dari data contoh lokal, tanpa permintaan jaringan
        dan tanpa memeriksa layanan sungguhan.
      </p>
    </>
  );
}
