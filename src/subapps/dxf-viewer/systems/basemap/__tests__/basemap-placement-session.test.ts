/**
 * ADR-782 §23 — άγκυρες `Σ1`-`Σ8` της **συνεδρίας** τοποθέτησης.
 *
 * Το κέντρο βάρους είναι το `Esc`: τρία σκαλιά μέσα σε **έναν** ιδιοκτήτη. Οι `Σ3`-`Σ5` το
 * κλειδώνουν σε **σειρά**, γιατί η σειρά *είναι* το συμβόλαιο — ένα `Esc` που έκλεινε τη
 * συνεδρία ενώ ο χρήστης κρατούσε τον χάρτη θα ακύρωνε τη λειτουργία αντί για την κίνηση.
 *
 * ⚠️ Η `Σ8` φυλάει τη διαφορά «κλείσιμο» ⧸ «ακύρωση»: ο χάρτης ενημερώνεται ζωντανά, άρα ό,τι
 * βλέπει ο χρήστης όταν πατά «Τέλος» το έχει ήδη αποδεχτεί. Ένα κλείσιμο που το ανέτρεπε θα
 * έσβηνε δουλειά που φαινόταν τελειωμένη.
 */

import type { GeoReference } from '../../geo-referencing/geo-transform';
import {
  addPlacementCorrespondence,
  beginBasemapPlacement,
  beginPlacementGesture,
  endBasemapPlacement,
  escapeBasemapPlacement,
  getBasemapPlacementSession,
  isBasemapPlacementActive,
  resetBasemapPlacementSession,
  setBasemapPlacementTool,
  setPlacementPendingDrawing,
  subscribeBasemapPlacementSession,
} from '../basemap-placement-session';
import {
  getBasemapPlacement,
  resetBasemapPlacementStore,
  setBasemapPlacement,
} from '../basemap-placement-store';

const BEFORE: GeoReference = { originWorld: { x: 100, y: 200 }, rotationDeg: 10 };
const DURING: GeoReference = { originWorld: { x: 999, y: 888 }, rotationDeg: 77 };

const PAIR = (n: number) => ({
  drawing: { x: n, y: n },
  world: { x: n * 1_000, y: n * 2_000 },
});

beforeEach(() => {
  resetBasemapPlacementSession();
  resetBasemapPlacementStore();
});

describe('ADR-782 §23 — συνεδρία τοποθέτησης', () => {
  it('Σ1 — άνοιγμα ⇒ ενεργή και καθαρή· κλείσιμο ⇒ αδρανής', () => {
    beginBasemapPlacement();
    expect(isBasemapPlacementActive()).toBe(true);
    expect(getBasemapPlacementSession()).toMatchObject({
      tool: 'drag',
      gesture: 'none',
      pendingDrawing: null,
      correspondences: [],
    });

    endBasemapPlacement();
    expect(isBasemapPlacementActive()).toBe(false);
  });

  it('Σ1β — άνοιγμα μετά από απότομο κλείσιμο ξεκινά ΚΑΘΑΡΟ', () => {
    beginBasemapPlacement();
    setBasemapPlacementTool('match');
    setPlacementPendingDrawing({ x: 5, y: 5 });
    addPlacementCorrespondence(PAIR(1));

    beginBasemapPlacement();
    expect(getBasemapPlacementSession().correspondences).toEqual([]);
    expect(getBasemapPlacementSession().tool).toBe('drag');
  });

  it('Σ2 — αλλαγή εργαλείου ρίχνει τη μισοτελειωμένη αντιστοιχία', () => {
    beginBasemapPlacement();
    setBasemapPlacementTool('match');
    setPlacementPendingDrawing({ x: 5, y: 5 });

    setBasemapPlacementTool('drag');
    expect(getBasemapPlacementSession().pendingDrawing).toBeNull();
  });

  it('Σ3 — Esc ΜΕΣΑ σε χειρονομία: επαναφέρει το πλαίσιο, ΔΕΝ κλείνει τη συνεδρία', () => {
    beginBasemapPlacement();
    setBasemapPlacement(BEFORE);
    beginPlacementGesture('drag', BEFORE);
    setBasemapPlacement(DURING);

    expect(escapeBasemapPlacement()).toBe(true);
    expect(getBasemapPlacement()).toEqual(BEFORE);
    expect(isBasemapPlacementActive()).toBe(true);
    expect(getBasemapPlacementSession().gesture).toBe('none');
  });

  it('Σ4 — Esc με μισή αντιστοιχία: σβήνει ΜΟΝΟ αυτήν', () => {
    beginBasemapPlacement();
    setBasemapPlacementTool('match');
    addPlacementCorrespondence(PAIR(1));
    setPlacementPendingDrawing({ x: 5, y: 5 });

    expect(escapeBasemapPlacement()).toBe(true);
    expect(getBasemapPlacementSession().pendingDrawing).toBeNull();
    expect(getBasemapPlacementSession().correspondences).toHaveLength(1);
    expect(isBasemapPlacementActive()).toBe(true);
  });

  it('Σ5 — Esc χωρίς τίποτα εκκρεμές: κλείνει τη συνεδρία', () => {
    beginBasemapPlacement();
    expect(escapeBasemapPlacement()).toBe(true);
    expect(isBasemapPlacementActive()).toBe(false);
  });

  it('Σ6 — κρατιούνται οι ΔΥΟ τελευταίες αντιστοιχίες, όχι όλες', () => {
    beginBasemapPlacement();
    addPlacementCorrespondence(PAIR(1));
    addPlacementCorrespondence(PAIR(2));
    addPlacementCorrespondence(PAIR(3));

    expect(getBasemapPlacementSession().correspondences).toEqual([PAIR(2), PAIR(3)]);
  });

  it('Σ7 — εκτός συνεδρίας το Esc ΔΕΝ καταναλώνεται (αλλιώς κλέβεται από όλη την εφαρμογή)', () => {
    expect(escapeBasemapPlacement()).toBe(false);
  });

  it('Σ8 — το κλείσιμο ΔΕΝ αναιρεί την τοποθέτηση', () => {
    beginBasemapPlacement();
    setBasemapPlacement(DURING);

    endBasemapPlacement();
    expect(getBasemapPlacement()).toEqual(DURING);
  });
});

