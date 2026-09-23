import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Konfigurasi Vite untuk frontend kiosk.
 *
 * Pengaturan `host` dan `port` tetap (bukan acak) karena Tauri menunjuk ke
 * `devUrl` yang sama, dan `strictPort` mencegah Tauri menampilkan window
 * kosong saat port bergeser diam-diam.
 */
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: false,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  build: {
    // Kiosk berjalan di WebView2/WebKitGTK modern, bukan browser lama.
    target: 'es2022',
    sourcemap: true,
    minify: 'esbuild',
  },
});
