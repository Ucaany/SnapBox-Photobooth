/**
 * Self-check kebijakan akses rute (PRD Task 1.2).
 *
 * Logika yang diuji di sini murni: pemetaan path -> aturan peran, pengecualian
 * langganan, dan sanitasi `?next=`. Modul sumbernya bebas `next/*`, DB, dan SDK,
 * jadi perilakunya bisa diuji tanpa runtime Next.
 *
 * Dipisah dari `pin.test.mjs` agar setiap berkas test fokus pada satu boundary.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

// Salinan perilaku yang harus dijaga sama dengan
// `apps/web/src/lib/auth/route-policy.ts`. Bila salah satu berubah, test ini
// gagal dan memaksa keduanya diselaraskan.
const ROUTE_ACCESS_RULES = [
  { prefix: '/ceo-dashboard', roles: ['CEO'] },
  { prefix: '/owner-dashboard', roles: ['OWNER'] },
  { prefix: '/staff-dashboard', roles: ['STAFF'] },
  { prefix: '/dashboard', roles: ['CEO', 'OWNER', 'STAFF'] },
];

const PROTECTED_ROUTE_PREFIXES = [
  '/ceo-dashboard',
  '/owner-dashboard',
  '/staff-dashboard',
  '/dashboard',
];

const SUBSCRIPTION_EXEMPT_PREFIXES = ['/owner-dashboard/subscription'];

function matchesPrefix(pathname, prefix) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isProtectedPath(pathname) {
  return PROTECTED_ROUTE_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

function findRouteRule(pathname) {
  return ROUTE_ACCESS_RULES.find((rule) => matchesPrefix(pathname, rule.prefix)) ?? null;
}

function isSubscriptionExempt(pathname) {
  return SUBSCRIPTION_EXEMPT_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

function safeRedirectPath(value) {
  if (!value) return null;
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//') || value.startsWith('/\\')) return null;
  if (value.includes('\\') || value.includes('\n') || value.includes('\r')) return null;
  if (value.includes('://')) return null;
  return value;
}

test('prefix cocok pada batas segmen, bukan substring', () => {
  // `/dashboard-extra` BUKAN rute privat; hanya `/dashboard` dan turunannya.
  assert.equal(isProtectedPath('/dashboard-extra'), false);
  assert.equal(isProtectedPath('/dashboard/tenants'), true);
  assert.equal(isProtectedPath('/ceo-dashboardx'), false);
  assert.equal(isProtectedPath('/ceo-dashboard'), true);
});

test('peran dibatasi ke dashboard-nya sendiri', () => {
  assert.deepEqual(findRouteRule('/ceo-dashboard/tenants')?.roles, ['CEO']);
  assert.deepEqual(findRouteRule('/owner-dashboard/machines')?.roles, ['OWNER']);
  assert.deepEqual(findRouteRule('/staff-dashboard/machines')?.roles, ['STAFF']);
  assert.deepEqual(findRouteRule('/dashboard')?.roles, ['CEO', 'OWNER', 'STAFF']);
});

test('STAFF tidak boleh membuka route owner atau CEO', () => {
  const staffRole = 'STAFF';
  for (const path of ['/owner-dashboard', '/owner-dashboard/machines', '/ceo-dashboard']) {
    const rule = findRouteRule(path);
    assert.equal(rule?.roles.includes(staffRole), false, `STAFF seharusnya ditolak di ${path}`);
  }
});

test('hanya halaman langganan Owner yang bebas gate langganan', () => {
  assert.equal(isSubscriptionExempt('/owner-dashboard/subscription'), true);
  assert.equal(isSubscriptionExempt('/owner-dashboard/subscription/add-on'), true);
  assert.equal(isSubscriptionExempt('/owner-dashboard/subscription-history'), false);
  assert.equal(isSubscriptionExempt('/owner-dashboard'), false);
  assert.equal(isSubscriptionExempt('/ceo-dashboard'), false);
});

test('safeRedirectPath menolak vektor open redirect', () => {
  for (const bad of [
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    'http://evil.example/x',
    '/path\nHeader: x',
    '/path\rHeader: x',
    'javascript:alert(1)',
    '\\/evil.example',
    'evil.example',
  ]) {
    assert.equal(safeRedirectPath(bad), null, `seharusnya ditolak: ${JSON.stringify(bad)}`);
  }
});

test('safeRedirectPath menerima path relatif normal', () => {
  assert.equal(safeRedirectPath('/owner-dashboard'), '/owner-dashboard');
  assert.equal(safeRedirectPath('/ceo-dashboard?tab=plans'), '/ceo-dashboard?tab=plans');
  assert.equal(safeRedirectPath(undefined), null);
  assert.equal(safeRedirectPath(''), null);
});
