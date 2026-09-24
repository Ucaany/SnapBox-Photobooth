import * as Sentry from '@sentry/nextjs';

/**
 * Konfigurasi Sentry untuk runtime Edge (middleware, route ber-`runtime = 'edge'`).
 * Dipanggil dari `instrumentation.ts` -> `register()` saat `NEXT_RUNTIME === 'edge'`.
 *
 * Isi opsi identik dengan `sentry.server.config.ts`; keduanya dipisah karena
 * bundler memuat masing-masing hanya pada runtime-nya. `tunnel` tetap ditiadakan
 * di sini karena opsi itu client-only.
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
