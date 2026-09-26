import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveDeviceStatus, maskDeviceFingerprint } from './device-contract.ts';

test('fingerprint dimasking tidak mengembalikan nilai penuh', () => {
  assert.equal(maskDeviceFingerprint('device-fingerprint-1234'), 'devi…1234');
  assert.equal(maskDeviceFingerprint('short'), '••••');
});

test('status device mengikuti heartbeat 90 detik dan maintenance', () => {
  const now = Date.parse('2026-09-26T12:00:00.000Z');
  assert.equal(deriveDeviceStatus('ONLINE', false, '2026-09-26T11:59:00.000Z', now), 'ONLINE');
  assert.equal(deriveDeviceStatus('ONLINE', false, '2026-09-26T11:58:00.000Z', now), 'OFFLINE');
  assert.equal(deriveDeviceStatus('ONLINE', true, '2026-09-26T11:59:00.000Z', now), 'OFFLINE');
});
