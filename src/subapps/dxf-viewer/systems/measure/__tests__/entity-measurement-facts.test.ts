/**
 * ADR-649 §measure-facts — ο ΕΝΑΣ dispatcher «τι μετριέται σε αυτή την οντότητα;».
 *
 * Κλειδώνει τρία πράγματα που έσπασαν ή θα σπάσουν σιωπηλά:
 *
 *  1. **Οι αριθμοί.** Γνωστό ορθογώνιο 4000×3000 mm ⇒ περίμετρος 14000, εμβαδόν 12·10⁶.
 *     Αν κάποιος «βελτιστοποιήσει» το `computePolygonAreaMetrics` ή αλλάξει τη σύμβαση
 *     μονάδων (ADR-462: canonical mm), αυτό γίνεται κόκκινο πριν φτάσει σε τιμολόγιο.
 *
 *  2. **Ο κανόνας AutoCAD για ΑΝΟΙΧΤΗ πολυγραμμή** (απόφαση Giorgio 2026-07-27): το
 *     εμβαδόν υπολογίζεται **σαν να έκλεινε**, ενώ η περίμετρος **ΑΓΝΟΕΙ** το τμήμα
 *     κλεισίματος. Είναι ασύμμετρο επίτηδες — ένα «καθάρισμα» που τα κάνει συνεπή
 *     σπάει τη συμμόρφωση με το AutoCAD.
 *
 *  3. **Ο διαχωρισμός panel ↔ εργαλείο ετικέτας.** Το `hasMeasurableArea` απαιτεί
 *     ΑΛΗΘΙΝΑ κλειστό όριο· μια ανοιχτή πολυγραμμή έχει αριθμό στο panel αλλά ΔΕΝ
 *     δέχεται ετικέτα εμβαδού. Χωρίς αυτό το lock, το `pickTopEntityAt` θα άρχιζε να
 *     πιάνει ανοιχτά περιγράμματα και θα κολλούσε ετικέτες σε ό,τι «έκλεισε νοητά».
 */

import type { Entity } from '../../../types/entities';
import { entityMeasurementFacts, hasMeasurableArea } from '../entity-measurement-facts';

/** 4000×3000 mm ορθογώνιο ως 4 κορυφές (χωρίς επανάληψη της πρώτης). */
const RECT_VERTICES = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 4000, y: 3000 },
  { x: 0, y: 3000 },
];

function polyline(closed: boolean, vertices = RECT_VERTICES): Entity {
  return { id: 'pl-1', type: 'polyline', vertices, closed } as unknown as Entity;
}

describe('entityMeasurementFacts — κλειστή πολυγραμμή', () => {
  it('δίνει την περίμετρο ΜΕ το τμήμα κλεισίματος και το εμβαδόν του ορθογωνίου', () => {
    const facts = entityMeasurementFacts(polyline(true));
    expect(facts).not.toBeNull();
    expect(facts!.perimeterMm).toBeCloseTo(14000, 6); // 4000+3000+4000+3000
    expect(facts!.plan2DMm2).toBeCloseTo(12_000_000, 6); // 4000×3000
  });

  it('είναι ΔΟΜΙΚΑ επίπεδη — καμία επιφάνεια στον χώρο (null, ΟΧΙ 0)', () => {
    // Οι κορυφές είναι Point2D· «επιφάνεια στον χώρο» δεν υφίσταται ως έννοια.
    // Το 0 θα ήταν ισχυρισμός για μηδενική επιφάνεια — διαφορετικό πράγμα.
    expect(entityMeasurementFacts(polyline(true))!.surface3DMm2).toBeNull();
  });

  it('δηλώνει κλειστό όριο ⇒ δέχεται ετικέτα εμβαδού', () => {
    expect(entityMeasurementFacts(polyline(true))!.closedBoundary).toBe(true);
    expect(hasMeasurableArea(polyline(true))).toBe(true);
  });
});

describe('entityMeasurementFacts — ΑΝΟΙΧΤΗ πολυγραμμή (κανόνας AutoCAD)', () => {
  it('η περίμετρος ΑΓΝΟΕΙ το τμήμα κλεισίματος', () => {
    // 4000 + 3000 + 4000 = 11000 (λείπει το τελευταίο σκέλος των 3000 πίσω στην αρχή).
    expect(entityMeasurementFacts(polyline(false))!.perimeterMm).toBeCloseTo(11000, 6);
  });

  it('το εμβαδόν υπολογίζεται ΣΑΝ ΝΑ ΕΚΛΕΙΝΕ — ίδιος αριθμός με την κλειστή', () => {
    expect(entityMeasurementFacts(polyline(false))!.plan2DMm2).toBeCloseTo(12_000_000, 6);
  });

  it('δηλώνει ΜΗ κλειστό όριο ⇒ ΔΕΝ δέχεται ετικέτα εμβαδού', () => {
    // Ο διαχωρισμός: αριθμός στο panel ναι, ετικέτα στον καμβά όχι.
    expect(entityMeasurementFacts(polyline(false))!.closedBoundary).toBe(false);
    expect(hasMeasurableArea(polyline(false))).toBe(false);
  });
});

describe('entityMeasurementFacts — όρια', () => {
  it('εκφυλισμένη πολυγραμμή (<2 κορυφές) δεν μετριέται', () => {
    expect(entityMeasurementFacts(polyline(true, [{ x: 0, y: 0 }]))).toBeNull();
  });

  it('πολυγραμμή 2 κορυφών δίνει μήκος αλλά μηδενικό εμβαδόν', () => {
    const facts = entityMeasurementFacts(polyline(false, [{ x: 0, y: 0 }, { x: 4000, y: 0 }]));
    expect(facts!.perimeterMm).toBeCloseTo(4000, 6);
    expect(facts!.plan2DMm2).toBe(0); // shoelace χρειάζεται ≥3 κορυφές
  });

  it('τύπος χωρίς μετρήσιμο μέγεθος (γραμμή) επιστρέφει null', () => {
    const line = { id: 'l-1', type: 'line', start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } as unknown as Entity;
    expect(entityMeasurementFacts(line)).toBeNull();
    expect(hasMeasurableArea(line)).toBe(false);
  });
});
