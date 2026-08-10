/**
 * ADR-782 §23 — άγκυρες `Χ1`-`Χ10` της **χειροκίνητης τοποθέτησης**.
 *
 * Το ερώτημα που κλειδώνουν δεν είναι «βγαίνουν σωστοί αριθμοί» αλλά **«συμπεριφέρεται όπως το
 * βλέπει ο χρήστης;»**: το σημείο που έπιασε πηγαίνει εκεί που το άφησε (`Χ1`), ο άξονας της
 * στροφής μένει ακίνητος (`Χ4`), και η απόσταση του δείκτη **δεν** μεγεθύνει τον χάρτη (`Χ6`).
 *
 * ⚠️ Η `Χ10` δηλώνει ρητά το **όριο** των δύο αντιστοιχιών: ένας άκαμπτος μετασχηματισμός δεν
 * έχει κλίμακα, οπότε δύο ζεύγη με ασύμβατες αποστάσεις **δεν** ικανοποιούνται και τα δύο. Αυτό
 * δεν είναι σφάλμα προς διόρθωση — είναι το ίδιο συμβόλαιο που κρατά η δηλωμένη γεωαναφορά
 * (ADR-650 M10: «οι μεγάλοι ΠΟΤΕ δεν κλιμακώνουν αυτόματα»), και ο δείκτης του είναι ο
 * `pointPairScaleRatio`.
 */

import {
  forwardRigidMap,
  mapX,
  mapY,
  pointPairScaleRatio,
  type GeoReference,
} from '../../geo-referencing/geo-transform';
import type { Point2D } from '../../../rendering/types/Types';
import {
  panBasemapFrame,
  placeBasemapByCorrespondences,
  rotateBasemapFrame,
} from '../basemap-placement';

/** Ένα ρεαλιστικό πλαίσιο: αρχή κάπου στη Βόρεια Ελλάδα (ΕΓΣΑ mm), με στροφή. */
const FRAME: GeoReference = {
  originWorld: { x: 410_000_000, y: 4_500_000_000 },
  rotationDeg: 27,
};

/**
 * Το **αριθμητικό δάπεδο** της ανακτημένης γωνίας, σε μοίρες.
 *
 * ⚠️ Δεν είναι ανοχή σχεδίασης αλλά όριο της διπλής ακρίβειας, και βγαίνει με αριθμούς: οι
 * συντεταγμένες κόσμου εδώ είναι ~4,5·10⁹ mm, άρα το `double` κρατά ~10⁻⁶ mm απόλυτα· πάνω σε
 * μοχλό 10 m (10⁴ mm) αυτό είναι ~10⁻¹⁰ rad ≈ **6·10⁻⁹ μοίρες**. Μετρημένο: 2,6·10⁻⁹.
 * Το όριο εδώ είναι ~40× το δάπεδο και αντιστοιχεί σε **λιγότερο από ένα μικρόμετρο στα 100 m**.
 */
const ANGLE_NOISE_DEG = 1e-7;

/** Ποιο σημείο του κόσμου κάθεται κάτω από ένα σημείο του χαρτιού, υπό το `geo`. */
function worldUnder(geo: GeoReference, display: Point2D): Point2D {
  const map = forwardRigidMap(geo);
  return { x: mapX(map, display.x, display.y), y: mapY(map, display.x, display.y) };
}

function expectSamePoint(actual: Point2D, expected: Point2D, toleranceMm = 1e-6): void {
  expect(Math.hypot(actual.x - expected.x, actual.y - expected.y)).toBeLessThan(toleranceMm);
}

describe('ADR-782 §23 — σύρσιμο', () => {
  it('Χ1 — το σημείο που έπιασε ο χρήστης προσγειώνεται ΑΚΡΙΒΩΣ εκεί που το άφησε', () => {
    const from: Point2D = { x: 12_000, y: -3_500 };
    const to: Point2D = { x: 40_000, y: 9_000 };
    const grabbed = worldUnder(FRAME, from);

    const next = panBasemapFrame(FRAME, from, to);

    expectSamePoint(worldUnder(next, to), grabbed);
  });

  it('Χ2 — το σύρσιμο ΔΕΝ αγγίζει τη στροφή (αλλιώς «ξεστρίβει» ο χάρτης)', () => {
    const next = panBasemapFrame(FRAME, { x: 0, y: 0 }, { x: 1_000, y: 2_000 });
    expect(next.rotationDeg).toBe(FRAME.rotationDeg);
  });

  it('Χ3 — αντιστρέψιμο: σύρε εκεί και πίσω ⇒ το ίδιο πλαίσιο', () => {
    const a: Point2D = { x: -8_000, y: 5_000 };
    const b: Point2D = { x: 31_000, y: -12_000 };

    const back = panBasemapFrame(panBasemapFrame(FRAME, a, b), b, a);

    expectSamePoint(back.originWorld, FRAME.originWorld);
    expect(back.rotationDeg).toBe(FRAME.rotationDeg);
  });
});

