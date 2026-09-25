/**
 * Service server telemetry kesehatan + keamanan (PRD Task 1.11).
 *
 * Semua akses DB dan keputusan otorisasi untuk kedua route CEO ada di sini.
 * Modul ini HANYA server: ia menarik `@snapbox/db` dan `next/headers` (lewat
 * `requireCeo`).
 *
 * Aturan yang mengikat:
 * - `requireCeo()` diulang ke DB sebelum setiap baca (ADR-004).
 * - Jalur tulis telemetry bersifat BEST-EFFORT dan tidak pernah menggagalkan
 *   login atau mengubah respons otorisasi.
 * - Nilai mentah sensitif (IP, email utuh) tidak pernah disimpan; hanya hash
 *   satu arah atau fingerprint.
 */
import { and, count, desc, eq, gte, isNull, sql } from 'drizzle-orm';

import {
  getDatabase,
  authSessions,
  securityEvents,
  systemHealthChecks,
  webhookEvents,
  webhookFailures,
} from '@snapbox/db';

import {
  HEALTH_COMPONENT_LABELS,
  HEALTH_STATUS_LABELS,
  SECURITY_EVENT_LABELS,
  SECURITY_SEVERITY_LABELS,
  TELEMETRY_FIELD_LIMITS,
  aggregateHealthStatus,
  classifyAuthSession,
  hashSubject,
  limitText,
  safeDetail,
  summarizeUserAgent,
  type AuthSessionRow,
  type HealthComponent,
  type HealthHeartbeatInput,
  type HealthRow,
  type HealthStatus,
  type SecurityEventRow,
  type SecurityEventType,
  type SecuritySeverity,
  type SecuritySnapshot,
  type SystemHealthSnapshot,
  type WafEventInput,
  type WebhookQueueSummary,
} from './health-security-contract';
import { requireCeo } from './tenant-server';

/**
 * Salt hash subjek. SECRET server-only; tidak pernah dikirim ke UI.
 *
 * Bila belum diset, hash tetap dihitung tanpa salt: nilai mentah tidak pernah
 * disimpan, dan kekurangan salt hanya melemahkan resistensi rainbow table.
 */
function telemetrySalt(): string | undefined {
  return process.env.TELEMETRY_HASH_SALT;
}

/**
 * Membulatkan lalu menjepit angka ke rentang, dengan fallback eksplisit.
 *
 * Berbeda dari `value || fallback`, nilai `0` yang sah TIDAK jatuh ke default;
 * ia dijepit ke batas bawah.
 */
function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.trunc(value), min), max);
}

// ============================================================================
// Tulis telemetry (best-effort)
// ============================================================================

export interface RecordSecurityEventInput {
  readonly eventType: SecurityEventType;
  readonly source: string;
  readonly severity?: SecuritySeverity;
  readonly route?: string | null;
  readonly subjectFingerprint?: string | null;
  readonly sourceFingerprint?: string | null;
  readonly detail?: Record<string, unknown> | null;
  readonly providerEventId?: string | null;
  readonly requestId?: string | null;
}

/**
 * Menyimpan satu sinyal keamanan.
 *
 * BEST-EFFORT: kegagalan DB tidak boleh menggagalkan login atau mengubah
 * respons otorisasi, jadi error ditelan.
 */
export async function recordSecurityEvent(input: RecordSecurityEventInput): Promise<void> {
  try {
    await getDatabase()
      .insert(securityEvents)
      .values({
        eventType: input.eventType,
        source: limitText(input.source, TELEMETRY_FIELD_LIMITS.source) ?? 'internal',
        severity: input.severity ?? 'INFO',
        route: limitText(input.route, TELEMETRY_FIELD_LIMITS.route),
        subjectFingerprint: limitText(input.subjectFingerprint, 128),
        sourceFingerprint: limitText(input.sourceFingerprint, 128),
        detail: input.detail ? safeDetail(input.detail) : null,
        providerEventId: limitText(input.providerEventId, TELEMETRY_FIELD_LIMITS.providerEventId),
        requestId: limitText(input.requestId, TELEMETRY_FIELD_LIMITS.requestId),
      })
      // Target eksplisit: idempotensi memakai pasangan (source, provider_event_id)
      // yang dipakai partial unique index migration. Tanpa target, Postgres
      // memilih indeks arbiter dan perilaku bisa berbeda antar lingkungan.
      .onConflictDoNothing({
        target: [securityEvents.source, securityEvents.providerEventId],
      });
  } catch {
    // Sengaja ditelan: telemetry bukan jalur otorisasi.
  }
}

