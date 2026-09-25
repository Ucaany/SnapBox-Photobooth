/**
 * Skema bentuk `PlanFeatures` untuk validasi runtime entitlement (PRD Task 1.7).
 *
 * Mengapa skema ini tinggal di modul entitlement, bukan di editor plan:
 *
 * `plans.features` adalah JSONB yang dibaca runtime untuk MEMUTUSKAN kapasitas
 * tenant. Jika validasinya milik editor plan, satu perubahan aturan editor
 * (mis. `.strict()` baru, `superRefine` turunan) akan diam-diam membuat
 * `EntitlementService` menolak tenant yang datanya ditulis sebelum aturan itu.
 * Karena itu arah ketergantungan dibalik: modul entitlement yang memiliki
 * skema bentuk, dan editor plan mengimpornya.
 *
 * Yang divalidasi di sini hanya BENTUK (tipe dan rentang wajar). Aturan turunan
 * seperti "`backupGateway` butuh `paymentGatewayB2C`" tetap milik editor plan
 * karena itu soal UX editor, bukan soal entitlement yang bisa dibaca.
 *
 * Batasan yang disengaja: `-1` (tanpa batas) sah untuk limit yang mendukungnya,
 * dan `cameraTypes` boleh berisi jenis kamera apa pun yang dikenal registry
 * kamera. Skema tidak membatasi nilai enum krom/filter di sini agar tingkat
 * baru di aplikasi tidak membuat tenant lama ditolak `INVALID_DATA`.
 */
import { z } from 'zod';

import type { PlanFeatures } from '@snapbox/db';

/** Batas atas limit integer; `-1` khusus berarti tanpa batas. */
const MAX_LIMIT = 100_000;
/** Nilai kanonik "tanpa batas". */
const UNLIMITED = -1;

/**
 * Limit integer non-negatif, atau `-1` bila field mendukung tanpa batas.
 *
 * Menerima string (bentuk JSONB lama) maupun number supaya data yang sudah
 * tersimpan tidak tiba-tiba ditolak hanya karena perbedaan representasi.
 */
function limitField(unlimited: boolean) {
  return z.union([z.number(), z.string()]).transform((value, ctx) => {
    const numeric = typeof value === 'number' ? value : Number(value.trim());
    if (!Number.isSafeInteger(numeric)) {
      ctx.addIssue({ code: 'custom', message: 'Limit harus bilangan bulat.' });
      return z.NEVER;
    }
    if (numeric === UNLIMITED) {
      if (!unlimited) {
        ctx.addIssue({ code: 'custom', message: 'Field ini tidak mendukung tanpa batas.' });
        return z.NEVER;
      }
      return UNLIMITED;
    }
    if (numeric < 0 || numeric > MAX_LIMIT) {
      ctx.addIssue({ code: 'custom', message: `Limit harus 0 sampai ${MAX_LIMIT}.` });
      return z.NEVER;
    }
    return numeric;
  });
}

const textField = z.string().trim().min(1).max(120);

/**
 * Level enum yang divalidasi sebagai string bebas lalu di-narrow ke tipe
 * `PlanFeatures`.
 *
 * Sengaja TIDAK memakai `z.enum` daftar tertutup: tingkat baru yang ditambahkan
 * aplikasi (mis. filter `CUSTOM_LUT_V2`) tidak boleh membuat tenant dengan data
 * lama atau baru ditolak `INVALID_DATA`. Nilai yang tidak dikenal tetap lolos
 * sebagai string dan tinggal ditafsirkan pemakainya, sama seperti JSONB apa
 * adanya. Editor plan yang menjaga nilai enum-nya lewat skema terpisah.
 */
const levelField = z.string().trim().min(1);

/**
 * Bentuk canonical `PlanFeatures`.
 *
 * TIDAK `.strict()`: JSONB historis mungkin punya key tambahan dari versi fitur
 * sebelumnya, dan key itu tidak boleh digagalkan sebagai `INVALID_DATA` karena
 * akan mematikan tenant yang datanya sah.
 */
export const planFeaturesShapeSchema = z.object({
  deviceIncluded: limitField(false),
  addOnPricePerDevice: limitField(false),
  paymentGatewayB2C: z.boolean(),
  backupGateway: z.boolean(),
  cameraTypes: z.array(z.string().trim().min(1)).min(1),
  maxFrameUpload: limitField(true),
  storageMb: limitField(false),
  retentionDays: limitField(false),
  promoEnabled: z.boolean(),
  promoAdvanced: z.boolean(),
  kioskCustomEnabled: z.boolean(),
  kioskMultiplePanelStyle: z.boolean(),
  staffLimit: limitField(true),
  outletLimit: limitField(true),
  chromaKeyLevel: levelField as z.ZodType<PlanFeatures['chromaKeyLevel']>,
  filterLevel: levelField as z.ZodType<PlanFeatures['filterLevel']>,
  supportLevel: textField,
  priorityRealtime: z.boolean(),
}) satisfies z.ZodType<PlanFeatures>;

/**
 * Memvalidasi `plans.features` yang datang dari DB.
 *
 * `features` berasal dari kolom JSONB bertipe `PlanFeatures`, tetapi tipe
 * statis bukan jaminan runtime: baris lama atau tulisan manual bisa menyimpan
 * bentuk lain. Pemanggil memperlakukan `null` sebagai penolakan, bukan default.
 */
export function parsePlanFeatures(value: unknown): PlanFeatures | null {
  const parsed = planFeaturesShapeSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
