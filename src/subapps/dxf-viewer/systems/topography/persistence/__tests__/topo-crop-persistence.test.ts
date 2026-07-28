/**
 * ADR-718 — CAPABILITY ANCHOR: **η κοπή είναι απόφαση του χρήστη, και μόνο του χρήστη.**
 *
 * Η κοπή στο όριο δεν είναι ρύθμιση εμφάνισης: μικραίνει την επιφάνεια, άρα αλλάζει τους όγκους
 * εκσκαφής, άρα αλλάζει **τιμή**. Γι' αυτό δύο πράγματα πρέπει να είναι εξίσου αδύνατα:
 *
 *   1. **να χαθεί** — ο χρήστης την ανάβει, το έργο αποθηκεύεται, και στο άνοιγμα η επιφάνεια
 *      ξυπνά ακομμάτιαστη· ο μηχανικός τιμολογεί όγκους που δεν είδε ποτέ στην οθόνη·
 *   2. **να αποκτηθεί σιωπηλά** — ένα έργο αποθηκευμένο ΠΡΙΝ το χαρακτηριστικό ξυπνά κομμένο,
 *      επειδή η κοπή του προηγούμενου έργου έμεινε στα stores ή επειδή το `undefined` διαβάστηκε
 *      ως «ναι».
 *
 * Και οι δύο αστοχίες είναι **σιωπηλές**: κανένα σφάλμα, καμία προειδοποίηση, απλώς άλλος
 * αριθμός στην αναφορά. Το μόνο όργανο που τις βλέπει είναι αυτό το αρχείο.
 *
 * ⚠️ Ο έλεγχος της **υπογραφής** δεν είναι λεπτομέρεια υλοποίησης. Η `topoStateSignature` είναι
 * το κριτήριο του debounced save («άλλαξε κάτι;») ΚΑΙ του anti-echo guard («δικό μας ήταν;»).
 * Πεδίο που λείπει από εκείνη δεν αποθηκεύεται και δεν φορτώνεται ΠΟΤΕ — χωρίς να σκάσει τίποτα.
 * Το `crop` έλειπε ακριβώς έτσι όταν γράφτηκε αυτό το αρχείο (βλ. changelog ADR-718).
 *
 * @see ../topo-persistence-types.ts — υπογραφή + (de)serialization
 * @see ../topo-state-io.ts — collect/apply πάνω στα stores
 * @see ../../__tests__/topo-surface-crop.test.ts — η ΓΕΩΜΕΤΡΙΑ της κοπής (άλλο ερώτημα)
 */

import {
  docToTopoState,
  topoSettingsDocFields,
  topoStateSignature,
  type TopoPersistedState,
  type TopoSurfaceDoc,
} from '../topo-persistence-types';
import { collectTopoState, applyTopoState } from '../topo-state-io';
import {
  clearTopo, getActiveCropRing, getTopoBoundary, getTopoCrop,
  setTopoBoundary, setTopoCrop, setTopoPoints,
} from '../../TopoPointStore';
import { getTopoSurface, getTopoSurfaceFull, invalidateTopoSurface } from '../../topo-surface';
import { TOPO_CROP_OFF } from '../../topo-types';
import type { Point2D } from '../../../../rendering/types/Types';
import type { TopoPoint } from '../../topo-types';

const M = 1000;

/** Επίπεδη σχάρα 20 m × 20 m — αρκετά τρίγωνα ώστε η κοπή να έχει τι να κόψει. */
function surveyPoints(): TopoPoint[] {
  const pts: TopoPoint[] = [];
  for (let gx = 0; gx <= 5; gx++) {
    for (let gy = 0; gy <= 5; gy++) {
      pts.push({ x: gx * 4 * M, y: gy * 4 * M, z: 1 * M + gx * 100 });
    }
  }
  return pts;
}

/** Το αριστερό μισό της αποτύπωσης — κόβει 400 m² σε 200 m². */
const HALF: Point2D[] = [
  { x: 0, y: 0 },
  { x: 10 * M, y: 0 },
  { x: 10 * M, y: 20 * M },
  { x: 0, y: 20 * M },
];

/** Εμβαδόν κάτοψης της επιφάνειας που βλέπουν ΟΛΟΙ οι καταναλωτές, σε m². */
function planAreaM2(surface = getTopoSurface()): number {
  let total = 0;
  for (const [i, j, k] of surface.triangles) {
    const [ax, ay] = surface.positions[i]!;
    const [bx, by] = surface.positions[j]!;
    const [cx, cy] = surface.positions[k]!;
    total += Math.abs((bx - ax) * (cy - ay) - (cx - ax) * (by - ay)) / 2;
  }
  return total / (M * M);
}

/**
 * Ό,τι θα έγραφε ο κύκλος αποθήκευσης στο Firestore — τα ΙΔΙΑ πεδία, από την ίδια συνάρτηση
 * (`topoSettingsDocFields`) που χρησιμοποιούν το create ΚΑΙ το update του service. Το mock
 * σταματά στο δίκτυο, όχι πριν από αυτό: αν η σειριοποίηση χάσει την κοπή, ο έλεγχος το βλέπει.
 */
