/**
 * ADR-401 Phase B3b — envelope (ETICS Z1) variable-top resolver tests.
 *
 * Profiles κατασκευάζονται ως literals (decoupled από τον `resolveWallTopProfile`)
 * ώστε να ελέγχεται ΜΟΝΟ το mapping perimeter-edge → wall-profile + το area
 * integration. Convention: face/axis σε canvas-unit = mm (sceneScale=1)· `z*mm`
 * απόλυτα mm· `floorElevationMm=0` → topM = zmm·0.001.
 *
 * @see ../envelope-wall-top
 */

import {
  resolveEnvelopeEdgeTops,
  chainProfileAreaM2,
  projectTOnAxis,
  type WallTopRef,
} from '../envelope-wall-top';
import type { EnvelopeChain } from '../envelope-perimeter';
import type { WallTopProfile, WallTopSegment } from '../wall-top-profile';

function prof(segments: WallTopSegment[]): WallTopProfile {
  const tops = segments.flatMap((s) => [s.z0mm, s.z1mm]);
  return {
    baseZmm: 0,
    segments,
    maxTopZmm: Math.max(...tops),
    minTopZmm: Math.min(...tops),
    hasAttach: segments.some((s) => s.source === 'attached'),
    missingHostIds: [],
  };
}

function chain(
  face: Array<{ x: number; y: number }>,
  outer: Array<{ x: number; y: number }>,
  edgeWallIds: (string | null)[] | undefined,
  closed = false,
): EnvelopeChain {
  return {
    exteriorFaceLoop: { points: face.map((p) => ({ x: p.x, y: p.y, z: 0 })), closed },
    insulationOuterLoop: { points: outer.map((p) => ({ x: p.x, y: p.y, z: 0 })), closed },
    closed,
    enclosesRegion: closed,
    perimeterM: 0,
    wallIds: [],
    columnIds: [],
    edgeWallIds,
  };
}

// Άξονας w1 (0,0)→(10000,0)· edge face = ίδια άκρα → tA=0, tB=1.
const w1Ref = (profile: WallTopProfile): WallTopRef => ({
  start: { x: 0, y: 0 },
  end: { x: 10000, y: 0 },
  profile,
});

const singleEdge = (edgeWallIds: (string | null)[] | undefined): EnvelopeChain =>
  chain(
    [{ x: 0, y: 0 }, { x: 10000, y: 0 }],
    [{ x: 0, y: 100 }, { x: 10000, y: 100 }],
    edgeWallIds,
  );

