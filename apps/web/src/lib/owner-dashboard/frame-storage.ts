import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import sharp from 'sharp';

import { MAX_FRAME_BYTES, MIN_FRAME_HEIGHT, MIN_FRAME_WIDTH } from './frame-contract';

let client: SupabaseClient | undefined;
function storageClient() {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key || new URL(url).protocol !== 'https:') throw new Error('Storage unavailable');
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}

export async function inspectFrameFile(file: File) {
  if (
    !['image/png', 'image/jpeg'].includes(file.type) ||
    file.size < 1 ||
    file.size > MAX_FRAME_BYTES
  )
    throw new Error('INVALID_FILE');
  const buffer = Buffer.from(await file.arrayBuffer());
  const image = sharp(buffer, { limitInputPixels: 80_000_000, failOn: 'error' });
  const metadata = await image.metadata();
  if (
    !['png', 'jpeg'].includes(metadata.format ?? '') ||
    (metadata.format === 'png' ? file.type !== 'image/png' : file.type !== 'image/jpeg') ||
    !metadata.width ||
    !metadata.height ||
    metadata.width < MIN_FRAME_WIDTH ||
    metadata.height < MIN_FRAME_HEIGHT
  )
    throw new Error('INVALID_FILE');
  const extension = metadata.format === 'png' ? 'png' : 'jpg';
  const thumbnail = await image
    .rotate()
    .resize({ width: 480, height: 360, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 78 })
    .toBuffer();
  return {
    buffer,
    thumbnail,
    width: metadata.width,
    height: metadata.height,
    mimeType: extension === 'png' ? 'image/png' : 'image/jpeg',
    extension,
  };
}

export async function uploadFrameObjects(
  tenantId: string,
  frameId: string,
  file: Awaited<ReturnType<typeof inspectFrameFile>>,
) {
  const storage = storageClient().storage.from('frames');
  const originalPath = `tenant/${tenantId}/frames/${frameId}.${file.extension}`;
  const thumbnailPath = `tenant/${tenantId}/frames/${frameId}.thumb.jpg`;
  const original = await storage.upload(originalPath, file.buffer, {
    contentType: file.mimeType,
    upsert: false,
  });
  if (original.error) throw new Error('STORAGE_FAILED');
  const thumbnail = await storage.upload(thumbnailPath, file.thumbnail, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (thumbnail.error) {
    await storage.remove([originalPath]);
    throw new Error('STORAGE_FAILED');
  }
  return { originalPath, thumbnailPath };
}

export async function removeFrameObjects(paths: readonly string[]) {
  const result = await storageClient()
    .storage.from('frames')
    .remove([...paths]);
  if (result.error) throw new Error('STORAGE_FAILED');
}

export async function signedFrameUrl(path: string) {
  try {
    const result = await storageClient().storage.from('frames').createSignedUrl(path, 3600);
    if (result.error) return null;
    return result.data.signedUrl;
  } catch {
    return null;
  }
}
