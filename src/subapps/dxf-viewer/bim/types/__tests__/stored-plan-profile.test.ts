/**
 * ADR-789 **Φάση Δ** — άγκυρα του ΑΠΟΘΗΚΕΥΜΕΝΟΥ προφίλ κάτοψης.
 *
 * 🔑 **Γιατί δεν είναι σχόλιο** (το μάθημα του ADR-789 §10): μια άγκυρα «ο τύπος είναι
 * `PlanProfile`» θα ήταν έλεγχος **χρόνου μεταγλώττισης** — το jest σβήνει τους τύπους,
 * άρα θα έμενε ΠΡΑΣΙΝΗ ακόμα κι αν κάποιος ξανάγραφε το lift. Γι' αυτό εδώ κάθε άγκυρα
 * είναι **χρόνου εκτέλεσης** και ρωτά δύο διαφορετικά πράγματα:
 *
 *   **Α.** Το αποθηκευμένο προφίλ **δεν αποκτά κλειδί `z`** — `Object.keys` === `['x','y']`.
 *          Ελέγχουμε την **ΑΠΟΥΣΙΑ ΚΛΕΙΔΙΟΥ**, όχι την τιμή: ένα `z: undefined` θα περνούσε
 *          το `toBeUndefined()` και θα έσπαγε το Firestore (απορρίπτει `undefined`).
 *   **Β.** Κανένας builder **δεν ΑΓΓΙΖΕΙ** το `z` της εισόδου — οι κορυφές εισόδου έχουν
 *          `z` που είναι **getter ο οποίος πετάει**. Αν κάποιος το διαβάσει έστω για να το
 *          αντιγράψει, το test σκάει και **ονομάζει** τον builder. (Το ίδιο τέχνασμα με το
 *          block Δ του `planar-point-vocabulary.test.ts`.)
 *
 * ⚠️ Το `Β0` αποδεικνύει ότι ο ίδιος ο φρουρός ΜΠΟΡΕΙ να πυροδοτήσει — χωρίς αυτό, ένα
 * μπλοκ που δεν σκάει ποτέ είναι αδρανής φρουρός (ADR-749 §5, 606 στιγμιότυπα).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-789-planar-point-vocabulary.md
 */

import { buildDefaultSlabParams } from '../../../hooks/drawing/slab-completion';
import { buildDefaultRoofParams } from '../../../hooks/drawing/roof-completion';
import { buildDefaultFloorFinishParams } from '../../../hooks/drawing/floor-finish-completion';
import { buildDefaultThermalSpaceParams } from '../../../hooks/drawing/thermal-space-completion';
import { buildDefaultMepUnderfloorParams } from '../../../hooks/drawing/mep-underfloor-completion';
import type { Point2D } from '../../../rendering/types/Types';

/** Τετράγωνο 4×4 m σε mm. Καθαρά 2Δ — καμία κορυφή δεν έχει κλειδί `z`. */
const SQUARE: readonly Point2D[] = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 4000, y: 4000 },
  { x: 0, y: 4000 },
];

/**
 * Οι ΙΔΙΕΣ κορυφές, αλλά το `z` είναι **getter που πετάει**. Ό,τι το αγγίξει — έστω για
 * να το αντιγράψει σε `{ ...v }` ή `v.z ?? 0` — σκάει με ονομαστικό μήνυμα.
 */
function boobyTrapped(): readonly Point2D[] {
  return SQUARE.map((p) => {
    const v = { x: p.x, y: p.y };
    Object.defineProperty(v, 'z', {
      enumerable: false,
      get() {
        throw new Error('ADR-789: το προφίλ κάτοψης ΔΕΝ έχει z — κάποιος το διάβασε');
      },
    });
    return v as Point2D;
  });
}

const onlyXY = (v: object): void => {
  expect(Object.keys(v).sort()).toEqual(['x', 'y']);
  expect('z' in v).toBe(false);
};

