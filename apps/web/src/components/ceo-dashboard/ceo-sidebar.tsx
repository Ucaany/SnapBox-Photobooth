'use client';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from '@snapbox/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import {
  CEO_NAV_GROUPS,
  navItemsByGroup,
  type CeoNavItem,
} from '@/components/ceo-dashboard/content';
import { CeoHeader } from '@/components/ceo-dashboard/ceo-header';

/**
 * Shell dashboard CEO (PRD Task 1.3).
 *
 * Memakai primitive `Sidebar` dari `@snapbox/ui` (Base UI): desktop collapsible,
 * mobile drawer, shortcut Cmd/Ctrl+B, dan active state berbasis pathname.
 *
 * Layout mengikuti pola SidebarProvider -> Sidebar + SidebarInset. Sidebar
 * diletakkan sebagai sibling inset (bukan di dalamnya) agar `peer` styling gap
 * bawaan primitive bekerja.
 */
export function CeoDashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <CeoSidebar />
      <SidebarInset className="ceo-shell">
        <CeoHeader />
        <div className="ceo-main" id="ceo-main">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function CeoSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" className="ceo-sidebar">
      <SidebarHeader className="ceo-sidebar-header">
        <div className="ceo-brand">
          <Link
            href="/ceo-dashboard"
            className="ceo-brand-link"
            aria-label="SnapBox Super Admin, buka dashboard"
          >
            <span aria-hidden className="ceo-brand-mark" />
            <span className="ceo-brand-text">
              SnapBox
              <small>Super Admin</small>
            </span>
          </Link>
          <SidebarTrigger
            className="ceo-sidebar-trigger"
            aria-label="Lipat atau bentangkan sidebar"
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {CEO_NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.id}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItemsByGroup(group.id).map((item) => (
                  <SidebarMenuItem key={item.path}>
                    <SidebarNavButton item={item} pathname={pathname} />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="ceo-sidebar-footer">
        <p>Skeleton Fase 1. Semua angka di panel adalah data contoh, bukan telemetry produksi.</p>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

/**
 * Satu item nav. `isActive` dihitung dari pathname: root hanya aktif persis di
 * `/ceo-dashboard`, subroute aktif pada prefix-nya sendiri (bukan pada root).
 */
function SidebarNavButton({ item, pathname }: { item: CeoNavItem; pathname: string }) {
  const { isMobile, setOpenMobile } = useSidebar();

  const isActive =
    item.slug === ''
      ? pathname === '/ceo-dashboard' || pathname === '/ceo-dashboard/'
      : pathname === item.path || pathname.startsWith(`${item.path}/`);

  return (
    <SidebarMenuButton
      render={<Link href={item.path} />}
      isActive={isActive}
      tooltip={item.label}
      aria-current={isActive ? 'page' : undefined}
      onClick={() => {
        if (isMobile) setOpenMobile(false);
      }}
    >
      <NavGlyph slug={item.slug} />
      <span>{item.label}</span>
    </SidebarMenuButton>
  );
}

/**
 * Ikon nav digambar inline, bukan dari `lucide-react` (dependency `@snapbox/ui`,
 * bukan `apps/web`; lihat alasan yang sama di `theme-toggle.tsx`).
 *
 * Ikon dipilih dari bentuk yang relevan dengan modulnya, dan selalu disertai
 * label teks sehingga tidak pernah menjadi satu-satunya penanda (PRD Bab 4).
 */
function NavGlyph({ slug }: { slug: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      {GLYPHS[slug] ?? GLYPHS['']}
    </svg>
  );
}

const GLYPHS: Record<string, React.ReactNode> = {
  '': (
    <>
      <rect x="3" y="3" width="7" height="9" />
      <rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="12" width="7" height="9" />
      <rect x="3" y="16" width="7" height="5" />
    </>
  ),
  tenants: (
    <>
      <path d="M3 21h18" />
      <path d="M6 21V7l6-4 6 4v14" />
      <path d="M10 21v-5h4v5" />
    </>
  ),
  subscriptions: (
    <>
      <path d="M4 6h16v12H4z" />
      <path d="M4 10h16" />
      <path d="M8 14h4" />
    </>
  ),
  plans: (
    <>
      <path d="M12 3v18" />
      <path d="M5 8h14" />
      <path d="M7 8l-3 6h6z" />
      <path d="M17 8l-3 6h6z" />
    </>
  ),
  devices: (
    <>
      <rect x="3" y="4" width="18" height="12" />
      <path d="M8 20h8" />
      <path d="M12 16v4" />
    </>
  ),
  broadcast: (
    <>
      <path d="M3 11l14-6v14L3 13z" />
      <path d="M17 9a4 4 0 0 1 0 6" />
      <path d="M7 13v4h3" />
    </>
  ),
  promos: (
    <>
      <path d="M20 12l-8 8-8-8V4h8z" />
      <circle cx="8" cy="8" r="1.4" />
    </>
  ),
  'activity-log': (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v5l3 2" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M18 6l-2 2M6 18l2-2M18 18l-2-2" />
    </>
  ),
  'system-health': (
    <>
      <path d="M3 12h4l2-5 3 10 2-5h7" />
    </>
  ),
  security: (
    <>
      <path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
};
