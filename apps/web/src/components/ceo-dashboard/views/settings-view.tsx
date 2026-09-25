'use client';

import { Badge, Card, CardContent, CardHeader, CardTitle } from '@snapbox/ui';
import * as React from 'react';

import { PageIntro, Panel, StatusBadge } from '../panel';

interface SettingField {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly note: string;
}

interface SettingGroup {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly fields: readonly SettingField[];
}

/**
 * Pengaturan global (PRD Task 1.3).
 *
 * Semua nilai adalah contoh statis dan ditampilkan sebagai teks, BUKAN input
 * editable. Menyediakan input yang tidak menyimpan apa pun akan melanggar R-26,
 * jadi skeleton hanya mendokumentasikan nilai dan status implementasinya.
 *
 * Tidak ada kunci API, secret, atau token di sini. Nilai sensitif tidak boleh
 * ditampilkan bahkan sebagai contoh.
 */
const GROUPS: readonly SettingGroup[] = [
  {
    id: 'kontak',
    title: 'Kontak dan kanal penjualan',
    description: 'Kanal yang dipakai tenant untuk menghubungi tim SnapBox.',
    fields: [
      {
        id: 'wa',
        label: 'Nomor WhatsApp penjualan',
        value: 'Belum diatur',
        note: 'Env build + runtime.',
      },
      {
        id: 'email',
        label: 'Email balasan default',
        value: 'Belum diatur',
        note: 'Dipakai template email.',
      },
    ],
  },
  {
    id: 'email',
    title: 'Template email',
    description: 'Template undangan staff, invoice, dan peringatan langganan.',
    fields: [
      {
        id: 'invite',
        label: 'Template undangan tenant',
        value: 'Draf',
        note: 'Belum dipublikasikan.',
      },
      { id: 'invoice', label: 'Template invoice B2B', value: 'Draf', note: 'Menunggu Task 1.6.' },
    ],
  },
  {
    id: 'flag',
    title: 'Feature flag',
    description: 'Saklar rilis fitur lintas tenant.',
    fields: [
      {
        id: 'kiosk-theme',
        label: 'Kiosk theme customizer',
        value: 'Nonaktif',
        note: 'Aktif di Growth dan Enterprise.',
      },
      {
        id: 'promo-batch',
        label: 'Batch voucher lanjutan',
        value: 'Nonaktif',
        note: 'Hanya Enterprise.',
      },
      {
        id: 'device-console',
        label: 'Konsol perangkat web',
        value: 'Aktif',
        note: 'Fallback read-only.',
      },
    ],
  },
  {
    id: 'batas',
    title: 'Batas platform',
    description: 'Nilai default yang berlaku bila tenant tidak punya override.',
    fields: [
      {
        id: 'retensi',
        label: 'Retensi default',
        value: '30 hari',
        note: 'Mengikuti plan Starter.',
      },
      {
        id: 'storage',
        label: 'Penyimpanan default',
        value: '2 GB',
        note: 'Mengikuti plan Starter.',
      },
    ],
  },
];

/** Pengaturan global read-only (PRD Task 1.3). */
export function SettingsView() {
  const [openGroup, setOpenGroup] = React.useState<string>('kontak');

  return (
    <>
      <PageIntro
        title="Pengaturan global"
        description="Kontak penjualan, template email, feature flag, dan kunci API master."
      >
        <StatusBadge tone="netral">Read-only</StatusBadge>
      </PageIntro>

      <Panel
        title="Catatan keamanan"
        description="Yang sengaja TIDAK ditampilkan pada skeleton."
        example={false}
      >
        <p className="ceo-hint">
          Kunci API master, secret SMTP, dan kredensial gateway tidak pernah dirender di UI, bahkan
          sebagai nilai contoh. Penyimpanan secret mengikuti dokumen environment dan secret, dan
          nilai sensitif hanya boleh diisi oleh operator terautentikasi.
        </p>
      </Panel>

      <div className="ceo-settings">
        {GROUPS.map((group) => {
          const open = openGroup === group.id;
          return (
            <Card key={group.id} className="ceo-setting-group">
              <CardHeader>
                <button
                  type="button"
                  className="ceo-setting-trigger"
                  aria-expanded={open}
                  aria-controls={`setting-group-${group.id}`}
                  onClick={() => setOpenGroup(open ? '' : group.id)}
                >
                  <CardTitle className="text-base">{group.title}</CardTitle>
                  <span className="ceo-setting-caret" aria-hidden>
                    {open ? '-' : '+'}
                  </span>
                </button>
              </CardHeader>
              {open ? (
                <CardContent id={`setting-group-${group.id}`}>
                  <p className="ceo-hint">{group.description}</p>
                  <dl className="ceo-setting-list">
                    {group.fields.map((field) => (
                      <div key={field.id}>
                        <dt>{field.label}</dt>
                        <dd>
                          <Badge variant="neutral">{field.value}</Badge>
                          <span className="ceo-setting-note">{field.note}</span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              ) : null}
            </Card>
          );
        })}
      </div>

      <p className="ceo-footnote">
        Belum ada penyimpanan pengaturan pada skeleton ini. Perubahan nilai dikerjakan bersama
        integrasi konfigurasi platform.
      </p>
    </>
  );
}
