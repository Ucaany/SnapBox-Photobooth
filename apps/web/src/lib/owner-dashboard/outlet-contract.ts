import { z } from 'zod';

const optionalText = (max: number) =>
  z.preprocess((value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }, z.string().max(max).nullable().optional());

export const outletIdSchema = z.string().uuid();
export const outletInputSchema = z.object({
  name: z.string().trim().min(1, 'Nama outlet wajib diisi.').max(150),
  address: optionalText(500),
  latitude: z.preprocess(
    (v) => (v === '' ? null : v),
    z
      .string()
      .regex(/^-?\d{1,3}(?:\.\d{1,7})?$/)
      .refine((v) => Number(v) >= -90 && Number(v) <= 90, 'Latitude harus antara -90 dan 90.')
      .nullable()
      .optional(),
  ),
  longitude: z.preprocess(
    (v) => (v === '' ? null : v),
    z
      .string()
      .regex(/^-?\d{1,3}(?:\.\d{1,7})?$/)
      .refine((v) => Number(v) >= -180 && Number(v) <= 180, 'Longitude harus antara -180 dan 180.')
      .nullable()
      .optional(),
  ),
  picName: optionalText(150),
  picPhone: optionalText(20),
  isActive: z.boolean().optional().default(true),
});
export const outletUpdateSchema = outletInputSchema.extend({ id: outletIdSchema });
export type OutletInput = z.infer<typeof outletInputSchema>;

export const outletActionResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), outletId: outletIdSchema, message: z.string() }),
  z.object({
    ok: z.literal(false),
    code: z.enum(['INVALID_INPUT', 'UNAUTHORIZED', 'NOT_FOUND', 'LIMIT_REACHED', 'SERVER_ERROR']),
    message: z.string(),
    fieldErrors: z.record(z.string(), z.string()).optional(),
  }),
]);
export type OutletActionResult = z.infer<typeof outletActionResultSchema>;

export type OutletListRow = {
  id: string;
  name: string;
  address: string | null;
  picName: string | null;
  picPhone: string | null;
  latitude: string | null;
  longitude: string | null;
  isActive: boolean;
  boothCount: number;
};
export type OutletDetail = OutletListRow & {
  createdAt: string;
  booths: { id: string; name: string; status: string; locationTag: string | null }[];
  sales: { transactionCount: number; total: string };
};

export function fieldErrors(error: z.ZodError): Record<string, string> {
  return Object.fromEntries(
    error.issues.map((issue) => [issue.path.join('.') || 'form', issue.message]),
  );
}