describe('ADR-782 §23 — στροφή', () => {
  const PIVOT: Point2D = { x: 5_000, y: 5_000 };

  it('Χ4 — ο άξονας μένει ΑΚΙΝΗΤΟΣ: ο κόσμος από κάτω του δεν αλλάζει', () => {
    const before = worldUnder(FRAME, PIVOT);

    const next = rotateBasemapFrame(FRAME, PIVOT, { x: 15_000, y: 5_000 }, { x: 5_000, y: 15_000 });

    expectSamePoint(worldUnder(next, PIVOT), before);
  });

  it('Χ5 — στροφή 90°: ο κόσμος που ήταν στη λαβή βρίσκεται τώρα στη νέα διεύθυνση', () => {
    const from: Point2D = { x: 15_000, y: 5_000 }; // 10 m δεξιά από τον άξονα
    const to: Point2D = { x: 5_000, y: 15_000 };   // 10 m πάνω από τον άξονα
    const held = worldUnder(FRAME, from);

    const next = rotateBasemapFrame(FRAME, PIVOT, from, to);

    expectSamePoint(worldUnder(next, to), held);
    const expectedDeg = (FRAME.rotationDeg + 360 - 90) % 360;
    expect(Math.abs(next.rotationDeg - expectedDeg)).toBeLessThan(ANGLE_NOISE_DEG);
  });

  it('Χ6 — η ΑΠΟΣΤΑΣΗ του δείκτη αγνοείται: καμία κλιμάκωση του υποβάθρου', () => {
    const from: Point2D = { x: 15_000, y: 5_000 };
    const near = rotateBasemapFrame(FRAME, PIVOT, from, { x: 5_000, y: 15_000 });
    const far = rotateBasemapFrame(FRAME, PIVOT, from, { x: 5_000, y: 105_000 });

    expectSamePoint(near.originWorld, far.originWorld);
    expect(Math.abs(near.rotationDeg - far.rotationDeg)).toBeLessThan(ANGLE_NOISE_DEG);
  });

  it('Χ7 — εκφυλισμένος μοχλός ⇒ ΤΟ ΙΔΙΟ πλαίσιο, όχι αυθαίρετη γωνία', () => {
    expect(rotateBasemapFrame(FRAME, PIVOT, PIVOT, { x: 9_000, y: 9_000 })).toBe(FRAME);
    expect(rotateBasemapFrame(FRAME, PIVOT, { x: 9_000, y: 9_000 }, PIVOT)).toBe(FRAME);
  });
});

