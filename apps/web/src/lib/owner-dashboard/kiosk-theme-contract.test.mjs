import test from 'node:test';
import assert from 'node:assert/strict';

import {
  checkKioskContrast,
  contrastRatio,
  kioskThemeContrastErrors,
  kioskThemeDraftSchema,
  pickReadableText,
  summarizeVersion,
  validateAttractFile,
  validateLogoFile,
  KIOSK_BASE_COLORS,
  KIOSK_CONTRAST_MIN,
  KIOSK_DARK_TEXT,
  KIOSK_LIGHT_TEXT,
} from './kiosk-theme-contract.ts';

test('contrast ratio menghitung pasangan putih/hitam sebagai 21:1', () => {
  assert.equal(contrastRatio('#FFFFFF', '#000000'), 21);
  assert.equal(contrastRatio('#000000', '#FFFFFF'), 21);
  assert.equal(contrastRatio('bukan-warna', '#000000'), null);
});

test('pickReadableText selalu memilih teks dengan kontras terbaik', () => {
  assert.equal(pickReadableText('#FFFFFF'), KIOSK_DARK_TEXT);
  assert.equal(pickReadableText('#000000'), KIOSK_LIGHT_TEXT);
  assert.equal(pickReadableText(KIOSK_BASE_COLORS.primaryColor), KIOSK_LIGHT_TEXT);
  assert.equal(pickReadableText(KIOSK_BASE_COLORS.accentColor), KIOSK_LIGHT_TEXT);
});

test('palet dasar editor lulus ambang 4.5:1', () => {
  const report = checkKioskContrast(KIOSK_BASE_COLORS);
  assert.equal(report.ok, true);
  assert.equal(report.checks.length, 3);
  assert.ok(report.checks.every((check) => check.ratio >= KIOSK_CONTRAST_MIN));
  assert.deepEqual(kioskThemeContrastErrors({ ...valid(), ...KIOSK_BASE_COLORS }), {});
});

test('pasangan warna kontras rendah dilaporkan sebagai error field', () => {
  // Dua latar yang sangat dekat menghasilkan rasio di bawah 4,5:1 untuk kedua
  // pilihan teks, sehingga pasangan latar/teks utama tidak bisa diselamatkan.
  const fields = kioskThemeContrastErrors({
    ...valid(),
    primaryColor: '#808080',
    accentColor: '#7F7F7F',
    backgroundColor: '#818181',
  });
  assert.equal(typeof fields.primaryColor, 'string');
  assert.equal(typeof fields.accentColor, 'string');
  assert.equal(typeof fields.backgroundColor, 'string');
});

test('input schema menolak hex tidak valid, CTA kosong, dan font asing', () => {
  assert.equal(kioskThemeDraftSchema.safeParse(valid()).success, true);
  assert.equal(
    kioskThemeDraftSchema.safeParse({ ...valid(), primaryColor: 'FFDD00' }).success,
    false,
  );
  assert.equal(kioskThemeDraftSchema.safeParse({ ...valid(), ctaText: '   ' }).success, false);
  assert.equal(
    kioskThemeDraftSchema.safeParse({ ...valid(), ctaText: 'x'.repeat(121) }).success,
    false,
  );
  assert.equal(
    kioskThemeDraftSchema.safeParse({ ...valid(), fontFamily: 'Comic Sans' }).success,
    false,
  );
  assert.equal(
    kioskThemeDraftSchema.safeParse({ ...valid(), orientation: 'DIAGONAL' }).success,
    false,
  );
  assert.equal(
    kioskThemeDraftSchema.safeParse({ ...valid(), panelStyle: 'MODERN' }).success,
    false,
  );
  assert.equal(
    kioskThemeDraftSchema.safeParse({ ...valid(), attractVideoUrl: 'not-a-url' }).success,
    false,
  );
});

test('validasi berkas upload menegakkan MIME dan batas ukuran PRD', () => {
  assert.equal(validateLogoFile({ mimeType: 'image/png', size: 500 * 1024 }), null);
  assert.equal(
    validateLogoFile({ mimeType: 'image/png', size: 500 * 1024 + 1 }),
    'Ukuran logo maksimum 500 KB.',
  );
  assert.equal(
    validateLogoFile({ mimeType: 'video/mp4', size: 1000 }),
    'Logo harus berupa PNG atau JPG.',
  );
  assert.equal(
    validateAttractFile({ mode: 'VIDEO', mimeType: 'video/mp4', size: 50 * 1024 * 1024 }),
    null,
  );
  assert.equal(
    validateAttractFile({ mode: 'VIDEO', mimeType: 'video/mp4', size: 50 * 1024 * 1024 + 1 }),
    'Ukuran video maksimum 50 MB.',
  );
  assert.equal(
    validateAttractFile({ mode: 'IMAGE', mimeType: 'image/png', size: 5 * 1024 * 1024 + 1 }),
    'Ukuran gambar maksimum 5 MB.',
  );
  assert.equal(validateAttractFile({ mode: 'SLIDESHOW', mimeType: 'image/png', size: 1 }), null);
});

test('summarizeVersion aman untuk snapshot rusak dan kosong', () => {
  assert.deepEqual(summarizeVersion(null), { panelStyle: 'CLASSIC', orientation: 'LANDSCAPE' });
  assert.deepEqual(summarizeVersion({ panelStyle: 'RECEIPT', orientation: 'PORTRAIT' }), {
    panelStyle: 'RECEIPT',
    orientation: 'PORTRAIT',
  });
  assert.deepEqual(summarizeVersion({ panelStyle: 'UNKNOWN' }), {
    panelStyle: 'CLASSIC',
    orientation: 'LANDSCAPE',
  });
});

function valid() {
  return {
    logoUrl: null,
    ...KIOSK_BASE_COLORS,
    fontFamily: 'Space Grotesk',
    welcomeText: null,
    ctaText: 'SENTUH UNTUK MULAI',
    attractModeType: 'VIDEO',
    attractVideoUrl: null,
    attractSlideshowEnabled: true,
    panelStyle: 'CLASSIC',
    orientation: 'LANDSCAPE',
  };
}
