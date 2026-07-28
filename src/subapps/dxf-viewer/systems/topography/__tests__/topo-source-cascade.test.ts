/**
 * ADR-718 Μ3 — ο ζωντανός δεσμός: το όριο κοπής και οι ασυνέχειες **ακολουθούν** τη γραμμή του
 * σχεδίου από την οποία επιλέχθηκαν.
 *
 * Αυτό που φυλάει το αρχείο δεν είναι «ένα σύρσιμο δούλεψε» αλλά τα **συμβόλαια** του
 * reconciler, γιατί καθένα τους αντιστοιχεί σε έναν τρόπο να ξαναγεννηθεί το bug:
 *
 *   • **ακολουθεί** — η κύρια απαίτηση: αλλάζει η πολυγραμμή ⇒ αλλάζει ο δακτύλιος·
 *   • **ιδεμποτεντικό** — τρέχει μετά από ΚΑΘΕ εντολή του εγγράφου· εγγραφή χωρίς πραγματική
 *     αλλαγή σημαίνει ξαναχτίσιμο ισοϋψών + Firestore save σε κάθε άσχετη κίνηση·
 *   • **ταυτότητα** — ίδιο σχήμα ⇒ ΤΟ ΙΔΙΟ αντικείμενο (το `getActiveCropRing()` συγκρίνεται
 *     με ταυτότητα· νέο ισοδύναμο object θα ξανάχτιζε 3Δ + κάτοψη χωρίς λόγο)·
 *   • **ποτέ σιωπηλή απώλεια** — σπασμένος δεσμός κρατά το τελευταίο έγκυρο σχήμα ΚΑΙ το λέει·
 *   • **θεραπεία** — η ίδια διαδρομή ξανασυνδέει, χωρίς ειδικό «re-link» μονοπάτι·
 *   • **ΕΝΑΣ μηχανισμός** — όριο ΚΑΙ ασυνέχειες, σε ΟΛΕΣ τις named επιφάνειες.
 *
 * @see ../topo-source-cascade
 */

import { cascadeTopoSourceGeometry } from '../topo-source-cascade';
import {
  clearTopo, getTopoBoundary, getTopoBoundaryLink, getTopoBreaklines,
  setTopoBoundary, setTopoPoints, addBreakline,
} from '../TopoPointStore';
import type { Entity } from '../../../types/entities';
import type { ISceneManager } from '../../../core/commands/interfaces';
import type { TopoPoint } from '../topo-types';

const M = 1000;
const BOUNDARY_ID = 'ent-boundary';
const BREAKLINE_ID = 'ent-breakline';

/** Κλειστό τετράγωνο 10 m × 10 m — το «οικόπεδο». */
const SQUARE = [
  { x: 0, y: 0 },
  { x: 10 * M, y: 0 },
  { x: 10 * M, y: 10 * M },
  { x: 0, y: 10 * M },
];

/** Το ίδιο τετράγωνο με τη ΝΑ γωνία τραβηγμένη — «ο χρήστης έσυρε μια λαβή». */
const SQUARE_DRAGGED = [
  { x: 0, y: 0 },
  { x: 14 * M, y: 0 },
  { x: 10 * M, y: 10 * M },
  { x: 0, y: 10 * M },
];

function polyline(id: string, vertices: readonly { x: number; y: number }[], closed: boolean): Entity {
  return {
    id,
    type: 'polyline',
    layerId: 'lyr_test',
    vertices: vertices.map((v) => ({ ...v })),
    closed,
  } as unknown as Entity;
}

/** Ελάχιστος scene manager: ο cascade χρειάζεται μόνο `getEntity`. */
function sceneWith(...entities: readonly Entity[]): Pick<ISceneManager, 'getEntity'> {
  const byId = new Map(entities.map((e) => [e.id, e]));
  return { getEntity: (id: string) => byId.get(id) as never };
}

const EMPTY_SCENE = sceneWith();

