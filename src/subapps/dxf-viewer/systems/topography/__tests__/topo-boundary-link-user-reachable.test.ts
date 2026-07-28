/**
 * ADR-718 §Β — η κατάσταση δεσμού `'invalid'` έχει επιτέλους **διαδρομή που τη γεννά**.
 *
 * ── Γιατί υπάρχει αυτό το αρχείο ────────────────────────────────────────────────────────────
 * Ο τύπος `TopoBoundaryLink` δηλώνει `'invalid'` με το σχόλιο «ο χρήστης άνοιξε την πολυγραμμή».
 * Μέχρι το §Β **δεν υπήρχε κουμπί που να την ανοίγει**: οι τρεις καθαρές συναρτήσεις
 * (`closePolyline` / `openPolyline` / `openPolylineAtEdge`) ήταν νεκρές, και το μόνο test που
 * έφτανε το `'invalid'` το πετύχαινε ρίχνοντας τις κορυφές κάτω από τρεις — μια κατάσταση που
 * ΚΑΜΙΑ χειρονομία δεν παράγει. **Κατάσταση χωρίς διαδρομή που την παράγει είναι σχόλιο, όχι
 * συμπεριφορά** (ADR-587 §6.1). Εδώ η διαδρομή είναι η **πραγματική εντολή του μενού**.
 *
 * ── Γιατί ΓΕΩΑΝΑΦΕΡΜΕΝΟ (ο κανόνας του §Α) ──────────────────────────────────────────────────
 * Το blocker του §Α πέρασε από 489 tests επειδή **όλα** έτρεχαν σε ένα πλαίσιο. Ο κανόνας που
 * γεννήθηκε: κάθε νέο test πάνω σε γεωμετρία που ταξιδεύει σχέδιο↔αποτύπωση τρέχει με
 * **μη-ταυτοτική** γεωαναφορά, σε μεγέθη ΕΓΣΑ. Χρησιμοποιούνται τα **έτοιμα** fixtures του
 * `topo-source-frame.test.ts` — δεν φτιάχνονται τρίτα.
 *
 * ── Τι ΔΕΝ ελέγχει ──────────────────────────────────────────────────────────────────────────
 * Τη σημασιολογία της εντολής (τόξα, αναδιάταξη, undo) — αυτή ζει στο
 * `core/commands/entity-commands/__tests__/SetPolylineClosureCommand.test.ts`. Εδώ ελέγχεται
 * **ο δεσμός**: τι βλέπει ο χρήστης του τοπογραφικού όταν πειράξει την πηγή του ορίου.
 *
 * @see ../../polyline/polyline-closure-ops — ο shared builder (και οι δύο χειρονομίες)
 * @see ../topo-source-cascade — ο reconciler που γράφει την υγεία του δεσμού
 * @see ../topo-types — `TopoBoundaryLink` (`live` | `invalid` | `missing`)
 */

import { buildPolylineClosureCommand } from '../../polyline/polyline-closure-ops';
import { buildBoundaryFromEntity } from '../topo-boundary-pick';
import { getTopoDisplayProjector } from '../topo-display-frame';
import { getTopoSurface, invalidateTopoSurface } from '../topo-surface';
import {
  clearTopo, getTopoBoundary, getTopoBoundaryLink,
  setTopoBoundary, setTopoCrop, setTopoPoints,
} from '../TopoPointStore';
import { setGeoReference } from '../../geo-referencing/geo-reference-store';
import { localToWorld, type GeoReference } from '../../geo-referencing/geo-transform';
import { createMockSceneManager, type MockSceneManager } from '../../../core/commands/__tests__/mock-scene-manager';
import type { Point2D } from '../../../rendering/types/Types';
import type { Entity } from '../../../types/entities';
import type { SceneEntity } from '../../../core/commands/interfaces';
import type { TopoPoint } from '../topo-types';

const M = 1000;
const BOUNDARY_ID = 'ent-boundary';

/** Η ΙΔΙΑ γεωαναφορά ΕΓΣΑ'87 του §Α (Εύοσμος) — καθαρή μετάθεση. */
const EGSA_TRANSLATION: GeoReference = {
  originWorld: { x: 407565290, y: 4502055670 },
  rotationDeg: 0,
};

/** Το ίδιο, στραμμένο — ώστε σφάλμα προσήμου να μην περνά ως «σωστή μετάθεση». */
const EGSA_ROTATED: GeoReference = { ...EGSA_TRANSLATION, rotationDeg: 31.7 };

/** Η σχάρα της αποτύπωσης όπως θα φαινόταν στο χαρτί: 20 m × 20 m. */
function displayGrid(): Point2D[] {
  const pts: Point2D[] = [];
  for (let gx = 0; gx <= 5; gx++) {
    for (let gy = 0; gy <= 5; gy++) pts.push({ x: gx * 4 * M, y: gy * 4 * M });
  }
  return pts;
}

/** Τα ίδια σημεία σε WORLD — ό,τι κρατά πραγματικά το store σε γεωαναφερμένο έργο. */
function surveyPointsFor(geo: GeoReference): TopoPoint[] {
  return displayGrid().map((p, i) => {
    const w = localToWorld(p, geo);
    return { x: w.x, y: w.y, z: 1 * M + (i % 6) * 100 };
  });
}

/** Το «οικόπεδο» του αρχιτέκτονα: το αριστερό μισό, σε DISPLAY. */
const HALF_PLOT_DISPLAY: Point2D[] = [
  { x: 0, y: 0 },
  { x: 10 * M, y: 0 },
  { x: 10 * M, y: 20 * M },
  { x: 0, y: 20 * M },
];

