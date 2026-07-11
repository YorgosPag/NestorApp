/**
 * ADR-637 Phase 4-A — rest-landing (πλατύσκαλο) grip emission + pure transforms.
 *
 * Covers:
 *   - `getStairGrips` emits, PER rest landing, a slide grip + 2 length grips, each
 *     carrying the landing `id` via `GripInfo.landingId`.
 *   - `applyStairGripDrag` slide → changes `at` (and the geometry re-flows: the
 *     landing's level z moves on recompute); length → changes `length` (footprint
 *     grows); clamps (`at` inside (0,1); length ≥ tread); multiple landings edited
 *     independently by id; a non-rest-landing grip kind is unaffected.
 */

import { buildDefaultStairParams, buildStairEntity } from '../../../hooks/drawing/stair-completion';
import { applyStairGripDrag, getStairGrips } from '../stair-grips';
import { computeStairGeometry } from '../../geometry/stairs/StairGeometryService';
import type {
  Point3D,
  StairEntity,
  StairParams,
  StairRestLanding,
  StairVariantSketch,
} from '../../../bim/types/stair-types';
import { gripKindOf } from '../../../hooks/grip-kinds';

function makeStraightParams(restLandings: readonly StairRestLanding[]): StairParams {
  const base = buildDefaultStairParams({ x: 0, y: 0 }, 0);
  return { ...base, restLandings };
}

function makeEntity(restLandings: readonly StairRestLanding[]): StairEntity {
  return buildStairEntity(makeStraightParams(restLandings), '0');
}

// buildDefaultStairParams: stepCount=12, tread=280, width=1200, rise=175,
// base=(0,0), direction 0 → totalRun = 280·11 = 3080. at=0.5 → level round(5.5)=6
// → flight1 = 6 treads → along 1680; 'auto' length → width 1200 → centre x 2280.
const CENTER_X = 2280;

