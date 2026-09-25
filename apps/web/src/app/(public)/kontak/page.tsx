import type { Metadata } from 'next';

import { Button, Input, Label, Textarea } from '@snapbox/ui';

import { OrganizationJsonLd } from '@/components/public/seo-json-ld';
import { WhatsappCta } from '@/components/public/whatsapp-cta';
import { CONTACT } from '@/content/public';
import { buildPublicMetadata } from '@/lib/public-metadata';

/**
 * Halaman kontak publik.
 *
 * Tidak ada backend kontak (tidak ada server action, tidak ada API endpoint),
 * jadi formulir dirender sebagai PRATINJAU PENDING: seluruh kontrol `disabled`,
 * tombol submit `disabled` dengan alasan tertulis, dan tanpa handler `onSubmit`.
 * Form tidak pernah mengirim apa pun dan tidak pernah menampilkan pesan sukses.
 * Jalur kontak nyata adalah `WhatsappCta`, yang punya state disabled sendiri
 * ketika `NEXT_PUBLIC_SALES_WHATSAPP` kosong.
 *
 * Data sales/alamat/jam adalah placeholder `[REAL DATA]` dari `CONTACT`; tidak
 * ada nomor, alamat, jam, atau peta yang dikarang. JSON-LD hanya `Organization`
 * tanpa `address`/`telephone` sesuai desain (organisasi belum punya data resmi).
 */

export const metadata: Metadata = buildPublicMetadata('/kontak');

type PendingField = {
  readonly id: string;
  readonly term: string;
  readonly value: string;
};

const FIELDS: readonly PendingField[] = [
  { id: 'kontak-sales-info', term: 'Tim sales', value: CONTACT.salesInfo },
  { id: 'kontak-address', term: 'Alamat', value: CONTACT.address },
  { id: 'kontak-hours', term: 'Jam operasional', value: CONTACT.hours },
];

export default function KontakPage() {
  return (
    <>
      <OrganizationJsonLd />

      <section className="public-section public-container">
        <p className="font-mono text-xs tracking-widest uppercase">Kontak</p>
        <h1 className="mt-2 max-w-[24ch] text-3xl leading-tight font-bold font-heading md:text-5xl">
          Hubungi SnapBox
        </h1>
        <p className="mt-4 max-w-[65ch] text-base leading-relaxed">
          Konsultasi platform photobooth multi-tenant melalui kanal sales yang tersedia. Detail
          kanal resmi selain WhatsApp menunggu data resmi.
        </p>
      </section>

      <section aria-labelledby="kontak-jalur" className="public-section public-container pt-0">
        <div className="grid gap-8 md:grid-cols-[1fr_1.1fr]">
          <div className="flex flex-col gap-6">
            <h2 id="kontak-jalur" className="text-2xl font-bold font-heading">
              Kanal resmi
            </h2>

            <div className="public-card rounded-base p-5">
              <h3 className="text-lg font-bold font-heading">Konsultasi via WhatsApp</h3>
              <p className="mt-2 text-sm leading-relaxed">
                Kanal tercepat untuk konsultasi. Tombol menyesuaikan otomatis: aktif hanya bila
                nomor sales resmi sudah dikonfigurasi.
              </p>
              <div className="mt-4">
                <WhatsappCta />
              </div>
            </div>

            <dl className="flex flex-col gap-4">
              {FIELDS.map((field) => (
                <div key={field.id} className="public-card rounded-base p-4">
                  <dt
                    id={`${field.id}-term`}
                    className="text-sm font-bold font-heading tracking-widest uppercase"
                  >
                    {field.term}
                  </dt>
                  <dd
                    aria-labelledby={`${field.id}-term`}
                    className="public-pending mt-2 rounded-base px-3 py-2"
                  >
                    {field.value}
                  </dd>
                </div>
              ))}
            </dl>

            <p className="public-pending rounded-base px-3 py-2">
              Peta lokasi: [REAL DATA] &middot; tidak ada peta yang ditampilkan sebelum alamat resmi
              tersedia.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold font-heading">Formulir kontak</h2>

            <form
              aria-labelledby="kontak-form-title"
              className="public-card rounded-base p-5"
              noValidate
            >
              <h3 id="kontak-form-title" className="text-lg font-bold font-heading">
                Formulir belum tersedia
              </h3>
              <p
                role="note"
                className="public-pending mt-3 rounded-base px-3 py-2 tracking-normal normal-case"
              >
                Pratinjau. Formulir ini dinonaktifkan karena belum ada endpoint pengiriman.
                Pengiriman, penyimpanan, dan notifikasi email belum tersedia. Gunakan WhatsApp di
                samping, atau kembali lagi setelah kanal email resmi dirilis.
              </p>

              <div className="mt-5 flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="kontak-nama">Nama</Label>
                  <Input id="kontak-nama" name="nama" type="text" autoComplete="off" disabled />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="kontak-email">Email</Label>
                  <Input id="kontak-email" name="email" type="email" autoComplete="off" disabled />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="kontak-pesan">Pesan</Label>
                  <Textarea id="kontak-pesan" name="pesan" rows={4} disabled />
                </div>

                <Button
                  type="button"
                  disabled
                  aria-disabled="true"
                  title="Formulir belum tersedia karena endpoint pengiriman belum ada"
                  className="w-fit"
                >
                  Kirim pesan
                </Button>

                <p className="font-mono text-xs tracking-widest uppercase">
                  Tidak ada pengiriman: tombol dan seluruh kontrol dinonaktifkan.
                </p>
              </div>
            </form>
          </div>
        </div>
      </section>
    </>
  );
}
