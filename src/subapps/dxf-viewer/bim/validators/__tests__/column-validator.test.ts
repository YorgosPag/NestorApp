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
    baseBinding: 'storey-floor',
    topBinding: 'storey-ceiling',
    baseOffset: 0,
    topOffset: 0,
    ...overrides,
  } as ColumnParams;
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

// ─── ADR-363 Phase 8 — polygon / shear-wall / I-shape ───────────────────────

describe('validateColumnParams — polygon kind (Phase 8)', () => {
  it('flags invalidPolygonSides για sides < MIN_POLYGON_SIDES (3)', () => {
    const r = validateColumnParams(makeColumn({
      kind: 'polygon', width: 400, polygon: { sides: 2 },
    }));
    expect(r.hardErrors).toContain('column.validation.hardErrors.invalidPolygonSides');
  });

  it('flags invalidPolygonSides για sides > MAX_POLYGON_SIDES (12)', () => {
    const r = validateColumnParams(makeColumn({
      kind: 'polygon', width: 400, polygon: { sides: 13 },
    }));
    expect(r.hardErrors).toContain('column.validation.hardErrors.invalidPolygonSides');
  });

  it('flags invalidPolygonSides για μη ακέραιο αριθμό πλευρών', () => {
    const r = validateColumnParams(makeColumn({
      kind: 'polygon', width: 400, polygon: { sides: 3.5 },
    }));
    expect(r.hardErrors).toContain('column.validation.hardErrors.invalidPolygonSides');
  });

  it('valid hexagon (sides=6) → no hard errors', () => {
    const r = validateColumnParams(makeColumn({
      kind: 'polygon', width: 400, polygon: { sides: 6 },
    }));
    expect(r.hardErrors).toHaveLength(0);
  });

  it('polygon skips depthTooSmall (depth ignored)', () => {
    const r = validateColumnParams(makeColumn({
      kind: 'polygon', width: 400, depth: 0, polygon: { sides: 6 },
    }));
    expect(r.hardErrors).not.toContain('column.validation.hardErrors.nonPositiveDepth');
    expect(r.codeViolations).not.toContain('column.validation.codeViolations.depthTooSmall');
  });
});

describe('validateColumnParams — shear-wall kind (Phase 8)', () => {
  it('flags shearWallThicknessTooSmall για thickness < 150mm', () => {
    const r = validateColumnParams(makeColumn({
      kind: 'shear-wall', width: 2000, depth: 140,
    }));
    expect(r.codeViolations).toContain(
      'column.validation.codeViolations.shearWallThicknessTooSmall',
    );
  });

  it('thickness = 150mm → no thickness violation', () => {
    const r = validateColumnParams(makeColumn({
      kind: 'shear-wall', width: 2000, depth: 150,
    }));
    expect(r.codeViolations).not.toContain(
      'column.validation.codeViolations.shearWallThicknessTooSmall',
    );
  });

  it('flags shearWallAspectRatioBelow για aspect < 4', () => {
    const r = validateColumnParams(makeColumn({
      kind: 'shear-wall', width: 500, depth: 200, // aspect 2.5
    }));
    expect(r.codeViolations).toContain(
      'column.validation.codeViolations.shearWallAspectRatioBelow',
    );
  });

  it('aspect = 4 → no aspect violation', () => {
    const r = validateColumnParams(makeColumn({
      kind: 'shear-wall', width: 800, depth: 200,
    }));
    expect(r.codeViolations).not.toContain(
      'column.validation.codeViolations.shearWallAspectRatioBelow',
    );
  });

  it('relaxes widthTooSmall + depthTooSmall (Eurocode 250mm) για shear-wall', () => {
    const r = validateColumnParams(makeColumn({
      kind: 'shear-wall', width: 2000, depth: 200,
    }));
    expect(r.codeViolations).not.toContain('column.validation.codeViolations.widthTooSmall');
    expect(r.codeViolations).not.toContain('column.validation.codeViolations.depthTooSmall');
  });
});

describe('validateColumnParams — I-shape kind (Phase 8)', () => {
  const validIShape = (extra?: Partial<ColumnParams>): ColumnParams => makeColumn({
    kind: 'I-shape', width: 200, depth: 300,
    ishape: { flangeThickness: 20, webThickness: 15 },
    ...extra,
  });

  it('flags invalidIShapePlateThickness για flangeThickness < 5mm', () => {
    const r = validateColumnParams(validIShape({
      ishape: { flangeThickness: 3, webThickness: 15 },
    }));
    expect(r.hardErrors).toContain(
      'column.validation.hardErrors.invalidIShapePlateThickness',
    );
  });

  it('flags invalidIShapePlateThickness για webThickness < 5mm', () => {
    const r = validateColumnParams(validIShape({
      ishape: { flangeThickness: 20, webThickness: 4 },
    }));
    expect(r.hardErrors).toContain(
      'column.validation.hardErrors.invalidIShapePlateThickness',
    );
  });

  it('flags invalidIShapeFlangeOverlap όταν 2*tf >= depth', () => {
    const r = validateColumnParams(validIShape({
      depth: 180, ishape: { flangeThickness: 100, webThickness: 15 },
    }));
    expect(r.hardErrors).toContain(
      'column.validation.hardErrors.invalidIShapeFlangeOverlap',
    );
  });

  it('flags invalidIShapeWebOverflow όταν tw >= width', () => {
    const r = validateColumnParams(validIShape({
      width: 200, ishape: { flangeThickness: 20, webThickness: 250 },
    }));
    expect(r.hardErrors).toContain(
      'column.validation.hardErrors.invalidIShapeWebOverflow',
    );
  });

  it('valid IPE-300 defaults → no hard errors', () => {
    const r = validateColumnParams(validIShape());
    expect(r.hardErrors).toHaveLength(0);
  });
});

// ─── ADR-363/449 — composite free-reshape section guards ────────────────────

describe('validateColumnParams — composite section (free per-corner reshape)', () => {
  const SQUARE = {
    polygon: [
      { x: -200, y: -200 }, { x: 200, y: -200 }, { x: 200, y: 200 }, { x: -200, y: 200 },
    ],
  };
  // Αιχμηρή «σφήνα»: στην κορυφή (200,0) η γωνία είναι ~2.9° (< 20°).
  const SLIVER = {
    polygon: [
      { x: -200, y: -10 }, { x: 200, y: 0 }, { x: -200, y: 10 },
    ],
  };

  it('square composite (90° γωνίες) → χωρίς sectionAngleTooAcute', () => {
    const r = validateColumnParams(makeColumn({ kind: 'composite', composite: SQUARE }));
    expect(r.codeViolations).not.toContain('column.validation.codeViolations.sectionAngleTooAcute');
  });

  it('flags sectionAngleTooAcute για αιχμηρή σφήνα (< 20°)', () => {
    const r = validateColumnParams(makeColumn({ kind: 'composite', composite: SLIVER }));
    expect(r.codeViolations).toContain('column.validation.codeViolations.sectionAngleTooAcute');
  });

  it('αιχμηρή σφήνα = non-blocking code violation, ΟΧΙ hard error (γεωμετρικά έγκυρη)', () => {
    const r = validateColumnParams(makeColumn({ kind: 'composite', composite: SLIVER }));
    expect(r.hardErrors).toHaveLength(0);
    expect(r.bimValidation.hasCodeViolations).toBe(true);
  });
});
