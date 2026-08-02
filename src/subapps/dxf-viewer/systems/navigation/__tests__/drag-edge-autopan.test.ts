/**
 * ADR-739 §27.16 Ε1 — **auto-pan στην άκρη κατά τη σύρση**.
 *
 * Το δίχτυ χωρίζεται στα δύο, όπως και ο κώδικας:
 *  - η **καθαρή** ταχύτητα (`edgeAutoPanVelocity`) — γεωμετρία, μηδέν DOM, μηδέν χρόνος·
 *  - ο **κύκλος ζωής** (`startDragEdgeAutoPan`) — ποιος ζητά καρέ, πότε **δεν** ζητά, και
 *    ποιος τα σβήνει.
 *
 * 🔴 Το κρίσιμο test της κατηγορίας που κόστισε στο §27.15 (anchor που ελέγχει το store
 * αλλά όχι τον ζωγράφο): εδώ ελέγχεται ότι **μετά** από κάθε μετακίνηση κάδρου καλείται ο
 * `onPanned` — αλλιώς η επιλογή θα «πάγωνε» ενώ ο κόσμος γλιστράει από κάτω της, δηλαδή
 * το auto-pan θα φαινόταν να δουλεύει και **δεν** θα επέλεγε τίποτα παραπάνω.
 */

import { EventBus } from '../../events';
import {
  DRAG_EDGE_AUTOPAN,
  edgeAutoPanVelocity,
  edgeAutoPanSample,
  startDragEdgeAutoPan,
  stopDragEdgeAutoPan,
  isDragEdgeAutoPanActive,
  __runDragEdgeAutoPanFrameForTest,
} from '../drag-edge-autopan';

const SIZE = { width: 1000, height: 800 } as const;
const { bandPx, minSpeedPxPerSec, maxSpeedPxPerSec } = DRAG_EDGE_AUTOPAN;

/** Ένα δείγμα στο **κέντρο** — καμία άκρη, καμία ταχύτητα. */
const CENTER = { x: 500, y: 400, ...SIZE } as const;

afterEach(() => {
  stopDragEdgeAutoPan();
});

describe('🔴 §27.16 Ε1 — edgeAutoPanVelocity: η νεκρή ζώνη', () => {
  it('στο κέντρο δεν παράγει καμία ταχύτητα', () => {
    expect(edgeAutoPanVelocity(CENTER)).toEqual({ dx: 0, dy: 0 });
  });

  it('ακριβώς στο εσωτερικό όριο της ζώνης είναι ακόμη νεκρό (κλειστό διάστημα προς τα μέσα)', () => {
    expect(edgeAutoPanVelocity({ ...CENTER, x: bandPx })).toEqual({ dx: 0, dy: 0 });
    expect(edgeAutoPanVelocity({ ...CENTER, x: SIZE.width - bandPx })).toEqual({ dx: 0, dy: 0 });
    expect(edgeAutoPanVelocity({ ...CENTER, y: bandPx })).toEqual({ dx: 0, dy: 0 });
    expect(edgeAutoPanVelocity({ ...CENTER, y: SIZE.height - bandPx })).toEqual({ dx: 0, dy: 0 });
  });
});

describe('🔴 §27.16 Ε1 — η ΦΟΡΑ: τι βλέπει ο χρήστης', () => {
  it('δείκτης στην ΑΡΙΣΤΕΡΗ άκρη ⇒ το κάδρο κοιτά αριστερά (dx > 0, σύμβαση canvas-pan)', () => {
    expect(edgeAutoPanVelocity({ ...CENTER, x: 1 }).dx).toBeGreaterThan(0);
  });

  it('δείκτης στη ΔΕΞΙΑ άκρη ⇒ dx < 0', () => {
    expect(edgeAutoPanVelocity({ ...CENTER, x: SIZE.width - 1 }).dx).toBeLessThan(0);
  });

  it('δείκτης στην ΠΑΝΩ άκρη ⇒ dy > 0', () => {
    expect(edgeAutoPanVelocity({ ...CENTER, y: 1 }).dy).toBeGreaterThan(0);
  });

  it('δείκτης στην ΚΑΤΩ άκρη ⇒ dy < 0', () => {
    expect(edgeAutoPanVelocity({ ...CENTER, y: SIZE.height - 1 }).dy).toBeLessThan(0);
  });

  it('γωνία ⇒ και οι δύο άξονες ταυτόχρονα, ανεξάρτητα', () => {
    const v = edgeAutoPanVelocity({ ...CENTER, x: 0, y: 0 });
    expect(v.dx).toBeGreaterThan(0);
    expect(v.dy).toBeGreaterThan(0);
  });
});

