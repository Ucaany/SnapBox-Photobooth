'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import type { PublicNavItem } from '@/content/public';

/**
 * Toggle menu mobile header publik.
 *
 * Aksesibilitas:
 * - Tombol native dengan `aria-expanded` dan `aria-controls` yang menunjuk id panel.
 * - Escape menutup menu dan mengembalikan fokus ke tombol.
 * - Panel ditutup otomatis saat rute berubah (`usePathname`) supaya navigasi
 *   tidak meninggalkan menu terbuka.
 * - Bukan overlay `fixed`, jadi tidak ada lapisan yang membocorkan keluar
 *   kontainer; panel mengalir di bawah header (in-flow) dan aman dari scroll body.
 */

const PANEL_ID = 'public-mobile-nav';

export type PublicHeaderMenuProps = {
  readonly items: readonly PublicNavItem[];
  readonly loginSlot: React.ReactNode;
  readonly ctaSlot: React.ReactNode;
};

export function PublicHeaderMenu({ items, loginSlot, ctaSlot }: PublicHeaderMenuProps) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const toggleRef = React.useRef<HTMLButtonElement>(null);

  // Tutup saat rute berubah (klik tautan di dalam panel).
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Escape menutup dan fokus kembali ke tombol.
  React.useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls={PANEL_ID}
        aria-label={open ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex size-11 items-center justify-center rounded-base border-2 border-[#141414] bg-[#FFDD00] text-[#141414] shadow-[3px_3px_0_0_#141414]"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="square"
          className="size-5"
        >
          {open ? <path d="M5 5l14 14M19 5L5 19" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>

      <div
        id={PANEL_ID}
        hidden={!open}
        className="absolute inset-x-0 top-16 border-b-4 border-[#141414] bg-[#FFFEF5] p-4 shadow-[0_6px_0_0_#141414]"
      >
        <nav aria-label="Navigasi mobile">
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-flex min-h-11 w-full items-center rounded-base border-2 border-transparent px-3 text-base font-heading text-[#141414] hover:border-[#141414] hover:bg-[#FFDD00]"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-4 flex flex-col gap-3 border-t-2 border-dashed border-[#141414] pt-4">
          {loginSlot}
          {ctaSlot}
        </div>
      </div>
    </div>
  );
}
