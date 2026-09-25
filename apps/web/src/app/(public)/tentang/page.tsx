import Link from 'next/link';
import type { Metadata } from 'next';

import { HERO, SITE } from '@/content/public';
import { buildPublicMetadata } from '@/lib/public-metadata';

/**
 * Halaman `/tentang`.
 *
 * Semua copy berasal dari `content/public.ts`. PRD hanya mengonfirmasi kalimat
 * VISION; tidak ada teks misi, data tim, maupun statistik resmi. Karena itu:
 * - Misi dirender sebagai state tertunda berlabel `[REAL DATA]`, bukan dikarang.
 * - Tim dan statistik dirender sebagai state tertunda berlabel `[REAL DATA]`,
 *   tanpa angka pemasaran yang belum terverifikasi dan tanpa counter.
 */

export const metadata: Metadata = buildPublicMetadata('/tentang');

function PendingBlock({
  heading,
  body,
  className,
}: {
  readonly heading: string;
  readonly body: string;
  readonly className?: string;
}) {
  return (
    <div
      className={[
        'public-pending flex h-full flex-col justify-between gap-3 rounded-base p-4',
        className ?? '',
      ].join(' ')}
    >
      <p className="text-sm font-bold font-heading tracking-widest uppercase">{heading}</p>
      <p className="text-xs font-base tracking-normal normal-case">{body}</p>
    </div>
  );
}

function VisionIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}