describe('🔴 §27.16 Ε1 — η ΡΑΜΠΑ: βαθύτερα = γρηγορότερα, με φραγμό', () => {
  it('μόλις μέσα στη ζώνη δίνει το δάπεδο, όχι μηδέν (ο χρήστης πρέπει να ΔΕΙ ότι ξεκίνησε)', () => {
    // Βάθος → 0⁺: η ράμπα είναι ελάχιστη, άρα η ταχύτητα προσεγγίζει το δάπεδο.
    const v = edgeAutoPanVelocity({ ...CENTER, x: bandPx - 0.001 });
    expect(v.dx).toBeGreaterThan(0);
    expect(v.dx).toBeCloseTo(minSpeedPxPerSec, 1);
  });

  it('είναι γνησίως αύξουσα με το βάθος', () => {
    const shallow = edgeAutoPanVelocity({ ...CENTER, x: bandPx * 0.75 }).dx;
    const mid = edgeAutoPanVelocity({ ...CENTER, x: bandPx * 0.5 }).dx;
    const deep = edgeAutoPanVelocity({ ...CENTER, x: bandPx * 0.25 }).dx;
    expect(mid).toBeGreaterThan(shallow);
    expect(deep).toBeGreaterThan(mid);
  });

  it('στην ίδια την ακμή φτάνει το ταβάνι', () => {
    expect(edgeAutoPanVelocity({ ...CENTER, x: 0 }).dx).toBeCloseTo(maxSpeedPxPerSec, 6);
  });

  it('🔴 ΕΞΩ από το δοχείο ΔΕΝ ξεπερνά το ταβάνι — το χέρι μπορεί να πάει στην άλλη οθόνη', () => {
    expect(edgeAutoPanVelocity({ ...CENTER, x: -5000 }).dx).toBeCloseTo(maxSpeedPxPerSec, 6);
    expect(edgeAutoPanVelocity({ ...CENTER, x: SIZE.width + 5000 }).dx).toBeCloseTo(-maxSpeedPxPerSec, 6);
  });

  it('η ράμπα είναι ΤΕΤΡΑΓΩΝΙΚΗ, όχι γραμμική — ακρίβεια κοντά στην είσοδο', () => {
    // Στο μισό βάθος, μια γραμμική ράμπα θα έδινε τον μέσο όρο δαπέδου/ταβανιού.
    const halfway = edgeAutoPanVelocity({ ...CENTER, x: bandPx * 0.5 }).dx;
    const linearMidpoint = (minSpeedPxPerSec + maxSpeedPxPerSec) / 2;
    expect(halfway).toBeLessThan(linearMidpoint);
  });
});

describe('§27.16 Ε1 — edgeAutoPanSample: ο ΕΝΑΣ δρόμος συμβάν → δείγμα', () => {
  it('αφαιρεί τη γωνία του δοχείου, ώστε το δείγμα να είναι πάντα σε px δοχείου', () => {
    const container = {
      getBoundingClientRect: () => ({ left: 120, top: 40, width: 300, height: 200 }),
    } as unknown as HTMLElement;
    const sample = edgeAutoPanSample({ clientX: 150, clientY: 60 } as MouseEvent, container);
    expect(sample).toEqual({ x: 30, y: 20, width: 300, height: 200 });
  });

  it('δοχείο μηδενικών διαστάσεων ⇒ `null` (αποσυναρμολογημένο· καμία διαίρεση με το μηδέν)', () => {
    const container = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
    } as unknown as HTMLElement;
    expect(edgeAutoPanSample({ clientX: 0, clientY: 0 } as MouseEvent, container)).toBeNull();
  });
});

