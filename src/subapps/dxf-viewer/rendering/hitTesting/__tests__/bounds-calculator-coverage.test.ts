/**
 * BoundsCalculator capability coverage (ADR-587 Φ10 — seam A).
 *
 * Ο `BoundsCalculator` απαντά σε ΕΝΑ ερώτημα: «πού βρίσκεται αυτή η οντότητα;». Χωρίς
 * απάντηση (`null`) το entity **δεν μπαίνει στο spatial index** — άρα δεν φωτίζεται στο
 * hover και δεν επιλέγεται με κλικ. Πριν τη Φ10 το `default` του switch γύριζε `null`
 * σιωπηλά, οπότε ένας ξεχασμένος τύπος εξαφανιζόταν χωρίς να σπάσει τίποτα (ADR-654: η
 * εικόνα· και πριν: scale-bar, opening-info-tag, thermal-space, wall-covering…).
 *
 * Το test δένει το ζωντανό registry (`HIT_TEST_BOUNDS_SUPPORTED_TYPES`, `Object.keys` του
 * μητρώου — ποτέ stale) με το descriptor domain (`RENDERABLE_ENTITY_TYPES`):
 *  1. **Completeness** — κάθε renderable τύπος ΕΧΕΙ handler (νέος τύπος → κόκκινο test).
 *  2. **Behavioral pin** — κάθε renderable τύπος παράγει ΠΕΠΕΡΑΣΜΕΝΑ, non-null bounds.
 *     Δεν αρκεί να υπάρχει το κλειδί: ο handler πρέπει να διαβάζει πεδία που όντως υπάρχουν.
 *  3. **Asymmetry pin** — άγνωστος τύπος → `null` (το ρητό συμβόλαιο του resolver).
 */

// Firebase auth mock — τα type barrels (text-box / BIM projections) αγγίζουν auth στο import path.
jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => {
    cb(null);
    return () => {};
  },
  signInAnonymously: jest.fn(),
}));

import { BoundsCalculator, HIT_TEST_BOUNDS_SUPPORTED_TYPES } from '../Bounds';
import { RENDERABLE_ENTITY_TYPES } from '../../contract/renderable-entity-type';
import { makeEntityModel } from './renderable-entity-fixtures';
import type { EntityModel } from '../../types/Types';

const asSorted = (xs: readonly string[]): string[] => [...xs].sort();

describe('BoundsCalculator coverage — ζωντανό registry ↔ descriptor domain (ADR-587 Φ10)', () => {
  it('completeness: κάθε RENDERABLE_ENTITY_TYPE έχει bounds handler', () => {
    // Χωρίς handler → null → εκτός spatial index → ΜΗΔΕΝ hover, ΜΗΔΕΝ κλικ, σιωπηλά.
    const supported = new Set<string>(HIT_TEST_BOUNDS_SUPPORTED_TYPES);
    const missing = RENDERABLE_ENTITY_TYPES.filter((t) => !supported.has(t));
    expect(missing).toEqual([]);
  });

  it('no strays: κάθε handler του registry αντιστοιχεί σε renderable τύπο', () => {
    // Handler για μη-renderable τύπο = νεκρός κώδικας ή ένδειξη ότι το domain ξέφυγε.
    const renderable = new Set<string>(RENDERABLE_ENTITY_TYPES);
    const strays = HIT_TEST_BOUNDS_SUPPORTED_TYPES.filter((t) => !renderable.has(t));
    expect(strays).toEqual([]);
  });

  it('το registry είναι ΑΚΡΙΒΩΣ το descriptor domain (καμία απόκλιση προς καμία κατεύθυνση)', () => {
    expect(asSorted(HIT_TEST_BOUNDS_SUPPORTED_TYPES)).toEqual(asSorted([...RENDERABLE_ENTITY_TYPES]));
  });

  it.each(RENDERABLE_ENTITY_TYPES)(
    'behavioral pin: "%s" → non-null, πεπερασμένα bounds (δεν αρκεί το κλειδί — ο handler πρέπει να διαβάζει υπαρκτά πεδία)',
    (type) => {
      const bounds = BoundsCalculator.calculateEntityBounds(makeEntityModel(type), 0);
      expect(bounds).not.toBeNull();
      expect(Number.isFinite(bounds!.minX)).toBe(true);
      expect(Number.isFinite(bounds!.minY)).toBe(true);
      expect(Number.isFinite(bounds!.maxX)).toBe(true);
      expect(Number.isFinite(bounds!.maxY)).toBe(true);
      expect(bounds!.maxX).toBeGreaterThanOrEqual(bounds!.minX);
      expect(bounds!.maxY).toBeGreaterThanOrEqual(bounds!.minY);
    },
  );

  it('Φ10 gap fix: το "wall-covering" δίνει bounds (ΕΛΕΙΠΕ από το switch → ήταν άκλικο)', () => {
    // ADR-511 — η επένδυση τοίχου ζωγραφιζόταν αλλά ΔΕΝ επιλεγόταν: δεν είχε case εδώ, οπότε
    // έπεφτε στο `default` → null → εκτός spatial index. Ίδια ρίζα με το ADR-654 bug.
    expect(BoundsCalculator.calculateEntityBounds(makeEntityModel('wall-covering'), 0)).not.toBeNull();
  });

  it('asymmetry pin: άγνωστος τύπος → null (ρητό συμβόλαιο — ο caller τον αφήνει εκτός index)', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const unknown = { id: 'x', type: 'totally-unknown', layerId: 'L' } as unknown as EntityModel;
    expect(BoundsCalculator.calculateEntityBounds(unknown, 0)).toBeNull();
    expect(warn).toHaveBeenCalled(); // σιωπηλό ΠΟΤΕ — τουλάχιστον φωνάζει
    warn.mockRestore();
  });
});
