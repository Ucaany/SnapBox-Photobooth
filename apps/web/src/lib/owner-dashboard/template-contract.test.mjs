import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const contractPath = join(dirname(fileURLToPath(import.meta.url)), 'template-contract.ts');
const source = await readFile(contractPath, 'utf8');
const javascript = ts.transpile(source, {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2022,
});
const contractModule = { exports: {} };
new Function('require', 'module', 'exports', javascript)(
  createRequire(pathToFileURL(contractPath)),
  contractModule,
  contractModule.exports,
);
const { TEMPLATE_LAYOUTS, templateInputSchema, templateUpdateSchema } = contractModule.exports;

const validTemplate = {
  name: 'Strip malam',
  layoutType: 'strip_2x6',
  poseGrid: { rows: 3, cols: 1, padding: 12 },
  printDimensions: '2x6',
  aspectRatio: '2:6',
  background: '#FFFFFF',
  isActive: true,
};

test('defines all requested template layouts', () => {
  assert.deepEqual(
    TEMPLATE_LAYOUTS.map((layout) => layout.value),
    ['single', 'strip_2x6', 'collage_4_pose', 'custom'],
  );
});

test('accepts valid input and rejects invalid grids and unknown layouts', () => {
  assert.equal(templateInputSchema.safeParse(validTemplate).success, true);
  assert.equal(
    templateInputSchema.safeParse({ ...validTemplate, poseGrid: { rows: 9, cols: 1, padding: 12 } })
      .success,
    false,
  );
  assert.equal(
    templateInputSchema.safeParse({ ...validTemplate, layoutType: 'unsupported' }).success,
    false,
  );
});

test('requires a UUID when updating a template', () => {
  assert.equal(
    templateUpdateSchema.safeParse({ ...validTemplate, id: '3f847c1e-79e0-4ae2-93b6-cb29beae2ee9' })
      .success,
    true,
  );
  assert.equal(templateUpdateSchema.safeParse({ ...validTemplate, id: 'invalid' }).success, false);
});
