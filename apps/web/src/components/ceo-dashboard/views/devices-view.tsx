'use client';

import { type ExampleColumn } from '../example-table';
import { ExampleTable } from '../example-table';
import { CONTOH_DEVICES, type ExampleDevice } from '../example-data';
import { PageIntro, StatusBadge, toneForStatus } from '../panel';

const columns: readonly ExampleColumn<ExampleDevice>[] = [
  {
    key: 'device',
    header: 'Perangkat',
    render: (row) => <span className="ceo-mono">{row.device}</span>,
  },
  { key: 'tenant', header: 'Tenant', render: (row) => row.tenant },
  { key: 'outlet', header: 'Outlet', render: (row) => row.outlet },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusBadge tone={toneForStatus(row.status)}>{row.status}</StatusBadge>,
  },
  {
    key: 'appVersion',
    header: 'Versi app',
    render: (row) => <span className="ceo-mono">{row.appVersion}</span>,
  },
  { key: 'os', header: 'Sistem operasi', render: (row) => row.os },
  { key: 'heartbeat', header: 'Heartbeat', render: (row) => row.heartbeat },
];

/** Monitor perangkat lintas tenant (PRD Task 1.3). */
export function DevicesView() {
  const online = CONTOH_DEVICES.filter((device) => device.status === 'Online').length;

  return (
    <>
      <PageIntro
        title="Monitor perangkat"
        description="Semua perangkat Tauri lintas tenant: versi, sistem operasi, dan heartbeat."
      >
        <StatusBadge tone="baik">{online} online</StatusBadge>
      </PageIntro>

      <ExampleTable
        subject="device"
        itemNoun="perangkat"
        rows={CONTOH_DEVICES}
        columns={columns}
        searchLabel="Cari perangkat"
        search={(row) => `${row.device} ${row.tenant} ${row.outlet}`}
        fields={[
          { key: 'status', options: ['Online', 'Idle', 'Offline', 'Maintenance'] },
          { key: 'os', options: ['Windows 11', 'Windows 10', 'macOS 15'] },
        ]}
      />

      <p className="ceo-footnote">
        Heartbeat di atas adalah nilai contoh statis. Telemetry perangkat nyata baru masuk pada fase
        pairing dan konsol perangkat.
      </p>
    </>
  );
}
