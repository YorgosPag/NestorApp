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
