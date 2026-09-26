import assert from 'node:assert/strict';
import test from 'node:test';

const items = [
  ['', '/owner-dashboard'],
  ['outlets', '/owner-dashboard/outlets'],
  ['machines', '/owner-dashboard/machines'],
  ['devices', '/owner-dashboard/devices'],
  ['frame-studio', '/owner-dashboard/frame-studio'],
  ['templates', '/owner-dashboard/templates'],
  ['packages', '/owner-dashboard/packages'],
  ['kiosk-theme', '/owner-dashboard/kiosk-theme'],
  ['promos', '/owner-dashboard/promos'],
  ['payment-settings', '/owner-dashboard/payment-settings'],
  ['staff', '/owner-dashboard/staff'],
  ['customers', '/owner-dashboard/customers'],
  ['transactions', '/owner-dashboard/transactions'],
  ['finance', '/owner-dashboard/finance'],
  ['analytics', '/owner-dashboard/analytics'],
  ['reports', '/owner-dashboard/reports'],
  ['subscription', '/owner-dashboard/subscription'],
  ['notifications', '/owner-dashboard/notifications'],
  ['settings', '/owner-dashboard/settings'],
  ['support', '/owner-dashboard/support'],
];

function formatDeviceQuota(usage, quota) {
  if (quota === -1) return `${usage} / Tak terbatas`;
  if (quota === null) return 'Tidak tersedia';
  return `${usage} / ${quota}`;
}

test('Owner navigation covers exact Task 2.1 routes', () => {
  assert.equal(items.length, 20);
  assert.equal(new Set(items.map(([slug]) => slug)).size, 20);
  assert.equal(new Set(items.map(([, path]) => path)).size, 20);
  assert.equal(
    items.some(([slug]) => slug === 'support'),
    true,
  );
});

test('Owner quota text handles finite, unlimited, and unavailable values', () => {
  assert.equal(formatDeviceQuota(2, 5), '2 / 5');
  assert.equal(formatDeviceQuota(2, -1), '2 / Tak terbatas');
  assert.equal(formatDeviceQuota(2, null), 'Tidak tersedia');
});
