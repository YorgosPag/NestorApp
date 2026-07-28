/**
 * ADR-720 — **οι καταναλωτές** του δισδιάστατου σημείου: τι κάνει καθένας όταν λείπει το υψόμετρο.
 *
 * Το δίδυμο του `topo-planimetric-points.test.ts`. Εκεί ελέγχεται ότι το σημείο **μπαίνει** και ότι
 * η επιφάνεια το **αγνοεί**· εδώ ελέγχονται οι έξι θέσεις που διάβαζαν `p.z` σαν να ήταν πάντα
 * αριθμός. Καμία από αυτές δεν θα έσπαγε θορυβωδώς: όλες θα παρήγαγαν `undefined`/`NaN` ή θα
 * χτυπούσαν λάθος σημείο — δηλαδή **λάθος αποτέλεσμα χωρίς μήνυμα**, που είναι το είδος αστοχίας
 * που φτάνει στο τιμολόγιο.
 *
 * ⚠️ Δύο tests εδώ τρέχουν με **μη-ταυτοτική γεωαναφορά σε μεγέθη ΕΓΣΑ'87** (ADR-718 §9): είναι τα
 * μόνα δύο όπου η γεωμετρία ταξιδεύει DISPLAY↔WORLD (επιλογή ασυνέχειας από το σχέδιο, και εύρεση
 * του σημείου κάτω από μια λαβή). Σε ταυτοτικό πλαίσιο ένα σφάλμα μετατροπής είναι **κυριολεκτικά
 * αόρατο**. Τα fixtures είναι τα ίδια νούμερα εργοταξίου με το `topo-source-frame.test.ts` — δεν
 * φτιάχνονται τρίτα.
 *
 * @see ../topo-point-elevation — η SSoT που όλοι τους καλούν
 * @see docs/centralized-systems/reference/adrs/ADR-720-survey-points-without-elevation.md
 */

import { buildBreaklineFromEntity } from '../topo-breakline-pick';
import { getTopoDisplayProjector } from '../topo-display-frame';
import { resolveSurveyPointIndexAt, invalidateTopoSurveyPointIndex } from '../topo-survey-point-resolve';
import { removeElevationSpikes } from '../remove-elevation-spikes';
import { checkDuplicatePoints } from '../qa/check-duplicate-points';
import { buildSurveyPointLabelEntities } from '../topo-point-labels';
import { buildCoordinateTable } from '../deliverables/survey-tables';
import { createTinSampler } from '../tin-sampler';
import { buildTin } from '../tin-builder';
import { getTopoSurface, invalidateTopoSurface } from '../topo-surface';
import { clearTopo, getTopoPoints, setTopoPoints } from '../TopoPointStore';
import { setGeoReference } from '../../geo-referencing/geo-reference-store';
import { localToWorld, type GeoReference } from '../../geo-referencing/geo-transform';
import { DEFAULT_POINT_LABEL_OPTS } from '../topo-point-label-config';
import type { Entity } from '../../../types/entities';
import type { Point2D } from '../../../rendering/types/Types';
import type { TopoPoint } from '../topo-types';

const M = 1000;

/** Ίδια νούμερα εργοταξίου με το ADR-718 suite (Εύοσμος) — καθαρή μετάθεση ΕΓΣΑ'87. */
const EGSA_TRANSLATION: GeoReference = {
  originWorld: { x: 407565290, y: 4502055670 },
  rotationDeg: 0,
};
/** Το ίδιο, στραμμένο: ένα σφάλμα προσήμου στη στροφή δεν περνά ως «σωστή μετάθεση». */
const EGSA_ROTATED: GeoReference = { ...EGSA_TRANSLATION, rotationDeg: 31.7 };

const at = (x: number, y: number, z: number): TopoPoint => ({ x: x * M, y: y * M, z: z * M });
const corner = (x: number, y: number): TopoPoint => ({ x: x * M, y: y * M });

function polyline(id: string, vertices: readonly Point2D[], closed = false): Entity {
  return {
    id, type: 'polyline', layerId: 'lyr_test',
    vertices: vertices.map((v) => ({ ...v })), closed,
  } as unknown as Entity;
}

beforeEach(() => {
  clearTopo();
  invalidateTopoSurface();
  invalidateTopoSurveyPointIndex();
  setGeoReference(null);
});

