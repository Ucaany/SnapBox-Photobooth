import { and, asc, eq } from 'drizzle-orm';
import { booths, getDatabase, packages } from '@snapbox/db';
import type { OwnerPackage, PackageBooth } from './package-contract';

export async function listOwnerPackages(tenantId: string): Promise<{
  packages: OwnerPackage[];
  booths: PackageBooth[];
}> {
  const db = getDatabase();
  const [rows, boothRows] = await Promise.all([
    db
      .select({
        id: packages.id,
        name: packages.name,
        price: packages.price,
        poseCount: packages.poseCount,
        printCount: packages.printCount,
        retakeLimit: packages.retakeLimit,
        includeGif: packages.includeGif,
        printSize: packages.printSize,
        boothId: packages.boothId,
        boothName: booths.name,
        isActive: packages.isActive,
        sortOrder: packages.sortOrder,
        createdAt: packages.createdAt,
      })
      .from(packages)
      .leftJoin(booths, and(eq(booths.id, packages.boothId), eq(booths.tenantId, tenantId)))
      .where(eq(packages.tenantId, tenantId))
      .orderBy(asc(packages.sortOrder), asc(packages.name)),
    db
      .select({ id: booths.id, name: booths.name })
      .from(booths)
      .where(eq(booths.tenantId, tenantId))
      .orderBy(asc(booths.name)),
  ]);
  return {
    packages: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
    booths: boothRows,
  };
}
