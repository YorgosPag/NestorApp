/**
 * ADR-459 Phase 7 — planFoundationLayout (auto isolated vs combined + sizing).
 */

import {
  planFoundationLayout,
  MIN_PAD_CLEARANCE_MM,
  type LayoutColumnInput,
} from '../auto-foundation-layout';
import { polygonAreaCentroid } from '../../geometry/shared/polygon-utils';

/** area-centroid του L-footprint (Point2D wrapper για το test). */
function areaCentroid(poly: readonly { x: number; y: number }[]): { x: number; y: number } {
  return polygonAreaCentroid(poly.map((p) => ({ ...p, z: 0 })));
}

/** Rotated-rectangle footprint (world) γύρω από (x,y), width×depth, CCW. */
function rectFootprint(
  x: number, y: number, widthMm: number, depthMm: number, rotationDeg: number,
): { x: number; y: number }[] {
  const hw = widthMm / 2;
  const hd = depthMm / 2;
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [
    { x: -hw, y: -hd }, { x: hw, y: -hd }, { x: hw, y: hd }, { x: -hw, y: hd },
  ].map((c) => ({ x: x + c.x * cos - c.y * sin, y: y + c.x * sin + c.y * cos }));
}

function col(
  id: string, x: number, y: number, axialServiceKn?: number, rotationDeg = 0,
  widthMm = 400, depthMm = 400,
): LayoutColumnInput {
  return {
    id,
    centroid: { x, y },
    footprint: rectFootprint(x, y, widthMm, depthMm, rotationDeg),
    widthMm,
    depthMm,
    axialServiceKn,
    baseZmm: -1000,
    rotationDeg,
  };
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

  it('isolated footing inherits the column rotation (Revit hosted follow)', () => {
    const plan = planFoundationLayout([col('A', 0, 0, undefined, 30)], undefined, 'mm');
    expect(plan.footings[0].rotationDeg).toBe(30);
  });

  it('combined footing is axis-aligned (rotation 0) regardless of column rotation', () => {
    const plan = planFoundationLayout(
      [col('A', 0, 0, undefined, 30), col('B', 600, 0, undefined, 45)],
      undefined,
      'mm',
    );
    expect(plan.footings[0].combined).toBe(true);
    expect(plan.footings[0].rotationDeg).toBe(0);
  });

  it('combined footing fully covers a 90°-rotated rectangular column (world AABB, not local swap)', () => {
    // Bug regression: col1 width=1000 (κατά Y λόγω rot90), depth=250 (κατά X).
    // Centroid (776, 750), world footprint Y∈[250,1250]. Το combined enclosure
    // ΠΡΕΠΕΙ να φτάσει τουλάχιστον col-top + overhang κατά Y, ΟΧΙ να μπερδέψει
    // width↔depth. Δεύτερη κολώνα ώστε να μπει στο combined path.
    const rotated = col('C1', 776, 750, 18, 90, 1000, 250);
    const neighbour = col('C2', 1276, 375, 14, 180, 750, 250);
    const plan = planFoundationLayout([rotated, neighbour], 200, 'mm');
    expect(plan.footings).toHaveLength(1);
    const f = plan.footings[0];
    expect(f.combined).toBe(true);

    // Το πέδιλο πρέπει να καλύπτει το ΠΡΑΓΜΑΤΙΚΟ world Y-extent της col1
    // ([250,1250]) + overhang 150 ανά πλευρά → top ≥ 1400, bottom ≤ 100.
    const top = f.position.y + f.lengthMm / 2;
    const bottom = f.position.y - f.lengthMm / 2;
    expect(top).toBeGreaterThanOrEqual(1400 - 1);
    expect(bottom).toBeLessThanOrEqual(100 + 1);

    // Και το X-extent της col2 ([901,1651]) + overhang → right ≥ 1801.
    const right = f.position.x + f.widthMm / 2;
    expect(right).toBeGreaterThanOrEqual(1801 - 1);
  });

  it('combined footing of two 90°-rotated tall columns grows along Y (no width/depth swap)', () => {
    // Δύο κολώνες 1000(Y)×250(X) στραμμένες 90°, στοιχισμένες κατά Y, κοντινές
    // κατά X → ενώνονται. Το enclosure κατά Y πρέπει να βασίζεται στο 1000 (world),
    // όχι στο depth 250.
    const a = col('A', 0, 0, 50, 90, 1000, 250);
    const b = col('B', 300, 0, 50, 90, 1000, 250);
    const plan = planFoundationLayout([a, b], undefined, 'mm');
    expect(plan.footings).toHaveLength(1);
    const f = plan.footings[0];
    // World Y half-extent ≥ 1000/2 + 150 overhang = 650· length ≥ 1300.
    expect(f.lengthMm).toBeGreaterThanOrEqual(1300 - 1);
  });

  it('isolated footing under an L-shaped (composite) column: centred on area-centroid + ≥150mm overhang all faces', () => {
    // L-footprint (Firestore-verified bug): κάτω βραχίονας x[651,1651] y[250,500] +
    // αριστερός βραχίονας x[651,901] y[500,1250]. Bbox 1000×1000, αλλά το υλικό
    // είναι εκκεντρικό. Vertex-mean = (1068,667)· AREA centroid ≈ (990.7, 589.3).
    const lFootprint = [
      { x: 651.4, y: 250 }, { x: 1651.4, y: 250 }, { x: 1651.4, y: 500 },
      { x: 901.4, y: 500 }, { x: 901.4, y: 1250 }, { x: 651.4, y: 1250 },
    ];
    const lColumn: LayoutColumnInput = {
      id: 'L', centroid: areaCentroid(lFootprint), footprint: lFootprint,
      widthMm: 1000, depthMm: 1000, axialServiceKn: 268, baseZmm: -1200, rotationDeg: 0,
    };
    const plan = planFoundationLayout([lColumn], 200, 'mm');
    expect(plan.footings).toHaveLength(1);
    const f = plan.footings[0];
    expect(f.combined).toBe(false);

    // Κεντράρισμα στο area-centroid (ΟΧΙ vertex-mean 1068/667, ΟΧΙ bbox-center 1151/750).
    expect(f.position.x).toBeCloseTo(990.7, 0);
    expect(f.position.y).toBeCloseTo(589.3, 0);

    // ≥150mm εξοχή σε ΚΑΘΕ παρειά του πραγματικού ίχνους (rotation 0 → axis-aligned).
    const left = f.position.x - f.widthMm / 2;
    const right = f.position.x + f.widthMm / 2;
    const bottom = f.position.y - f.lengthMm / 2;
    const topY = f.position.y + f.lengthMm / 2;
    expect(651.4 - left).toBeGreaterThanOrEqual(150 - 1);   // αριστερή παρειά
    expect(right - 1651.4).toBeGreaterThanOrEqual(150 - 1); // δεξιά άκρη κάτω βραχίονα
    expect(250 - bottom).toBeGreaterThanOrEqual(150 - 1);   // κάτω παρειά
    expect(topY - 1250).toBeGreaterThanOrEqual(150 - 1);    // πάνω άκρη αριστ. βραχίονα
  });
});
