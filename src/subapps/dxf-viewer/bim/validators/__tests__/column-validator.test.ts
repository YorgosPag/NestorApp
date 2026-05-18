/**
 * ADR-363 Phase 4 — `validateColumnParams` tests.
 *
 * Coverage:
 *   - nonPositiveWidth / nonPositiveDepth / nonPositiveHeight hard errors
 *   - L-shape arm validation: invalidLshapeArm
 *   - T-shape web validation: invalidTshapeWeb / invalidTshapeFlange
 *   - widthTooSmall / depthTooSmall code violation < MIN_COLUMN_DIMENSION_MM (250)
 *   - maxSlendernessExceeded code violation > MAX_SLENDERNESS_RATIO (30)
 *   - Circular skips depth check
 *   - Valid params → 0 hard errors, 0 code violations
 */

import { validateColumnParams } from '../column-validator';
import type { ColumnParams } from '../../types/column-types';

function makeColumn(overrides?: Partial<ColumnParams>): ColumnParams {
  return {
    kind: 'rectangular',
    position: { x: 0, y: 0, z: 0 },
    anchor: 'center',
    width: 400,
    depth: 400,
    height: 3000,
    rotation: 0,
    ...overrides,
  };
}

describe('validateColumnParams — hard errors', () => {
  it('flags nonPositiveWidth για width = 0', () => {
    const r = validateColumnParams(makeColumn({ width: 0 }));
    expect(r.hardErrors).toContain('column.validation.hardErrors.nonPositiveWidth');
  });

  it('flags nonPositiveDepth για depth = 0 σε rectangular', () => {
    const r = validateColumnParams(makeColumn({ depth: 0 }));
    expect(r.hardErrors).toContain('column.validation.hardErrors.nonPositiveDepth');
  });

  it('circular skips depth check (depth=0 ok)', () => {
    const r = validateColumnParams(makeColumn({ kind: 'circular', width: 400, depth: 0 }));
    expect(r.hardErrors).not.toContain('column.validation.hardErrors.nonPositiveDepth');
  });

  it('flags nonPositiveHeight για height = 0', () => {
    const r = validateColumnParams(makeColumn({ height: 0 }));
    expect(r.hardErrors).toContain('column.validation.hardErrors.nonPositiveHeight');
  });

  it('flags invalidLshapeArm για armLength > depth', () => {
    const r = validateColumnParams(makeColumn({
      kind: 'L-shape', depth: 300, lshape: { armLength: 500 },
    }));
    expect(r.hardErrors).toContain('column.validation.hardErrors.invalidLshapeArm');
  });

  it('flags invalidTshapeWeb για webThickness > width', () => {
    const r = validateColumnParams(makeColumn({
      kind: 'T-shape', width: 300, tshape: { webThickness: 500 },
    }));
    expect(r.hardErrors).toContain('column.validation.hardErrors.invalidTshapeWeb');
  });

  it('flags invalidTshapeFlange για flangeLength <= 0', () => {
    const r = validateColumnParams(makeColumn({
      kind: 'T-shape', tshape: { flangeLength: 0 },
    }));
    expect(r.hardErrors).toContain('column.validation.hardErrors.invalidTshapeFlange');
  });
});

describe('validateColumnParams — code violations', () => {
  it('flags widthTooSmall κάτω από MIN_COLUMN_DIMENSION_MM (250)', () => {
    const r = validateColumnParams(makeColumn({ width: 200 }));
    expect(r.codeViolations).toContain('column.validation.codeViolations.widthTooSmall');
  });

  it('flags depthTooSmall κάτω από MIN_COLUMN_DIMENSION_MM (250) σε rectangular', () => {
    const r = validateColumnParams(makeColumn({ depth: 200 }));
    expect(r.codeViolations).toContain('column.validation.codeViolations.depthTooSmall');
  });

  it('flags maxSlendernessExceeded για slenderness > MAX_SLENDERNESS_RATIO (30)', () => {
    // 100mm × 100mm × 5000mm → slenderness 50 → violation.
    const r = validateColumnParams(makeColumn({ width: 100, depth: 100, height: 5000 }));
    expect(r.codeViolations).toContain('column.validation.codeViolations.maxSlendernessExceeded');
  });
});

describe('validateColumnParams — happy path', () => {
  it('returns zero hard errors AND zero code violations για a valid 400×400 column', () => {
    const r = validateColumnParams(makeColumn({ width: 400, depth: 400, height: 3000 }));
    expect(r.hardErrors).toHaveLength(0);
    expect(r.codeViolations).toHaveLength(0);
    expect(r.bimValidation.hasCodeViolations).toBe(false);
  });

  it('hasCodeViolations === true όταν υπάρχει code violation', () => {
    const r = validateColumnParams(makeColumn({ width: 200 }));
    expect(r.bimValidation.hasCodeViolations).toBe(true);
    expect(r.bimValidation.violationKeys.length).toBeGreaterThan(0);
  });
});
