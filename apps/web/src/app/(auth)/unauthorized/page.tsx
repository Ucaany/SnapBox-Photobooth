import type { Metadata } from 'next';
import Link from 'next/link';

/**
 * `/unauthorized` — 403 (PRD Bab 7 baris 113).
 *
 * Halaman ini sengaja tidak menjelaskan SEBAB penolakan. Menampilkan "langganan
 * kedaluwarsa" versus "peran salah" akan membocorkan informasi akun/tenant ke
 * siapa pun yang menebak URL. Yang ditampilkan hanya status dan jalan keluar:
 * kembali ke login atau ke beranda publik.
 *
 * Tidak ada tombol logout di sini karena halaman ini juga bisa dicapai oleh
 * pengunjung tanpa sesi (mis. direct hit). Membersihkan cookie dilakukan di
 * halaman privat saat sesi terbukti tidak sah.
 */
export const metadata: Metadata = {
  title: 'Akses ditolak',
  description: 'Anda tidak memiliki akses ke halaman ini.',
  robots: { index: false, follow: false },
};

export default function UnauthorizedPage() {
  return (
    <div className="auth-shell">
      <section className="auth-panel" aria-labelledby="unauthorized-heading">
        <p className="auth-kicker">SnapBox / 403</p>
        <h1 id="unauthorized-heading">Akses ditolak</h1>
        <p className="auth-copy">
          Akun Anda tidak berhak membuka halaman ini, atau langganan tenant sedang tidak aktif.
          Hubungi Owner tenant bila menurut Anda ini keliru.
        </p>

        <div className="auth-form">
          <Link
            href="/login"
            className="inline-flex h-12 items-center justify-center rounded-base border-2 border-border bg-main px-8 text-sm font-heading text-main-foreground shadow-shadow transition-all hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none"
          >
            Kembali ke login
          </Link>
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-base border-2 border-border bg-secondary-background px-6 text-sm font-base transition-all hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none"
          >
            Buka halaman publik
          </Link>
        </div>
      </section>

      <aside className="auth-note" aria-hidden="true">
        <span>Kontrol akses</span>
        <strong>Peran dan langganan diperiksa tiap permintaan.</strong>
        <p>Otorisasi tidak pernah diambil dari data yang dikirim browser.</p>
      </aside>
    </div>
  );
}
