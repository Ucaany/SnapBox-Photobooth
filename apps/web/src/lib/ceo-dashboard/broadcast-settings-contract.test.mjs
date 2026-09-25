import assert from 'node:assert/strict';
import test from 'node:test';

const UUID = '4f1c2a4e-0000-4000-8000-000000000000';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const placeholders = {
  tenant_invite: ['tenantName', 'ownerName', 'inviteUrl'],
  invoice_b2b: ['tenantName', 'invoiceNumber', 'invoiceAmount', 'dueDate'],
  subscription_expiring: ['tenantName', 'planName', 'expiresAt'],
};
function validBroadcast(input) {
  return (
    typeof input.title === 'string' &&
    input.title.trim().length > 0 &&
    input.title.trim().length <= 200 &&
    typeof input.message === 'string' &&
    input.message.trim().length >= 12 &&
    input.message.trim().length <= 280 &&
    (input.targetAll === true
      ? !('tenantIds' in input)
      : input.targetAll === false &&
        input.tenantIds?.length > 0 &&
        input.tenantIds.every((id) => uuid.test(id)))
  );
}
function templateErrors(name, text) {
  const found = [...text.matchAll(/\{\{\s*([A-Za-z][A-Za-z0-9]*)\s*\}\}/g)].map((m) => m[1]);
  const errors = found.filter((key) => !placeholders[name].includes(key));
  if (/[{}]/.test(text.replace(/\{\{\s*[A-Za-z][A-Za-z0-9]*\s*\}\}/g, '')))
    errors.push('malformed');
  return [...new Set(errors)];
}
function escape(text) {
  return text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}
function redact(key, value) {
  return /(secret|token|password|api[_-]?key|credential)/i.test(key) ? '[redacted]' : value;
}

test('broadcast target and bounds fail closed', () => {
  assert.equal(
    validBroadcast({ title: 'T', message: 'Pesan broadcast valid', targetAll: true }),
    true,
  );
  assert.equal(
    validBroadcast({
      title: 'T',
      message: 'Pesan broadcast valid',
      targetAll: false,
      tenantIds: [UUID],
    }),
    true,
  );
  assert.equal(
    validBroadcast({
      title: 'T',
      message: 'Pesan broadcast valid',
      targetAll: true,
      tenantIds: [UUID],
    }),
    false,
  );
  assert.equal(
    validBroadcast({ title: 'T', message: 'short', targetAll: false, tenantIds: ['tenant-1'] }),
    false,
  );
});
test('placeholder allowlists and malformed syntax reject', () => {
  assert.deepEqual(templateErrors('tenant_invite', '{{tenantName}} {{unknown}}'), ['unknown']);
  assert.deepEqual(templateErrors('tenant_invite', '{tenantName}'), ['malformed']);
  assert.deepEqual(templateErrors('tenant_invite', '{{tenantName}}'), []);
});
test('preview escapes untrusted replacement and redacts sensitive values', () => {
  assert.equal(escape('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(redact('apiKey', 'secret'), '[redacted]');
  assert.equal(redact('tenantName', 'Studio'), 'Studio');
});
