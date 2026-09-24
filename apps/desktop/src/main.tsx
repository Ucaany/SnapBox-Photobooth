import * as Sentry from '@sentry/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import './styles.css';

/**
 * Inisialisasi Sentry hanya bila DSN tersedia.
 *
 * DSN sengaja opsional: build lokal tanpa `.env` tetap harus jalan, dan kiosk
 * tanpa akses jaringan tidak boleh gagal boot gara-gara telemetri.
 * `dataCollection` adalah API v11 pengganti `sendDefaultPii` (dihapus di v11);
 * ini gerbang PII setara dari sisi klien.
 */
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    release: import.meta.env.VITE_SENTRY_RELEASE,
    environment: import.meta.env.MODE,
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
    },
  });
}

const container = document.getElementById('root');

if (!container) {
  throw new Error('Elemen #root tidak ditemukan di index.html.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
