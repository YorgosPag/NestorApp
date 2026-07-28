/**
 * ADR-723 — Ο πυρήνας της αλλαγής μεγέθους.
 *
 * Το κατηγόρημα που φυλάει αυτό το αρχείο:
 *
 *   **Η ΑΠΕΝΑΝΤΙ ΑΚΡΗ ΔΕΝ ΚΟΥΝΙΕΤΑΙ ΠΟΤΕ.**
 *
 * Όταν τραβάς τη δυτική άκρη, το δεξί περίγραμμα μένει καρφωμένο· όταν τραβάς τη βόρεια, το
 * κάτω. Είναι η μία ιδιότητα που κάνει το resize να «κουμπώνει» αντί να γλιστράει — και το
 * σημείο που οι αφελείς υλοποιήσεις (`width -= dx` χωρίς `x += dx`) το χάνουν, ιδίως στο
 * **ελάχιστο μέγεθος**, όπου το panel συνεχίζει να μετακινείται ενώ δεν συρρικνώνεται πια.
 */

import {
  computeResizedGeometry,
  resizeCursorFor,
  RESIZE_EDGES,
  type ResizeOrigin,
  type ResizeEdge,
} from '../useResizable';
import type { PanelSize } from '@/components/ui/floating/floating-panel-geometry';

const MIN: PanelSize = { width: 200, height: 100 };
const MAX: PanelSize = { width: 4000, height: 3000 };

function originAt(edge: ResizeEdge): ResizeOrigin {
  return { edge, pointerX: 1000, pointerY: 800, x: 600, y: 400, width: 400, height: 400 };
}

/** Οι τέσσερις άκρες του ορθογωνίου — η γλώσσα στην οποία διατυπώνεται το αναλλοίωτο. */
function edgesOf(g: { x: number; y: number; width: number; height: number }) {
  return { left: g.x, top: g.y, right: g.x + g.width, bottom: g.y + g.height };
}

describe('computeResizedGeometry — η απέναντι άκρη μένει καρφωμένη', () => {
  it('δυτικά: το ΔΕΞΙ περίγραμμα δεν κουνιέται', () => {
    const origin = originAt('w');
    const before = edgesOf(origin);
    // Τράβηγμα 120px αριστερά ⇒ φαρδαίνει.
    const after = edgesOf(computeResizedGeometry(origin, 880, 800, MIN, MAX));
    expect(after.right).toBe(before.right);
    expect(after.left).toBe(before.left - 120);
    expect(after.width ?? after.right - after.left).toBe(520);
  });

  it('βόρεια: το ΚΑΤΩ περίγραμμα δεν κουνιέται', () => {
    const origin = originAt('n');
    const before = edgesOf(origin);
    const after = edgesOf(computeResizedGeometry(origin, 1000, 700, MIN, MAX));
    expect(after.bottom).toBe(before.bottom);
    expect(after.top).toBe(before.top - 100);
  });

  it('ανατολικά: η θέση δεν αλλάζει καθόλου', () => {
    const origin = originAt('e');
    const next = computeResizedGeometry(origin, 1150, 800, MIN, MAX);
    expect(next.x).toBe(origin.x);
    expect(next.y).toBe(origin.y);
    expect(next.width).toBe(550);
  });

  it('νότια: η θέση δεν αλλάζει καθόλου', () => {
    const origin = originAt('s');
    const next = computeResizedGeometry(origin, 1000, 900, MIN, MAX);
    expect(next.x).toBe(origin.x);
    expect(next.y).toBe(origin.y);
    expect(next.height).toBe(500);
  });

  it('γωνία «nw»: ΚΑΙ οι δύο απέναντι άκρες μένουν καρφωμένες', () => {
    const origin = originAt('nw');
    const before = edgesOf(origin);
    const after = edgesOf(computeResizedGeometry(origin, 900, 700, MIN, MAX));
    expect(after.right).toBe(before.right);
    expect(after.bottom).toBe(before.bottom);
  });

  it('γωνία «se»: η θέση μένει άθικτη, μεγαλώνουν και οι δύο διαστάσεις', () => {
    const origin = originAt('se');
    const next = computeResizedGeometry(origin, 1200, 1000, MIN, MAX);
    expect(next).toEqual({ x: 600, y: 400, width: 600, height: 600 });
  });
});

