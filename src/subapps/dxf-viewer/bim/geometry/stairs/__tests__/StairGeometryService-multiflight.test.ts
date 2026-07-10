/**
 * ADR-633 — `StairGeometryService` multi-flight (turn-point) tests.
 *
 * Multi-flight generalizes gamma to an arbitrary number of flights joined by
 * user-authored turn points at arbitrary plan-view angles. These tests pin the
 * invariants that matter downstream (tread counts + per-flight directions +
 * z-levels + walkline vertex count + label numbering + guards). The exact
 * landing polygon shape at non-90° angles is intentionally NOT asserted — it is
 * refined against the live renderer (ADR-633 verify step).
 *
 * Default parameterization mirrors the gamma suite:
 *   - rise=175, tread=280, width=1000, nosing=25
 *   - basePoint=(0,0,0), direction=0° (+X)
 *
 * @see ../stair-geometry-multiflight.ts
 */

import { computeStairGeometry } from '../StairGeometryService';
import type {
  Polygon3D,
  StairParams,
  StairTurnNode,
  StairVariantMultiFlight,
} from '../../../../bim/types/stair-types';

const COORD_TOL = 1e-6;
const Z_TOL = 1e-9;
const RISE = 175;
const TREAD = 280;
const WIDTH = 1000;

function makeParams(
  flights: readonly number[],
  turns: readonly StairTurnNode[],
  overrides?: {
    treadLabelDisplay?: 'all' | 'nth' | 'none';
    treadLabelRestartPerFlight?: boolean;
  },
): StairParams {
  const stepCount = flights.reduce((s, n) => s + n, 0);
  const variant: StairVariantMultiFlight = { kind: 'multi-flight', flights, turns };
  return {
    basePoint: { x: 0, y: 0, z: 0 },
    direction: 0,
    rise: RISE,
    tread: TREAD,
    nosing: 25,
    nosingSide: 'front',
    width: WIDTH,
    stepCount,
    totalRise: RISE * (stepCount + turns.length),
    totalRun: TREAD * stepCount,
    pitch: 30,
    structureType: 'monolithic',
    riserType: 'closed',
    antiskidNosing: false,
    adaContrastStrip: false,
    variant,
    walklineOffset: 300,
    handrails: { inner: false, outer: false, height: 900 },
    upDirection: 'forward',
    treadNumberStart: 1,
    treadLabelDisplay: overrides?.treadLabelDisplay ?? 'none',
    treadLabelRestartPerFlight: overrides?.treadLabelRestartPerFlight ?? false,
    codeProfile: 'none',
  };
}

function landingTurn(
  turnDirection: 'left' | 'right',
  turnAngleDeg = 90,
): StairTurnNode {
  return { turnDirection, turnAngleDeg, cornerStyle: 'landing', landingDepth: 'auto' };
}

function centroidXY(poly: Polygon3D): { x: number; y: number } {
  let sx = 0;
  let sy = 0;
  for (const p of poly) { sx += p.x; sy += p.y; }
  return { x: sx / poly.length, y: sy / poly.length };
}

function allTreads(g: { treadsBelowCut: readonly Polygon3D[]; treadsAboveCut: readonly Polygon3D[] }): readonly Polygon3D[] {
  return [...g.treadsBelowCut, ...g.treadsAboveCut];
}

