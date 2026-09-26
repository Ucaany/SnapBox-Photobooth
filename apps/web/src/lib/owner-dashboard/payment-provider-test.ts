import type { PaymentTestInput } from './payment-contract';

export type PaymentTestResult =
  | { ok: true; message: string }
  | {
      ok: false;
      code:
        'TIMEOUT' | 'UNAUTHORIZED' | 'RATE_LIMITED' | 'PROVIDER_UNAVAILABLE' | 'INVALID_RESPONSE';
      message: string;
    };
const endpoints: Record<PaymentTestInput['provider'], Record<PaymentTestInput['mode'], string>> = {
  MIDTRANS: {
    SANDBOX: 'https://api.sandbox.midtrans.com/v2/payment',
    PRODUCTION: 'https://api.midtrans.com/v2/payment',
  },
  XENDIT: { SANDBOX: 'https://api.xendit.co/balance', PRODUCTION: 'https://api.xendit.co/balance' },
  DOKU: {
    SANDBOX: 'https://api-sandbox.doku.com/checkout/v1/payment',
    PRODUCTION: 'https://api.doku.com/checkout/v1/payment',
  },
  PAKASIR: {
    SANDBOX: 'https://app.pakasir.com/api/transactiondetail',
    PRODUCTION: 'https://app.pakasir.com/api/transactiondetail',
  },
};
export async function testPaymentConnection(input: PaymentTestInput): Promise<PaymentTestResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const auth =
      input.provider === 'MIDTRANS'
        ? `Basic ${Buffer.from(`${input.apiKey}:${input.secretKey}`).toString('base64')}`
        : `Bearer ${input.apiKey}`;
    const response = await fetch(endpoints[input.provider][input.mode], {
      method: 'GET',
      redirect: 'error',
      signal: controller.signal,
      headers: { authorization: auth, accept: 'application/json' },
    });
    if (response.status === 401 || response.status === 403)
      return { ok: false, code: 'UNAUTHORIZED', message: 'Kredensial ditolak.' };
    if (response.status === 429)
      return { ok: false, code: 'RATE_LIMITED', message: 'Terlalu banyak permintaan.' };
    if (!response.ok)
      return {
        ok: false,
        code: response.status >= 500 ? 'PROVIDER_UNAVAILABLE' : 'INVALID_RESPONSE',
        message: 'Provider menolak koneksi.',
      };
    return { ok: true, message: 'Koneksi berhasil.' };
  } catch (error) {
    return {
      ok: false,
      code:
        error instanceof Error && error.name === 'AbortError' ? 'TIMEOUT' : 'PROVIDER_UNAVAILABLE',
      message: 'Provider tidak dapat dihubungi.',
    };
  } finally {
    clearTimeout(timeout);
  }
}
export const testPaymentProvider = testPaymentConnection;
