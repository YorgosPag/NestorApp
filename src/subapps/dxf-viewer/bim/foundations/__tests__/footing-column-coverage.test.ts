/**
 * ADR-459 Phase 2 — footing↔column bearing coverage SSoT.
 *
 * Το ΕΝΑ κριτήριο που μοιράζονται graph + coordinator: plan coverage του κέντρου
 * βάσης + κατακόρυφο gate (άνω παρειά πεδίλου ≤ βάση κολόνας).
 */

import {
  FOOTING_Z_GATE_MM,
  footingSupportsColumnBase,
  polygonCentroid,
} from '../footing-column-coverage';

const square = (cx: number, cy: number, half: number) => [
  { x: cx - half, y: cy - half },
  { x: cx + half, y: cy - half },
  { x: cx + half, y: cy + half },
  { x: cx - half, y: cy + half },
];

describe('polygonCentroid', () => {
  it('returns the average of the vertices', () => {
    expect(polygonCentroid(square(10, 20, 5))).toEqual({ x: 10, y: 20 });
  });
});

describe('footingSupportsColumnBase', () => {
  const footing = { footprint: square(0, 0, 1000), topZmm: -1000 };

  it('supports a column whose base centroid is inside + base above footing top', () => {
    expect(footingSupportsColumnBase(footing, { baseCentroid: { x: 0, y: 0 }, baseZmm: 0 })).toBe(true);
  });

  it('rejects a column whose centroid is outside the footprint', () => {
    expect(footingSupportsColumnBase(footing, { baseCentroid: { x: 5000, y: 0 }, baseZmm: 0 })).toBe(false);
  });

  it('rejects when the footing top is above the column base (beyond the gate)', () => {
    expect(
      footingSupportsColumnBase({ footprint: square(0, 0, 1000), topZmm: 100 }, { baseCentroid: { x: 0, y: 0 }, baseZmm: 0 }),
    ).toBe(false);
  });

  it('tolerates a footing top within the Z gate of the column base', () => {
    expect(
      footingSupportsColumnBase({ footprint: square(0, 0, 1000), topZmm: FOOTING_Z_GATE_MM }, { baseCentroid: { x: 0, y: 0 }, baseZmm: 0 }),
    ).toBe(true);
  });

  it('rejects a degenerate footprint (< 3 vertices)', () => {
    expect(
      footingSupportsColumnBase({ footprint: [{ x: 0, y: 0 }, { x: 1, y: 1 }], topZmm: -1000 }, { baseCentroid: { x: 0, y: 0 }, baseZmm: 0 }),
    ).toBe(false);
  });
});
