/**
 * Batas laju endpoint autentikasi.
 *
 * PRD Bab 8.2 menetapkan `/api/auth/*` dibatasi 10 req/menit per IP dan 5
 * req/menit per email. Yang diimplementasikan di sini adalah lapisan aplikasi;
 * Cloudflare Rate Limiting tetap menjadi lapisan pertama di edge.
 *
 * SIPAT PENTING: implementasi ini IN-MEMORY dan per-instance. Pada Vercel
 * serverless tiap instance punya penghitung sendiri, sehingga dosis efektif
 * berlipat sebanyak jumlah instance panas. Itu tetap jauh lebih baik daripada
 * tanpa batas sama sekali, tetapi ini BUKAN pengganti rate limit terdistribusi.
 *
 * ponytail: in-memory per-instance, cukup untuk satu region singel (vercel.json
 * `regions: ["sin1"]`) dan sebagai jaring pengaman. Ganti dengan store
 * terdistribusi (Vercel KV/Upstash/Cloudflare Durable Object) ketika endpoint
 * auth sudah dihadapkan ke trafik publik nyata atau multi-region.
 *
 * Tidak ada import `next/*` agar file ini aman dipakai ulang di runtime mana pun.
 */

interface Bucket {
  count: number;
  /** Waktu (ms) jendela saat ini berakhir. */
  resetAt: number;
}

/** Jendela tetap 1 menit, sesuai spesifikasi PRD. */
const WINDOW_MS = 60_000;

/** Batas per jendela. */
const IP_LIMIT = 10;
const EMAIL_LIMIT = 5;

const buckets = new Map<string, Bucket>();

/**
 * Bukti bersama antar-instance tidak ada, tetapi peta tumbuh tanpa batas bila
 * penyerang memalsukan kunci. Pembersihan sederhana ini menjaga memori tetap
 * wajar tanpa perlu timer (timer tidak boleh dipakai di runtime serverless).
 */
const MAX_BUCKETS = 5_000;

function consume(
  key: string,
  limit: number,
  nowMs: number,
): { allowed: boolean; retryAfter: number } {
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= nowMs) {
    if (buckets.size >= MAX_BUCKETS) buckets.clear();
    buckets.set(key, { count: 1, resetAt: nowMs + WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }

  existing.count += 1;

  if (existing.count > limit) {
    return { allowed: false, retryAfter: Math.ceil((existing.resetAt - nowMs) / 1000) };
  }

  return { allowed: true, retryAfter: 0 };
}

/**
 * Alamat IP klien.
 *
 * `x-forwarded-for` bisa dipalsukan bila aplikasi tidak berada di belakang
 * proxy tepercaya. Di Vercel/Cloudflare header ini ditulis ulang oleh edge,
 * jadi dipakai sebagai sumber utama; ketiadaannya jatuh ke `'unknown'` yang
 * membuat seluruh trafik anonim berbagi satu jendela (konservatif, bukan permisif).
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }

  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

/**
 * Kunci batas laju per IP untuk endpoint.
 *
 * @param request Permintaan masuk.
 * @param scope Nama endpoint (mis. `session`, `staff-pin`).
 */
export function authRateLimitKey(request: Request, scope: string): string {
  return `${scope}:ip:${clientIp(request)}`;
}

/**
 * Kunci batas laju per email, dinormalkan huruf kecil.
 *
 * @param scope Nama endpoint.
 * @param email Email yang dicoba; dinormalkan agar perubahan kapitalisasi tidak
 *   membuka jendela baru.
 */
export function authEmailRateLimitKey(scope: string, email: string): string {
  return `${scope}:email:${email.trim().toLowerCase()}`;
}

export interface RateLimitResult {
  readonly allowed: boolean;
  /** Detik sampai jendela berikutnya; 0 bila diizinkan. */
  readonly retryAfter: number;
}

/**
 * Memeriksa batas per IP untuk satu endpoint.
 *
 * @param key Hasil `authRateLimitKey`.
 * @param nowMs Waktu sekarang, dapat diganti untuk test.
 */
export function checkAuthRateLimit(key: string, nowMs: number = Date.now()): RateLimitResult {
  return consume(key, IP_LIMIT, nowMs);
}

/**
 * Memeriksa batas per email untuk satu endpoint.
 *
 * @param key Hasil `authEmailRateLimitKey`.
 * @param nowMs Waktu sekarang, dapat diganti untuk test.
 */
export function checkAuthEmailRateLimit(key: string, nowMs: number = Date.now()): RateLimitResult {
  return consume(key, EMAIL_LIMIT, nowMs);
}

/** Mengosongkan seluruh jendela. Dipakai test, bukan runtime. */
export function resetAuthRateLimits(): void {
  buckets.clear();
}
