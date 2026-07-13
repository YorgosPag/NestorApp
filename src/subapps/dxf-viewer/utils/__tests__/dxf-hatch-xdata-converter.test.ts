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

/**
 * A polyline boundary path: `1071 n` + n vertices, each written as `coordsPerVert`
 * consecutive 1040 scalars (2 = x,y | 3 = x,y,bulge). AutoCAD uses both encodings.
 */
const polylinePath = (
  verts: ReadonlyArray<readonly [number, number, number?]>,
  coordsPerVert: 2 | 3,
): Array<[string, string | number]> => {
  const out: Array<[string, string | number]> = [['1071', verts.length]];
  for (const [x, y, b] of verts) {
    out.push(['1040', x], ['1040', y]);
    if (coordsPerVert === 3) out.push(['1040', b ?? 0]);
  }
  return out;
};

const insertWith = (pairs: Pair[], layer = 'HATCHLAYER'): EntityData =>
  ({ type: 'INSERT', layer, data: { '2': '*X6' }, pairs });

/** One R14 pattern-def family before world-delta encoding: line-local delta + final angle. */
interface FamilySpec {
  /** Final baked line angle (radians). */
  readonly angleRad: number;
  /** World phase base point. */
  readonly base: readonly [number, number];
  /** Line-LOCAL delta `[along-stagger, perpendicular-spacing]` — encoded to world below. */
  readonly localDelta: readonly [number, number];
  /** Dash pattern (`>0` line, `<0` gap; empty ⇒ solid). */
  readonly dashes: readonly number[];
}

/**
 * ADR-647 Φ1 — the pattern-definition section that follows the `1071 0` boundary terminator, with
 * COMPLETE families (unlike the truncated `patternTail` above). Each family's line-local delta is
 * rotated into a WORLD delta (`world = R(angle)·local`) so the parser's inverse un-rotation is what
 * is under test. Closes with the trailer + `1002 }`.
 */
const patternDefTail = (families: readonly FamilySpec[]): Array<[string, string | number]> => {
  const out: Array<[string, string | number]> = [
    ['1071', 0],            // boundary terminator
    ['1070', 0], ['1070', 1],
    ['1040', 0.0], ['1040', 0.005],
    ['1070', 0], ['1070', families.length],
  ];
  for (const f of families) {
    const c = Math.cos(f.angleRad);
    const s = Math.sin(f.angleRad);
    const wx = c * f.localDelta[0] - s * f.localDelta[1];
    const wy = s * f.localDelta[0] + c * f.localDelta[1];
    out.push(['1040', f.angleRad], ['1040', f.base[0]], ['1040', f.base[1]], ['1040', wx], ['1040', wy]);
    out.push(['1070', f.dashes.length]);
    for (const d of f.dashes) out.push(['1040', d]);
  }
  out.push(['1040', 0.0], ['1071', 1], ['1040', 0.0], ['1040', 0.0], ['1040', 0.0], ['1002', '}']);
  return out;
};

