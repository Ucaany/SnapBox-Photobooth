'use client';

import { useEffect, useState } from 'react';

import { Toaster } from '@snapbox/ui';

import { PrimitivesSection } from './primitives-section';

import { NavigationSection } from './navigation-section';
import { OverlaysSection } from './overlays-section';

import type { ReactNode } from 'react';

type SectionHandle = {
  id: string;
  label: string;
  content: ReactNode;
};

/**
 * Daftar section galeri.
 *
 * Setiap entri memasangkan satu id anchor dengan label navigasi dan komponen
 * isinya. Urutan array menentukan urutan section di halaman sekaligus urutan
 * tautan di daftar isi. Menambah section berarti menambah satu entri di sini.
 */
const SECTION_HANDLES: SectionHandle[] = [
  { id: 'actions', label: 'Aksi', content: <PrimitivesSection group="actions" /> },
  { id: 'forms', label: 'Formulir', content: <PrimitivesSection group="forms" /> },
  { id: 'data', label: 'Data', content: <PrimitivesSection group="data" /> },
  { id: 'feedback', label: 'Umpan Balik', content: <PrimitivesSection group="feedback" /> },
  { id: 'overlays', label: 'Overlay', content: <OverlaysSection /> },
  { id: 'navigation', label: 'Navigasi', content: <NavigationSection /> },
];

/**
 * Shell galeri: header, daftar navigasi anchor, dan seluruh section.
 *
 * `activeId` dihitung lewat IntersectionObserver supaya anchor yang disorot
 * selalu cocok dengan section yang sedang terlihat. Ini bukan dekorasi: tanpa
 * ini daftar navigasi hanya daftar tautan mati yang tidak memberi umpan balik.
 */
export function ComponentGallery() {
  const [activeId, setActiveId] = useState(SECTION_HANDLES[0]?.id ?? '');

  useEffect(() => {
    const elements = SECTION_HANDLES.map((section) => document.getElementById(section.id)).filter(
      (element): element is HTMLElement => element !== null,
    );

    if (elements.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visible?.target.id) {
          setActiveId(visible.target.id);
        }
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: [0, 0.25, 0.5, 1] },
    );

    for (const element of elements) {
      observer.observe(element);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b-2 border-border bg-secondary-background">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-10 md:px-6 md:py-14">
          <h1 className="text-3xl font-heading md:text-4xl">Galeri Komponen SnapBox</h1>
          <p className="max-w-[65ch] text-sm font-base text-foreground">
            Katalog komponen neobrutalism yang dipakai bersama oleh kiosk, dasbor, dan konsol
            perangkat. Setiap contoh di sini benar-benar berjalan, bukan tangkapan layar diam.
          </p>
          <p className="text-sm font-base text-foreground">
            {SECTION_HANDLES.length} kelompok section, 62+ komponen. Gunakan daftar di bawah untuk
            melompat ke section tertentu, atau tekan Tab untuk menelusuri semua kontrol.
          </p>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 md:px-6 md:py-10 lg:flex-row lg:items-start lg:gap-10">
        <nav
          aria-label="Navigasi section galeri"
          className="lg:sticky lg:top-6 lg:w-56 lg:shrink-0"
        >
          <p className="text-sm font-heading">Daftar isi</p>
          <ul className="mt-3 flex flex-wrap gap-2 lg:flex-col lg:flex-nowrap">
            {SECTION_HANDLES.map((section) => {
              const isActive = section.id === activeId;

              return (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    aria-current={isActive ? 'true' : undefined}
                    className={`flex min-h-11 items-center rounded-base border-2 border-border px-3 text-sm font-base transition-colors ${
                      isActive
                        ? 'bg-main text-main-foreground'
                        : 'bg-secondary-background text-foreground hover:bg-main hover:text-main-foreground'
                    }`}
                  >
                    {section.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <main className="flex min-w-0 flex-1 flex-col gap-10">
          {SECTION_HANDLES.map((section) => (
            <div key={section.id} id={section.id} className="scroll-mt-6">
              {section.content}
            </div>
          ))}
        </main>
      </div>

      <Toaster />

      <footer className="border-t-2 border-border bg-secondary-background">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
          <p className="text-sm font-base text-foreground">
            Galeri internal. Halaman ini tidak diindeks mesin pencari.
          </p>
        </div>
      </footer>
    </div>
  );
}
