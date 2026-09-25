/**
 * Kontrak audit log (PRD Task 1.8, Bab 8.8).
 *
 * Modul ini SENGAJA bebas `next/*`, DB, dan SDK apa pun supaya bisa diuji
 * `node --test` langsung dan aman diimpor di mana saja. Ia hanya berisi:
 * 1. batas panjang kolom yang dipakai helper,
 * 2. ekstraksi metadata request dari header (murni fungsi),
 * 3. daftar kunci metadata yang DILARANG (secret/token/tautan),
 * 4. sanitasi metadata rekursif yang mengganti nilai terlarang.
 *
 * Aturan PRD Bab 8.8: JANGAN catat password, secret, API key, payment
 * credential, atau token. Karena `metadata` dikirim caller, sanitasi ini adalah
 * jaring pengaman terakhir, bukan izin menulis apa pun.
 */

/** Batas panjang kolom `activity_logs` yang relevan (schema.ts). */
export const AUDIT_FIELD_LIMITS = {
  actorEmail: 255,
  action: 80,
  resourceType: 60,
  resourceId: 80,
  ipAddress: 60,
  requestId: 80,
  reason: 2000,
} as const;

/** Nilai pengganti saat field sensitif atau terlalu panjang. */
export const AUDIT_REDACTED = '[redacted]';

/**
 * Nama kunci metadata yang tidak boleh disimpan nilainya.
 *
 * Perbandingan case-insensitive dan memakai `includes` supaya `apiKey`,
 * `api_key`, `PAYMENT_SECRET`, `gatewayApiKeyEncrypted`, dan `accessToken`
 * semuanya tertangkap tanpa daftar yang tak pernah lengkap.
 */
const FORBIDDEN_KEY_FRAGMENTS = [
  'password',
  'secret',
  'apikey',
  'api_key',
  'token',
  'credential',
  'privatekey',
  'private_key',
  'inviteurl',
  'invite_url',
  'firebaseuid',
  'firebase_uid',
  'authorization',
  'signature',
] as const;

/** Apakah nama kunci metadata tergolong sensitif. */
export function isForbiddenMetadataKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9_]/g, '');
  return FORBIDDEN_KEY_FRAGMENTS.some((fragment) => normalized.includes(fragment));
}

/**
 * Menyaring metadata secara rekursif.
 *
 * - kunci sensitif -> nilainya diganti `[redacted]`,
 * - string kosong -> `null` (kolom jsonb tidak butuh string kosong),
 * - `undefined` -> dibuang,
 * - maksimum kedalaman 4 supaya struktur jahat tidak memicu rekursi dalam.
 */
export function sanitizeAuditMetadata(value: unknown, depth = 0): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object') return null;
  if (Array.isArray(value)) return null;
  if (depth > 4) return null;

  const result: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (isForbiddenMetadataKey(key)) {
      result[key] = AUDIT_REDACTED;
      continue;
    }
    if (raw === undefined) continue;
    if (typeof raw === 'string' && raw.length === 0) {
      result[key] = null;
      continue;
    }
    if (raw !== null && typeof raw === 'object') {
      const nested = sanitizeAuditMetadata(raw, depth + 1);
      result[key] = nested;
      continue;
    }
    result[key] = raw;
  }

  return Object.keys(result).length === 0 ? null : result;
}

/** Header request yang dibaca, dalam bentuk minimal yang bisa dites. */
export interface AuditRequestHeaders {
  forwardedFor?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

/** Metadata request yang sudah dinormalisasi dan dibatasi panjang. */
export interface AuditRequestContext {
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly requestId: string | null;
}

/**
 * Mengambil IP klien dari `x-forwarded-for`.
 *
 * Hanya entri PERTAMA yang dipakai: proxy menambahkan entri di belakang, jadi
 * ekor daftar bisa dikendalikan klien. Nilai berlebih dibatasi panjang kolom.
 */
export function extractClientIp(forwardedFor: string | null | undefined): string | null {
  if (!forwardedFor) return null;
  const first = forwardedFor.split(',')[0]?.trim();
  if (!first) return null;
  return truncate(first, AUDIT_FIELD_LIMITS.ipAddress);
}

/** Memotong string ke batas kolom; `null` untuk input kosong. */
export function truncate(value: string | null | undefined, max: number): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max);
}

/**
 * Normalisasi header menjadi context audit.
 *
 * Semua nilai adalah metadata, BUKAN otorisasi; helper tidak pernah menolak
 * aksi hanya karena header hilang.
 */
export function normalizeRequestContext(headers: AuditRequestHeaders): AuditRequestContext {
  return {
    ipAddress: extractClientIp(headers.forwardedFor),
    userAgent: truncate(headers.userAgent, 1000),
    requestId: truncate(headers.requestId, AUDIT_FIELD_LIMITS.requestId),
  };
}
