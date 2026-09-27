/**
 * Self-check pemeriksaan same-origin (P-B-11, BE-009).
 *
 * Menjalankan modul produksi `same-origin.ts`, karena yang diuji adalah perilaku
 * parsing header — bukan bentuk teks di route.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { isSameOrigin } from './same-origin.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relative) => fs.readFileSync(path.join(here, relative), 'utf8');

const request = (url, headers = {}) => new globalThis.Request(url, { method: 'POST', headers });

test('origin sendiri diterima, origin lain ditolak', () => {
  const url = 'https://app.snapbox.id/api/auth/session';

  assert.equal(isSameOrigin(request(url, { origin: 'https://app.snapbox.id' })), true);
  assert.equal(isSameOrigin(request(url, { origin: 'https://evil.example' })), false);
  assert.equal(
    isSameOrigin(request(url, { origin: 'http://app.snapbox.id' })),
    false,
    'skema beda',
  );
  assert.equal(
    isSameOrigin(request(url, { origin: 'https://app.snapbox.id:8443' })),
    false,
    'port beda',
  );
  // Host yang meniru lewat subdomain harus tetap ditolak:
  assert.equal(
    isSameOrigin(request(url, { origin: 'https://app.snapbox.id.evil.example' })),
    false,
  );
});

test('tanpa Origin diizinkan (klien non-browser), Origin rusak ditolak', () => {
  const url = 'https://app.snapbox.id/api/auth/session';

  assert.equal(isSameOrigin(request(url)), true, 'curl/test tidak mengirim Origin');
  assert.equal(isSameOrigin(request(url, { origin: '' })), true, 'header kosong = tidak ada');
  assert.equal(
    isSameOrigin(request(url, { origin: 'null' })),
    false,
    'origin null tidak boleh lolos',
  );
  assert.equal(isSameOrigin(request(url, { origin: 'not a url' })), false);
});

test('kedua route penerbit cookie memanggil helper yang sama', () => {
  const session = read('../../app/api/auth/session/route.ts');
  const staffPin = read('../../app/api/auth/staff-pin/route.ts');

  // Helper hanya boleh hidup di satu tempat; definisi lokal adalah bug yang
  // membuat kedua route tidak bisa berbagi perbaikan.
  for (const [name, source] of [
    ['session', session],
    ['staff-pin', staffPin],
  ]) {
    assert.doesNotMatch(source, /function isSameOrigin/, `${name} mendefinisikan helper sendiri`);
    assert.match(source, /import \{ isSameOrigin \} from '@\/lib\/auth\/same-origin';/, name);
  }

  // staff-pin: cek harus mendahului rate limit dan perbandingan PIN.
  const gate = staffPin.indexOf('if (!isSameOrigin(request))');
  assert.notEqual(gate, -1, 'staff-pin tidak memeriksa same-origin');
  assert.ok(
    gate < staffPin.indexOf('const ipLimit = checkAuthRateLimit('),
    'cek harus sebelum rate limit',
  );
  assert.ok(
    gate < staffPin.indexOf('await tenantHasMatchingOperatorPin('),
    'cek harus sebelum PIN',
  );

  // session: POST dan DELETE dua-duanya.
  assert.ok(
    session.indexOf('if (!isSameOrigin(request))') <
      session.indexOf('await buildSessionFromIdToken('),
  );
  assert.match(
    session,
    /export async function DELETE\(request: Request\) \{\n {2}if \(!isSameOrigin\(request\)\)/,
  );
});
