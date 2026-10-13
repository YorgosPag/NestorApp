/**
 * ADR-909 Γ2.9 — «φτάνει κάθε τύπος στην εικόνα;» — το **Κ0** της πύλης pixels, κριμένο στο jest.
 *
 * Το Κ0 δεν χρειάζεται browser: το βγάζει το `reachOf` του σχεδίου-δείγματος, που ρωτά τον **πραγματικό**
 * μετατροπέα σκηνής (`convertSceneToDxf`). Η πύλη pixels το κρίνει μόνο στο CI, μετά το push· αυτή η σουίτα
 * το κρίνει πριν από το commit, με τον ίδιο κώδικα.
 *
 * 🔶 Δεν αντικαθιστά την πύλη: εδώ δεν ζωγραφίζεται τίποτα. «Έφτασε στον ζωγράφο» ≠ «έβαλε μελάνι»· το δεύτερο
 * (Κ4 `no-ink`) και το χρώμα / πάχος (Κ1–Κ3) τα βλέπει μόνο το Chromium.
 */

jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => {
    cb(null);
    return () => {};
  },
  signInAnonymously: jest.fn(),
}));

import { buildPixelGateSampleScene } from '../pixel-gate-samples';

describe('ADR-909 Γ2.9 — Κ0: κανένας τύπος δεν χάνεται στη μετατροπή της σκηνής', () => {
  const { cells } = buildPixelGateSampleScene();
  const cellOf = (type: string) => cells.find((cell) => cell.sample === type);

  it('🔴 κανένα δείγμα δεν βγαίνει «unconvertible» — η baseline του Κ0 είναι ΚΕΝΗ', () => {
    expect(cells.filter((cell) => cell.unconvertible).map((cell) => cell.sample)).toEqual([]);
  });

  it.each(['ellipse', 'spline', 'rect'])('"%s" — φτάνει ΚΑΙ το δείχνει το προφίλ', (type) => {
    expect(cellOf(type)).toMatchObject({ unconvertible: false, shown: true });
  });

  it('"point" — φτάνει, αλλά το προφίλ το ΚΡΥΒΕΙ (κατασκευαστικό σημείο, όχι περιεχόμενο κάτοψης)', () => {
    expect(cellOf('point')).toMatchObject({ unconvertible: false, shown: false });
  });
});
