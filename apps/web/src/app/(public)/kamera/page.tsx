import type { Metadata } from 'next';
import Link from 'next/link';

import { WhatsappCta } from '@/components/public/whatsapp-cta';
import { CAMERAS } from '@/content/public';
import { buildPublicMetadata } from '@/lib/public-metadata';

/**
 * Halaman dukungan kamera publik.
 *
 * Registry kamera belum ada (`CAMERAS.status === 'pending'`), jadi halaman ini
 * hanya menampilkan state pending eksplisit ditambah info dukungan brand/SDK
 * yang memang sudah terkonfirmasi di PRD. Tidak ada jumlah kamera, tidak ada
 * model spesifik, dan tidak ada filter: filter brand tanpa data registry hanya
 * interaktivitas palsu yang menyembunyikan ketiadaan data, jadi sengaja
 * dihilangkan (dijelaskan di laporan).
 */
export const metadata: Metadata = buildPublicMetadata('/kamera');

export default function KameraPage() {
  return (
    <>
      <section className="public-section border-b-4 border-[#141414]">
        <div className="public-container">
          <p className="font-mono text-xs tracking-[0.2em] text-[#141414]/70 uppercase">
            Dukungan Kamera
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl leading-tight font-bold font-heading tracking-tight md:text-5xl">
            {CAMERAS.heading}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed">{CAMERAS.body}</p>
        </div>
      </section>

      <section className="public-section" aria-labelledby="registry-heading">
        <div className="public-container">
          <h2
            id="registry-heading"
            className="text-2xl font-bold font-heading tracking-tight md:text-3xl"
          >
            Registry kamera
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed">
            Daftar model kamera yang terverifikasi belum dipublikasikan. Halaman ini akan memuat
            registry resmi setelah data selesai diverifikasi.
          </p>

          <div className="public-pending mt-6 flex min-h-40 flex-col justify-center gap-2 rounded-base p-6 text-center">
            <p className="font-mono text-sm tracking-[0.15em] uppercase">
              Registry kamera: {CAMERAS.note}
            </p>
            <p className="text-xs tracking-normal normal-case">
              Belum ada daftar model kamera yang terverifikasi untuk ditampilkan.
            </p>
          </div>
        </div>
      </section>

      <section
        className="public-section border-y-4 border-[#141414]"
        aria-labelledby="brand-heading"
      >
        <div className="public-container">
          <h2
            id="brand-heading"
            className="text-2xl font-bold font-heading tracking-tight md:text-3xl"
          >
            Brand dan SDK yang didukung
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed">
            Aplikasi desktop kiosk SnapBox bersifat hardware-first. Dukungan disediakan melalui SDK
            resmi berikut.
          </p>
          <p className="public-pending mt-4 inline-block rounded-base px-3 py-2">
            SDK: {CAMERAS.sdkNote}
          </p>

          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CAMERAS.brands.map((brand) => (
              <li
                key={brand}
                className="public-card public-hard-shadow flex min-h-24 items-center justify-center p-5 text-center"
              >
                <span className="text-lg font-bold font-heading tracking-tight">{brand}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="public-section" aria-labelledby="troubleshoot-heading">
        <div className="public-container flex flex-col items-start gap-4">
          <h2
            id="troubleshoot-heading"
            className="text-2xl font-bold font-heading tracking-tight md:text-3xl"
          >
            Kamera tidak terdeteksi?
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed">
            Ikuti panduan troubleshooting untuk langkah pemeriksaan kabel, mode PTP, format JPEG,
            sampai pengaturan auto power off.
          </p>
          <Link
            href="/docs/troubleshooting"
            className="public-hard-shadow-sm inline-flex min-h-11 items-center border-2 border-[#141414] bg-[#FFDD00] px-5 text-sm font-bold font-heading tracking-wide uppercase underline-offset-4"
          >
            Buka panduan troubleshooting
          </Link>
          <WhatsappCta label="Konsultasi via WhatsApp" size="lg" />
        </div>
      </section>
    </>
  );
}
