'use server';
import { revalidatePath } from 'next/cache';
import { requireOwnerTenant } from '@/lib/owner-dashboard/outlet-server';
import {
  paymentSaveSchema,
  paymentTestSchema,
  type PaymentActionResult,
} from '@/lib/owner-dashboard/payment-contract';
import {
  saveOwnerPaymentConfig,
  testOwnerPaymentConnection,
} from '@/lib/owner-dashboard/payment-server';

const fail = (message: string, code = 'INVALID_INPUT'): PaymentActionResult => ({
  ok: false,
  code,
  message,
});
export async function testPaymentConnection(input: unknown): Promise<PaymentActionResult> {
  const parsed = paymentTestSchema.safeParse(input);
  if (!parsed.success) return fail('Periksa kredensial gateway.');
  const auth = await requireOwnerTenant();
  if (!auth) return fail('Sesi tidak berwenang.', 'UNAUTHORIZED');
  try {
    const result = await testOwnerPaymentConnection(parsed.data);
    return result.ok
      ? { ok: true, message: 'Koneksi gateway berhasil.' }
      : fail('Koneksi gateway gagal.', result.code);
  } catch {
    return fail('Koneksi gateway gagal.', 'SERVER_ERROR');
  }
}
export async function savePaymentConfig(input: unknown): Promise<PaymentActionResult> {
  const parsed = paymentSaveSchema.safeParse(input);
  if (!parsed.success) return fail('Periksa data konfigurasi.');
  const auth = await requireOwnerTenant();
  if (!auth) return fail('Sesi tidak berwenang.', 'UNAUTHORIZED');
  try {
    const result = await saveOwnerPaymentConfig(parsed.data);
    if (!result.ok) return fail('Konfigurasi gagal disimpan.', result.code);
    revalidatePath('/owner-dashboard/payment-settings');
    return { ok: true, message: 'Konfigurasi gateway disimpan.' };
  } catch {
    return fail('Konfigurasi gagal disimpan.', 'SERVER_ERROR');
  }
}
