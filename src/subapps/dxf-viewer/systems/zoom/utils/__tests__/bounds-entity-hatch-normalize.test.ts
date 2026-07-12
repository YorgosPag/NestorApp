/**
 * ADR-635 — HATCH must participate in bounds + import-recenter normalization.
 *
 * REGRESSION (2026-07-12, repro ΓΡΑΜΜΟΣΚΙΑΣΗ_ΜΕ_ΜΠΛΟΚ): `getEntityBounds` /
 * `normalizeEntityPositions` had no `case 'hatch'`. On import, `calculateTightBounds(…, true)`
 * recentres bottom-left → (0,0). Lines/arcs/blocks shifted to the origin while the hatch —
 * whose geometry lives in `boundaryPaths`, not a primitive field — was BOTH excluded from the
 * offset AND left untranslated, stranding it thousands of units from its siblings
 * («γραμμές & γραμμοσκίαση σε μεγάλες αποστάσεις»). These tests lock the hatch into both passes.
 */
import {
  getEntityBounds,
  calculateTightBounds,
  normalizeEntityPositions,
  type MutableBoundsEntity,
} from '../bounds-entity';

/** A square hatch ring at absolute coords ~ (3206..3218, 1451..1456) — the repro scale. */
const makeHatch = (): MutableBoundsEntity => ({
  type: 'hatch',
  boundaryPaths: [[
    { x: 3206, y: 1451 },
    { x: 3218, y: 1451 },
    { x: 3218, y: 1456 },
    { x: 3206, y: 1456 },
  ]],
});

/** A line right next to it (the sibling block/furniture edge in the repro). */
const makeLine = (): MutableBoundsEntity => ({
  type: 'line',
  start: { x: 3200, y: 1459 },
  end: { x: 3203, y: 1460 },
});

describe('getEntityBounds — hatch', () => {
  it('derives bounds from boundaryPaths rings', () => {
    const b = getEntityBounds(makeHatch());
    expect(b).toEqual({ min: { x: 3206, y: 1451 }, max: { x: 3218, y: 1456 } });
  });

  it('returns null for a hatch with no rings (no crash)', () => {
    expect(getEntityBounds({ type: 'hatch', boundaryPaths: [] })).toBeNull();
  });
});

describe('calculateTightBounds(normalize=true) — hatch travels with its siblings', () => {
  it('recentres hatch AND line together (bottom-left → 0,0)', () => {
    const hatch = makeHatch();
    const line = makeLine();
    // Line is the extreme bottom-left (x 3200, y 1459); hatch spans (3206..3218, 1451..1456).
    // True combined min = (3200, 1451) → offset (-3200, -1451).
    const bounds = calculateTightBounds([hatch, line], true);

    // Whole scene lands in the positive quadrant; the hatch (widest in x) sets max.x.
    expect(bounds.min).toEqual({ x: 0, y: 0 });
    expect(bounds.max.x).toBeCloseTo(18, 6); // 3218 - 3200
    expect(bounds.max.y).toBeCloseTo(9, 6);  // 1460 - 1451

    // Hatch ring translated by (-3200, -1451) — NOT stranded at 3206.
    expect(hatch.boundaryPaths![0][0]).toEqual({ x: 6, y: 0 });
    expect(hatch.boundaryPaths![0][2]).toEqual({ x: 18, y: 5 });
    // Line translated by the same offset.
    expect(line.start).toEqual({ x: 0, y: 8 });

    // The regression signature: hatch centre stays ~12u from the line, never thousands.
    const hb = getEntityBounds(hatch)!;
    const lb = getEntityBounds(line)!;
    const gap = Math.hypot(
      (hb.min.x + hb.max.x) / 2 - (lb.min.x + lb.max.x) / 2,
      (hb.min.y + hb.max.y) / 2 - (lb.min.y + lb.max.y) / 2,
    );
    expect(gap).toBeLessThan(20);
  });
});

describe('normalizeEntityPositions — hatch', () => {
  it('offsets every boundary vertex', () => {
    const hatch = makeHatch();
    normalizeEntityPositions([hatch], -3200, -1451);
    expect(hatch.boundaryPaths![0]).toEqual([
      { x: 6, y: 0 },
      { x: 18, y: 0 },
      { x: 18, y: 5 },
      { x: 6, y: 5 },
    ]);
  });
});
