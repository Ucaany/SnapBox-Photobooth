import { PublicFooter } from '@/components/public/public-footer';
import { PublicHeader } from '@/components/public/public-header';

/**
 * Layout rute publik.
 *
 * Membungkus seluruh halaman marketing dengan `PublicHeader` dan `PublicFooter`
 * serta `<main>` yang mengisi sisa tinggi kolom flex.
 *
 * CATATAN overflow (D-01, 2026-09-26): komentar versi sebelumnya menyatakan
 * `<main>` "menetralkan overflow horizontal dari gradient hero". Itu tidak pernah
 * benar. `<main>` hanya punya `flex-1`; tidak ada aturan `main` di
 * `globals.css`, dan `flex-1` tidak berperan dalam overflow. Yang sebenarnya
 * menahan overflow adalah dua aturan lain, dan keduanya masih dibutuhkan tanpa
 * gradient:
 * - `.public-shell { overflow-x: clip }` (globals.css) menahan seluruh situs,
 *   termasuk hard-shadow 6px dan marquee.
 * - `.public-hero { overflow: hidden }` (globals.css) menahan isi hero.
 *
 * Jadi tidak ada aturan yang perlu dihapus di sini. `flex-1` tetap wajib:
 * tanpa itu `<main>` tidak mengisi tinggi dan footer naik ke tengah halaman.
 * `overflow: hidden` di `.public-hero` kini vestigial (hero sudah satu warna
 * solid dan tidak punya anak absolut), tapi dibiarkan: menghapusnya di luar
 * scope fase warna, dan `.public-shell` sudah menahan overflow halaman.
 *
 * Server component murni; komponen klien (menu mobile, reveal) adalah leaf di
 * dalam header/hero masing-masing.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-shell flex min-h-screen flex-col bg-background">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