describe('ADR-782 §23 — αντιστοιχίες σημείων', () => {
  it('Χ8 — ΜΙΑ αντιστοιχία ⇒ μόνο μετατόπιση· η στροφή του χρήστη επιβιώνει', () => {
    const drawing: Point2D = { x: 3_000, y: -1_500 };
    const world = worldUnder(FRAME, { x: 7_000, y: -2_000 });

    const next = placeBasemapByCorrespondences(FRAME, [{ drawing, world }]);

    expect(next.rotationDeg).toBe(FRAME.rotationDeg);
    expectSamePoint(worldUnder(next, drawing), world, 1e-3);
  });

  it('Χ9 — ΔΥΟ συμβατές αντιστοιχίες ⇒ και τα δύο σημεία προσγειώνονται ακριβώς', () => {
    // Συμβατές «εξ ορισμού»: οι δύο κόσμοι απέχουν όσο τα δύο σημεία του σχεδίου — δες `Χ10`.
    const drawingA: Point2D = { x: 10_000, y: 0 };
    const drawingB: Point2D = { x: 10_000, y: 20_000 };
    const worldA = worldUnder(FRAME, { x: 0, y: 10_000 });
    const worldB = worldUnder(FRAME, { x: -20_000, y: 10_000 });

    const next = placeBasemapByCorrespondences(FRAME, [
      { drawing: drawingA, world: worldA },
      { drawing: drawingB, world: worldB },
    ]);

    expectSamePoint(worldUnder(next, drawingA), worldA, 1e-3);
    expectSamePoint(worldUnder(next, drawingB), worldB, 1e-3);
  });

  it('Χ9β — η αντιστοιχία είναι ΑΠΟΛΥΤΗ: μια ενδιάμεση μετακίνηση δεν την αλλοιώνει', () => {
    const drawing: Point2D = { x: 4_000, y: 4_000 };
    const world = worldUnder(FRAME, { x: 12_000, y: -6_000 });

    const straight = placeBasemapByCorrespondences(FRAME, [{ drawing, world }]);
    const moved = panBasemapFrame(FRAME, { x: 0, y: 0 }, { x: 250_000, y: -80_000 });
    const afterDetour = placeBasemapByCorrespondences(moved, [{ drawing, world }]);

    // Το πλαίσιο του «κατευθείαν» και του «με παρακάμψεις» ταυτίζονται: η δήλωση του χρήστη
    // («αυτό το σημείο του σχεδίου είναι εκείνο το σημείο της Γης») δεν εξαρτάται από τη
    // διαδρομή. Αν το ζεύγος κρατούσε σημείο **χαρτιού**, εδώ θα προέκυπταν δύο διαφορετικά.
    expectSamePoint(afterDetour.originWorld, straight.originWorld, 1e-3);
    expect(afterDetour.rotationDeg).toBe(straight.rotationDeg);
  });

  it('Χ10 — ασύμβατες αποστάσεις: η πρώτη τηρείται, η δεύτερη δίνει ΔΙΕΥΘΥΝΣΗ', () => {
    const drawingA: Point2D = { x: 0, y: 0 };
    const drawingB: Point2D = { x: 10_000, y: 0 };
    const worldA = worldUnder(FRAME, { x: 0, y: 0 });
    const worldB = worldUnder(FRAME, { x: 0, y: 25_000 }); // 2,5× πιο μακριά — ασύμβατο

    const next = placeBasemapByCorrespondences(FRAME, [
      { drawing: drawingA, world: worldA },
      { drawing: drawingB, world: worldB },
    ]);

    // Η πρώτη αντιστοιχία είναι η άγκυρα του μετασχηματισμού: τηρείται ακριβώς.
    expectSamePoint(worldUnder(next, drawingA), worldA, 1e-3);

    // Η δεύτερη κρατά τη **διεύθυνση**, όχι την απόσταση — καμία σιωπηλή κλιμάκωση.
    const landed = worldUnder(next, drawingB);
    const cross =
      (landed.x - worldA.x) * (worldB.y - worldA.y) - (landed.y - worldA.y) * (worldB.x - worldA.x);
    expect(Math.abs(cross)).toBeLessThan(1e-3 * span(worldA, worldB));

    // Και ο δείκτης της ασυμφωνίας υπάρχει ήδη στο SSoT — η διεπαφή τον δείχνει, δεν τον εφευρίσκει.
    expect(pointPairScaleRatio(drawingA, drawingB, worldA, worldB)).toBeCloseTo(2.5, 9);
  });

  it('Χ11 — εκφυλισμένες αντιστοιχίες ⇒ ΤΟ ΙΔΙΟ πλαίσιο', () => {
    const p: Point2D = { x: 1_000, y: 1_000 };
    const w = worldUnder(FRAME, p);
    expect(placeBasemapByCorrespondences(FRAME, [])).toBe(FRAME);
    expect(
      placeBasemapByCorrespondences(FRAME, [
        { drawing: p, world: w },
        { drawing: p, world: worldUnder(FRAME, { x: 9_000, y: 9_000 }) },
      ]),
    ).toBe(FRAME);
    expect(
      placeBasemapByCorrespondences(FRAME, [
        { drawing: p, world: w },
        { drawing: { x: 9_000, y: 9_000 }, world: w },
      ]),
    ).toBe(FRAME);
  });
});

/** Μήκος διανύσματος — τοπικό βοηθητικό των ισχυρισμών, όχι αντίγραφο λογικής παραγωγής. */
function span(a: Point2D, b: Point2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