describe('stair rest-landing grips (ADR-637 Phase 4-A)', () => {
  // ─── B. Grip emission ────────────────────────────────────────────────────
  it('1. one landing → slide + 2 length grips, all carrying the landing id', () => {
    const grips = getStairGrips(makeEntity([{ id: 'rl1', at: 0.5, length: 'auto' }]));
    const rest = grips.filter((g) => g.landingId === 'rl1');
    expect(rest.map((g) => gripKindOf(g, 'stair')).sort()).toEqual([
      'stair-rest-landing-length-hi',
      'stair-rest-landing-length-lo',
      'stair-rest-landing-slide',
    ]);
  });

  it('2. slide grip sits at the handle centroid; length grips at centre ± along·len/2', () => {
    const grips = getStairGrips(makeEntity([{ id: 'rl1', at: 0.5, length: 'auto' }]));
    const byKind = Object.fromEntries(
      grips.filter((g) => g.landingId === 'rl1').map((g) => [gripKindOf(g, 'stair'), g.position]),
    );
    expect(byKind['stair-rest-landing-slide'].x).toBeCloseTo(CENTER_X, 4);
    expect(byKind['stair-rest-landing-slide'].y).toBeCloseTo(0, 4);
    // length 1200 → half 600 along +x.
    expect(byKind['stair-rest-landing-length-lo'].x).toBeCloseTo(CENTER_X - 600, 4);
    expect(byKind['stair-rest-landing-length-hi'].x).toBeCloseTo(CENTER_X + 600, 4);
  });

  it('3. no rest landings → no rest-landing grips (back-compat)', () => {
    const grips = getStairGrips(makeEntity([]));
    expect(grips.some((g) => g.landingId !== undefined)).toBe(false);
  });

  it('4. two landings → two independent grip sets', () => {
    const grips = getStairGrips(
      makeEntity([
        { id: 'a', at: 0.3, length: 'auto' },
        { id: 'b', at: 0.7, length: 'auto' },
      ]),
    );
    expect(grips.filter((g) => g.landingId === 'a')).toHaveLength(3);
    expect(grips.filter((g) => g.landingId === 'b')).toHaveLength(3);
  });

  // ─── C. Pure transform — slide ───────────────────────────────────────────
  it('5. slide → changes at; geometry re-flows (landing level z moves)', () => {
    const params = makeStraightParams([{ id: 'rl1', at: 0.5, length: 'auto' }]);
    const next = applyStairGripDrag('stair-rest-landing-slide', {
      originalParams: params,
      delta: { x: 984, y: 0 },
      currentPos: { x: 0.8 * 3080, y: 0 }, // 0.8 of the developed run
      landingId: 'rl1',
    });
    expect(next.restLandings![0].at).toBeCloseTo(0.8, 6);
    // Re-flow: at 0.5→level 6 (z 1050); at 0.8→level round(8.8)=9 (z 1575).
    const zBefore = computeStairGeometry(params).restLandingHandles![0].center.z;
    const zAfter = computeStairGeometry(next).restLandingHandles![0].center.z;
    expect(zAfter).toBeGreaterThan(zBefore);
  });

  it('6. slide clamps at strictly inside (0,1)', () => {
    const params = makeStraightParams([{ id: 'rl1', at: 0.5, length: 'auto' }]);
    const hi = applyStairGripDrag('stair-rest-landing-slide', {
      originalParams: params,
      delta: { x: 0, y: 0 },
      currentPos: { x: 100000, y: 0 },
      landingId: 'rl1',
    });
    const lo = applyStairGripDrag('stair-rest-landing-slide', {
      originalParams: params,
      delta: { x: 0, y: 0 },
      currentPos: { x: -100000, y: 0 },
      landingId: 'rl1',
    });
    expect(hi.restLandings![0].at).toBeGreaterThan(0);
    expect(hi.restLandings![0].at).toBeLessThan(1);
    expect(lo.restLandings![0].at).toBeGreaterThan(0);
    expect(lo.restLandings![0].at).toBeLessThan(1);
  });

  // ─── C. Pure transform — length ──────────────────────────────────────────
  it('7. length grip → sets length = 2·|projection|; footprint grows', () => {
    const params = makeStraightParams([{ id: 'rl1', at: 0.5, length: 'auto' }]);
    const geometry = computeStairGeometry(params);
    const next = applyStairGripDrag('stair-rest-landing-length-hi', {
      originalParams: params,
      delta: { x: 0, y: 0 },
      currentPos: { x: CENTER_X + 1000, y: 0 }, // proj 1000 → length 2000
      geometry,
      landingId: 'rl1',
    });
    expect(next.restLandings![0].length).toBeCloseTo(2000, 4);
    const growX = computeStairGeometry(next).bbox.max.x;
    expect(growX).toBeGreaterThan(geometry.bbox.max.x);
  });

  it('8. length grip clamps to ≥ one tread', () => {
    const params = makeStraightParams([{ id: 'rl1', at: 0.5, length: 'auto' }]);
    const geometry = computeStairGeometry(params);
    const next = applyStairGripDrag('stair-rest-landing-length-lo', {
      originalParams: params,
      delta: { x: 0, y: 0 },
      currentPos: { x: CENTER_X, y: 0 }, // proj 0 → clamps to tread
      geometry,
      landingId: 'rl1',
    });
    expect(next.restLandings![0].length).toBeCloseTo(params.tread, 4);
  });

  it('9. lo and hi length grips share one transform (symmetric edge-to-centre)', () => {
    const params = makeStraightParams([{ id: 'rl1', at: 0.5, length: 'auto' }]);
    const geometry = computeStairGeometry(params);
    const input = {
      originalParams: params,
      delta: { x: 0, y: 0 },
      currentPos: { x: CENTER_X + 900, y: 0 },
      geometry,
      landingId: 'rl1',
    };
    const hi = applyStairGripDrag('stair-rest-landing-length-hi', input);
    const lo = applyStairGripDrag('stair-rest-landing-length-lo', input);
    expect(hi.restLandings![0].length).toBeCloseTo(lo.restLandings![0].length, 6);
  });

  // ─── C. Multiple landings edited independently by id ─────────────────────
  it('10. slide edits only the targeted landing (by id)', () => {
    const params = makeStraightParams([
      { id: 'a', at: 0.3, length: 'auto' },
      { id: 'b', at: 0.7, length: 'auto' },
    ]);
    const next = applyStairGripDrag('stair-rest-landing-slide', {
      originalParams: params,
      delta: { x: 0, y: 0 },
      currentPos: { x: 0.5 * 3080, y: 0 },
      landingId: 'b',
    });
    expect(next.restLandings![0].at).toBe(0.3); // 'a' untouched
    expect(next.restLandings![1].at).toBeCloseTo(0.5, 6); // 'b' moved
  });

  it('11. missing / unknown landingId → originalParams unchanged (same ref)', () => {
    const params = makeStraightParams([{ id: 'rl1', at: 0.5, length: 'auto' }]);
    const noId = applyStairGripDrag('stair-rest-landing-slide', {
      originalParams: params,
      delta: { x: 0, y: 0 },
      currentPos: { x: 1000, y: 0 },
    });
    const badId = applyStairGripDrag('stair-rest-landing-slide', {
      originalParams: params,
      delta: { x: 0, y: 0 },
      currentPos: { x: 1000, y: 0 },
      landingId: 'nope',
    });
    expect(noId).toBe(params);
    expect(badId).toBe(params);
  });

  // ─── A non-rest-landing grip kind is unaffected ──────────────────────────
  it('12. a non-rest-landing grip (stair-base) ignores landingId + leaves restLandings intact', () => {
    const params = makeStraightParams([{ id: 'rl1', at: 0.5, length: 'auto' }]);
    const next = applyStairGripDrag('stair-base', {
      originalParams: params,
      delta: { x: 50, y: 30 },
      currentPos: { x: 50, y: 30 },
      landingId: 'rl1',
    });
    expect(next.basePoint.x).toBe(50);
    expect(next.basePoint.y).toBe(30);
    expect(next.restLandings).toEqual(params.restLandings); // untouched
  });
});