describe('ΤΟ ΕΛΑΤΤΩΜΑ ΠΟΥ ΚΛΕΙΝΕΙ: μηδέν ολίσθηση στο ελάχιστο μέγεθος', () => {
  it('δυτικά — πέρα από το ελάχιστο πλάτος, η θέση ΠΑΓΩΝΕΙ', () => {
    const origin = originAt('w');
    // Τράβηγμα πολύ πέρα από το ελάχιστο (400 → κάτω από 200).
    const atLimit = computeResizedGeometry(origin, 1400, 800, MIN, MAX);
    const farBeyond = computeResizedGeometry(origin, 5000, 800, MIN, MAX);

    expect(atLimit.width).toBe(MIN.width);
    expect(farBeyond.width).toBe(MIN.width);
    // Η θέση προκύπτει από το ΠΕΡΙΟΡΙΣΜΕΝΟ μέγεθος ⇒ ίδια και στις δύο.
    expect(farBeyond.x).toBe(atLimit.x);
    // Και το δεξί περίγραμμα εξακολουθεί να είναι καρφωμένο.
    expect(farBeyond.x + farBeyond.width).toBe(origin.x + origin.width);
  });

  it('βόρεια — πέρα από το ελάχιστο ύψος, η θέση ΠΑΓΩΝΕΙ', () => {
    const origin = originAt('n');
    const atLimit = computeResizedGeometry(origin, 1000, 1100, MIN, MAX);
    const farBeyond = computeResizedGeometry(origin, 1000, 9000, MIN, MAX);
    expect(farBeyond.height).toBe(MIN.height);
    expect(farBeyond.y).toBe(atLimit.y);
    expect(farBeyond.y + farBeyond.height).toBe(origin.y + origin.height);
  });
});

describe('δεν μεγαλώνει πέρα από την κορυφή / αριστερή πλευρά του viewport', () => {
  it('δυτικά: το `x` δεν γίνεται ποτέ αρνητικό', () => {
    const origin = originAt('w');
    // Τράβηγμα 5000px αριστερά — πολύ πέρα από την αριστερή άκρη της οθόνης.
    const next = computeResizedGeometry(origin, -4000, 800, MIN, MAX);
    expect(next.x).toBe(0);
    expect(next.width).toBe(origin.x + origin.width); // ακριβώς μέχρι το αριστερό άκρο
  });

  it('βόρεια: το `y` δεν γίνεται ποτέ αρνητικό — αλλιώς χάνεται η επικεφαλίδα', () => {
    const origin = originAt('n');
    const next = computeResizedGeometry(origin, 1000, -4000, MIN, MAX);
    expect(next.y).toBe(0);
    expect(next.height).toBe(origin.y + origin.height);
  });
});

describe('όρια μεγέθους', () => {
  it('τηρεί το πάνω όριο ανατολικά', () => {
    const origin = originAt('e');
    const next = computeResizedGeometry(origin, 99999, 800, MIN, { width: 700, height: 3000 });
    expect(next.width).toBe(700);
  });

  it('μηδενική μετατόπιση ⇒ ταυτοτική γεωμετρία, για κάθε άκρη', () => {
    for (const edge of RESIZE_EDGES) {
      const origin = originAt(edge);
      expect(computeResizedGeometry(origin, origin.pointerX, origin.pointerY, MIN, MAX)).toEqual({
        x: origin.x, y: origin.y, width: origin.width, height: origin.height,
      });
    }
  });
});

describe('resizeCursorFor', () => {
  it('αντιστοιχίζει κάθε άκρη στον σωστό δρομέα', () => {
    expect(resizeCursorFor('n')).toBe('ns-resize');
    expect(resizeCursorFor('s')).toBe('ns-resize');
    expect(resizeCursorFor('e')).toBe('ew-resize');
    expect(resizeCursorFor('w')).toBe('ew-resize');
    expect(resizeCursorFor('ne')).toBe('nesw-resize');
    expect(resizeCursorFor('sw')).toBe('nesw-resize');
    expect(resizeCursorFor('nw')).toBe('nwse-resize');
    expect(resizeCursorFor('se')).toBe('nwse-resize');
  });

  it('καλύπτει και τις 8 άκρες (καμία δεν πέφτει σε σιωπηλή προεπιλογή)', () => {
    expect(RESIZE_EDGES).toHaveLength(8);
    expect(new Set(RESIZE_EDGES.map(resizeCursorFor)).size).toBe(4);
  });
});
