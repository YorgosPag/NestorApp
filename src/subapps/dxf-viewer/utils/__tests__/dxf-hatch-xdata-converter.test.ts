import { tryConvertInsertHatch } from '../dxf-hatch-xdata-converter';
import { DxfSceneBuilder } from '../dxf-scene-builder';
import type { EntityData } from '../dxf-converter-helpers';
import type { AnySceneEntity } from '../../types/scene';

/**
 * ADR-635 Φ C.6 — R12/AC1009 associative-hatch INSERT (ACAD/HATCH XDATA) → single HATCH entity.
 *
 * Proves an R12 hatch (anonymous `*X#` block of exploded lines, INSERTed with ACAD/HATCH XDATA)
 * is reconstructed as ONE `type:'hatch'` scene entity — «perceived as a hatch», not thousands of
 * loose lines. Boundary comes from the R14_HATCH_DATA line edges; pattern/scale/angle from XDATA.
 */

type Pair = readonly [string, string];
const P = (...seq: Array<[string, string | number]>): Pair[] =>
  seq.map(([c, v]) => [c, String(v)] as Pair);

/** ACAD/HATCH XDATA head: 1001 ACAD / 1000 HATCH / 1002 { / 1070 flags / name / scale / angle. */
const xdataHead = (name: string, scale: number, angleDeg: number): Array<[string, string | number]> => [
  ['1001', 'ACAD'], ['1000', 'HATCH'], ['1002', '{'],
  ['1070', 19], ['1000', name], ['1040', scale], ['1040', angleDeg],
  ['1000', 'R14_HATCH_DATA'], ['1000', '2BB'],
  // elevation/normal transform matrix (skipped by the arity check — never 1070 1 + 4×1040)
  ['1011', 1.0], ['1021', 0.0], ['1031', 0.0],
  ['1011', 0.0], ['1021', 1.0], ['1031', 0.0],
  ['1040', 0.0], ['1010', 0.0], ['1020', 0.0], ['1030', 1.0],
  ['1000', name],
  ['1070', 0], ['1070', 0], ['1071', 1], ['1071', 1],
];

/** One line edge: 1070 1 + four 1040 (x1,y1,x2,y2). */
const edge = (x1: number, y1: number, x2: number, y2: number): Array<[string, string | number]> =>
  [['1070', 1], ['1040', x1], ['1040', y1], ['1040', x2], ['1040', y2]];

/** Pattern-definition section that follows the boundary (must NOT be read as edges). */
const patternTail: Array<[string, string | number]> = [
  ['1071', 0], ['1070', 0], ['1070', 1], ['1040', 0.0], ['1040', 0.005],
  ['1070', 0], ['1070', 3], ['1040', 1.5707963], ['1002', '}'],
];

/** A closed square boundary (0,0)→(10,0)→(10,10)→(0,10). */
const squareEdges = (): Array<[string, string | number]> => [
  ...edge(0, 0, 10, 0), ...edge(10, 0, 10, 10),
  ...edge(10, 10, 0, 10), ...edge(0, 10, 0, 0),
];

const insertWith = (pairs: Pair[], layer = 'HATCHLAYER'): EntityData =>
  ({ type: 'INSERT', layer, data: { '2': '*X6' }, pairs });

