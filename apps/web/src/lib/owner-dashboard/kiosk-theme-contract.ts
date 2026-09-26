/**
 * Kontrak Kiosk Theme Customizer (PRD Task 2.8, Bab 6.T).
 *
 * Batas kepercayaan modul tema: schema Zod, preset warna/font, validasi kontras
 * WCAG, validasi berkas upload, tipe serializable, dan kode error aman. Modul ini
 * sengaja tidak mengimpor `@snapbox/db`/`next/*` supaya bisa dipakai server action,
 * komponen klien, dan test Node.
 *
 * Aturan yang mengikat:
 * - `tenantId` TIDAK PERNAH datang dari klien; selalu dari sesi.
 * - Editor Task 2.8 hanya mengelola satu tema default tenant (`boothId = null`).
 * - Kontras teks/latar divalidasi server-side pada ambang 4.5:1 (teks normal).
 * - PIN Lock TIDAK disimpan di tema; ia milik `booths` (lihat halaman Machines).
 */
import { z } from 'zod';

export const themeIdSchema = z.string().uuid();
export const KIOSK_CONTRAST_MIN = 4.5;
export const KIOSK_WELCOME_MAX = 300;
export const KIOSK_CTA_MAX = 120;
export const KIOSK_VERSION_LIMIT = 5;
export const KIOSK_LOGO_MAX_BYTES = 500 * 1024;
export const KIOSK_ATTRACT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const KIOSK_ATTRACT_VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const KIOSK_IMAGE_MIME = ['image/png', 'image/jpeg'] as const;
export const KIOSK_VIDEO_MIME = ['video/mp4', 'video/webm'] as const;

export const PANEL_STYLES = ['CLASSIC', 'CARD', 'RECEIPT'] as const;
export const ORIENTATIONS = ['LANDSCAPE', 'PORTRAIT'] as const;
export const ATTRACT_MODE_TYPES = ['VIDEO', 'IMAGE', 'SLIDESHOW'] as const;

/** Lima preset font kiosk (PRD Bab 6.T), memakai font sistem/umum agar kiosk offline. */
export const KIOSK_FONTS = [
  {
    value: 'Space Grotesk',
    label: 'Space Grotesk',
    stack: '"Space Grotesk", "Segoe UI", sans-serif',
  },
  { value: 'Inter', label: 'Inter', stack: 'Inter, "Segoe UI", sans-serif' },
  { value: 'Poppins', label: 'Poppins', stack: 'Poppins, "Trebuchet MS", sans-serif' },
  {
    value: 'Playfair Display',
    label: 'Playfair Display',
    stack: '"Playfair Display", Georgia, serif',
  },
  {
    value: 'JetBrains Mono',
    label: 'JetBrains Mono',
    stack: '"JetBrains Mono", "Courier New", monospace',
  },
] as const;

export const KIOSK_PANEL_LABELS: Record<(typeof PANEL_STYLES)[number], string> = {
  CLASSIC: 'Classic',
  CARD: 'Card',
  RECEIPT: 'Receipt',
};

export const KIOSK_ORIENTATION_LABELS: Record<(typeof ORIENTATIONS)[number], string> = {
  LANDSCAPE: 'Landscape',
  PORTRAIT: 'Portrait',
};

export const KIOSK_ATTRACT_LABELS: Record<(typeof ATTRACT_MODE_TYPES)[number], string> = {
  VIDEO: 'Video',
  IMAGE: 'Gambar',
  SLIDESHOW: 'Slideshow',
};

/**
 * Palet awal editor. Merah primary #D40000 dipilih karena tombol CTA berteks
 * latar terang lolos 4.5:1, sementara kuning brand SnapBox tetap tersedia di
 * picker untuk dipakai dengan teks gelap. Karena `onPrimaryColor`/`onAccentColor`
 * tidak punya kolom di `kiosk_themes`, warna teks diturunkan, bukan disimpan:
 * kontras diverifikasi terhadap `DARK_TEXT` dan `LIGHT_TEXT`.
 */
export const KIOSK_BASE_COLORS = {
  primaryColor: '#D40000',
  accentColor: '#4C1D95',
  backgroundColor: '#FFFEF5',
} as const;