/**
 * ADR-782 §26 — το «Τέλος» **ειδοποιεί** και **δεν σβήνει** τους συνδρομητές.
 *
 * 🔴 Ζωντανό εύρημα (Giorgio, 2026-08-10): το `endBasemapPlacement` καλούσε `store.reset(IDLE)`,
 * που είναι **teardown δοκιμών** — αλλάζει τιμή χωρίς ειδοποίηση **και** κάνει `listeners.clear()`.
 * Οι `Σ1`/`Σ8` παραπάνω ήταν **πράσινες** πάνω σε αυτό, γιατί ρωτούσαν **την τιμή** (`get()`) και
 * ποτέ **αν το έμαθε κανείς**. Ο διακόπτης, το πάνελ και η επιφάνεια που κρατά τον δείκτη
 * διαβάζουν όλοι με `useSyncExternalStore` — δηλαδή με **συνδρομή**.
 *
 * ⚠️ Η `Ω2` είναι η ουσιώδης και η μόνη που πιάνει τη **δεύτερη**, χειρότερη συνέπεια: μετά το
 * «Τέλος» καμία επόμενη αλλαγή δεν έφτανε ποτέ σε κανέναν, άρα το πάνελ έμενε παγωμένο στην οθόνη
 * με **τα τέσσερα κουμπιά του αδρανή** και τον καμβά όμηρο μέχρι την ανανέωση σελίδας.
 */
describe('ADR-782 §26 — το κλείσιμο είναι runtime API, όχι teardown', () => {
  it('Ω1 — το «Τέλος» ΕΙΔΟΠΟΙΕΙ τους συνδρομητές (αλλιώς το πάνελ δεν κρύβεται ποτέ)', () => {
    beginBasemapPlacement();
    const listener = jest.fn();
    subscribeBasemapPlacementSession(listener);

    endBasemapPlacement();

    expect(listener).toHaveBeenCalled();
    expect(isBasemapPlacementActive()).toBe(false);
  });

  it('Ω2 — οι συνδρομητές ΕΠΙΒΙΩΝΟΥΝ του κλεισίματος: η επόμενη αλλαγή φτάνει κι αυτή', () => {
    beginBasemapPlacement();
    const listener = jest.fn();
    subscribeBasemapPlacementSession(listener);

    endBasemapPlacement();
    listener.mockClear();

    // Δεύτερο άνοιγμα: χωρίς αυτό, ο χρήστης ξανάνοιγε το εργαλείο και **δεν εμφανιζόταν τίποτα**.
    beginBasemapPlacement();
    expect(listener).toHaveBeenCalled();

    listener.mockClear();
    setBasemapPlacementTool('match');
    expect(listener).toHaveBeenCalled();
  });

  it('Ω3 — το Esc που κλείνει τη συνεδρία ακολουθεί τον ΙΔΙΟ δρόμο (κοινός καλών)', () => {
    beginBasemapPlacement();
    const listener = jest.fn();
    subscribeBasemapPlacementSession(listener);

    expect(escapeBasemapPlacement()).toBe(true);

    expect(listener).toHaveBeenCalled();
    expect(isBasemapPlacementActive()).toBe(false);

    // Και μετά από Esc, ο συνδρομητής είναι ακόμη εκεί.
    listener.mockClear();
    beginBasemapPlacement();
    expect(listener).toHaveBeenCalled();
  });

  it('Ω4 — το teardown δοκιμών ΔΙΑΤΗΡΕΙ τη σημασία του: ρίχνει τους συνδρομητές', () => {
    beginBasemapPlacement();
    const listener = jest.fn();
    subscribeBasemapPlacementSession(listener);

    // Σκόπιμη διαφορά: αυτό ΔΕΝ είναι πράξη χρήστη, είναι απομόνωση δοκιμών (`ExternalStore.reset`).
    resetBasemapPlacementSession();
    listener.mockClear();

    beginBasemapPlacement();
    expect(listener).not.toHaveBeenCalled();
  });
});