/** Mencatat login gagal dengan fingerprint email (bila ada). */
export async function recordLoginFailed(input: {
  readonly route: string;
  readonly email?: string | null;
  readonly clientIp?: string | null;
  readonly reason: string;
  readonly requestId?: string | null;
}): Promise<void> {
  const salt = telemetrySalt();

  await recordSecurityEvent({
    eventType: 'LOGIN_FAILED',
    source: 'auth',
    severity: 'WARNING',
    route: input.route,
    subjectFingerprint: input.email ? await hashSubject(input.email, salt) : null,
    sourceFingerprint: input.clientIp ? await hashSubject(input.clientIp, salt) : null,
    detail: { reason: input.reason },
    requestId: input.requestId ?? null,
  });
}

/** Mencatat rate limit tercapai pada endpoint. */
export async function recordRateLimitHit(input: {
  readonly route: string;
  readonly scope: 'ip' | 'email';
  readonly clientIp?: string | null;
  readonly requestId?: string | null;
}): Promise<void> {
  const salt = telemetrySalt();

  await recordSecurityEvent({
    eventType: 'RATE_LIMIT_HIT',
    source: 'auth',
    severity: 'WARNING',
    route: input.route,
    sourceFingerprint: input.clientIp ? await hashSubject(input.clientIp, salt) : null,
    detail: { scope: input.scope },
    requestId: input.requestId ?? null,
  });
}

/**
 * Mengubah event WAF mentah menjadi baris aman.
 *
 * `clientIp` di-hash, `userAgent` diringkas, dan payload mentah tidak disimpan.
 * Idempotensi memakai `(source, providerEventId)`.
 *
 * @returns `'recorded'`, `'duplicate'`, atau `'rejected'` (DB tidak siap).
 */
export async function recordWafEvent(
  input: WafEventInput,
): Promise<'recorded' | 'duplicate' | 'rejected'> {
  const salt = telemetrySalt();

  try {
    const inserted = await getDatabase()
      .insert(securityEvents)
      .values({
        eventType: 'WAF_EVENT',
        source: 'cloudflare:waf',
        severity: input.severity ?? 'WARNING',
        route: limitText(input.route, TELEMETRY_FIELD_LIMITS.route),
        sourceFingerprint: input.clientIp ? await hashSubject(input.clientIp, salt) : null,
        detail: safeDetail({
          ruleId: input.ruleId,
          action: input.action,
          userAgent: summarizeUserAgent(input.userAgent),
        }),
        providerEventId: input.providerEventId,
      })
      .onConflictDoNothing({
        target: [securityEvents.source, securityEvents.providerEventId],
      })
      .returning({ id: securityEvents.id });

    return inserted.length > 0 ? 'recorded' : 'duplicate';
  } catch {
    return 'rejected';
  }
}

/**
 * Menulis heartbeat kesehatan komponen, idempotent per `checkKey`.
 *
 * `last_success_at` hanya diperbarui saat status `healthy` supaya UI bisa
 * membedakan "terakhir sukses" dari "terakhir dicek".
 */
export async function recordHealthHeartbeat(
  input: HealthHeartbeatInput,
  nowMs: number = Date.now(),
): Promise<void> {
  const now = new Date(nowMs);
  const detail = input.detail ? safeDetail(input.detail) : null;

  try {
    await getDatabase()
      .insert(systemHealthChecks)
      .values({
        checkKey: input.checkKey,
        component: input.component,
        status: input.status,
        latencyMs: input.latencyMs ?? null,
        detail,
        lastSuccessAt: input.status === 'healthy' ? now : null,
        observedAt: now,
      })
      .onConflictDoUpdate({
        target: systemHealthChecks.checkKey,
        set: {
          component: input.component,
          status: input.status,
          latencyMs: input.latencyMs ?? null,
          detail,
          observedAt: now,
          // Status non-sehat tidak menimpa waktu sukses terakhir.
          ...(input.status === 'healthy' ? { lastSuccessAt: now } : {}),
        },
      });
  } catch {
    // Best-effort: heartbeat gagal tidak boleh menjatuhkan job pemanggil.
  }
}

// ============================================================================
// Sesi login web
// ============================================================================

