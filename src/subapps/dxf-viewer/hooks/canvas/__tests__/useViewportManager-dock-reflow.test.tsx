/**
 * ADR-724 Φ2 — Η παλινδρόμηση που κάνει τη «μικρή, χαμηλού ρίσκου» Φ2 **όχι μικρή**.
 *
 * ── ΤΟ ΕΛΑΤΤΩΜΑ ──
 *
 * Η αλλαγή πλευράς **μετακινεί** τον καμβά χωρίς να τον **αλλάζει σε μέγεθος**: το panel του
 * κρατά ακριβώς το ίδιο πλάτος, απλώς βρίσκεται αλλού. Ο `ResizeObserver` πυροδοτείται μόνο σε
 * αλλαγή **μεγέθους** — σε καθαρή μετατόπιση **σιωπά**. Άρα το `containerLeftRef` μένει στην
 * παλιά ακμή, και το **επόμενο** πραγματικό σύρσιμο υπολογίζει τεράστιο `Δleft` και πετάει το
 * σχέδιο κατά όλο το πλάτος της παλέτας — **μία χειρονομία μετά** την ενέργεια που το προκάλεσε,
 * που είναι και ο λόγος που ένα τέτοιο ελάττωμα δεν αποδίδεται ποτέ στη σωστή αιτία.
 *
 * ── ΓΙΑΤΙ ΑΥΤΟ ΤΟ TEST ΕΙΝΑΙ ΑΞΙΟΠΙΣΤΟ ΠΑΡΟΤΙ ΤΟ jsdom ΔΕΝ ΚΑΝΕΙ ΔΙΑΤΑΞΗ ──
 *
 * Δεν μετριέται κανένα πραγματικό pixel. Ο `ResizeObserver` είναι mock (jest.setup) και το
 * callback του καλείται **χειροκίνητα** — δηλαδή ελέγχεται ακριβώς η αριθμητική του κανόνα
 * αγκύρωσης πάνω σε ελεγχόμενα ορθογώνια. Αυτό είναι το επίπεδο όπου ζει το ελάττωμα.
 *
 * ⚠️ Πριν την αλλαγή πλευράς αφήνουμε να ολοκληρωθούν **όλες** οι μετρήσεις του mount. Αλλιώς η
 * καθυστερημένη μέτρηση σταθεροποίησης θα ξανάσπερνε την ακμή από μόνη της και το test θα
 * περνούσε **για λάθος λόγο** — πράσινο χωρίς να μπορεί να κοκκινίσει.
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useViewportManager } from '../useViewportManager';
import { setDockMode } from '../../../systems/workspace/workspace-dock-store';
import type { ViewTransform } from '../../../rendering/types/Types';

type ResizeCallback = (entries: Array<{ contentRect: { width: number; height: number } }>) => void;

/** Το πλάτος της παλέτας — όσο δηλαδή μετακινείται ο καμβάς όταν αλλάζει πλευρά. */
const DOCK_WIDTH = 392;
const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 700;

const INITIAL_TRANSFORM: ViewTransform = { scale: 1, offsetX: 100, offsetY: 50 };

