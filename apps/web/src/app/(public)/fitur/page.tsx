import Link from 'next/link';
import type { Metadata } from 'next';

import { FEATURES, HERO, type FeatureModule } from '@/content/public';
import { buildPublicMetadata } from '@/lib/public-metadata';

/**
 * Halaman `/fitur`.
 *
 * PRD mendaftarkan enam modul tetapi tidak menyediakan deskripsi pemasaran, jadi
 * `description` pada `FEATURES` adalah `[REAL DATA]` dengan `pending: true`.
 * Halaman ini TIDAK mengarang deskripsi fitur dan TIDAK menampilkan screenshot
 * palsu: setiap modul mendapat placeholder mockup berlabel (bergaris putus-putus).
 *
 * Komposisi tiap modul sengaja berbeda (anti-slop): numbered spec sheet, split
 * mockup, index list, quote panel, step flow, dan metric board. Tidak ada enam
 * kartu identik yang di-center.
 */

export const metadata: Metadata = buildPublicMetadata('/fitur');

const MODULE_LABELS: readonly string[] = [
  'Modul 01',
  'Modul 02',
  'Modul 03',
  'Modul 04',
  'Modul 05',
  'Modul 06',
];

/**
 * Akses modul dengan guard. `FEATURES` bertipe array sehingga index bisa
 * `undefined` saat `noUncheckedIndexedAccess` aktif. Guard ini menjaga tipe
 * tetap aman tanpa non-null assertion; daftar modul statis dan tidak pernah
 * kosong di runtime.
 */
function featureAt(index: number): FeatureModule {
  const feature = FEATURES[index];
  if (!feature) {
    throw new Error('Modul fitur index ' + String(index) + ' tidak tersedia');
  }
  return feature;
}

function MockupPlaceholder({
  label,
  className,
}: {
  readonly label: string;
  readonly className?: string;
}) {
  return (
    <figure
      className={[
        'flex min-h-44 flex-col items-center justify-center gap-2 rounded-base border-2 border-dashed border-[#141414] bg-[#F5F0DC] p-6 text-center',
        className ?? '',
      ].join(' ')}
      aria-label={`Placeholder mockup: ${label}`}
    >
      <span aria-hidden="true" className="flex items-center gap-1.5">
        <span className="size-2 rotate-45 border-2 border-[#141414] bg-[#FFDD00]" />
        <span className="size-2 rounded-full border-2 border-[#141414] bg-[#8B5CF6]" />
        <span className="size-2 border-2 border-[#141414] bg-[#FF1F8F]" />
      </span>
      <figcaption className="font-mono text-xs tracking-[0.2em] uppercase">{label}</figcaption>
      <span className="public-pending rounded-base px-2 py-1">[REAL DATA]</span>
    </figure>
  );
}

/**
 * Deskripsi modul selalu `[REAL DATA]` karena `pending` pada tipe kontrak.
 * Render ini tidak pernah menampilkan teks yang belum terverifikasi.
 */
function ModuleDescription({ value }: { readonly value: string }) {
  return (
    <p className="text-sm leading-relaxed font-base">
      {value}
      <span className="mt-2 block font-mono text-[11px] tracking-widest uppercase">
        Deskripsi pemasaran modul ini belum tersedia.
      </span>
    </p>
  );
}

