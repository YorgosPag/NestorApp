/**
 * Regression (item C) — EXTEND arc angle unit.
 *
 * `extend-intersection-caster.extendArc` reused the RADIAN helpers `angleInSweep`
 * / `angularDistance*` / `arcEndpoint` while `ArcEntity.startAngle/endAngle` are
 * DEGREES (canonical). Before the deg→rad boundary fix, a real degree-arc was
 * mis-swept and the extended arc got a RADIAN angle written into a DEGREE field.
 */
import { castExtendIntersection } from '../extend-intersection-caster';
import type { ArcEntity, LineEntity } from '../../../types/entities';
import type { CuttingEdge } from '../../trim/trim-types';

describe('castExtendIntersection — ARC (degrees, item C)', () => {
  // Quarter arc in Q1: 0° (5,0) → 90° (0,5), CCW.
  const arc: ArcEntity = {
    id: 'arc1', type: 'arc', layerId: 'lyr_test_default', visible: true,
    center: { x: 0, y: 0 }, radius: 5, startAngle: 0, endAngle: 90, counterclockwise: true,
  };

  // Vertical boundary at x = 5·cos(135°) ⇒ the virtual full circle crosses it at 135° (0,+) and 225°.
  const X135 = 5 * Math.cos((135 * Math.PI) / 180); // ≈ −3.5355
  const boundary: LineEntity = {
    id: 'bnd1', type: 'line', layerId: 'lyr_test_default', visible: true,
    start: { x: X135, y: -10 }, end: { x: X135, y: 10 },
  };
  const boundaries: CuttingEdge[] = [{ sourceEntityId: 'bnd1', entity: boundary, extended: false }];

  it('extends the 90° end to the 135° boundary crossing — in DEGREES, not radians', () => {
    const op = castExtendIntersection(arc, { x: 0, y: 5 }, boundaries); // pick near the 90° end
    expect(op).not.toBeNull();
    expect(op?.kind).toBe('extend');
    const newArc = op?.newGeom as ArcEntity;
    // Correct (degrees): ≈135. Old radian bug would have written ≈2.356.
    expect(newArc.endAngle).toBeCloseTo(135, 0);
    expect(newArc.startAngle).toBe(0); // start end untouched
  });
});