afterEach(() => {
  // Module-level stores: αν μείνουν λερωμένα μολύνουν κάθε επόμενο suite του ίδιου worker.
  setGeoReference(null);
  clearTopo();
  invalidateTopoSurface();
  invalidateTopoSurveyPointIndex();
});

// ─── 1. Ασυνέχειες: το υψόμετρο δανείζεται ΜΟΝΟ από μετρημένα ──────────────────

describe('buildBreaklineFromEntity — μια ασυνέχεια δεν δανείζεται υψόμετρο από σημείο που δεν έχει', () => {
  it.each([
    ['καθαρή μετάθεση', EGSA_TRANSLATION],
    ['μετάθεση + στροφή', EGSA_ROTATED],
  ])('%s: το πλησιέστερο ΔΙΣΔΙΑΣΤΑΤΟ σημείο αγνοείται υπέρ του πλησιέστερου ΜΕΤΡΗΜΕΝΟΥ', (_label, geo) => {
    setGeoReference(geo);
    const w = (p: Point2D) => localToWorld(p, geo);

    // Η γραμμή περνά ακριβώς πάνω από μια κορυφή οικοπέδου (χωρίς Ζ)· το πλησιέστερο μετρημένο
    // σημείο είναι πιο μακριά. Αυτή είναι η καθημερινή διάταξη ενός τοπογραφικού.
    const cornerW = w({ x: 5 * M, y: 5 * M });
    const shotW = w({ x: 9 * M, y: 5 * M });
    setTopoPoints([
      { x: cornerW.x, y: cornerW.y },
      { x: shotW.x, y: shotW.y, z: 42 * M },
    ]);

    const built = buildBreaklineFromEntity(
      polyline('ent-bl', [{ x: 5 * M, y: 5 * M }, { x: 6 * M, y: 5 * M }]),
      getTopoPoints(),
      getTopoDisplayProjector(),
    );

    expect(built).not.toBeNull();
    expect(built!.source).toBe('proximity');
    // 🔴 Χωρίς το φίλτρο: `bestZ = undefined` → κορυφή ασυνέχειας με NaN → constrained edge που
    // δηλητηριάζει τον CDT. Καμία εξαίρεση, κανένα μήνυμα — απλώς λάθος ανάγλυφο.
    expect(built!.vertices.every((v) => Number.isFinite(v.z))).toBe(true);
    expect(built!.vertices.map((v) => v.z)).toEqual([42 * M, 42 * M]);
  });

  it('αποτύπωση ΜΟΝΟ με δισδιάστατα σημεία → δεν χτίζεται proximity ασυνέχεια (fail-closed)', () => {
    setTopoPoints([corner(0, 0), corner(10, 10)]);
    const built = buildBreaklineFromEntity(
      polyline('ent-bl', [{ x: 1 * M, y: 1 * M }, { x: 2 * M, y: 2 * M }]),
      getTopoPoints(),
      null,
    );
    // Ίδιος κανόνας με το «καθόλου φορτωμένα σημεία»: υψόμετρο που δεν υπάρχει δεν εφευρίσκεται.
    expect(built).toBeNull();
  });

  it('η standard ασυνέχεια (lwpolyline με elevation) δεν χρειάζεται κανένα μετρημένο σημείο', () => {
    setTopoPoints([corner(0, 0)]);
    const lw = {
      id: 'ent-lw', type: 'lwpolyline', layerId: 'lyr_test', elevation: 7 * M,
      vertices: [{ x: 0, y: 0 }, { x: 5 * M, y: 0 }], closed: false,
    } as unknown as Entity;

    const built = buildBreaklineFromEntity(lw, getTopoPoints(), null);
    expect(built!.source).toBe('elevation');
    expect(built!.vertices.map((v) => v.z)).toEqual([7 * M, 7 * M]);
  });
});

// ─── 2. Λαβές: η λαβή επεξεργάζεται το σημείο που ΕΙΝΑΙ ο κόμβος ───────────────

