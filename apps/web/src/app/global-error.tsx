'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

/**
 * Boundary error level akar App Router.
 *
 * `global-error.tsx` menggantikan `layout.tsx` saat render gagal total, jadi ia
 * WAJIB merender `<html>` dan `<body>` sendiri dan WAJIB client component
 * (`'use client'`) — App Router menuntutnya untuk error boundary.
 *
 * Error dilaporkan ke Sentry lewat `useEffect` (bukan saat render) agar
 * pelaporan tidak memicu render ulang di tengah proses error.
 *
 * Gaya minimal memakai token yang sudah ada (`bg-background`, `text-foreground`)
 * plus `--font-display`; sengaja tanpa komponen baru karena boundary ini harus
 * benar-benar mandiri (tidak boleh bergantung pada provider yang mungkin gagal).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="id-ID">
      <body className="bg-background font-[family-name:var(--font-display)] text-foreground">
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
          <h1 className="text-2xl font-bold">Terjadi kesalahan tak terduga</h1>
          <p className="text-sm">
            Maaf, halaman ini gagal dimuat. Kesalahan sudah dilaporkan ke tim kami.
          </p>
          {error.digest ? (
            <p className="text-xs opacity-70">Kode kesalahan: {error.digest}</p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            className="mt-2 border-2 border-border bg-main px-4 py-2 text-sm font-semibold text-main-foreground"
          >
            Coba lagi
          </button>
        </div>
      </body>
    </html>
  );
}
