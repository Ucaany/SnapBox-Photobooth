import type { NextConfig } from 'next';

/**
 * Konfigurasi Next.js SnapBox.
 *
 * `transpilePackages` diperlukan karena paket workspace (`@snapbox/*`) dikirim
 * sebagai sumber TypeScript, bukan hasil build, supaya perubahan skema langsung
 * terpakai tanpa langkah build terpisah.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@snapbox/db', '@snapbox/shared', '@snapbox/ui'],
  typedRoutes: true,
  eslint: {
    // Lint dijalankan sebagai task terpisah di CI agar error lint tidak
    // menggagalkan build produksi secara tidak terduga.
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  experimental: {
    // Zod dan Drizzle memakai API Node; jangan di-bundle ke edge runtime.
    serverActions: { bodySizeLimit: '2mb' },
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
        ],
      },
    ];
  },
};

export default nextConfig;