function MachineManager() {
  const feature = featureAt(0);
  return (
    <section
      className="public-section border-b-2 border-[#141414]"
      aria-labelledby="fitur-machine-manager"
    >
      <div className="public-container grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
        <div>
          <p className="font-mono text-xs tracking-[0.3em] text-[#8B5CF6] uppercase">
            {MODULE_LABELS[0]} / 06
          </p>
          <h2
            id="fitur-machine-manager"
            className="mt-3 text-3xl leading-tight font-bold font-heading tracking-tight uppercase md:text-4xl"
          >
            {feature.name}
          </h2>
          <div className="mt-4 max-w-xl">
            <ModuleDescription value={feature.description} />
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-3 border-t-2 border-[#141414] pt-4 font-mono text-[11px] tracking-widest uppercase">
            <div>
              <dt className="text-[#8B5CF6]">Kontrol</dt>
              <dd className="mt-1 tracking-normal normal-case">[REAL DATA]</dd>
            </div>
            <div>
              <dt className="text-[#8B5CF6]">Cakupan</dt>
              <dd className="mt-1 tracking-normal normal-case">[REAL DATA]</dd>
            </div>
          </dl>
        </div>
        <MockupPlaceholder label={feature.mockupLabel} className="public-hard-shadow" />
      </div>
    </section>
  );
}

function FrameStudio() {
  const feature = featureAt(1);
  return (
    <section
      className="public-section border-b-2 border-[#141414] bg-[#FFDD00]"
      aria-labelledby="fitur-frame-studio"
    >
      <div className="public-container">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2
            id="fitur-frame-studio"
            className="text-3xl font-bold font-heading tracking-tight uppercase md:text-4xl"
          >
            {feature.name}
          </h2>
          <p className="font-mono text-xs tracking-[0.3em] uppercase">{MODULE_LABELS[1]} / 06</p>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <MockupPlaceholder
            label={feature.mockupLabel}
            className="public-hard-shadow bg-[#FFFEF5]"
          />
          <div className="flex flex-col justify-center gap-4 rounded-base border-2 border-[#141414] bg-[#FFFEF5] p-6">
            <ModuleDescription value={feature.description} />
          </div>
        </div>
      </div>
    </section>
  );
}

function ChromaKey() {
  const feature = featureAt(2);
  return (
    <section
      className="public-section border-b-2 border-[#141414] bg-[#FFFEF5]"
      aria-labelledby="fitur-chroma-key"
    >
      <div className="public-container">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className="public-card flex flex-col justify-between gap-6 rounded-base p-6 md:p-8">
            <div>
              <p className="font-mono text-xs tracking-[0.3em] text-[#FF1F8F] uppercase">
                {MODULE_LABELS[2]} / 06
              </p>
              <h2
                id="fitur-chroma-key"
                className="mt-3 text-3xl leading-tight font-bold font-heading tracking-tight uppercase md:text-4xl"
              >
                {feature.name}
              </h2>
            </div>
            <ModuleDescription value={feature.description} />
          </div>
          <div className="flex flex-col gap-4">
            <MockupPlaceholder label={feature.mockupLabel} className="min-h-64 bg-[#8B5CF6]/10" />
            <ul className="grid gap-2 font-mono text-[11px] tracking-widest uppercase">
              <li className="rounded-base border-2 border-dashed border-[#141414] px-3 py-2">
                Latar terang: [REAL DATA]
              </li>
              <li className="rounded-base border-2 border-dashed border-[#141414] px-3 py-2">
                Latar kroma: [REAL DATA]
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function PromoEngine() {
  const feature = featureAt(3);
  return (
    <section
      className="public-section border-b-2 border-[#141414]"
      aria-labelledby="fitur-promo-engine"
    >
      <div className="public-container">
        <div className="mx-auto max-w-3xl border-l-8 border-[#FF1F8F] pl-6 md:pl-10">
          <p className="font-mono text-xs tracking-[0.3em] uppercase">{MODULE_LABELS[3]} / 06</p>
          <h2
            id="fitur-promo-engine"
            className="mt-3 text-3xl leading-tight font-bold font-heading tracking-tight uppercase md:text-5xl"
          >
            {feature.name}
          </h2>
          <blockquote className="mt-5 text-xl leading-snug font-heading tracking-tight md:text-2xl">
            &ldquo;{feature.description}&rdquo;
          </blockquote>
          <p className="mt-2 font-mono text-[11px] tracking-widest uppercase">
            Kutipan menunggu isi resmi
          </p>
        </div>
        <div className="mt-8">
          <MockupPlaceholder label={feature.mockupLabel} className="min-h-56" />
        </div>
      </div>
    </section>
  );
}

function KioskCustomizer() {
  const feature = featureAt(4);
  const steps: readonly string[] = ['Tema', 'Alur sesi', 'Layar kiosk', '[REAL DATA]'];
  return (
    <section
      className="public-section border-b-2 border-[#141414] bg-[#141414] text-[#FFFEF5]"
      aria-labelledby="fitur-kiosk-customizer"
    >
      <div className="public-container">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2
            id="fitur-kiosk-customizer"
            className="text-3xl font-bold font-heading tracking-tight uppercase md:text-4xl"
          >
            {feature.name}
          </h2>
          <p className="font-mono text-xs tracking-[0.3em] text-[#FFDD00] uppercase">
            {MODULE_LABELS[4]} / 06
          </p>
        </div>

        <ol className="mt-8 flex flex-col gap-0 md:flex-row md:items-stretch">
          {steps.map((step, index) => (
            <li
              key={step}
              className="flex flex-1 items-start gap-4 border-2 border-[#FFFEF5] p-5 md:border-r-0 md:last:border-r-2"
            >
              <span className="font-mono text-lg text-[#FFDD00]">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <h3 className="text-base font-bold font-heading tracking-tight uppercase">
                  {step}
                </h3>
                <p className="mt-1 font-mono text-[11px] tracking-widest text-[#F5F0DC] uppercase">
                  Konfigurasi: [REAL DATA]
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-8">
          <ModuleDescription value={feature.description} />
        </div>
        <div className="mt-6">
          <MockupPlaceholder
            label={feature.mockupLabel}
            className="public-hard-shadow border-[#FFFEF5] bg-transparent text-[#FFFEF5]"
          />
        </div>
      </div>
    </section>
  );
}

function Analytics() {
  const feature = featureAt(5);
  const tiles: readonly string[] = ['Sesi', 'Konversi', 'Uptime', 'Outlet'];
  return (
    <section className="public-section" aria-labelledby="fitur-analytics">
      <div className="public-container">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:items-start">
          <div>
            <p className="font-mono text-xs tracking-[0.3em] text-[#16A34A] uppercase">
              {MODULE_LABELS[5]} / 06
            </p>
            <h2
              id="fitur-analytics"
              className="mt-3 text-3xl leading-tight font-bold font-heading tracking-tight uppercase md:text-4xl"
            >
              {feature.name}
            </h2>
            <div className="mt-4">
              <ModuleDescription value={feature.description} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tiles.map((tile) => (
              <div
                key={tile}
                className="flex flex-col justify-between gap-6 rounded-base border-2 border-[#141414] bg-[#FFFEF5] p-4"
              >
                <span className="font-mono text-[11px] tracking-widest uppercase">{tile}</span>
                <span className="text-lg font-bold font-heading uppercase">[REAL DATA]</span>
              </div>
            ))}
            <MockupPlaceholder
              label={feature.mockupLabel}
              className="col-span-2 min-h-40 sm:col-span-4"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export default function FiturPage() {
  return (
    <>
      <section className="public-section border-b-4 border-[#141414] bg-[#FFFEF5]">
        <div className="public-container">
          <p className="font-mono text-xs tracking-[0.3em] uppercase">Fitur</p>
          <h1 className="mt-4 max-w-4xl text-4xl leading-[0.98] font-bold font-heading tracking-tight uppercase md:text-6xl">
            Enam modul, satu alur operasional.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed font-base md:text-lg">
            {HERO.subCopy}
          </p>
          <p className="public-pending mt-6 inline-block rounded-base px-3 py-2">
            Deskripsi pemasaran tiap modul menunggu konten resmi: [REAL DATA]
          </p>
        </div>
      </section>

      <MachineManager />
      <FrameStudio />
      <ChromaKey />
      <PromoEngine />
      <KioskCustomizer />
      <Analytics />

      <section className="public-section border-t-4 border-[#141414] bg-[#FF1F8F] text-[#FFFEF5]">
        <div className="public-container flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold font-heading tracking-tight uppercase md:text-3xl">
              Butuh detail teknis per modul?
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed font-base">
              Panduan troubleshooting kamera dan jalur konsultasi tersedia untuk membantu
              implementasi.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/docs/troubleshooting"
              className="public-press inline-flex h-11 items-center rounded-base border-2 border-[#141414] bg-[#FFDD00] px-5 text-sm font-bold font-heading tracking-tight text-[#141414] uppercase shadow-[4px_4px_0_0_#141414]"
            >
              Troubleshooting Kamera
            </Link>
            <Link
              href="/kontak"
              className="public-press inline-flex h-11 items-center rounded-base border-2 border-[#141414] bg-[#FFFEF5] px-5 text-sm font-bold font-heading tracking-tight text-[#141414] uppercase shadow-[4px_4px_0_0_#141414]"
            >
              Konsultasi Gratis
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