function saveToDoc(state: TopoPersistedState): TopoSurfaceDoc {
  const { surfaces } = state;
  return {
    id: 'topo_anchor', companyId: 'c', projectId: 'p', floorplanId: 'f',
    surfaces,
    ...topoSettingsDocFields(state),
    version: 1,
  } as unknown as TopoSurfaceDoc;
}

/** Κλείσιμο και ξανά-άνοιγμα του έργου: τα stores αδειάζουν, το έγγραφο ξαναδιαβάζεται. */
function reopen(doc: TopoSurfaceDoc): void {
  clearTopo();
  invalidateTopoSurface();
  applyTopoState(docToTopoState(doc));
}

beforeEach(() => {
  clearTopo();
  invalidateTopoSurface();
  setTopoPoints(surveyPoints());
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// 1. Η κοπή ΕΠΙΒΙΩΝΕΙ του save/reload
// ─────────────────────────────────────────────────────────────────────────────────────────────

describe('ADR-718 — η κοπή επιβιώνει save/reload', () => {
  it('πλήρης κύκλος: κομμένη επιφάνεια πριν το κλείσιμο ⇒ κομμένη επιφάνεια μετά το άνοιγμα', () => {
    setTopoBoundary({ vertices: HALF });
    setTopoCrop({ enabled: true });
    expect(planAreaM2()).toBeCloseTo(200, 6);

    reopen(saveToDoc(collectTopoState()));

    expect(getTopoCrop().enabled).toBe(true);
    expect(getActiveCropRing()).not.toBeNull();
    expect(planAreaM2()).toBeCloseTo(200, 6);
  });

  it('το `showOutside` επιβιώνει κι αυτό — δεν είναι εφήμερη προτίμηση της συνεδρίας', () => {
    setTopoBoundary({ vertices: HALF });
    setTopoCrop({ enabled: true, showOutside: true });

    reopen(saveToDoc(collectTopoState()));

    expect(getTopoCrop()).toEqual({ enabled: true, showOutside: true });
  });

  it('η ΜΕΤΡΗΜΕΝΗ επιφάνεια μένει ολόκληρη μετά το reload (η αποτύπωση δεν κόπηκε ποτέ)', () => {
    setTopoBoundary({ vertices: HALF });
    setTopoCrop({ enabled: true });

    reopen(saveToDoc(collectTopoState()));

    expect(planAreaM2(getTopoSurfaceFull())).toBeCloseTo(400, 6);
    expect(planAreaM2(getTopoSurface())).toBeCloseTo(200, 6);
  });

  it('τα ΥΨΟΜΕΤΡΑ δεν αλλοιώνονται από τον κύκλο — η κοπή περιορίζει πεδίο ορισμού, δεν πειράζει το Ζ', () => {
    const before = [...getTopoSurfaceFull().elevations];

    setTopoBoundary({ vertices: HALF });
    setTopoCrop({ enabled: true });
    reopen(saveToDoc(collectTopoState()));

    expect([...getTopoSurfaceFull().elevations]).toEqual(before);
  });

  // ── Η υπογραφή: το κριτήριο που αποφασίζει ΑΝ θα γραφτεί και ΑΝ θα διαβαστεί ────────────────

  it('ΤΟ ΑΝΑΜΜΑ της κοπής αλλάζει την υπογραφή — αλλιώς το debounced save κάνει early-return', () => {
    setTopoBoundary({ vertices: HALF });
    const off = topoStateSignature(collectTopoState());

    setTopoCrop({ enabled: true });
    const on = topoStateSignature(collectTopoState());

    expect(on).not.toBe(off);
  });

  it('ΤΟ ΣΒΗΣΙΜΟ της κοπής αλλάζει επίσης την υπογραφή (αλλιώς δεν ξε-αποθηκεύεται ποτέ)', () => {
    setTopoBoundary({ vertices: HALF });
    setTopoCrop({ enabled: true });
    const on = topoStateSignature(collectTopoState());

    setTopoCrop({ enabled: false });
    expect(topoStateSignature(collectTopoState())).not.toBe(on);
  });

  it('το `showOutside` μόνο του αλλάζει την υπογραφή (δεύτερο πεδίο, ίδιο ρίσκο)', () => {
    setTopoBoundary({ vertices: HALF });
    setTopoCrop({ enabled: true });
    const withoutBackdrop = topoStateSignature(collectTopoState());

    setTopoCrop({ showOutside: true });
    expect(topoStateSignature(collectTopoState())).not.toBe(withoutBackdrop);
  });

  it('ο κύκλος είναι ΚΛΕΙΣΤΟΣ: η υπογραφή μετά το reload ταυτίζεται με αυτή πριν το save', () => {
    setTopoBoundary({ vertices: HALF });
    setTopoCrop({ enabled: true, showOutside: true });
    const saved = collectTopoState();

    reopen(saveToDoc(saved));

    // Ίδια υπογραφή ⇒ το `hydrate` δεν θα ξανα-γράψει, και το save δεν θα δει ψεύτικη αλλαγή:
    // ένα πεδίο που χάνεται στη σειριοποίηση θα εμφανιζόταν εδώ ως διαφορά.
    expect(topoStateSignature(collectTopoState())).toBe(topoStateSignature(saved));
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// 2. Legacy έγγραφο: ΚΑΜΙΑ κοπή, με κανέναν τρόπο
// ─────────────────────────────────────────────────────────────────────────────────────────────

describe('ADR-718 — legacy έγγραφο ΔΕΝ αποκτά κοπή σιωπηλά', () => {
  /** Έγγραφο αποθηκευμένο πριν το ADR-718: το πεδίο `crop` δεν υπήρχε καν στον τύπο. */
  function legacyDoc(boundary: { vertices: Point2D[] } | null): TopoSurfaceDoc {
    return {
      id: 'topo_legacy', companyId: 'c', projectId: 'p', floorplanId: 'f',
      surfaces: { existing: { points: surveyPoints(), breaklines: [] }, proposed: { points: [], breaklines: [] } },
      boundary,
      contourConfig: { intervalMm: 500, majorEvery: 5, baseElevationMm: 0, labelMajors: true, labelDecimals: 2 },
      contourDisplayStyle: 'exact',
      terrain3d: { visible: false, style: 'shaded' },
      cutFill: { mode: 'datum', datumZMm: 0 },
      version: 7,
    } as unknown as TopoSurfaceDoc;
  }

  it('απόν πεδίο `crop` διαβάζεται ως ΚΛΕΙΣΤΗ κοπή, όχι ως «άγνωστο»', () => {
    expect(docToTopoState(legacyDoc(null)).crop).toEqual(TOPO_CROP_OFF);
  });

  it('legacy έγγραφο ΜΕ όριο: το όριο μένει (μετρά όγκους) αλλά ΔΕΝ κόβει την επιφάνεια', () => {
    reopen(legacyDoc({ vertices: HALF }));

    // ADR-650 M6: το όριο περιορίζει τι ΜΕΤΡΙΕΤΑΙ. ADR-718: μόνο ο ρητός διακόπτης το προάγει
    // σε «τι ΕΙΝΑΙ η επιφάνεια». Ένα παλιό έργο έχει το πρώτο και ΠΟΤΕ το δεύτερο.
    expect(getTopoBoundary()).not.toBeNull();
    expect(getActiveCropRing()).toBeNull();
    expect(planAreaM2()).toBeCloseTo(400, 6);
  });

  it('🔴 ΤΟ ΣΟΒΑΡΟ: κοπή ενεργή από ΠΡΟΗΓΟΥΜΕΝΟ έργο δεν κληρονομείται στο legacy που ανοίγει', () => {
    // Έργο Α — ο χρήστης δουλεύει με ενεργή κοπή.
    setTopoBoundary({ vertices: HALF });
    setTopoCrop({ enabled: true, showOutside: true });
    expect(planAreaM2()).toBeCloseTo(200, 6);

    // Έργο Β — παλιό, χωρίς πεδίο `crop`. Ανοίγει στην ΙΔΙΑ συνεδρία.
    reopen(legacyDoc({ vertices: HALF }));

    // Αν η κοπή επιβίωνε εδώ, οι όγκοι εκσκαφής του έργου Β θα ήταν σιωπηλά μικρότεροι —
    // λάθος ΤΙΜΗ σε προσφορά που κανείς δεν θα ήλεγχε ξανά.
    expect(getTopoCrop()).toEqual(TOPO_CROP_OFF);
    expect(getActiveCropRing()).toBeNull();
    expect(planAreaM2()).toBeCloseTo(400, 6);
  });

  it('ΑΡΝΗΤΙΚΟΣ ΜΑΡΤΥΡΑΣ: το ΙΔΙΟ έγγραφο ΜΕ ρητό `crop:enabled` όντως κόβει', () => {
    // Χωρίς αυτό, οι από πάνω έλεγχοι θα περνούσαν και με μια κοπή που δεν λειτουργεί καθόλου.
    setTopoCrop({ enabled: true });
    reopen({ ...legacyDoc({ vertices: HALF }), crop: { enabled: true, showOutside: false } });

    expect(getActiveCropRing()).not.toBeNull();
    expect(planAreaM2()).toBeCloseTo(200, 6);
  });

  it('legacy ΧΩΡΙΣ όριο: ούτε κοπή, ούτε δακτύλιος — τίποτα να μαντέψει', () => {
    setTopoBoundary({ vertices: HALF });
    setTopoCrop({ enabled: true });

    reopen(legacyDoc(null));

    expect(getTopoBoundary()).toBeNull();
    expect(getActiveCropRing()).toBeNull();
    expect(planAreaM2()).toBeCloseTo(400, 6);
  });
});
