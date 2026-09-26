import { and, desc, eq } from 'drizzle-orm';
import { getDatabase, templates } from '@snapbox/db';

import type { OwnerTemplate } from './template-contract';

export async function listOwnerTemplates(tenantId: string): Promise<OwnerTemplate[]> {
  const rows = await getDatabase()
    .select()
    .from(templates)
    .where(eq(templates.tenantId, tenantId))
    .orderBy(desc(templates.createdAt));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    layoutType: row.layoutType as OwnerTemplate['layoutType'],
    poseGrid: row.poseGrid ?? { rows: 1, cols: 1, padding: 12 },
    printDimensions: row.printDimensions ?? '4x6',
    aspectRatio: row.aspectRatio ?? '4:6',
    background: row.background ?? '#FFFFFF',
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function getOwnerTemplate(tenantId: string, id: string) {
  const [row] = await getDatabase()
    .select({ id: templates.id })
    .from(templates)
    .where(and(eq(templates.id, id), eq(templates.tenantId, tenantId)))
    .limit(1);
  return row ?? null;
}
