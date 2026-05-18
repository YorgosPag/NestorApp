/**
 * ADR-363 Phase 2 — `validateOpeningParams` tests.
 *
 * Coverage:
 *   - missingHostWall fires when wallId is blank
 *   - widthTooSmall / heightTooSmall fire below their minimums
 *   - offsetNegative / sillNegative fire for sub-zero values
 *   - overflowsHostLength fires when offset + width exceed host length
 *   - overflowsHostHeight fires when sill + height exceed host height
 *   - widthExceedsThicknessRatio fires for width > 2× wall thickness
 *   - doorWithSill code violation fires only when kind=door & sill > 0
 *   - Valid params produce zero hard errors and empty violation list
 */

import { validateOpeningParams } from '../opening-validator';
import { computeWallGeometry } from '../../geometry/wall-geometry';
import type { WallEntity, WallParams } from '../../types/wall-types';
import type { OpeningParams } from '../../types/opening-types';

function makeWall(overrides?: Partial<WallParams>): WallEntity {
  const params: WallParams = {
    category: 'exterior',
    start: { x: 0, y: 0, z: 0 },
    end: { x: 5000, y: 0, z: 0 },
    height: 3000,
    thickness: 250,
    flip: false,
    ...overrides,
  };
  return {
    id: 'wall_test',
    type: 'wall',
    kind: 'straight',
    layerId: '0',
    params,
    geometry: computeWallGeometry(params, 'straight'),
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as WallEntity;
}

function makeOpening(overrides?: Partial<OpeningParams>): OpeningParams {
  return {
    kind: 'door',
    wallId: 'wall_test',
    offsetFromStart: 1000,
    width: 900,
    height: 2100,
    sillHeight: 0,
    ...overrides,
  };
}

describe('validateOpeningParams — hard errors', () => {
  it('flags missingHostWall when wallId is empty', () => {
    const r = validateOpeningParams(makeOpening({ wallId: '' }), makeWall());
    expect(r.hardErrors).toContain('opening.validation.hardErrors.missingHostWall');
  });

  it('flags widthTooSmall when width below MIN_OPENING_WIDTH_MM (200)', () => {
    const r = validateOpeningParams(makeOpening({ width: 150 }), makeWall());
    expect(r.hardErrors).toContain('opening.validation.hardErrors.widthTooSmall');
  });

  it('flags heightTooSmall when height below MIN_OPENING_HEIGHT_MM (200)', () => {
    const r = validateOpeningParams(makeOpening({ height: 150 }), makeWall());
    expect(r.hardErrors).toContain('opening.validation.hardErrors.heightTooSmall');
  });

  it('flags offsetNegative for sub-zero offsetFromStart', () => {
    const r = validateOpeningParams(makeOpening({ offsetFromStart: -50 }), makeWall());
    expect(r.hardErrors).toContain('opening.validation.hardErrors.offsetNegative');
  });

  it('flags sillNegative for sub-zero sillHeight', () => {
    const r = validateOpeningParams(makeOpening({ sillHeight: -10 }), makeWall());
    expect(r.hardErrors).toContain('opening.validation.hardErrors.sillNegative');
  });

  it('flags overflowsHostLength when offset + width > wall length', () => {
    // 5000 wall length, offset 4500 + width 900 = 5400 > 5000.
    const r = validateOpeningParams(makeOpening({ offsetFromStart: 4500, width: 900 }), makeWall());
    expect(r.hardErrors).toContain('opening.validation.hardErrors.overflowsHostLength');
  });

  it('flags overflowsHostHeight when sill + height > wall height', () => {
    // 3000 height wall, sill 2000 + opening height 1500 = 3500 > 3000.
    const r = validateOpeningParams(
      makeOpening({ sillHeight: 2000, height: 1500 }),
      makeWall({ height: 3000 }),
    );
    expect(r.hardErrors).toContain('opening.validation.hardErrors.overflowsHostHeight');
  });
});

describe('validateOpeningParams — code violations', () => {
  it('flags widthExceedsThicknessRatio when width > 2× wall thickness', () => {
    // thickness 100 → 2× = 200; opening width 900 way exceeds.
    const r = validateOpeningParams(makeOpening({ width: 900 }), makeWall({ thickness: 100 }));
    expect(r.codeViolations).toContain('opening.validation.codeViolations.widthExceedsThicknessRatio');
  });

  it('flags doorWithSill for door + sillHeight > 0', () => {
    const r = validateOpeningParams(
      makeOpening({ kind: 'door', sillHeight: 300 }),
      makeWall(),
    );
    expect(r.codeViolations).toContain('opening.validation.codeViolations.doorWithSill');
  });

  it('does NOT flag doorWithSill for window with sillHeight > 0', () => {
    const r = validateOpeningParams(
      makeOpening({ kind: 'window', width: 1200, height: 1400, sillHeight: 900 }),
      makeWall(),
    );
    expect(r.codeViolations).not.toContain('opening.validation.codeViolations.doorWithSill');
  });
});

describe('validateOpeningParams — happy path', () => {
  it('returns zero hard errors AND zero code violations for a valid door', () => {
    // Thick wall (300mm × 2 = 600 ≥ 900? no — choose a wall thickness 500 so 2× = 1000 > 900.
    const r = validateOpeningParams(makeOpening(), makeWall({ thickness: 500 }));
    expect(r.hardErrors).toHaveLength(0);
    expect(r.codeViolations).toHaveLength(0);
  });
});
