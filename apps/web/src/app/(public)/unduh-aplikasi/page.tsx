import { Button } from '@snapbox/ui';

import type { Metadata } from 'next';

import { DOWNLOAD } from '@/content/public';
import { buildPublicMetadata } from '@/lib/public-metadata';

/**
 * Halaman unduh aplikasi desktop.
 *
 * Belum ada rilis installer. Tidak ada anchor unduhan, tidak ada `href="#"`,
 * dan tidak ada URL berkas rekaan. Setiap platform dirender sebagai kontrol
 * `disabled` berlabel `Coming soon` (dari `DOWNLOAD.platforms`). Changelog dan
 * kebutuhan minimum perangkat juga state pending `[REAL DATA]`; PRD tidak
 * memberi versi, changelog, atau spesifikasi minimum, jadi tidak ada yang
 * dikarang.
 *
 * Tombol "Buka Konsol Perangkat (Web)": TIDAK ada rute konsol di aplikasi
 * (`apps/web/src/app` hanya memuat halaman publik dan `/gallery`), jadi tombol
 * dirender sebagai kontrol disabled berlabel, bukan tautan ke rute hantu.
 */

export const metadata: Metadata = buildPublicMetadata('/unduh-aplikasi');

export default function UnduhAplikasiPage() {
  return (
    <>
      <section className="public-section public-container">
        <p className="font-mono text-xs tracking-widest uppercase">Aplikasi Desktop</p>
        <h1 className="mt-2 max-w-[24ch] text-3xl leading-tight font-bold font-heading md:text-5xl">
          Unduh Aplikasi Desktop
        </h1>
        <p className="mt-4 max-w-[65ch] text-base leading-relaxed">
          Installer kiosk SnapBox untuk Windows dan Linux. Rilis pertama belum tersedia, jadi tautan
          unduhan dinonaktifkan sampai berkas resmi dipublikasikan.
        </p>
      </section>

      <section aria-labelledby="platform-heading" className="public-section public-container pt-0">
        <h2 id="platform-heading" className="text-2xl font-bold font-heading">
          Platform
        </h2>

        <ul className="mt-6 grid gap-5 md:grid-cols-2">
          {DOWNLOAD.platforms.map((platform) => (
            <li key={`${platform.os}-${platform.format}`} className="public-card rounded-base p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-xl font-bold font-heading">{platform.os}</h3>
                <p className="public-pending rounded-base px-2 py-1">{platform.status}</p>
              </div>
              <p className="mt-3 font-mono text-sm">{platform.format}</p>
              <Button
                type="button"
                disabled
                aria-disabled="true"
                title={`Installer ${platform.os} (${platform.format}) belum dirilis`}
                className="mt-4 w-fit"
              >
                Unduh untuk {platform.os}
              </Button>
              <p className="mt-2 font-mono text-xs tracking-widest uppercase">
                Tautan unduhan aktif setelah rilis resmi.
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="info-heading" className="public-section public-container pt-0">
        <h2 id="info-heading" className="text-2xl font-bold font-heading">
          Changelog dan kebutuhan minimum
        </h2>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <div className="public-card rounded-base p-5">
            <h3 className="text-lg font-bold font-heading">Changelog</h3>
            <p className="public-pending mt-3 rounded-base px-3 py-2">{DOWNLOAD.changelog}</p>
            <p className="mt-3 text-sm leading-relaxed">
              Riwayat versi ditampilkan setelah rilis pertama dikonfirmasi.
            </p>
          </div>

          <div className="public-card rounded-base p-5">
            <h3 className="text-lg font-bold font-heading">Kebutuhan minimum perangkat</h3>
            <p className="public-pending mt-3 rounded-base px-3 py-2">{DOWNLOAD.minimumHardware}</p>
            <p className="mt-3 text-sm leading-relaxed">
              Spesifikasi minimum menunggu data resmi dari tim produk.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <Button
            type="button"
            disabled
            aria-disabled="true"
            title="Konsol perangkat berbasis web belum tersedia sebagai rute publik"
            className="w-fit"
          >
            Buka Konsol Perangkat (Web)
          </Button>
          <p className="public-pending w-fit rounded-base px-3 py-2 tracking-normal normal-case">
            Konsol perangkat berbasis web belum tersedia sebagai rute di aplikasi ini, jadi tombol
            dinonaktifkan alih-alih menautkan ke rute yang tidak ada.
          </p>
        </div>
      </section>
    </>
  );
}
