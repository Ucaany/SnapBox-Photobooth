import { withSentryConfig } from '@sentry/nextjs/config';
import type { NextConfig } from 'next';

/**
 * Konfigurasi Next.js SnapBox.
 *
 * `transpilePackages` diperlukan karena paket workspace (`@snapbox/*`) dikirim
 * sebagai sumber TypeScript, bukan hasil build, supaya perubahan skema langsung
 * terpakai tanpa langkah build terpisah.
 */
/**
 * `Strict-Transport-Security`.
 *
 * Ditaruh di sini, bukan di middleware, karena nilainya konstan per environment
 * dan tidak bergantung pada request. `max-age` dua tahun dengan
 * `includeSubDomains` sesuai rekomendasi umum.
 *
 * `preload` SENGAJA TIDAK dipakai: preload mengikat domain beserta seluruh
 * subdomain ke HTTPS, dan keputusan itu tidak bisa diambil di dalam repo yang
 * tidak tahu subdomain mana yang milik orang lain. Aktifkan dari dashboard
 * Cloudflare setelah verifikasi `snapbox.id` dan `www.snapbox.id` benar-benar
 * HTTPS-only.
 */
const strictTransportSecurity = 'max-age=63072000; includeSubDomains';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@snapbox/auth', '@snapbox/db', '@snapbox/shared', '@snapbox/ui'],
  typedRoutes: true,
  eslint: {
    // Lint dijalankan sebagai task terpisah di CI agar error lint tidak
    // menggagalkan build produksi secara tak terduga.
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  experimental: {
    // Zod dan Drizzle memakai API Node; jangan di-bundle ke edge runtime.
    serverActions: { bodySizeLimit: '6mb' },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=()',
          },
          { key: 'Strict-Transport-Security', value: strictTransportSecurity },
        ],
      },
    ];
  },
};

/**
 * Tanpa token auth, upload source map ke Sentry tidak mungkin. Kita mematikan
 * langkah itu alih-alih membiarkan build GAGAL di lokal/CI yang belum punya
 * `SENTRY_AUTH_TOKEN`. Build produksi yang ber-token tetap meng-upload source map
 * agar stack trace tidak minified.
 */
const hasSentryAuthToken = Boolean(process.env.SENTRY_AUTH_TOKEN);

/**
 * Pembungkus Sentry:
 * - `org`/`project`/`authToken`: identitas project untuk upload source map.
 *   Diset HANYA bila variabelnya ada: tsconfig memakai
 *   `exactOptionalPropertyTypes`, jadi menyematkan `undefined` eksplisit akan
 *   ditolak tipe `SentryBuildOptions`.
 * - `tunnelRoute`: event client dikirim lewat origin sendiri (adblocker bypass).
 *   Route `/monitoring-tunnel` ini harus dikecualikan dari robots.txt (Task 1.1)
 *   supaya tidak diindeks dan tidak tumpang tindih dengan `/api/health`.
 * - `widenClientFileUpload`: unggah chunk client lebih banyak untuk stack trace
 *   yang lebih akurat.
 * - `sourcemaps.disable`: matikan upload source map saat token tidak ada
 *   (lihat `hasSentryAuthToken` di atas). Build tidak boleh gagal karena ini.
 * - `silent`: bisu di CI (kecuali `CI === 'true'`) agar log build tidak ramai.
 * - `telemetry: false`: tidak mengirim telemetry build ke Sentry.
 */
export default withSentryConfig(nextConfig, {
  ...(process.env.SENTRY_ORG ? { org: process.env.SENTRY_ORG } : {}),
  ...(process.env.SENTRY_PROJECT ? { project: process.env.SENTRY_PROJECT } : {}),
  ...(process.env.SENTRY_AUTH_TOKEN ? { authToken: process.env.SENTRY_AUTH_TOKEN } : {}),
  tunnelRoute: '/monitoring-tunnel',
  widenClientFileUpload: true,
  sourcemaps: { disable: !hasSentryAuthToken },
  silent: process.env.CI !== 'true',
  telemetry: false,
});
