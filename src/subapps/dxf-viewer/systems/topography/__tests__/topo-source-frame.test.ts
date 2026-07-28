/**
 * ADR-718 §Α — **η εισερχόμενη πύλη πλαισίου**: ό,τι μπαίνει στο τοπογραφικό υποσύστημα από
 * οντότητα του σχεδίου φτάνει σε **WORLD**, όχι σε DISPLAY.
 *
 * ── Γιατί υπάρχει ΑΥΤΟ το αρχείο και όχι μια ακόμη περίπτωση στα υπάρχοντα ──────────────────
 * Το blocker πέρασε από **54 suites / 489 tests** για έναν μόνο λόγο: **όλα έτρεχαν σε ΕΝΑ
 * πλαίσιο**. Με ταυτοτική γεωαναφορά DISPLAY ≡ WORLD, οπότε μια απούσα μετατροπή είναι
 * κυριολεκτικά αόρατη — κάθε assertion βγαίνει σωστό. Το σφάλμα δεν ήταν «δεν το σκεφτήκαμε»·
 * ήταν ότι **δεν υπήρχε test που να μπορεί να το δει**.
 *
 * Άρα ο κανόνας αυτού του αρχείου: **κάθε test εδώ τρέχει με ΜΗ-ταυτοτική γεωαναφορά**, σε
 * μεγέθη ΕΓΣΑ'87 (~4·10⁸ mm), όπου η παράλειψη δεν δίνει «λίγο λάθος» αλλά **κενό**. Και όπου
 * η μετάθεση από μόνη της θα μπορούσε να κρύψει σφάλμα πρόσημου, δοκιμάζεται και **στροφή**.
 *
 * ⚠️ Μην «απλοποιήσεις» τις συντεταγμένες σε μικρούς αριθμούς για ευανάγνωστα assertions. Το
 * μέγεθος **ΕΙΝΑΙ** το test: σε τοπικές συντεταγμένες αυτό το αρχείο ξαναγίνεται πράσινο με
 * σπασμένο κώδικα, δηλαδή ξαναγίνεται σχόλιο.
 *
 * @see ../topo-boundary-pick · ../topo-breakline-pick — οι δύο builders (η πύλη)
 * @see ../topo-source-cascade — `cascadeTopoSourceFrame` (η αλλαγή πλαισίου)
 * @see ../topo-display-frame — `unprojectDisplayPoints` (η ΜΙΑ μετατροπή)
 */

import { buildBoundaryFromEntity } from '../topo-boundary-pick';
import { buildBreaklineFromEntity } from '../topo-breakline-pick';
import { getTopoDisplayProjector } from '../topo-display-frame';
import { cascadeTopoSourceFrame, cascadeTopoSourceGeometry } from '../topo-source-cascade';
import { getTopoSurface, getTopoSurfaceFull, invalidateTopoSurface } from '../topo-surface';
import {
  clearTopo, getTopoBoundary, getTopoBoundaryLink,
  setTopoBoundary, setTopoCrop, setTopoPoints,
} from '../TopoPointStore';
import { setGeoReference } from '../../geo-referencing/geo-reference-store';
import { localToWorld, type GeoReference } from '../../geo-referencing/geo-transform';
import type { Point2D } from '../../../rendering/types/Types';
import type { Entity } from '../../../types/entities';
import type { ISceneManager } from '../../../core/commands/interfaces';
import type { TopoPoint } from '../topo-types';

const M = 1000;
const BOUNDARY_ID = 'ent-boundary';
const BREAKLINE_ID = 'ent-breakline';

/**
 * Πραγματική γεωαναφορά ΕΓΣΑ'87 — τα νούμερα του εργοταξίου του §Α.3 (Εύοσμος, origin
 * `407565.29, 4502055.67 m`). Καθαρή μετάθεση: η συνήθης περίπτωση («ο χρήστης έδειξε ένα
 * κοινό σημείο»).
 */
const EGSA_TRANSLATION: GeoReference = {
  originWorld: { x: 407565290, y: 4502055670 },
  rotationDeg: 0,
};

