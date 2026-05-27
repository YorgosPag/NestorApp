/**
 * ADR-363 Phase 1 — `validateWallParams` tests.
 *
 * Coverage:
 *   - Hard errors: degenerate length, non-positive thickness, oversized
 *     thickness, non-positive height, DNA mismatch
 *   - Non-blocking code violations: below-min thickness, exterior NOK minimum
 *   - DNA consistency reconciliation (tolerance)
 *   - hasCodeViolations flag mirrors violationKeys length
 */

import { validateWallParams } from '../wall-validator';
import {
  MIN_WALL_LENGTH_MM,
  MIN_WALL_THICKNESS_MM,
  type WallParams,
} from '../../types/wall-types';
import {
  createDefaultExteriorDna,
  createDefaultInteriorDna,
} from '../../types/wall-dna-types';

function makeParams(overrides?: Partial<WallParams>): WallParams {
  return {
    category: 'exterior',
    start: { x: 0, y: 0, z: 0 },
    end: { x: 1000, y: 0, z: 0 },
    height: 3000,
    thickness: 250,
    flip: false, baseBinding: 'storey-floor', topBinding: 'storey-ceiling', baseOffset: 0, topOffset: 0,
    ...overrides,
  };
}

describe('validateWallParams — hard errors', () => {
  it('flags zero-length wall', () => {
    const r = validateWallParams(makeParams({ end: { x: 0, y: 0, z: 0 } }));
    expect(r.hardErrors).toContain('wall.validation.hardErrors.lengthTooShort');
  });

  it('flags wall below MIN_WALL_LENGTH_MM', () => {
    const tooShort = MIN_WALL_LENGTH_MM - 1;
    const r = validateWallParams(makeParams({ end: { x: tooShort, y: 0, z: 0 } }));
    expect(r.hardErrors).toContain('wall.validation.hardErrors.lengthTooShort');
  });

  it('flags non-positive thickness', () => {
    const r = validateWallParams(makeParams({ thickness: 0 }));
    expect(r.hardErrors).toContain('wall.validation.hardErrors.thicknessNonPositive');
  });

  it('flags oversized thickness (>2000 mm)', () => {
    const r = validateWallParams(makeParams({ thickness: 2500 }));
    expect(r.hardErrors).toContain('wall.validation.hardErrors.thicknessExceedsMax');
  });

  it('flags non-positive height', () => {
    const r = validateWallParams(makeParams({ height: 0 }));
    expect(r.hardErrors).toContain('wall.validation.hardErrors.heightNonPositive');
  });

  it('flags DNA totalThickness mismatch beyond tolerance', () => {
    const dna = createDefaultExteriorDna(); // totalThickness = 250
    const r = validateWallParams(makeParams({ thickness: 200, dna }));
    expect(r.hardErrors).toContain('wall.validation.hardErrors.dnaThicknessMismatch');
  });

  it('accepts DNA matching thickness within tolerance', () => {
    const dna = createDefaultExteriorDna();
    const r = validateWallParams(makeParams({ thickness: dna.totalThickness, dna }));
    expect(r.hardErrors).toHaveLength(0);
  });
});

describe('validateWallParams — non-blocking code violations', () => {
  it('flags thickness below structural min (50 mm)', () => {
    const r = validateWallParams(
      makeParams({ thickness: MIN_WALL_THICKNESS_MM - 5, category: 'interior' }),
    );
    expect(r.codeViolations).toContain('wall.validation.codeViolations.thicknessBelowMin');
    expect(r.hardErrors).toHaveLength(0);
  });

  it('flags exterior wall thinner than NOK 200 mm min', () => {
    const r = validateWallParams(makeParams({ category: 'exterior', thickness: 150 }));
    expect(r.codeViolations).toContain('wall.validation.codeViolations.exteriorBelowNokMin');
  });

  it('does NOT flag NOK exterior min for interior walls', () => {
    const r = validateWallParams(makeParams({ category: 'interior', thickness: 100 }));
    expect(r.codeViolations).not.toContain(
      'wall.validation.codeViolations.exteriorBelowNokMin',
    );
  });
});

describe('validateWallParams — BimValidation payload', () => {
  it('sets hasCodeViolations=true when violations present', () => {
    const r = validateWallParams(makeParams({ category: 'exterior', thickness: 100 }));
    expect(r.bimValidation.hasCodeViolations).toBe(true);
    expect(r.bimValidation.violationKeys.length).toBeGreaterThan(0);
  });

  it('sets hasCodeViolations=false on a valid wall', () => {
    const dna = createDefaultExteriorDna();
    const r = validateWallParams(makeParams({ thickness: dna.totalThickness, dna }));
    expect(r.bimValidation.hasCodeViolations).toBe(false);
    expect(r.bimValidation.violationKeys).toHaveLength(0);
  });

  it('populates lastValidatedAt timestamp', () => {
    const r = validateWallParams(makeParams());
    expect(r.bimValidation.lastValidatedAt).not.toBeNull();
  });

  it('interior DNA preset (100 mm) does not trip exterior NOK rule when category=interior', () => {
    const dna = createDefaultInteriorDna();
    const r = validateWallParams(
      makeParams({ category: 'interior', thickness: dna.totalThickness, dna }),
    );
    expect(r.codeViolations).not.toContain(
      'wall.validation.codeViolations.exteriorBelowNokMin',
    );
    expect(r.hardErrors).toHaveLength(0);
  });
});
