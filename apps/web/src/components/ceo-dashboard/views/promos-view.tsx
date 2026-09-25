'use client';

import { type ExampleColumn } from '../example-table';
import { ExampleTable } from '../example-table';
import { CONTOH_PROMOS, type ExamplePromo } from '../example-data';
import { PageIntro, StatusBadge, toneForStatus } from '../panel';

const columns: readonly ExampleColumn<ExamplePromo>[] = [
  { key: 'code', header: 'Kode', render: (row) => <span className="ceo-mono">{row.code}</span> },
  { key: 'scope', header: 'Cakupan', render: (row) => row.scope },
  { key: 'discount', header: 'Bentuk promo', render: (row) => row.discount },
  { key: 'quota', header: 'Kuota', render: (row) => <span className="ceo-mono">{row.quota}</span> },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusBadge tone={toneForStatus(row.status)}>{row.status}</StatusBadge>,
  },
  { key: 'window', header: 'Masa berlaku', render: (row) => row.window },
];

/**
 * Promo global (PRD Task 1.3).
 *
 * Read-only: pembuatan dan penghapusan voucher adalah aksi yang mengubah data,
 * jadi sengaja tidak disediakan di skeleton.
 */
export function PromosView() {
  const aktif = CONTOH_PROMOS.filter((promo) => promo.status === 'Aktif').length;

  return (
    <>
      <PageIntro
        title="Promo global"
        description="Voucher platform-wide, masa aktif, dan kuota pemakaian."
      >
        <StatusBadge tone="info">{aktif} aktif</StatusBadge>
      </PageIntro>

      <ExampleTable
        subject="promo"
        itemNoun="promo"
        rows={CONTOH_PROMOS}
        columns={columns}
        searchLabel="Cari promo"
        search={(row) => `${row.code} ${row.discount}`}
        fields={[{ key: 'status', options: ['Aktif', 'Terjadwal', 'Berakhir', 'Nonaktif'] }]}
      />

      <p className="ceo-footnote">
        Kuota dan kode promo di atas adalah data contoh. Pembuatan dan penghapusan voucher belum
        tersedia pada skeleton ini.
      </p>
    </>
  );
}
