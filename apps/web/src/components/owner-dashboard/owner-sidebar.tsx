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

import { OWNER_NAV_GROUPS, ownerNavItemsByGroup, type OwnerNavItem } from './content';
import { OwnerHeader, type OwnerHeaderData } from './owner-header';

export function OwnerDashboardShell({
  children,
  data,
}: {
  children: React.ReactNode;
  data: OwnerHeaderData;
}) {
  return (
    <SidebarProvider>
      <OwnerSidebar />
      <SidebarInset className="owner-shell">
        <OwnerHeader data={data} />
        <main className="owner-main" id="owner-main">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function OwnerSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" className="owner-sidebar">
      <SidebarHeader className="owner-sidebar-header">
        <div className="owner-brand">
          <Link
            href="/owner-dashboard"
            className="owner-brand-link"
            aria-label="SnapBox, buka dashboard Owner"
          >
            <span aria-hidden className="owner-brand-mark" />
            <span className="owner-brand-text">
              SnapBox<small>Owner</small>
            </span>
          </Link>
          <SidebarTrigger
            className="owner-sidebar-trigger"
            aria-label="Lipat atau bentangkan sidebar"
          />
        </div>
      </SidebarHeader>
      <SidebarContent>
        {OWNER_NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.id}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {ownerNavItemsByGroup(group.id).map((item) => (
                  <SidebarMenuItem key={item.path}>
                    <OwnerNavButton item={item} pathname={pathname} />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="owner-sidebar-footer">
        Kelola operasional photobooth Anda.
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function OwnerNavButton({ item, pathname }: { item: OwnerNavItem; pathname: string }) {
  const { isMobile, setOpenMobile } = useSidebar();
  const isActive =
    item.slug === ''
      ? pathname === '/owner-dashboard' || pathname === '/owner-dashboard/'
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
      <path d={GLYPHS[slug] ?? GLYPHS['']} />
    </svg>
  );
}

const GLYPHS: Record<string, string> = {
  '': 'M4 4h6v7H4zM14 4h6v4h-6zM14 12h6v8h-6zM4 15h6v5H4z',
  outlets: 'M3 21h18M5 21V8l7-4 7 4v13M9 21v-5h6v5',
  machines: 'M4 5h16v11H4zM8 20h8M12 16v4',
  devices: 'M8 3h8v18H8zM11 18h2',
  'frame-studio': 'M4 4h16v16H4zM8 8h8v8H8z',
  templates: 'M6 3h9l3 3v15H6zM9 11h6M9 15h6',
  packages: 'M4 7l8-4 8 4-8 4zM4 7v10l8 4 8-4V7',
  'kiosk-theme': 'M4 4h16v16H4zM8 8h8M8 12h5',
  promos: 'M20 12l-8 8-8-8V4h8zM8 8h.01',
  'payment-settings': 'M3 6h18v12H3zM3 10h18M7 15h4',
  staff: 'M16 21v-2a4 4 0 0 0-8 0v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  customers: 'M3 21v-2a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  transactions: 'M4 6h16v12H4zM8 10h8M8 14h4',
  finance: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  analytics: 'M4 19V9M10 19V5M16 19v-9M22 19V3',
  reports: 'M6 3h9l3 3v15H6zM9 11h6M9 15h4',
  subscription: 'M12 3v18M5 8h14M7 8l-3 6h6M17 8l-3 6h6',
  notifications: 'M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
  settings:
    'M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
};