/** Warna teks diturunkan agar kontras terjamin tanpa kolom tambahan. */
export const KIOSK_LIGHT_TEXT = '#FFFFFF';
export const KIOSK_DARK_TEXT = '#1A1A1A';

/** Kembalikan warna teks dengan kontras tebaik terhadap latar yang diberikan. */
export function pickReadableText(background: string): string {
  const light = contrastRatio(KIOSK_LIGHT_TEXT, background) ?? 0;
  const dark = contrastRatio(KIOSK_DARK_TEXT, background) ?? 0;
  return light >= dark ? KIOSK_LIGHT_TEXT : KIOSK_DARK_TEXT;
}

/** Hex 6 digit; format 8 digit tidak didukung agar kontras dapat dihitung pasti. */
export const kioskHexSchema = z
  .string()
  .trim()
  .regex(/^#[\da-fA-F]{6}$/, 'Gunakan warna hex 6 digit, mis. #FFDD00.');

const optionalText = (max: number) =>
  z.preprocess((value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }, z.string().max(max).nullable().optional());

const optionalUrl = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  },
  z.union([z.url().max(2048), z.null()]).optional(),
);

export const kioskThemeDraftSchema = z.object({
  logoUrl: optionalUrl,
  primaryColor: kioskHexSchema,
  accentColor: kioskHexSchema,
  backgroundColor: kioskHexSchema,
  fontFamily: z.enum(KIOSK_FONTS.map((font) => font.value) as [string, ...string[]]),
  welcomeText: optionalText(KIOSK_WELCOME_MAX),
  ctaText: z.string().trim().min(1, 'Teks CTA wajib diisi.').max(KIOSK_CTA_MAX),
  attractModeType: z.enum(ATTRACT_MODE_TYPES),
  attractVideoUrl: optionalUrl,
  attractSlideshowEnabled: z.boolean().default(true),
  panelStyle: z.enum(PANEL_STYLES),
  orientation: z.enum(ORIENTATIONS),
});
export type KioskThemeDraft = z.infer<typeof kioskThemeDraftSchema>;
export type KioskThemeInput = KioskThemeDraft;

export type KioskThemeRecord = KioskThemeDraft & {
  id: string;
  version: number;
  isPublished: boolean;
  updatedAt: string;
};

export type KioskThemeVersion = {
  id: string;
  version: number;
  createdAt: string;
  panelStyle: (typeof PANEL_STYLES)[number];
  orientation: (typeof ORIENTATIONS)[number];
};

export type KioskThemesData = {
  theme: KioskThemeRecord;
  versions: KioskThemeVersion[];
};

export type KioskThemeActionResult =
  | { ok: true; message: string }
  | {
      ok: false;
      code: 'INVALID_INPUT' | 'UNAUTHORIZED' | 'NOT_FOUND' | 'SERVER_ERROR' | 'EVENT_FAILED';
      message: string;
      fieldErrors?: Record<string, string>;
    };

export const kioskThemeActionFail = (
  code: Extract<KioskThemeActionResult, { ok: false }>['code'],
  message: string,
  fieldErrors?: Record<string, string>,
): KioskThemeActionResult => ({
  ok: false,
  code,
  message,
  ...(fieldErrors ? { fieldErrors } : {}),
});

export function kioskThemeFieldErrors(error: z.ZodError): Record<string, string> {
  return Object.fromEntries(
    error.issues.map((issue) => [issue.path.join('.') || 'form', issue.message]),
  );
}

// ============ KONTRAST ============