describe('projectTOnAxis', () => {
  it('start → 0, end → 1, midpoint → 0.5', () => {
    expect(projectTOnAxis({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 0 })).toBeCloseTo(0);
    expect(projectTOnAxis({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(1);
    expect(projectTOnAxis({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 3 })).toBeCloseTo(0.5);
  });
  it('degenerate axis → 0', () => {
    expect(projectTOnAxis({ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 9, y: 9 })).toBe(0);
  });
});

describe('resolveEnvelopeEdgeTops', () => {
  it('σκαλωτή κορυφή (2 δοκάρια) → 2 ανεξάρτητα sub-segments (καθαρό σκαλοπάτι)', () => {
    const profile = prof([
      { t0: 0, t1: 0.5, z0mm: 2500, z1mm: 2500, source: 'attached', hostId: 'b1' },
      { t0: 0.5, t1: 1, z0mm: 2000, z1mm: 2000, source: 'attached', hostId: 'b2' },
    ]);
    const tops = resolveEnvelopeEdgeTops(singleEdge(['w1']), new Map([['w1', w1Ref(profile)]]), 0);
    expect(tops).toHaveLength(1);
    const segs = tops[0]!.segments;
    expect(segs).toHaveLength(2);
    expect(segs[0]).toMatchObject({ s0: 0, s1: 0.5, z0M: 2.5, z1M: 2.5 });
    expect(segs[1]).toMatchObject({ s0: 0.5, s1: 1, z0M: 2.0, z1M: 2.0 });
    // Σκαλοπάτι: δεν «λοξεύει» στο breakpoint (z1M seg0 ≠ z0M seg1).
    expect(segs[0].z1M).not.toBeCloseTo(segs[1].z0M);
  });

  it('κεκλιμένη κορυφή (z0≠z1) → ένα sloped sub-segment', () => {
    const profile = prof([{ t0: 0, t1: 1, z0mm: 2000, z1mm: 3000, source: 'attached', hostId: 'r' }]);
    const tops = resolveEnvelopeEdgeTops(singleEdge(['w1']), new Map([['w1', w1Ref(profile)]]), 0);
    const segs = tops[0]!.segments;
    expect(segs).toHaveLength(1);
    expect(segs[0]).toMatchObject({ s0: 0, s1: 1, z0M: 2.0, z1M: 3.0 });
  });

  it('μερική κάλυψη — attached edge + flat (null) edge → [edgeTop, null]', () => {
    const profile = prof([{ t0: 0, t1: 1, z0mm: 2500, z1mm: 2500, source: 'attached', hostId: 'b' }]);
    const c = chain(
      [{ x: 0, y: 0 }, { x: 10000, y: 0 }, { x: 10000, y: 5000 }],
      [{ x: 0, y: 100 }, { x: 10000, y: 100 }, { x: 10100, y: 5000 }],
      ['w1', null],
    );
    const tops = resolveEnvelopeEdgeTops(c, new Map([['w1', w1Ref(profile)]]), 0);
    expect(tops).toHaveLength(2);
    expect(tops[0]).not.toBeNull();
    expect(tops[1]).toBeNull();
  });

  it('floorElevationMm μετατοπίζει το topM (absolute mm → relative meters)', () => {
    const profile = prof([{ t0: 0, t1: 1, z0mm: 5500, z1mm: 5500, source: 'attached', hostId: 'b' }]);
    const tops = resolveEnvelopeEdgeTops(singleEdge(['w1']), new Map([['w1', w1Ref(profile)]]), 3000);
    expect(tops[0]!.segments[0].z0M).toBeCloseTo(2.5); // (5500 − 3000) / 1000
  });

  it('edgeWallIds undefined (legacy perimeter) → όλα null', () => {
    const profile = prof([{ t0: 0, t1: 1, z0mm: 2500, z1mm: 2500, source: 'attached', hostId: 'b' }]);
    const tops = resolveEnvelopeEdgeTops(singleEdge(undefined), new Map([['w1', w1Ref(profile)]]), 0);
    expect(tops[0]).toBeNull();
  });

  it('wallId χωρίς ref (μη-attached) → null', () => {
    const tops = resolveEnvelopeEdgeTops(singleEdge(['wX']), new Map(), 0);
    expect(tops[0]).toBeNull();
  });
});

describe('chainProfileAreaM2', () => {
  const sceneScale = 1; // canvas-unit = mm → lenM = canvas/1000

  it('flat fallback (edgeTops null) = perimeter-edge × fallbackHeight', () => {
    const c = singleEdge(['w1']);
    const area = chainProfileAreaM2(c, [null], 2.85, sceneScale);
    // outer edge μήκος = 10000 canvas = 10 m· × 2.85
    expect(area).toBeCloseTo(28.5);
  });

  it('σκαλωτό = Σ μήκος × μέσο ύψος ανά sub-segment', () => {
    const profile = prof([
      { t0: 0, t1: 0.5, z0mm: 2500, z1mm: 2500, source: 'attached', hostId: 'b1' },
      { t0: 0.5, t1: 1, z0mm: 2000, z1mm: 2000, source: 'attached', hostId: 'b2' },
    ]);
    const c = singleEdge(['w1']);
    const tops = resolveEnvelopeEdgeTops(c, new Map([['w1', w1Ref(profile)]]), 0);
    const area = chainProfileAreaM2(c, tops, 2.85, sceneScale);
    // 10 m × (0.5·2.5 + 0.5·2.0) = 10 × 2.25
    expect(area).toBeCloseTo(22.5);
  });

  it('κεκλιμένο = μήκος × μέσο ((z0+z1)/2)', () => {
    const profile = prof([{ t0: 0, t1: 1, z0mm: 2000, z1mm: 3000, source: 'attached', hostId: 'r' }]);
    const c = singleEdge(['w1']);
    const tops = resolveEnvelopeEdgeTops(c, new Map([['w1', w1Ref(profile)]]), 0);
    const area = chainProfileAreaM2(c, tops, 2.85, sceneScale);
    // 10 m × 2.5 (μέσο 2.0..3.0)
    expect(area).toBeCloseTo(25);
  });

  it('sceneScale=0 → 0 (guard)', () => {
    expect(chainProfileAreaM2(singleEdge(['w1']), [null], 2.85, 0)).toBe(0);
  });
});
