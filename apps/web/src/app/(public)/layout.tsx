import { PublicFooter } from '@/components/public/public-footer';
import { PublicHeader } from '@/components/public/public-header';

/**
 * Layout rute publik.
 *
 * Membungkus seluruh halaman marketing dengan `PublicHeader` dan `PublicFooter`
 * serta `<main>` yang menetralkan overflow horizontal dari gradient hero.
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
