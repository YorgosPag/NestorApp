/**
 * ADR-723 — Ο κανόνας ορίων μιας αιωρούμενης παλέτας.
 *
 * Το κρίσιμο κατηγόρημα που φυλάει αυτό το αρχείο:
 *
 *   **Μετά από κάθε clamp, η παλέτα ΠΡΕΠΕΙ να είναι πιάσιμη με το ποντίκι.**
 *
 * Είναι η ιδιότητα που το AutoCAD δεν εγγυάται — η τεκμηριωμένη «Layer Properties palette lost
 * off-screen» μετά από αλλαγή οθόνης. Δεν ελέγχεται με «η θέση έγινε (10, 10)» (αυτό ελέγχει
 * την υλοποίηση), αλλά ως **αναλλοίωτο πάνω σε κάθε ακραία είσοδο**.
 *
 * Καθαρές συναρτήσεις — μηδέν DOM, μηδέν React.
 */

import {
  MINIMUM_VISIBLE_HEADER,
  DEFAULT_MIN_PANEL_SIZE,
  panelDragBounds,
  clampPanelSize,
  clampPanelPosition,
  clampPanelGeometry,
  isPanelGeometryWithinBounds,
  parsePanelGeometry,
  type PanelGeometry,
  type ViewportSize,
} from '../floating-panel-geometry';

const VIEWPORT: ViewportSize = { width: 1920, height: 1080 };

/**
 * Το αναλλοίωτο, γραμμένο ως κατηγόρημα και όχι ως αριθμός: υπάρχει τουλάχιστον
 * {@link MINIMUM_VISIBLE_HEADER} πλάτος ΚΑΙ ύψος τομής ανάμεσα στην παλέτα και στο viewport.
 */
function isGrabbable(g: PanelGeometry, viewport: ViewportSize): boolean {
  const visibleWidth = Math.min(g.x + g.width, viewport.width) - Math.max(g.x, 0);
  const visibleHeight = Math.min(g.y + g.height, viewport.height) - Math.max(g.y, 0);
  return visibleWidth >= MINIMUM_VISIBLE_HEADER && visibleHeight >= MINIMUM_VISIBLE_HEADER;
}

describe('panelDragBounds', () => {
  it('αφήνει τη λωρίδα επικεφαλίδας ορατή και στις τέσσερις κατευθύνσεις', () => {
    const bounds = panelDragBounds({ width: 400, height: 300 }, VIEWPORT);

    // Αριστερά: η παλέτα βγαίνει έξω, μένουν 40px από τη δεξιά της άκρη.
    expect(bounds.min.x).toBe(-400 + MINIMUM_VISIBLE_HEADER);
    // Δεξιά: μένουν 40px από την αριστερή της άκρη.
    expect(bounds.max.x).toBe(1920 - MINIMUM_VISIBLE_HEADER);
    // Πάνω: ΠΟΤΕ αρνητικό — εκεί δεν υπάρχει τίποτα να πιαστεί.
    expect(bounds.min.y).toBe(0);
    expect(bounds.max.y).toBe(1080 - MINIMUM_VISIBLE_HEADER);
  });

  it('τα οριζόντια όρια ακολουθούν το πλάτος (γι΄ αυτό το μέγεθος περιορίζεται ΠΡΩΤΟ)', () => {
    const narrow = panelDragBounds({ width: 300, height: 300 }, VIEWPORT);
    const wide = panelDragBounds({ width: 900, height: 300 }, VIEWPORT);
    expect(wide.min.x).toBeLessThan(narrow.min.x);
  });
});

