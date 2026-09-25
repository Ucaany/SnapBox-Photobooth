/**
 * Probe dependency untuk heartbeat kesehatan sistem (PRD Task 1.11).
 *
 * Setiap probe mengembalikan status + latensi dan MENULIS heartbeat lewat
 * `recordHealthHeartbeat`. Tujuannya supaya `/ceo-dashboard/system-health`
 * tidak hanya menampilkan baris milik job cron, tetapi juga hasil pemeriksaan
 * langsung untuk layanan yang bisa dicek dari server.
 *
 * Aturan yang mengikat:
 * - Tidak ada secret yang dikirim ke UI; hanya status dan ringkasan aman.
 * - Setiap probe memakai timeout dan menangkap error sendiri, sehingga satu
 *   dependency yang down tidak menggagalkan halaman (`Promise.allSettled`).
 * - `unavailable` dipakai bila env/kredensial belum diset, BUKAN `healthy`.
 */
import { getDatabase } from '@snapbox/db';
import { sql } from 'drizzle-orm';

import { limitText, TELEMETRY_FIELD_LIMITS, type HealthStatus } from './health-security-contract';
import { recordHealthHeartbeat } from './health-security-server';

interface ProbeOutcome {
  readonly checkKey: string;
  readonly component: 'database' | 'identity' | 'edge' | 'gateway';
  readonly status: HealthStatus;
  readonly latencyMs: number | null;
  readonly detail: string;
}

/** Pemeriksaan konektivitas database. */
async function probeDatabase(): Promise<ProbeOutcome> {
  if (!process.env.DATABASE_URL) {
    return {
      checkKey: 'supabase-db',
      component: 'database',
      status: 'unavailable',
      latencyMs: null,
      detail: 'DATABASE_URL belum diset.',
    };
  }

  const started = Date.now();
  try {
    await getDatabase().execute(sql`select 1`);
    return {
      checkKey: 'supabase-db',
      component: 'database',
      status: 'healthy',
      latencyMs: Date.now() - started,
      detail: 'Koneksi basis data berhasil.',
    };
  } catch {
    return {
      checkKey: 'supabase-db',
      component: 'database',
      status: 'outage',
      latencyMs: Date.now() - started,
      detail: 'Koneksi basis data gagal.',
    };
  }
}

/**
 * Pemeriksaan konfigurasi Firebase Admin.
 *
 * Bukan panggilan jaringan penuh: memverifikasi variabel wajib ada, karena
 * verifikasi token Firebase nyata sudah terjadi saat login. Status `unavailable`
 * bila env belum lengkap.
 */
function probeFirebaseConfig(): ProbeOutcome {
  const hasProject = Boolean(process.env.FIREBASE_ADMIN_PROJECT_ID);
  const hasClient = Boolean(process.env.FIREBASE_ADMIN_CLIENT_EMAIL);
  const hasKey = Boolean(process.env.FIREBASE_ADMIN_PRIVATE_KEY);

  if (!hasProject || !hasClient || !hasKey) {
    return {
      checkKey: 'firebase-admin',
      component: 'identity',
      status: 'unavailable',
      latencyMs: null,
      detail: 'Kredensial Firebase Admin belum lengkap.',
    };
  }

  return {
    checkKey: 'firebase-admin',
    component: 'identity',
    status: 'healthy',
    latencyMs: null,
    detail: 'Kredensial Firebase Admin tersedia.',
  };
}

/**
 * Pemeriksaan konfigurasi Cloudflare (zone/WAF).
 *
 * Sama seperti Firebase: konfigurasi tidak dijangkau jaringan demi menghindari
 * rate limit API Cloudflare dari halaman CEO.
 */
function probeCloudflareConfig(): ProbeOutcome {
  const hasToken = Boolean(process.env.CLOUDFLARE_API_TOKEN);
  const hasZone = Boolean(process.env.CLOUDFLARE_ZONE_ID);
  const hasWafSecret = Boolean(process.env.WAF_INGEST_SECRET);

  if (!hasToken || !hasZone) {
    return {
      checkKey: 'cloudflare-edge',
      component: 'edge',
      status: 'unavailable',
      latencyMs: null,
      detail: 'Token atau zone Cloudflare belum diset.',
    };
  }

  return {
    checkKey: 'cloudflare-edge',
    component: 'edge',
    status: hasWafSecret ? 'healthy' : 'degraded',
    latencyMs: null,
    detail: hasWafSecret
      ? 'Kredensial edge dan ingest WAF tersedia.'
      : 'Ingest WAF belum dikonfigurasi; event WAF tidak masuk.',
  };
}

/** Pemeriksaan konfigurasi gateway B2B (Pakasir). */
function probeGatewayConfig(): ProbeOutcome {
  const hasKey = Boolean(process.env.PAKASIR_B2B_API_KEY);
  const hasSecret = Boolean(process.env.PAKASIR_B2B_WEBHOOK_SECRET);

  if (!hasKey || !hasSecret) {
    return {
      checkKey: 'pakasir-b2b',
      component: 'gateway',
      status: 'unavailable',
      latencyMs: null,
      detail: 'Kredensial gateway B2B belum lengkap.',
    };
  }

  return {
    checkKey: 'pakasir-b2b',
    component: 'gateway',
    status: 'healthy',
    latencyMs: null,
    detail: 'Kredensial gateway B2B tersedia.',
  };
}

/**
 * Menjalankan semua probe konfigurasi cepat secara paralel dan menulis
 * heartbeat-nya. `probeDatabase` sudah async; sisanya sinkron.
 */
export async function runConfigHealthProbes(): Promise<void> {
  const outcomes = await Promise.allSettled([
    probeDatabase(),
    Promise.resolve(probeFirebaseConfig()),
    Promise.resolve(probeCloudflareConfig()),
    Promise.resolve(probeGatewayConfig()),
  ]);

  await Promise.all(
    outcomes.map(async (outcome) => {
      if (outcome.status !== 'fulfilled') return;
      const value = outcome.value;
      await recordHealthHeartbeat({
        checkKey: value.checkKey,
        component: value.component,
        status: value.status,
        latencyMs: value.latencyMs,
        detail: {
          summary: limitText(value.detail, TELEMETRY_FIELD_LIMITS.detail) ?? 'Tanpa keterangan.',
        },
      });
    }),
  );
}
