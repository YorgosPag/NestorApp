/**
 * ADR-404 Φ5 — tests για το «βάση→κορυφή → ColumnTilt».
 *
 * `tiltAngleFromBaseTop` = η μόνη νέα μαθηματική πράξη (`angle = atan(distMm/heightMm)`,
 * αντίστροφο του `columnTiltShearAt`). `resolveTopLeanTilt` = SSoT composer (snapped
 * direction μέσω column-rotation + snapped angle) που μοιράζονται preview + commit.
 */

import {
  tiltAngleFromBaseTop,
  resolveTopLeanTilt,
  MAX_COLUMN_TILT_DEG,
} from '../column-tilt-from-points';

const H = 3000; // mm — τυπικό ύψος ορόφου
const FINE_WPP = 0.5; // ≤0.75 → 1° βήμα direction (resolveColumnRotationDeg), ώστε να μην «τραβάει»

describe('tiltAngleFromBaseTop (η νέα γωνιακή πράξη)', () => {
  it('15° round-trip: shift = height·tan(15°) ≈ 804mm → 15°', () => {
    const shift = H * Math.tan((15 * Math.PI) / 180);
    expect(tiltAngleFromBaseTop({ x: 0, y: 0 }, { x: shift, y: 0 }, H, 'mm')).toBeCloseTo(15, 5);
  });

  it('45° → οριζόντια απόσταση == ύψος', () => {
    expect(tiltAngleFromBaseTop({ x: 0, y: 0 }, { x: H, y: 0 }, H, 'mm')).toBeCloseTo(45, 5);
  });

  it('top === base → 0 (flat fast-path)', () => {
    expect(tiltAngleFromBaseTop({ x: 12, y: 34 }, { x: 12, y: 34 }, H, 'mm')).toBe(0);
  });

  it('μη-έγκυρο ύψος (≤0) → 0', () => {
    expect(tiltAngleFromBaseTop({ x: 0, y: 0 }, { x: 100, y: 0 }, 0, 'mm')).toBe(0);
    expect(tiltAngleFromBaseTop({ x: 0, y: 0 }, { x: 100, y: 0 }, -10, 'mm')).toBe(0);
  });

  it('clamp στη MAX_COLUMN_TILT_DEG (σχεδόν-οριζόντια τοποθέτηση)', () => {
    expect(tiltAngleFromBaseTop({ x: 0, y: 0 }, { x: H * 100, y: 0 }, H, 'mm')).toBe(MAX_COLUMN_TILT_DEG);
  });

  it('unit-safe: scene units = m → η απόσταση μετατρέπεται σε mm πριν τον λόγο', () => {
    // height 3000mm· top 3 (scene 'm') = 3000mm → 45°.
    expect(tiltAngleFromBaseTop({ x: 0, y: 0 }, { x: 3, y: 0 }, H, 'm')).toBeCloseTo(45, 5);
  });
});

describe('resolveTopLeanTilt (SSoT composer — preview ≡ commit)', () => {
  it('15° στον +X → {direction:0, angle:15} (snapped)', () => {
    const shift = H * Math.tan((15 * Math.PI) / 180);
    const tilt = resolveTopLeanTilt({ x: 0, y: 0 }, { x: shift, y: 0 }, H, 'mm', FINE_WPP);
    expect(tilt.direction).toBeCloseTo(0, 5);
    expect(tilt.angle).toBeCloseTo(15, 5);
  });

  it('direction στα τεταρτημόρια (μέσω column-rotation SSoT)', () => {
    expect(resolveTopLeanTilt({ x: 0, y: 0 }, { x: 0, y: H }, H, 'mm', FINE_WPP).direction).toBeCloseTo(90, 5);
    expect(resolveTopLeanTilt({ x: 0, y: 0 }, { x: -H, y: 0 }, H, 'mm', FINE_WPP).direction).toBeCloseTo(180, 5);
  });

  it('angle περνά από τον snap SSoT (5/15/30/45°): ~14° → 15', () => {
    const shift = H * Math.tan((14 * Math.PI) / 180);
    expect(resolveTopLeanTilt({ x: 0, y: 0 }, { x: shift, y: 0 }, H, 'mm', FINE_WPP).angle).toBe(15);
  });
});
