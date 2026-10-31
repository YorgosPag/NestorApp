/**
 * ADR-635 Φ C.30 — 210/220/230 through the REAL import (`DxfSceneBuilder.buildScene`), one entity family at a time.
 *
 * Every OCS family is pinned three ways: extrusion (0,0,1) written out explicitly, (0,0,−1), and a tilted N where the
 * family has a tilted form. The WCS families (ELLIPSE, MTEXT's point, LINE, POINT, 3DFACE, SPLINE) are pinned the
 * other way round: the same (0,0,−1) must change NOTHING — the list comes from the Autodesk DXF Reference, and
 * passing one of these through OCS would be a new wrong answer, not a stricter right one.
 */

import { DxfSceneBuilder } from '../dxf-scene-builder';
import { readInsertPlacement } from '../dxf-insert-placement';
import type { AnySceneEntity } from '../../types/scene';
import type { ArcEntity, CircleEntity, HatchEntity, LineEntity, PointEntity, PolylineEntity, TextEntity } from '../../types/entities';

type Pair = [string | number, string | number];
const flat = (pairs: Pair[]): string[] => pairs.flatMap(([c, v]) => [String(c), String(v)]);

function dxf(entities: Pair[], blocks?: Pair[]): string {
  return [
    ...(blocks ? flat([['0', 'SECTION'], ['2', 'BLOCKS'], ...blocks, ['0', 'ENDSEC']]) : []),
    ...flat([['0', 'SECTION'], ['2', 'ENTITIES'], ...entities, ['0', 'ENDSEC'], ['0', 'EOF']]),
  ].join('\n');
}

const scene = (entities: Pair[], blocks?: Pair[]): AnySceneEntity[] =>
  DxfSceneBuilder.buildScene(dxf(entities, blocks), 'mm').entities;

function only<T extends AnySceneEntity>(es: AnySceneEntity[], type: string): T {
  const found = es.filter((e) => e.type === type);
  expect(found).toHaveLength(1);
  return found[0] as T;
}

const DEFAULT: Pair[] = [['210', 0], ['220', 0], ['230', 1]];
const FLIPPED: Pair[] = [['210', 0], ['220', 0], ['230', -1]];
/** 45° about X: Ay gains a Z and shrinks by √½ in plan; Ax stays along +X. */
const TILTED: Pair[] = [['210', 0], ['220', -Math.SQRT1_2], ['230', Math.SQRT1_2]];

const closePoint = (p: { x: number; y: number }, x: number, y: number) => {
  expect(p.x).toBeCloseTo(x, 9);
  expect(p.y).toBeCloseTo(y, 9);
};

/** The plan point of a scene arc at angle `deg` — what the file means, independent of how the angles are stored. */
const onArc = (a: ArcEntity, deg: number) => ({
  x: a.center.x + a.radius * Math.cos((deg * Math.PI) / 180),
  y: a.center.y + a.radius * Math.sin((deg * Math.PI) / 180),
});