describe('🔴 §27.16 Ε1 — ο κύκλος ζωής και ο ΦΥΛΑΚΑΣ ΑΠΟΔΟΣΗΣ', () => {
  it('χωρίς εκκίνηση δεν είναι ενεργό', () => {
    expect(isDragEdgeAutoPanActive()).toBe(false);
  });

  it('η εκκίνηση το ενεργοποιεί και το `stop` το σβήνει — ιδεμποτές', () => {
    startDragEdgeAutoPan({ sample: () => CENTER, onPanned: () => {} });
    expect(isDragEdgeAutoPanActive()).toBe(true);
    stopDragEdgeAutoPan();
    expect(isDragEdgeAutoPanActive()).toBe(false);
    stopDragEdgeAutoPan();
    expect(isDragEdgeAutoPanActive()).toBe(false);
  });

  it('🔴 ΝΕΚΡΗ ΖΩΝΗ = ΜΗΔΕΝ ΔΟΥΛΕΙΑ: κανένα `canvas-pan`, κανένα `onPanned`', () => {
    const panned = jest.fn();
    const emitted = jest.fn();
    const off = EventBus.on('canvas-pan', emitted);
    startDragEdgeAutoPan({ sample: () => CENTER, onPanned: panned });
    __runDragEdgeAutoPanFrameForTest(16);
    off();
    expect(emitted).not.toHaveBeenCalled();
    expect(panned).not.toHaveBeenCalled();
  });

  it('μέσα στη ζώνη εκπέμπει `canvas-pan` ΚΑΙ ξαναρωτά τον καταναλωτή', () => {
    const panned = jest.fn();
    const emitted = jest.fn();
    const off = EventBus.on('canvas-pan', emitted);
    startDragEdgeAutoPan({ sample: () => ({ ...CENTER, x: 0 }), onPanned: panned });
    __runDragEdgeAutoPanFrameForTest(1000); // ένα ολόκληρο δευτερόλεπτο
    off();
    expect(emitted).toHaveBeenCalledTimes(1);
    expect(emitted.mock.calls[0][0].dx).toBeCloseTo(maxSpeedPxPerSec, 6);
    expect(emitted.mock.calls[0][0].dy).toBe(0);
    expect(panned).toHaveBeenCalledTimes(1);
  });

  it('🔴 Η ΤΑΧΥΤΗΤΑ ΕΙΝΑΙ ΑΝΑ ΔΕΥΤΕΡΟΛΕΠΤΟ, ΟΧΙ ΑΝΑ ΚΑΡΕ — ίδιο μήκος σε 1×100ms και 2×50ms', () => {
    const emitted = jest.fn();
    const off = EventBus.on('canvas-pan', emitted);
    startDragEdgeAutoPan({ sample: () => ({ ...CENTER, x: 0 }), onPanned: () => {} });
    __runDragEdgeAutoPanFrameForTest(100);
    const one = emitted.mock.calls[0][0].dx;
    __runDragEdgeAutoPanFrameForTest(50);
    __runDragEdgeAutoPanFrameForTest(50);
    const two = emitted.mock.calls[1][0].dx + emitted.mock.calls[2][0].dx;
    off();
    expect(two).toBeCloseTo(one, 6);
  });

  it('δείγμα `null` (το δοχείο χάθηκε) ⇒ σιωπή, όχι σφάλμα', () => {
    const panned = jest.fn();
    const emitted = jest.fn();
    const off = EventBus.on('canvas-pan', emitted);
    startDragEdgeAutoPan({ sample: () => null, onPanned: panned });
    expect(() => __runDragEdgeAutoPanFrameForTest(16)).not.toThrow();
    off();
    expect(emitted).not.toHaveBeenCalled();
    expect(panned).not.toHaveBeenCalled();
  });

  it('μετά το `stop` το καρέ δεν κάνει τίποτα', () => {
    const emitted = jest.fn();
    const off = EventBus.on('canvas-pan', emitted);
    startDragEdgeAutoPan({ sample: () => ({ ...CENTER, x: 0 }), onPanned: () => {} });
    stopDragEdgeAutoPan();
    __runDragEdgeAutoPanFrameForTest(16);
    off();
    expect(emitted).not.toHaveBeenCalled();
  });

  it('δεύτερη εκκίνηση κλείνει την πρώτη — δύο ταυτόχρονα auto-pan δεν υπάρχουν', () => {
    const first = jest.fn();
    const second = jest.fn();
    startDragEdgeAutoPan({ sample: () => ({ ...CENTER, x: 0 }), onPanned: first });
    startDragEdgeAutoPan({ sample: () => ({ ...CENTER, x: 0 }), onPanned: second });
    __runDragEdgeAutoPanFrameForTest(16);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