/** Δύο μετρημένα σημεία — αρκετά για να υψομετρηθεί μια proximity ασυνέχεια. */
const SURVEY: TopoPoint[] = [
  { x: 0, y: 0, z: 1 * M },
  { x: 10 * M, y: 10 * M, z: 3 * M },
];

beforeEach(() => {
  clearTopo();
});

// ─── Όριο: ακολουθεί ───────────────────────────────────────────────────────────

describe('όριο — ακολουθεί την πολυγραμμή-πηγή', () => {
  beforeEach(() => {
    setTopoBoundary({ vertices: SQUARE, sourceEntityId: BOUNDARY_ID });
  });

  it('σύρσιμο λαβής ⇒ ο δακτύλιος παίρνει τις νέες κορυφές', () => {
    cascadeTopoSourceGeometry(
      [BOUNDARY_ID],
      sceneWith(polyline(BOUNDARY_ID, SQUARE_DRAGGED, true)),
    );

    expect(getTopoBoundary()?.vertices).toEqual(SQUARE_DRAGGED);
    expect(getTopoBoundaryLink()).toBe('live');
  });

  it('η ταυτότητα της πηγής επιβιώνει — αλλιώς σπάει το toggle-off του εργαλείου', () => {
    cascadeTopoSourceGeometry(
      [BOUNDARY_ID],
      sceneWith(polyline(BOUNDARY_ID, SQUARE_DRAGGED, true)),
    );

    expect(getTopoBoundary()?.sourceEntityId).toBe(BOUNDARY_ID);
  });

  it('προσθήκη κορυφής ⇒ ο δακτύλιος μεγαλώνει κατά μία', () => {
    const withExtra = [...SQUARE.slice(0, 2), { x: 12 * M, y: 5 * M }, ...SQUARE.slice(2)];
    cascadeTopoSourceGeometry([BOUNDARY_ID], sceneWith(polyline(BOUNDARY_ID, withExtra, true)));

    expect(getTopoBoundary()?.vertices).toHaveLength(5);
  });
});

// ─── Όριο: ιδεμποτεντικότητα + ταυτότητα ───────────────────────────────────────

describe('όριο — καμία δουλειά χωρίς πραγματική αλλαγή', () => {
  it('άσχετο id στις changedIds ⇒ ούτε καν ανάγνωση της σκηνής', () => {
    setTopoBoundary({ vertices: SQUARE, sourceEntityId: BOUNDARY_ID });
    const before = getTopoBoundary();
    const scene = { getEntity: jest.fn() };

    cascadeTopoSourceGeometry(['some-other-entity'], scene);

    expect(scene.getEntity).not.toHaveBeenCalled();
    expect(getTopoBoundary()).toBe(before);
  });

  it('κενές changedIds ⇒ no-op', () => {
    setTopoBoundary({ vertices: SQUARE, sourceEntityId: BOUNDARY_ID });
    const before = getTopoBoundary();

    cascadeTopoSourceGeometry([], EMPTY_SCENE);

    expect(getTopoBoundary()).toBe(before);
  });

  it('ίδιο σχήμα ⇒ ΤΟ ΙΔΙΟ αντικείμενο (η ταυτότητα οδηγεί το ξαναχτίσιμο 3Δ/κάτοψης)', () => {
    setTopoBoundary({ vertices: SQUARE, sourceEntityId: BOUNDARY_ID });
    const before = getTopoBoundary();

    cascadeTopoSourceGeometry([BOUNDARY_ID], sceneWith(polyline(BOUNDARY_ID, SQUARE, true)));

    expect(getTopoBoundary()).toBe(before);
  });

  it('όριο χωρίς sourceEntityId (π.χ. από πίνακα συντεταγμένων) μένει ανέγγιχτο', () => {
    setTopoBoundary({ vertices: SQUARE });
    const before = getTopoBoundary();

    cascadeTopoSourceGeometry([BOUNDARY_ID], sceneWith(polyline(BOUNDARY_ID, SQUARE_DRAGGED, true)));

    expect(getTopoBoundary()).toBe(before);
  });
});

// ─── Όριο: σπασμένος δεσμός ────────────────────────────────────────────────────

