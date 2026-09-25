/**
 * Aritmetika periode langganan (PRD Task 1.4).
 *
 * Dipisah dari server action supaya bisa diuji `node --test` tanpa menyentuh
 * DB, Firebase, atau `next/cache`. Bug asli yang memotivasi modul ini: `Date`
 * JavaScript menggeser hari yang meluap, sehingga 31 Jan + 1 bulan menjadi
 * 3 Mar dan tenant menerima sekitar satu bulan ekstra.
 *
 * Modul ini bebas `next/*`, DB, dan SDK apa pun.
 */

/**
 * Tambah bulan dengan penguncian ke hari terakhir bulan tujuan.
 *
 * `setDate(1)` lebih dulu mencegah luapan, lalu hari asal dipulihkan dan
 * dibatasi bila bulan tujuan lebih pendek.
 */
export function addMonthsClamped(base: Date, months: number): Date {
  const day = base.getDate();
  const result = new Date(base);
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

/**
 * Tambah tahun dengan penguncian ke hari terakhir bulan tujuan.
 *
 * 29 Feb + 1 tahun menjadi 28 Feb pada tahun bukan kabisat, bukan 1 Mar.
 */
export function addYearsClamped(base: Date, years: number): Date {
  const day = base.getDate();
  const result = new Date(base);
  result.setDate(1);
  result.setFullYear(result.getFullYear() + years);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

/**
 * Batas periode langganan.
 *
 * Pemanggil WAJIB sudah memastikan plan punya harga tahunan sebelum meminta
 * `'yearly'`, supaya nilai nominal dan `end` selalu berasal dari sumber yang
 * sama dan tidak ada periode 12 bulan dengan harga 1 bulan.
 */
export function periodBounds(
  period: 'monthly' | 'yearly',
  nowMs: number,
): { start: Date; end: Date } {
  const start = new Date(nowMs);
  const end = period === 'monthly' ? addMonthsClamped(start, 1) : addYearsClamped(start, 1);
  return { start, end };
}
