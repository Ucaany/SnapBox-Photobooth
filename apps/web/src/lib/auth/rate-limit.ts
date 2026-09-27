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

const buckets = new Map<string, Bucket>();

/**
 * Bukti bersama antar-instance tidak ada, tetapi peta tumbuh tanpa batas bila
 * penyerang memalsukan kunci. Pembersihan ini menyingkirkan HANYA entri yang
 * tidak berguna lagi.
 *
 * Versi sebelumnya adalah `if (buckets.size >= MAX_BUCKETS) buckets.clear()`, dan
 * itu bukan hanya tidak menyelesaikan masalah memori: ia menghapus SEMUA
 * penghitung untuk SEMUA pengguna. 5.000 kunci palsu dari satu penyerang sudah
 * cukup untuk membuat rate limit auth mati total, dan yang gagal dilindungi
 * adalah setiap orang yang sedang diserang, bukan penyerangnya.
 *
 * Dua tahap, berurutan:
 * 1. Entri yang jendelanya sudah lewat dibuang lebih dulu.
 * 2. Kalau peta masih penuh, entri **paling baru** yang dibuang, bukan yang
 *    tertua. Ini pilihan yang menentukan: saat penyerang membanjiri kunci
 *    palsu, kunci-kuncinya adalah yang paling baru, sedangkan penghitung korban
 *    sudah ada lebih lama. Membuang yang terbaru berarti banjir penyerang yang
 *    hilang, bukan penghitung orang yang sedang dilindungi. Membuang yang
 *    tertua (FIFO) terlihat lebih"netral" tetapi justru menjadi vektor yang
 *    lebih murah: 5.000 permintaan sudah cukup untuk menghapus satu penghitung
 *    tertentu yang sudah ada, bukan hanya membanjiri peta.
 *
 * Pembuangan dibatasi `EVICTION_BATCH` per panggilan supaya satu permintaan
 * tidak bisa menghapus ribuan entri sekaligus.
 */
const MAX_BUCKETS = 5_000;

/** Batas per jendela. */
const IP_LIMIT = 10;
const EMAIL_LIMIT = 5;

/** PRD Bab 8.2: `/api/booth/*` dibatasi 60 req/menit per fingerprint perangkat. */
const DEVICE_LIMIT = 60;

/** Jumlah entri yang dibuang per kali saat kuota kunci tercapai. */
const EVICTION_BATCH = 256;

function evictExpired(nowMs: number): void {
  if (buckets.size < MAX_BUCKETS) return;

  let removed = 0;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt > nowMs) continue;
    buckets.delete(key);
    removed += 1;
    if (removed >= EVICTION_BATCH) return;
  }

  if (buckets.size < MAX_BUCKETS) return;

  // `Map` mempertahankan urutan sisip, jadi iterasi dari belakang memberi entri
  // paling baru lebih dulu.
  const newestFirst = [...buckets.keys()].reverse();
  for (const key of newestFirst) {
    buckets.delete(key);
    removed += 1;
    if (removed >= EVICTION_BATCH) return;
  }
}

function consume(
  key: string,
  limit: number,
  nowMs: number,
): { allowed: boolean; retryAfter: number } {
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= nowMs) {
    evictExpired(nowMs);
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

/**
 * Kunci batas laju per fingerprint perangkat booth.
 *
 * Fingerprint di sini WAJIB berasal dari nilai yang tersimpan di `devices`, bukan
 * dari header permintaan. Kalau kuncinya berasal dari header, penyerang cukup
 * mengacak-acak header untuk mendapat jendela baru pada setiap permintaan, dan
 * batas per perangkat berubah jadi tidak ada batas sama sekali. Karena itu
 * fingerprint selalu diverifikasi bersama token perangkat lebih dulu
 * (`authenticateDevice`), dan yang diteruskan ke sini adalah nilai yang sudah
 * cocok dengan baris `devices`.
 */
export function boothDeviceRateLimitKey(scope: string, fingerprint: string): string {
  return `${scope}:device:${fingerprint}`;
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

/**
 * Memeriksa batas per fingerprint perangkat untuk `/api/booth/*`.
 *
 * Dipakai **bersama** dengan bucket per IP, bukan menggantikannya:
 * - Bucket per fingerprint menahan satu perangkat yang mengirim dari banyak IP.
 * - Bucket per IP menahan satu IP yang menampung banyak fingerprint berbeda.
 *
 * Menghapus yang per IP akan membuka penyerang yang memutar fingerprint;
 * menghapus yang per fingerprint akan membuat satu perangkat bisa iterating
 * sendiri. Keduanya harus ada.
 *
 * @param key Hasil `boothDeviceRateLimitKey`.
 * @param nowMs Waktu sekarang, dapat diganti untuk test.
 */
export function checkBoothDeviceRateLimit(
  key: string,
  nowMs: number = Date.now(),
): RateLimitResult {
  return consume(key, DEVICE_LIMIT, nowMs);
}

/** Mengosongkan seluruh jendela. Dipakai test, bukan runtime. */
export function resetAuthRateLimits(): void {
  buckets.clear();
}

/** Jumlah kunci yang sedang dilacak. Dipakai test untuk memeriksa eviction. */
export function trackedRateLimitKeys(): number {
  return buckets.size;
}