describe('StairGeometryService — Multi-flight (turn points, ADR-633)', () => {
  it('Test 1: flights=[3,3], 1 turn → 6 treads + 1 landing', () => {
    const g = computeStairGeometry(makeParams([3, 3], [landingTurn('right')]));
    expect(g.treadsBelowCut.length + g.treadsAboveCut.length).toBe(6);
    expect(g.landings).toHaveLength(1);
  });

  it('Test 2: flight 1 advances +X (u1)', () => {
    const g = computeStairGeometry(makeParams([3, 3], [landingTurn('right')]));
    const t = allTreads(g);
    const c0 = centroidXY(t[0]);
    const c1 = centroidXY(t[1]);
    expect(c1.x - c0.x).toBeCloseTo(TREAD, 6);
    expect(Math.abs(c1.y - c0.y)).toBeLessThan(COORD_TOL);
  });

  it("Test 3: turn 'right' 90° → flight 2 advances (0,-1)", () => {
    const g = computeStairGeometry(makeParams([3, 3], [landingTurn('right', 90)]));
    const t = allTreads(g);
    const c3 = centroidXY(t[3]); // first flight-2 tread
    const c4 = centroidXY(t[4]);
    expect(c4.y - c3.y).toBeCloseTo(-TREAD, 6);
    expect(Math.abs(c4.x - c3.x)).toBeLessThan(COORD_TOL);
  });

  it("Test 4: turn 'left' 90° → flight 2 advances (0,+1)", () => {
    const g = computeStairGeometry(makeParams([3, 3], [landingTurn('left', 90)]));
    const t = allTreads(g);
    const c3 = centroidXY(t[3]);
    const c4 = centroidXY(t[4]);
    expect(c4.y - c3.y).toBeCloseTo(TREAD, 6);
    expect(Math.abs(c4.x - c3.x)).toBeLessThan(COORD_TOL);
  });

  it('Test 5: arbitrary angle (right 45°) → flight 2 direction = rotate(u1, -45°)', () => {
    const g = computeStairGeometry(makeParams([3, 3], [landingTurn('right', 45)]));
    const t = allTreads(g);
    const c3 = centroidXY(t[3]);
    const c4 = centroidXY(t[4]);
    const rad = (-45 * Math.PI) / 180;
    expect(c4.x - c3.x).toBeCloseTo(TREAD * Math.cos(rad), 6);
    expect(c4.y - c3.y).toBeCloseTo(TREAD * Math.sin(rad), 6);
  });

  it('Test 6: landing z = n1·rise = 525 (one rise per landing)', () => {
    const g = computeStairGeometry(makeParams([3, 3], [landingTurn('right')]));
    for (const v of g.landings[0]) {
      expect(Math.abs(v.z - 3 * RISE)).toBeLessThan(Z_TOL);
    }
  });

  it('Test 7: flight 2 first tread z = (n1+1)·rise = 700 (one rise above landing)', () => {
    const g = computeStairGeometry(makeParams([3, 3], [landingTurn('right')]));
    const t = allTreads(g);
    expect(Math.abs(t[3][0].z - (3 + 1) * RISE)).toBeLessThan(Z_TOL);
  });

  it('Test 8: flights=[3,4,3], 2 turns → 10 treads + 2 landings + 6 walkline vertices', () => {
    const g = computeStairGeometry(
      makeParams([3, 4, 3], [landingTurn('right'), landingTurn('right')]),
    );
    expect(allTreads(g).length).toBe(10);
    expect(g.landings).toHaveLength(2);
    expect(g.walkline).toHaveLength(6); // 2·flights
  });

  it('Test 9: two flights → walkline has 4 vertices (2·flights)', () => {
    const g = computeStairGeometry(makeParams([3, 3], [landingTurn('right')]));
    expect(g.walkline).toHaveLength(4);
  });

  it("Test 10: turnSequence right,left → flight 3 parallel to flight 1 (+X)", () => {
    const g = computeStairGeometry(
      makeParams([3, 4, 3], [landingTurn('right'), landingTurn('left')]),
    );
    const t = allTreads(g);
    const c7 = centroidXY(t[7]); // first flight-3 tread (3+4)
    const c8 = centroidXY(t[8]);
    expect(c8.x - c7.x).toBeCloseTo(TREAD, 6);
    expect(Math.abs(c8.y - c7.y)).toBeLessThan(COORD_TOL);
  });

  it('Test 11: continuous numbering → 7 labels (6 treads + 1 landing), landing at index 3', () => {
    const g = computeStairGeometry(
      makeParams([3, 3], [landingTurn('right')], { treadLabelDisplay: 'all' }),
    );
    if (!g.treadLabels) throw new Error('expected labels');
    expect(g.treadLabels).toHaveLength(7);
    expect(g.treadLabels.map((l) => l.text)).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    expect(g.treadLabels[3].kind).toBe('landing');
    expect(g.treadLabels[0].kind).toBe('tread');
  });

  it('Test 12: turns.length ≠ flights.length−1 throws', () => {
    expect(() =>
      computeStairGeometry(makeParams([3, 3, 3], [landingTurn('right')])),
    ).toThrow(/turns\.length/);
  });

  it('Test 13: a flight with 0 treads throws', () => {
    expect(() =>
      computeStairGeometry(makeParams([3, 0], [landingTurn('right')])),
    ).toThrow(/≥1 tread/);
  });

  it("Test 14: cornerStyle 'winders' throws (Phase 2)", () => {
    const winderTurn: StairTurnNode = {
      turnDirection: 'right',
      turnAngleDeg: 90,
      cornerStyle: 'winders',
      winderCount: 3,
      winderMethod: 'equal-going',
    };
    expect(() =>
      computeStairGeometry(makeParams([3, 3], [winderTurn])),
    ).toThrow(/Phase 2/);
  });

  it('Test 15: single flight (no turns) = straight-equivalent, 3 treads, no landings', () => {
    const g = computeStairGeometry(makeParams([3], []));
    expect(allTreads(g).length).toBe(3);
    expect(g.landings).toHaveLength(0);
    expect(g.walkline).toHaveLength(2);
  });
});
