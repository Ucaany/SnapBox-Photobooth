import { z } from 'zod';

export const TEMPLATE_LAYOUTS = [
  {
    value: 'single',
    label: 'Single',
    rows: 1,
    cols: 1,
    aspectRatio: '4:6',
    printDimensions: '4x6',
  },
  {
    value: 'strip_2x6',
    label: 'Strip 2×6',
    rows: 3,
    cols: 1,
    aspectRatio: '2:6',
    printDimensions: '2x6',
  },
  {
    value: 'collage_4_pose',
    label: 'Kolase 4 pose',
    rows: 2,
    cols: 2,
    aspectRatio: '4:6',
    printDimensions: '4x6',
  },
  {
    value: 'custom',
    label: 'Custom',
    rows: 2,
    cols: 2,
    aspectRatio: '4:6',
    printDimensions: '4x6',
  },
] as const;

export const templateIdSchema = z.string().uuid();
export const templateInputSchema = z.object({
  name: z.string().trim().min(1, 'Nama template wajib diisi.').max(150),
  layoutType: z.enum(['single', 'strip_2x6', 'collage_4_pose', 'custom']),
  poseGrid: z.object({
    rows: z.number().int().min(1).max(8),
    cols: z.number().int().min(1).max(8),
    padding: z.number().int().min(0).max(100),
  }),
  printDimensions: z.string().trim().min(1).max(40),
  aspectRatio: z.string().trim().min(1).max(20),
  background: z.string().trim().min(1).max(20),
  isActive: z.boolean().default(true),
});
export const templateUpdateSchema = templateInputSchema.extend({ id: templateIdSchema });

export type TemplateInput = z.infer<typeof templateInputSchema>;
export type OwnerTemplate = {
  id: string;
  name: string;
  layoutType: TemplateInput['layoutType'];
  poseGrid: TemplateInput['poseGrid'];
  printDimensions: string;
  aspectRatio: string;
  background: string;
  isActive: boolean;
  createdAt: string;
};
export type TemplateActionResult =
  | { ok: true; templateId: string; message: string }
  | {
      ok: false;
      code: 'INVALID_INPUT' | 'UNAUTHORIZED' | 'NOT_FOUND' | 'SERVER_ERROR';
      message: string;
    };

export const templateActionFail = (
  code: Extract<TemplateActionResult, { ok: false }>['code'],
  message: string,
): TemplateActionResult => ({ ok: false, code, message });
