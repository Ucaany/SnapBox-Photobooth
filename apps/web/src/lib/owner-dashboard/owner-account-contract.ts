import { z } from 'zod';

export const notificationIdSchema = z.string().uuid();
export const ownerProfileSchema = z.object({
  fullName: z.string().trim().min(1, 'Nama wajib diisi.').max(150),
  phone: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z
      .string()
      .trim()
      .max(20)
      .regex(/^\+?[0-9() .-]*$/)
      .nullable(),
  ),
});
export const supportInputSchema = z.object({
  category: z.enum(['ACCOUNT', 'BILLING', 'DEVICE', 'OTHER']),
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(4000),
});

export type OwnerProfileInput = z.infer<typeof ownerProfileSchema>;
export type SupportInput = z.infer<typeof supportInputSchema>;