// ─── ADR-637 Phase 4-C — curved-family (walkline) grips ──────────────────────
// Sketch = a straight walkline (all y=0) so arc-length reasoning is exact; the
// slide MUST project onto the walkline (totalRun = 0 for every curved kind), not
// axially — the Phase 4-A axial model would divide by 1 and fling the landing.
function makeSketchParams(restLandings: readonly StairRestLanding[]): StairParams {
  const walklinePath: readonly Point3D[] = [
    { x: 0, y: 0, z: 0 }, { x: 300, y: 0, z: 0 }, { x: 600, y: 0, z: 0 },
    { x: 900, y: 0, z: 0 }, { x: 1200, y: 0, z: 0 }, { x: 1500, y: 0, z: 0 },
  ];
  const variant: StairVariantSketch = { kind: 'sketch', walklinePath };
  return {
    basePoint: { x: 0, y: 0, z: 0 }, direction: 0, rise: 600, tread: 300, nosing: 0,
    nosingSide: 'none', width: 800, stepCount: 5, totalRise: 3000, totalRun: 0,
    pitch: 30, structureType: 'monolithic', riserType: 'closed', antiskidNosing: false,
    adaContrastStrip: false, variant, walklineOffset: 300,
    handrails: { inner: false, outer: false, height: 900 }, upDirection: 'forward',
    treadNumberStart: 1, treadLabelDisplay: 'none', treadLabelRestartPerFlight: false,
    codeProfile: 'none', restLandings,
  };
}

/** Cumulative plan arc-lengths of a walkline + its total (2D). */
function arcLengths(wl: readonly Point3D[]): { cum: number[]; total: number } {
  const cum = [0];
  for (let i = 1; i < wl.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(wl[i].x - wl[i - 1].x, wl[i].y - wl[i - 1].y));
  }
  return { cum, total: cum[cum.length - 1] };
}