interface InlineLine { angle: number; origin: [number, number]; delta: [number, number]; dashes: number[]; }
const inlineLinesOf = (hatch: AnySceneEntity | null): InlineLine[] =>
  (hatch as unknown as { inlinePattern?: { lines: InlineLine[] } })?.inlinePattern?.lines ?? [];

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

  // ADR-635 — 3-coord (x,y,bulge) polyline boundary. Before the stride fix these were read
  // at stride 2, shifting every vertex by one scalar → spurious (0,x)/(x,0) verts that blew the
  // hatch bbox to km-scale (KADOS: 7/117 hatches at ~8.5 km, y≈x → fit-to-view = a dot).
  it('reads a 3-coord (x,y,bulge) polyline boundary at stride 3 → correct (x,y) verts', () => {
    const verts = [[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0]] as const;
    const pairs = P(...xdataHead('GRASS', 1, 0), ...polylinePath(verts, 3), ...patternTail);
    const hatch = tryConvertInsertHatch(insertWith(pairs), 3);
    expect(hatch).not.toBeNull();
    const h = hatch as unknown as { boundaryPaths: Array<Array<{ x: number; y: number }>> };
    expect(h.boundaryPaths[0]).toEqual([
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
    ]);
  });

  it('reads a 2-coord (x,y) polyline boundary at stride 2 (backward-compat, unchanged)', () => {
    const verts = [[0, 0], [10, 0], [10, 10], [0, 10]] as const;
    const pairs = P(...xdataHead('GRASS', 1, 0), ...polylinePath(verts, 2), ...patternTail);
    const hatch = tryConvertInsertHatch(insertWith(pairs), 2);
    expect(hatch).not.toBeNull();
    const h = hatch as unknown as { boundaryPaths: Array<Array<{ x: number; y: number }>> };
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

// ADR-647 Φ1 — the R12 converter now reads the FULL R14_HATCH_DATA pattern definition into an
// `inlinePattern`, so the hatch renders/exports 1:1 with AutoCAD (preserve-native) instead of
// leaning on a possibly-divergent catalog def. Conversions (rad→deg, world-delta un-rotation,
// dashes) are empirically locked vs the exploded `*X#` LINEs (ADR-647 ground-truth, residuals ~1e-9).
describe('tryConvertInsertHatch — R14 pattern-def → inlinePattern (ADR-647 Φ1)', () => {
  it('parses a solid single-family pattern (ANSI31 @45°) with un-rotated line-local delta', () => {
    const spacing = 0.03175;
    const family: FamilySpec = {
      angleRad: Math.PI / 4, base: [0, 0], localDelta: [0, spacing], dashes: [],
    };
    const pairs = P(...xdataHead('ANSI31', 0.005, 0), ...squareEdges(), ...patternDefTail([family]));
    const lines = inlineLinesOf(tryConvertInsertHatch(insertWith(pairs), 1));

    expect(lines).toHaveLength(1);
    expect(lines[0].angle).toBeCloseTo(45, 6);            // rad→deg
    expect(lines[0].delta[0]).toBeCloseTo(0, 9);          // along-stagger
    expect(lines[0].delta[1]).toBeCloseTo(spacing, 9);    // perpendicular spacing (un-rotation)
    expect(lines[0].dashes).toEqual([]);                  // solid
    expect(lines[0].origin).toEqual([0, 0]);
  });

  it('parses a two-family dashed pattern (SQUARE 0/90°) preserving dashes + phase', () => {
    const spacing = 0.127;
    const families: FamilySpec[] = [
      { angleRad: 0, base: [0, 0], localDelta: [0, spacing], dashes: [0.127, -0.127] },
      { angleRad: Math.PI / 2, base: [0, spacing / 2], localDelta: [0, spacing], dashes: [0.127, -0.127] },
    ];
    const pairs = P(...xdataHead('SQUARE', 0.005, 0), ...squareEdges(), ...patternDefTail(families));
    const lines = inlineLinesOf(tryConvertInsertHatch(insertWith(pairs), 2));

    expect(lines).toHaveLength(2);
    expect(lines.map((l) => Math.round(l.angle)).sort((a, b) => a - b)).toEqual([0, 90]);
    for (const l of lines) {
      expect(l.delta[1]).toBeCloseTo(spacing, 9);
      expect(l.dashes).toHaveLength(2);
      expect(l.dashes[0]).toBeCloseTo(0.127, 9);
      expect(l.dashes[1]).toBeCloseTo(-0.127, 9);
    }
  });

  it('parses a three-family pattern (HEX) — all families read', () => {
    const spacing = 0.027496;
    const mk = (deg: number): FamilySpec => ({
      angleRad: (deg * Math.PI) / 180, base: [0, 0], localDelta: [0, spacing], dashes: [0.01588, -0.01588],
    });
    const pairs = P(...xdataHead('HEX', 0.005, 0), ...squareEdges(), ...patternDefTail([mk(30), mk(90), mk(150)]));
    const lines = inlineLinesOf(tryConvertInsertHatch(insertWith(pairs), 3));

    expect(lines).toHaveLength(3);
    for (const l of lines) expect(l.delta[1]).toBeCloseTo(spacing, 9);
  });

  it('leaves inlinePattern undefined for a truncated pattern-def tail (defensive stop)', () => {
    // The legacy `patternTail` claims numFamilies=3 but supplies one lone 1040 then `1002 }`.
    const pairs = P(...xdataHead('GRASS', 0.005, 0), ...squareEdges(), ...patternTail);
    expect(inlineLinesOf(tryConvertInsertHatch(insertWith(pairs), 4))).toEqual([]);
  });
});

// ADR-647 Φ2b — R14 boundary bulges (7/117 GRATE hatches, 11 arcs). A stride-3 polyline vertex
// carries a standard DXF bulge = tan(θ/4); a non-zero bulge tessellates the arc via the shared
// `bulgeToPolyline` SSoT (ADR-510), while an all-straight path keeps its raw vertices unchanged.
describe('extractR14BoundaryPaths — bulge tessellation (ADR-647 Φ2b)', () => {
  it('tessellates a boundary arc when a vertex carries a non-zero bulge', () => {
    // A closed loop where the segment (10,0)→(10,10) bulges out to a quarter arc (bulge = tan(90°/4)).
    const verts = [[0, 0, 0], [10, 0, 0.41421356], [10, 10, 0], [0, 10, 0]] as const;
    const pairs = P(...xdataHead('GRATE', 1, 0), ...polylinePath(verts, 3), ...patternTail);
    const h = tryConvertInsertHatch(insertWith(pairs), 5) as unknown as {
      boundaryPaths: Array<Array<{ x: number; y: number }>>;
    };
    const path = h.boundaryPaths[0];
    // Arc tessellation adds intermediate points → many more than the 4 raw corners.
    expect(path.length).toBeGreaterThan(4);
    // The arc bulges to the RIGHT of the chord (x > 10 somewhere along (10,0)→(10,10)).
    expect(Math.max(...path.map((p) => p.x))).toBeGreaterThan(10);
  });

  it('keeps raw vertices for an all-straight (zero-bulge) stride-3 boundary (no regression)', () => {
    const verts = [[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0]] as const;
    const pairs = P(...xdataHead('GRATE', 1, 0), ...polylinePath(verts, 3), ...patternTail);
    const h = tryConvertInsertHatch(insertWith(pairs), 6) as unknown as {
      boundaryPaths: Array<Array<{ x: number; y: number }>>;
    };
    expect(h.boundaryPaths[0]).toEqual([
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
    ]);
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

  // ADR-635 Φ C.11 — regression for the KADOS.ΓΡΑΜΜΟΣΚΙΑΣΕΙΣ bug (2026-07-11): the R14_HATCH_DATA
  // boundary cache is stored in the `*X#` block's LOCAL space, so the reconstructed hatch MUST ride
  // the INSERT block transform (like the exploded siblings) instead of keeping the raw cache coords.
  it('places the reconstructed hatch via the INSERT block transform (local XDATA → world), not raw cache coords', () => {
    // Block *X7 BASED at (1000,2000): its hatch XDATA boundary cache lives in that local frame.
    const blockBody = lines(
      ['0', 'BLOCK'], ['2', '*X7'], ['10', 1000], ['20', 2000], ['30', 0],
      ['0', 'LINE'], ['8', '0'], ['10', 1000], ['20', 2000], ['11', 1010], ['21', 2000],
      ['0', 'ENDBLK'],
    );
    // A closed square in the block's local (base-relative) space: (1000,2000)→+(10,10).
    const boundary: Array<[string, string | number]> = [
      ...edge(1000, 2000, 1010, 2000), ...edge(1010, 2000, 1010, 2010),
      ...edge(1010, 2010, 1000, 2010), ...edge(1000, 2010, 1000, 2000),
    ];
    // INSERTed at world (0,0) → placed hatch = (p − base) = local origin, NOT the raw (1000,2000).
    const insertBody = lines(
      ['0', 'INSERT'], ['5', '2BC'], ['8', 'HATCHLAYER'], ['2', '*X7'],
      ['10', 0], ['20', 0], ['30', 0],
      ...xdataHead('GRASS', 1, 0).map(([c, v]) => [c, v] as [string | number, string | number]),
      ...boundary.map(([c, v]) => [c, v] as [string | number, string | number]),
      ...patternTail.map(([c, v]) => [c, v] as [string | number, string | number]),
    );
    const content = [
      ...lines(['0', 'SECTION'], ['2', 'BLOCKS']), ...blockBody, ...lines(['0', 'ENDSEC']),
      ...lines(['0', 'SECTION'], ['2', 'ENTITIES']), ...insertBody, ...lines(['0', 'ENDSEC']),
      ...lines(['0', 'EOF']),
    ].join('\n');

    const entities: AnySceneEntity[] = DxfSceneBuilder.buildScene(content, 'mm').entities;
    const h = entities.find(e => e.type === 'hatch') as unknown as {
      boundaryPaths: Array<Array<{ x: number; y: number }>>;
    };
    expect(h).toBeDefined();
    // First vertex maps to the drawing origin (was (1000,2000) — off-screen — before the fix).
    expect(h.boundaryPaths[0][0].x).toBeCloseTo(0, 6);
    expect(h.boundaryPaths[0][0].y).toBeCloseTo(0, 6);
    // The whole boundary sits at LOCAL scale, never at raw geo-referenced cache coords.
    const maxAbs = Math.max(...h.boundaryPaths[0].flatMap(p => [Math.abs(p.x), Math.abs(p.y)]));
    expect(maxAbs).toBeLessThan(100);
  });
});
