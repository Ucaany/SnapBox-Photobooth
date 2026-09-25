'use client';

import { Button, Input } from '@snapbox/ui';
import Link from 'next/link';
import * as React from 'react';

import { type ExampleColumn } from '../example-table';
import { ExampleTable } from '../example-table';
import { CONTOH_TENANTS, type ExampleTenant } from '../example-data';
import { PageIntro, StatusBadge, toneForStatus } from '../panel';

/**
 * Daftar tenant (PRD Task 1.4).
 *
 * Isi tabel tetap 20 tenant DUMMY sesuai mandat PRD Task 1.4 ("tabel 20 tenant
 * dummy dengan filter"), sehingga filter/search bekerja penuh tanpa backend.
 * Yang NYATA adalah tautan ke detail: `/ceo-dashboard/tenants/[id]` membaca
 * tenant asli dari DB, dan id dummy yang tidak ada akan menghasilkan 404: itu
 * perilaku yang benar, bukan bug.
 *
 * Aksi mutasi sengaja tidak ada di baris tabel; semuanya di halaman detail agar
 * confirmation + reason tidak bisa dilewati dari daftar.
 */
const columns: readonly ExampleColumn<ExampleTenant>[] = [
  {
    key: 'company',
    header: 'Perusahaan',
    render: (row) => (
      <div className="ceo-cell-stack">
        <Link className="ceo-cell-strong ceo-cell-link" href={`/ceo-dashboard/tenants/${row.id}`}>
          {row.company}
        </Link>
        <span className="ceo-mono ceo-cell-sub">{row.id}</span>
      </div>
    ),
  },
  {
    key: 'owner',
    header: 'Email Owner',
    render: (row) => <span className="ceo-mono">{row.ownerEmail}</span>,
  },
  {
    key: 'plan',
    header: 'Plan',
    render: (row) => <StatusBadge tone="info">{row.plan}</StatusBadge>,
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusBadge tone={toneForStatus(row.status)}>{row.status}</StatusBadge>,
  },
  {
    key: 'outlets',
    header: 'Outlet',
    render: (row) => <span className="ceo-mono">{row.outlets}</span>,
  },
  {
    key: 'booths',
    header: 'Booth',
    render: (row) => <span className="ceo-mono">{row.booths}</span>,
  },
  { key: 'lastSeen', header: 'Terakhir aktif', render: (row) => row.lastSeen },
  {
    key: 'detail',
    header: 'Detail',
    render: (row) => (
      <Button
        variant="neutral"
        size="default"
        nativeButton={false}
        render={<Link href={`/ceo-dashboard/tenants/${row.id}`} />}
      >
        Buka
      </Button>
    ),
  },
];

export function TenantsView() {
  const [ids, setIds] = React.useState<string | null>(null);
  const [lookup, setLookup] = React.useState('');
  const [message, setMessage] = React.useState<string | null>(null);

  function onLookup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = lookup.trim();
    if (!value) {
      setMessage('Masukkan id tenant (UUID) yang ingin dibuka.');
      return;
    }
    setMessage(null);
    setIds(value);
  }

  return (
    <>
      <PageIntro
        title="Manajemen tenant"
        description="Daftar tenant beserta plan, status, dan kontak Owner."
      >
        <Button
          variant="default"
          nativeButton={false}
          render={<Link href="/ceo-dashboard/tenants/new" />}
        >
          Tenant baru
        </Button>
      </PageIntro>

      <section className="ceo-panel ceo-lookup" aria-label="Buka tenant berdasarkan id">
        <form className="ceo-form" onSubmit={onLookup}>
          <label htmlFor="tenant-id-lookup">Buka tenant tersimpan berdasarkan id</label>
          <Input
            id="tenant-id-lookup"
            value={lookup}
            onChange={(event) => setLookup(event.target.value)}
            placeholder="mis. 6f1c2a4e-..."
            autoComplete="off"
          />
          <div className="ceo-inline-actions">
            <Button type="submit" variant="neutral" size="default">
              Cari id
            </Button>
            {ids ? (
              <Button
                variant="reverse"
                size="default"
                nativeButton={false}
                render={<Link href={`/ceo-dashboard/tenants/${ids}`} />}
              >
                Buka detail
              </Button>
            ) : null}
          </div>
          {message ? (
            <p className="ceo-feedback" role="status">
              {message}
            </p>
          ) : null}
        </form>
        <p className="ceo-muted">
          Tabel di bawah adalah 20 tenant contoh. Detail hanya tersedia untuk tenant yang
          benar-benar ada di database.
        </p>
      </section>

      <ExampleTable
        subject="tenant"
        itemNoun="tenant"
        rows={CONTOH_TENANTS}
        columns={columns}
        searchLabel="Cari tenant"
        search={(row) => `${row.company} ${row.ownerEmail} ${row.id}`}
        fields={[
          { key: 'status', options: ['Aktif', 'Trial', 'Suspend', 'Grace period'] },
          { key: 'plan', options: ['Starter', 'Growth', 'Enterprise'] },
        ]}
      />
    </>
  );
}