describe('resolveSurveyPointIndexAt — η λαβή δεν πιάνει το δισδιάστατο δίδυμο του κόμβου', () => {
  it.each([
    ['καθαρή μετάθεση', EGSA_TRANSLATION],
    ['μετάθεση + στροφή', EGSA_ROTATED],
  ])('%s: συμπίπτοντα (κορυφή χωρίς Ζ, μετρημένο σημείο) → δείχνει στο ΜΕΤΡΗΜΕΝΟ', (_label, geo) => {
    setGeoReference(geo);
    const w = (x: number, y: number) => localToWorld({ x: x * M, y: y * M }, geo);

    // Η κορυφή του οικοπέδου μπαίνει ΠΡΩΤΗ στον πίνακα — άρα κερδίζει τον κανόνα «ο πρώτος κρατά
    // τη θέση» του ευρετηρίου, εκτός αν το ευρετήριο την προσπεράσει. Στην πράξη αυτή είναι η
    // συνήθης σειρά: οι κορυφές του CSV έρχονται ανακατεμένες με τις βολές.
    const shared = w(0, 0);
    setTopoPoints([
      { x: shared.x, y: shared.y },                 // 0 — κορυφή, χωρίς Ζ
      { x: shared.x, y: shared.y, z: 10 * M },      // 1 — η βολή στο ΙΔΙΟ σημείο
      { ...w(20, 0), z: 11 * M },
      { ...w(0, 20), z: 12 * M },
    ]);
    invalidateTopoSurface();
    invalidateTopoSurveyPointIndex();
    expect(getTopoSurface().triangles.length).toBeGreaterThan(0);

    // Η κορυφή του περιγράμματος ζει σε DISPLAY — ακριβώς όπως στο `TopoSurfaceEntity.footprint`.
    // 🔴 Χωρίς το skip, το ευρετήριο θα επέστρεφε 0 και η λαβή θα μετακινούσε ένα σημείο που δεν
    // είναι καν κόμβος: το περίγραμμα δεν θα κουνιόταν, η λαβή θα φαινόταν νεκρή (bug ADR-654).
    expect(resolveSurveyPointIndexAt('existing', { x: 0, y: 0 })).toBe(1);
  });
});

// ─── 3. Διαγραφή spikes: δεν σβήνει κορυφές οικοπέδου ─────────────────────────

describe('removeElevationSpikes — δεν διαγράφει δισδιάστατο σημείο που μοιράζεται κελί με σημαδεμένο κόμβο', () => {
  it('η κορυφή χωρίς υψόμετρο επιβιώνει της εκκαθάρισης', () => {
    // Επίπεδο έδαφος + μία ακραία βολή (το spike) + μια κορυφή οικοπέδου ΠΑΝΩ στο spike.
    const spikeAt = { x: 10 * M, y: 10 * M };
    setTopoPoints([
      at(0, 0, 10), at(20, 0, 10), at(20, 20, 10), at(0, 20, 10),
      at(10, 20, 10), at(0, 10, 10), at(20, 10, 10), at(10, 0, 10),
      { ...spikeAt, z: 900 * M },   // βολή-σφάλμα
      { ...spikeAt },               // κορυφή οικοπέδου στο ίδιο X,Y — ΧΩΡΙΣ υψόμετρο
    ]);
    invalidateTopoSurface();

    const removed = removeElevationSpikes();
    const kept = getTopoPoints();

    expect(removed).toBeGreaterThan(0);
    // 🔴 Χωρίς το `hasElevation` guard, το δισδιάστατο σημείο διαγραφόταν μαζί — δηλαδή η εντολή
    // «διόρθωσε τα υψομετρικά σφάλματα» έσβηνε μια κορυφή που δεν έχει καν υψόμετρο για να είναι
    // λάθος, και μαζί της τη γεωμετρία του οικοπέδου.
    expect(kept.some((p) => p.z === undefined && p.x === spikeAt.x && p.y === spikeAt.y)).toBe(true);
    expect(kept.some((p) => p.z === 900 * M)).toBe(false);
  });
});

// ─── 4. QA: δεν κραυγάζει για την πιο συνηθισμένη διάταξη ──────────────────────