describe('curved-family rest-landing grips (ADR-637 Phase 4-C)', () => {
  it('13. curved (sketch) landing → 3 grips emitted end-to-end (handles surfaced)', () => {
    const entity = buildStairEntity(makeSketchParams([{ id: 'r1', at: 0.5, length: 'auto' }]), '0');
    expect(entity.geometry.restLandingHandles).toHaveLength(1);
    const grips = getStairGrips(entity);
    expect(grips.filter((g) => g.landingId === 'r1').map((g) => gripKindOf(g, 'stair')).sort()).toEqual([
      'stair-rest-landing-length-hi',
      'stair-rest-landing-length-lo',
      'stair-rest-landing-slide',
    ]);
  });

  it('14. slide projects the cursor onto the walkline by arc-length (not axially)', () => {
    const params = makeSketchParams([{ id: 'r1', at: 0.3, length: 'auto' }]);
    const geometry = computeStairGeometry(params);
    const wl = geometry.walkline;
    const { cum, total } = arcLengths(wl);
    // Drop the cursor exactly on an interior walkline vertex → its arc-length fraction.
    const k = 3;
    const next = applyStairGripDrag('stair-rest-landing-slide', {
      originalParams: params,
      delta: { x: 0, y: 0 },
      currentPos: { x: wl[k].x, y: wl[k].y },
      geometry,
      landingId: 'r1',
    });
    expect(next.restLandings![0].at).toBeCloseTo(cum[k] / total, 6);
  });

  it('15. curved slide clamps at strictly inside (0,1) at the walkline ends', () => {
    const params = makeSketchParams([{ id: 'r1', at: 0.3, length: 'auto' }]);
    const geometry = computeStairGeometry(params);
    const wl = geometry.walkline;
    const hi = applyStairGripDrag('stair-rest-landing-slide', {
      originalParams: params, delta: { x: 0, y: 0 },
      currentPos: { x: wl[wl.length - 1].x + 5000, y: 0 }, geometry, landingId: 'r1',
    });
    const lo = applyStairGripDrag('stair-rest-landing-slide', {
      originalParams: params, delta: { x: 0, y: 0 },
      currentPos: { x: wl[0].x - 5000, y: 0 }, geometry, landingId: 'r1',
    });
    expect(hi.restLandings![0].at).toBeGreaterThan(0);
    expect(hi.restLandings![0].at).toBeLessThan(1);
    expect(lo.restLandings![0].at).toBeGreaterThan(0);
    expect(lo.restLandings![0].at).toBeLessThan(1);
  });

  it('16. curved slide without geometry (no walkline) leaves the landing put', () => {
    const params = makeSketchParams([{ id: 'r1', at: 0.3, length: 'auto' }]);
    const next = applyStairGripDrag('stair-rest-landing-slide', {
      originalParams: params,
      delta: { x: 0, y: 0 },
      currentPos: { x: 99999, y: 0 },
      landingId: 'r1',
    });
    expect(next.restLandings![0].at).toBeCloseTo(0.3, 9); // unchanged (no curve to project onto)
  });

  it('17. curved length grip can grow past one tread (cap = walkline length, not totalRun)', () => {
    const params = makeSketchParams([{ id: 'r1', at: 0.5, length: 'auto' }]);
    const geometry = computeStairGeometry(params);
    const h = geometry.restLandingHandles![0];
    const next = applyStairGripDrag('stair-rest-landing-length-hi', {
      originalParams: params,
      delta: { x: 0, y: 0 },
      // Push 700 along +x from the handle centre → length 1400 (> tread 300).
      currentPos: { x: h.center.x + 700, y: h.center.y },
      geometry,
      landingId: 'r1',
    });
    expect(next.restLandings![0].length).toBeCloseTo(1400, 4);
    expect(next.restLandings![0].length).toBeGreaterThan(params.tread);
  });
});
