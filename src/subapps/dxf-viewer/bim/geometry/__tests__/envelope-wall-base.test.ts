/**
 * ADR-401 (γ) — envelope (ETICS Z1) variable-BASE resolver tests.
 *
 * Δίδυμο του `envelope-wall-top.test.ts`. Profiles ως literals (decoupled από τον
 * `resolveWallBaseProfile`) ώστε να ελέγχεται ΜΟΝΟ το mapping perimeter-edge →
 * base-profile + το area integration. ⚠️ ΚΡΙΣΙΜΗ ΔΙΑΦΟΡΑ από το top: η βάση **ΔΕΝ**
 * clamp-άρεται στο 0 — μένει αρνητική όταν το θεμέλιο είναι κάτω από το πάτωμα.
 *
 * @see ../envelope-wall-base
 */

import {
  resolveEnvelopeEdgeBases,
  chainBaseAreaM2,
  type WallBaseRef,
} from '../envelope-wall-base';
import type { EnvelopeChain } from '../envelope-perimeter';
import type { WallBaseProfile, WallBaseSegment } from '../wall-base-profile';

function prof(segments: WallBaseSegment[]): WallBaseProfile {
  const zs = segments.flatMap((s) => [s.z0mm, s.z1mm]);
  return {
    nominalBaseZmm: 0,
    segments,
    maxBaseZmm: Math.max(...zs),
    minBaseZmm: Math.min(...zs),
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
const w1Ref = (profile: WallBaseProfile): WallBaseRef => ({
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

describe('resolveEnvelopeEdgeBases', () => {
  it('σκαλωτή βάση (2 θεμέλια διαφορετικού βάθους) → 2 ανεξάρτητα sub-segments', () => {
    const profile = prof([
      { t0: 0, t1: 0.5, z0mm: -300, z1mm: -300, source: 'attached', hostId: 'f1' },
      { t0: 0.5, t1: 1, z0mm: -500, z1mm: -500, source: 'attached', hostId: 'f2' },
    ]);
    const bases = resolveEnvelopeEdgeBases(singleEdge(['w1']), new Map([['w1', w1Ref(profile)]]), 0);
    expect(bases).toHaveLength(1);
    const segs = bases[0]!.segments;
    expect(segs).toHaveLength(2);
    expect(segs[0]).toMatchObject({ s0: 0, s1: 0.5, z0M: -0.3, z1M: -0.3 });
    expect(segs[1]).toMatchObject({ s0: 0.5, s1: 1, z0M: -0.5, z1M: -0.5 });
    // Σκαλοπάτι βάσης: δεν «λοξεύει» στο breakpoint.
    expect(segs[0].z1M).not.toBeCloseTo(segs[1].z0M);
  });

  it('αρνητική βάση (θεμέλιο κάτω από το floor) ΔΕΝ clamp-άρεται στο 0', () => {
    const profile = prof([{ t0: 0, t1: 1, z0mm: -800, z1mm: -800, source: 'attached', hostId: 'f' }]);
    const bases = resolveEnvelopeEdgeBases(singleEdge(['w1']), new Map([['w1', w1Ref(profile)]]), 0);
    expect(bases[0]!.segments[0].z0M).toBeCloseTo(-0.8);
  });

  it('κεκλιμένη βάση (z0≠z1) → ένα sloped sub-segment', () => {
    const profile = prof([{ t0: 0, t1: 1, z0mm: -200, z1mm: -600, source: 'attached', hostId: 'r' }]);
    const bases = resolveEnvelopeEdgeBases(singleEdge(['w1']), new Map([['w1', w1Ref(profile)]]), 0);
    const segs = bases[0]!.segments;
    expect(segs).toHaveLength(1);
    expect(segs[0]).toMatchObject({ s0: 0, s1: 1, z0M: -0.2, z1M: -0.6 });
  });

  it('μερική κάλυψη — base-attached edge + flat (null) edge → [edgeBase, null]', () => {
    const profile = prof([{ t0: 0, t1: 1, z0mm: -300, z1mm: -300, source: 'attached', hostId: 'f' }]);
    const c = chain(
      [{ x: 0, y: 0 }, { x: 10000, y: 0 }, { x: 10000, y: 5000 }],
      [{ x: 0, y: 100 }, { x: 10000, y: 100 }, { x: 10100, y: 5000 }],
      ['w1', null],
    );
    const bases = resolveEnvelopeEdgeBases(c, new Map([['w1', w1Ref(profile)]]), 0);
    expect(bases).toHaveLength(2);
    expect(bases[0]).not.toBeNull();
    expect(bases[1]).toBeNull();
  });

  it('floorElevationMm μετατοπίζει το baseM (absolute mm → relative meters)', () => {
    const profile = prof([{ t0: 0, t1: 1, z0mm: 1000, z1mm: 1000, source: 'attached', hostId: 'f' }]);
    const bases = resolveEnvelopeEdgeBases(singleEdge(['w1']), new Map([['w1', w1Ref(profile)]]), 3000);
    expect(bases[0]!.segments[0].z0M).toBeCloseTo(-2.0); // (1000 − 3000) / 1000
  });

  it('edgeWallIds undefined (legacy perimeter) → όλα null', () => {
    const profile = prof([{ t0: 0, t1: 1, z0mm: -300, z1mm: -300, source: 'attached', hostId: 'f' }]);
    const bases = resolveEnvelopeEdgeBases(singleEdge(undefined), new Map([['w1', w1Ref(profile)]]), 0);
    expect(bases[0]).toBeNull();
  });

  it('wallId χωρίς ref (μη-base-attached) → null', () => {
    const bases = resolveEnvelopeEdgeBases(singleEdge(['wX']), new Map(), 0);
    expect(bases[0]).toBeNull();
  });
});

describe('chainBaseAreaM2', () => {
  const sceneScale = 1; // canvas-unit = mm → lenM = canvas/1000

  it('null edge → 0 συνεισφορά (επίπεδος πάτος στο floor)', () => {
    expect(chainBaseAreaM2(singleEdge(['w1']), [null], sceneScale)).toBe(0);
  });

  it('σκαλωτή (αρνητική) βάση = Σ μήκος × μέση βάση (αρνητικό → consumer προσθέτει)', () => {
    const profile = prof([
      { t0: 0, t1: 0.5, z0mm: -300, z1mm: -300, source: 'attached', hostId: 'f1' },
      { t0: 0.5, t1: 1, z0mm: -500, z1mm: -500, source: 'attached', hostId: 'f2' },
    ]);
    const c = singleEdge(['w1']);
    const bases = resolveEnvelopeEdgeBases(c, new Map([['w1', w1Ref(profile)]]), 0);
    // 10 m × (0.5·−0.3 + 0.5·−0.5) = 10 × −0.4
    expect(chainBaseAreaM2(c, bases, sceneScale)).toBeCloseTo(-4);
  });

  it('κεκλιμένη βάση = μήκος × μέσο ((z0+z1)/2)', () => {
    const profile = prof([{ t0: 0, t1: 1, z0mm: -200, z1mm: -600, source: 'attached', hostId: 'r' }]);
    const c = singleEdge(['w1']);
    const bases = resolveEnvelopeEdgeBases(c, new Map([['w1', w1Ref(profile)]]), 0);
    // 10 m × −0.4 (μέσο −0.2..−0.6)
    expect(chainBaseAreaM2(c, bases, sceneScale)).toBeCloseTo(-4);
  });

  it('sceneScale=0 → 0 (guard)', () => {
    const profile = prof([{ t0: 0, t1: 1, z0mm: -300, z1mm: -300, source: 'attached', hostId: 'f' }]);
    const bases = resolveEnvelopeEdgeBases(singleEdge(['w1']), new Map([['w1', w1Ref(profile)]]), 0);
    expect(chainBaseAreaM2(singleEdge(['w1']), bases, 0)).toBe(0);
  });
});
