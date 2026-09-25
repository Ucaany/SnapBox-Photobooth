'use client';

import * as React from 'react';

import { CeoDashboardShell } from '@/components/ceo-dashboard/ceo-sidebar';

/**
 * Batas klien shell dashboard CEO.
 *
 * Layout route tetap server component (metadata, otorisasi server) dan hanya
 * merender komponen ini. Seluruh subtree halaman (server-rendered) masuk lewat
 * `children`, sehingga tidak ada data server yang bocor ke bundel klien.
 */
export function CeoDashboardClientShell({ children }: { children: React.ReactNode }) {
  return <CeoDashboardShell>{children}</CeoDashboardShell>;
}
