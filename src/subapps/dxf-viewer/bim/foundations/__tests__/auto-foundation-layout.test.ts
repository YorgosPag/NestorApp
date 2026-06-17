/**
 * ADR-459 Phase 7 — planFoundationLayout (auto isolated vs combined + sizing).
 */

import {
  planFoundationLayout,
  MIN_PAD_CLEARANCE_MM,
  type LayoutColumnInput,
} from '../auto-foundation-layout';

function col(id: string, x: number, y: number, axialServiceKn?: number): LayoutColumnInput {
  return { id, centroid: { x, y }, widthMm: 400, depthMm: 400, axialServiceKn, baseZmm: -1000 };
}

describe('planFoundationLayout', () => {
  it('returns empty plan for no columns', () => {
    expect(planFoundationLayout([], 200, 'mm').footings).toEqual([]);
  });

  it('two distant columns (5m) → two isolated footings', () => {
    const plan = planFoundationLayout([col('A', 0, 0), col('B', 5000, 0)], undefined, 'mm');
    expect(plan.footings).toHaveLength(2);
    expect(plan.footings.every((f) => !f.combined)).toBe(true);
    expect(plan.footings.every((f) => f.columnIds.length === 1)).toBe(true);
  });

  it('two near columns (overlapping required pads) → one combined footing', () => {
    // 400mm column → geometric pad 700mm (400 + 2·150 overhang). Centres 600 apart →
    // gap = 600 − 700 = −100 < clearance → ένωση.
    const plan = planFoundationLayout([col('A', 0, 0), col('B', 600, 0)], undefined, 'mm');
    expect(plan.footings).toHaveLength(1);
    const f = plan.footings[0];
    expect(f.combined).toBe(true);
    expect(f.columnIds).toEqual(['A', 'B']); // sorted
  });

  it('transitive grouping: A∩B, B∩C → one group {A,B,C}', () => {
    const plan = planFoundationLayout(
      [col('A', 0, 0), col('B', 600, 0), col('C', 1200, 0)],
      undefined,
      'mm',
    );
    expect(plan.footings).toHaveLength(1);
    expect(plan.footings[0].columnIds).toEqual(['A', 'B', 'C']);
  });

  it('isolated pad sizes from bearing: A_req = N/σ_allow', () => {
    // 700 kN / 200 kPa = 3.5 m² → side √3.5 = 1.871 m → 1900 mm (round-up 50).
    const plan = planFoundationLayout([col('A', 0, 0, 700)], 200, 'mm');
    expect(plan.footings).toHaveLength(1);
    expect(plan.footings[0].widthMm).toBe(1900);
    expect(plan.footings[0].lengthMm).toBe(1900);
  });

  it('isolated pad falls back to geometric minimum without load/σ', () => {
    const plan = planFoundationLayout([col('A', 0, 0)], undefined, 'mm');
    expect(plan.footings[0].widthMm).toBe(700); // 400 + 2·150
  });

  it('combined footing area ≥ ΣN/σ_allow and centred on the load centroid', () => {
    const plan = planFoundationLayout(
      [col('A', 0, 0, 600), col('B', 600, 0, 600)],
      200,
      'mm',
    );
    const f = plan.footings[0];
    const reqAreaMm2 = (1200 / 200) * 1_000_000; // 6 m²
    expect(f.widthMm * f.lengthMm).toBeGreaterThanOrEqual(reqAreaMm2 - 1);
    expect(f.position.x).toBeCloseTo(300); // equal loads → midpoint
    expect(f.axialServiceKn).toBe(1200);
  });

  it('clearance constant is the construction gap below which pads merge', () => {
    expect(MIN_PAD_CLEARANCE_MM).toBe(100);
  });
});
