/**
 * Standar error API SnapBox (PRD Bab 10.13).
 *
 * Semua route handler dan Server Action mengembalikan bentuk yang sama supaya
 * klien (web, kiosk, bridge desktop) punya satu jalur penanganan error.
 *
 * Catatan keamanan: `developerMessage` boleh memuat detail teknis, tetapi
 * `message` adalah teks yang aman ditampilkan ke pengguna dan DILARANG memuat
 * secret, kredensial, atau isi payload webhook.
 */
import { z } from 'zod';

/** Kode error yang dipakai lintas modul. Tambahkan di sini, bukan inline. */
export const API_ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'UNPROCESSABLE',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'SERVICE_UNAVAILABLE',
  'TENANT_MISMATCH',
  'PAIRING_INVALID',
  'PAIRING_EXPIRED',
  'PAIRING_ALREADY_USED',
  'DEVICE_ALREADY_PAIRED',
  'DEVICE_REVOKED',
  'DEVICE_NOT_PAIRED',
  'SUBSCRIPTION_EXPIRED',
  'SUBSCRIPTION_GRACE_PERIOD',
  'ENTITLEMENT_EXCEEDED',
  'VOUCHER_INVALID',
  'VOUCHER_EXPIRED',
  'VOUCHER_QUOTA_EXHAUSTED',
  'VOUCHER_MIN_PURCHASE',
  'PAYMENT_NOT_PAID',
  'PAYMENT_DUPLICATE',
  'WEBHOOK_SIGNATURE_INVALID',
  'DOWNLOAD_TOKEN_INVALID',
  'DOWNLOAD_TOKEN_EXPIRED',
  'DOWNLOAD_TOKEN_USED',
  'UPLOAD_INVALID_TYPE',
  'UPLOAD_TOO_LARGE',
  'UPLOAD_DIMENSION_TOO_SMALL',
  'CONTRAST_TOO_LOW',
  'QUOTA_EXCEEDED',
] as const;

export const apiErrorCodeSchema = z.enum(API_ERROR_CODES);
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

/** Pemetaan kode error ke HTTP status (PRD Bab 10.13). */
export const API_ERROR_STATUS: Readonly<Record<ApiErrorCode, number>> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  TENANT_MISMATCH: 404, // 404, bukan 403: mencegah IDOR information disclosure (PRD Bab 5.5).
  PAIRING_INVALID: 401,
  PAIRING_EXPIRED: 401,
  PAIRING_ALREADY_USED: 401,
  DEVICE_ALREADY_PAIRED: 409,
  DEVICE_REVOKED: 401,
  DEVICE_NOT_PAIRED: 409,
  SUBSCRIPTION_EXPIRED: 402,
  SUBSCRIPTION_GRACE_PERIOD: 402,
  ENTITLEMENT_EXCEEDED: 403,
  VOUCHER_INVALID: 422,
  VOUCHER_EXPIRED: 422,
  VOUCHER_QUOTA_EXHAUSTED: 422,
  VOUCHER_MIN_PURCHASE: 422,
  PAYMENT_NOT_PAID: 409,
  PAYMENT_DUPLICATE: 409,
  WEBHOOK_SIGNATURE_INVALID: 401,
  DOWNLOAD_TOKEN_INVALID: 404,
  DOWNLOAD_TOKEN_EXPIRED: 410,
  DOWNLOAD_TOKEN_USED: 410,
  UPLOAD_INVALID_TYPE: 415,
  UPLOAD_TOO_LARGE: 413,
  UPLOAD_DIMENSION_TOO_SMALL: 422,
  CONTRAST_TOO_LOW: 422,
  QUOTA_EXCEEDED: 403,
};

/** Bentuk amplop error yang dikirim ke klien. */
export const apiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string().min(1),
    requestId: z.string().min(1),
    developerMessage: z.string().optional(),
    retryable: z.boolean(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

/** Bentuk amplop sukses. */
export const apiSuccessSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    requestId: z.string().min(1),
  });

/**
 * Error terstruktur yang dilempar dari service layer dan diterjemahkan
 * oleh route handler menjadi respons HTTP.
 */
export class ApiErrorException extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly developerMessage: string | undefined;

  constructor(
    code: ApiErrorCode,
    message: string,
    options: { developerMessage?: string; retryable?: boolean } = {},
  ) {
    super(message);
    this.name = 'ApiErrorException';
    this.code = code;
    this.status = API_ERROR_STATUS[code];
    this.retryable = options.retryable ?? false;
    this.developerMessage = options.developerMessage;
  }

  /** Membentuk amplop error siap kirim. `requestId` selalu disuplai pemanggil. */
  toApiError(requestId: string): ApiError {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        requestId,
        ...(this.developerMessage ? { developerMessage: this.developerMessage } : {}),
        retryable: this.retryable,
      },
    };
  }
}

/**
 * Error cross-tenant. Selalu dipetakan ke 404 agar keberadaan resource milik
 * tenant lain tidak terungkap (PRD Bab 5.5).
 */
export class TenantMismatchError extends ApiErrorException {
  constructor(options: { developerMessage?: string } = {}) {
    super('TENANT_MISMATCH', 'Data tidak ditemukan.', options);
    this.name = 'TenantMismatchError';
  }
}
