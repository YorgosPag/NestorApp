/**
 * ADR-650 M5α.2 / M8β/Γ — review-focus: ό,τι κάνει ένα κλικ σε γραμμή αναφοράς.
 *
 * Δεν ελέγχουμε «τρέχει η αριθμητική» — ελέγχουμε τα δύο συμβόλαια που, αν σπάσουν, ο μηχανικός
 * το βλέπει ως «το panel χάλασε» και ΚΑΝΕΝΑΣ compiler δεν το πιάνει:
 *
 *   1. **Κάθε όψη παίρνει τη ΔΙΚΗ της εντολή.** Ένα κλικ σε κάτοψη δεν επιτρέπεται να στείλει
 *      αίτημα κάμερας, και ένα κλικ σε 3Δ δεν επιτρέπεται να μετακινήσει σιωπηλά τον 2Δ καμβά
 *      πίσω από την 3Δ όψη (ακριβώς αυτό έκανε το `focusCandidate` πριν το M8β/Γ).
 *   2. **Το ΠΡΩΤΟ άλμα πλαισιώνει, κάθε επόμενο διατηρεί την κλίμακα.** Το bug που ανέφερε ο
 *      Giorgio ήταν το αντίθετο: κάθε κλικ ξανά-έκανε fit και του πετούσε το ζουμ.
 *
 * Και ο κανόνας που κάνει τις δύο όψεις να μη μπορούν να διαφωνήσουν: το `halfExtentM` της 3Δ
 * ΠΑΡΑΓΕΤΑΙ από το ίδιο padded κουτί με το 2Δ fit — δεν είναι δεύτερη, χειροκίνητα συγχρονισμένη
 * σταθερά.
 */

import { focusReviewTarget, reviewFocusExtent } from '../review-focus';
import { subscribeViewFocus, type ViewFocusRequest } from '../view-focus-bus';
import { EventBus } from '../../events';
import { useViewMode3DStore } from '../../../bim-3d/stores/ViewMode3DStore';
import type { WorldTriple } from '../../../bim-3d/viewport/plan-to-world-math';

const WORLD: WorldTriple = { x: 1, y: 2, z: 3 };

function set2D(): void {
  useViewMode3DStore.setState({ mode: '2d' });
}
function set3D(): void {
  useViewMode3DStore.setState({ mode: '3d-raster' });
}

describe('reviewFocusExtent', () => {
  it('pads a single point into a square and derives the matching 3D half-extent', () => {
    const extent = reviewFocusExtent([{ x: 1000, y: 2000 }], 15_000)!;
    expect(extent.centre).toEqual({ x: 1000, y: 2000 });
    expect(extent.bounds).toEqual({ min: { x: -14_000, y: -13_000 }, max: { x: 16_000, y: 17_000 } });
    // 30 m box → 15 m half-extent: ΑΚΡΙΒΩΣ η σταθερά που κουβαλούσε χωριστά το QA panel.
    expect(extent.halfExtentM).toBeCloseTo(15, 9);
  });

  it('frames a whole chain, not an arbitrary window around its middle', () => {
    // 200 m άκρη δρόμου: το κουτί την περιέχει ΟΛΗ (+ περιθώριο), και το 3Δ half-extent το ακολουθεί.
    const extent = reviewFocusExtent(
      [{ x: 0, y: 0 }, { x: 100_000, y: 0 }, { x: 200_000, y: 4_000 }],
      5_000,
    )!;
    expect(extent.centre).toEqual({ x: 100_000, y: 2_000 });
    expect(extent.halfExtentM).toBeCloseTo(105, 9); // (200 m + 2×5 m) / 2
  });

  it('ignores non-finite vertices instead of poisoning the box', () => {
    const extent = reviewFocusExtent(
      [{ x: 0, y: 0 }, { x: Number.NaN, y: 5_000 }, { x: 10_000, y: 0 }],
      0,
    )!;
    expect(extent.bounds).toEqual({ min: { x: 0, y: 0 }, max: { x: 10_000, y: 0 } });
  });

  it('returns null when nothing finite is left to frame', () => {
    // Ένα μηδενικό κουτί θα ΕΜΟΙΑΖΕ να δουλεύει και θα πετούσε τον μηχανικό κάπου αυθαίρετα.
    expect(reviewFocusExtent([], 1_000)).toBeNull();
    expect(reviewFocusExtent([{ x: Number.NaN, y: Number.NaN }], 1_000)).toBeNull();
  });
});

describe('focusReviewTarget — routing', () => {
  const extent = reviewFocusExtent([{ x: 0, y: 0 }], 10_000)!;
  let events: Array<{ name: string; payload: unknown }>;
  let focusRequests: ViewFocusRequest[];
  let unsubscribes: Array<() => void>;

  beforeEach(() => {
    events = [];
    focusRequests = [];
    unsubscribes = [
      EventBus.on('canvas-center-on-point', (p) => events.push({ name: 'center', payload: p })),
      EventBus.on('canvas-fit-to-view-selected', (p) => events.push({ name: 'fit', payload: p })),
      subscribeViewFocus((r) => focusRequests.push(r)),
    ];
    set2D();
  });

  afterEach(() => {
    unsubscribes.forEach((off) => off());
    set2D();
  });

  it('2D first jump → fit to the padded bounds, and NO camera request', () => {
    focusReviewTarget(extent, () => WORLD, false);
    expect(events).toEqual([{ name: 'fit', payload: { bounds: extent.bounds } }]);
    expect(focusRequests).toHaveLength(0);
  });

  it('2D later jump → slide over at the user’s own zoom', () => {
    focusReviewTarget(extent, () => WORLD, true);
    expect(events).toEqual([{ name: 'center', payload: { point: extent.centre } }]);
  });

  it('never resolves the 3D world in plan view (the thunk is the point)', () => {
    const resolve = jest.fn(() => WORLD);
    focusReviewTarget(extent, resolve, false);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('3D → one camera request carrying the derived half-extent, and NO 2D canvas event', () => {
    set3D();
    focusReviewTarget(extent, () => WORLD, true);
    expect(focusRequests).toEqual([{ point: WORLD, halfExtentM: extent.halfExtentM, preserveZoom: true }]);
    expect(events).toHaveLength(0);
  });

  it('3D with an unresolvable elevation → the camera does NOT move', () => {
    // «Δεν ξέρω πού είναι κατακόρυφα» δεν γίνεται «είναι στο μηδέν»: μια κάμερα σε επινοημένο
    // υψόμετρο στέλνει τον μηχανικό αλλού· το να μη γίνει τίποτα τουλάχιστον δεν παραπλανά.
    set3D();
    focusReviewTarget(extent, () => null, false);
    expect(focusRequests).toHaveLength(0);
    expect(events).toHaveLength(0);
  });
});
