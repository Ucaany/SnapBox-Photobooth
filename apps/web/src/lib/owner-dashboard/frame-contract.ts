import { z } from 'zod';

export const frameIdSchema = z.string().uuid();
export const frameHexSchema = z.string().regex(/^#[\da-fA-F]{6}(?:[\da-fA-F]{2})?$/);
export const frameToleranceSchema = z.number().int().min(5).max(40);
export const frameBoothIdSchema = z.string().uuid().nullable();
export const MAX_FRAME_BYTES = 5 * 1024 * 1024;
export const MIN_FRAME_WIDTH = 800;
export const MIN_FRAME_HEIGHT = 600;

export type FrameActionResult =
  | { ok: true; frameId: string; message: string }
  | {
      ok: false;
      code:
        | 'INVALID_INPUT'
        | 'UNAUTHORIZED'
        | 'NOT_FOUND'
        | 'LIMIT_REACHED'
        | 'CONFLICT'
        | 'SERVER_ERROR';
      message: string;
    };

export type OwnerFrame = {
  id: string;
  name: string;
  previewUrl: string | null;
  width: number | null;
  height: number | null;
  fileSizeBytes: number | null;
  transparentColorHex: string | null;
  toleranceDelta: number;
  isActive: boolean;
  boothIds: string[];
  boothNames: string[];
  createdAt: string;
};

export type OwnerFrameBooth = { id: string; name: string };
export type OwnerFramesData = {
  frames: OwnerFrame[];
  booths: OwnerFrameBooth[];
  quota: { used: number; limit: number | null };
};

export function validateFrameFileMetadata(input: {
  mimeType: string;
  size: number;
  width: number;
  height: number;
}) {
  if (!['image/png', 'image/jpeg'].includes(input.mimeType)) return 'Gunakan gambar PNG atau JPG.';
  if (!Number.isSafeInteger(input.size) || input.size < 1 || input.size > MAX_FRAME_BYTES)
    return 'Ukuran file maksimum 5 MB.';
  if (input.width < MIN_FRAME_WIDTH || input.height < MIN_FRAME_HEIGHT)
    return 'Dimensi minimum 800 × 600 piksel.';
  return null;
}

export function frameQuotaReached(used: number, limit: number | null) {
  return limit === null || (limit !== -1 && used >= limit);
}

export function frameActionFail(
  code: Extract<FrameActionResult, { ok: false }>['code'],
  message: string,
): FrameActionResult {
  return { ok: false, code, message };
}

export function retainLatestFrameVersions<T>(versions: readonly T[], limit = 5): T[] {
  return versions.slice(0, limit);
}