/** Το ίδιο, στραμμένο — ώστε ένα σφάλμα προσήμου στη στροφή να μην περνά ως «σωστή μετάθεση». */
const EGSA_ROTATED: GeoReference = { ...EGSA_TRANSLATION, rotationDeg: 31.7 };

// ─── Το σκηνικό: σχέδιο σε DISPLAY, αποτύπωση σε WORLD ─────────────────────────

/** Η σχάρα της αποτύπωσης **όπως θα φαινόταν στο χαρτί**: 20 m × 20 m, 36 σημεία. */
function displayGrid(): Point2D[] {
  const pts: Point2D[] = [];
  for (let gx = 0; gx <= 5; gx++) {
    for (let gy = 0; gy <= 5; gy++) pts.push({ x: gx * 4 * M, y: gy * 4 * M });
  }
  return pts;
}

/**
 * Τα ΙΔΙΑ σημεία σε **WORLD** — δηλαδή ό,τι κρατά πραγματικά το `TopoPointStore` όταν το έργο
 * είναι γεωαναφερμένο. Παράγονται με το SSoT `localToWorld`, ώστε η γεωμετρική σχέση
 * «αποτύπωση ↔ σχέδιο» να είναι εξ ορισμού σωστή και το test να μετρά **μόνο** τη μετατροπή
 * που ελέγχει.
 */
function surveyPointsFor(geo: GeoReference): TopoPoint[] {
  return displayGrid().map((p, i) => {
    const w = localToWorld(p, geo);
    return { x: w.x, y: w.y, z: 1 * M + (i % 6) * 100 };
  });
}

/** Το «οικόπεδο» όπως το σχεδίασε ο αρχιτέκτονας: το ΑΡΙΣΤΕΡΟ μισό, σε DISPLAY. */
const HALF_PLOT_DISPLAY: Point2D[] = [
  { x: 0, y: 0 },
  { x: 10 * M, y: 0 },
  { x: 10 * M, y: 20 * M },
  { x: 0, y: 20 * M },
];

function polyline(id: string, vertices: readonly Point2D[], closed: boolean): Entity {
  return {
    id,
    type: 'polyline',
    layerId: 'lyr_test',
    vertices: vertices.map((v) => ({ ...v })),
    closed,
  } as unknown as Entity;
}

function sceneWith(...entities: readonly Entity[]): Pick<ISceneManager, 'getEntity'> {
  const byId = new Map(entities.map((e) => [e.id, e]));
  return { getEntity: (id: string) => byId.get(id) as never };
}

/** Το εμβαδόν κάτοψης της **τρέχουσας** (κομμένης) επιφάνειας, σε m². */
function croppedAreaM2(): number {
  const s = getTopoSurface();
  let total = 0;
  for (const [i, j, k] of s.triangles) {
    const [ax, ay] = s.positions[i]!;
    const [bx, by] = s.positions[j]!;
    const [cx, cy] = s.positions[k]!;
    total += Math.abs((bx - ax) * (cy - ay) - (cx - ax) * (by - ay)) / 2;
  }
  return total / (M * M);
}

/** Στήνει «γεωαναφερμένο έργο με αποτύπωση», όπως κάθε αληθινό τοπογραφικό. */
function givenGeoReferencedSurvey(geo: GeoReference): void {
  setGeoReference(geo);
  setTopoPoints(surveyPointsFor(geo));
  invalidateTopoSurface();
}

/** Επιλέγει το όριο από την πολυγραμμή του σχεδίου — ακριβώς ό,τι κάνει το εργαλείο. */
function pickBoundary(entity: Entity): void {
  const boundary = buildBoundaryFromEntity(entity, getTopoDisplayProjector());
  expect(boundary).not.toBeNull();
  setTopoBoundary(boundary);
}

beforeEach(() => {
  clearTopo();
  invalidateTopoSurface();
  setGeoReference(null);
});

afterEach(() => {
  // Το geo store είναι module-level: αν μείνει λερωμένο, μολύνει κάθε επόμενο suite του worker.
  setGeoReference(null);
  clearTopo();
  invalidateTopoSurface();
});

// ─── ΤΟ ΚΥΡΙΟ ΑΓΚΙΣΤΡΟ ─────────────────────────────────────────────────────────

