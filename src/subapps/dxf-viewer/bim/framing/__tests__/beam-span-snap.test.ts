/**
 * ADR-528 — Beam auto-span between two structural members (pure resolver tests).
 *
 * Επαληθεύει:
 *   (α) per-bay flush σε 2 κολόνες / 2 τοίχοι / μικτό· orientation-agnostic (οριζόντιο/κάθετο/λοξό),
 *   (β) §adjacency: σε σειρά συγγραμμικών (1-2-3-4) επιστρέφει το ΦΑΤΝΩΜΑ του cursor — ΠΟΤΕ span πάνω
 *       από ενδιάμεση στήριξη (το σενάριο του στιγμιότυπου: cursor μεταξύ 2&3 → bay 2-3, όχι 1→4),
 *   (γ) gating (<2 / εκτός ευθείας / εκτός κενού / επικάλυψη → null),
 *   (δ) §whole-line: `resolveBeamSpanChain` → N διαδοχικά φατνώματα (συνεχής δοκός N ανοιγμάτων).
 *
 * Μονάδες: 'mm' (f=1). Όλα τα outlines axis-baked ορθογώνια.
 */

import { resolveBeamSpanSnap, resolveBeamSpanChain } from '../beam-span-snap';
import type { Point2D } from '../../../rendering/types/Types';

/** Axis-aligned ορθογώνιο outline (CCW) κεντραρισμένο σε (cx,cy), διαστάσεων w×h. */
function rect(cx: number, cy: number, w: number, h: number): Point2D[] {
  const hw = w / 2;
  const hh = h / 2;
  return [
    { x: cx - hw, y: cy - hh },
    { x: cx + hw, y: cy - hh },
    { x: cx + hw, y: cy + hh },
    { x: cx - hw, y: cy + hh },
  ];
}

const near = (a: number, b: number, tol = 1e-3): boolean => Math.abs(a - b) <= tol;
const len = (s: { start: Point2D; end: Point2D }): number => Math.hypot(s.end.x - s.start.x, s.end.y - s.start.y);

