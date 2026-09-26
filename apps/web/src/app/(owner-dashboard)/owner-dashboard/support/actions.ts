'use server';

import { requireOwnerTenant } from '@/lib/owner-dashboard/outlet-server';
import { supportMessageSchema } from '@/lib/owner-dashboard/account-contract';
import { sendOwnerSupportEmail } from '@/lib/email/resend';

export async function submitOwnerSupport(
  input: unknown,
): Promise<{ ok: boolean; message: string }> {
  const parsed = supportMessageSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: 'Periksa kategori, subjek, dan panjang pesan.' };
  const auth = await requireOwnerTenant();
  if (!auth) return { ok: false, message: 'Sesi tidak berwenang.' };
  const result = await sendOwnerSupportEmail({ ...parsed.data, email: auth.session.email });
  return result.ok ? { ok: true, message: 'Email dukungan terkirim.' } : result;
}
