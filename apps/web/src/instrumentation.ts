import * as Sentry from '@sentry/nextjs';

/**
 * Entry point instrumentasi Next.js (App Router).
 *
 * `register()` dipanggil sekali per runtime saat server start. Import config
 * harus DINAMIS di dalam cabang runtime: file yang sama dibundel untuk Node dan
 * Edge, sehingga import statis akan menyeret modul Node ke bundel Edge (atau
 * sebaliknya) dan gagal saat build.
 *
 * `onRequestError` menangkap error yang lolos dari server component, route
 * handler, dan server action. `captureRequestError` diekspor dari `@sentry/nextjs`
 * di v11 dan aman diimpor statis di sini karena `instrumentation.ts` sendiri
 * di-inline per runtime oleh Next.js.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