/** Mencatat sesi login web. Best-effort. */
export async function recordAuthSession(input: {
  readonly id: string;
  readonly userId: string;
  readonly role: 'CEO' | 'OWNER' | 'STAFF';
  readonly clientIp?: string | null;
  readonly userAgent?: string | null;
  readonly expiresAt: Date;
  readonly nowMs?: number;
}): Promise<void> {
  const salt = telemetrySalt();
  const now = new Date(input.nowMs ?? Date.now());

  try {
    await getDatabase()
      .insert(authSessions)
      .values({
        id: input.id,
        userId: input.userId,
        role: input.role,
        lastSeenAt: now,
        expiresAt: input.expiresAt,
        ipHash: input.clientIp ? await hashSubject(input.clientIp, salt) : null,
        userAgent: summarizeUserAgent(input.userAgent),
      })
      .onConflictDoNothing();
  } catch {
    // Best-effort: sesi sah tidak boleh gagal hanya karena telemetry.
  }
}

/**
 * Mencabut satu sesi berdasarkan id sesi di cookie.
 *
 * Dipakai logout; kegagalan tidak memblokir penghapusan cookie, jadi error
 * ditelan sama seperti `touchLastLogin`.
 */
export async function revokeAuthSession(
  sessionId: string,
  nowMs: number = Date.now(),
): Promise<void> {
  try {
    await getDatabase()
      .update(authSessions)
      .set({ revokedAt: new Date(nowMs) })
      .where(and(eq(authSessions.id, sessionId), isNull(authSessions.revokedAt)));
  } catch {
    // Best-effort.
  }
}

/**
 * Mencabut semua sesi aktif milik user.
 *
 * Disediakan untuk jalur nonaktifkan/ban akun di luar Task 1.11; sengaja tetap
 * diekspor sebagai kontrak service, bukan dipanggil halaman.
 */
export async function revokeAuthSessionsForUser(
  userId: string,
  nowMs: number = Date.now(),
): Promise<void> {
  try {
    await getDatabase()
      .update(authSessions)
      .set({ revokedAt: new Date(nowMs) })
      .where(and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)));
  } catch {
    // Best-effort.
  }
}

// ============================================================================
// Baca untuk dashboard
// ============================================================================

async function listRecentSecurityEvents(
  limit: number,
  sinceMs: number,
): Promise<SecurityEventRow[]> {
  const rows = await getDatabase()
    .select()
    .from(securityEvents)
    .where(gte(securityEvents.createdAt, new Date(sinceMs)))
    .orderBy(desc(securityEvents.createdAt))
    .limit(limit);

  return rows.map((row) => {
    const eventType = row.eventType as SecurityEventType;
    const severity = row.severity as SecuritySeverity;
    return {
      id: row.id,
      eventType,
      eventTypeLabel: SECURITY_EVENT_LABELS[eventType] ?? row.eventType,
      severity,
      severityLabel: SECURITY_SEVERITY_LABELS[severity] ?? row.severity,
      source: row.source,
      route: row.route,
      subjectFingerprint: row.subjectFingerprint ? row.subjectFingerprint.slice(0, 12) : null,
      detail: safeDetail(row.detail),
      requestId: row.requestId,
      createdAt: row.createdAt.toISOString(),
    };
  });
}

async function countSecurityEvents(eventType: SecurityEventType, sinceMs: number): Promise<number> {
  const [row] = await getDatabase()
    .select({ total: count() })
    .from(securityEvents)
    .where(
      and(
        eq(securityEvents.eventType, eventType),
        gte(securityEvents.createdAt, new Date(sinceMs)),
      ),
    );

  return Number(row?.total ?? 0);
}

async function countActiveAuthSessions(nowMs: number): Promise<number> {
  const [row] = await getDatabase()
    .select({ total: count() })
    .from(authSessions)
    .where(and(isNull(authSessions.revokedAt), gte(authSessions.expiresAt, new Date(nowMs))));

  return Number(row?.total ?? 0);
}

async function listRecentAuthSessions(limit: number, nowMs: number): Promise<AuthSessionRow[]> {
  const rows = await getDatabase()
    .select()
    .from(authSessions)
    .orderBy(desc(authSessions.lastSeenAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    role: row.role,
    ipHashPrefix: row.ipHash ? row.ipHash.slice(0, 8) : null,
    userAgent: row.userAgent,
    createdAt: row.createdAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    statusLabel: classifyAuthSession(row.revokedAt, row.expiresAt, nowMs),
  }));
}

