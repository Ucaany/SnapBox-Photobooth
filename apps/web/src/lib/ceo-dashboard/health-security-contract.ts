/**
 * Kontrak telemetry kesehatan sistem + keamanan (PRD Task 1.11).
 *
 * Modul ini SENGAJA bebas `next/*`, DB, dan SDK apa pun supaya bisa diuji
 * `node --test` langsung dan aman diimpor server maupun klien. Ia hanya berisi
 * bentuk data, validasi, dan fungsi murni (hashing/ringkasan/redaksi).
 *
 * Aturan privasi (PRD Bab 8.9): DILARANG menyimpan atau menampilkan password,
 * token, signature mentah, payload request, atau IP mentah. Helper di bawah
 * adalah jaring pengaman sebelum nilai mencapai DB atau UI.
 */
import { z } from 'zod';

export const securityEventTypeSchema = z.enum(['LOGIN_FAILED', 'RATE_LIMIT_HIT', 'WAF_EVENT']);
export const securitySeveritySchema = z.enum(['INFO', 'WARNING', 'CRITICAL']);
export const healthStatusSchema = z.enum(['healthy', 'degraded', 'outage', 'unavailable']);

export type SecurityEventType = z.infer<typeof securityEventTypeSchema>;
export type SecuritySeverity = z.infer<typeof securitySeveritySchema>;
export type HealthStatus = z.infer<typeof healthStatusSchema>;

export const SECURITY_EVENT_LABELS: Record<SecurityEventType, string> = {
  LOGIN_FAILED: 'Login gagal',
  RATE_LIMIT_HIT: 'Rate limit',
  WAF_EVENT: 'Event WAF',
};

export const SECURITY_SEVERITY_LABELS: Record<SecuritySeverity, string> = {
  INFO: 'Info',
  WARNING: 'Perhatian',
  CRITICAL: 'Kritis',
};

export const HEALTH_STATUS_LABELS: Record<HealthStatus, string> = {
  healthy: 'Normal',
  degraded: 'Perhatian',
  outage: 'Gangguan',
  unavailable: 'Belum tersedia',
};

/** Komponen health yang dipantau; `checkKey` unik per baris. */
export const HEALTH_COMPONENTS = [
  'database',
  'identity',
  'edge',
  'gateway',
  'queue',
  'cron',
  'observability',
] as const;
export const healthComponentSchema = z.enum(HEALTH_COMPONENTS);
export type HealthComponent = (typeof HEALTH_COMPONENTS)[number];

export const HEALTH_COMPONENT_LABELS: Record<HealthComponent, string> = {
  database: 'Basis data',
  identity: 'Identitas',
  edge: 'Edge dan WAF',
  gateway: 'Gateway pembayaran',
  queue: 'Antrean webhook',
  cron: 'Pekerjaan terjadwal',
  observability: 'Observabilitas',
};

/** Batas panjang kolom; satu sumber supaya redaksi dan skema tidak drift. */
export const TELEMETRY_FIELD_LIMITS = {
  route: 160,
  source: 80,
  detail: 500,
  requestId: 80,
  providerEventId: 200,
  userAgent: 200,
  ipHash: 128,
  checkKey: 60,
} as const;

const boundedText = (max: number) => z.string().trim().min(1).max(max);

export interface SecurityEventRow {
  readonly id: string;
  readonly eventType: SecurityEventType;
  readonly eventTypeLabel: string;
  readonly severity: SecuritySeverity;
  readonly severityLabel: string;
  readonly source: string;
  readonly route: string | null;
  /** Fingerprint subjek (hash); `null` bila tidak ada. Tidak pernah nilai mentah. */
  readonly subjectFingerprint: string | null;
  readonly detail: Record<string, unknown>;
  readonly requestId: string | null;
  readonly createdAt: string;
}

export interface HealthRow {
  readonly checkKey: string;
  readonly component: HealthComponent;
  readonly componentLabel: string;
  readonly status: HealthStatus;
  readonly statusLabel: string;
  readonly latencyMs: number | null;
  readonly observedAt: string | null;
  readonly lastSuccessAt: string | null;
  readonly detail: Record<string, unknown>;
}

export interface AuthSessionRow {
  readonly id: string;
  readonly role: string;
  readonly ipHashPrefix: string | null;
  readonly userAgent: string | null;
  readonly createdAt: string;
  readonly lastSeenAt: string;
  readonly expiresAt: string;
  readonly statusLabel: 'Aktif' | 'Kedaluwarsa' | 'Dicabut';
}