function channelToLinear(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** Luminance relatif WCAG dari warna hex 6 digit; `null` bila tidak valid. */
export function relativeLuminance(hex: string): number | null {
  const match = /^#([\da-fA-F]{6})$/.exec(hex.trim());
  if (!match) return null;
  const value = Number.parseInt(match[1]!, 16);
  const r = channelToLinear((value >> 16) & 0xff);
  const g = channelToLinear((value >> 8) & 0xff);
  const b = channelToLinear(value & 0xff);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rasio kontras WCAG antara dua warna hex; `null` bila salah satu tidak valid. */
export function contrastRatio(foreground: string, background: string): number | null {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  if (a === null || b === null) return null;
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export type ContrastCheck = { ratio: number; passes: boolean; label: string };

/**
 * Memeriksa pasangan teks/latar yang benar-benar dirender pratinjau dan kiosk:
 * teks terbaca yang diturunkan di atas color primary (tombol CTA), teks terbaca
 * di atas color accent, dan teks UI di atas latar. Ambang 4.5:1 (PRD Bab 6.T).
 */
export function checkKioskContrast(input: {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
}): { ok: boolean; checks: ContrastCheck[] } {
  const pairs: { foreground: string; background: string; label: string }[] = [
    {
      foreground: pickReadableText(input.primaryColor),
      background: input.primaryColor,
      label: 'Teks tombol utama',
    },
    {
      foreground: pickReadableText(input.accentColor),
      background: input.accentColor,
      label: 'Teks di atas color accent',
    },
    {
      foreground: pickReadableText(input.backgroundColor),
      background: input.backgroundColor,
      label: 'Teks utama di atas latar',
    },
  ];
  const checks: ContrastCheck[] = pairs.map((pair) => {
    const ratio = contrastRatio(pair.foreground, pair.background);
    return {
      ratio: round2(ratio ?? 0),
      passes: ratio !== null && ratio >= KIOSK_CONTRAST_MIN,
      label: pair.label,
    };
  });
  return { ok: checks.every((check) => check.passes), checks };
}

/** Field-level error kontras; kosong berarti lulus. */
export function kioskThemeContrastErrors(theme: KioskThemeDraft): Record<string, string> {
  const fields: Record<string, string> = {};
  const report = checkKioskContrast(theme);
  const mapping = ['primaryColor', 'accentColor', 'backgroundColor'] as const;
  report.checks.forEach((check, index) => {
    const field = mapping[index];
    if (!check.passes && field)
      fields[field] =
        `Kontras ${check.label.toLowerCase()} harus minimal 4,5:1 (sekarang ${check.ratio}:1).`;
  });
  return fields;
}

// ============ VALIDASI BERKAS ============

export function validateLogoFile(input: { mimeType: string; size: number }): string | null {
  if (!KIOSK_IMAGE_MIME.includes(input.mimeType as (typeof KIOSK_IMAGE_MIME)[number]))
    return 'Logo harus berupa PNG atau JPG.';
  if (!Number.isSafeInteger(input.size) || input.size < 1 || input.size > KIOSK_LOGO_MAX_BYTES)
    return 'Ukuran logo maksimum 500 KB.';
  return null;
}

export function validateAttractFile(input: {
  mode: (typeof ATTRACT_MODE_TYPES)[number];
  mimeType: string;
  size: number;
}): string | null {
  if (!Number.isSafeInteger(input.size) || input.size < 1) return 'Berkas attract tidak valid.';
  if (input.mode === 'VIDEO') {
    if (!KIOSK_VIDEO_MIME.includes(input.mimeType as (typeof KIOSK_VIDEO_MIME)[number]))
      return 'Attract video harus MP4 atau WebM.';
    if (input.size > KIOSK_ATTRACT_VIDEO_MAX_BYTES) return 'Ukuran video maksimum 50 MB.';
    return null;
  }
  if (input.mode === 'IMAGE') {
    if (!KIOSK_IMAGE_MIME.includes(input.mimeType as (typeof KIOSK_IMAGE_MIME)[number]))
      return 'Attract gambar harus PNG atau JPG.';
    if (input.size > KIOSK_ATTRACT_IMAGE_MAX_BYTES) return 'Ukuran gambar maksimum 5 MB.';
    return null;
  }
  return null;
}

/** Ringkasan versi untuk daftar riwayat tanpa membocorkan URL berkas. */
export function summarizeVersion(snapshot: unknown): {
  panelStyle: (typeof PANEL_STYLES)[number];
  orientation: (typeof ORIENTATIONS)[number];
} {
  const record = (snapshot ?? {}) as Record<string, unknown>;
  const panelStyle = PANEL_STYLES.includes(record.panelStyle as (typeof PANEL_STYLES)[number])
    ? (record.panelStyle as (typeof PANEL_STYLES)[number])
    : 'CLASSIC';
  const orientation = ORIENTATIONS.includes(record.orientation as (typeof ORIENTATIONS)[number])
    ? (record.orientation as (typeof ORIENTATIONS)[number])
    : 'LANDSCAPE';
  return { panelStyle, orientation };
}
