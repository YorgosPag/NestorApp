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
 *
 * ADR-615 — self-hosted (host-less) opening coverage:
 *   - a self-hosted opening (no wallId, well-formed selfHost) is valid
 *     against a `null` host without missingHostWall firing
 *   - selfHostAnchorInvalid / selfHostThicknessInvalid / selfHostRotationInvalid
 *     fire for malformed selfHost fields
 */

import { validateOpeningParams } from '../opening-validator';
import { computeWallGeometry } from '../../geometry/wall-geometry';
import type { WallEntity, WallParams } from '../../types/wall-types';
import type { OpeningParams, OpeningSelfHost } from '../../types/opening-types';

function makeWall(overrides?: Partial<WallParams>): WallEntity {
  const params: WallParams = {
    category: 'exterior',
    start: { x: 0, y: 0, z: 0 },
    end: { x: 5000, y: 0, z: 0 },
    height: 3000,
    thickness: 250,
    flip: false, baseBinding: 'storey-floor', topBinding: 'storey-ceiling', baseOffset: 0, topOffset: 0,
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
  } as unknown as WallEntity;
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

function makeSelfHost(overrides?: Partial<OpeningSelfHost>): OpeningSelfHost {
  return {
    anchor: { x: 1000, y: 2000, z: 0 },
    rotationRad: 0,
    hostThicknessMm: 100,
    ...overrides,
  };
}

/** ADR-615 — self-hosted opening: no wallId, offsetFromStart always 0. */
function makeSelfHostedOpening(overrides?: Partial<OpeningParams>): OpeningParams {
  const { wallId: _wallId, ...base } = makeOpening();
  return {
    ...base,
    offsetFromStart: 0,
    selfHost: makeSelfHost(),
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

describe('validateOpeningParams — ADR-615 self-hosted (host-less) opening', () => {
  it('is valid against a null host: no missingHostWall, no self-host errors', () => {
    const r = validateOpeningParams(makeSelfHostedOpening(), null);
    expect(r.hardErrors).not.toContain('opening.validation.hardErrors.missingHostWall');
    expect(r.hardErrors).toHaveLength(0);
  });

  it('still runs intrinsic checks (widthTooSmall) for a self-hosted opening', () => {
    const r = validateOpeningParams(makeSelfHostedOpening({ width: 150 }), null);
    expect(r.hardErrors).toContain('opening.validation.hardErrors.widthTooSmall');
  });

  it('flags selfHostThicknessInvalid when hostThicknessMm <= 0', () => {
    const r = validateOpeningParams(
      makeSelfHostedOpening({ selfHost: makeSelfHost({ hostThicknessMm: 0 }) }),
      null,
    );
    expect(r.hardErrors).toContain('opening.validation.hardErrors.selfHostThicknessInvalid');
  });

  it('flags selfHostRotationInvalid when rotationRad is non-finite', () => {
    const r = validateOpeningParams(
      makeSelfHostedOpening({ selfHost: makeSelfHost({ rotationRad: Number.NaN }) }),
      null,
    );
    expect(r.hardErrors).toContain('opening.validation.hardErrors.selfHostRotationInvalid');
  });

  it('flags selfHostAnchorInvalid when anchor coords are non-finite', () => {
    const r = validateOpeningParams(
      makeSelfHostedOpening({
        selfHost: makeSelfHost({ anchor: { x: Number.NaN, y: 0, z: 0 } }),
      }),
      null,
    );
    expect(r.hardErrors).toContain('opening.validation.hardErrors.selfHostAnchorInvalid');
  });

  it('a wall-hosted opening (has wallId) still requires it — unchanged behaviour', () => {
    const r = validateOpeningParams(makeOpening({ wallId: '' }), null);
    expect(r.hardErrors).toContain('opening.validation.hardErrors.missingHostWall');
  });
});