describe('🔴 blocker §Α — η κοπή σε ΓΕΩΑΝΑΦΕΡΜΕΝΟ έργο', () => {
  it.each([
    ['καθαρή μετάθεση', EGSA_TRANSLATION],
    ['μετάθεση + στροφή', EGSA_ROTATED],
  ])('%s: η κοπή ΚΟΒΕΙ — δεν εξαφανίζει το ανάγλυφο', (_label, geo) => {
    givenGeoReferencedSurvey(geo);
    pickBoundary(polyline(BOUNDARY_ID, HALF_PLOT_DISPLAY, true));
    setTopoCrop({ enabled: true });

    // Η ΜΙΑ πρόταση που έλειπε: με τον δακτύλιο σε λάθος πλαίσιο η τομή είναι κενή και ΟΛΑ
    // τα assertions εμβαδού από κάτω θα ήταν κενά-vs-κενά, δηλαδή αόρατα.
    expect(getTopoSurface().triangles.length).toBeGreaterThan(0);
    expect(croppedAreaM2()).toBeCloseTo(200, 6);
  });

  it('η κοπή είναι ΓΝΗΣΙΟ υποσύνολο — δεν «κόβει» ολόκληρη την αποτύπωση κατά λάθος', () => {
    givenGeoReferencedSurvey(EGSA_TRANSLATION);
    pickBoundary(polyline(BOUNDARY_ID, HALF_PLOT_DISPLAY, true));
    setTopoCrop({ enabled: true });

    expect(croppedAreaM2()).toBeCloseTo(200, 6);
    expect(getTopoSurfaceFull().triangles.length).toBeGreaterThan(
      getTopoSurface().triangles.length,
    );
  });

  it('ο δακτύλιος γεννιέται σε WORLD — μεγέθη ΕΓΣΑ, όχι σχεδίου', () => {
    setGeoReference(EGSA_TRANSLATION);
    const boundary = buildBoundaryFromEntity(
      polyline(BOUNDARY_ID, HALF_PLOT_DISPLAY, true),
      getTopoDisplayProjector(),
    );

    expect(boundary!.vertices[0]).toEqual({
      x: EGSA_TRANSLATION.originWorld.x,
      y: EGSA_TRANSLATION.originWorld.y,
    });
    // Αν έλειπε το unproject, αυτή η κορυφή θα ήταν το σκέτο (0,0) του σχεδίου.
    expect(boundary!.vertices[0]!.x).toBeGreaterThan(1e8);
  });
});

// ─── Οπισθοδρομική συμβατότητα ─────────────────────────────────────────────────

describe('μη-γεωαναφερμένο έργο — ΜΗΔΕΝ αλλαγή συμπεριφοράς', () => {
  it('ταυτοτικό πλαίσιο: ο δακτύλιος είναι οι κορυφές της οντότητας, αυτούσιες', () => {
    const entity = polyline(BOUNDARY_ID, HALF_PLOT_DISPLAY, true);
    const boundary = buildBoundaryFromEntity(entity, getTopoDisplayProjector());

    expect(boundary!.vertices).toEqual(HALF_PLOT_DISPLAY);
  });

  it('ο δακτύλιος δεν μοιράζεται αναφορές με τη σκηνή (η οντότητα μεταλλάσσεται από αλλού)', () => {
    const vertices = HALF_PLOT_DISPLAY.map((v) => ({ ...v }));
    const boundary = buildBoundaryFromEntity(polyline(BOUNDARY_ID, vertices, true), null);

    expect(boundary!.vertices[0]).not.toBe(vertices[0]);
  });

  it('η κοπή δίνει το ίδιο εμβαδόν με το γεωαναφερμένο σκηνικό (η κοπή είναι αναλλοίωτη)', () => {
    setTopoPoints(displayGrid().map((p, i) => ({ ...p, z: 1 * M + (i % 6) * 100 })));
    pickBoundary(polyline(BOUNDARY_ID, HALF_PLOT_DISPLAY, true));
    setTopoCrop({ enabled: true });

    expect(croppedAreaM2()).toBeCloseTo(200, 6);
  });
});