/** Sumber telemetry yang belum dikonfigurasi; ditampilkan apa adanya. */
function unavailableTelemetrySources(): readonly string[] {
  const missing: string[] = [];
  if (!process.env.WAF_INGEST_SECRET) {
    missing.push('Ingest WAF belum dikonfigurasi (WAF_INGEST_SECRET kosong).');
  }
  return missing;
}

/**
 * Snapshot keamanan untuk `/ceo-dashboard/security`.
 *
 * @param windowHours Jendela hitungan ringkasan; dibatasi 1..720 jam.
 * @param limit Batas baris event; dibatasi 1..200.
 * @throws {TenantServerError} `UNAUTHORIZED` bila bukan CEO.
 */
export async function getSecuritySnapshot(windowHours = 24, limit = 50): Promise<SecuritySnapshot> {
  await requireCeo();

  const safeWindow = clampInt(windowHours, 1, 720, 24);
  const safeLimit = clampInt(limit, 1, 200, 50);
  const nowMs = Date.now();
  const sinceMs = nowMs - safeWindow * 3_600_000;

  const [loginFailed, rateLimitHit, wafEvent, activeSessions, events, sessions] = await Promise.all(
    [
      countSecurityEvents('LOGIN_FAILED', sinceMs),
      countSecurityEvents('RATE_LIMIT_HIT', sinceMs),
      countSecurityEvents('WAF_EVENT', sinceMs),
      countActiveAuthSessions(nowMs),
      listRecentSecurityEvents(safeLimit, sinceMs),
      listRecentAuthSessions(20, nowMs),
    ],
  );

  return {
    summary: { windowHours: safeWindow, loginFailed, rateLimitHit, wafEvent, activeSessions },
    events,
    sessions,
    unavailable: unavailableTelemetrySources(),
    generatedAt: new Date(nowMs).toISOString(),
  };
}

// ============================================================================
// Health + antrean webhook
// ============================================================================

/** Ringkasan antrean webhook dari tabel idempotensi/dead-letter. */
async function getWebhookQueueSummary(): Promise<WebhookQueueSummary> {
  const db = getDatabase();

  const [pendingRow, failedRow, oldestRow, processedRow] = await Promise.all([
    db.select({ total: count() }).from(webhookEvents).where(isNull(webhookEvents.processedAt)),
    db.select({ total: count() }).from(webhookFailures).where(eq(webhookFailures.resolved, false)),
    db
      .select({ oldest: sql<Date | null>`min(${webhookEvents.createdAt})` })
      .from(webhookEvents)
      .where(isNull(webhookEvents.processedAt)),
    db.select({ latest: sql<Date | null>`max(${webhookEvents.processedAt})` }).from(webhookEvents),
  ]);

  return {
    pending: Number(pendingRow[0]?.total ?? 0),
    failedUnresolved: Number(failedRow[0]?.total ?? 0),
    oldestPendingAt: oldestRow[0]?.oldest?.toISOString() ?? null,
    lastProcessedAt: processedRow[0]?.latest?.toISOString() ?? null,
  };
}

async function listHealthRows(): Promise<HealthRow[]> {
  const rows = await getDatabase()
    .select()
    .from(systemHealthChecks)
    .orderBy(systemHealthChecks.component, systemHealthChecks.checkKey);

  return rows.map((row) => {
    const status = row.status as HealthStatus;
    const component = row.component as HealthComponent;
    return {
      checkKey: row.checkKey,
      component,
      componentLabel: HEALTH_COMPONENT_LABELS[component] ?? row.component,
      status,
      statusLabel: HEALTH_STATUS_LABELS[status] ?? row.status,
      latencyMs: row.latencyMs,
      observedAt: row.observedAt.toISOString(),
      lastSuccessAt: row.lastSuccessAt ? row.lastSuccessAt.toISOString() : null,
      detail: safeDetail(row.detail),
    };
  });
}

/**
 * Snapshot kesehatan sistem untuk `/ceo-dashboard/system-health`.
 *
 * @throws {TenantServerError} `UNAUTHORIZED` bila bukan CEO.
 */
export async function getSystemHealthSnapshot(): Promise<SystemHealthSnapshot> {
  await requireCeo();

  const [rows, queue] = await Promise.all([listHealthRows(), getWebhookQueueSummary()]);

  return {
    rows,
    queue,
    overallStatus: aggregateHealthStatus(rows),
    unavailable: unavailableTelemetrySources(),
    generatedAt: new Date().toISOString(),
  };
}

export { requireCeo };
