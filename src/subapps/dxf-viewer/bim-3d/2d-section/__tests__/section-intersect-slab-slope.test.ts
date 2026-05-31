/**
 * ADR-401 Phase E2 / ADR-369 §9 Q7 — slabSection slope-at-cut tests.
 *
 * Επιβεβαιώνει ότι η εγκάρσια τομή κεκλιμένης πλάκας/στέγης αποτιμά την παρειά
 * στο σημείο της τομής (single-point rect, mirror `wallSection`): επίπεδη πλάκα →
 * flat· tilted → διαφορετικό yMin/yMax ανά θέση cut, σταθερό πάχος.
 */

import { toSlabPlan, slabSection } from '../section-intersect';
import { slabUndersideZmmAt, slabTopZmmAt } from '../../../bim/geometry/slab-slope';
import type { SlabEntity, SlabParams } from '../../../bim/types/slab-types';

const MM_TO_M = 0.001;

/** 10000×10000 mm τετράγωνο, AABB center (5000,5000). */
const SQUARE = {
  vertices: [
    { x: 0, y: 0, z: 0 },
    { x: 10000, y: 0, z: 0 },
    { x: 10000, y: 10000, z: 0 },
    { x: 0, y: 10000, z: 0 },
  ],
};

function makeSlab(over: Partial<SlabParams> = {}): SlabEntity {
  const params: SlabParams = {
    kind: 'roof', outline: SQUARE, levelElevation: 3000, thickness: 200,
    geometryType: 'box', sceneUnits: 'mm', ...over,
  } as SlabParams;
  return {
    id: 's', type: 'slab', kind: params.kind, ifcType: 'IfcSlab', layerId: '0', params,
    geometry: {} as SlabEntity['geometry'],
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null }, visible: true,
  } as unknown as SlabEntity;
}

const TILT = { geometryType: 'tilted' as const, slope: { direction: 0, angle: 10, pivotEdge: 'center' as const } };
const TOL = 6;

describe('toSlabPlan — slopeYAt', () => {
  it('επίπεδη πλάκα → χωρίς slopeYAt', () => {
    expect(toSlabPlan(makeSlab()).slopeYAt).toBeUndefined();
  });
  it('tilted → slopeYAt αποτιμά top/bottom (m) === SSoT', () => {
    const plan = toSlabPlan(makeSlab(TILT));
    expect(plan.slopeYAt).toBeDefined();
    const pt = { x: 10000, y: 5000 };
    const got = plan.slopeYAt!(pt);
    expect(got.topY).toBeCloseTo(slabTopZmmAt(makeSlab(TILT).params, pt) * MM_TO_M, TOL);
    expect(got.bottomY).toBeCloseTo(slabUndersideZmmAt(makeSlab(TILT).params, pt) * MM_TO_M, TOL);
  });
});

describe('slabSection — flat back-compat', () => {
  it('επίπεδη → yMin=2.8 yMax=3.0 παντού', () => {
    const s = toSlabPlan(makeSlab());
    const rect = slabSection(s, 'y', 5000);
    expect(rect).not.toBeNull();
    expect(rect?.yMin).toBeCloseTo(2.8, TOL);
    expect(rect?.yMax).toBeCloseTo(3.0, TOL);
  });
});

describe('slabSection — ADR-401 slope-at-cut', () => {
  const s = toSlabPlan(makeSlab(TILT));

  it('cut στο pivot (x=5000) → nominal top 3.0m', () => {
    // axis='y', pos=5000 → perpendicular=x, span x∈[0,10000], mid=5000=pivot → offset 0.
    const rect = slabSection(s, 'y', 5000);
    expect(rect?.yMax).toBeCloseTo(3.0, TOL);
    expect(rect?.yMin).toBeCloseTo(2.8, TOL);
  });

  it('cut στην ανηφορική πλευρά (x=8000) → top ανεβαίνει + σταθερό πάχος', () => {
    // axis='x', pos=8000 → perpendicular=y, mid=5000 → pt=(8000,5000)· offset=(3000)·0.1=300mm.
    const rect = slabSection(s, 'x', 8000)!;
    expect(rect.yMax).toBeCloseTo(3.3, TOL); // 3000+300 mm
    expect(rect.yMax - rect.yMin).toBeCloseTo(0.2, TOL); // σταθερό πάχος
  });

  it('cut στην κατηφορική πλευρά (x=2000) → top κατεβαίνει', () => {
    const rect = slabSection(s, 'x', 2000)!;
    expect(rect.yMax).toBeCloseTo(2.7, TOL); // 3000−300 mm
  });
});
