'use client';

import { type ExampleColumn } from '../example-table';
import { ExampleTable } from '../example-table';
import { CONTOH_ACTIVITIES, type ExampleActivity } from '../example-data';
import { PageIntro, StatusBadge } from '../panel';

const columns: readonly ExampleColumn<ExampleActivity>[] = [
  { key: 'at', header: 'Waktu', render: (row) => <span className="ceo-mono">{row.at}</span> },
  { key: 'actor', header: 'Aktor', render: (row) => <span className="ceo-mono">{row.actor}</span> },
  {
    key: 'role',
    header: 'Peran',
    render: (row) => (
      <StatusBadge tone={row.role === 'Sistem' ? 'netral' : 'info'}>{row.role}</StatusBadge>
    ),
  },
  {
    key: 'action',
    header: 'Aksi',
    render: (row) => <span className="ceo-mono">{row.action}</span>,
  },
  { key: 'resource', header: 'Resource', render: (row) => row.resource },
];

const ROLES = ['CEO', 'OWNER', 'STAFF', 'Sistem'] as const;

/**
 * Activity log (PRD Task 1.3).
 *
 * Tampilan audit read-only. Skeleton tidak menulis maupun menghapus baris, dan
 * tidak menyatakan data ini sebagai jejak audit produksi.
 */
export function ActivityLogView() {
  return (
    <>
      <PageIntro
        title="Activity log"
        description="Jejak audit aksi kritis: aktor, aksi, resource, dan waktu."
      >
        <StatusBadge tone="netral">Read-only</StatusBadge>
      </PageIntro>

      <ExampleTable
        subject="activity"
        itemNoun="aktivitas"
        rows={CONTOH_ACTIVITIES}
        columns={columns}
        searchLabel="Cari aktivitas"
        search={(row) => `${row.actor} ${row.action} ${row.resource}`}
        fields={[{ key: 'role', options: [...ROLES] }]}
      />

      <p className="ceo-footnote">
        Baris di atas adalah data contoh dan tidak dapat diubah dari UI. Audit trail immutable
        sesungguhnya ditulis server pada fase berikutnya.
      </p>
    </>
  );
}
