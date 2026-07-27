/**
 * ADR-650 M8β/Γ — πού «προσγειώνεται» η κάμερα όταν πατήσεις μια υποψήφια ασυνέχεια.
 *
 * Ο κανόνας αγκύρωσης είναι απόφαση, όχι λεπτομέρεια: **μέσο υψόμετρο της αλυσίδας**, όχι της
 * πρώτης κορυφής. Μια άκρη δρόμου που κατεβαίνει 4 μ στο μήκος της θα τραβούσε την κάμερα στη μία
 * της άκρη — τη στιγμή που ο μηχανικός ζήτησε να δει ΟΛΟΚΛΗΡΗ τη γραμμή. Το test το καρφώνει
 * επειδή είναι ακριβώς το είδος «απλοποίησης» που μοιάζει ισοδύναμη σε review.
 *
 * `null` όταν καμία κορυφή δεν έχει χρησιμοποιήσιμο Z: ο caller τότε ΔΕΝ κουνάει την κάμερα —
 * «δεν ξέρω πού είναι κατακόρυφα» δεν επιτρέπεται να γίνει «είναι στο μηδέν».
 */

import { meanCandidateElevationMm } from '../auto-breakline-world';
import type { AutoBreaklineCandidate } from '../../../systems/topography/auto-breaklines/auto-breakline-types';

function withElevations(...zs: number[]): AutoBreaklineCandidate {
  return {
    id: 'c',
    vertices: zs.map((z, i) => ({ x: i * 1_000, y: 0, z })),
    closed: false,
    lengthMm: zs.length * 1_000,
    avgFoldDeg: 40,
    edgeCount: zs.length - 1,
  };
}

describe('meanCandidateElevationMm', () => {
  it('averages the whole chain — not the first vertex', () => {
    // Άκρη δρόμου που κατεβαίνει 4 μ: η αγκύρωση είναι στη ΜΕΣΗ, όχι στο ψηλό άκρο.
    expect(meanCandidateElevationMm(withElevations(10_000, 8_000, 6_000))).toBe(8_000);
  });

  it('ignores non-finite vertices instead of returning NaN', () => {
    expect(meanCandidateElevationMm(withElevations(4_000, Number.NaN, 6_000))).toBe(5_000);
  });

  it('returns null when nothing can answer for the elevation', () => {
    expect(meanCandidateElevationMm(withElevations(Number.NaN, Number.POSITIVE_INFINITY))).toBeNull();
  });
});
