/**
 * ADR-449 Slice 7 — structural-finish-silhouette tests.
 *
 * Καλύπτει το κρίσιμο: (Β) ένωση δομικών cores ανά ζώνη → ΕΝΑ outline (μηδέν internal
 * seam), (Α) τοίχος-obstacle αφαιρεί το καλυμμένο τμήμα (coplanarity), band decomposition,
 * regression μεμονωμένου μέλους.
 */

import {
  computeStructuralSilhouetteBands,
  type SilhouetteInput,
  type SilhouetteMember,
} from '../structural-finish-silhouette';
import type { FinishEdgeClassifier } from '../structural-finish-resolver';
import type { StructuralFinishSpec } from '../structural-finish-types';
import type { Pt2 } from '../../geometry/shared/segment-polygon-coverage';

const SPEC: StructuralFinishSpec = {
  enabled: true,
  interiorMaterialId: 'mat-plaster-int',
  exteriorMaterialId: 'mat-plaster-ext',
  thickness: 15,
};

const allInterior: FinishEdgeClassifier = () => 'interior';

/** Ορθογώνιο footprint [x0,x1]×[y0,y1] (CCW). */
const rect = (x0: number, y0: number, x1: number, y1: number): Pt2[] => [
  { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 },
];

/**
 * **CW** ορθογώνιο (signed-area<0) — μιμείται το beam `buildOutlineRect` outline. ΚΡΙΣΙΜΟ
 * regression: η `polygon-clipping` είναι winding-sensitive (CW ring = τρύπα) → το `safeUnion`
 * δεν θα ένωνε το δοκάρι με την κολώνα αν δεν κανονικοποιούσαμε σε CCW (ο σοβάς έβγαινε
 * εντός σώματος — Giorgio 2026-06-13).
 */
const cwRect = (x0: number, y0: number, x1: number, y1: number): Pt2[] => [
  { x: x0, y: y1 }, { x: x1, y: y1 }, { x: x1, y: y0 }, { x: x0, y: y0 },
];

const member = (footprint: Pt2[], zBotMm: number, zTopMm: number): SilhouetteMember => ({ footprint, zBotMm, zTopMm });

const baseInput = (members: SilhouetteMember[], wallObstacles: Pt2[][] = []): SilhouetteInput => ({
  members,
  wallObstacles,
  spec: SPEC,
  classify: allInterior,
  unitToMeters: 1, // lengthM = canvas length
});

/** Σ μηκών όλων των segments μιας ζώνης. */
const totalLength = (segments: readonly { lengthM: number }[]): number =>
  segments.reduce((s, seg) => s + seg.lengthM, 0);

