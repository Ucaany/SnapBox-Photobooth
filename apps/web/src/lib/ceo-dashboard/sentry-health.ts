/**
 * Adapter health Sentry (PRD Task 1.11, Bab 8.9).
 *
 * Sentinel server-only: modul ini HANYA dipanggil dari server (heartbeat atau
 * route CEO), tidak pernah dari browser. Token Sentry tidak pernah dikirim ke
 * klien; yang disimpan di DB hanya status, latensi, dan ringkasan aman.
 *
 * Perilaku bila kredensial/project belum diset: `unavailable`, BUKAN `healthy`.
 * Tidak ada klaim "Sentry aktif" tanpa bukti panggilan API yang berhasil.
 */
import { recordHealthHeartbeat } from './health-security-server';
import { limitText, TELEMETRY_FIELD_LIMITS, type HealthStatus } from './health-security-contract';

const CHECK_KEY = 'sentry';
const TIMEOUT_MS = 5_000;

interface SentryProbeResult {
  readonly status: HealthStatus;
  readonly latencyMs: number | null;
  readonly detail: string;
}

/**
 * Memeriksa API Sentry untuk project web.
 *
 * Memakai endpoint issue stats ringkas; bila token/project kosong, langsung
 * `unavailable` tanpa permintaan jaringan.
 *
 * @param fetchImpl Diinjeksi untuk test; default `fetch` global.
 */
export async function probeSentry(fetchImpl: typeof fetch = fetch): Promise<SentryProbeResult> {
  const token = process.env.SENTRY_AUTH_TOKEN;
  const org = process.env.SENTRY_ORG;
  const project = process.env.SENTRY_PROJECT;

  if (!token || !org || !project) {
    return {
      status: 'unavailable',
      latencyMs: null,
      detail: 'Kredensial Sentry belum diset.',
    };
  }

  const started = Date.now();
  try {
    const response = await fetchImpl(
      `https://sentry.io/api/0/projects/${encodeURIComponent(org)}/${encodeURIComponent(project)}/`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: 'no-store',
      },
    );

    const latencyMs = Date.now() - started;

    if (!response.ok) {
      return {
        status: response.status >= 500 ? 'outage' : 'degraded',
        latencyMs,
        detail: `Sentry membalas ${response.status}.`,
      };
    }

    return { status: 'healthy', latencyMs, detail: 'API Sentry dapat dijangkau.' };
  } catch {
    // Timeout/network error: jangan bocorkan pesan mentah ke DB/UI.
    return {
      status: 'outage',
      latencyMs: Date.now() - started,
      detail: 'Panggilan Sentry gagal atau melewati batas waktu.',
    };
  }
}

/**
 * Menjalankan probe Sentry dan menulis heartbeat-nya.
 *
 * @returns Hasil probe, sehingga pemanggil bisa menampilkan umpan balik.
 */
export async function runSentryHealthProbe(
  fetchImpl: typeof fetch = fetch,
): Promise<SentryProbeResult> {
  const result = await probeSentry(fetchImpl);

  await recordHealthHeartbeat({
    checkKey: CHECK_KEY,
    component: 'observability',
    status: result.status,
    latencyMs: result.latencyMs,
    detail: { summary: limitText(result.detail, TELEMETRY_FIELD_LIMITS.detail) },
  });

  return result;
}
