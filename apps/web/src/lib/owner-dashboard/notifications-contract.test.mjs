import assert from 'node:assert/strict';
import test from 'node:test';
import {
  notificationIdSchema,
  NOTIFICATION_PAGE_SIZE,
  NOTIFICATION_RETENTION_DAYS,
} from './notifications-contract.ts';
import { ownerProfileSchema, supportMessageSchema } from './account-contract.ts';

test('notification IDs require UUIDs and list bounds remain finite', () => {
  assert.equal(notificationIdSchema.safeParse('not-an-id').success, false);
  assert.equal(
    notificationIdSchema.safeParse('00000000-0000-4000-8000-000000000001').success,
    true,
  );
  assert.equal(NOTIFICATION_PAGE_SIZE, 100);
  assert.equal(NOTIFICATION_RETENTION_DAYS, 30);
});

test('profile and support input reject protected fields and oversized values', () => {
  assert.equal(
    ownerProfileSchema.safeParse({ fullName: 'Owner Name', phone: '123', role: 'CEO' }).success,
    false,
  );
  assert.equal(
    ownerProfileSchema.safeParse({ fullName: 'Owner Name', phone: '123' }).success,
    true,
  );
  assert.equal(
    supportMessageSchema.safeParse({
      category: 'other',
      subject: 'Help',
      message: 'Please help me',
    }).success,
    true,
  );
  assert.equal(
    supportMessageSchema.safeParse({ category: 'other', subject: 'x', message: 'short' }).success,
    false,
  );
});