describe('όριο — σπασμένος δεσμός: κρατά το σχήμα ΚΑΙ το λέει', () => {
  beforeEach(() => {
    setTopoBoundary({ vertices: SQUARE, sourceEntityId: BOUNDARY_ID });
  });

  it('η πολυγραμμή άνοιξε ⇒ «invalid», ο δακτύλιος μένει (οι όγκοι δεν αλλάζουν σιωπηλά)', () => {
    cascadeTopoSourceGeometry([BOUNDARY_ID], sceneWith(polyline(BOUNDARY_ID, SQUARE_DRAGGED, false)));

    expect(getTopoBoundaryLink()).toBe('invalid');
    expect(getTopoBoundary()?.vertices).toEqual(SQUARE);
  });

  it('έμειναν 2 κορυφές ⇒ «invalid» (κλειστό δίγωνο δεν έχει μέσα)', () => {
    cascadeTopoSourceGeometry([BOUNDARY_ID], sceneWith(polyline(BOUNDARY_ID, SQUARE.slice(0, 2), true)));

    expect(getTopoBoundaryLink()).toBe('invalid');
    expect(getTopoBoundary()?.vertices).toEqual(SQUARE);
  });

  it('η πολυγραμμή διαγράφηκε ⇒ «missing», ο δακτύλιος μένει', () => {
    cascadeTopoSourceGeometry([BOUNDARY_ID], EMPTY_SCENE);

    expect(getTopoBoundaryLink()).toBe('missing');
    expect(getTopoBoundary()?.vertices).toEqual(SQUARE);
  });

  it('η οντότητα επιστρέφει (undo) ⇒ ο δεσμός γιατρεύεται μόνος του', () => {
    cascadeTopoSourceGeometry([BOUNDARY_ID], EMPTY_SCENE);
    expect(getTopoBoundaryLink()).toBe('missing');

    cascadeTopoSourceGeometry([BOUNDARY_ID], sceneWith(polyline(BOUNDARY_ID, SQUARE_DRAGGED, true)));

    expect(getTopoBoundaryLink()).toBe('live');
    expect(getTopoBoundary()?.vertices).toEqual(SQUARE_DRAGGED);
  });

  it('νέα επιλογή ορίου μηδενίζει έναν παλιό σπασμένο δεσμό', () => {
    cascadeTopoSourceGeometry([BOUNDARY_ID], EMPTY_SCENE);
    expect(getTopoBoundaryLink()).toBe('missing');

    setTopoBoundary({ vertices: SQUARE_DRAGGED, sourceEntityId: 'ent-other' });

    expect(getTopoBoundaryLink()).toBe('live');
  });
});

// ─── Ασυνέχειες: ο ΙΔΙΟΣ μηχανισμός ────────────────────────────────────────────

