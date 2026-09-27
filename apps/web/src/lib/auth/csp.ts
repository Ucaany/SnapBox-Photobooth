/**
 * Content-Security-Policy per-request.
 *
 * Mulai 2026-09-27 (P-B-39) web app punya CSP, padahal konfigurasi Tauri sudah
 * punya yang lebih ketat — jadi aplikasi web adalah sisi yang lebih lemah dari
 * dua sisi yang sama.
 *
 * KENAPA DI MIDDLEWARE, BUKAN `next.config.ts`. Directive `script-src 'nonce-…'`
 * hanya berguna kalau nonce-nya dibuatServer untuk setiap request dan diteruskan
 * ke Next.js lewat request header. `next.config.ts` hanya bisa menulis header
 * STATIS: nonce yang ditulis di sana tidak pernah cocok dengan nonce yang
 * disuntik Next.js, dan hasilnya bukan "CSP lebih ketat" melainkan seluruh
 * aplikasi tidak memuat. Middleware adalah satu-satunya tempat di App Router
 * yang melihat request sebelum render.
 *
 * ATURAN YANG DIPAKAI, dan kenapa:
 * - TIDAK ADA `unsafe-eval` di production. Next.js production build tidak
 *   memerlukannya; hanya development (react-refresh) yang memerlukannya.
 * - TIDAK ADA `unsafe-inline` pada `script-src`. Script yang disuntik Next.js
 *   untuk hydration dan RSC payload menerima nonce yang sama, dan
 *   `'strict-dynamic'` membuat browser mempercayai script yang dimuat oleh script
 *   ber-nonce — sehingga domain yang Allowed harus tetap disebut eksplisit untuk
 *   browser lama.
 * - `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`. Tiga hal yang
 *   tidak ada hubungannya dengan XSS tapi menutup jalur serangannya: plugin
 *   yang bisa mengeksekusi skrip, basis `<base>` yang mengarahkan semua URL, dan
 *   form yang mengirim kata sandi ke domain lain.
 * - `frame-ancestors 'none'` menggantikan `X-Frame-Options` untuk browser modern;
 *   keduanya dipertahankan karena tidak saling menggantikan di semua klien.
 * - `connect-src` memuat `wss://*.supabase.co` (Supabase Realtime) dan host
 *   API. Tanpanya, loop reconnect realtime dan pairing dari kiosk diblokir — dan
 *   CSP yang memblokir fiturnya sendiri lebih buruk daripada tidak ada CSP.
 * - `style-src` memakai `'unsafe-inline'`. Next.js menyuntik `<style>` untuk
 *   streaming; memblokirnya mematikan tampilan, dan style inline bukan vektor
 *   eksekusi skrip di browser modern. Dicatat sebagai penyimpangan yang
 *   disengaja, bukan kelalaian.
 *
 * `report-uri` diarahkan ke `/api/health` pada fase `report-only` (default).
 * Setelah satu siklus production proves tidak ada pelanggaran yang tidak
 * diharapkan, `CSP_ENFORCE=1` mengaktifkannya. Endpoint pelaporan khusus
 * (`/api/csp-report`) lebih baik dan sengaja tidak dibuat sekarang: menambah
 * route publik yang menerima body dari mana saja adalah permukaan baru, dan
 * `report-uri` yang hilang hanya menghilangkan laporan, bukan keamanan.
 */

/** Panjang nonce, byte. 16 byte = 128 bit, jauh di atas yang dibutuhkan CSP. */
const NONCE_BYTES = 16;

/**
 * Nonce acak untuk satu request.
 *
 * `crypto.getRandomValues` tersedia di Edge runtime dan di Node, jadi modul ini
 * aman dipakai di middleware tanpa conditionally.
 */
export function generateCspNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Header `X-Content-Security-Policy` yang dibaca browser.
 *
 * CSP hanya berlaku pada dokumen; respons JSON tidak punya dokumen, jadi
 * `Content-Security-Policy` pada API tidak menambah apa pun dan hanya menambah
 * byte. Middleware tetap mengirimnya supaya konsisten — header yang tidak
 * berbahaya — tapi `report-only` pada respons non-dokumen tidak ada gunanya.
 */
function isDocument(request: Request): boolean {
  const method = request.method.toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') return false;

  const accept = request.headers.get('accept') ?? '';
  // Halaman = `text/html`. Semua route handler di repo ini di-bound ke
  // `NextResponse.json`, yang tidak termasuk di sini.
  return accept.includes('text/html');
}

/** Host yang boleh jadi tujuan `connect-src`, diturunkan dari request sendiri. */
function apiOrigins(request: Request): string[] {
  const host = request.headers.get('host');
  return host ? [`https://${host}`] : [];
}

/**
 * Membangun nilai CSP untuk satu request.
 *
 * @param nonce Nonce yang sama dengan yang diteruskan ke Next.js lewat header
 *   request `x-nonce`.
 * @param request Request masuk, dipakai untuk `connect-src` dan untuk deciding
 *   apakah responsnya berupa dokumen.
 */
export function buildContentSecurityPolicy(nonce: string, request: Request): string {
  const development = process.env.NODE_ENV !== 'production';

  const directives: string[] = [
    "default-src 'self'",
    // `strict-dynamic` membuat browser mempercayai script yang dimuat oleh
    // script ber-nonce, sehingga allowlist host tidak perlu dibuka untuk
    // chunk yang Next.js sisipkan sendiri. Browser lama (tanpa strict-dynamic)
    // tetap memakai daftar host, jadi keduanya disebut.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://snapboxsaas.firebaseapp.com${
      development ? " 'unsafe-eval'" : ''
    }`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "worker-src 'self' blob:",
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co ${apiOrigins(request).join(' ')}`.trim(),
    // object-src tidak boleh `*`: plugin yang bisa mengeksekusi skrip adalah
    // jalur XSS yang paling lama bertahan.
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ];

  if (!isDocument(request)) {
    // Respons non-dokumen: cukup header normal, tanpa report-only. Melaporkan
    // pelanggaran dari `fetch` menghasilkan noise, bukan data.
    return directives.join('; ');
  }

  return `${directives.join('; ')}; report-uri /api/health`;
}