describe('checkDuplicatePoints — «κορυφή + βολή στο ίδιο σημείο» δεν είναι υψομετρική αντίφαση', () => {
  it('δεν σημαδεύει το ζεύγος (δισδιάστατο, μετρημένο)', () => {
    // Αυτό είναι ό,τι πιο κανονικό υπάρχει: ο τοπογράφος πήρε βολή εδάφους πάνω στην κορυφή.
    expect(checkDuplicatePoints([corner(5, 5), at(5, 5, 12)])).toEqual([]);
    expect(checkDuplicatePoints([corner(5, 5), corner(5, 5)])).toEqual([]);
  });

  it('ΕΞΑΚΟΛΟΥΘΕΙ να σημαδεύει δύο ΜΕΤΡΗΜΕΝΕΣ βολές που διαφωνούν (ο έλεγχος ζει)', () => {
    // Το φίλτρο δεν επιτρέπεται να «καθαρίσει» τον έλεγχο σιωπώντας τον: αυτό είναι το αντίθετο
    // σφάλμα, και ένας QA κανόνας που δεν βγάζει ποτέ σημαία είναι χειρότερος από ανύπαρκτο.
    const flags = checkDuplicatePoints([at(5, 5, 12), at(5, 5, 15)]);
    expect(flags).toHaveLength(1);
    expect(flags[0]!.kind).toBe('duplicate-point');
    expect(flags[0]!.atZMm).toBe(12 * M);
  });
});

// ─── 5. Ετικέτες: «—», ανοιχτός κύκλος, και ΠΑΝΤΑ κόμβος ──────────────────────

describe('buildSurveyPointLabelEntities — το δισδιάστατο σημείο ζωγραφίζεται (αλλιώς δεν υπάρχει έλξη)', () => {
  const labelsFor = (points: readonly TopoPoint[]) => buildSurveyPointLabelEntities(
    points, null, createTinSampler(buildTin([])),
    { elevation: 'lyr_e', code: 'lyr_c', number: 'lyr_n', boundary: 'lyr_b' },
    DEFAULT_POINT_LABEL_OPTS, null,
  );

  it('βγάζει κόμβο ΚΑΙ για το δισδιάστατο σημείο — εκεί είναι όλη του η αξία', () => {
    const entities = labelsFor([corner(5, 5)]);
    const nodes = entities.filter((e) => e.type === 'point');
    // Ο κόμβος είναι πραγματική οντότητα σκηνής ⇒ render + επιλογή + **OSNAP** δωρεάν (ADR-057).
    // Χωρίς αυτόν, η κορυφή του οικοπέδου θα ήταν αόρατη και μη-ελκτή — δηλαδή θα είχε μπει στον
    // store και δεν θα χρησίμευε σε τίποτα.
    expect(nodes).toHaveLength(1);
    expect(nodes[0]!.position).toEqual({ x: 5 * M, y: 5 * M });
  });

  it('γεμάτη κουκκίδα = μετρημένο · ανοιχτός κύκλος = μόνο θέση (αυτόματο «Non-Surface»)', () => {
    const measured = labelsFor([at(5, 5, 12)]).find((e) => e.type === 'point');
    const planimetric = labelsFor([corner(5, 5)]).find((e) => e.type === 'point');
    expect(measured).toHaveProperty('style', 'dot');
    expect(planimetric).toHaveProperty('style', 'circle');
  });

  it('η ετικέτα γράφει «—», ποτέ «0.00»', () => {
    const texts = labelsFor([corner(5, 5)]).filter((e) => e.type === 'text');
    expect(texts.map((e) => (e as { text: string }).text)).toEqual(['—']);
    // Και το μετρημένο κρατά το νούμερό του — η αλλαγή δεν «καθάρισε» τη σωστή περίπτωση.
    const measuredTexts = labelsFor([at(5, 5, 12.47)]).filter((e) => e.type === 'text');
    expect((measuredTexts[0] as { text: string }).text).toBe('12.47');
  });
});

// ─── 6. Παραδοτέα: κενό κελί, ποτέ κατασκευασμένο μηδέν ───────────────────────

describe('buildCoordinateTable — το νομικό παραδοτέο δεν δηλώνει μέτρηση που δεν έγινε', () => {
  it('το Ζ ενός δισδιάστατου σημείου είναι `null` (κενό κελί), όχι 0', () => {
    const { rows } = buildCoordinateTable([at(1, 2, 3), corner(4, 5)]);
    expect(rows[0]!.cells.z).toBe(3 * M);
    // 🔴 `p.z` σκέτο θα έδινε `undefined` (κελί που μοιάζει με bug)· `p.z ?? 0` θα έγραφε
    // «0.000» στη στήλη υψομέτρου του πίνακα συντεταγμένων — μια μέτρηση που κανείς δεν πήρε,
    // μέσα στο έγγραφο που υπογράφεται.
    expect(rows[1]!.cells.z).toBeNull();
  });
});
