/**
 * =============================================================================
 * INVARIANT TEST — Extractor registry coverage (CHECK 3.20)
 * =============================================================================
 *
 * Contract — the extractor pipeline is driven entirely through the SSoT:
 *
 *   1. `ExtractorKind` (classification-registry.ts) lists every strategy.
 *   2. `runExtractor` in classify-background.ts switches on that union.
 *      The `switch` has no `default` and no fallthrough, so a missing branch
 *      becomes a TypeScript error at compile time.
 *   3. Every file under `src/lib/document-extractors/*-extractor.ts` MUST be
 *      referenced by `runExtractor`. Orphan extractors fail this test.
 *
 * If this test fails, do not weaken it — add the missing branch or remove
 * the orphan extractor.
 *
 * @enterprise ADR-296
 */

import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const BACKGROUND_PATH = resolve(__dirname, '..', 'classify-background.ts');
const EXTRACTORS_DIR = resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  'lib',
  'document-extractors',
);

// Source of truth for the extractor union (kept in sync with the TypeScript
// literal in classification-registry.ts — this list is the contract that the
// classify-background switch must exhaustively cover).
const ALL_EXTRACTOR_KINDS = ['docx', 'xlsx', 'dxf', 'svg-truncate'] as const;

describe('Extractor registry — every ExtractorKind has a switch branch', () => {
  const source = readFileSync(BACKGROUND_PATH, 'utf8');

  it.each(ALL_EXTRACTOR_KINDS)(
    'classify-background.runExtractor handles case %p',
    (kind) => {
      const patterns = [`case '${kind}':`, `case "${kind}":`];
      const found = patterns.some((p) => source.includes(p));
      expect({ kind, found }).toEqual({ kind, found: true });
    },
  );

  it('classify-background dispatches through the SSoT registry', () => {
    expect(source).toMatch(/getExtractorKind\s*\(/);
  });

  it('classify-background does not reintroduce the old hand-maintained MIME constants', () => {
    expect(source).not.toMatch(/const\s+DOCX_MIME\s*=/);
    expect(source).not.toMatch(/const\s+XLSX_MIME\s*=/);
    expect(source).not.toMatch(/const\s+DXF_MIMES\s*=/);
    expect(source).not.toMatch(/const\s+SVG_MIME\s*=/);
  });
});

describe('Extractor registry — every *-extractor.ts is wired', () => {
  const backgroundSource = readFileSync(BACKGROUND_PATH, 'utf8');
  const extractorFiles = readdirSync(EXTRACTORS_DIR).filter(
    (f) => f.endsWith('-extractor.ts') && !f.endsWith('.test.ts'),
  );

  it('finds at least one extractor file (sanity check)', () => {
    expect(extractorFiles.length).toBeGreaterThan(0);
  });

  it.each(extractorFiles)('%s is imported by classify-background', (file) => {
    const name = file.replace(/\.ts$/, '');
    const importPatterns = [
      `document-extractors/${name}`,
      `document-extractors/${name}'`,
      `document-extractors/${name}"`,
    ];
    const imported = importPatterns.some((p) => backgroundSource.includes(p));
    expect({ file, imported }).toEqual({ file, imported: true });
  });
});
