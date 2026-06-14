/**
 * ADR-453 — print-filename unit tests.
 */

import { buildPrintFilename } from '../print-filename';

describe('buildPrintFilename', () => {
  it('composes project, paper size and date with a .pdf extension', () => {
    expect(buildPrintFilename('My Project', 'A3', '2026-06-14')).toBe(
      'My-Project_A3_2026-06-14.pdf',
    );
  });

  it('keeps Greek letters (Unicode-aware slug)', () => {
    expect(buildPrintFilename('Κάτοψη Ισογείου', 'A1', '2026-06-14')).toBe(
      'Κάτοψη-Ισογείου_A1_2026-06-14.pdf',
    );
  });

  it('collapses punctuation runs and trims edges', () => {
    expect(buildPrintFilename('  plan //  v2!! ', 'A4', '2026-01-01')).toBe(
      'plan-v2_A4_2026-01-01.pdf',
    );
  });

  it('falls back to "drawing" for an empty name', () => {
    expect(buildPrintFilename('   ', 'A4', '2026-01-01')).toBe('drawing_A4_2026-01-01.pdf');
  });
});