describe('ασυνέχειες — ο ΙΔΙΟΣ reconciler, όχι δίδυμος', () => {
  beforeEach(() => {
    setTopoPoints(SURVEY);
  });

  it('η γραμμή-πηγή μετακινήθηκε ⇒ οι κορυφές της ασυνέχειας ακολουθούν', () => {
    addBreakline(
      [{ x: 0, y: 0, z: 1 * M }, { x: 5 * M, y: 5 * M, z: 2 * M }],
      false,
      BREAKLINE_ID,
    );
    const moved = [{ x: 2 * M, y: 2 * M }, { x: 8 * M, y: 8 * M }];

    cascadeTopoSourceGeometry([BREAKLINE_ID], sceneWith(polyline(BREAKLINE_ID, moved, false)));

    const [b] = getTopoBreaklines();
    expect(b!.vertices.map((v) => ({ x: v.x, y: v.y }))).toEqual(moved);
  });

  it('id και sourceEntityId επιβιώνουν — αλλιώς το δεύτερο κλικ προσθέτει αντί να αφαιρεί', () => {
    const id = addBreakline([{ x: 0, y: 0, z: M }, { x: 5 * M, y: 5 * M, z: M }], false, BREAKLINE_ID);
    const moved = [{ x: 1 * M, y: 1 * M }, { x: 9 * M, y: 9 * M }];

    cascadeTopoSourceGeometry([BREAKLINE_ID], sceneWith(polyline(BREAKLINE_ID, moved, false)));

    const [b] = getTopoBreaklines();
    expect(b!.id).toBe(id);
    expect(b!.sourceEntityId).toBe(BREAKLINE_ID);
  });

  it('ίδιο σχήμα ⇒ ο ορισμός μένει ΤΟ ΙΔΙΟ αντικείμενο (αλλιώς ξανατρέχει ο CDT)', () => {
    addBreakline([{ x: 0, y: 0, z: M }, { x: 10 * M, y: 10 * M, z: 3 * M }], false, BREAKLINE_ID);
    const before = getTopoBreaklines();
    const same = [{ x: 0, y: 0 }, { x: 10 * M, y: 10 * M }];

    cascadeTopoSourceGeometry([BREAKLINE_ID], sceneWith(polyline(BREAKLINE_ID, same, false)));

    expect(getTopoBreaklines()).toBe(before);
  });

  it('η γραμμή-πηγή διαγράφηκε ⇒ κρατά το τελευταίο σχήμα (ίδιος κανόνας με το όριο)', () => {
    addBreakline([{ x: 0, y: 0, z: M }, { x: 5 * M, y: 5 * M, z: M }], false, BREAKLINE_ID);
    const before = getTopoBreaklines()[0];

    cascadeTopoSourceGeometry([BREAKLINE_ID], EMPTY_SCENE);

    expect(getTopoBreaklines()[0]).toEqual(before);
  });

  it('ασυνέχεια χωρίς πηγή (auto-breakline) μένει ανέγγιχτη', () => {
    addBreakline([{ x: 0, y: 0, z: M }, { x: 5 * M, y: 5 * M, z: M }]);
    const before = getTopoBreaklines();

    cascadeTopoSourceGeometry([BREAKLINE_ID], sceneWith(polyline(BREAKLINE_ID, SQUARE, false)));

    expect(getTopoBreaklines()).toBe(before);
  });

  it('καλύπτει ΚΑΙ την «proposed» επιφάνεια, όχι μόνο την «existing»', () => {
    setTopoPoints(SURVEY, 'proposed');
    addBreakline([{ x: 0, y: 0, z: M }, { x: 5 * M, y: 5 * M, z: M }], false, BREAKLINE_ID, 'proposed');
    const moved = [{ x: 3 * M, y: 3 * M }, { x: 7 * M, y: 7 * M }];

    cascadeTopoSourceGeometry([BREAKLINE_ID], sceneWith(polyline(BREAKLINE_ID, moved, false)));

    const [b] = getTopoBreaklines('proposed');
    expect(b!.vertices.map((v) => ({ x: v.x, y: v.y }))).toEqual(moved);
  });
});

// ─── Ένα πέρασμα, και τα δύο ───────────────────────────────────────────────────

it('όριο και ασυνέχεια στο ΙΔΙΟ πέρασμα — ένας μηχανισμός για δύο ρόλους', () => {
  setTopoPoints(SURVEY);
  setTopoBoundary({ vertices: SQUARE, sourceEntityId: BOUNDARY_ID });
  addBreakline([{ x: 0, y: 0, z: M }, { x: 5 * M, y: 5 * M, z: M }], false, BREAKLINE_ID);
  const movedLine = [{ x: 1 * M, y: 1 * M }, { x: 6 * M, y: 6 * M }];

  cascadeTopoSourceGeometry(
    [BOUNDARY_ID, BREAKLINE_ID],
    sceneWith(
      polyline(BOUNDARY_ID, SQUARE_DRAGGED, true),
      polyline(BREAKLINE_ID, movedLine, false),
    ),
  );

  expect(getTopoBoundary()?.vertices).toEqual(SQUARE_DRAGGED);
  expect(getTopoBreaklines()[0]!.vertices.map((v) => ({ x: v.x, y: v.y }))).toEqual(movedLine);
});