export default function TentangPage() {
  return (
    <>
      <section className="public-section border-b-4 border-[#141414] bg-[#FFDD00]">
        <div className="public-container">
          <p className="font-mono text-xs tracking-[0.3em] uppercase">Tentang Kami</p>
          <h1 className="mt-4 max-w-4xl text-4xl leading-[0.98] font-bold font-heading tracking-tight uppercase md:text-6xl">
            Infrastruktur untuk industri photobooth.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed font-base md:text-lg">
            {SITE.description}
          </p>
        </div>
      </section>

      <section className="public-section" aria-labelledby="tentang-cerita">
        <div className="public-container grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
          <div>
            <h2
              id="tentang-cerita"
              className="text-2xl font-bold font-heading tracking-tight uppercase md:text-3xl"
            >
              Cerita
            </h2>
            <div className="mt-5 space-y-4 text-base leading-relaxed font-base">
              <p>
                SnapBox lahir dari satu masalah operasional yang sederhana: mengelola satu booth
                photobooth di satu lokasi masih mudah, tetapi menambah booth ke banyak outlet dengan
                cepat berubah menjadi pekerjaan yang menumpuk.
              </p>
              <p>
                SnapBox dibangun sebagai platform SaaS all-in-one, infrastructure sekaligus
                operating system, supaya konfigurasi harga, frame, tema kiosk, promo, dan printer
                diubah dari web tanpa perlu hadir ke lokasi booth berada.
              </p>
              <p>
                Visinya bukan menambah jumlah alat, tetapi menyederhanakan cara kerja: satu booth
                dioperasikan dengan tata kelola yang sama rapi ketika jumlahnya bertambah banyak.
              </p>
            </div>
            <p className="public-pending mt-6 inline-block rounded-base px-3 py-2">
              Kronologi dan tonggak perusahaan: [REAL DATA]
            </p>
          </div>

          <aside className="public-card public-hard-shadow rounded-base p-6">
            <h2 className="text-sm font-bold font-heading tracking-widest uppercase">
              Ringkasan platform
            </h2>
            <dl className="mt-4 flex flex-col gap-4 text-sm font-base">
              <div>
                <dt className="font-mono text-[11px] tracking-widest uppercase">Produk</dt>
                <dd className="mt-1">{HERO.product}</dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] tracking-widest uppercase">Kategori</dt>
                <dd className="mt-1">Platform SaaS manajemen photobooth multi-tenant</dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] tracking-widest uppercase">
                  Peran dalam alur
                </dt>
                <dd className="mt-1">
                  Menghubungkan Super Admin, Owner/Tenant, Outlet, Booth fisik, dan Customer.
                </dd>
              </div>
            </dl>
          </aside>
        </div>
      </section>

      <section
        className="public-section border-y-4 border-[#141414] bg-[#FFFEF5]"
        aria-labelledby="tentang-visi"
      >
        <div className="public-container">
          <h2
            id="tentang-visi"
            className="text-2xl font-bold font-heading tracking-tight uppercase md:text-3xl"
          >
            Visi dan Misi
          </h2>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <article className="public-card public-hard-shadow flex flex-col gap-4 rounded-base p-6 md:p-8">
              <span className="inline-flex w-fit items-center gap-2 rounded-base border-2 border-[#141414] bg-[#FFDD00] px-3 py-1 font-mono text-[11px] tracking-widest uppercase">
                <VisionIcon />
                Visi
              </span>
              <p className="text-xl leading-snug font-bold font-heading tracking-tight md:text-2xl">
                {HERO.vision}
              </p>
              <p className="text-xs font-base">Kutipan visi resmi dari dokumen PRD SnapBox.</p>
            </article>

            <article className="flex flex-col gap-4 rounded-base border-2 border-dashed border-[#141414] bg-[#F5F0DC] p-6 md:p-8">
              <span className="inline-flex w-fit items-center gap-2 rounded-base border-2 border-dashed border-[#141414] bg-[#FFFEF5] px-3 py-1 font-mono text-[11px] tracking-widest uppercase">
                Misi
              </span>
              <p className="text-xl font-bold font-heading tracking-tight uppercase">[REAL DATA]</p>
              <p className="text-sm leading-relaxed font-base">
                Teks misi resmi belum tersedia di dokumen PRD SnapBox. Bagian ini sengaja dibiarkan
                kosong dan tidak diisi dengan kalimat rekaan.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="public-section" aria-labelledby="tentang-pilar">
        <div className="public-container">
          <h2
            id="tentang-pilar"
            className="text-2xl font-bold font-heading tracking-tight uppercase md:text-3xl"
          >
            Pilar nilai
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed font-base">
            Lima prinsip yang dipegang SnapBox dalam membangun dan mengoperasikan platform.
          </p>

          <ol className="mt-8 grid gap-0 border-2 border-[#141414] md:grid-cols-2">
            {HERO.valuePillars.map((pillar, index) => (
              <li
                key={pillar.name}
                className="flex gap-4 border-b-2 border-[#141414] p-5 last:border-b-0 md:p-6 md:odd:border-r-2 md:[&:nth-last-child(-n+2)]:border-b-0"
              >
                <span className="font-mono text-sm text-[#8B5CF6]">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="text-base font-bold font-heading tracking-tight uppercase">
                    {pillar.name}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed font-base">{pillar.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        className="public-section border-t-4 border-[#141414] bg-[#141414] text-[#FFFEF5]"
        aria-labelledby="tentang-data"
      >
        <div className="public-container">
          <h2
            id="tentang-data"
            className="text-2xl font-bold font-heading tracking-tight uppercase md:text-3xl"
          >
            Tim dan angka
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed font-base text-[#F5F0DC]">
            SnapBox tidak menampilkan profil tim maupun statistik sebelum datanya terverifikasi.
            Tidak ada angka, nama, atau foto yang direkayasa di halaman ini.
          </p>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <PendingBlock
              heading="Profil tim: [REAL DATA]"
              body="Struktur tim, nama, peran, dan foto akan ditampilkan setelah data resmi dikonfirmasi. Saat ini belum ada."
            />
            <PendingBlock
              heading="Statistik perusahaan: [REAL DATA]"
              body="Jumlah booth aktif, jumlah tenant, dan metrik lain belum terverifikasi. Bagian ini tidak memakai counter atau klaim angka apa pun."
            />
          </div>
        </div>
      </section>

      <section className="public-section" aria-labelledby="tentang-lanjut">
        <div className="public-container flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2
              id="tentang-lanjut"
              className="text-2xl font-bold font-heading tracking-tight uppercase md:text-3xl"
            >
              Lanjutkan
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed font-base">
              Lihat modul yang tersedia atau konsultasikan kebutuhan bisnis photobooth Anda dengan
              tim SnapBox.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/fitur"
              className="public-press inline-flex h-11 items-center rounded-base border-2 border-[#141414] bg-[#FFDD00] px-5 text-sm font-bold font-heading tracking-tight uppercase shadow-[4px_4px_0_0_#141414]"
            >
              Lihat Fitur
            </Link>
            <Link
              href="/kontak"
              className="public-press inline-flex h-11 items-center rounded-base border-2 border-[#141414] bg-[#FFFEF5] px-5 text-sm font-bold font-heading tracking-tight uppercase shadow-[4px_4px_0_0_#141414]"
            >
              Kunjungi Halaman Kontak
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
