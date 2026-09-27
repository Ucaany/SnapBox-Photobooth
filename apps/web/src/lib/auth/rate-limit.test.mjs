/**
 * Batas laju (P-B-34, P-B-36).
 *
 * Menjalankan modul produksi `rate-limit.ts` — bug "5000 kunci menghapus semua
 * penghitung" hanya terlihat kalau peta benar-benar dipakai, bukan kalau bentuk
 * kodenya dibaca.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const {
  authEmailRateLimitKey,
  authRateLimitKey,
  boothDeviceRateLimitKey,
  checkAuthEmailRateLimit,
  checkAuthRateLimit,
  checkBoothDeviceRateLimit,
  resetAuthRateLimits,
  trackedRateLimitKeys,
} = await import('./rate-limit.ts');

const request = (ip) =>
  new globalThis.Request('https://app.snapbox.id/api/booth/heartbeat', {
    method: 'POST',
    headers: ip ? { 'x-forwarded-for': ip } : {},
  });

test.beforeEach(() => resetAuthRateLimits());

test('bucket per IP membatasi 10 permintaan per menit', () => {
  const key = authRateLimitKey(request('10.0.0.1'), 'booth-heartbeat');
  for (let i = 0; i < 10; i += 1) {
    assert.equal(checkAuthRateLimit(key, 1_000_000).allowed, true, `permintaan ${i + 1}`);
  }
  const blocked = checkAuthRateLimit(key, 1_000_000);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfter > 0);

  // Jendela baru mengizinkan lagi.
  assert.equal(checkAuthRateLimit(key, 1_000_000 + 60_001).allowed, true);
});

test('bucket per fingerprint membatasi 60 permintaan, terpisah dari IP', () => {
  const ipKey = authRateLimitKey(request('10.0.0.2'), 'booth-heartbeat');
  const fpKey = boothDeviceRateLimitKey('booth-heartbeat', 'device-alpha');

  // Satu perangkat di satu IP: 60 ok pada bucket fingerprint.
  for (let i = 0; i < 60; i += 1) {
    assert.equal(checkBoothDeviceRateLimit(fpKey, 1_000_000).allowed, true, `permintaan ${i + 1}`);
  }
  assert.equal(checkBoothDeviceRateLimit(fpKey, 1_000_000).allowed, false);

  // Fingerprint berbeda di IP yang sama punya jatah sendiri.
  const other = boothDeviceRateLimitKey('booth-heartbeat', 'device-beta');
  assert.equal(checkBoothDeviceRateLimit(other, 1_000_000).allowed, true);

  // Dan bucket per IP masih terpisah dan belum tersentuh oleh bucket fingerprint.
  assert.equal(checkAuthRateLimit(ipKey, 1_000_000).allowed, true);
  assert.equal(checkAuthRateLimit(ipKey, 1_000_000).allowed, true);
});

test('dua dimensi dibedakan: IP sama + fingerprint sama vs fingerprint beda', () => {
  const ip = request('10.0.0.3');
  const a = boothDeviceRateLimitKey('booth-heartbeat', 'fp-a');
  const b = boothDeviceRateLimitKey('booth-heartbeat', 'fp-b');

  for (let i = 0; i < 60; i += 1) checkBoothDeviceRateLimit(a, 1_000_000);
  assert.equal(
    checkBoothDeviceRateLimit(a, 1_000_000).allowed,
    false,
    'per fingerprint harus kena',
  );
  assert.equal(
    checkBoothDeviceRateLimit(b, 1_000_000).allowed,
    true,
    'fingerprint lain tidak ikut kena',
  );
  assert.equal(
    checkAuthRateLimit(authRateLimitKey(ip, 'booth-heartbeat'), 1_000_000).allowed,
    true,
  );
});

test('bucket per email dibatasi 5 dan dinormalkan huruf kecil', () => {
  const lower = authEmailRateLimitKey('staff-pin', 'Staff@Example.com');
  const upper = authEmailRateLimitKey('staff-pin', 'staff@example.COM');
  assert.equal(lower, upper, 'kapitalisasi tidak boleh membuka jendela baru');

  for (let i = 0; i < 5; i += 1) {
    assert.equal(checkAuthEmailRateLimit(lower, 1_000_000).allowed, true);
  }
  assert.equal(checkAuthEmailRateLimit(lower, 1_000_000).allowed, false);
});

test('5.000 kunci palsu tidak menghapus penghitung orang lain', () => {
  // Satu pihak yang sah sudah memakai 10 dari 10 jatahnya.
  const victim = authRateLimitKey(request('10.0.0.4'), 'session');
  for (let i = 0; i < 10; i += 1) checkAuthRateLimit(victim, 1_000_000);
  assert.equal(checkAuthRateLimit(victim, 1_000_000).allowed, false, 'jatah korban sudah habis');

  // Penyerang membanjiri 6.000 kunci palsu.
  for (let i = 0; i < 6_000; i += 1) {
    checkAuthRateLimit(
      authRateLimitKey(request(`10.1.${i >> 8}.${i & 0xff}`), 'session'),
      1_000_000,
    );
  }

  // Penghitung korban HARUS masih ada. Versi lama (`buckets.clear()`) menghapus
  // semuanya di sini dan membuat rate limit auth mati total.
  assert.equal(
    checkAuthRateLimit(victim, 1_000_000).allowed,
    false,
    'penghitung korban terhapus — keys.clear() masih ada di suatu tempat',
  );

  // Peta tidak tumbuh tanpa batas.
  assert.ok(trackedRateLimitKeys() <= 5_000 + 300, `kunci tertrackir: ${trackedRateLimitKeys()}`);
});

test('entri kedaluwarsa dibuang lebih dulu sebelum entri hidup', () => {
  // Isi peta sampai penuh dengan entri yang sudah kedaluwarsa.
  for (let i = 0; i < 5_000; i += 1) {
    checkAuthRateLimit(`scope:ip:10.2.${i >> 8}.${i & 0xff}`, 0);
  }
  assert.equal(trackedRateLimitKeys(), 5_000);

  // Satu permintaan baru pada waktu yang jauh kemudian: entri lama sudah
  // kedaluwarsa, jadi tidak perlu mengorbankan entri yang masih hidup.
  const survivor = authRateLimitKey(request('10.3.0.1'), 'session');
  for (let i = 0; i < 10; i += 1) {
    assert.equal(checkAuthRateLimit(survivor, 1_000_000_000).allowed, true, `permintaan ${i + 1}`);
  }
  assert.equal(checkAuthRateLimit(survivor, 1_000_000_000).allowed, false, 'entri baru harus utuh');
  assert.ok(
    trackedRateLimitKeys() < 5_000,
    `entri kedaluwarsa seharusnya dibuang, tersisa ${trackedRateLimitKeys()}`,
  );
});