describe('clampPanelSize', () => {
  it('δεν επιτρέπει παλέτα μεγαλύτερη από το viewport', () => {
    const size = clampPanelSize({ width: 5000, height: 4000 }, VIEWPORT);
    expect(size).toEqual({ width: 1920, height: 1080 });
  });

  it('επιβάλλει το κάτω όριο', () => {
    const size = clampPanelSize({ width: 10, height: 10 }, VIEWPORT);
    expect(size).toEqual(DEFAULT_MIN_PANEL_SIZE);
  });

  it('σε viewport μικρότερο από το ελάχιστο, κερδίζει το ΕΛΑΧΙΣΤΟ (λειτουργική, όχι μηδενική)', () => {
    // Τηλέφωνο σε landscape / πολύ μικρό παράθυρο: προτιμούμε ξεχείλισμα με κύλιση από μια
    // παλέτα 200px που δεν χωρά ούτε την επικεφαλίδα της.
    const size = clampPanelSize({ width: 600, height: 400 }, { width: 200, height: 150 });
    expect(size).toEqual(DEFAULT_MIN_PANEL_SIZE);
  });

  it('τηρεί το προαιρετικό πάνω όριο όταν είναι αυστηρότερο από το viewport', () => {
    const size = clampPanelSize({ width: 1800, height: 900 }, VIEWPORT, DEFAULT_MIN_PANEL_SIZE, {
      width: 800,
      height: 600,
    });
    expect(size).toEqual({ width: 800, height: 600 });
  });
});

describe('clampPanelGeometry — Η ΔΙΑΣΩΣΗ', () => {
  it('επαναφέρει παλέτα αποθηκευμένη σε οθόνη που δεν υπάρχει πια', () => {
    // Ο χρήστης είχε δεύτερη οθόνη στα δεξιά και άφησε εκεί την παλέτα· την αποσύνδεσε.
    const stored: PanelGeometry = { x: 3400, y: 700, width: 980, height: 620 };
    expect(isGrabbable(stored, VIEWPORT)).toBe(false);

    const rescued = clampPanelGeometry(stored, VIEWPORT);
    expect(isGrabbable(rescued, VIEWPORT)).toBe(true);
  });

  it('επαναφέρει παλέτα με αρνητικές συντεταγμένες (οθόνη αριστερά/πάνω από την κύρια)', () => {
    const stored: PanelGeometry = { x: -2000, y: -900, width: 980, height: 620 };
    const rescued = clampPanelGeometry(stored, VIEWPORT);
    expect(isGrabbable(rescued, VIEWPORT)).toBe(true);
    expect(rescued.y).toBeGreaterThanOrEqual(0);
  });

  it.each<[string, PanelGeometry]>([
    ['πολύ δεξιά', { x: 99999, y: 10, width: 400, height: 300 }],
    ['πολύ αριστερά', { x: -99999, y: 10, width: 400, height: 300 }],
    ['πολύ κάτω', { x: 10, y: 99999, width: 400, height: 300 }],
    ['πολύ πάνω', { x: 10, y: -99999, width: 400, height: 300 }],
    ['τεράστια', { x: -5000, y: -5000, width: 99999, height: 99999 }],
    ['εκφυλισμένη', { x: 0, y: 0, width: 1, height: 1 }],
  ])('παραμένει πιάσιμη μετά από clamp: %s', (_label, stored) => {
    expect(isGrabbable(clampPanelGeometry(stored, VIEWPORT), VIEWPORT)).toBe(true);
  });

  it('είναι ιδεμποτικό — δεύτερο clamp δεν κουνά τίποτα (αλλιώς ο φύλακας resize θα βρόχιζε)', () => {
    const once = clampPanelGeometry({ x: 9999, y: 9999, width: 5000, height: 5000 }, VIEWPORT);
    expect(clampPanelGeometry(once, VIEWPORT)).toEqual(once);
  });

  it('αφήνει άθικτη μια ήδη έγκυρη γεωμετρία', () => {
    const valid: PanelGeometry = { x: 120, y: 160, width: 980, height: 620 };
    expect(clampPanelGeometry(valid, VIEWPORT)).toEqual(valid);
  });

  it('περιορίζει ΠΡΩΤΑ το μέγεθος: μετά τη συρρίκνωση η θέση κρίνεται με το ΝΕΟ πλάτος', () => {
    // Πλάτος 4000 σε viewport 1920 ⇒ γίνεται 1920. Αν η θέση κρινόταν με το ΠΑΛΙΟ πλάτος, το
    // `min.x` θα ήταν -3960 και το x = -3000 θα περνούσε — αφήνοντας την παλέτα εκτός οθόνης.
    const rescued = clampPanelGeometry({ x: -3000, y: 0, width: 4000, height: 500 }, VIEWPORT);
    expect(rescued.width).toBe(1920);
    expect(rescued.x).toBe(-1920 + MINIMUM_VISIBLE_HEADER);
    expect(isGrabbable(rescued, VIEWPORT)).toBe(true);
  });
});

