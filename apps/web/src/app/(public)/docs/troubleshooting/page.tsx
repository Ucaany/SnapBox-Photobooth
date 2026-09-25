import Link from 'next/link';

import type { Metadata } from 'next';

import { TROUBLESHOOTING_STEPS } from '@/content/public';
import { buildPublicMetadata } from '@/lib/public-metadata';
import { WhatsappCta } from '@/components/public/whatsapp-cta';

/**
 * Halaman troubleshooting kamera.
 *
 * Menampilkan ENAM langkah judul dari `TROUBLESHOOTING_STEPS`. PRD hanya
 * menyuplai enam label (USB data, mode PTP, tutup utility bawaan, JPEG L, auto
 * power off, USB power supply Sony) tanpa prosa isi, jadi tiap langkah
 * menampilkan judul + state detail pending yang diberi label. Tidak ada
 * instruksi, perintah, atau nilai menu yang dikarang.
 *
 * CATATAN DISKREPANSI: PRD tidak konsisten. Satu bagian menyebut wizard tiga
 * langkah, bagian lain menyebut enam langkah. Halaman ini merender ENAM sesuai
 * `public.ts` (daftar yang diminta) dan menandai perbedaan tersebut, bukan
 * diam-diam mengganti jumlahnya.
 */

export const metadata: Metadata = buildPublicMetadata('/docs/troubleshooting');

export default function TroubleshootingPage() {
  return (
    <>
      <section className="public-section public-container">
        <p className="font-mono text-xs tracking-widest uppercase">Dokumentasi</p>
        <h1 className="mt-2 max-w-[24ch] text-3xl leading-tight font-bold font-heading md:text-5xl">
          Troubleshooting Kamera
        </h1>
        <p className="mt-4 max-w-[65ch] text-base leading-relaxed">
          Enam langkah untuk mendeteksi kamera pada kiosk SnapBox. Setiap langkah berisi judul
          resmi; detail prosedur menyusul setelah disetujui tim produk.
        </p>
      </section>

      <section aria-labelledby="langkah-heading" className="public-section public-container pt-0">
        <h2 id="langkah-heading" className="text-2xl font-bold font-heading">
          Langkah pemeriksaan
        </h2>

        <ol className="mt-6 flex flex-col gap-5">
          {TROUBLESHOOTING_STEPS.map((step) => (
            <li key={step.step} className="public-card rounded-base p-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex size-9 items-center justify-center rounded-base border-2 border-[#141414] bg-[#FFDD00] text-sm font-bold font-heading">
                  {step.step}
                </span>
                <p className="font-mono text-xs tracking-widest uppercase">Langkah {step.step}</p>
                <p className="public-pending rounded-base px-2 py-1">{step.label}</p>
              </div>

              <h3 className="mt-3 text-xl font-bold font-heading">{step.title}</h3>

              <dl className="mt-4 flex flex-col gap-3">
                <div>
                  <dt className="font-mono text-xs tracking-widest uppercase">
                    Penjelasan langkah
                  </dt>
                  <dd className="public-pending mt-1 inline-block rounded-base px-3 py-2">
                    {step.description}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-xs tracking-widest uppercase">Detail prosedur</dt>
                  <dd className="public-pending mt-1 inline-block rounded-base px-3 py-2">
                    {step.detail}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ol>

        <p
          role="note"
          className="public-pending mt-6 rounded-base px-4 py-3 tracking-normal normal-case"
        >
          Catatan diskrepansi PRD: dokumen sumber tidak konsisten dan menyebut wizard tiga langkah
          di satu bagian serta enam langkah di bagian lain. Halaman ini menampilkan enam langkah
          lengkap sesuai daftar resmi di konten terpusat. Jumlah tidak diganti diam-diam.
        </p>
      </section>

      <section aria-labelledby="bantuan-heading" className="public-section public-container pt-0">
        <h2 id="bantuan-heading" className="text-2xl font-bold font-heading">
          Masih belum terdeteksi?
        </h2>
        <p className="mt-3 max-w-[65ch] text-base leading-relaxed">
          Lihat daftar dukungan kamera untuk merek dan SDK yang sudah dikonfirmasi, atau konsultasi
          langsung dengan tim SnapBox.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <Link
            href="/kamera"
            className="public-press public-hard-shadow-sm inline-flex h-11 items-center rounded-base border-2 border-[#141414] bg-[#FFFEF5] px-5 text-sm font-bold font-heading text-[#141414]"
          >
            Dukungan kamera
          </Link>
          <WhatsappCta />
        </div>
      </section>
    </>
  );
}
