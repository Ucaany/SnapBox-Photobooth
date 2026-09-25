import type { Metadata } from 'next';

import { ComponentGallery } from './component-gallery';

/**
 * Halaman galeri komponen neobrutalism `@snapbox/ui`.
 *
 * Rute `/gallery` sengaja menampilkan katalog komponen sebagai bukti visual
 * bahwa seluruh 62+ komponen terpasang benar. Halaman bersifat internal: tidak
 * untuk mesin pencari, jadi `robots` di-noindex dan follow.
 */
export const metadata: Metadata = {
  title: 'Galeri Komponen',
  description:
    'Katalog komponen neobrutalism SnapBox: aksi, formulir, data, umpan balik, navigasi, dan overlay.',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <ComponentGallery />;
}