describe('isPanelGeometryWithinBounds', () => {
  it('true για έγκυρη γεωμετρία ⇒ ο φύλακας του resize δεν γράφει state', () => {
    expect(
      isPanelGeometryWithinBounds({ x: 100, y: 100, width: 400, height: 300 }, VIEWPORT),
    ).toBe(true);
  });

  it('false όταν χρειάζεται διάσωση', () => {
    expect(
      isPanelGeometryWithinBounds({ x: 5000, y: 100, width: 400, height: 300 }, VIEWPORT),
    ).toBe(false);
  });

  it('συμφωνεί πάντα με το clamp (μία αλήθεια, δύο ερωτήσεις)', () => {
    const samples: PanelGeometry[] = [
      { x: 0, y: 0, width: 400, height: 300 },
      { x: -5000, y: 40, width: 400, height: 300 },
      { x: 100, y: 100, width: 99999, height: 300 },
    ];
    for (const g of samples) {
      const within = isPanelGeometryWithinBounds(g, VIEWPORT);
      const unchanged = JSON.stringify(clampPanelGeometry(g, VIEWPORT)) === JSON.stringify(g);
      expect(within).toBe(unchanged);
    }
  });
});

describe('clampPanelPosition', () => {
  it('κρατά τη θέση όταν είναι ήδη εντός ορίων', () => {
    const pos = clampPanelPosition({ x: 300, y: 200 }, { width: 400, height: 300 }, VIEWPORT);
    expect(pos).toEqual({ x: 300, y: 200 });
  });
});

describe('parsePanelGeometry — τι ΔΕΝ γίνεται δεκτό', () => {
  it('δέχεται έγκυρο record', () => {
    expect(parsePanelGeometry({ x: 1, y: 2, width: 3, height: 4 })).toEqual({
      x: 1, y: 2, width: 3, height: 4,
    });
  });

  it.each<[string, unknown]>([
    ['null', null],
    ['undefined', undefined],
    ['συμβολοσειρά', 'not-an-object'],
    ['αριθμός', 42],
    ['πίνακας', [1, 2, 3, 4]],
    ['λείπει πεδίο', { x: 1, y: 2, width: 3 }],
    ['NaN', { x: NaN, y: 2, width: 3, height: 4 }],
    ['Infinity', { x: 1, y: 2, width: Infinity, height: 4 }],
    ['μηδενικό πλάτος', { x: 1, y: 2, width: 0, height: 4 }],
    ['αρνητικό ύψος', { x: 1, y: 2, width: 3, height: -4 }],
    ['αριθμοί ως strings', { x: '1', y: '2', width: '3', height: '4' }],
  ])('απορρίπτει: %s', (_label, value) => {
    expect(parsePanelGeometry(value)).toBeNull();
  });

  it('απορρίπτει ΟΛΟΚΛΗΡΟ το record σε ένα χαλασμένο πεδίο — καμία μερική «διόρθωση»', () => {
    // Ένα `width: NaN` που γινόταν σιωπηλά 280 θα έκρυβε ότι η αποθήκευση είναι κατεστραμμένη.
    // Η σωστή απάντηση είναι «τίποτα αξιοποιήσιμο» ⇒ πέσε στις προεπιλογές.
    expect(parsePanelGeometry({ x: 100, y: 100, width: NaN, height: 620 })).toBeNull();
  });
});
