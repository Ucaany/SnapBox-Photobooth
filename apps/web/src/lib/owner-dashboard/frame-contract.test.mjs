import test from 'node:test';
import assert from 'node:assert/strict';

import {
  frameQuotaReached,
  retainLatestFrameVersions,
  validateFrameFileMetadata,
} from './frame-contract.ts';

test('frame uploads enforce MIME, 5 MB, and minimum dimensions', () => {
  assert.equal(
    validateFrameFileMetadata({ mimeType: 'image/png', size: 1, width: 800, height: 600 }),
    null,
  );
  assert.equal(
    validateFrameFileMetadata({ mimeType: 'image/webp', size: 1, width: 800, height: 600 }),
    'Gunakan gambar PNG atau JPG.',
  );
  assert.notEqual(
    validateFrameFileMetadata({
      mimeType: 'image/jpeg',
      size: 5 * 1024 * 1024 + 1,
      width: 800,
      height: 600,
    }),
    null,
  );
  assert.notEqual(
    validateFrameFileMetadata({ mimeType: 'image/png', size: 1, width: 799, height: 600 }),
    null,
  );
});

test('frame quota fails closed and unlimited quota stays available', () => {
  assert.equal(frameQuotaReached(0, null), true);
  assert.equal(frameQuotaReached(3, 3), true);
  assert.equal(frameQuotaReached(20, -1), false);
});

test('frame versions retain the newest five', () => {
  assert.deepEqual(retainLatestFrameVersions([6, 5, 4, 3, 2, 1]), [6, 5, 4, 3, 2]);
});
