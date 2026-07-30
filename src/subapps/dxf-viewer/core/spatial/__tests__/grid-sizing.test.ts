/**
 * ADR-735 — ο SSoT της πλευράς κελιού.
 *
 * Το ερώτημα που φυλάει αυτό το αρχείο: **η πλευρά κελιού ακολουθεί τις μονάδες του σχεδίου;**
 * Ένα πάγιο `gridSize` (το προ-ADR-735 `50`) απαντά «όχι» — και τότε το ίδιο σχέδιο σε μέτρα
 * εκφυλίζεται σε γραμμική σάρωση ενώ σε χιλιοστά σαρώνει δεκάδες χιλιάδες άδεια κελιά.
 */

import { resolveGridSize, MIN_GRID_SIDE, MAX_GRID_SIDE } from '../grid-sizing';

const square = (extent: number) => ({ minX: 0, minY: 0, maxX: extent, maxY: extent });

describe('resolveGridSize — κλιμακωτή ανεξαρτησία από τις μονάδες', () => {
  it('το ΙΔΙΟ σχέδιο σε m και σε mm δίνει το ΙΔΙΟ πλήθος κελιών ανά πλευρά', () => {
    const n = 2909;
    const cellsInMetres = 30 / resolveGridSize(square(30), n);
    const cellsInMillimetres = 30_000 / resolveGridSize(square(30_000), n);

    expect(cellsInMetres).toBeCloseTo(cellsInMillimetres, 6);
  });

  it('στοχεύει ~1 στοιχείο/κελί: πλευρά = ⌈√N⌉', () => {
    // N = 2.909 ⇒ ⌈√N⌉ = 54 (το παράδειγμα του ADR-728 §Φ2).
    expect(200_000 / resolveGridSize(square(200_000), 2909)).toBeCloseTo(54, 6);
  });

  it('φράσσεται και στα δύο άκρα', () => {
    // Σκηνή 10 στοιχείων δεν χτίζει 4.096 κελιά…
    expect(1000 / resolveGridSize(square(1000), 10)).toBeCloseTo(MIN_GRID_SIDE, 6);
    // …ούτε σκηνή 100.000 χτίζει 316 στήλες.
    expect(1000 / resolveGridSize(square(1000), 100_000)).toBeCloseTo(MAX_GRID_SIDE, 6);
  });
});

describe('resolveGridSize — εκφυλισμένες εισόδους δεν δηλητηριάζουν το πλέγμα', () => {
  // Ένα μη πεπερασμένο ή μηδενικό cell size κάνει κάθε συντεταγμένη να χασάρει σε ±Infinity
  // και το ευρετήριο να απαντά σιωπηλά «τίποτα» — χειρότερο από αργό: ΛΑΘΟΣ.
  it.each([
    ['όλα τα στοιχεία σε ΕΝΑ σημείο (μηδενική έκταση)', square(0), 100],
    ['μη πεπερασμένα bounds', { minX: -Infinity, minY: 0, maxX: Infinity, maxY: 1 }, 100],
    ['NaN bounds', { minX: NaN, minY: NaN, maxX: NaN, maxY: NaN }, 100],
    ['μηδέν στοιχεία', square(1000), 0],
  ])('%s ⇒ θετικό πεπερασμένο μέγεθος', (_label, bounds, count) => {
    const size = resolveGridSize(bounds, count);
    expect(Number.isFinite(size)).toBe(true);
    expect(size).toBeGreaterThan(0);
  });
});
