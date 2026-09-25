import Link from 'next/link';

import { PUBLIC_NAV } from '@/content/public';

import { PublicHeaderMenu } from './public-header-menu';
import { WhatsappCta } from './whatsapp-cta';

/**
 * Header publik. Server component: hanya `PublicHeaderMenu` dan `WhatsappCta`
 * yang menjadi leaf klien, sehingga navigasi desktop ter-render di server.
 *
 * Login: sampai rute auth/dashboard benar-benar ada, tidak ada href yang sah.
 * Karena itu Login dirender sebagai tombol disabled berlabel, bukan tautan mati.
 */

function LogoMark() {
  return (
    <Link
      href="/"
      className="public-press inline-flex items-center gap-2 rounded-base border-2 border-[#141414] bg-[#FFDD00] px-3 py-2 text-sm font-bold font-heading tracking-tight text-[#141414] uppercase shadow-[4px_4px_0_0_#141414]"
      aria-label="SnapBox Photobooth, kembali ke beranda"
    >
      <span
        aria-hidden="true"
        className="inline-block size-3 rounded-[2px] border-2 border-[#141414] bg-[#FF1F8F]"
      />
      SnapBox
    </Link>
  );
}

function DisabledLogin() {
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      title="Login tersedia setelah rute autentikasi dirilis"
      className="inline-flex h-11 cursor-not-allowed items-center gap-2 rounded-base border-2 border-dashed border-[#141414] bg-[#F5F0DC] px-4 text-sm font-heading text-[#141414] opacity-80"
    >
      Login
      <span className="border-l-2 border-[#141414] pl-2 font-mono text-[10px] tracking-widest uppercase">
        Belum tersedia
      </span>
    </button>
  );
}

export function PublicHeader() {
  return (
    <header className="public-header sticky top-0 z-40 border-b-4 border-[#141414] bg-[#FFFEF5]">
      <div className="public-container flex h-16 items-center justify-between gap-4">
        <LogoMark />

        <nav aria-label="Navigasi utama" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {PUBLIC_NAV.header.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-flex h-11 items-center rounded-base px-3 text-sm font-base text-[#141414] transition-colors hover:bg-[#FFDD00]"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <DisabledLogin />
          <WhatsappCta size="sm" />
        </div>

        <PublicHeaderMenu
          items={PUBLIC_NAV.header}
          loginSlot={<DisabledLogin />}
          ctaSlot={<WhatsappCta size="sm" />}
        />
      </div>
    </header>
  );
}
