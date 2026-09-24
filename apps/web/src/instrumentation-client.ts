import * as Sentry from '@sentry/nextjs';

/**
 * Konfigurasi Sentry untuk runtime browser (Sentry v11, Next.js App Router).
 *
 * GATING DSN: `Sentry.init` hanya dipanggil bila `NEXT_PUBLIC_SENTRY_DSN` terisi.
 * Di dev tanpa DSN, SDK tidak pernah aktif sehingga tidak ada request keluar,
 * tidak ada noise di console, dan tidak ada biaya ingest.
 *
 * PII (mandat PRD Bab 8.7): di v11 `sendDefaultPii` sudah dihapus dan digantikan
 * `dataCollection`. Kita matikan `userInfo`, `cookies`, `httpHeaders`, dan
 * `httpBodies` supaya SDK tidak pernah mengirim data pelanggan; query param
 * dibiarkan aktif karena nilainya sudah tersanitasi SDK dan dibutuhkan untuk
 * triase. Opsi `dataCollection` ini juga membatasi apa yang direkam oleh replay
 * integration sejauh didukung SDK.
 *
 * Replay integration DIDAFTARKAN (`Sentry.replayIntegration()`), karena tanpa
 * integrasi ini opsi sampling di bawah tidak berpengaruh. Sesi normal tidak
 * direkam (`replaysSessionSampleRate: 0`); yang aktif adalah buffer-on-error
 * (`replaysOnErrorSampleRate: 1`) sehingga rekaman hanya diambil di sekitar
 * error. Rekaman layar dashboard bisa memuat data pelanggan, jadi hanya diambil
 * sebagai bukti saat error benar-benar terjadi.
 *
 * `tunnel: '/monitoring-tunnel'` merutekan event lewat origin sendiri supaya
 * adblocker tidak memblokir request ke ingest Sentry. Catatan: route tunnel ini
 * harus dikecualikan dari robots.txt (Task 1.1).
 */
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1,
    integrations: (defaultIntegrations) => [...defaultIntegrations, Sentry.replayIntegration()],
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: true,
    },
    tunnel: '/monitoring-tunnel',
    debug: false,
  });
}

/**
 * Instrumentasi navigasi App Router: melaporkan transisi route sebagai span.
 * Wajib diekspor dari file ini agar SDK v11 bisa memasangnya otomatis.
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
