/**
 * ADR-449 PART B — per-face paint corner regression (Giorgio 2026-07-19).
 *
 * Bug (live, C4D round-trip ΚΑΙ ζωντανό 2D/3D «Paint»): όταν ο σοβάς βάφεται ανά όψη, το
 * per-face override σπάει ένα collinear blanket run σε κομμάτια. Το split point μοιράζεται
 * κορυφή με collinear γείτονα → `tryMiterPair` το απορρίπτει (παράλληλα) → έπεφτε στο default
 * «chamfer 45°» που τραβούσε την εξωτερική γωνία **μέσα κατά το πάχος** → οι γωνίες της κολόνας
 * «έμπαιναν μέσα». Fix B: 4η περίπτωση «flush-collinear» (μηδέν chamfer σε σύνορο πάνω σε ευθεία).
 * Fix A: snap των split-boundaries κοντά στα άκρα → μηδέν εκφυλισμένα default slivers (weld drift).
 */

import { computeBandFinishQuads } from '../structural-finish-outline-geometry';
import { applyFinishOverrideEdges } from '../structural-finish-attribution';
import type { FinishFaceSegment } from '../structural-finish-types';

/** Οριζόντιο segment a→b (CCW → outward normal (0,−1)), πάχος 10 (scale 1 → offset y=−10). */
function seg(ax: number, bx: number, colorOverride?: string): FinishFaceSegment {
  return {
    a: { x: ax, y: 0 },
    b: { x: bx, y: 0 },
    classification: 'interior',
    materialId: 'mat-plaster',
    thickness: 10,
    lengthM: Math.abs(bx - ax) / 1000,
    aJunction: false,
    bJunction: false,
    aSquareEnd: false,
    bSquareEnd: false,
    ...(colorOverride ? { colorOverride } : {}),
  };
}

const near = (v: number, target: number) => Math.abs(v - target) < 1e-6;

describe('ADR-449 PART B — flush-collinear γωνία (fix B)', () => {
  it('σύνορο per-face override σε ευθεία → flush (ΟΧΙ chamfer μέσα κατά το πάχος)', () => {
    // Δύο collinear κομμάτια (split στο x=50) με ΔΙΑΦΟΡΕΤΙΚΟ χρώμα = per-face paint boundary.
    const quads = computeBandFinishQuads([seg(0, 50, '#C0392B'), seg(50, 100)], 1);
    expect(quads).toHaveLength(2);
    // Στην κοινή κορυφή (50,0) τα outer σημεία ΣΥΜΠΙΠΤΟΥΝ στο (50,−10) — flush, μηδέν «μέσα».
    expect(near(quads[0].bOuter.x, 50) && near(quads[0].bOuter.y, -10)).toBe(true);
    expect(near(quads[1].aOuter.x, 50) && near(quads[1].aOuter.y, -10)).toBe(true);
    // Regression guard: πριν το fix το bOuter τραβιόταν μέσα → x=40 (50 − πάχος). ΟΧΙ πλέον.
    expect(quads[0].bOuter.x).not.toBeCloseTo(40, 3);
  });

  it('γνήσιο ελεύθερο άκρο (μεμονωμένη όψη) → chamfer 45° ΠΑΡΑΜΕΝΕΙ (fix B δεν το χαλάει)', () => {
    const quads = computeBandFinishQuads([seg(0, 100)], 1);
    expect(quads).toHaveLength(1);
    // Ελεύθερα άκρα → chamfer προς τα μέσα κατά το πάχος (10): a→x=10, b→x=90.
    expect(quads[0].aOuter.x).toBeCloseTo(10, 6);
    expect(quads[0].bOuter.x).toBeCloseTo(90, 6);
  });
});

describe('ADR-449 PART B — snap split-boundaries (fix A)', () => {
  it('override-edge που καλύπτει ~όλο το segment (weld drift) → ΕΝΑ κομμάτι, μηδέν sliver', () => {
    const segments = [seg(0, 100)];
    // Η override-edge είναι ελαφρώς μέσα (a.x=0.4, weld drift) — χωρίς snap θα γεννούσε default
    // sliver [0, 0.004]. Με tol=1 → tSnap=0.01 → snap στο 0 → πλήρης κάλυψη, 1 κομμάτι.
    const edges = [{ a: { x: 0.4, y: 0 }, b: { x: 100, y: 0 }, override: { colorOverride: '#27AE60' } }];
    const pieces = applyFinishOverrideEdges(segments, edges, 1);
    expect(pieces).toHaveLength(1);
    expect(pieces[0].colorOverride).toBe('#27AE60');
  });
});