export interface WebhookQueueSummary {
  readonly pending: number;
  readonly failedUnresolved: number;
  readonly oldestPendingAt: string | null;
  readonly lastProcessedAt: string | null;
}

export interface SystemHealthSnapshot {
  readonly rows: readonly HealthRow[];
  readonly queue: WebhookQueueSummary;
  readonly overallStatus: HealthStatus;
  readonly unavailable: readonly string[];
  readonly generatedAt: string;
}

export interface SecuritySnapshot {
  readonly summary: {
    readonly windowHours: number;
    readonly loginFailed: number;
    readonly rateLimitHit: number;
    readonly wafEvent: number;
    readonly activeSessions: number;
  };
  readonly events: readonly SecurityEventRow[];
  readonly sessions: readonly AuthSessionRow[];
  readonly unavailable: readonly string[];
  readonly generatedAt: string;
}

/** Input heartbeat job cron / adapter health. Idempotent per `checkKey`. */
export const healthHeartbeatSchema = z
  .object({
    checkKey: boundedText(TELEMETRY_FIELD_LIMITS.checkKey),
    component: healthComponentSchema,
    status: healthStatusSchema,
    latencyMs: z.number().int().min(0).max(600_000).nullable().optional(),
    detail: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .strict();
export type HealthHeartbeatInput = z.infer<typeof healthHeartbeatSchema>;

/** Jendela waktu yang didukung filter dashboard. */
export const SECURITY_WINDOW_HOURS = [1, 24, 168, 720] as const;
export type SecurityWindowHours = (typeof SECURITY_WINDOW_HOURS)[number];

/** Event WAF dari Cloudflare (atau proxy terverifikasi). */
export const wafEventSchema = z
  .object({
    providerEventId: boundedText(TELEMETRY_FIELD_LIMITS.providerEventId),
    route: boundedText(TELEMETRY_FIELD_LIMITS.route),
    action: z.string().trim().max(40).optional(),
    ruleId: z.string().trim().max(80).optional(),
    severity: securitySeveritySchema.optional(),
    clientIp: z.string().trim().max(64).optional(),
    userAgent: z.string().trim().max(1000).optional(),
  })
  .strict();
export type WafEventInput = z.infer<typeof wafEventSchema>;

/**
 * Membuang kunci sensitif dari objek detail.
 *
 * Jaring pengaman terakhir sebelum nilai mencapai DB/UI. Nilai non-skalar
 * (objek/array) dibuang agar struktur jahat tidak lolos.
 */
export function safeDetail(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      ([key, item]) =>
        !/(token|secret|password|signature|payload|ip|email|authorization|credential)/i.test(key) &&
        (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean'),
    ),
  );
}

/**
 * Hash subjek/sumber satu arah (SHA-256).
 *
 * Dipakai untuk IP klien dan email: nilai mentah tidak pernah disimpan atau
 * dikirim ke UI. Salt berasal dari env server.
 */
export async function hashSubject(value: string, salt: string | undefined): Promise<string> {
  const data = new TextEncoder().encode(`${salt ?? ''}|${value.trim().toLowerCase()}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** Potong ke batas kolom; `null` untuk input kosong. */
export function limitText(value: string | null | undefined, max: number): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max);
}

/** User-agent diringkas agar tidak membocorkan detail panjang. */
export function summarizeUserAgent(userAgent: string | null | undefined): string | null {
  const limited = limitText(userAgent, TELEMETRY_FIELD_LIMITS.userAgent);
  if (!limited) return null;
  return limited.replace(/\s+/g, ' ');
}

/**
 * Status keseluruhan dari daftar check.
 *
 * Prioritas: outage > degraded > unavailable > healthy. Daftar kosong berarti
 * `unavailable`, bukan `healthy`: dashboard kosong tidak boleh tampak sehat.
 */
export function aggregateHealthStatus(rows: readonly HealthRow[]): HealthStatus {
  if (rows.length === 0) return 'unavailable';
  if (rows.some((row) => row.status === 'outage')) return 'outage';
  if (rows.some((row) => row.status === 'degraded')) return 'degraded';
  if (rows.some((row) => row.status === 'unavailable')) return 'unavailable';
  return 'healthy';
}

/** Ringkasan sesi: `Aktif` bila belum dicabut dan belum kedaluwarsa. */
export function classifyAuthSession(
  revokedAt: Date | null,
  expiresAt: Date,
  nowMs: number = Date.now(),
): 'Aktif' | 'Kedaluwarsa' | 'Dicabut' {
  if (revokedAt) return 'Dicabut';
  if (expiresAt.getTime() <= nowMs) return 'Kedaluwarsa';
  return 'Aktif';
}
