/**
 * ADR-362 Phase H2 — DIMENSION entity writer unit tests.
 *
 * Coverage:
 *   - `writeDimensionSection()` wraps in SECTION/ENTITIES/ENDSEC
 *   - linear (type 0): defPoints[0/1] → codes 13/23/14/24; rotation → code 50
 *   - aligned (type 1): same point codes, no code 50
 *   - angular2L (type 2): codes 13-16/23-26 for 5 defPoints
 *   - angular3P (type 5): codes 13-16/23-26 for 4 defPoints
 *   - H3 placeholder: code 9 comment line
 *   - style name → code 3; text override → code 1
 *   - userText undefined / '<>' → code 1 = ''
 */

import { writeDimensionSection } from '../dxf-dimension-writer';
import type { DimensionWriterEntry } from '../dxf-dimension-writer';
import type {
  DimensionEntity,
  LinearDimensionEntity,
  AlignedDimensionEntity,
  Angular2LDimensionEntity,
  Angular3PDimensionEntity,
  RadiusDimensionEntity,
  DiameterDimensionEntity,
  ArcLengthDimensionEntity,
  JoggedRadiusDimensionEntity,
  OrdinateDimensionEntity,
  BaselineDimensionEntity,
  ContinuedDimensionEntity,
} from '../../types/dimension';
import type { Point2D } from '../../rendering/types/Types';

// ──────────────────────────────────────────────────────────────────────────────
// Fixture helpers
// ──────────────────────────────────────────────────────────────────────────────

function pt(x: number, y: number): Point2D { return { x, y }; }

function makeLinear(overrides: Partial<LinearDimensionEntity> = {}): LinearDimensionEntity {
  return {
    id: 'dim-linear-1',
    type: 'DIMENSION',
    dimensionType: 'linear',
    layerId: '0',
    styleId: 'style-1',
    defPoints: [pt(0, 0), pt(100, 0), pt(50, 20)],
    rotation: 0,
    measurementValue: 100,
    ...overrides,
  } as LinearDimensionEntity;
}

function makeAligned(overrides: Partial<AlignedDimensionEntity> = {}): AlignedDimensionEntity {
  return {
    id: 'dim-aligned-1',
    type: 'DIMENSION',
    dimensionType: 'aligned',
    layerId: '0',
    styleId: 'style-1',
    defPoints: [pt(0, 0), pt(30, 40), pt(15, 20)],
    measurementValue: 50,
    ...overrides,
  } as AlignedDimensionEntity;
}

function makeAngular2L(overrides: Partial<Angular2LDimensionEntity> = {}): Angular2LDimensionEntity {
  return {
    id: 'dim-ang2l-1',
    type: 'DIMENSION',
    dimensionType: 'angular2L',
    layerId: '0',
    styleId: 'style-1',
    defPoints: [pt(0, 0), pt(10, 0), pt(10, 0), pt(10, 10), pt(5, 5)],
    measurementValue: 45,
    ...overrides,
  } as Angular2LDimensionEntity;
}

function makeAngular3P(overrides: Partial<Angular3PDimensionEntity> = {}): Angular3PDimensionEntity {
  return {
    id: 'dim-ang3p-1',
    type: 'DIMENSION',
    dimensionType: 'angular3P',
    layerId: '0',
    styleId: 'style-1',
    defPoints: [pt(5, 5), pt(10, 0), pt(0, 10), pt(8, 8)],
    measurementValue: 90,
    ...overrides,
  } as Angular3PDimensionEntity;
}

function entry(entity: DimensionEntity, styleName = 'ISO-25'): DimensionWriterEntry {
  return { entity, styleName };
}

/** Find first value after code (scans only even/code positions). */
function findCode(lines: string[], code: string): string | undefined {
  for (let i = 0; i < lines.length - 1; i += 2) {
    if (lines[i] === code) return lines[i + 1];
  }
  return undefined;
}

/** All values that follow a given code (scans only even/code positions). */
function findAllCodes(lines: string[], code: string): string[] {
  const result: string[] = [];
  for (let i = 0; i < lines.length - 1; i += 2) {
    if (lines[i] === code) result.push(lines[i + 1]);
  }
  return result;
}

// ──────────────────────────────────────────────────────────────────────────────
// Structure tests
// ──────────────────────────────────────────────────────────────────────────────

