/**
 * ADR-449 PART B Slice B — tests για το `applyFinishOverrideEdges` (blanket attribution).
 *
 * Καλύπτει το κρίσιμο συμβόλαιο:
 *  - **split στο σύνορο**: ΕΝΑ blanket segment που καλύπτει δύο collinear στοιχεία με
 *    ΔΙΑΦΟΡΕΤΙΚΟ override → σπάει σε 2 κομμάτια, σωστά stamped.
 *  - **stamp**: υλικό/χρώμα/πάχος του override υπερισχύει· gap = default (byte-for-byte).
 *  - **BOQ ταυτότητα**: Σ(lengthM) πριν == μετά (proportional split).
 *  - **junction/square flags**: μένουν ΜΟΝΟ στα πραγματικά άκρα, όχι στα split points.
 *  - **no-op**: κενές edges / μη-collinear / απέναντι παρειά → μηδέν αλλαγή.
 *  - **PART A round-trip**: split + re-merge same-material → ταυτότητα.
 */

import { applyFinishOverrideEdges, type FinishOverrideEdge } from '../structural-finish-attribution';
import { mergeCollinearFinishSegments } from '../structural-finish-merge';
import type { FinishFaceSegment } from '../structural-finish-types';

/** Segment factory: `lengthM` = ευκλείδειο μήκος a→b (unitToMeters=1), interior/plaster default. */
function seg(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  over: Partial<FinishFaceSegment> = {},
): FinishFaceSegment {
  return {
    a: { x: ax, y: ay },
    b: { x: bx, y: by },
    classification: 'interior',
    materialId: 'mat-plaster-int',
    thickness: 15,
    lengthM: Math.hypot(bx - ax, by - ay),
    ...over,
  };
}

const total = (segs: readonly FinishFaceSegment[]): number => segs.reduce((s, x) => s + x.lengthM, 0);

