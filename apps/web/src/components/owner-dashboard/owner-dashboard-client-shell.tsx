'use client';

import * as React from 'react';

import { OwnerDashboardShell } from './owner-sidebar';
import type { OwnerHeaderData } from './owner-header';

export function OwnerDashboardClientShell({
  children,
  data,
}: {
  children: React.ReactNode;
  data: OwnerHeaderData;
}) {
  return <OwnerDashboardShell data={data}>{children}</OwnerDashboardShell>;
}
