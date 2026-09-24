/// <reference types="vite/client" />

/**
 * Vite hanya meng-inline prefix `VITE_`, sehingga `NEXT_PUBLIC_*` dari web
 * tidak terlihat di kiosk. Deklarasi ini membuat `tsc --noEmit` mengenal
 * variabel kiosk tanpa perlu `as string`.
 */
interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SENTRY_RELEASE?: string;
}