describe('resolveBeamSpanSnap — per-bay (ADR-528)', () => {
  it('(α) γεφυρώνει 2 κολόνες οριζόντια — άκρα flush στις αντικριστές παρειές', () => {
    const colA = rect(0, 0, 400, 400);      // δεξιά παρειά x=200
    const colB = rect(2000, 0, 400, 400);   // αριστερή παρειά x=1800
    const r = resolveBeamSpanSnap({ x: 1000, y: 0 }, [colA, colB], 'mm');
    expect(r).not.toBeNull();
    expect(near(r!.start.x, 200)).toBe(true);
    expect(near(r!.end.x, 1800)).toBe(true);
    expect(near(r!.dist, 0)).toBe(true);
    // guide = κέντρο→κέντρο
    expect(near(r!.guide.a.x, 0)).toBe(true);
    expect(near(r!.guide.b.x, 2000)).toBe(true);
  });

  it('(α2) 2 τοίχοι + μικτό κολόνα/τοίχος (ένα μέλος = το outline του)', () => {
    const wallA = rect(0, 0, 250, 2000);    // δεξιά παρειά x=125
    const wallB = rect(3000, 0, 250, 2000); // αριστερή παρειά x=2875
    const r = resolveBeamSpanSnap({ x: 1500, y: 0 }, [wallA, wallB], 'mm');
    expect(r).not.toBeNull();
    expect(near(r!.start.x, 125)).toBe(true);
    expect(near(r!.end.x, 2875)).toBe(true);

    const col = rect(0, 0, 400, 400);       // δεξιά παρειά x=200
    const wall = rect(2500, 0, 250, 1800);  // αριστερή παρειά x=2375
    const m = resolveBeamSpanSnap({ x: 1200, y: 0 }, [col, wall], 'mm');
    expect(m).not.toBeNull();
    expect(near(m!.start.x, 200)).toBe(true);
    expect(near(m!.end.x, 2375)).toBe(true);
  });

  it('(α3) orientation-agnostic — κάθετο + λοξό (45°)', () => {
    const v = resolveBeamSpanSnap({ x: 0, y: 1000 }, [rect(0, 0, 400, 400), rect(0, 2000, 400, 400)], 'mm');
    expect(v).not.toBeNull();
    expect(near(v!.start.y, 200)).toBe(true);
    expect(near(v!.end.y, 1800)).toBe(true);

    const dgn = resolveBeamSpanSnap({ x: 1000, y: 1000 }, [rect(0, 0, 400, 400), rect(2000, 2000, 400, 400)], 'mm');
    expect(dgn).not.toBeNull();
    expect(near(dgn!.start.x, 200, 1)).toBe(true);
    expect(near(dgn!.end.x, 1800, 1)).toBe(true);
  });

  // ── §adjacency — ΤΟ ΣΕΝΑΡΙΟ ΤΟΥ ΣΤΙΓΜΙΟΤΥΠΟΥ (4 συγγραμμικές κολόνες Β-Ν) ──────────
  const col1 = rect(0, 0, 400, 400);
  const col2 = rect(0, 2000, 400, 400);
  const col3 = rect(0, 4000, 400, 400);
  const col4 = rect(0, 6000, 400, 400);
  const four = [col1, col2, col3, col4];

  it('(β) cursor μεταξύ 2&3 → bay 2-3 (ΟΧΙ span 1→4 πάνω από ενδιάμεσες)', () => {
    const r = resolveBeamSpanSnap({ x: 0, y: 3000 }, four, 'mm');
    expect(r).not.toBeNull();
    // bay 2-3: από βόρεια παρειά col2 (y=2200) έως νότια παρειά col3 (y=3800)
    expect(near(r!.start.y, 2200)).toBe(true);
    expect(near(r!.end.y, 3800)).toBe(true);
    expect(near(len(r!), 1600)).toBe(true);     // ΟΧΙ ~5600 (1→4)
  });

  it('(β2) cursor μεταξύ 1&2 → bay 1-2· μεταξύ 3&4 → bay 3-4', () => {
    const b12 = resolveBeamSpanSnap({ x: 0, y: 1000 }, four, 'mm');
    expect(near(b12!.start.y, 200)).toBe(true);
    expect(near(b12!.end.y, 1800)).toBe(true);
    const b34 = resolveBeamSpanSnap({ x: 0, y: 5000 }, four, 'mm');
    expect(near(b34!.start.y, 4200)).toBe(true);
    expect(near(b34!.end.y, 5800)).toBe(true);
  });

  it('(β3) #4 ως ΤΟΙΧΟΣ (μικτή σειρά) — bay 3-wall flush στην παρειά τοίχου', () => {
    const wall4 = rect(0, 6000, 1000, 250); // τοίχος· νότια παρειά y=5875
    const r = resolveBeamSpanSnap({ x: 0, y: 5000 }, [col1, col2, col3, wall4], 'mm');
    expect(r).not.toBeNull();
    expect(near(r!.start.y, 4200)).toBe(true);  // col3 βόρεια παρειά
    expect(near(r!.end.y, 5875)).toBe(true);    // wall νότια παρειά
  });

  it('(γ) gating: <2 / εκτός ευθείας / εκτός κενού / επικάλυψη → null', () => {
    expect(resolveBeamSpanSnap({ x: 0, y: 0 }, [col1], 'mm')).toBeNull();
    expect(resolveBeamSpanSnap({ x: 1000, y: 900 }, [rect(0, 0, 400, 400), rect(2000, 0, 400, 400)], 'mm')).toBeNull();
    expect(resolveBeamSpanSnap({ x: 2500, y: 0 }, [rect(0, 0, 400, 400), rect(2000, 0, 400, 400)], 'mm')).toBeNull();
    expect(resolveBeamSpanSnap({ x: 150, y: 0 }, [rect(0, 0, 400, 400), rect(300, 0, 400, 400)], 'mm')).toBeNull();
  });

  it('(γ2) nearest-wins: δύο παράλληλες ευθείες → νικά η κοντινότερη', () => {
    const r = resolveBeamSpanSnap({ x: 1000, y: 50 }, [rect(0, 0, 400, 400), rect(2000, 0, 400, 400), rect(0, 3000, 400, 400), rect(2000, 3000, 400, 400)], 'mm');
    expect(r).not.toBeNull();
    expect(near(r!.start.y, 0)).toBe(true);
    expect(near(r!.dist, 50)).toBe(true);
  });
});

describe('resolveBeamSpanChain — whole-line (ADR-528 §whole-line)', () => {
  const four = [rect(0, 0, 400, 400), rect(0, 2000, 400, 400), rect(0, 4000, 400, 400), rect(0, 6000, 400, 400)];

  it('4 συγγραμμικές κολόνες → 3 διαδοχικά φατνώματα (συνεχής δοκός 3 ανοιγμάτων)', () => {
    const bays = resolveBeamSpanChain({ x: 0, y: 3000 }, four, 'mm');
    expect(bays.length).toBe(3);
    // ταξινομημένα: 1-2, 2-3, 3-4 — κάθε φάτνωμα μήκος 1600, flush στις παρειές
    expect(near(bays[0].start.y, 200)).toBe(true);
    expect(near(bays[0].end.y, 1800)).toBe(true);
    expect(near(bays[1].start.y, 2200)).toBe(true);
    expect(near(bays[2].end.y, 5800)).toBe(true);
    bays.forEach((b) => expect(near(len(b), 1600)).toBe(true));
  });

  it('cursor εκτός ευθείας → άδειο chain', () => {
    expect(resolveBeamSpanChain({ x: 5000, y: 5000 }, four, 'mm')).toHaveLength(0);
  });

  it('2 μόνο μέλη → 1 φάτνωμα', () => {
    const bays = resolveBeamSpanChain({ x: 0, y: 1000 }, [rect(0, 0, 400, 400), rect(0, 2000, 400, 400)], 'mm');
    expect(bays.length).toBe(1);
  });
});
