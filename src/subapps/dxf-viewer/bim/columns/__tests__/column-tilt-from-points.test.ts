/**
 * ADR-404 Φ5 — tests για το `tiltFromBaseTop` (βάση→κορυφή → ColumnTilt).
 *
 * Η κεκλιμένη κολώνα (Revit «Slanted Column») ορίζεται με 2 κλικ· η οριζόντια
 * απόσταση βάση→κορυφή = `height·tan(angle)` (η ευθεία πράξη του `columnTiltShearAt`),
 * οπότε `angle = atan(distMm / heightMm)`. Επαληθεύουμε το round-trip + edge cases.
 */

import { tiltFromBaseTop, MAX_COLUMN_TILT_DEG } from '../column-tilt-from-points';

const H = 3000; // mm — τυπικό ύψος ορόφου

describe('tiltFromBaseTop', () => {
  it('15° round-trip: top μετατοπισμένο κατά height·tan(15°) ≈ 804mm στον +X', () => {
    const shift = H * Math.tan((15 * Math.PI) / 180); // ≈ 803.8mm
    const tilt = tiltFromBaseTop({ x: 0, y: 0 }, { x: shift, y: 0 }, H, 'mm');
    expect(tilt.angle).toBeCloseTo(15, 5);
    expect(tilt.direction).toBeCloseTo(0, 5);
  });

  it('45° → οριζόντια απόσταση == ύψος', () => {
    const tilt = tiltFromBaseTop({ x: 0, y: 0 }, { x: H, y: 0 }, H, 'mm');
    expect(tilt.angle).toBeCloseTo(45, 5);
  });

  it('direction στα 4 τεταρτημόρια (atan2 CCW από +X)', () => {
    expect(tiltFromBaseTop({ x: 0, y: 0 }, { x: 100, y: 0 }, H, 'mm').direction).toBeCloseTo(0, 5);
    expect(tiltFromBaseTop({ x: 0, y: 0 }, { x: 0, y: 100 }, H, 'mm').direction).toBeCloseTo(90, 5);
    expect(tiltFromBaseTop({ x: 0, y: 0 }, { x: -100, y: 0 }, H, 'mm').direction).toBeCloseTo(180, 5);
    expect(tiltFromBaseTop({ x: 0, y: 0 }, { x: 0, y: -100 }, H, 'mm').direction).toBeCloseTo(-90, 5);
  });

  it('top === base → {direction:0, angle:0} (flat fast-path)', () => {
    const tilt = tiltFromBaseTop({ x: 12, y: 34 }, { x: 12, y: 34 }, H, 'mm');
    expect(tilt).toEqual({ direction: 0, angle: 0 });
  });

  it('μη-έγκυρο ύψος (≤0) → flat', () => {
    expect(tiltFromBaseTop({ x: 0, y: 0 }, { x: 100, y: 0 }, 0, 'mm')).toEqual({ direction: 0, angle: 0 });
    expect(tiltFromBaseTop({ x: 0, y: 0 }, { x: 100, y: 0 }, -10, 'mm')).toEqual({ direction: 0, angle: 0 });
  });

  it('clamp στη MAX_COLUMN_TILT_DEG (σχεδόν-οριζόντια τοποθέτηση)', () => {
    // απόσταση 100×ύψος → atan ≈ 89.4° → clamped
    const tilt = tiltFromBaseTop({ x: 0, y: 0 }, { x: H * 100, y: 0 }, H, 'mm');
    expect(tilt.angle).toBe(MAX_COLUMN_TILT_DEG);
  });

  it('unit-safe: σε scene units = m, η απόσταση μετατρέπεται σε mm πριν τον λόγο', () => {
    // height 3000mm· top 3m=3000mm στον +X (σε scene units 'm' η απόσταση είναι 3) → 45°.
    const tilt = tiltFromBaseTop({ x: 0, y: 0 }, { x: 3, y: 0 }, H, 'm');
    expect(tilt.angle).toBeCloseTo(45, 5);
  });
});
