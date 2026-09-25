import type { Metadata } from 'next';

import { LoginForm } from '@/components/auth/login-form';
import { safeRedirectPath } from '@/lib/auth/route-policy';
import { verifySession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { safeHomeForRole } from '@/lib/auth/route-policy';

/**
 * `/login` (PRD Task 1.2 / Bab 7 baris 649).
 *
 * Server component murni: hanya membaca cookie untuk memvalidasi `?next=` dan
 * mengalihkan sesi yang sudah sah. Logika login ada di `LoginForm` (klien) dan
 * di route API (server), sehingga halaman ini tidak pernah menyentuh
 * `firebase-admin` maupun DB.
 *
 * `noindex` + `no-store` karena halaman autentikasi tidak boleh diindeks dan
 * tidak boleh di-cache.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Masuk',
  description: 'Masuk ke dasbor SnapBox dengan kata sandi atau PIN operator.',
  robots: { index: false, follow: false },
};

interface LoginPageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const rawNext: string | undefined =
    typeof params.next === 'string' ? params.next : params.next?.[0];

  // `next` divalidasi di server: hanya path relatif same-origin yang diterima,
  // supaya `?next=https://evil.example` tidak jadi open redirect.
  const nextPath = safeRedirectPath(rawNext);

  // Sudah punya sesi sah: jangan tampilkan form lagi. Tujuan default diambil
  // dari peran; bila peran belum punya halaman (Fase 1: OWNER/STAFF), tetap di
  // sini daripada berputar ke rute yang belum ada.
  const session = await verifySession(undefined);
  if (session) {
    const home = nextPath ?? safeHomeForRole(session.role);
    if (home) redirect(home);
  }

  return (
    <div className="auth-shell">
      <section className="auth-panel" aria-labelledby="login-heading">
        <p className="auth-kicker">SnapBox / Akses Operator</p>
        <h1 id="login-heading">Masuk ke dasbor</h1>
        <p className="auth-copy">
          Gunakan akun yang diundang Owner atau CEO. Staf lapangan bisa memakai email dan PIN
          operator booth.
        </p>
        <LoginForm nextPath={nextPath} />
      </section>

      <aside className="auth-note" aria-hidden="true">
        <span>Multi-tenant photobooth</span>
        <strong>Satu dasbor, semua booth.</strong>
        <p>
          Pantau status, langganan, dan perangkat. Akses dibatasi sesuai peran dan status langganan
          tenant.
        </p>
      </aside>
    </div>
  );
}
