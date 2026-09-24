import * as Sentry from '@sentry/nextjs';

/**
 * Konfigurasi Sentry untuk runtime Node.js (server component, route handler,
 * server action). Dipanggil dari `instrumentation.ts` -> `register()`.
 *
 * GATING DSN sama dengan client: tanpa `NEXT_PUBLIC_SENTRY_DSN`, SDK tidak
 * diinisialisasi sama sekali.
 *
 * Opsi `tunnel` TIDAK boleh ada di sini — tunnel adalah opsi client-only yang
 * hanya relevan untuk transport browser; server mengirim langsung ke DSN.
 *
 * PII (PRD Bab 8.7): di v11 `sendDefaultPii` sudah dihapus dan digantikan
 * `dataCollection`. Kita matikan `userInfo`, `cookies`, `httpHeaders`, dan
 * `httpBodies` supaya SDK tidak pernah mengirim data pelanggan; query param
 * dibiarkan aktif karena nilainya sudah tersanitasi SDK dan berguna untuk
 * triase. Ini padanan paling dekat dari `sendDefaultPii: false` di v11.
 */
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: true,
    },
    debug: false,
  });
}