describe('writeDimensionSection — structure', () => {
  it('wraps output in SECTION/ENTITIES/ENDSEC', () => {
    const out = writeDimensionSection([entry(makeLinear())]);
    expect(out).toContain('SECTION');
    expect(out).toContain('ENTITIES');
    expect(out).toContain('ENDSEC');
  });

  it('empty array emits SECTION wrapper with no DIMENSION entries', () => {
    const out = writeDimensionSection([]);
    expect(out).toContain('SECTION');
    expect(out).toContain('ENDSEC');
    expect(findAllCodes(out, '0').filter((v) => v === 'DIMENSION')).toHaveLength(0);
  });

  it('emits one DIMENSION entity per entry', () => {
    const out = writeDimensionSection([
      entry(makeLinear()),
      entry(makeAligned()),
    ]);
    expect(findAllCodes(out, '0').filter((v) => v === 'DIMENSION')).toHaveLength(2);
  });

  it('emits AcDbEntity subclass marker', () => {
    const out = writeDimensionSection([entry(makeLinear())]);
    expect(findAllCodes(out, '100')).toContain('AcDbEntity');
  });

  it('emits AcDbDimension subclass marker', () => {
    const out = writeDimensionSection([entry(makeLinear())]);
    expect(findAllCodes(out, '100')).toContain('AcDbDimension');
  });

  it('emits anonymous block reference *D0 for first entry', () => {
    const out = writeDimensionSection([entry(makeLinear())]);
    expect(findAllCodes(out, '2')).toContain('*D0');
  });

  it('emits sequential block indices *D0/*D1 for two entries', () => {
    const out = writeDimensionSection([entry(makeLinear()), entry(makeAligned())]);
    const blockNames = findAllCodes(out, '2').filter((v) => v.startsWith('*D'));
    expect(blockNames).toContain('*D0');
    expect(blockNames).toContain('*D1');
  });

  it('emits style name via code 3', () => {
    const out = writeDimensionSection([entry(makeLinear(), 'MY_STYLE')]);
    expect(findAllCodes(out, '3')).toContain('MY_STYLE');
  });

  it('emits layer name via code 8', () => {
    const out = writeDimensionSection([entry(makeLinear({ layerId: 'DIM_LAYER' }))]);
    expect(findAllCodes(out, '8')).toContain('DIM_LAYER');
  });

  it('emits measurement value via code 42', () => {
    const out = writeDimensionSection([entry(makeLinear({ measurementValue: 123.45 }))]);
    expect(findAllCodes(out, '42')).toContain('123.45');
  });

  it('emits text rotation via code 53 when provided', () => {
    const out = writeDimensionSection([entry(makeLinear({ textRotation: 30 }))]);
    expect(findAllCodes(out, '53')).toContain('30');
  });

  it('omits code 53 when textRotation is undefined', () => {
    const out = writeDimensionSection([entry(makeLinear())]);
    expect(findAllCodes(out, '53')).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Text override (code 1)
// ──────────────────────────────────────────────────────────────────────────────

describe('writeDimensionSection — code 1 (text override)', () => {
  it('undefined userText → code 1 = empty string', () => {
    const out = writeDimensionSection([entry(makeLinear({ userText: undefined }))]);
    expect(findCode(out, '1')).toBe('');
  });

  it('"<>" userText → code 1 = empty string', () => {
    const out = writeDimensionSection([entry(makeLinear({ userText: '<>' }))]);
    expect(findCode(out, '1')).toBe('');
  });

  it('custom userText passthrough', () => {
    const out = writeDimensionSection([entry(makeLinear({ userText: 'CUSTOM' }))]);
    expect(findCode(out, '1')).toBe('CUSTOM');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Linear (type 0)
// ──────────────────────────────────────────────────────────────────────────────

describe('writeDimensionSection — linear (type 0)', () => {
  it('emits code 70 = "0"', () => {
    const out = writeDimensionSection([entry(makeLinear())]);
    expect(findAllCodes(out, '70')).toContain('0');
  });

  it('emits AcDbAlignedDimension subclass', () => {
    const out = writeDimensionSection([entry(makeLinear())]);
    expect(findAllCodes(out, '100')).toContain('AcDbAlignedDimension');
  });

  it('emits AcDbRotatedDimension subclass', () => {
    const out = writeDimensionSection([entry(makeLinear())]);
    expect(findAllCodes(out, '100')).toContain('AcDbRotatedDimension');
  });

  it('emits extOrigin1 via codes 13/23', () => {
    const entity = makeLinear({ defPoints: [pt(10, 20), pt(110, 20), pt(60, 40)] });
    const out = writeDimensionSection([entry(entity)]);
    expect(findAllCodes(out, '13')).toContain('10');
    expect(findAllCodes(out, '23')).toContain('20');
  });

  it('emits extOrigin2 via codes 14/24', () => {
    const entity = makeLinear({ defPoints: [pt(10, 20), pt(110, 20), pt(60, 40)] });
    const out = writeDimensionSection([entry(entity)]);
    expect(findAllCodes(out, '14')).toContain('110');
    expect(findAllCodes(out, '24')).toContain('20');
  });

  it('emits rotation via code 50', () => {
    const out = writeDimensionSection([entry(makeLinear({ rotation: 45 }))]);
    expect(findAllCodes(out, '50')).toContain('45');
  });

  it('emits rotation 0 when undefined', () => {
    const entity = makeLinear({ rotation: undefined });
    const out = writeDimensionSection([entry(entity)]);
    expect(findAllCodes(out, '50')).toContain('0');
  });

  it('emits dimLineRef as ref point (codes 10/20)', () => {
    const entity = makeLinear({ defPoints: [pt(0, 0), pt(100, 0), pt(50, 20)] });
    const out = writeDimensionSection([entry(entity)]);
    expect(findAllCodes(out, '10')).toContain('50');
    expect(findAllCodes(out, '20')).toContain('20');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Aligned (type 1)
// ──────────────────────────────────────────────────────────────────────────────

describe('writeDimensionSection — aligned (type 1)', () => {
  it('emits code 70 = "1"', () => {
    const out = writeDimensionSection([entry(makeAligned())]);
    expect(findAllCodes(out, '70')).toContain('1');
  });

  it('emits AcDbAlignedDimension subclass', () => {
    const out = writeDimensionSection([entry(makeAligned())]);
    expect(findAllCodes(out, '100')).toContain('AcDbAlignedDimension');
  });

  it('does NOT emit AcDbRotatedDimension for aligned', () => {
    const out = writeDimensionSection([entry(makeAligned())]);
    expect(findAllCodes(out, '100')).not.toContain('AcDbRotatedDimension');
  });

  it('does NOT emit code 50 for aligned', () => {
    const out = writeDimensionSection([entry(makeAligned())]);
    expect(findAllCodes(out, '50')).toHaveLength(0);
  });

  it('emits defPoints[0] via codes 13/23', () => {
    const entity = makeAligned({ defPoints: [pt(5, 10), pt(35, 50), pt(20, 30)] });
    const out = writeDimensionSection([entry(entity)]);
    expect(findAllCodes(out, '13')).toContain('5');
    expect(findAllCodes(out, '23')).toContain('10');
  });

  it('emits defPoints[1] via codes 14/24', () => {
    const entity = makeAligned({ defPoints: [pt(5, 10), pt(35, 50), pt(20, 30)] });
    const out = writeDimensionSection([entry(entity)]);
    expect(findAllCodes(out, '14')).toContain('35');
    expect(findAllCodes(out, '24')).toContain('50');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Angular 2-line (type 2)
// ──────────────────────────────────────────────────────────────────────────────

describe('writeDimensionSection — angular2L (type 2)', () => {
  it('emits code 70 = "2"', () => {
    const out = writeDimensionSection([entry(makeAngular2L())]);
    expect(findAllCodes(out, '70')).toContain('2');
  });

  it('emits AcDb2LineAngularDimension subclass', () => {
    const out = writeDimensionSection([entry(makeAngular2L())]);
    expect(findAllCodes(out, '100')).toContain('AcDb2LineAngularDimension');
  });

  it('emits line1.a via codes 13/23', () => {
    const entity = makeAngular2L({
      defPoints: [pt(1, 2), pt(3, 4), pt(5, 6), pt(7, 8), pt(9, 10)],
    });
    const out = writeDimensionSection([entry(entity)]);
    expect(findAllCodes(out, '13')).toContain('1');
    expect(findAllCodes(out, '23')).toContain('2');
  });

  it('emits line1.b via codes 14/24', () => {
    const entity = makeAngular2L({
      defPoints: [pt(1, 2), pt(3, 4), pt(5, 6), pt(7, 8), pt(9, 10)],
    });
    const out = writeDimensionSection([entry(entity)]);
    expect(findAllCodes(out, '14')).toContain('3');
    expect(findAllCodes(out, '24')).toContain('4');
  });

  // AutoCAD DXF spec: line2 = code 10 (header ref) → code 15; so code 15 = line2.b.
  it('emits line2.b via codes 15/25', () => {
    const entity = makeAngular2L({
      defPoints: [pt(1, 2), pt(3, 4), pt(5, 6), pt(7, 8), pt(9, 10)],
    });
    const out = writeDimensionSection([entry(entity)]);
    expect(findAllCodes(out, '15')).toContain('7');
    expect(findAllCodes(out, '25')).toContain('8');
  });

  it('emits line2.a as the header ref point via codes 10/20', () => {
    const entity = makeAngular2L({
      defPoints: [pt(1, 2), pt(3, 4), pt(5, 6), pt(7, 8), pt(9, 10)],
    });
    const out = writeDimensionSection([entry(entity)]);
    expect(findAllCodes(out, '10')).toContain('5');
    expect(findAllCodes(out, '20')).toContain('6');
  });

  it('emits arcPoint (defPoints[4]) via codes 16/26', () => {
    const entity = makeAngular2L({
      defPoints: [pt(1, 2), pt(3, 4), pt(5, 6), pt(7, 8), pt(9, 10)],
    });
    const out = writeDimensionSection([entry(entity)]);
    expect(findAllCodes(out, '16')).toContain('9');
    expect(findAllCodes(out, '26')).toContain('10');
  });

  it('falls back to defPoints[3] for arcPoint when defPoints[4] absent', () => {
    const entity = makeAngular2L({
      defPoints: [pt(1, 2), pt(3, 4), pt(5, 6), pt(7, 8)],
    });
    const out = writeDimensionSection([entry(entity)]);
    expect(findAllCodes(out, '16')).toContain('7');
    expect(findAllCodes(out, '26')).toContain('8');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Angular 3-point (type 5)
// ──────────────────────────────────────────────────────────────────────────────

describe('writeDimensionSection — angular3P (type 5)', () => {
  it('emits code 70 = "5"', () => {
    const out = writeDimensionSection([entry(makeAngular3P())]);
    expect(findAllCodes(out, '70')).toContain('5');
  });

  it('emits AcDb3PointAngularDimension subclass', () => {
    const out = writeDimensionSection([entry(makeAngular3P())]);
    expect(findAllCodes(out, '100')).toContain('AcDb3PointAngularDimension');
  });

  // AutoCAD DXF spec: ray1 = code 13, ray2 = code 14, vertex = code 15, arc = code 16.
  it('emits ray1End via codes 13/23', () => {
    const entity = makeAngular3P({
      defPoints: [pt(5, 5), pt(10, 0), pt(0, 10), pt(8, 8)],
    });
    const out = writeDimensionSection([entry(entity)]);
    expect(findAllCodes(out, '13')).toContain('10');
    expect(findAllCodes(out, '23')).toContain('0');
  });

  it('emits ray2End via codes 14/24', () => {
    const entity = makeAngular3P({
      defPoints: [pt(5, 5), pt(10, 0), pt(0, 10), pt(8, 8)],
    });
    const out = writeDimensionSection([entry(entity)]);
    expect(findAllCodes(out, '14')).toContain('0');
    expect(findAllCodes(out, '24')).toContain('10');
  });

  it('emits vertex via codes 15/25', () => {
    const entity = makeAngular3P({
      defPoints: [pt(5, 5), pt(10, 0), pt(0, 10), pt(8, 8)],
    });
    const out = writeDimensionSection([entry(entity)]);
    expect(findAllCodes(out, '15')).toContain('5');
    expect(findAllCodes(out, '25')).toContain('5');
  });

  it('emits arcPoint via codes 16/26', () => {
    const entity = makeAngular3P({
      defPoints: [pt(5, 5), pt(10, 0), pt(0, 10), pt(8, 8)],
    });
    const out = writeDimensionSection([entry(entity)]);
    expect(findAllCodes(out, '16')).toContain('8');
    expect(findAllCodes(out, '26')).toContain('8');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// H3 fixture helpers
// ──────────────────────────────────────────────────────────────────────────────

function makeRadius(overrides: Partial<RadiusDimensionEntity> = {}): RadiusDimensionEntity {
  return {
    id: 'dim-radius-1',
    type: 'dimension',
    dimensionType: 'radius',
    layerId: '0',
    styleId: 'style-1',
    defPoints: [pt(50, 50), pt(80, 50)],
    measurementValue: 30,
    ...overrides,
  } as RadiusDimensionEntity;
}

function makeDiameter(overrides: Partial<DiameterDimensionEntity> = {}): DiameterDimensionEntity {
  return {
    id: 'dim-diam-1',
    type: 'dimension',
    dimensionType: 'diameter',
    layerId: '0',
    styleId: 'style-1',
    defPoints: [pt(20, 50), pt(80, 50)],
    measurementValue: 60,
    ...overrides,
  } as DiameterDimensionEntity;
}

function makeOrdinate(overrides: Partial<OrdinateDimensionEntity> = {}): OrdinateDimensionEntity {
  return {
    id: 'dim-ord-1',
    type: 'dimension',
    dimensionType: 'ordinate',
    layerId: '0',
    styleId: 'style-1',
    defPoints: [pt(100, 200)],
    axis: 'x',
    datum: pt(0, 0),
    measurementValue: 100,
    ...overrides,
  } as OrdinateDimensionEntity;
}

function makeArcLength(overrides: Partial<ArcLengthDimensionEntity> = {}): ArcLengthDimensionEntity {
  return {
    id: 'dim-arc-1',
    type: 'dimension',
    dimensionType: 'arcLength',
    layerId: '0',
    styleId: 'style-1',
    defPoints: [pt(50, 50), pt(20, 80), pt(80, 80)],
    measurementValue: 45,
    ...overrides,
  } as ArcLengthDimensionEntity;
}

function makeJoggedRadius(overrides: Partial<JoggedRadiusDimensionEntity> = {}): JoggedRadiusDimensionEntity {
  return {
    id: 'dim-jog-1',
    type: 'dimension',
    dimensionType: 'joggedRadius',
    layerId: '0',
    styleId: 'style-1',
    defPoints: [pt(0, 0), pt(100, 0), pt(60, 0), pt(50, 0)],
    measurementValue: 100,
    ...overrides,
  } as JoggedRadiusDimensionEntity;
}

function makeBaseline(overrides: Partial<BaselineDimensionEntity> = {}): BaselineDimensionEntity {
  return {
    id: 'dim-base-1',
    type: 'dimension',
    dimensionType: 'baseline',
    layerId: '0',
    styleId: 'style-1',
    defPoints: [pt(200, 0), pt(200, 0), pt(100, 20)],
    parentDimensionId: 'dim-linear-1',
    measurementValue: 200,
    ...overrides,
  } as BaselineDimensionEntity;
}

function makeContinued(overrides: Partial<ContinuedDimensionEntity> = {}): ContinuedDimensionEntity {
  return {
    id: 'dim-cont-1',
    type: 'dimension',
    dimensionType: 'continued',
    layerId: '0',
    styleId: 'style-1',
    defPoints: [pt(150, 0), pt(150, 0), pt(125, 20)],
    parentDimensionId: 'dim-linear-1',
    measurementValue: 50,
    ...overrides,
  } as ContinuedDimensionEntity;
}

// ──────────────────────────────────────────────────────────────────────────────
// Radius (type 4)
// ──────────────────────────────────────────────────────────────────────────────

describe('writeDimensionSection — radius (type 4)', () => {
  it('emits code 70 = "4"', () => {
    const out = writeDimensionSection([entry(makeRadius())]);
    expect(findAllCodes(out, '70')).toContain('4');
  });

  it('emits AcDbRadialDimension subclass', () => {
    const out = writeDimensionSection([entry(makeRadius())]);
    expect(findAllCodes(out, '100')).toContain('AcDbRadialDimension');
  });

  it('emits arcPoint (defPoints[1]) via codes 15/25', () => {
    const e = makeRadius({ defPoints: [pt(50, 50), pt(90, 50)] });
    const out = writeDimensionSection([entry(e)]);
    expect(findAllCodes(out, '15')).toContain('90');
    expect(findAllCodes(out, '25')).toContain('50');
  });

  it('uses center (defPoints[0]) as ref point (codes 10/20)', () => {
    const e = makeRadius({ defPoints: [pt(50, 50), pt(80, 50)] });
    const out = writeDimensionSection([entry(e)]);
    expect(findAllCodes(out, '10')).toContain('50');
    expect(findAllCodes(out, '20')).toContain('50');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Diameter (type 3)
// ──────────────────────────────────────────────────────────────────────────────

describe('writeDimensionSection — diameter (type 3)', () => {
  it('emits code 70 = "3"', () => {
    const out = writeDimensionSection([entry(makeDiameter())]);
    expect(findAllCodes(out, '70')).toContain('3');
  });

  it('emits AcDbDiametricDimension subclass', () => {
    const out = writeDimensionSection([entry(makeDiameter())]);
    expect(findAllCodes(out, '100')).toContain('AcDbDiametricDimension');
  });

  it('emits side2 (defPoints[1]) via codes 15/25', () => {
    const e = makeDiameter({ defPoints: [pt(20, 50), pt(80, 50)] });
    const out = writeDimensionSection([entry(e)]);
    expect(findAllCodes(out, '15')).toContain('80');
    expect(findAllCodes(out, '25')).toContain('50');
  });

  it('uses side1 (defPoints[0]) as ref point (codes 10/20)', () => {
    const e = makeDiameter({ defPoints: [pt(20, 50), pt(80, 50)] });
    const out = writeDimensionSection([entry(e)]);
    expect(findAllCodes(out, '10')).toContain('20');
    expect(findAllCodes(out, '20')).toContain('50');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Ordinate (type 6 / 70)
// ──────────────────────────────────────────────────────────────────────────────

describe('writeDimensionSection — ordinate (type 6/70)', () => {
  // AutoCAD DXF spec code-70 bit 64: set = X-type, clear = Y-type.
  it('X-ordinate emits code 70 = "70" (6 | 64)', () => {
    const out = writeDimensionSection([entry(makeOrdinate({ axis: 'x' }))]);
    expect(findAllCodes(out, '70')).toContain('70');
  });

  it('Y-ordinate emits code 70 = "6"', () => {
    const out = writeDimensionSection([entry(makeOrdinate({ axis: 'y' }))]);
    expect(findAllCodes(out, '70')).toContain('6');
  });

  it('emits AcDbOrdinateDimension subclass', () => {
    const out = writeDimensionSection([entry(makeOrdinate())]);
    expect(findAllCodes(out, '100')).toContain('AcDbOrdinateDimension');
  });

  it('emits featurePoint (defPoints[0]) via codes 13/23', () => {
    const e = makeOrdinate({ defPoints: [pt(100, 200)], axis: 'x', datum: pt(0, 0) });
    const out = writeDimensionSection([entry(e)]);
    expect(findAllCodes(out, '13')).toContain('100');
    expect(findAllCodes(out, '23')).toContain('200');
  });

  it('emits leaderEnd (textMidpoint) via codes 14/24', () => {
    const e = makeOrdinate({
      defPoints: [pt(100, 200)],
      axis: 'x',
      datum: pt(0, 0),
      textMidpoint: pt(120, 200),
    });
    const out = writeDimensionSection([entry(e)]);
    expect(findAllCodes(out, '14')).toContain('120');
    expect(findAllCodes(out, '24')).toContain('200');
  });

  it('uses datum as ref point (codes 10/20)', () => {
    const e = makeOrdinate({ datum: pt(5, 10) });
    const out = writeDimensionSection([entry(e)]);
    expect(findAllCodes(out, '10')).toContain('5');
    expect(findAllCodes(out, '20')).toContain('10');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Arc length (type 32)
// ──────────────────────────────────────────────────────────────────────────────

describe('writeDimensionSection — arcLength (type 32)', () => {
  it('emits code 70 = "32"', () => {
    const out = writeDimensionSection([entry(makeArcLength())]);
    expect(findAllCodes(out, '70')).toContain('32');
  });

  it('emits AcDbArcDimension subclass', () => {
    const out = writeDimensionSection([entry(makeArcLength())]);
    expect(findAllCodes(out, '100')).toContain('AcDbArcDimension');
  });

  it('emits center (defPoints[0]) via codes 13/23', () => {
    const e = makeArcLength({ defPoints: [pt(50, 50), pt(20, 80), pt(80, 80)] });
    const out = writeDimensionSection([entry(e)]);
    expect(findAllCodes(out, '13')).toContain('50');
    expect(findAllCodes(out, '23')).toContain('50');
  });

  it('emits arcStart (defPoints[1]) via codes 14/24', () => {
    const e = makeArcLength({ defPoints: [pt(50, 50), pt(20, 80), pt(80, 80)] });
    const out = writeDimensionSection([entry(e)]);
    expect(findAllCodes(out, '14')).toContain('20');
    expect(findAllCodes(out, '24')).toContain('80');
  });

  it('emits arcEnd (defPoints[2]) via codes 15/25', () => {
    const e = makeArcLength({ defPoints: [pt(50, 50), pt(20, 80), pt(80, 80)] });
    const out = writeDimensionSection([entry(e)]);
    expect(findAllCodes(out, '15')).toContain('80');
    expect(findAllCodes(out, '25')).toContain('80');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Jogged radius (type 36 = 4 | 32)
// ──────────────────────────────────────────────────────────────────────────────

describe('writeDimensionSection — joggedRadius (type 36)', () => {
  it('emits code 70 = "36"', () => {
    const out = writeDimensionSection([entry(makeJoggedRadius())]);
    expect(findAllCodes(out, '70')).toContain('36');
  });

  it('emits AcDbRadialDimensionLarge subclass', () => {
    const out = writeDimensionSection([entry(makeJoggedRadius())]);
    expect(findAllCodes(out, '100')).toContain('AcDbRadialDimensionLarge');
  });

  it('emits jogVertex (defPoints[3]) via codes 13/23', () => {
    const e = makeJoggedRadius({ defPoints: [pt(0, 0), pt(100, 0), pt(60, 0), pt(50, 0)] });
    const out = writeDimensionSection([entry(e)]);
    expect(findAllCodes(out, '13')).toContain('50');
    expect(findAllCodes(out, '23')).toContain('0');
  });

  it('emits arcPoint (defPoints[1]) via codes 15/25', () => {
    const e = makeJoggedRadius({ defPoints: [pt(0, 0), pt(100, 0), pt(60, 0), pt(50, 0)] });
    const out = writeDimensionSection([entry(e)]);
    expect(findAllCodes(out, '15')).toContain('100');
    expect(findAllCodes(out, '25')).toContain('0');
  });

  it('emits jogPoint (defPoints[2]) via codes 16/26', () => {
    const e = makeJoggedRadius({ defPoints: [pt(0, 0), pt(100, 0), pt(60, 0), pt(50, 0)] });
    const out = writeDimensionSection([entry(e)]);
    expect(findAllCodes(out, '16')).toContain('60');
    expect(findAllCodes(out, '26')).toContain('0');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Baseline (type 32)
// ──────────────────────────────────────────────────────────────────────────────

describe('writeDimensionSection — baseline (type 32)', () => {
  it('emits code 70 = "32"', () => {
    const out = writeDimensionSection([entry(makeBaseline())]);
    expect(findAllCodes(out, '70')).toContain('32');
  });

  it('emits AcDbAlignedDimension subclass', () => {
    const out = writeDimensionSection([entry(makeBaseline())]);
    expect(findAllCodes(out, '100')).toContain('AcDbAlignedDimension');
  });

  it('emits newExtOrigin (defPoints[0]) via codes 13/23', () => {
    const e = makeBaseline({ defPoints: [pt(200, 0), pt(200, 0), pt(100, 20)] });
    const out = writeDimensionSection([entry(e)]);
    expect(findAllCodes(out, '13')).toContain('200');
    expect(findAllCodes(out, '23')).toContain('0');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Continued (type 64)
// ──────────────────────────────────────────────────────────────────────────────

describe('writeDimensionSection — continued (type 64)', () => {
  it('emits code 70 = "64"', () => {
    const out = writeDimensionSection([entry(makeContinued())]);
    expect(findAllCodes(out, '70')).toContain('64');
  });

  it('emits AcDbAlignedDimension subclass', () => {
    const out = writeDimensionSection([entry(makeContinued())]);
    expect(findAllCodes(out, '100')).toContain('AcDbAlignedDimension');
  });

  it('emits newExtOrigin (defPoints[0]) via codes 13/23', () => {
    const e = makeContinued({ defPoints: [pt(150, 0), pt(150, 0), pt(125, 20)] });
    const out = writeDimensionSection([entry(e)]);
    expect(findAllCodes(out, '13')).toContain('150');
    expect(findAllCodes(out, '23')).toContain('0');
  });
});
