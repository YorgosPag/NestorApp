/**
 * ADR-441 Slice 6 — `reconcileGridStrips` signature-set diff tests.
 *
 * Επαληθεύει minimal delta: no-op σε αμετάβλητο, create-only σε νέα φατνώματα,
 * split (delete whole + create halves), corner-fill role change (delete+create),
 * και ότι μη grid-managed λωρίδες ΠΟΤΕ δεν διαγράφονται.
 */

import { reconcileGridStrips } from '../foundation-grid-reconcile';
import type { GuideBinding } from '../../hosting/guide-binding-types';
import type { FoundationEntity } from '../../types/foundation-types';

let idSeq = 0;
const strip = (
  bindings: GuideBinding[],
  start: { x: number; y: number },
  end: { x: number; y: number },
): FoundationEntity => ({
  id: `f${idSeq++}`,
  guideBindings: bindings,
  params: {
    kind: 'strip',
    start: { x: start.x, y: start.y, z: 0 },
    end: { x: end.x, y: end.y, z: 0 },
    width: 500,
    topElevationMm: 0,
    thicknessMm: 500,
  },
} as unknown as FoundationEntity);

const vbind = (xId: string, yA: string, yB: string): GuideBinding[] => [
  { guideId: xId, slot: 'start-x' },
  { guideId: xId, slot: 'end-x' },
  { guideId: yA, slot: 'start-y' },
  { guideId: yB, slot: 'end-y' },
];