// ─── Ο δίδυμος: ασυνέχειες ─────────────────────────────────────────────────────

describe('ασυνέχειες — το ΣΙΩΠΗΛΟ μισό του ίδιου σφάλματος', () => {
  it('proximity: κάθε κορυφή παίρνει το z του ΓΕΩΜΕΤΡΙΚΑ πλησιέστερου σημείου', () => {
    const geo = EGSA_TRANSLATION;
    setGeoReference(geo);
    // Δύο μετρημένα σημεία στις δύο άκρες, με ΞΕΚΑΘΑΡΑ διαφορετικά υψόμετρα.
    const points: TopoPoint[] = [
      { ...localToWorld({ x: 0, y: 0 }, geo), z: 1 * M },
      { ...localToWorld({ x: 20 * M, y: 20 * M }, geo), z: 9 * M },
    ];

    const built = buildBreaklineFromEntity(
      polyline(BREAKLINE_ID, [{ x: 0, y: 0 }, { x: 20 * M, y: 20 * M }], false),
      points,
      getTopoDisplayProjector(),
    );

    // Χωρίς unproject, ΟΛΕΣ οι κορυφές συγκρίνονταν με ~4·10⁸ και έπαιρναν το ΙΔΙΟ z:
    // μια ασυνέχεια που φαίνεται σωστή και παραμορφώνει σιωπηλά την τριγωνοποίηση.
    expect(built!.vertices[0]!.z).toBe(1 * M);
    expect(built!.vertices[1]!.z).toBe(9 * M);
  });

  it('οι κορυφές της ασυνέχειας φτάνουν σε WORLD, όπως τα σημεία δίπλα στα οποία ζουν', () => {
    const geo = EGSA_ROTATED;
    setGeoReference(geo);
    const points: TopoPoint[] = [{ ...localToWorld({ x: 0, y: 0 }, geo), z: 1 * M }];

    const built = buildBreaklineFromEntity(
      polyline(BREAKLINE_ID, [{ x: 0, y: 0 }, { x: 4 * M, y: 0 }], false),
      points,
      getTopoDisplayProjector(),
    );

    const expected = localToWorld({ x: 4 * M, y: 0 }, geo);
    expect(built!.vertices[1]!.x).toBeCloseTo(expected.x, 6);
    expect(built!.vertices[1]!.y).toBeCloseTo(expected.y, 6);
  });

  it('standard (lwpolyline.elevation): το Z περνά ΑΥΤΟΥΣΙΟ — ο rigid είναι επίπεδος', () => {
    setGeoReference(EGSA_ROTATED);
    const entity = {
      id: BREAKLINE_ID, type: 'lwpolyline', layerId: 'lyr_test', elevation: 42.5,
      vertices: [{ x: 0, y: 0 }, { x: 4 * M, y: 0 }], closed: false,
    } as unknown as Entity;

    const built = buildBreaklineFromEntity(entity, [], getTopoDisplayProjector());

    expect(built!.vertices.every((v) => v.z === 42.5)).toBe(true);
  });
});

// ─── Η ΔΕΥΤΕΡΗ αιτία: αλλάζει το πλαίσιο, όχι η οντότητα ───────────────────────

