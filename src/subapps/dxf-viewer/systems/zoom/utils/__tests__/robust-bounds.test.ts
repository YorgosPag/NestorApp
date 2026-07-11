/**
 * robust-bounds unit tests (Giorgio 2026-07-12).
 *
 * Locks the outlier-tolerant zoom-extents: drop a tiny minority of provably-far
 * flyaways, but NEVER clip a legitimately wide drawing (both gates must hold).
 */

import { computeRobustBounds } from '../robust-bounds';
import type { BoundingBox2D } from '../../../../rendering/hitTesting/entity-bounds-ssot';

/** A tiny box centered at (cx, cy). */
const box = (cx: number, cy: number, s = 1): BoundingBox2D => ({
  minX: cx - s, minY: cy - s, maxX: cx + s, maxY: cy + s,
});

describe('computeRobustBounds', () => {
  it('empty → null bounds, 0 dropped', () => {
    expect(computeRobustBounds([])).toEqual({ bounds: null, dropped: 0 });
  });

  it('too few entities (<8) → full union, no rejection (not enough to judge)', () => {
    const boxes = [box(0, 0), box(1_000_000, 1_000_000)];
    const r = computeRobustBounds(boxes);
    expect(r.dropped).toBe(0);
    expect(r.bounds).toEqual({ min: { x: -1, y: -1 }, max: { x: 1_000_001, y: 1_000_001 } });
  });

  it('REAL SCENARIO — dense 74m cluster + 7 flyaways at ~8.5km → drops the flyaways', () => {
    const cluster: BoundingBox2D[] = [];
    // 200 entities packed in a ~74m × 40m plan around (17.14M, 4.19M) — the real drawing.
    for (let i = 0; i < 200; i++) {
      cluster.push(box(17_140_000 + (i % 20) * 3700, 4_190_000 + Math.floor(i / 20) * 4000, 500));
    }
    // 7 corrupted import hatches ~8.5km away, on the y≈x diagonal (the observed garbage).
    const flyaways = [
      box(8_562_749, 8_562_934, 500), box(8_564_324, 8_564_509, 500),
      box(8_565_974, 8_566_159, 500), box(8_569_309, 8_569_169, 500),
      box(8_570_659, 8_570_474, 500), box(8_577_227, 8_577_434, 500),
      box(8_577_434, 8_577_434, 500),
    ];
    const r = computeRobustBounds([...cluster, ...flyaways]);
    expect(r.dropped).toBe(7);
    // The kept bounds must be the ~74m cluster, NOT the ~8.5km void.
    const w = r.bounds!.max.x - r.bounds!.min.x;
    expect(w).toBeLessThan(120_000); // < 120m, not ~8.6M
  });

  it('LEGIT wide drawing — uniform spread over 500m → keeps full union (0 dropped)', () => {
    const boxes: BoundingBox2D[] = [];
    for (let i = 0; i < 400; i++) {
      // evenly spread, no lone flyaway — a real site plan
      boxes.push(box((i * 1250) % 500_000, ((i * 3300) % 500_000), 100));
    }
    const r = computeRobustBounds(boxes);
    expect(r.dropped).toBe(0);
  });

  it('flyaways too many (>10%) → treated as legit spread, full union kept', () => {
    const boxes: BoundingBox2D[] = [];
    for (let i = 0; i < 80; i++) boxes.push(box(1000 + i, 1000 + i, 5));   // 80 near
    for (let i = 0; i < 20; i++) boxes.push(box(50_000_000 + i, 50_000_000 + i, 5)); // 20% far
    const r = computeRobustBounds(boxes);
    expect(r.dropped).toBe(0); // 20% > MAX_OUTLIER_FRACTION → no rejection
  });

  it('far entity but small shrink → keeps full (shrink gate blocks over-eager crop)', () => {
    // A tight cluster plus ONE point ~2× the cluster diagonal away: dropping it barely
    // shrinks the box, so the shrink-ratio gate keeps the honest full extents.
    const boxes: BoundingBox2D[] = [];
    for (let i = 0; i < 50; i++) boxes.push(box(1000 + i * 10, 1000, 5));
    boxes.push(box(2000, 1000, 5)); // near the cluster edge, not a km-scale flyaway
    const r = computeRobustBounds(boxes);
    expect(r.dropped).toBe(0);
  });
});
