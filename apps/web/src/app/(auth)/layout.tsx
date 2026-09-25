/**
 * Layout rute autentikasi.
 *
 * Halaman `/login` dan `/unauthorized` butuh cookie, jadi keduanya dinamis.
 * Layout ini sendiri sengaja tipis: hanya pembungkus, tanpa header/footer
 * marketing dan tanpa query DB.
 */
import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-background">{children}</main>;
}
