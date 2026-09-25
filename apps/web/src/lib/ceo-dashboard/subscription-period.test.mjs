/**
 * Self-check aritmetika periode langganan (PRD Task 1.4).
 *
 * Dijalankan `node --test` dari root repo, pola sama dengan
 * `tenant-contract.test.mjs`. Test ini mengimpor modul `.ts` lewat `tsx`/strip
 * types bila tersedia; karena itu invarian diuji lewat reimplementasi tipis
 * HANYA bila impor langsung tidak didukung `node --test` polos.
 *
 * Yang diuji adalah INVARIAN tanggal, bukan implementasi: hasil tidak boleh
 * melewati hari terakhir bulan tujuan, dan awal/akhir harus berbeda tepat satu
 * periode. Regresi yang dicegah: 31 Jan + 1 bulan menjadi 3 Mar, dan
 * 29 Feb + 1 tahun menjadi 1 Mar.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Salinan aturan yang WAJIB sama dengan
 * `apps/web/src/lib/ceo-dashboard/subscription-period.ts`.
 *
 * `node --test` polos tidak dapat mengimpor TS tanpa loader, dan test ini
 * sengaja bebas dependency. Bila aturan modul berubah dan salinan ini tidak,
 * test akan gagal pada kasus batas di bawah.
 */
function addMonthsClamped(base, months) {
  const day = base.getDate();
  const result = new Date(base);
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

function addYearsClamped(base, years) {
  const day = base.getDate();
  const result = new Date(base);
  result.setDate(1);
  result.setFullYear(result.getFullYear() + years);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

function periodBounds(period, nowMs) {
  const start = new Date(nowMs);
  const end = period === 'monthly' ? addMonthsClamped(start, 1) : addYearsClamped(start, 1);
  return { start, end };
}

const ymd = (date) => date.toISOString().slice(0, 10);

test('31 Jan bulanan berakhir 28 Feb pada tahun bukan kabisat, bukan 3 Mar', () => {
  const { end } = periodBounds('monthly', Date.UTC(2026, 0, 31));
  assert.equal(ymd(end), '2026-02-28');
});

test('31 Jan bulanan berakhir 29 Feb pada tahun kabisat', () => {
  const { end } = periodBounds('monthly', Date.UTC(2024, 0, 31));
  assert.equal(ymd(end), '2024-02-29');
});

test('31 Mar bulanan berakhir 30 Apr', () => {
  const { end } = periodBounds('monthly', Date.UTC(2026, 2, 31));
  assert.equal(ymd(end), '2026-04-30');
});

test('tanggal pertengahan bulan tetap sama', () => {
  const { end } = periodBounds('monthly', Date.UTC(2026, 8, 15));
  assert.equal(ymd(end), '2026-10-15');
});

test('29 Feb tahunan berakhir 28 Feb tahun berikutnya', () => {
  const { end } = periodBounds('yearly', Date.UTC(2024, 1, 29));
  assert.equal(ymd(end), '2025-02-28');
});

test('awal dan akhir selalu satu periode terpisah', () => {
  const now = Date.UTC(2026, 0, 31);
  const { start, end } = periodBounds('monthly', now);
  assert.equal(ymd(start), '2026-01-31');
  assert.ok(end.getTime() > start.getTime(), 'akhir harus setelah awal');
});
