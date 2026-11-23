/**
 * ADR-920 §14.11 Ζ4 «επιλογή πάνω στο σχέδιο» — ο ΕΝΑΣ κριτής του κλικ: ακμή → εσωτερικό → κύκλος.
 *
 * Άγκυρες: Α = η ακμή πιάνεται και ΜΕΣΑ στο επιλεγμένο (το ζωντανό εύρημα) · Ε = εσωτερικό ⇒ το πιο μέσα σχήμα ·
 * Τ = ταυτόσημοι δακτύλιοι: κανείς απρόσιτος · Κ = κύκλος μόνο μέσα στη βαθμίδα · Μ = μέγεθος ΕΓΣΑ, ανοχή σε mm ·
 * Π = `planWorldPoint` αντίστροφο του `planSvgPoint`.
 */

import type { PlanarPoint } from '@/lib/geometry/planar-polygon';

import { pickPlotCandidate, plotCandidatesAt } from '../plot-candidate-pick';
import { planSvgPoint, planViewBoxOf, planWorldPoint } from '../plot-drawing-view';
import type { PlotOutlineCandidate } from '../plot-outline-types';

/** Αρχή μεγέθους ΕΓΣΑ'87 (WORLD mm): E 410000 / N 4498000. */
const E0 = 410000000;
const N0 = 4498000000;

/** Ορθογώνιο υποψήφιο σε WORLD mm, από τοπικά μέτρα. */
function rect(id: string, x0: number, y0: number, x1: number, y1: number): PlotOutlineCandidate {
  const ring: PlanarPoint[] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => ({ x: E0 + x * 1000, y: N0 + y * 1000 }));
  return {
    id, origin: { source: 'dxf', handle: id, layer: 'L', closure: 'flag' }, ringWorldMm: ring,
    corners: ring.map((at) => ({ at, label: null })), areaM2: (x1 - x0) * (y1 - y0),
  };
}

const at = (xM: number, yM: number): PlanarPoint => ({ x: E0 + xM * 1000, y: N0 + yM * 1000 });
const ids = (point: PlanarPoint, candidates: readonly PlotOutlineCandidate[], tolMm = 500) =>
  plotCandidatesAt(point, candidates, tolMm).map((hit) => `${hit.candidate.id}:${hit.tier}`);

const plot = rect('plot', 0, 0, 40, 30);
const building = rect('building', 10, 10, 22, 20);
const all = [plot, building];

describe('Α — η ακμή πιάνεται και μέσα στο επιλεγμένο', () => {
  it('ακμή του εσωτερικού ⇒ πρώτο το εσωτερικό, ΑΚΟΜΗ ΚΙ ΑΝ το εξωτερικό είναι το επιλεγμένο', () => {
    const hits = plotCandidatesAt(at(16, 10.2), all, 500);
    expect(hits.map((hit) => `${hit.candidate.id}:${hit.tier}`)).toEqual(['building:edge', 'plot:inside']);
    expect(pickPlotCandidate(hits, 'plot')).toBe('building');
  });
  it('ακμή του εξωτερικού ⇒ το εξωτερικό', () => {
    expect(ids(at(20, 0.1), all)).toEqual(['plot:edge']);
    expect(pickPlotCandidate(plotCandidatesAt(at(20, 0.1), all, 500), 'building')).toBe('plot');
  });
  it('έξω από όλα ⇒ τίποτα, και το κλικ δεν διαλέγει', () => {
    expect(ids(at(60, 60), all)).toEqual([]);
    expect(pickPlotCandidate([], 'plot')).toBeNull();
  });
});

