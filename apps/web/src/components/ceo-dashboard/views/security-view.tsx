'use client';

import { type ExampleColumn } from '../example-table';
import { ExampleTable } from '../example-table';
import { CONTOH_SECURITY_EVENTS, type ExampleSecurityEvent } from '../example-data';
import { PageIntro, Panel, StatusBadge } from '../panel';

const columns: readonly ExampleColumn<ExampleSecurityEvent>[] = [
  { key: 'at', header: 'Waktu', render: (row) => <span className="ceo-mono">{row.at}</span> },
  {
    key: 'kind',
    header: 'Jenis',
    render: (row) => (
      <StatusBadge
        tone={row.kind === 'Login gagal' ? 'waspada' : row.kind === 'WAF' ? 'bahaya' : 'netral'}
      >
        {row.kind}
      </StatusBadge>
    ),
  },
  {
    key: 'subject',
    header: 'Subjek',
    render: (row) => <span className="ceo-mono">{row.subject}</span>,
  },
  {
    key: 'source',
    header: 'Sumber',
    render: (row) => <span className="ceo-mono">{row.source}</span>,
  },
  { key: 'detail', header: 'Keterangan', render: (row) => row.detail },
];

/**
 * Keamanan (PRD Task 1.3).
 *
 * Alamat sumber disamarkan ke blok jaringan contoh. Skeleton tidak menampilkan
 * IP individual, token, atau isi permintaan.
 */
export function SecurityView() {
  const gagal = CONTOH_SECURITY_EVENTS.filter((event) => event.kind === 'Login gagal').length;

  return (
    <>
      <PageIntro
        title="Keamanan"
        description="Percobaan login gagal, rate limit, event WAF, dan sesi aktif."
      >
        <StatusBadge tone={gagal > 0 ? 'waspada' : 'baik'}>{gagal} login gagal contoh</StatusBadge>
      </PageIntro>

      <div className="ceo-grid-2">
        <Panel
          title="Ringkasan sinyal"
          description="Hitungan dari data contoh pada tabel di bawah."
        >
          <ul className="ceo-stat-list">
            <li>
              <span>Login gagal</span>
              <span className="ceo-mono">
                {CONTOH_SECURITY_EVENTS.filter((event) => event.kind === 'Login gagal').length}
              </span>
            </li>
            <li>
              <span>Rate limit tercapai</span>
              <span className="ceo-mono">
                {CONTOH_SECURITY_EVENTS.filter((event) => event.kind === 'Rate limit').length}
              </span>
            </li>
            <li>
              <span>Event WAF</span>
              <span className="ceo-mono">
                {CONTOH_SECURITY_EVENTS.filter((event) => event.kind === 'WAF').length}
              </span>
            </li>
            <li>
              <span>Sesi baru</span>
              <span className="ceo-mono">
                {CONTOH_SECURITY_EVENTS.filter((event) => event.kind === 'Sesi').length}
              </span>
            </li>
          </ul>
          <p className="ceo-hint">
            Angka ini dihitung dari daftar contoh di halaman, bukan dari pipeline keamanan nyata.
          </p>
        </Panel>

        <Panel
          title="Kebijakan yang berlaku"
          description="Ringkasan kontrol yang sudah ada di kode."
        >
          <ul className="ceo-policy">
            <li>
              <StatusBadge tone="baik">Aktif</StatusBadge>
              <span>Sesi disimpan pada cookie HttpOnly dengan SameSite Lax.</span>
            </li>
            <li>
              <StatusBadge tone="baik">Aktif</StatusBadge>
              <span>Rate limit aplikasi pada endpoint autentikasi.</span>
            </li>
            <li>
              <StatusBadge tone="netral">Rencana</StatusBadge>
              <span>Ingesti event WAF dan session management lanjutan.</span>
            </li>
          </ul>
        </Panel>
      </div>

      <ExampleTable
        subject="security"
        itemNoun="event keamanan"
        rows={CONTOH_SECURITY_EVENTS}
        columns={columns}
        searchLabel="Cari event"
        search={(row) => `${row.subject} ${row.detail} ${row.source}`}
        fields={[{ key: 'kind', options: ['Login gagal', 'Rate limit', 'WAF', 'Sesi'] }]}
      />

      <p className="ceo-footnote">
        Tidak ada klaim sertifikasi atau kepatuhan pada halaman ini. Event di atas adalah data
        contoh untuk menguji tata letak monitor keamanan.
      </p>
    </>
  );
}
