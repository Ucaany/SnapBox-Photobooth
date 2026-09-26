'use client';

import { Button, useSidebar } from '@snapbox/ui';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';

import { findOwnerNavItem } from './content';

export interface OwnerHeaderData {
  readonly ownerName: string;
  readonly planName: string | null;
  readonly deviceUsage: number;
  readonly deviceQuota: number | null;
}

export function OwnerHeader({ data }: { data: OwnerHeaderData }) {
  const pathname = usePathname();
  const { isMobile, toggleSidebar } = useSidebar();
  const active = React.useMemo(
    () =>
      findOwnerNavItem(
        pathname.replace('/owner-dashboard', '').replace(/^\//, '').split('/')[0] ?? '',
      ),
    [pathname],
  );
  const quota = formatDeviceQuota(data.deviceUsage, data.deviceQuota);

  return (
    <header className="owner-header">
      <div className="owner-header-left">
        <Button
          type="button"
          variant="noShadow"
          size="icon"
          onClick={toggleSidebar}
          aria-label={isMobile ? 'Buka menu navigasi' : 'Lipat atau bentangkan sidebar'}
        >
          <MenuGlyph />
        </Button>
        <div className="owner-header-title">
          <p>Owner / {active?.group ?? 'utama'}</p>
          <h2>{active?.title ?? 'Dashboard'}</h2>
        </div>
      </div>
      <div className="owner-header-right">
        <span className="owner-plan-badge">{data.planName ?? 'Plan belum tersedia'}</span>
        <span className="owner-quota" title="Kuota perangkat aktif">
          <strong>Perangkat</strong>
          <span>{quota}</span>
        </span>
        <Link
          className="owner-notification"
          href="/owner-dashboard/notifications"
          aria-label="Buka notifikasi"
        >
          <BellGlyph />
        </Link>
        <AccountMenu ownerName={data.ownerName} />
      </div>
    </header>
  );
}

export function formatDeviceQuota(usage: number, quota: number | null): string {
  if (quota === -1) return `${usage} / Tak terbatas`;
  if (quota === null) return 'Tidak tersedia';
  return `${usage} / ${quota}`;
}

function AccountMenu({ ownerName }: { ownerName: string }) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);
  const router = useRouter();
  const initials =
    ownerName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((name) => name[0])
      .join('')
      .toUpperCase() || 'SB';

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
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
      router.replace('/login');
      router.refresh();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="owner-account" ref={ref}>
      <button
        type="button"
        className="owner-account-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="owner-account-avatar" aria-hidden>
          {initials}
        </span>
        <span className="owner-account-name">
          {ownerName}
          <small>Owner</small>
        </span>
      </button>
      {open ? (
        <div className="owner-menu" role="menu">
          <Link
            role="menuitem"
            className="owner-menu-item"
            href="/owner-dashboard/settings"
            onClick={() => setOpen(false)}
          >
            Pengaturan
          </Link>
          <button
            type="button"
            role="menuitem"
            className="owner-menu-item owner-menu-item-danger"
            onClick={logout}
            disabled={pending}
          >
            {pending ? 'Keluar...' : 'Keluar'}
          </button>
          {error ? (
            <p className="owner-menu-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const props = {
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
    <svg {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}
function BellGlyph() {
  return (
    <svg {...props}>
      <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
    </svg>
  );
}