describe('Ε — εσωτερικό: το πιο μέσα σχήμα πρώτο', () => {
  it('μέσα και στα δύο ⇒ πρώτο το ΜΙΚΡΟΤΕΡΟ', () => {
    expect(ids(at(16, 15), all)).toEqual(['building:inside', 'plot:inside']);
    expect(pickPlotCandidate(plotCandidatesAt(at(16, 15), all, 500), null)).toBe('building');
  });
  it('μέσα μόνο στο εξωτερικό ⇒ το εξωτερικό', () => {
    expect(ids(at(3, 3), all)).toEqual(['plot:inside']);
  });
  it('ξανά κλικ στο ίδιο εσωτερικό σημείο ⇒ προχωρά προς τα έξω, και γυρίζει', () => {
    const hits = plotCandidatesAt(at(16, 15), all, 500);
    expect(pickPlotCandidate(hits, 'building')).toBe('plot');
    expect(pickPlotCandidate(hits, 'plot')).toBe('building');
  });
});

describe('Τ — ταυτόσημοι δακτύλιοι σε δύο στρώσεις: κανείς απρόσιτος', () => {
  const orio = rect('orio', 0, 0, 40, 30);
  const ktima = rect('ktima', 0, 0, 40, 30);
  it('ισοπαλία απόστασης και εμβαδού ⇒ σταθερή σειρά κατά ταυτότητα, ανεξάρτητα από τη σειρά εισόδου', () => {
    expect(ids(at(20, 0), [orio, ktima])).toEqual(['ktima:edge', 'orio:edge']);
    expect(ids(at(20, 0), [ktima, orio])).toEqual(['ktima:edge', 'orio:edge']);
  });
  it('το κλικ εναλλάσσει ανάμεσά τους', () => {
    const hits = plotCandidatesAt(at(20, 0), [orio, ktima], 500);
    expect(pickPlotCandidate(hits, null)).toBe('ktima');
    expect(pickPlotCandidate(hits, 'ktima')).toBe('orio');
    expect(pickPlotCandidate(hits, 'orio')).toBe('ktima');
  });
});

describe('Κ — ο κύκλος μένει μέσα στη βαθμίδα', () => {
  it('μία μόνο ακμή κάτω από τον δείκτη ⇒ ξανά κλικ ΔΕΝ πηδά στο σχήμα που απλώς την περιέχει', () => {
    const hits = plotCandidatesAt(at(16, 10.2), all, 500);
    expect(pickPlotCandidate(hits, 'building')).toBe('building');
  });
  it('δύο ακμές μέσα στην ανοχή ⇒ πρώτη η πλησιέστερη, και ο κύκλος πιάνει και τις δύο', () => {
    const near = rect('near', 0, 0.3, 40, 30);
    const hits = plotCandidatesAt(at(20, 0.25), [plot, near], 500);
    expect(hits.map((hit) => hit.candidate.id)).toEqual(['near', 'plot']);
    expect(pickPlotCandidate(hits, 'near')).toBe('plot');
  });
});

describe('Μ — μέγεθος ΕΓΣΑ: η ανοχή μετρά σε mm, χωρίς απώλεια ακρίβειας', () => {
  it('499 mm από την ακμή ⇒ ακμή · 501 mm ⇒ όχι ακμή', () => {
    expect(ids({ x: E0 + 20000, y: N0 - 499 }, [plot])).toEqual(['plot:edge']);
    expect(ids({ x: E0 + 20000, y: N0 - 501 }, [plot])).toEqual([]);
    expect(ids({ x: E0 + 20000, y: N0 + 501 }, [plot])).toEqual(['plot:inside']);
  });
});

describe('Π — οθόνη ⇄ σχέδιο', () => {
  it('το `planWorldPoint` είναι το αντίστροφο του `planSvgPoint`, στο χιλιοστό', () => {
    const box = planViewBoxOf([plot.ringWorldMm])!;
    for (const point of [...plot.ringWorldMm, at(16.123, 10.456)]) {
      const back = planWorldPoint(planSvgPoint(point, box), box);
      expect(back.x).toBeCloseTo(point.x, 3);
      expect(back.y).toBeCloseTo(point.y, 3);
    }
  });
});