describe('cascadeTopoSourceFrame — ο δακτύλιος ακολουθεί την ΑΛΛΑΓΗ ΠΛΑΙΣΙΟΥ', () => {
  const entity = () => polyline(BOUNDARY_ID, HALF_PLOT_DISPLAY, true);

  it('νέα γεωαναφορά ⇒ ο δακτύλιος ξανα-παράγεται στο ΝΕΟ WORLD', () => {
    givenGeoReferencedSurvey(EGSA_TRANSLATION);
    pickBoundary(entity());
    expect(getTopoBoundary()!.vertices[0]!.x).toBeCloseTo(EGSA_TRANSLATION.originWorld.x, 6);

    const moved: GeoReference = { originWorld: { x: 500000000, y: 4000000000 }, rotationDeg: 0 };
    setGeoReference(moved);
    cascadeTopoSourceFrame(sceneWith(entity()));

    expect(getTopoBoundary()!.vertices[0]!.x).toBeCloseTo(moved.originWorld.x, 6);
    expect(getTopoBoundaryLink()).toBe('live');
  });

  it('«Καθαρισμός γεωαναφοράς» ⇒ ο δακτύλιος επιστρέφει στις κορυφές του σχεδίου', () => {
    givenGeoReferencedSurvey(EGSA_ROTATED);
    pickBoundary(entity());

    setGeoReference(null);
    cascadeTopoSourceFrame(sceneWith(entity()));

    expect(getTopoBoundary()!.vertices).toEqual(HALF_PLOT_DISPLAY);
  });

  it('ΙΔΙΟ πλαίσιο ⇒ ΚΑΜΙΑ εγγραφή: το ίδιο αντικείμενο (αλλιώς ξαναχτίζονται ισοϋψείς)', () => {
    givenGeoReferencedSurvey(EGSA_TRANSLATION);
    pickBoundary(entity());
    const before = getTopoBoundary();

    cascadeTopoSourceFrame(sceneWith(entity()));
    cascadeTopoSourceFrame(sceneWith(entity()));

    expect(getTopoBoundary()).toBe(before);
  });

  it('χαμένη πηγή + αλλαγή πλαισίου ⇒ fail-closed: κρατά το σχήμα ΚΑΙ το λέει', () => {
    givenGeoReferencedSurvey(EGSA_TRANSLATION);
    pickBoundary(entity());
    const frozen = getTopoBoundary()!.vertices;

    setGeoReference({ originWorld: { x: 1, y: 2 }, rotationDeg: 0 });
    cascadeTopoSourceFrame(sceneWith()); // η πολυγραμμή διαγράφηκε

    expect(getTopoBoundary()!.vertices).toEqual(frozen);
    expect(getTopoBoundaryLink()).toBe('missing');
  });

  it('ΤΟ MIGRATION: παλιό έγγραφο με δακτύλιο σε DISPLAY γιατρεύεται στη ΦΟΡΤΩΣΗ', () => {
    // Ακριβώς ό,τι έχει αποθηκευτεί πριν από αυτή τη διόρθωση: κορυφές σχεδίου, δηλωμένες WORLD.
    givenGeoReferencedSurvey(EGSA_TRANSLATION);
    setTopoBoundary({ vertices: HALF_PLOT_DISPLAY, sourceEntityId: BOUNDARY_ID });
    setTopoCrop({ enabled: true });
    expect(getTopoSurface().triangles).toHaveLength(0); // το σύμπτωμα του §Α.1

    // `reconcileTopoFrame` τρέχει στη φόρτωση και περνά από εδώ — καμία ενέργεια χρήστη.
    cascadeTopoSourceFrame(sceneWith(entity()));

    expect(getTopoSurface().triangles.length).toBeGreaterThan(0);
    expect(croppedAreaM2()).toBeCloseTo(200, 6);
  });
});

// ─── Η πρώτη αιτία εξακολουθεί να ισχύει, ΚΑΙ σε γεωαναφορά ───────────────────

describe('cascadeTopoSourceGeometry — το σύρσιμο λαβής, σε γεωαναφερμένο έργο', () => {
  it('η μετακινημένη κορυφή γράφεται σε WORLD, όχι σε DISPLAY (η σιωπηλή παλινδρόμηση §Α.4)', () => {
    const geo = EGSA_TRANSLATION;
    givenGeoReferencedSurvey(geo);
    pickBoundary(polyline(BOUNDARY_ID, HALF_PLOT_DISPLAY, true));

    const dragged = [...HALF_PLOT_DISPLAY.slice(0, 1), { x: 14 * M, y: 0 }, ...HALF_PLOT_DISPLAY.slice(2)];
    cascadeTopoSourceGeometry([BOUNDARY_ID], sceneWith(polyline(BOUNDARY_ID, dragged, true)));

    const expected = localToWorld({ x: 14 * M, y: 0 }, geo);
    expect(getTopoBoundary()!.vertices[1]!.x).toBeCloseTo(expected.x, 6);
    expect(getTopoBoundary()!.vertices[1]!.x).toBeGreaterThan(1e8);
  });
});
