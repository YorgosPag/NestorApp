/**
 * N.18 / ADR-584 — `calculateFitToViewTransform` ≡ `calculateFitToViewFromBounds`.
 *
 * Τα δύο fit-to-view paths ήταν **αντιγραμμένα** (~60 γρ. ταυτόσημα: padding,
 * degenerate axis, scale clamp, offset). Το κόστος δεν ήταν θεωρητικό — το ADR-394
 * degenerate-line fix μπήκε αρχικά **μόνο στο ένα**, οπότε το «Z σε μονή γραμμή»
 * δούλευε από το ένα μονοπάτι και απορριπτόταν από το άλλο. Το scene-based δίδυμο
 * ήταν **ατέστωτο** — γι' αυτό πέρασε απαρατήρητο.
 *
 * Το scene-based κατέχει πλέον ΜΟΝΟ το bounds resolution και delegate-άρει. Αυτά τα
 * tests κλειδώνουν ακριβώς αυτό: για τα ΙΔΙΑ bounds, τα δύο μονοπάτια συμφωνούν —
 * ώστε καμία μελλοντική διόρθωση να μην μπορεί ξανά να μπει μόνο στο μισό.
 */

import { FitToViewService } from '../FitToViewService';
import { createCombinedBounds } from '../../utils/bounds-utils';

jest.mock('../../utils/bounds-utils', () => ({
  createCombinedBounds: jest.fn(),
}));

const mockCreateCombinedBounds = createCombinedBounds as jest.MockedFunction<
  typeof createCombinedBounds
>;

const viewport = { width: 1000, height: 800 };
/** Ο resolver είναι mock-αρισμένος → το scene δεν διαβάζεται ποτέ, μόνο προωθείται. */
const scene = null;

/** Τα bounds που πρέπει να συμπεριφέρονται ΤΑΥΤΟΣΗΜΑ από τα δύο μονοπάτια. */
const CASES: ReadonlyArray<{ name: string; bounds: { min: { x: number; y: number }; max: { x: number; y: number } } }> = [
  { name: 'κανονικό 2D box', bounds: { min: { x: 0, y: 0 }, max: { x: 400, y: 300 } } },
  { name: 'box εκτός αρχής (arbitrary origin)', bounds: { min: { x: 1000, y: 500 }, max: { x: 1400, y: 800 } } },
  { name: 'οριζόντια γραμμή (height=0) — ADR-394', bounds: { min: { x: 0, y: 50 }, max: { x: 200, y: 50 } } },
  { name: 'κατακόρυφη γραμμή (width=0) — ADR-394', bounds: { min: { x: 100, y: 0 }, max: { x: 100, y: 200 } } },
  { name: 'αρνητικές συντεταγμένες', bounds: { min: { x: -300, y: -200 }, max: { x: -100, y: -50 } } },
  { name: 'true point — απορρίπτεται και από τα δύο', bounds: { min: { x: 10, y: 10 }, max: { x: 10, y: 10 } } },
];

describe('N.18 — τα δύο fit-to-view δίδυμα συμφωνούν', () => {
  beforeEach(() => {
    mockCreateCombinedBounds.mockReset();
  });

  describe.each(CASES)('$name', ({ bounds }) => {
    it('ίδιο transform + success από τα δύο μονοπάτια', () => {
      mockCreateCombinedBounds.mockReturnValue(bounds);

      const viaScene = FitToViewService.calculateFitToViewTransform(scene, [], viewport);
      const viaBounds = FitToViewService.calculateFitToViewFromBounds(bounds, viewport);

      expect(viaScene.success).toBe(viaBounds.success);
      expect(viaScene.transform).toEqual(viaBounds.transform);
      expect(viaScene.reason).toBe(viaBounds.reason);
    });

    it('συμφωνούν και με alignToOrigin + μη-προεπιλεγμένο padding', () => {
      mockCreateCombinedBounds.mockReturnValue(bounds);
      const options = { alignToOrigin: true, padding: 0.25 };

      const viaScene = FitToViewService.calculateFitToViewTransform(scene, [], viewport, options);
      const viaBounds = FitToViewService.calculateFitToViewFromBounds(bounds, viewport, options);

      expect(viaScene.transform).toEqual(viaBounds.transform);
    });
  });

  it('τα options περνούν ΑΝΕΠΑΦΑ στο SSoT (το clamp δεν παρακάμπτεται)', () => {
    // maxScale κόβει: ένα μικρό box σε μεγάλο viewport θα ήθελε scale >> 2.
    mockCreateCombinedBounds.mockReturnValue({ min: { x: 0, y: 0 }, max: { x: 10, y: 10 } });
    const res = FitToViewService.calculateFitToViewTransform(scene, [], viewport, { maxScale: 2 });
    expect(res.success).toBe(true);
    expect(res.transform!.scale).toBe(2);
  });

  it('χωρίς bounds → αποτυγχάνει ΠΡΙΝ φτάσει στο SSoT (δικό του συμβόλαιο)', () => {
    mockCreateCombinedBounds.mockReturnValue(null);
    const res = FitToViewService.calculateFitToViewTransform(scene, [], viewport);
    expect(res.success).toBe(false);
    expect(res.transform).toBeNull();
    expect(res.reason).toBe('No bounds available from scene or layers');
  });

  it('άκυρο viewport απορρίπτεται από το SSoT, όχι από τον καλούντα', () => {
    mockCreateCombinedBounds.mockReturnValue({ min: { x: 0, y: 0 }, max: { x: 100, y: 100 } });
    const res = FitToViewService.calculateFitToViewTransform(scene, [], { width: 0, height: 800 });
    expect(res.success).toBe(false);
    expect(res.reason).toBe('Invalid viewport dimensions');
  });

  it('επιστρέφει τα resolved bounds — ο καλών τα διαβάζει (π.χ. capture-2d)', () => {
    const bounds = { min: { x: 5, y: 5 }, max: { x: 205, y: 155 } };
    mockCreateCombinedBounds.mockReturnValue(bounds);
    const res = FitToViewService.calculateFitToViewTransform(scene, [], viewport);
    expect(res.bounds).toEqual(bounds);
  });
});
