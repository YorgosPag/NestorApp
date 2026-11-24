/**
 * ADR-920 §14.11 «Ζ4 — αμφίδρομη επισήμανση» Π4 — ποια υποψήφια είναι η ΙΔΙΑ γραμμή στο σχέδιο.
 *
 * Άγκυρες: Τ = ταυτόσημοι δακτύλιοι σε δύο στρώσεις (το «Orio» + «ktimatologio» του πραγματικού DXF) · Α = άλλη αρχική
 * κορυφή · Φ = αντίστροφη φορά · Χ = ακέραιο χιλιοστό (υπο-χιλιοστό = ίδιο, 1 mm = άλλο) · Μ = μοναδικό σχήμα δεν αναφέρεται ·
 * Ο = ομάδα τριών: ο καθένας βλέπει τους ΑΛΛΟΥΣ δύο.
 */

import type { PlanarPoint } from '@/lib/geometry/planar-polygon';

import { coincidentPlotCandidates } from '../plot-candidate-coincidence';
import type { PlotOutlineCandidate } from '../plot-outline-types';

/** Αρχή μεγέθους ΕΓΣΑ'87 (WORLD mm). */
const E0 = 410000000;
const N0 = 4498000000;

const square: PlanarPoint[] = [[0, 0], [30, 0], [30, 40], [0, 40]].map(([x, y]) => ({ x: E0 + x * 1000, y: N0 + y * 1000 }));

function candidate(id: string, ring: readonly PlanarPoint[]): PlotOutlineCandidate {
  return {
    id, origin: { source: 'dxf', handle: id, layer: id, closure: 'flag' }, ringWorldMm: ring,
    corners: ring.map((at) => ({ at, label: null })), areaM2: 1200,
  };
}

const othersOf = (map: ReadonlyMap<string, readonly PlotOutlineCandidate[]>, id: string) => map.get(id)?.map((c) => c.id);

describe('Τ — ίδιος δακτύλιος σε δύο στρώσεις', () => {
  it('ο καθένας δείχνει τον άλλον', () => {
    const map = coincidentPlotCandidates([candidate('orio', square), candidate('ktimatologio', square)]);
    expect(othersOf(map, 'orio')).toEqual(['ktimatologio']);
    expect(othersOf(map, 'ktimatologio')).toEqual(['orio']);
  });
});

describe('Α · Φ — ανεξάρτητα από αρχική κορυφή και φορά', () => {
  it('άλλη αρχική κορυφή ⇒ ίδιο σχήμα', () => {
    const rotated = [...square.slice(2), ...square.slice(0, 2)];
    expect(othersOf(coincidentPlotCandidates([candidate('a', square), candidate('b', rotated)]), 'a')).toEqual(['b']);
  });

  it('αντίστροφη φορά ⇒ ίδιο σχήμα', () => {
    const reversed = [...square].reverse();
    expect(othersOf(coincidentPlotCandidates([candidate('a', square), candidate('b', reversed)]), 'a')).toEqual(['b']);
  });
});

describe('Χ — στο ακέραιο χιλιοστό', () => {
  it('διαφορά κάτω από μισό χιλιοστό ⇒ ίδιο', () => {
    const jitter = square.map(({ x, y }) => ({ x: x + 0.2, y: y - 0.3 }));
    expect(othersOf(coincidentPlotCandidates([candidate('a', square), candidate('b', jitter)]), 'a')).toEqual(['b']);
  });

  it('μία κορυφή 1 mm αλλού ⇒ άλλο σχήμα', () => {
    const moved = [{ x: square[0].x + 1, y: square[0].y }, ...square.slice(1)];
    expect(coincidentPlotCandidates([candidate('a', square), candidate('b', moved)]).size).toBe(0);
  });
});

describe('Μ · Ο — ποιοι αναφέρονται', () => {
  it('μοναδικό σχήμα ⇒ καμία εγγραφή', () => {
    const other = square.map(({ x, y }) => ({ x: x + 5000, y }));
    const map = coincidentPlotCandidates([candidate('a', square), candidate('b', other)]);
    expect(map.has('a')).toBe(false);
    expect(map.has('b')).toBe(false);
  });

  it('ομάδα τριών ⇒ ο καθένας βλέπει τους ΑΛΛΟΥΣ δύο, με τη σειρά εισόδου', () => {
    const map = coincidentPlotCandidates([candidate('a', square), candidate('b', square), candidate('c', square)]);
    expect(othersOf(map, 'b')).toEqual(['a', 'c']);
  });
});
