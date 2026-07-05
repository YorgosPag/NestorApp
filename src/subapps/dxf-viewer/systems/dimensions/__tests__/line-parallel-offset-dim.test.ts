/**
 * Unit tests for `resolveParallelOffsetDim` — η καθαρή γεωμετρία της κάθετης διάστασης
 * αρχικής↔φαντάσματος κατά τη μετακίνηση γραμμής (ADR-508/362, Giorgio 2026-07-05).
 */
import { resolveParallelOffsetDim } from '../line-parallel-offset-dim';

describe('resolveParallelOffsetDim (κάθετο offset αρχικής↔φαντάσματος)', () => {
  it('οριζόντια γραμμή + κάθετη μετάθεση → offset = |delta.y|, τμήμα στο μέσο', () => {
    const res = resolveParallelOffsetDim({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 });
    expect(res).not.toBeNull();
    expect(res!.distanceScene).toBeCloseTo(5, 9);
    expect(res!.p1).toEqual({ x: 5, y: 0 });          // μέσο αρχικής
    expect(res!.p2.x).toBeCloseTo(5, 9);
    expect(res!.p2.y).toBeCloseTo(5, 9);              // πόδι καθέτου στο φάντασμα
    expect(res!.dimLineRef).toEqual({ x: 5, y: 2.5 }); // dim line στο μέσο του τμήματος
  });

  it('μετάθεση ΚΑΤΑ ΜΗΚΟΣ του άξονα → null (οι γραμμές συμπίπτουν, καμία διάσταση)', () => {
    const res = resolveParallelOffsetDim({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 0 });
    expect(res).toBeNull();
  });

  it('λοξή/κατακόρυφη γραμμή + οριζόντια μετάθεση → offset = |delta·n̂| ανεξ. προσήμου', () => {
    const res = resolveParallelOffsetDim({ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 3, y: 0 });
    expect(res).not.toBeNull();
    expect(res!.distanceScene).toBeCloseTo(3, 9);
    expect(res!.p1).toEqual({ x: 0, y: 5 });
    expect(res!.p2.x).toBeCloseTo(3, 9);
    expect(res!.p2.y).toBeCloseTo(5, 9);
  });

  it('εκφυλισμένη γραμμή (start == end) → null', () => {
    const res = resolveParallelOffsetDim({ x: 2, y: 2 }, { x: 2, y: 2 }, { x: 4, y: 4 });
    expect(res).toBeNull();
  });

  it('διαγώνια μετάθεση διαγώνιας γραμμής → μόνο η κάθετη συνιστώσα μετράει', () => {
    // Γραμμή 45°: û=(1,1)/√2, n̂=(-1,1)/√2. delta=(0,4): offset = 0*(-1/√2)+4*(1/√2)=4/√2≈2.828.
    const res = resolveParallelOffsetDim({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 4 });
    expect(res).not.toBeNull();
    expect(res!.distanceScene).toBeCloseTo(4 / Math.SQRT2, 6);
  });
});
