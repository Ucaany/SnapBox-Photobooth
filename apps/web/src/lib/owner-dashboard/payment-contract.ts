import {
  GATEWAY_MODES,
  GATEWAY_PROVIDERS,
  gatewayModeSchema,
  gatewayProviderSchema,
} from '@snapbox/shared';
import { z } from 'zod';

export const PAYMENT_PROVIDERS = GATEWAY_PROVIDERS;
export const PAYMENT_MODES = GATEWAY_MODES;
export const providerLabels: Record<(typeof PAYMENT_PROVIDERS)[number], string> = {
  MIDTRANS: 'Midtrans',
  XENDIT: 'Xendit',
  DOKU: 'DOKU',
  PAKASIR: 'Pakasir',
};

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine(
      (v) => [...v].every((char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127),
      'Karakter tidak valid.',
    );
const credential = text(500).min(1);
export const paymentConfigSchema = z.object({
  provider: gatewayProviderSchema,
  mode: gatewayModeSchema,
  merchantId: text(120)
    .optional()
    .transform((v) => v || undefined),
  apiKey: credential.optional(),
  secretKey: credential.optional(),
  isPrimary: z.boolean(),
  isActive: z.boolean(),
});
export const paymentTestSchema = paymentConfigSchema
  .pick({ provider: true, mode: true, merchantId: true, apiKey: true, secretKey: true })
  .superRefine((v, ctx) => {
    if (!v.apiKey)
      ctx.addIssue({ code: 'custom', path: ['apiKey'], message: 'API key diperlukan.' });
    if (!v.secretKey)
      ctx.addIssue({ code: 'custom', path: ['secretKey'], message: 'Secret key diperlukan.' });
    if (v.provider === 'DOKU' && !v.merchantId)
      ctx.addIssue({
        code: 'custom',
        path: ['merchantId'],
        message: 'Merchant ID diperlukan untuk DOKU.',
      });
  });
export const paymentSaveSchema = paymentConfigSchema.superRefine((v, ctx) => {
  if ((v.apiKey && !v.secretKey) || (!v.apiKey && v.secretKey))
    ctx.addIssue({
      code: 'custom',
      path: ['secretKey'],
      message: 'Isi API key dan secret key bersama-sama.',
    });
  if (v.provider === 'DOKU' && !v.merchantId)
    ctx.addIssue({
      code: 'custom',
      path: ['merchantId'],
      message: 'Merchant ID diperlukan untuk DOKU.',
    });
});

export type PaymentConfigInput = z.infer<typeof paymentSaveSchema>;
export type PaymentSaveInput = PaymentConfigInput;
export type PaymentTestInput = z.infer<typeof paymentTestSchema>;
export type PaymentConfigRecord = {
  id: string;
  provider: (typeof PAYMENT_PROVIDERS)[number];
  mode: (typeof PAYMENT_MODES)[number];
  merchantId: string | null;
  hasApiKey: boolean;
  hasSecretKey: boolean;
  isPrimary: boolean;
  isActive: boolean;
  lastTestedAt: string | null;
  lastTestSuccess: boolean | null;
};
export type PaymentSettingsData = {
  configs: PaymentConfigRecord[];
  canConfigure: boolean;
  canUseBackup: boolean;
};
export type PaymentActionResult =
  | { ok: true; message: string }
  | { ok: false; code: string; message: string; fields?: Record<string, string> };
export const maskCredential = (configured: boolean) => (configured ? '••••••••' : '');