function boundaryPolyline(closed = true): SceneEntity {
  return {
    id: BOUNDARY_ID,
    type: 'polyline',
    layerId: 'lyr_test',
    vertices: HALF_PLOT_DISPLAY.map((v) => ({ ...v })),
    closed,
  } as unknown as SceneEntity;
}

/** Στήνει γεωαναφερμένο έργο με αποτύπωση, όριο από την πολυγραμμή και κοπή ΟΝ. */
function givenCroppedGeoReferencedSite(geo: GeoReference): MockSceneManager {
  setGeoReference(geo);
  setTopoPoints(surveyPointsFor(geo));
  invalidateTopoSurface();

  const sm = createMockSceneManager([boundaryPolyline()]);
  const boundary = buildBoundaryFromEntity(
    sm.store.get(BOUNDARY_ID) as unknown as Entity,
    getTopoDisplayProjector(),
  );
  expect(boundary).not.toBeNull();
  setTopoBoundary(boundary);
  setTopoCrop({ enabled: true });
  return sm;
}

/** Η χειρονομία του χρήστη, ακριβώς όπως τη στέλνει το μενού. */
function userRuns(
  sm: MockSceneManager,
  op: Parameters<typeof buildPolylineClosureCommand>[1],
): { undo: () => void } {
  const cmd = buildPolylineClosureCommand(BOUNDARY_ID, op, sm);
  expect(cmd).not.toBeNull();
  cmd!.execute();
  return { undo: () => cmd!.undo() };
}

beforeEach(() => {
  clearTopo();
  invalidateTopoSurface();
  setGeoReference(null);
});

afterEach(() => {
  setGeoReference(null);
  clearTopo();
  invalidateTopoSurface();
});

describe('§Β — «Άνοιγμα πολυγραμμής» σπάει τον δεσμό ορίου, και το ΛΕΕΙ', () => {
  it.each([
    ['καθαρή μετάθεση', EGSA_TRANSLATION],
    ['μετάθεση + στροφή', EGSA_ROTATED],
  ])('%s: πριν την εντολή ο δεσμός είναι ζωντανός και η κοπή κόβει', (_label, geo) => {
    givenCroppedGeoReferencedSite(geo);

    expect(getTopoBoundaryLink()).toBe('live');
    expect(getTopoSurface().triangles.length).toBeGreaterThan(0);
  });

  it('«Άνοιγμα πολυγραμμής» ⇒ ο δεσμός γίνεται `invalid` — η κατάσταση είναι επιτέλους προσιτή', () => {
    const sm = givenCroppedGeoReferencedSite(EGSA_TRANSLATION);

    userRuns(sm, { kind: 'open' });

    expect(getTopoBoundaryLink()).toBe('invalid');
  });

  it('«Άνοιγμα εδώ» (λαβή ακμής) φτάνει την ΙΔΙΑ κατάσταση — μία εντολή, δύο χειρονομίες', () => {
    const sm = givenCroppedGeoReferencedSite(EGSA_ROTATED);

    userRuns(sm, { kind: 'open-at-edge', edgeIndex: 1 });

    expect(getTopoBoundaryLink()).toBe('invalid');
  });

  it('ο δακτύλιος ΔΙΑΤΗΡΕΙΤΑΙ — η κοπή δεν εξαφανίζεται σιωπηλά (Civil 3D parity)', () => {
    const sm = givenCroppedGeoReferencedSite(EGSA_TRANSLATION);
    const ringBefore = getTopoBoundary()!.vertices;

    userRuns(sm, { kind: 'open' });

    // Σιωπηλό ξε-κόψιμο θα μεγάλωνε την επιφάνεια → θα άλλαζαν οι όγκοι εκσκαφής, δηλαδή μια ΤΙΜΗ.
    expect(getTopoBoundary()!.vertices).toEqual(ringBefore);
    expect(getTopoSurface().triangles.length).toBeGreaterThan(0);
  });

  it('η αναίρεση ξαναφέρνει τον δεσμό σε `live` ΜΟΝΗ ΤΗΣ — καμία διαδρομή «re-link»', () => {
    const sm = givenCroppedGeoReferencedSite(EGSA_TRANSLATION);
    const { undo } = userRuns(sm, { kind: 'open' });
    expect(getTopoBoundaryLink()).toBe('invalid');

    undo();

    expect(getTopoBoundaryLink()).toBe('live');
  });

  it('το ξανακλείσιμο θεραπεύει τον δεσμό — συμμετρικά, χωρίς ειδική διαδρομή', () => {
    const sm = givenCroppedGeoReferencedSite(EGSA_TRANSLATION);
    userRuns(sm, { kind: 'open' });
    expect(getTopoBoundaryLink()).toBe('invalid');

    userRuns(sm, { kind: 'close' });

    expect(getTopoBoundaryLink()).toBe('live');
  });

  it('ο δακτύλιος μένει σε WORLD μετά τη θεραπεία — το ξανακλείσιμο ΔΕΝ ξαναγράφει DISPLAY (§Α)', () => {
    const sm = givenCroppedGeoReferencedSite(EGSA_TRANSLATION);
    userRuns(sm, { kind: 'open' });

    userRuns(sm, { kind: 'close' });

    // Χωρίς την πύλη του §Α στον reconciler, εδώ θα ξαναγραφόταν το σκέτο (0,0) του σχεδίου.
    expect(getTopoBoundary()!.vertices[0]).toEqual(EGSA_TRANSLATION.originWorld);
  });
});