describe('reconcileGridStrips', () => {
  it('αμετάβλητο (target ≡ existing) → no-op (0 create, 0 delete)', () => {
    const a = strip(vbind('x0', 'y0', 'y1'), { x: 0, y: 0 }, { x: 0, y: 4000 });
    const r = reconcileGridStrips([a], [{ ...a }]);
    expect(r.toCreate).toHaveLength(0);
    expect(r.toDelete).toHaveLength(0);
    expect(r.unchanged).toBe(1);
  });

  it('κενή σκηνή → όλα create', () => {
    const a = strip(vbind('x0', 'y0', 'y1'), { x: 0, y: 0 }, { x: 0, y: 4000 });
    const r = reconcileGridStrips([a], []);
    expect(r.toCreate).toHaveLength(1);
    expect(r.toDelete).toHaveLength(0);
    expect(r.unchanged).toBe(0);
  });

  it('split (ενδιάμεσος οδηγός): delete whole + create 2 halves', () => {
    const whole = strip(vbind('x0', 'y0', 'y2'), { x: 0, y: 0 }, { x: 0, y: 8000 });
    const half1 = strip(vbind('x0', 'y0', 'y1'), { x: 0, y: 0 }, { x: 0, y: 4000 });
    const half2 = strip(vbind('x0', 'y1', 'y2'), { x: 0, y: 4000 }, { x: 0, y: 8000 });
    const r = reconcileGridStrips([half1, half2], [whole]);
    expect(r.toCreate.map((s) => s.id).sort()).toEqual([half1.id, half2.id].sort());
    expect(r.toDelete.map((s) => s.id)).toEqual([whole.id]);
  });

  it('corner-fill role change: παλιά περιμετρική (extend) → delete· νέα χωρίς extend → create', () => {
    // ίδιο key V|x0|y0|y1, διαφορετική γεωμετρία (extend στο start-y).
    const oldPerimeter = strip(vbind('x0', 'y0', 'y1'), { x: 0, y: -300 }, { x: 0, y: 4000 });
    const newInterior = strip(vbind('x0', 'y0', 'y1'), { x: 0, y: 0 }, { x: 0, y: 4000 });
    const r = reconcileGridStrips([newInterior], [oldPerimeter]);
    expect(r.toDelete.map((s) => s.id)).toEqual([oldPerimeter.id]);
    expect(r.toCreate.map((s) => s.id)).toEqual([newInterior.id]);
    expect(r.unchanged).toBe(0);
  });

  it('μη grid-managed (χωρίς bindings) ΠΟΤΕ δεν διαγράφεται', () => {
    const manual = strip([], { x: 1000, y: 1000 }, { x: 5000, y: 1000 });
    const gridStrip = strip(vbind('x0', 'y0', 'y1'), { x: 0, y: 0 }, { x: 0, y: 4000 });
    const r = reconcileGridStrips([gridStrip], [manual]); // target δεν περιέχει το manual
    expect(r.toDelete).toHaveLength(0); // manual αγνοείται (null signature)
    expect(r.toCreate.map((s) => s.id)).toEqual([gridStrip.id]);
  });

  it('χειροκίνητη υπεροχή (5a-grid): existing justificationManual ≠ target → preserve (μηδέν reflow)', () => {
    // Ο μηχανικός όρισε justification με flag → managed reconcile ΔΕΝ το επαναφέρει.
    const target = strip(vbind('x0', 'y0', 'y1'), { x: 0, y: 0 }, { x: 0, y: 4000 });
    const base = strip(vbind('x0', 'y0', 'y1'), { x: 0, y: 0 }, { x: 0, y: 4000 });
    const manual = {
      ...base,
      params: { ...base.params, justification: 'left', justificationManual: true },
    } as FoundationEntity;
    const r = reconcileGridStrips([target], [manual]);
    expect(r.toDelete).toHaveLength(0);
    expect(r.toCreate).toHaveLength(0);
    expect(r.toReJustify).toHaveLength(0); // χειροκίνητη → δεν αγγίζεται
    expect(r.unchanged).toBe(1);
  });

  it('auto reflow (5a-grid): existing auto με stale justification ≠ target → re-justify στον κανόνα', () => {
    // Άξονας άλλαξε ρόλο (περιμετρικός→εσωτερικός): η παλιά auto λωρίδα ήταν inward,
    // ο κανόνας τώρα = center → self-heal χωρίς διαγραφή (κρατά id), αφού ΔΕΝ είναι manual.
    const target = strip(vbind('x0', 'y0', 'y1'), { x: 0, y: 0 }, { x: 0, y: 4000 }); // center
    const base = strip(vbind('x0', 'y0', 'y1'), { x: 0, y: 0 }, { x: 0, y: 4000 });
    const stale = { ...base, params: { ...base.params, justification: 'right' } } as FoundationEntity; // auto, no flag
    const r = reconcileGridStrips([target], [stale]);
    expect(r.toCreate).toHaveLength(0);
    expect(r.toDelete).toHaveLength(0);
    expect(r.toReJustify).toHaveLength(1);
    expect(r.toReJustify[0].original.id).toBe(stale.id);
    expect(r.toReJustify[0].rejustified.id).toBe(stale.id); // ίδιο id (in-place)
    // center → το πεδίο αφαιρείται (Firestore-clean).
    const nextParams = r.toReJustify[0].rejustified.params;
    expect('justification' in nextParams ? nextParams.justification : undefined).toBeUndefined();
    expect(r.unchanged).toBe(0);
  });

  it('μερική επικάλυψη: κρατά αμετάβλητες, create/delete μόνο το delta', () => {
    const keepV = strip(vbind('x0', 'y0', 'y1'), { x: 0, y: 0 }, { x: 0, y: 4000 });
    const dropV = strip(vbind('x1', 'y0', 'y1'), { x: 4000, y: 0 }, { x: 4000, y: 4000 });
    const newV = strip(vbind('x2', 'y0', 'y1'), { x: 8000, y: 0 }, { x: 8000, y: 4000 });
    const r = reconcileGridStrips([{ ...keepV }, newV], [keepV, dropV]);
    expect(r.toCreate.map((s) => s.id)).toEqual([newV.id]);
    expect(r.toDelete.map((s) => s.id)).toEqual([dropV.id]);
    expect(r.unchanged).toBe(1);
  });
});