describe('computeStructuralSilhouetteBands', () => {
  it('disabled spec → κενό', () => {
    const out = computeStructuralSilhouetteBands({
      ...baseInput([member(rect(0, 0, 50, 50), 0, 3000)]),
      spec: { ...SPEC, enabled: false },
    });
    expect(out).toHaveLength(0);
  });

  it('μεμονωμένο μέλος → 1 band, 4 segments, πλήρης περίμετρος (regression)', () => {
    const out = computeStructuralSilhouetteBands(baseInput([member(rect(0, 0, 50, 50), 0, 3000)]));
    expect(out).toHaveLength(1);
    expect(out[0].zBottomMm).toBe(0);
    expect(out[0].zTopMm).toBe(3000);
    expect(out[0].faces.segments).toHaveLength(4);
    expect(totalLength(out[0].faces.segments)).toBeCloseTo(200); // περίμετρος 50×4
  });

  it('Β: δύο επικαλυπτόμενα cores → ΕΝΑ outline (μηδέν internal seam στο x=50)', () => {
    // A=[0,50]² , B=[49,100]×[0,50] → union = ορθογώνιο [0,100]×[0,50], περίμετρος 300.
    const out = computeStructuralSilhouetteBands(baseInput([
      member(rect(0, 0, 50, 50), 0, 3000),
      member(rect(49, 0, 100, 50), 0, 3000),
    ]));
    expect(out).toHaveLength(1);
    const segs = out[0].faces.segments;
    // Ενιαία περίμετρος 300 < 400 (= 200+200 ξεχωριστά) → η internal ακμή x=50 εξαφανίστηκε.
    expect(totalLength(segs)).toBeCloseTo(300, 1);
    const internal = segs.filter((s) => Math.abs(s.a.x - 50) < 1e-6 && Math.abs(s.b.x - 50) < 1e-6);
    expect(internal).toHaveLength(0);
  });

  it('Α: τοίχος-obstacle αφαιρεί την καλυμμένη παρειά (coplanarity)', () => {
    // wall καλύπτει την κάτω-παρειά (y=0) → κανένα segment εκεί.
    const out = computeStructuralSilhouetteBands(baseInput(
      [member(rect(0, 0, 50, 50), 0, 3000)],
      [rect(-5, -5, 55, 5)],
    ));
    expect(out).toHaveLength(1);
    const bottom = out[0].faces.segments.filter((s) => Math.abs(s.a.y) < 1e-6 && Math.abs(s.b.y) < 1e-6);
    expect(bottom).toHaveLength(0);
  });

  it('band decomposition: κολόνα [0,3000] + δοκάρι [2500,3000] → 2 ζώνες', () => {
    const out = computeStructuralSilhouetteBands(baseInput([
      member(rect(0, 0, 50, 50), 0, 3000),         // κολόνα όλο το ύψος
      member(rect(0, 20, 200, 30), 2500, 3000),    // δοκάρι ζώνη κορυφής
    ]));
    expect(out).toHaveLength(2);
    expect(out[0].zBottomMm).toBe(0);
    expect(out[0].zTopMm).toBe(2500);
    expect(out[1].zBottomMm).toBe(2500);
    expect(out[1].zTopMm).toBe(3000);
    // Κάτω ζώνη = μόνο κολόνα (περίμετρος 200)· πάνω ζώνη = union (μεγαλύτερη).
    expect(totalLength(out[0].faces.segments)).toBeCloseTo(200);
    expect(totalLength(out[1].faces.segments)).toBeGreaterThan(200);
  });

  it('CW δοκάρι (buildOutlineRect winding) ενώνεται με CCW κολώνα — ΟΧΙ εντός σώματος', () => {
    // Κολώνα [-25,25]² (CCW) + CW δοκάρι x∈[0,200] y∈[-10,10] στη ζώνη κορυφής.
    // Χωρίς CCW-normalisation η polygon-clipping θεωρεί το CW δοκάρι τρύπα → δεν ενώνει.
    const out = computeStructuralSilhouetteBands(baseInput([
      member(rect(-25, -25, 25, 25), 0, 3000),
      member(cwRect(0, -10, 200, 10), 2500, 3000),
    ]));
    expect(out).toHaveLength(2);
    const junction = out[1].faces.segments; // z 2500..3000 = union κολώνα+δοκάρι
    // Το δοκάρι ΕΝΩΘΗΚΕ: η μακρινή άκρη του (x=200) εμφανίζεται στο ενιαίο outline.
    expect(junction.some((s) => Math.abs(s.a.x - 200) < 1e-6 || Math.abs(s.b.x - 200) < 1e-6)).toBe(true);
    // Η εσωτερική διεπαφή (δεξιά παρειά κολώνας x=25, y∈[-10,10]) ΔΕΝ παίρνει σοβά (internal).
    const internalJunction = junction.filter(
      (s) => Math.abs(s.a.x - 25) < 1e-6 && Math.abs(s.b.x - 25) < 1e-6 &&
        Math.max(s.a.y, s.b.y) <= 10 + 1e-6 && Math.min(s.a.y, s.b.y) >= -10 - 1e-6,
    );
    expect(internalJunction).toHaveLength(0);
  });

  it('κανένα μέλος → κενό', () => {
    expect(computeStructuralSilhouetteBands(baseInput([]))).toHaveLength(0);
  });
});
