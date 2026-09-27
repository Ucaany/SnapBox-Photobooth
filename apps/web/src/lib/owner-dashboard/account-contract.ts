import { z } from 'zod';

export const ownerProfileSchema = z
  .object({
    fullName: z.string().trim().min(2).max(150),
    phone: z.string().trim().max(20),
  })
  .strict();

export const supportMessageSchema = z
  .object({
    category: z.enum(['account', 'billing', 'technical', 'other']),
    subject: z.string().trim().min(3).max(150),
    message: z.string().trim().min(10).max(5000),
  })
  .strict();

export type OwnerProfile = { fullName: string; phone: string | null };