describe('applyFinishOverrideEdges (ADR-449 PART B Slice B)', () => {
  it('κενές edges → ίδια segments (νέο array, μηδέν αλλαγή)', () => {
    const input = [seg(0, 0, 20, 0)];
    const out = applyFinishOverrideEdges(input, []);
    expect(out).toEqual(input);
    expect(out).not.toBe(input);
  });

  it('override σε ΟΛΟ το segment → 1 κομμάτι stamped (υλικό+χρώμα)', () => {
    const edges: FinishOverrideEdge[] = [
      { a: { x: 0, y: 0 }, b: { x: 20, y: 0 }, override: { materialId: 'mat-gypsum-board', colorOverride: '#c0d8b0' } },
    ];
    const out = applyFinishOverrideEdges([seg(0, 0, 20, 0)], edges);
    expect(out).toHaveLength(1);
    expect(out[0].materialId).toBe('mat-gypsum-board');
    expect(out[0].colorOverride).toBe('#c0d8b0');
    expect(out[0].lengthM).toBeCloseTo(20);
  });

  it('SPLIT: blanket segment καλύπτει 2 collinear στοιχεία με διαφορετικό override → 2 κομμάτια', () => {
    // Blanket (0,0)-(20,0)· στοιχείο A παρειά (0,0)-(10,0) Knauf· στοιχείο B παρειά (10,0)-(20,0) βαφή.
    const edges: FinishOverrideEdge[] = [
      { a: { x: 0, y: 0 }, b: { x: 10, y: 0 }, override: { materialId: 'mat-gypsum-board' } },
      { a: { x: 10, y: 0 }, b: { x: 20, y: 0 }, override: { colorOverride: '#e0b0b0' } },
    ];
    const out = applyFinishOverrideEdges([seg(0, 0, 20, 0)], edges);
    expect(out).toHaveLength(2);
    // Κομμάτι 1: (0,0)-(10,0) Knauf.
    expect(out[0].a).toEqual({ x: 0, y: 0 });
    expect(out[0].b).toEqual({ x: 10, y: 0 });
    expect(out[0].materialId).toBe('mat-gypsum-board');
    expect(out[0].colorOverride).toBeUndefined();
    // Κομμάτι 2: (10,0)-(20,0) βαφή (υλικό default).
    expect(out[1].a).toEqual({ x: 10, y: 0 });
    expect(out[1].b).toEqual({ x: 20, y: 0 });
    expect(out[1].materialId).toBe('mat-plaster-int');
    expect(out[1].colorOverride).toBe('#e0b0b0');
    expect(total(out)).toBeCloseTo(20); // BOQ ταυτότητα
  });

  it('override σε ΜΕΡΟΣ του segment → 3 κομμάτια (default | override | default)', () => {
    const edges: FinishOverrideEdge[] = [
      { a: { x: 5, y: 0 }, b: { x: 15, y: 0 }, override: { materialId: 'mat-gypsum-board' } },
    ];
    const out = applyFinishOverrideEdges([seg(0, 0, 20, 0)], edges);
    expect(out).toHaveLength(3);
    expect(out[0].materialId).toBe('mat-plaster-int'); // (0..5) default
    expect(out[1].materialId).toBe('mat-gypsum-board'); // (5..15) override
    expect(out[2].materialId).toBe('mat-plaster-int'); // (15..20) default
    expect(total(out)).toBeCloseTo(20);
  });

  it('junction/square flags: μόνο στα πραγματικά άκρα, τα split points καθαρά', () => {
    const edges: FinishOverrideEdge[] = [
      { a: { x: 10, y: 0 }, b: { x: 20, y: 0 }, override: { colorOverride: '#e0b0b0' } },
    ];
    const out = applyFinishOverrideEdges(
      [seg(0, 0, 20, 0, { aJunction: true, bSquareEnd: true })],
      edges,
    );
    expect(out).toHaveLength(2);
    expect(out[0].aJunction).toBe(true); // start άκρο κρατιέται
    expect(out[0].bJunction).toBe(false); // split point → καθαρό
    expect(out[0].bSquareEnd).toBe(false);
    expect(out[1].aJunction).toBe(false); // split point → καθαρό
    expect(out[1].bSquareEnd).toBe(true); // end άκρο κρατιέται
  });

  it('thickness override → stamped ανά κομμάτι', () => {
    const edges: FinishOverrideEdge[] = [
      { a: { x: 0, y: 0 }, b: { x: 10, y: 0 }, override: { thickness: 25 } },
    ];
    const out = applyFinishOverrideEdges([seg(0, 0, 10, 0)], edges);
    expect(out[0].thickness).toBe(25);
  });

  it('μη-collinear override edge (απέναντι παρειά, παράλληλη offset) → αγνοείται', () => {
    // Απέναντι παρειά κολόνας 500mm: ίδια διεύθυνση, offset 500 → perp dist ≫ tol.
    const edges: FinishOverrideEdge[] = [
      { a: { x: 0, y: 500 }, b: { x: 20, y: 500 }, override: { materialId: 'mat-gypsum-board' } },
    ];
    const out = applyFinishOverrideEdges([seg(0, 0, 20, 0)], edges);
    expect(out).toHaveLength(1);
    expect(out[0].materialId).toBe('mat-plaster-int'); // αμετάβλητο
  });

  it('κάθετη override edge (τέμνει αλλά όχι collinear) → αγνοείται', () => {
    const edges: FinishOverrideEdge[] = [
      { a: { x: 10, y: -5 }, b: { x: 10, y: 5 }, override: { materialId: 'mat-gypsum-board' } },
    ];
    const out = applyFinishOverrideEdges([seg(0, 0, 20, 0)], edges);
    expect(out).toHaveLength(1);
    expect(out[0].materialId).toBe('mat-plaster-int');
  });

  it('φορά-agnostic: override edge b→a ταιριάζει το segment a→b', () => {
    const edges: FinishOverrideEdge[] = [
      { a: { x: 20, y: 0 }, b: { x: 0, y: 0 }, override: { materialId: 'mat-gypsum-board' } },
    ];
    const out = applyFinishOverrideEdges([seg(0, 0, 20, 0)], edges);
    expect(out).toHaveLength(1);
    expect(out[0].materialId).toBe('mat-gypsum-board');
  });

  it('PART A round-trip: split + re-merge same-material → 1 segment (μηδέν regression)', () => {
    // Δύο collinear στοιχεία ΙΔΙΟΥ override → split, μετά ο PART A merge τα ξαναενώνει.
    const edges: FinishOverrideEdge[] = [
      { a: { x: 0, y: 0 }, b: { x: 10, y: 0 }, override: { materialId: 'mat-gypsum-board' } },
      { a: { x: 10, y: 0 }, b: { x: 20, y: 0 }, override: { materialId: 'mat-gypsum-board' } },
    ];
    const attributed = applyFinishOverrideEdges([seg(0, 0, 20, 0)], edges);
    expect(attributed).toHaveLength(2); // stamp split κρατά την κοινή κορυφή
    const merged = mergeCollinearFinishSegments(attributed);
    expect(merged).toHaveLength(1); // same material → ξαναενώνεται
    expect(merged[0].materialId).toBe('mat-gypsum-board');
    expect(merged[0].lengthM).toBeCloseTo(20);
  });

  it('PART A round-trip: διαφορετικό override → ΜΕΝΕΙ σπασμένο (καθαρό σύνορο)', () => {
    const edges: FinishOverrideEdge[] = [
      { a: { x: 0, y: 0 }, b: { x: 10, y: 0 }, override: { materialId: 'mat-gypsum-board' } },
      { a: { x: 10, y: 0 }, b: { x: 20, y: 0 }, override: { materialId: 'mat-plaster-ext' } },
    ];
    const merged = mergeCollinearFinishSegments(applyFinishOverrideEdges([seg(0, 0, 20, 0)], edges));
    expect(merged).toHaveLength(2);
  });
});
