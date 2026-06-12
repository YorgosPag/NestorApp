/**
 * ADR-441 Slice 6+9 — `reconcileGridStrips` binding-aware managed diff tests.
 *
 * Επαληθεύει minimal delta με ταυτότητα = `segmentKey` (coordinate-free):
 * no-op σε αμετάβλητο, create-only σε νέα φατνώματα, split (delete whole + create
 * halves), **managed update in-place** σε μετακίνηση άξονα (κρατά id + instance
 * overrides — Slice 9 coordinate-follow + 5a-grid re-justify), crossing carry-over,
 * dedup διπλών segmentKeys, και ότι μη grid-managed λωρίδες ΠΟΤΕ δεν διαγράφονται.
 */

import { reconcileGridStrips } from '../foundation-grid-reconcile';
import type { GuideBinding } from '../../hosting/guide-binding-types';
import type { FoundationEntity, StripJustification } from '../../types/foundation-types';

let idSeq = 0;
const strip = (
  bindings: GuideBinding[],
  start: { x: number; y: number },
  end: { x: number; y: number },
  extra?: { justification?: StripJustification; justificationManual?: boolean; width?: number },
): FoundationEntity => ({
  id: `f${idSeq++}`,
  guideBindings: bindings,
  params: {
    kind: 'strip',
    start: { x: start.x, y: start.y, z: 0 },
    end: { x: end.x, y: end.y, z: 0 },
    width: extra?.width ?? 500,
    topElevationMm: 0,
    thicknessMm: 500,
    ...(extra?.justification !== undefined ? { justification: extra.justification } : {}),
    ...(extra?.justificationManual !== undefined ? { justificationManual: extra.justificationManual } : {}),
  },
} as unknown as FoundationEntity);

const vbind = (xId: string, yA: string, yB: string): GuideBinding[] => [
  { guideId: xId, slot: 'start-x' },
  { guideId: xId, slot: 'end-x' },
  { guideId: yA, slot: 'start-y' },
  { guideId: yB, slot: 'end-y' },
];

const hbind = (yId: string, xA: string, xB: string): GuideBinding[] => [
  { guideId: yId, slot: 'start-y' },
  { guideId: yId, slot: 'end-y' },
  { guideId: xA, slot: 'start-x' },
  { guideId: xB, slot: 'end-x' },
];

/** Helper: ανάγνωση γραμμικών params του update. */
const lp = (e: FoundationEntity) => e.params as {
  start: { x: number; y: number };
  end: { x: number; y: number };
  width: number;
  justification?: StripJustification;
  justificationManual?: boolean;
};

