/**
 * ADR-404 — column-tilt SSoT (raking column).
 *
 * Ελέγχει το `isColumnTilted`/`columnTiltShearAt`:
 *   - flat (απών/μηδενική γωνία) → no shift (fast-path)
 *   - height 0 → no shift (η βάση μένει αγκυρωμένη)
 *   - direction 0/90 → shift κατά plan-X / plan-Y
 *   - magnitude = height·tan(angle) (γραμμικό στο ύψος)
 *   - unit-safety: dx/dy κλιμακώνεται γραμμικά με το ύψος (tan αδιάστατο)
 */

import { columnTiltShearAt, isColumnTilted } from '../column-tilt';
import type { ColumnParams, ColumnTilt } from '../../types/column-types';

function makeColumn(tilt?: ColumnTilt): ColumnParams {
  return {
    kind: 'rectangular',
    position: { x: 0, y: 0, z: 0 },
    anchor: 'center',
    width: 400,
    depth: 400,
    height: 3000,
    rotation: 0,
    tilt,
    baseBinding: 'storey-floor',
    topBinding: 'storey-ceiling',
    baseOffset: 0,
    topOffset: 0,
    sceneUnits: 'mm',
  } as ColumnParams;
}

describe('isColumnTilted', () => {
  it('no tilt → false', () => {
    expect(isColumnTilted(makeColumn())).toBe(false);
  });
  it('angle 0 → false', () => {
    expect(isColumnTilted(makeColumn({ direction: 0, angle: 0 }))).toBe(false);
  });
  it('angle ≠ 0 → true', () => {
    expect(isColumnTilted(makeColumn({ direction: 0, angle: 15 }))).toBe(true);
  });
});

describe('columnTiltShearAt', () => {
  it('flat → no shift', () => {
    const s = columnTiltShearAt(makeColumn(), 1000);
    expect(s.dx).toBe(0);
    expect(s.dy).toBe(0);
  });

  it('height 0 → no shift (base anchored)', () => {
    const s = columnTiltShearAt(makeColumn({ direction: 30, angle: 45 }), 0);
    expect(s.dx).toBeCloseTo(0, 9);
    expect(s.dy).toBeCloseTo(0, 9);
  });

  it('direction 0°, angle 45°, height 1000 → +X by 1000', () => {
    const s = columnTiltShearAt(makeColumn({ direction: 0, angle: 45 }), 1000);
    expect(s.dx).toBeCloseTo(1000, 6);
    expect(s.dy).toBeCloseTo(0, 6);
  });

  it('direction 90°, angle 45°, height 1000 → +Y by 1000', () => {
    const s = columnTiltShearAt(makeColumn({ direction: 90, angle: 45 }), 1000);
    expect(s.dx).toBeCloseTo(0, 6);
    expect(s.dy).toBeCloseTo(1000, 6);
  });

  it('magnitude = height·tan(angle)', () => {
    const s = columnTiltShearAt(makeColumn({ direction: 0, angle: 30 }), 2000);
    expect(Math.hypot(s.dx, s.dy)).toBeCloseTo(2000 * Math.tan((30 * Math.PI) / 180), 6);
  });

  it('unit-safety: shift scales linearly with height', () => {
    const tilt = { direction: 17, angle: 23 };
    const a = columnTiltShearAt(makeColumn(tilt), 1);
    const b = columnTiltShearAt(makeColumn(tilt), 1000);
    expect(b.dx).toBeCloseTo(a.dx * 1000, 6);
    expect(b.dy).toBeCloseTo(a.dy * 1000, 6);
  });
});
