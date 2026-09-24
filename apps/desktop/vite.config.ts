import { sentryVitePlugin } from '@sentry/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * ID rilis untuk sourcemap Sentry.
 *
 * Di CI, `SENTRY_RELEASE` diisi oleh workflow rilis; fallback ke `GITHUB_SHA`
 * agar tiap build punya ID unik. `'dev'` dipakai saat build lokal.
 */
const release = process.env.SENTRY_RELEASE ?? process.env.GITHUB_SHA ?? 'dev';

/**
 * Konfigurasi Vite untuk frontend kiosk.
 *
 * Pengaturan `host` dan `port` tetap (bukan acak) karena Tauri menunjuk ke
 * `devUrl` yang sama, dan `strictPort` mencegah Tauri menampilkan window
 * kosong saat port bergeser diam-diam.
 */
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // Plugin upload sourcemap hanya aktif bila token ada. Tanpa token, build
    // lokal tetap sukses dan hanya kehilangan upload sourcemap.
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [
          sentryVitePlugin({
            ...(process.env.SENTRY_ORG ? { org: process.env.SENTRY_ORG } : {}),
            project: process.env.SENTRY_PROJECT ?? 'snapbox-desktop',
            authToken: process.env.SENTRY_AUTH_TOKEN,
          }),
        ]
      : []),
  ],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: false,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  define: {
    'import.meta.env.VITE_SENTRY_RELEASE': JSON.stringify(release),
  },
  build: {
    // Kiosk berjalan di WebView2/WebKitGTK modern, bukan browser lama.
    target: 'es2022',
    // `hidden` di prod: sourcemap diunggah ke Sentry, tidak disajikan ke
    // WebView. Di dev tetap `true` agar debugging mudah.
    sourcemap: mode === 'production' ? 'hidden' : true,
    minify: 'esbuild',
  },
}));