describe('reconcileGridStrips', () => {
  it('αμετάβλητο (target ≡ existing) → no-op (0 create, 0 delete, 0 update)', () => {
    const a = strip(vbind('x0', 'y0', 'y1'), { x: 0, y: 0 }, { x: 0, y: 4000 });
    const r = reconcileGridStrips([a], [{ ...a }]);
    expect(r.toCreate).toHaveLength(0);
    expect(r.toDelete).toHaveLength(0);
    expect(r.toUpdate).toHaveLength(0);
    expect(r.unchanged).toBe(1);
  });

  it('κενή σκηνή → όλα create', () => {
    const a = strip(vbind('x0', 'y0', 'y1'), { x: 0, y: 0 }, { x: 0, y: 4000 });
    const r = reconcileGridStrips([a], []);
    expect(r.toCreate).toHaveLength(1);
    expect(r.toDelete).toHaveLength(0);
    expect(r.unchanged).toBe(0);
  });

  it('split (ενδιάμεσος οδηγός): delete whole + create 2 halves (διαφορετικά segmentKeys)', () => {
    const whole = strip(vbind('x0', 'y0', 'y2'), { x: 0, y: 0 }, { x: 0, y: 8000 });
    const half1 = strip(vbind('x0', 'y0', 'y1'), { x: 0, y: 0 }, { x: 0, y: 4000 });
    const half2 = strip(vbind('x0', 'y1', 'y2'), { x: 0, y: 4000 }, { x: 0, y: 8000 });
    const r = reconcileGridStrips([half1, half2], [whole]);
    expect(r.toCreate.map((s) => s.id).sort()).toEqual([half1.id, half2.id].sort());
    expect(r.toDelete.map((s) => s.id)).toEqual([whole.id]);
  });

  it('Slice 9 coordinate-follow: ίδιο segmentKey + διαφορετική γεωμετρία → managed update (κρατά id)', () => {
    // Πρώην raw-extend περιμετρική → εσωτερική· ίδιο φάτνωμα V|x0|y0|y1 → in-place update.
    const oldGeom = strip(vbind('x0', 'y0', 'y1'), { x: 0, y: -300 }, { x: 0, y: 4000 });
    const newGeom = strip(vbind('x0', 'y0', 'y1'), { x: 0, y: 0 }, { x: 0, y: 4000 });
    const r = reconcileGridStrips([newGeom], [oldGeom]);
    expect(r.toDelete).toHaveLength(0);
    expect(r.toCreate).toHaveLength(0);
    expect(r.toUpdate).toHaveLength(1);
    expect(r.toUpdate[0].rehosted.id).toBe(oldGeom.id); // κρατά id
    expect(lp(r.toUpdate[0].rehosted).start.y).toBe(0); // coords ← target
    expect(r.unchanged).toBe(0);
  });

  it('Slice 9 simple-move ΧΕΙΡΟΚΙΝΗΤΗ: άξονας κουνήθηκε → coords ακολουθούν, manual+width preserved', () => {
    // Ο μηχανικός όρισε justification 'right' + width 800· ο άξονας x0 μετακινήθηκε 0→500.
    const manual = strip(vbind('x0', 'y0', 'y1'), { x: 0, y: 0 }, { x: 0, y: 4000 },
      { justification: 'right', justificationManual: true, width: 800 });
    const target = strip(vbind('x0', 'y0', 'y1'), { x: 500, y: 0 }, { x: 500, y: 4000 },
      { justification: 'left' }); // ο κανόνας λέει left — ΑΓΝΟΕΙΤΑΙ (manual υπερισχύει)
    const r = reconcileGridStrips([target], [manual]);
    expect(r.toCreate).toHaveLength(0);
    expect(r.toDelete).toHaveLength(0);
    expect(r.toUpdate).toHaveLength(1);
    const next = lp(r.toUpdate[0].rehosted);
    expect(r.toUpdate[0].rehosted.id).toBe(manual.id); // ίδιο id
    expect(next.justification).toBe('right'); // χειροκίνητη διατηρείται
    expect(next.justificationManual).toBe(true);
    expect(next.width).toBe(800); // width override διατηρείται
    expect(next.start.x).toBe(500); // coords ακολουθούν τον άξονα
    expect(next.end.x).toBe(500);
  });

  it('Slice 9 simple-move AUTO: άξονας κουνήθηκε → coords ακολουθούν + re-justify στον κανόνα', () => {
    const auto = strip(vbind('x0', 'y0', 'y1'), { x: 0, y: 0 }, { x: 0, y: 4000 },
      { justification: 'right' }); // auto (χωρίς flag)
    const target = strip(vbind('x0', 'y0', 'y1'), { x: 500, y: 0 }, { x: 500, y: 4000 },
      { justification: 'left' });
    const r = reconcileGridStrips([target], [auto]);
    expect(r.toUpdate).toHaveLength(1);
    const next = lp(r.toUpdate[0].rehosted);
    expect(r.toUpdate[0].rehosted.id).toBe(auto.id);
    expect(next.justification).toBe('left'); // auto → ευθυγράμμιση στον κανόνα
    expect(next.start.x).toBe(500); // coords ακολουθούν
  });

  it('crossing carry-over: σταθερό ζεύγος αξόνων → update κρατά id+manual· ζεύγος που έπαψε → delete· νέο → create', () => {
    // Πριν: άξονες A=0,B=4000,C=8000 → οριζόντια στο y0 ανά γειτονικό ζεύγος (A-B),(B-C).
    // Μετά crossing (C πέρασε αριστερά του B): A=0,C=2000,B=4000 → ζεύγη (A-C),(C-B).
    const eAB = strip(hbind('y0', 'x0', 'x1'), { x: 0, y: 0 }, { x: 4000, y: 0 },
      { justification: 'right', justificationManual: true }); // manual στο φάτνωμα που ΘΑ πάψει
    const eBC = strip(hbind('y0', 'x1', 'x2'), { x: 4000, y: 0 }, { x: 8000, y: 0 },
      { justification: 'left', justificationManual: true }); // manual στο φάτνωμα που ΕΠΙΒΙΩΝΕΙ
    const tAC = strip(hbind('y0', 'x0', 'x2'), { x: 0, y: 0 }, { x: 2000, y: 0 }); // νέο ζεύγος
    const tCB = strip(hbind('y0', 'x1', 'x2'), { x: 2000, y: 0 }, { x: 4000, y: 0 }); // pair(x1,x2) — ίδιο segmentKey με eBC
    const r = reconcileGridStrips([tAC, tCB], [eAB, eBC]);
    expect(r.toDelete.map((s) => s.id)).toEqual([eAB.id]); // ζεύγος (x0,x1) έπαψε
    expect(r.toCreate.map((s) => s.id)).toEqual([tAC.id]); // ζεύγος (x0,x2) νέο
    expect(r.toUpdate).toHaveLength(1); // pair(x1,x2) επιβιώνει
    const next = lp(r.toUpdate[0].rehosted);
    expect(r.toUpdate[0].rehosted.id).toBe(eBC.id); // ίδιο id (carry-over)
    expect(next.justification).toBe('left'); // manual override μεταφέρθηκε
    expect(next.justificationManual).toBe(true);
    expect(next.start.x).toBe(2000); // coords ακολούθησαν το crossing
    expect(next.end.x).toBe(4000);
  });

  it('dedup: δύο existing ίδιο segmentKey (legacy διπλό) → ο πρώτος canonical, ο δεύτερος delete', () => {
    const target = strip(vbind('x0', 'y0', 'y1'), { x: 0, y: 0 }, { x: 0, y: 4000 });
    const first = strip(vbind('x0', 'y0', 'y1'), { x: 0, y: 0 }, { x: 0, y: 4000 });
    const dupe = strip(vbind('x0', 'y0', 'y1'), { x: 0, y: 0 }, { x: 0, y: 4000 });
    const r = reconcileGridStrips([target], [first, dupe]);
    expect(r.toDelete.map((s) => s.id)).toEqual([dupe.id]); // ο διπλός φεύγει
    expect(r.toCreate).toHaveLength(0);
    expect(r.toUpdate).toHaveLength(0); // first ≡ target → unchanged
    expect(r.unchanged).toBe(1);
  });

  it('μη grid-managed (χωρίς bindings) ΠΟΤΕ δεν διαγράφεται', () => {
    const manual = strip([], { x: 1000, y: 1000 }, { x: 5000, y: 1000 });
    const gridStrip = strip(vbind('x0', 'y0', 'y1'), { x: 0, y: 0 }, { x: 0, y: 4000 });
    const r = reconcileGridStrips([gridStrip], [manual]); // target δεν περιέχει το manual
    expect(r.toDelete).toHaveLength(0); // manual αγνοείται (null segmentKey)
    expect(r.toCreate.map((s) => s.id)).toEqual([gridStrip.id]);
  });

  it('χειροκίνητη υπεροχή (5a-grid): existing justificationManual ≠ target, ίδια coords → preserve (μηδέν update)', () => {
    const target = strip(vbind('x0', 'y0', 'y1'), { x: 0, y: 0 }, { x: 0, y: 4000 });
    const manual = strip(vbind('x0', 'y0', 'y1'), { x: 0, y: 0 }, { x: 0, y: 4000 },
      { justification: 'left', justificationManual: true });
    const r = reconcileGridStrips([target], [manual]);
    expect(r.toDelete).toHaveLength(0);
    expect(r.toCreate).toHaveLength(0);
    expect(r.toUpdate).toHaveLength(0); // χειροκίνητη + ίδια coords → δεν αγγίζεται
    expect(r.unchanged).toBe(1);
  });

  it('auto reflow (5a-grid): existing auto stale justification, ίδιες coords → re-justify στον κανόνα (κρατά id)', () => {
    const target = strip(vbind('x0', 'y0', 'y1'), { x: 0, y: 0 }, { x: 0, y: 4000 }); // center
    const stale = strip(vbind('x0', 'y0', 'y1'), { x: 0, y: 0 }, { x: 0, y: 4000 },
      { justification: 'right' }); // auto, no flag
    const r = reconcileGridStrips([target], [stale]);
    expect(r.toCreate).toHaveLength(0);
    expect(r.toDelete).toHaveLength(0);
    expect(r.toUpdate).toHaveLength(1);
    expect(r.toUpdate[0].rehosted.id).toBe(stale.id); // ίδιο id (in-place)
    expect(lp(r.toUpdate[0].rehosted).justification).toBeUndefined(); // center → πεδίο αφαιρείται
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
