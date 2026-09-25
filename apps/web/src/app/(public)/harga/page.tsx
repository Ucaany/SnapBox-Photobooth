import type { Metadata } from 'next';
import Link from 'next/link';

import { WhatsappCta } from '@/components/public/whatsapp-cta';
import { PRICING } from '@/content/public';
import { buildPublicMetadata } from '@/lib/public-metadata';

/**
 * Halaman harga publik.
 *
 * Harga rupiah belum disetujui untuk rilis publik, jadi halaman ini hanya
 * menampilkan placeholder eksplisit `Coming soon` dan `[REAL PRICE]` dari
 * `PRICING`. Tidak ada nilai Rp di mana pun dan tidak ada alur self-checkout;
 * satu-satunya jalur adalah konsultasi lewat `WhatsappCta`. Perbandingan fitur
 * dirender sebagai state pending, bukan matriks fitur karangan.
 */
export const metadata: Metadata = buildPublicMetadata('/harga');

export default function HargaPage() {
  return (
    <>
      <section className="public-section border-b-4 border-[#141414]">
        <div className="public-container">
          <p className="font-mono text-xs tracking-[0.2em] text-[#141414]/70 uppercase">Harga</p>
          <h1 className="mt-3 max-w-3xl text-4xl leading-tight font-bold font-heading tracking-tight md:text-5xl">
            Pilih paket sesuai skala booth Anda
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed">{PRICING.note}</p>
          <p className="public-pending mt-6 inline-block rounded-base px-3 py-2">
            Nilai harga: [REAL PRICE]
          </p>
        </div>
      </section>

      <section className="public-section" aria-labelledby="paket-heading">
        <div className="public-container">
          <h2
            id="paket-heading"
            className="text-2xl font-bold font-heading tracking-tight md:text-3xl"
          >
            Paket
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed">
            Tiga tier SnapBox. Detail fitur dan harga final menyusul.
          </p>

          <ul className="mt-8 grid gap-6 md:grid-cols-3">
            {PRICING.plans.map((plan) => (
              <li
                key={plan.name}
                className="public-card public-hard-shadow flex flex-col gap-4 p-6"
              >
                <h3 className="text-xl font-bold font-heading tracking-tight">{plan.name}</h3>
                <p className="font-mono text-2xl font-bold tracking-tight uppercase">
                  {plan.price}
                </p>
                <p className="public-pending w-fit rounded-base px-2 py-1">Harga: [REAL PRICE]</p>
                <Link
                  href={PRICING.consultationCtaHref}
                  className="mt-auto inline-flex min-h-11 items-center justify-center border-2 border-[#141414] bg-[#FFFEF5] px-4 text-sm font-bold font-heading tracking-wide uppercase underline-offset-4 hover:bg-[#FFDD00]"
                >
                  {plan.ctaLabel}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        className="public-section border-y-4 border-[#141414]"
        aria-labelledby="banding-heading"
      >
        <div className="public-container">
          <h2
            id="banding-heading"
            className="text-2xl font-bold font-heading tracking-tight md:text-3xl"
          >
            Perbandingan fitur
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed">
            Matriks perbandingan fitur antar paket sedang disiapkan dan akan ditampilkan setelah
            detail paket resmi tersedia.
          </p>

          <div className="public-pending mt-6 flex min-h-40 flex-col justify-center gap-2 rounded-base p-6 text-center">
            <p className="font-mono text-sm tracking-[0.15em] uppercase">
              Matriks perbandingan: [REAL DATA]
            </p>
            <p className="text-xs tracking-normal normal-case">
              Belum ada data perbandingan paket yang terverifikasi.
            </p>
          </div>
        </div>
      </section>

      <section className="public-section" aria-labelledby="addon-heading">
        <div className="public-container">
          <h2
            id="addon-heading"
            className="text-2xl font-bold font-heading tracking-tight md:text-3xl"
          >
            Add-on
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed">
            Layanan tambahan tersedia melalui konsultasi. Harga add-on belum dikonfirmasi untuk
            publik.
          </p>
          <p className="public-pending mt-6 w-fit rounded-base px-3 py-2">
            Harga add-on: [REAL PRICE]
          </p>
        </div>
      </section>

      <section
        className="public-section border-t-4 border-[#141414]"
        aria-labelledby="konsultasi-heading"
      >
        <div className="public-container flex flex-col items-start gap-4">
          <h2
            id="konsultasi-heading"
            className="text-2xl font-bold font-heading tracking-tight md:text-3xl"
          >
            Konsultasi paket Anda
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed">{PRICING.note}</p>
          <WhatsappCta label={PRICING.consultationCtaLabel} size="lg" />
          <Link
            href="/kontak"
            className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
          >
            Lihat halaman kontak
          </Link>
        </div>
      </section>
    </>
  );
}