describe('ADR-789 Φάση Δ — Α. το αποθηκευμένο προφίλ είναι 2Δ', () => {
  it('Α1. SlabParams.outline.vertices', () => {
    buildDefaultSlabParams(SQUARE).outline.vertices.forEach(onlyXY);
  });

  it('Α2. RoofParams.outline.vertices', () => {
    buildDefaultRoofParams(SQUARE).outline.vertices.forEach(onlyXY);
  });

  it('Α3. FloorFinishParams.footprint.vertices', () => {
    buildDefaultFloorFinishParams(SQUARE).footprint.vertices.forEach(onlyXY);
  });

  it('Α4. ThermalSpaceParams.footprint.vertices', () => {
    buildDefaultThermalSpaceParams(SQUARE).footprint.vertices.forEach(onlyXY);
  });

  it('Α5. MepUnderfloorParams.footprint.vertices', () => {
    buildDefaultMepUnderfloorParams(SQUARE).footprint.vertices.forEach(onlyXY);
  });

  it('Α6. το υψόμετρο ζει σε ΔΙΚΟ ΤΟΥ πεδίο, όχι στις κορυφές', () => {
    // Η θετική όψη του ίδιου συμβολαίου: αν το υψόμετρο δεν ζούσε αλλού, η στένωση
    // θα ήταν απώλεια δεδομένων. Ζει — και είναι αριθμός, όχι κορυφή.
    expect(typeof buildDefaultSlabParams(SQUARE).levelElevation).toBe('number');
    expect(typeof buildDefaultRoofParams(SQUARE).basePivotZ).toBe('number');
  });
});

describe('ADR-789 Φάση Δ — Β. κανένας builder δεν ΑΓΓΙΖΕΙ το z', () => {
  it('Β0. ο ίδιος ο φρουρός ΜΠΟΡΕΙ να πυροδοτήσει (απόδειξη ζωής)', () => {
    expect(() => boobyTrapped().map((v) => ({ x: v.x, y: v.y, z: (v as { z?: number }).z })))
      .toThrow(/ADR-789/);
  });

  it('Β1. buildDefaultSlabParams', () => {
    expect(() => buildDefaultSlabParams(boobyTrapped())).not.toThrow();
  });

  it('Β2. buildDefaultRoofParams', () => {
    expect(() => buildDefaultRoofParams(boobyTrapped())).not.toThrow();
  });

  it('Β3. buildDefaultFloorFinishParams', () => {
    expect(() => buildDefaultFloorFinishParams(boobyTrapped())).not.toThrow();
  });

  it('Β4. buildDefaultThermalSpaceParams', () => {
    expect(() => buildDefaultThermalSpaceParams(boobyTrapped())).not.toThrow();
  });

  /**
   * 🔶 **ΔΗΛΩΜΕΝΟ ΟΡΙΟ, μετρημένο — ΟΧΙ χαλάρωση της άγκυρας.**
   *
   * Ο `buildDefaultMepUnderfloorParams` είναι ο μόνος από τους πέντε που **υπολογίζει
   * γεωμετρία** μέσα στον builder (`computeMepUnderfloorGeometry`), και η γεωμετρία
   * περνά από το **bim** `offsetPolyline` (`polygon-offset-utils.ts:125`), το οποίο
   * γράφει `z: v.z ?? 0` — δηλαδή **ΚΑΤΑΣΚΕΥΑΖΕΙ `z: 0`** από 2Δ είσοδο.
   *
   * 🔴 Αυτό είναι το **preserve-if-present** idiom, που είναι ΣΩΣΤΟ για γνήσια χωρικά
   * δεδομένα (σκάλες) και **ψεύτικο** για προφίλ κάτοψης — και ο φρουρός
   * `planar-point-lift` **δεν μπορεί να το δει**, γιατί δεν είναι `z: 0` αλλά
   * `z: v.z ?? 0`. Ανήκει στο ανοιχτό εύρημα «**ΔΥΟ `offsetPolyline`**» (ADR-789 §9).
   *
   * Αυτό που η Φάση Δ **εγγυάται** και ελέγχεται εδώ: όσο κι αν η *υπολογισμένη*
   * γεωμετρία αγγίζει z, το **ΑΠΟΘΗΚΕΥΜΕΝΟ** `footprint` μένει 2Δ (το Α5 το κλειδώνει).
   */
  it('Β5. buildDefaultMepUnderfloorParams — το ΑΠΟΘΗΚΕΥΜΕΝΟ footprint μένει 2Δ', () => {
    // Δεν χρησιμοποιούμε `boobyTrapped()` εδώ: θα έσκαγε στη ΓΕΩΜΕΤΡΙΑ, όχι στο προφίλ,
    // και θα ανέφερε ως αποτυχία της Φάσης Δ κάτι που είναι άλλο ερώτημα (ADR-749).
    const params = buildDefaultMepUnderfloorParams(SQUARE);
    params.footprint.vertices.forEach(onlyXY);
    // …και το προφίλ είναι ΑΚΡΙΒΩΣ η είσοδος, χωρίς ενδιάμεση μετατροπή.
    expect(params.footprint.vertices).toEqual(SQUARE);
  });
});
