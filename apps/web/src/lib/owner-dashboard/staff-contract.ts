import { z } from 'zod';

export const staffIdSchema = z.string().uuid();
export const staffNameSchema = z.string().trim().min(2, 'Nama minimal 2 karakter.').max(150);
export const staffEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Masukkan alamat email yang valid.')
  .max(255);

export const staffCreateSchema = z
  .object({
    fullName: staffNameSchema,
    email: staffEmailSchema,
  })
  .strict();
export const staffUpdateSchema = z
  .object({
    id: staffIdSchema,
    fullName: staffNameSchema,
  })
  .strict();
export const staffStatusSchema = z.object({ id: staffIdSchema, isActive: z.boolean() }).strict();

export type StaffListRow = {
  id: string;
  email: string;
  fullName: string;
  disabled: boolean;
  createdAt: string;
};

export type StaffQuota = { used: number; limit: number | null; available: number | null };

export type StaffActionResult =
  | { ok: true; message: string; staffId?: string; emailDelivered?: boolean }
  | {
      ok: false;
      code:
        | 'INVALID_INPUT'
        | 'UNAUTHORIZED'
        | 'NOT_FOUND'
        | 'LIMIT_REACHED'
        | 'DUPLICATE_EMAIL'
        | 'INVITE_FAILED'
        | 'SERVER_ERROR';
      message: string;
      fieldErrors?: Record<string, string>;
    };

export function fieldErrors(error: z.ZodError): Record<string, string> {
  return Object.fromEntries(
    error.issues.map((issue) => [issue.path.join('.') || 'form', issue.message]),
  );
}