/** Αφήνει να τρέξουν πραγματικοί χρονιστές/καρέ — ο hook στήνει τον observer με καθυστέρηση. */
function settle(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('ADR-724 Φ2 — αλλαγή πλευράς: ξαναμέτρηση, ΟΧΙ αντιστάθμιση', () => {
  let container: HTMLDivElement;
  let rectLeft: number;
  let setTransform: jest.Mock;

  beforeEach(() => {
    setDockMode('docked-left');
    rectLeft = DOCK_WIDTH; // παλέτα αριστερά ⇒ ο καμβάς ξεκινά μετά από αυτήν
    container = document.createElement('div');
    container.getBoundingClientRect = (): DOMRect => ({
      left: rectLeft,
      top: 0,
      right: rectLeft + CANVAS_WIDTH,
      bottom: CANVAS_HEIGHT,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      x: rectLeft,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
    setTransform = jest.fn();
    (global.ResizeObserver as unknown as jest.Mock).mockClear();
  });

  afterEach(() => {
    setDockMode('docked-left');
  });

  /** Το callback που πέρασε ο hook στον (mock) `ResizeObserver`. */
  function observerCallback(): ResizeCallback {
    const mock = global.ResizeObserver as unknown as jest.Mock;
    const lastCall = mock.mock.calls[mock.mock.calls.length - 1];
    return lastCall[0] as ResizeCallback;
  }

  async function mountViewport(): Promise<void> {
    const containerRef = { current: container } as React.MutableRefObject<HTMLDivElement | null>;
    renderHook(() => useViewportManager({
      containerRef,
      transform: INITIAL_TRANSFORM,
      setTransform,
    }));
    // Όλες οι μετρήσεις του mount (retry του observer + καθυστερημένη σταθεροποίηση).
    await act(async () => { await settle(600); });
  }

  /** Προσομοιώνει σύρσιμο του διαχωριστικού: ΑΛΛΑΖΕΙ πλάτος ⇒ ο observer πυροδοτείται. */
  async function simulateSeparatorDrag(newWidth: number): Promise<void> {
    await act(async () => {
      observerCallback()([{ contentRect: { width: newWidth, height: CANVAS_HEIGHT } }]);
      await settle(200); // το debounce των 100ms πριν φτάσει στο React
    });
  }

  it('ΤΟ ΣΕΝΑΡΙΟ ΠΑΛΙΝΔΡΟΜΗΣΗΣ: αλλαγή πλευράς ⇒ το επόμενο σύρσιμο ΔΕΝ πετάει το σχέδιο', async () => {
    await mountViewport();

    // Ο χρήστης επιλέγει «Αγκύρωση δεξιά»: ο καμβάς πάει στο x=0 με ΤΟ ΙΔΙΟ πλάτος.
    // Καμία αλλαγή μεγέθους ⇒ ο ResizeObserver ΔΕΝ πυροδοτείται από μόνος του.
    rectLeft = 0;
    await act(async () => {
      setDockMode('docked-right');
      await settle(200); // το καρέ στο οποίο ξαναμετριέται η θέση
    });

    setTransform.mockClear();

    // Τώρα ο χρήστης σέρνει το διαχωριστικό. Η αριστερή ακμή ΔΕΝ κουνιέται (παλέτα δεξιά),
    // άρα Δleft = 0 και το σχέδιο οφείλει να μείνει ακίνητο.
    await simulateSeparatorDrag(CANVAS_WIDTH - 60);

    expect(setTransform).toHaveBeenCalled();
    const applied = setTransform.mock.calls[setTransform.mock.calls.length - 1][0] as ViewTransform;

    // Χωρίς την ξαναμέτρηση: previousLeft=392, measuredLeft=0 ⇒ Δleft=−392 ⇒ offsetX 100→492.
    expect(applied.offsetX).toBe(INITIAL_TRANSFORM.offsetX);
    expect(applied.offsetY).toBe(INITIAL_TRANSFORM.offsetY);
  });

  it('η ίδια η αλλαγή πλευράς ΔΕΝ μετακινεί το σχέδιο (η κάμερα δεν αλλάζει, κανόνας Revit)', async () => {
    await mountViewport();
    setTransform.mockClear();

    rectLeft = 0;
    await act(async () => {
      setDockMode('docked-right');
      await settle(200);
    });

    // Ό,τι κι αν εφαρμόστηκε, το transform πρέπει να είναι ΑΝΕΠΑΦΟ: μια παλέτα που
    // μετακόμισε δεν είναι λόγος να αλλάξει η οπτική γωνία στο σχέδιο.
    for (const [applied] of setTransform.mock.calls) {
      expect((applied as ViewTransform).offsetX).toBe(INITIAL_TRANSFORM.offsetX);
      expect((applied as ViewTransform).offsetY).toBe(INITIAL_TRANSFORM.offsetY);
    }
  });

  it('η αγκύρωση ΕΞΑΚΟΛΟΥΘΕΙ να δουλεύει αριστερά — η διόρθωση δεν την απενεργοποίησε', async () => {
    await mountViewport();
    setTransform.mockClear();

    // Παλέτα αριστερά, ο χρήστης τη στενεύει κατά 60px ⇒ η αριστερή ακμή του καμβά πάει
    // αριστερά κατά 60 ⇒ το σχέδιο πρέπει να αντισταθμιστεί ώστε να μείνει ακίνητο.
    rectLeft = DOCK_WIDTH - 60;
    await simulateSeparatorDrag(CANVAS_WIDTH + 60);

    const applied = setTransform.mock.calls[setTransform.mock.calls.length - 1][0] as ViewTransform;
    expect(applied.offsetX).toBe(INITIAL_TRANSFORM.offsetX + 60);
  });
});
