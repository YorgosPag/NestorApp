/**
 * =============================================================================
 * INVARIANT TEST — FilePreviewRenderer covers every PreviewType (CHECK 3.21)
 * =============================================================================
 *
 * For every literal of the `PreviewType` union exported by the classification
 * registry, the renderer MUST contain a branch `previewType === '<literal>'`.
 * This catches the pattern from 2026-04-21 commit `1d522810` where a new
 * preview component was registered in `getPreviewType()` but the renderer
 * was not updated — the preview silently fell back to "unsupported".
 *
 * @enterprise ADR-296
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { PreviewType } from '@/config/file-types/classification-registry';

const RENDERER_PATH = resolve(
  __dirname,
  '..',
  'FilePreviewRenderer.tsx',
);

const ALL_PREVIEW_TYPES: readonly PreviewType[] = [
  'pdf',
  'image',
  'video',
  'audio',
  'docx',
  'excel',
  'xml',
  'text',
  'html',
  'dxf',
  'unsupported',
] as const;

describe('FilePreviewRenderer — covers every PreviewType literal', () => {
  const source = readFileSync(RENDERER_PATH, 'utf8');

  it.each(ALL_PREVIEW_TYPES)(
    'renders a branch for previewType === %p',
    (literal) => {
      const patterns = [
        `previewType === '${literal}'`,
        `previewType === "${literal}"`,
      ];
      const match = patterns.some((p) => source.includes(p));
      expect({
        literal,
        found: match,
      }).toEqual({ literal, found: true });
    },
  );

  it('does not reference any PreviewType literal outside the union', () => {
    const literalRegex = /previewType === ['"]([a-z-]+)['"]/g;
    const union = new Set<string>(ALL_PREVIEW_TYPES);
    const orphans: string[] = [];
    for (const match of source.matchAll(literalRegex)) {
      const literal = match[1];
      if (!union.has(literal)) orphans.push(literal);
    }
    expect(orphans).toEqual([]);
  });
});