describe('tryConvertInsertHatch', () => {
  it('reconstructs a hatch entity from ACAD/HATCH XDATA + line-edge boundary', () => {
    const pairs = P(...xdataHead('GRASS', 0.005, 0), ...squareEdges(), ...patternTail);
    const hatch = tryConvertInsertHatch(insertWith(pairs), 7);

    expect(hatch).not.toBeNull();
    expect(hatch?.type).toBe('hatch');
    const h = hatch as unknown as {
      id: string; layerId: string; patternName: string; fillType: string;
      boundaryPaths: Array<Array<{ x: number; y: number }>>; patternScale: number; patternAngle: number;
    };
    expect(h.id).toBe('hatch_insert_7');
    expect(h.layerId).toBe('HATCHLAYER');
    expect(h.patternName).toBe('GRASS');
    expect(h.fillType).toBe('predefined');
    // suggested(GRASS)=1 → user multiplier = 0.005/1
    expect(h.patternScale).toBeCloseTo(0.005, 6);
    expect(h.patternAngle).toBeCloseTo(0, 6);
    expect(h.boundaryPaths).toHaveLength(1);
    expect(h.boundaryPaths[0]).toEqual([
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
    ]);
  });

  it('splits disconnected edge loops into separate boundary paths (islands)', () => {
    const outer = squareEdges();
    const inner = [
      ...edge(2, 2, 4, 2), ...edge(4, 2, 4, 4), ...edge(4, 4, 2, 4), ...edge(2, 4, 2, 2),
    ];
    const pairs = P(...xdataHead('GRASS', 1, 0), ...outer, ...inner, ...patternTail);
    const hatch = tryConvertInsertHatch(insertWith(pairs), 0);
    const h = hatch as unknown as { boundaryPaths: unknown[] };
    expect(h.boundaryPaths).toHaveLength(2);
  });

  it('returns null for a plain INSERT without ACAD/HATCH XDATA', () => {
    const pairs = P(['1001', 'ACADANNOTATIVE'], ['1000', 'AnnotativeData']);
    expect(tryConvertInsertHatch(insertWith(pairs), 0)).toBeNull();
  });

  it('returns null when a curved (arc/ellipse/spline) boundary edge is present → fallback', () => {
    const curved: Array<[string, string | number]> = [
      ...edge(0, 0, 10, 0), ['1070', 2], ['1040', 10], ['1040', 0], ['1040', 5], ['1040', 5], ['1040', 3],
    ];
    const pairs = P(...xdataHead('GRASS', 1, 0), ...curved, ...patternTail);
    expect(tryConvertInsertHatch(insertWith(pairs), 0)).toBeNull();
  });

  it('returns null when R14_HATCH_DATA yields no usable edges', () => {
    const head = xdataHead('GRASS', 1, 0).filter(([c]) => c !== '1000' || true); // keep head
    const pairs = P(...head, ...patternTail); // no boundary edges at all
    expect(tryConvertInsertHatch(insertWith(pairs), 0)).toBeNull();
  });
});

describe('buildScene — R12 hatch INSERT is not exploded into loose lines', () => {
  function lines(...pairs: Array<[string | number, string | number]>): string[] {
    return pairs.flatMap(([c, v]) => [String(c), String(v)]);
  }

  it('emits ONE hatch entity and ZERO lines for a hatch-tagged INSERT', () => {
    // Anonymous block *X6 with several pattern LINEs that would explode without the gate.
    const blockBody = lines(
      ['0', 'BLOCK'], ['2', '*X6'], ['10', 0], ['20', 0], ['30', 0],
      ['0', 'LINE'], ['8', '0'], ['10', 0], ['20', 0], ['11', 10], ['21', 10],
      ['0', 'LINE'], ['8', '0'], ['10', 2], ['20', 2], ['11', 8], ['21', 8],
      ['0', 'ENDBLK'],
    );
    const insertBody = lines(
      ['0', 'INSERT'], ['5', '2BB'], ['8', 'HATCHLAYER'], ['2', '*X6'],
      ['10', 0], ['20', 0], ['30', 0],
      ...xdataHead('GRASS', 0.005, 0).map(([c, v]) => [c, v] as [string | number, string | number]),
      ...squareEdges().map(([c, v]) => [c, v] as [string | number, string | number]),
      ...patternTail.map(([c, v]) => [c, v] as [string | number, string | number]),
    );
    const content = [
      ...lines(['0', 'SECTION'], ['2', 'BLOCKS']), ...blockBody, ...lines(['0', 'ENDSEC']),
      ...lines(['0', 'SECTION'], ['2', 'ENTITIES']), ...insertBody, ...lines(['0', 'ENDSEC']),
      ...lines(['0', 'EOF']),
    ].join('\n');

    const entities: AnySceneEntity[] = DxfSceneBuilder.buildScene(content, 'mm').entities;
    expect(entities.filter(e => e.type === 'line')).toHaveLength(0);
    expect(entities.filter(e => e.type === 'hatch')).toHaveLength(1);
    const h = entities.find(e => e.type === 'hatch') as unknown as { patternName: string };
    expect(h.patternName).toBe('GRASS');
  });
});
