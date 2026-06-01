/**
 * ADR-404 — wall-tilt SSoT (battered wall).
 *
 * Ελέγχει το `isWallTilted`/`wallTiltShearAt`:
 *   - flat (απών/μηδενική γωνία) → no shift (fast-path)
 *   - height 0 → no shift (η βάση μένει αγκυρωμένη)
 *   - lean ⟂ στη φορά start→end (αριστερή κάθετη για +angle)
 *   - signed angle → αντίθετη πλευρά
 *   - εκφυλισμένος άξονας → no shift
 *   - unit-safety: γραμμικό στο ύψος
 */

import { wallTiltShearAt, isWallTilted } from '../wall-tilt';
import type { WallParams, WallTilt } from '../../types/wall-types';

function makeWall(tilt?: WallTilt, over: Partial<WallParams> = {}): WallParams {
  return {
    category: 'interior',
    start: { x: 0, y: 0, z: 0 },
    end: { x: 1000, y: 0, z: 0 },
    height: 3000,
    thickness: 200,
    flip: false,
    tilt,
    baseBinding: 'storey-floor',
    topBinding: 'storey-ceiling',
    baseOffset: 0,
    topOffset: 0,
    sceneUnits: 'mm',
    ...over,
  } as WallParams;
}

describe('isWallTilted', () => {
  it('no tilt → false', () => {
    expect(isWallTilted(makeWall())).toBe(false);
  });
  it('angle 0 → false', () => {
    expect(isWallTilted(makeWall({ angle: 0 }))).toBe(false);
  });
  it('angle ≠ 0 → true', () => {
    expect(isWallTilted(makeWall({ angle: 10 }))).toBe(true);
  });
});

describe('wallTiltShearAt', () => {
  it('flat → no shift', () => {
    const s = wallTiltShearAt(makeWall(), 1000);
    expect(s.dx).toBe(0);
    expect(s.dy).toBe(0);
  });

  it('height 0 → no shift (base anchored)', () => {
    const s = wallTiltShearAt(makeWall({ angle: 45 }), 0);
    expect(s.dx).toBeCloseTo(0, 9);
    expect(s.dy).toBeCloseTo(0, 9);
  });

  it('axis +X, angle 45°, height 1000 → +Y by 1000 (left perpendicular)', () => {
    const s = wallTiltShearAt(makeWall({ angle: 45 }), 1000);
    expect(s.dx).toBeCloseTo(0, 6);
    expect(s.dy).toBeCloseTo(1000, 6);
  });

  it('negative angle → opposite side (−Y)', () => {
    const s = wallTiltShearAt(makeWall({ angle: -45 }), 1000);
    expect(s.dx).toBeCloseTo(0, 6);
    expect(s.dy).toBeCloseTo(-1000, 6);
  });

  it('axis +Y, angle 45°, height 1000 → −X (left perpendicular of +Y)', () => {
    const s = wallTiltShearAt(makeWall({ angle: 45 }, { end: { x: 0, y: 1000, z: 0 } }), 1000);
    expect(s.dx).toBeCloseTo(-1000, 6);
    expect(s.dy).toBeCloseTo(0, 6);
  });

  it('degenerate axis (start === end) → no shift', () => {
    const s = wallTiltShearAt(makeWall({ angle: 45 }, { end: { x: 0, y: 0, z: 0 } }), 1000);
    expect(s.dx).toBe(0);
    expect(s.dy).toBe(0);
  });

  it('unit-safety: shift scales linearly with height', () => {
    const a = wallTiltShearAt(makeWall({ angle: 23 }), 1);
    const b = wallTiltShearAt(makeWall({ angle: 23 }), 1000);
    expect(b.dy).toBeCloseTo(a.dy * 1000, 6);
  });
});
