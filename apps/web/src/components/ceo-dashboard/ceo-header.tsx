'use client';

import { Button, useSidebar } from '@snapbox/ui';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';

import { ThemeToggle } from '@/components/theme-toggle';
import { DATA_CONTOH, findNavItem, SKELETON_NOTE } from './content';

/**
 * Header dashboard CEO (PRD Task 1.3).
 *
 * Berisi:
 * - tombol menu mobile / toggle sidebar desktop,
 * - judul halaman aktif (dibaca dari registry nav, bukan dari DOM),
 * - badge "Data contoh" sebagai pengingat status skeleton,
 * - menu akun dengan aksi logout yang benar-benar memanggil
 *   `DELETE /api/auth/session`, lalu `router.refresh()` agar middleware melihat
 *   cookie yang sudah dihapus.
 *
 * Skeleton belum tersambung ke data akun nyata, karena itu email di menu akun
 * diberi label contoh, bukan alamat asli user.
 */
export function CeoHeader() {
  const pathname = usePathname();
  const { isMobile, toggleSidebar } = useSidebar();

  const active = React.useMemo(() => {
    const prefix = '/ceo-dashboard';
    const rest = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : '';
    const slug = rest.replace(/^\//, '').split('/')[0] ?? '';
    return findNavItem(slug);
  }, [pathname]);

  const title = active?.title ?? 'Dashboard';

  return (
    <header className="ceo-header">
      <div className="ceo-header-left">
        <Button
          type="button"
          variant="noShadow"
          size="icon"
          onClick={toggleSidebar}
          aria-label={isMobile ? 'Buka menu navigasi' : 'Lipat atau bentangkan sidebar'}
        >
          <span aria-hidden className="ceo-icon">
            {isMobile ? <MenuGlyph /> : <PanelGlyph />}
          </span>
        </Button>

        <div className="ceo-header-title">
          <p className="ceo-header-kicker">
            Super Admin
            <span aria-hidden> / </span>
            {active?.group === 'ringkasan'
              ? 'Ringkasan'
              : active?.group === 'operasional'
                ? 'Operasional'
                : 'Platform'}
          </p>
          <h2>{title}</h2>
        </div>
      </div>

      <div className="ceo-header-right">
        <span className="ceo-skeleton-badge" title={SKELETON_NOTE}>
          {DATA_CONTOH}
        </span>
        <ThemeToggle />
        <AccountMenu />
      </div>
    </header>
  );
}

/**
 * Menu akun minimal tanpa dependency menu eksternal: tombol membuka panel
 * `absolute` yang dapat ditutup dengan Escape atau klik di luar.
 */
function AccountMenu() {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const router = useRouter();

  React.useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  async function logout() {
    if (pending) return;
    setPending(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/session', { method: 'DELETE', cache: 'no-store' });
      if (!response.ok) throw new Error('Gagal mengakhiri sesi.');
      // `refresh` supaya server component + middleware membaca cookie terbaru.
      router.replace('/login');
      router.refresh();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="ceo-account" ref={containerRef}>
      <button
        type="button"
        className="ceo-account-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="ceo-account-avatar" aria-hidden>
          SB
        </span>
        <span className="ceo-account-name">
          Akun CEO
          <small>contoh</small>
        </span>
      </button>

      {open ? (
        <div className="ceo-menu" role="menu">
          <p className="ceo-menu-note" role="note">
            Profil akun dan pengaturan sesi pada skeleton ini masih statis.
          </p>
          <Link
            role="menuitem"
            className="ceo-menu-item"
            href="/ceo-dashboard/settings"
            onClick={() => setOpen(false)}
          >
            <GearGlyph />
            Pengaturan global
          </Link>
          <button
            type="button"
            role="menuitem"
            className="ceo-menu-item ceo-menu-item-danger"
            onClick={logout}
            disabled={pending}
          >
            <ExitGlyph />
            {pending ? 'Keluar...' : 'Keluar'}
          </button>
          {error ? (
            <p className="ceo-menu-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Glyph header digambar inline, bukan dari `lucide-react` (dependency
 * `@snapbox/ui`, bukan `apps/web`). Semua dekoratif (`aria-hidden`) dan selalu
 * disertai label teks.
 */
const GLYPH_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  className: 'size-4',
} as const;

function MenuGlyph() {
  return (
    <svg {...GLYPH_PROPS}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function PanelGlyph() {
  return (
    <svg {...GLYPH_PROPS}>
      <rect x="3" y="4" width="18" height="16" />
      <path d="M9 4v16" />
    </svg>
  );
}

function GearGlyph() {
  return (
    <svg {...GLYPH_PROPS}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M18 6l-2 2M6 18l2-2M18 18l-2-2" />
    </svg>
  );
}

function ExitGlyph() {
  return (
    <svg {...GLYPH_PROPS}>
      <path d="M15 4h4v16h-4" />
      <path d="M10 8l-4 4 4 4" />
      <path d="M6 12h9" />
    </svg>
  );
}