describe('CIRCLE', () => {
  const circle = (extra: Pair[]): Pair[] => [['0', 'CIRCLE'], ['10', 3], ['20', 4], ['30', 0], ['40', 2], ...extra];

  it('(0,0,1) ⇒ the center as written', () => {
    const e = only<CircleEntity>(scene(circle(DEFAULT)), 'circle');
    expect(e.center).toEqual({ x: 3, y: 4 });
    expect(e.radius).toBe(2);
  });

  it('(0,0,−1) ⇒ X mirrors, Y and the radius stay', () => {
    const e = only<CircleEntity>(scene(circle(FLIPPED)), 'circle');
    closePoint(e.center, -3, 4);
    expect(e.radius).toBe(2);
  });

  it('tilted ⇒ a closed polyline of its true projection, not a circle in the wrong place', () => {
    const e = only<PolylineEntity>(scene(circle(TILTED)), 'polyline');
    expect(e.closed).toBe(true);
    const xs = e.vertices.map((v) => v.x);
    const ys = e.vertices.map((v) => v.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(4, 2); // Ax stays full length
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(4 * Math.SQRT1_2, 2); // Ay foreshortens
  });
});

describe('ARC', () => {
  const arc = (extra: Pair[], start = 30, end = 90): Pair[] =>
    [['0', 'ARC'], ['10', 3], ['20', 4], ['30', 0], ['40', 2], ['50', start], ['51', end], ...extra];

  it('(0,0,1) ⇒ center and angles as written', () => {
    const e = only<ArcEntity>(scene(arc(DEFAULT)), 'arc');
    expect(e.center).toEqual({ x: 3, y: 4 });
    expect([e.startAngle, e.endAngle]).toEqual([30, 90]);
  });

  it('(0,0,−1) ⇒ mirrored angles AND swapped ends: the world arc stays CCW and covers the mirrored span', () => {
    const e = only<ArcEntity>(scene(arc(FLIPPED)), 'arc');
    closePoint(e.center, -3, 4);
    expect([e.startAngle, e.endAngle]).toEqual([90, 150]);
    expect(e.counterclockwise).toBeUndefined();
    // the OCS endpoints, mirrored by hand: (3 + 2cos, 4 + 2sin) → x negated
    const start = { x: -(3 + 2 * Math.cos(Math.PI / 6)), y: 4 + 2 * Math.sin(Math.PI / 6) };
    const end = { x: -(3 + 2 * Math.cos(Math.PI / 2)), y: 4 + 2 * Math.sin(Math.PI / 2) };
    closePoint(onArc(e, e.endAngle), start.x, start.y);
    closePoint(onArc(e, e.startAngle), end.x, end.y);
    // … and the span passes through the mirrored middle of the arc, not its complement
    const mid = { x: -(3 + 2 * Math.cos(Math.PI / 3)), y: 4 + 2 * Math.sin(Math.PI / 3) };
    closePoint(onArc(e, 120), mid.x, mid.y);
  });

  it('(0,0,−1) on an arc across 0° keeps the short span', () => {
    const e = only<ArcEntity>(scene(arc(FLIPPED, 350, 10)), 'arc');
    expect([e.startAngle, e.endAngle]).toEqual([170, 190]);
  });

  it('(0,0,−1) on a whole-turn ARC keeps a whole turn (mapping would collapse both ends onto one angle)', () => {
    const e = only<ArcEntity>(scene(arc(FLIPPED, 0, 360)), 'arc');
    expect(Math.abs(e.endAngle - e.startAngle)).toBe(360);
  });

  it('tilted ⇒ an open polyline from the projected start to the projected end', () => {
    const e = only<PolylineEntity>(scene(arc(TILTED, 0, 90)), 'polyline');
    expect(e.closed).toBe(false);
    closePoint(e.vertices[0]!, 5, 4 * Math.SQRT1_2);
    closePoint(e.vertices[e.vertices.length - 1]!, 3, 6 * Math.SQRT1_2);
  });
});

describe('TEXT / ATTRIB / ATTDEF (OCS)', () => {
  const text = (extra: Pair[]): Pair[] => [['0', 'TEXT'], ['10', 3], ['20', 4], ['30', 0], ['40', 1], ['1', 'ΑΒΓ'], ...extra];

  it('(0,0,1) ⇒ anchor, rotation, alignment as written', () => {
    const e = only<TextEntity>(scene(text([['50', 30], ...DEFAULT])), 'text');
    expect(e.position).toEqual({ x: 3, y: 4 });
    expect(e.rotation).toBe(30);
    expect(e.alignment).toBe('left');
  });

  it('(0,0,−1) ⇒ mirrored anchor, readable rotation −r, and the text hangs off its far end', () => {
    const e = only<TextEntity>(scene(text([['50', 30], ...FLIPPED])), 'text');
    closePoint(e.position!, -3, 4);
    expect(e.rotation).toBeCloseTo(330, 9);
    expect(e.alignment).toBe('right');
    expect(e.textNode?.attachment).toBe('BR');
  });

  it('(0,0,−1) at rotation 0 stays upright — never upside down', () => {
    const e = only<TextEntity>(scene(text(FLIPPED)), 'text');
    expect(e.rotation).toBe(0);
  });

  it('(0,0,−1) centered on 11/21: the REAL anchor mirrors, and a center stays a center', () => {
    const e = only<TextEntity>(scene(text([['11', 7], ['21', 8], ['31', 0], ['72', 1], ...FLIPPED])), 'text');
    closePoint(e.position!, -7, 8);
    expect(e.alignment).toBe('center');
  });

  it('ATTRIB and ATTDEF share the OCS rule', () => {
    const attr = (type: string): Pair[] => [['0', type], ['10', 3], ['20', 4], ['40', 1], ['1', 'V'], ['2', 'TAG'], ['70', 0], ...FLIPPED];
    for (const type of ['ATTRIB', 'ATTDEF']) closePoint(only<TextEntity>(scene(attr(type)), 'text').position!, -3, 4);
  });
});

describe('MTEXT — NOT an OCS entity', () => {
  const mtext = (extra: Pair[]): Pair[] => [['0', 'MTEXT'], ['10', 3], ['20', 4], ['30', 0], ['40', 1], ['71', 1], ['1', 'ΑΒΓ'], ...extra];

  it('(0,0,1) with no 11 ⇒ point and angle as written', () => {
    const e = only<TextEntity>(scene(mtext([['50', 30], ...DEFAULT])), 'text');
    expect(e.position).toEqual({ x: 3, y: 4 });
    expect(e.rotation).toBe(30);
  });

  it('(0,0,−1) ⇒ the point stays as written: group 10 of MTEXT is WCS', () => {
    const e = only<TextEntity>(scene(mtext([['11', -1], ['21', 0], ['31', 0], ...FLIPPED])), 'text');
    expect(e.position).toEqual({ x: 3, y: 4 });
  });

  it('11/21 is the WCS direction and wins over 50 — a rotated MTEXT used to lose its rotation', () => {
    const e = only<TextEntity>(scene(mtext([['11', 0], ['21', 1], ['31', 0], ['50', 12]])), 'text');
    expect(e.rotation).toBeCloseTo(90, 9);
    expect(e.textNode?.rotation).toBeCloseTo(90, 9);
  });

  it('(0,0,−1) reads backwards in plan ⇒ readable rotation, attachment column swapped', () => {
    const e = only<TextEntity>(scene(mtext([['11', -1], ['21', 0], ['31', 0], ...FLIPPED])), 'text');
    expect(e.rotation).toBeCloseTo(0, 9);
    expect(e.alignment).toBe('right');
    expect(e.textNode?.attachment).toBe('TR');
  });

  it('no 11 under (0,0,−1) ⇒ 50 is the fallback, measured in the plane of the 210', () => {
    const e = only<TextEntity>(scene(mtext([['50', 30], ...FLIPPED])), 'text');
    expect(e.rotation).toBeCloseTo(330, 9);
  });
});

describe('HATCH', () => {
  /** Header + one polyline square path (0,0)→(10,10), elevation Z, a seed, and one inline pattern line. */
  const hatch = (extrusion: Pair[], elevation = 0, extra: Pair[] = []): Pair[] => [
    ['0', 'HATCH'], ['10', 0], ['20', 0], ['30', elevation], ...extrusion,
    ['2', 'ANSI31'], ['70', 0], ['71', 0], ['91', 1],
    ['92', 2], ['72', 0], ['73', 1], ['93', 4],
    ['10', 1], ['20', 2], ['10', 11], ['20', 2], ['10', 11], ['20', 12], ['10', 1], ['20', 12],
    ['97', 0], ['75', 0], ['76', 1], ['52', 30], ['41', 1],
    ...extra,
    ['98', 1], ['10', 5], ['20', 6],
  ];
  const PATTERN_LINE: Pair[] = [['78', 1], ['53', 30], ['43', 2], ['44', 3], ['45', 0], ['46', 4], ['79', 0]];

  it('(0,0,1) ⇒ boundary, seed and angle as written', () => {
    const e = only<HatchEntity>(scene(hatch(DEFAULT)), 'hatch');
    expect(e.boundaryPaths[0]![0]).toEqual({ x: 1, y: 2 });
    expect(e.seedPoints?.[0]).toEqual({ x: 5, y: 6 });
    expect(e.patternAngle).toBe(30);
  });

  it('(0,0,−1) ⇒ boundary and seed mirror, the angle maps', () => {
    const e = only<HatchEntity>(scene(hatch(FLIPPED)), 'hatch');
    closePoint(e.boundaryPaths[0]![0]!, -1, 2);
    closePoint(e.boundaryPaths[0]![2]!, -11, 12);
    closePoint(e.seedPoints![0]!, -5, 6);
    expect(e.patternAngle).toBe(150);
  });

  it('(0,0,−1) ⇒ the inline pattern line mirrors with its boundary: angle, origin, offset', () => {
    const e = only<HatchEntity>(scene(hatch(FLIPPED, 0, PATTERN_LINE)), 'hatch');
    const line = e.inlinePattern!.lines[0]!;
    expect(line.angle).toBe(150);
    expect(line.origin[0]).toBeCloseTo(-2, 9);
    expect(line.origin[1]).toBeCloseTo(3, 9);
    // world offset (0,4) stays (0,4) under X → −X; re-express in the local frame of a 150° line
    const rad = (150 * Math.PI) / 180;
    expect(line.delta[0]).toBeCloseTo(4 * Math.sin(rad), 9);
    expect(line.delta[1]).toBeCloseTo(4 * Math.cos(rad), 9);
  });

  it('a seed or path 30 after the 91 cannot pose as the elevation, and a tilted plane uses the real one', () => {
    const e = only<HatchEntity>(scene(hatch(TILTED, 10, [['30', 999]])), 'hatch');
    // Az = (0, −√½, √½): the elevation shifts plan Y by 10·(−√½), and Ay foreshortens Y by √½
    closePoint(e.boundaryPaths[0]![0]!, 1, (2 - 10) * Math.SQRT1_2);
  });

  it('arc edge (0,0,−1): sampled in the OCS, so the bulge of the boundary mirrors — no second reversal', () => {
    const edge: Pair[] = [
      ['0', 'HATCH'], ['10', 0], ['20', 0], ['30', 0], ...FLIPPED,
      ['2', 'SOLID'], ['70', 1], ['71', 0], ['91', 1],
      ['92', 1], ['93', 2],
      ['72', 2], ['10', 0], ['20', 0], ['40', 5], ['50', 0], ['51', 180], ['73', 1],
      ['72', 1], ['10', -5], ['20', 0], ['11', 5], ['21', 0],
      ['97', 0], ['75', 0], ['76', 1], ['98', 0],
    ];
    const e = only<HatchEntity>(scene(edge), 'hatch');
    const ys = e.boundaryPaths[0]!.map((p) => p.y);
    expect(Math.max(...ys)).toBeGreaterThan(4.9); // the upper half disc stays upper: X flips, Y does not
    expect(Math.min(...ys)).toBeCloseTo(0, 6);
  });
});

describe('SOLID / TRACE (OCS) vs 3DFACE (WCS)', () => {
  const quad = (type: string, extra: Pair[]): Pair[] =>
    [['0', type], ['10', 1], ['20', 2], ['11', 5], ['21', 2], ['12', 1], ['22', 6], ['13', 5], ['23', 6], ...extra];
  const firstCorner = (es: AnySceneEntity[]) => only<HatchEntity>(es, 'hatch').boundaryPaths[0]![0]!;

  it.each(['SOLID', 'TRACE'])('%s under (0,0,−1) mirrors', (type) => {
    closePoint(firstCorner(scene(quad(type, FLIPPED))), -1, 2);
  });

  it.each(['SOLID', 'TRACE', '3DFACE'])('%s under (0,0,1) stays as written', (type) => {
    expect(firstCorner(scene(quad(type, DEFAULT)))).toEqual({ x: 1, y: 2 });
  });

  it('3DFACE is WCS: a stray 210 changes nothing', () => {
    expect(firstCorner(scene(quad('3DFACE', FLIPPED)))).toEqual({ x: 1, y: 2 });
  });
});

describe('INSERT', () => {
  const BLOCK: Pair[] = [
    ['0', 'BLOCK'], ['8', '0'], ['2', 'B1'], ['70', 0], ['10', 0], ['20', 0], ['30', 0],
    ['0', 'LINE'], ['8', '0'], ['10', 0], ['20', 0], ['30', 0], ['11', 2], ['21', 1], ['31', 0],
    ['0', 'ENDBLK'],
  ];
  const insert = (extra: Pair[]): Pair[] => [['0', 'INSERT'], ['2', 'B1'], ['10', 10], ['20', 20], ['30', 0], ...extra];
  /** Forces the flatten path: an array, so the members come back as plain lines. */
  const array = (extra: Pair[]): Pair[] => insert([['70', 2], ['71', 1], ['44', 100], ...extra]);

  const lines = (es: AnySceneEntity[]) => es.filter((e) => e.type === 'line') as LineEntity[];

  it('readInsertPlacement: (0,0,1) ⇒ the numbers exactly as written', () => {
    const data = { '10': '10', '20': '20', '41': '2', '42': '3', '50': '30', '44': '5', '45': '7', '210': '0', '220': '0', '230': '1' };
    expect(readInsertPlacement(data)).toMatchObject({
      position: { x: 10, y: 20 }, sx: 2, sy: 3, rotation: 30, columnSpacing: 5, rowSpacing: 7,
    });
  });

  it('readInsertPlacement: (0,0,−1) ⇒ position (−x,y), rotation −θ, X scale negated, spacing runs with it', () => {
    const p = readInsertPlacement({ '10': '10', '20': '20', '41': '2', '42': '3', '50': '30', '44': '5', '45': '7', '230': '-1' });
    closePoint(p.position, -10, 20);
    expect(p.rotation).toBeCloseTo(-30, 9);
    expect(p.sx).toBeCloseTo(-2, 9);
    expect(p.sy).toBeCloseTo(3, 9);
    expect(p.columnSpacing).toBeCloseTo(-5, 9);
    expect(p.rowSpacing).toBeCloseTo(7, 9);
  });

  it('readInsertPlacement: the Z of (0,0,−1) negates, its scale along world Z too', () => {
    const p = readInsertPlacement({ '30': '4', '43': '2', '230': '-1' });
    expect(p.z).toBeCloseTo(-4, 9);
    expect(p.sz).toBeCloseTo(-2, 9);
  });

  it('(0,0,−1) flattened array: every member lands where OCS→WCS of the written transform says', () => {
    const es = lines(scene(array(FLIPPED), BLOCK));
    expect(es).toHaveLength(2);
    // OCS: cell c at (10 + 100c, 20); the far end of the member at +(2,1). WCS: X negated.
    closePoint(es[0]!.start, -10, 20);
    closePoint(es[0]!.end, -12, 21);
    closePoint(es[1]!.start, -110, 20);
    closePoint(es[1]!.end, -112, 21);
  });

  it('(0,0,−1) rotated 90°, flattened: the rotation is also mirrored', () => {
    const es = lines(scene(array([['50', 90], ...FLIPPED]), BLOCK));
    // OCS: Rot(90)(2,1) = (−1,2) ⇒ (9,22) ⇒ WCS (−9,22); the column steps along the OCS +Y
    closePoint(es[0]!.start, -10, 20);
    closePoint(es[0]!.end, -9, 22);
    closePoint(es[1]!.start, -10, 120);
  });

  it('(0,0,1) flattened array: unchanged', () => {
    const es = lines(scene(array(DEFAULT), BLOCK));
    closePoint(es[0]!.end, 12, 21);
    closePoint(es[1]!.start, 110, 20);
  });

  it('a kept BlockEntity reads the same placement', () => {
    const e = only<AnySceneEntity & { position: { x: number; y: number }; scale: { x: number; y: number }; rotation: number }>(
      scene(insert(FLIPPED), BLOCK),
      'block',
    );
    closePoint(e.position, -10, 20);
    expect(e.scale.x).toBeCloseTo(-1, 9);
    expect(e.scale.y).toBeCloseTo(1, 9);
    expect(e.rotation).toBeCloseTo(0, 9);
  });
});

describe('DIMENSION — mixed: only 11 / 16 / the angle are OCS', () => {
  const linear = (extra: Pair[]): Pair[] => [
    ['0', 'DIMENSION'], ['70', 32],
    ['10', 1], ['20', 2], ['11', 3], ['21', 4], ['13', 5], ['23', 6], ['14', 7], ['24', 8], ['50', 30], ...extra,
  ];
  type Dim = AnySceneEntity & { defPoints: { x: number; y: number }[]; textMidpoint: { x: number; y: number }; rotation: number };

  it('(0,0,−1) ⇒ defPoints stay (WCS), the text point mirrors (OCS), the angle maps', () => {
    const e = only<Dim>(scene(linear(FLIPPED)), 'dimension');
    expect(e.defPoints).toEqual([{ x: 5, y: 6 }, { x: 7, y: 8 }, { x: 1, y: 2 }]);
    closePoint(e.textMidpoint, -3, 4);
    expect(e.rotation).toBe(150);
  });

  it('(0,0,1) ⇒ all as written', () => {
    const e = only<Dim>(scene(linear(DEFAULT)), 'dimension');
    expect(e.textMidpoint).toEqual({ x: 3, y: 4 });
    expect(e.rotation).toBe(30);
  });

  it('(0,0,−1) angular: the arc point 16 is OCS, the rest stay', () => {
    const es = scene([
      ['0', 'DIMENSION'], ['70', 34],
      ['10', 1], ['20', 0], ['11', 3], ['21', 4], ['13', 0], ['23', 0], ['14', 0], ['24', 5],
      ['15', 5], ['25', 0], ['16', 2], ['26', 2], ...FLIPPED,
    ]);
    const e = only<Dim>(es, 'dimension');
    expect(e.defPoints[0]).toEqual({ x: 0, y: 0 });
    closePoint(e.defPoints[4]!, -2, 2);
  });
});

describe('WCS entities — a 210 of (0,0,−1) must change NOTHING', () => {
  it('LINE', () => {
    const e = only<LineEntity>(scene([['0', 'LINE'], ['10', 1], ['20', 2], ['11', 3], ['21', 4], ...FLIPPED]), 'line');
    expect(e.start).toEqual({ x: 1, y: 2 });
    expect(e.end).toEqual({ x: 3, y: 4 });
  });

  it('POINT', () => {
    const e = only<PointEntity>(scene([['0', 'POINT'], ['10', 1], ['20', 2], ...FLIPPED]), 'point');
    expect(e.position).toEqual({ x: 1, y: 2 });
  });

  it('ELLIPSE — group 10 is «in WCS» in the Reference', () => {
    const e = only<CircleEntity>(scene([['0', 'ELLIPSE'], ['10', 3], ['20', 4], ['11', 2], ['21', 0], ['40', 1], ...FLIPPED]), 'circle');
    expect(e.center).toEqual({ x: 3, y: 4 });
  });

  it('SPLINE', () => {
    const e = only<PolylineEntity>(scene([['0', 'SPLINE'], ['10', 1], ['20', 2], ['10', 3], ['20', 4], ...FLIPPED]), 'polyline');
    expect(e.vertices).toEqual([{ x: 1, y: 2 }, { x: 3, y: 4 }]);
  });
});
