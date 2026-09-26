import { z } from 'zod';

export const packageIdSchema = z.string().uuid();
const countSchema = z.number().int().min(1).max(1000);
const packageFields = {
  name: z.string().trim().min(1).max(100),
  price: z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/),
  poseCount: countSchema,
  printCount: countSchema,
  retakeLimit: z.number().int().min(-1).max(1000),
  includeGif: z.boolean(),
  printSize: z.enum(['2x6', '4x6']),
  boothId: z.union([z.string().uuid(), z.literal('')]).transform((id) => id || null),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(-10000).max(10000),
};
export const packageInputSchema = z.object(packageFields);
export const packageUpdateSchema = packageInputSchema.extend({ id: packageIdSchema });

export type PackageInput = z.infer<typeof packageInputSchema>;
export type OwnerPackage = Omit<PackageInput, 'boothId' | 'printSize'> & {
  id: string;
  boothId: string | null;
  boothName: string | null;
  createdAt: string;
  printSize: string;
};
export type PackageBooth = { id: string; name: string };
export type PackageActionResult =
  | { ok: true; packageId: string; message: string }
  | {
      ok: false;
      code: 'INVALID_INPUT' | 'UNAUTHORIZED' | 'NOT_FOUND' | 'CONFLICT' | 'SERVER_ERROR';
      message: string;
    };

export const packageActionFail = (
  code: Extract<PackageActionResult, { ok: false }>['code'],
  message: string,
): PackageActionResult => ({ ok: false, code, message });
