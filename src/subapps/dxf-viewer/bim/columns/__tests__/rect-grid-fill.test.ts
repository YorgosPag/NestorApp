/**
 * ADR-398 §3.16 — rect-grid-fill tests (m×n θέσεις, ίσες αποστάσεις+περιθώρια, rotated, edge cases).
 */

import { rectGridPositions } from '../rect-grid-fill';
import type { RectFrame } from '../framing/rect-frame';

const RECT: RectFrame = { center: { x: 0, y: 0 }, u: { x: 1, y: 0 }, v: { x: 0, y: 1 }, halfW: 3000, halfV: 2000 };

describe('rectGridPositions (ADR-398 §3.16)', () => {
  it('3×2 grid → 6 positions στις ακμές + κέντρο στήλης (clearance 0)', () => {
    const pts = rectGridPositions(RECT, 3, 2, 0);
    expect(pts).toHaveLength(6);
    // row -2000: x = -3000/0/3000
    expect(pts.slice(0, 3)).toEqual([
      { x: -3000, y: -2000 }, { x: 0, y: -2000 }, { x: 3000, y: -2000 },
    ]);
    expect(pts.slice(3)).toEqual([
      { x: -3000, y: 2000 }, { x: 0, y: 2000 }, { x: 3000, y: 2000 },
    ]);
  });

  it('honours the cover clearance (ακριανές μέσα κατά clearance)', () => {
    const pts = rectGridPositions(RECT, 2, 2, 250); // maxW 2750, maxV 1750
    expect(pts).toEqual([
      { x: -2750, y: -1750 }, { x: 2750, y: -1750 },
      { x: -2750, y: 1750 }, { x: 2750, y: 1750 },
    ]);
  });

  it('1×1 → μία κολώνα στο κέντρο', () => {
    expect(rectGridPositions(RECT, 1, 1, 0)).toEqual([{ x: 0, y: 0 }]);
  });

  it('ίσες αποστάσεις: 3 στήλες → span 3000 μεταξύ τους', () => {
    const pts = rectGridPositions(RECT, 3, 1, 0);
    expect(pts).toEqual([{ x: -3000, y: 0 }, { x: 0, y: 0 }, { x: 3000, y: 0 }]);
  });

  it('rotated rect (u/v 90°): θέσεις κατά τους στραμμένους άξονες', () => {
    const rot: RectFrame = { center: { x: 0, y: 0 }, u: { x: 0, y: 1 }, v: { x: -1, y: 0 }, halfW: 3000, halfV: 2000 };
    const pts = rectGridPositions(rot, 2, 1, 0); // 2 στήλες κατά u=+Y
    expect(pts).toEqual([{ x: 0, y: -3000 }, { x: 0, y: 3000 }]);
  });
});
