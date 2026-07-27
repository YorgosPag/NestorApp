/**
 * ADR-716 Φ5/Φ6 — Ο ΜΗΧΑΝΙΣΜΟΣ ΜΟΝΑΔΩΝ ΓΙΑ **ΚΑΘΕ** ΣΧΕΔΙΟ, ΟΧΙ ΓΙΑ ΕΝΑ.
 *
 * ## Γιατί υπάρχει χωριστά από τη σουίτα του `47_ergasia`
 *
 * Ένα fixture δεμένο σε μία αποτύπωση αποδεικνύει μόνο ότι «αυτό το αρχείο δουλεύει».
 * Είναι ακριβώς η ψευδαίσθηση που γεννά ευρετικές κομμένες στα μέτρα ενός δείγματος — και
 * ήταν η αιτία του ίδιου του bug: το κατώφλι της διαγωνίου ήταν συντονισμένο σε «τυπικά»
 * σχέδια και έσπασε στο πρώτο τοπογραφικό που κάλυπτε και τα όμορα οικόπεδα.
 *
 * Εδώ τίποτα δεν αφορά συγκεκριμένο αρχείο. Ελέγχεται η **ιδιότητα**, παραμετρικά:
 *
 *   ΓΙΑ ΚΑΘΕ μονάδα, ΓΙΑ ΚΑΘΕ σχήμα αρχείου (με/χωρίς `$INSUNITS`, με/χωρίς `$EXTMIN`,
 *   γεωαναφερμένο ή όχι, εντός ή εκτός Ελλάδας):
 *     η ρητή επιλογή του μηχανικού κυβερνά την κλίμακα, ντετερμινιστικά,
 *     και ΔΕΝ ξαναεφαρμόζεται στο render.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-716-geodetic-unit-identification-dxf-import.md §7
 */

import { DxfSceneBuilder } from '../dxf-scene-builder';
import { mmToSceneUnits, resolveRenderUnits, type SceneUnits } from '../scene-units';
import { makeDxf, extentsOf, INSUNITS_CODE } from './fixtures/dxf-fixtures';

const ALL_UNITS: readonly SceneUnits[] = ['mm', 'cm', 'm', 'in', 'ft'];

/** Πόσα χιλιοστά αξίζει μία μονάδα — από τη SSoT μετατροπής, κανένας μαγικός αριθμός. */
const mmPerUnit = (u: SceneUnits) => 1 / mmToSceneUnits(u);

function widthMm(content: string, override?: SceneUnits): number {
  const scene = DxfSceneBuilder.buildScene(content, override);
  return scene.bounds.max.x - scene.bounds.min.x;
}

// Ένα συνηθισμένο σχέδιο: 12 × 8 μονάδες, κοντά στην αρχή των αξόνων. Καμία γεωαναφορά,
// κανένα ειδικό χαρακτηριστικό — ό,τι βλέπει ο importer τις 999 στις 1000 φορές.
const ORDINARY_EXTENTS = extentsOf({ x: 0, y: 0 }, 12, 8);

describe('ADR-716 Φ5 — η ρητή επιλογή κυβερνά για ΚΑΘΕ μονάδα', () => {
  it.each(ALL_UNITS)('«%s»: η γεωμετρία βγαίνει σε canonical mm με τον σωστό συντελεστή', (unit) => {
    const content = makeDxf({ insunits: 0, extents: ORDINARY_EXTENTS });
    expect(widthMm(content, unit)).toBeCloseTo(12 * mmPerUnit(unit), 6);
  });

  it.each(ALL_UNITS)('«%s»: δύο διαδοχικά parse δίνουν ΤΑΥΤΟΣΗΜΟ αποτέλεσμα', (unit) => {
    const content = makeDxf({ insunits: 0, extents: ORDINARY_EXTENTS });
    expect(widthMm(content, unit)).toBe(widthMm(content, unit));
  });

  it('🔴 οι πέντε επιλογές δίνουν πέντε ΔΙΑΦΟΡΕΤΙΚΑ αποτελέσματα — το όρισμα σηκώνει βάρος', () => {
    // Χωρίς αυτόν τον έλεγχο η σουίτα θα ήταν πράσινη ακόμη κι αν το `unitsOverride`
    // αγνοούνταν σιωπηλά και όλα κατέληγαν στην ίδια αυτόματη απόφαση.
    const content = makeDxf({ insunits: 0, extents: ORDINARY_EXTENTS });
    const results = ALL_UNITS.map((u) => widthMm(content, u));
    expect(new Set(results).size).toBe(ALL_UNITS.length);
  });
});

describe('ADR-716 Φ5 — ανεξάρτητα από το ΣΧΗΜΑ του αρχείου', () => {
  it.each(ALL_UNITS)('«%s»: αρχείο ΧΩΡΙΣ $EXTMIN/$EXTMAX — η επιλογή ισχύει το ίδιο', (unit) => {
    // Πολλά DXF (ιδίως εξαγωγές από μη-Autodesk εργαλεία) δεν γράφουν extents καθόλου.
    const content = makeDxf({ insunits: 0, extents: null });
    // Ο κατασκευαστής βάζει γραμμή 10 × 10 όταν δεν δοθούν extents.
    expect(widthMm(content, unit)).toBeCloseTo(10 * mmPerUnit(unit), 6);
  });

  it.each(ALL_UNITS)('«%s»: αρχείο ΧΩΡΙΣ καθόλου $INSUNITS — η επιλογή ισχύει το ίδιο', (unit) => {
    const content = makeDxf({ insunits: null, extents: ORDINARY_EXTENTS });
    expect(widthMm(content, unit)).toBeCloseTo(12 * mmPerUnit(unit), 6);
  });

  it.each(ALL_UNITS)('«%s»: ψεύτικο $INSUNITS στο αρχείο — ο μηχανικός νικά τη δήλωση', (unit) => {
    // Το αρχείο δηλώνει ίντσες· ο μηχανικός ξέρει ότι είναι λάθος. Σκαλί 0 > σκαλί 2.
    const content = makeDxf({ insunits: INSUNITS_CODE.in, extents: ORDINARY_EXTENTS });
    expect(widthMm(content, unit)).toBeCloseTo(12 * mmPerUnit(unit), 6);
  });

  it.each(ALL_UNITS)('«%s»: τοπογραφικό ΕΚΤΟΣ Ελλάδας — η επιλογή ισχύει το ίδιο', (unit) => {
    // UTM 32N Γερμανίας: N ≈ 5.500.000, έξω από το ελληνικό παράθυρο ⇒ το γεωδαιτικό
    // σκαλί ΑΠΕΧΕΙ (fail-closed). Η ρητή επιλογή δεν εξαρτάται από αυτό.
    const foreignSurvey = extentsOf({ x: 500_000, y: 5_500_000 }, 300, 220);
    const content = makeDxf({ insunits: 0, extents: foreignSurvey });
    expect(widthMm(content, unit)).toBeCloseTo(300 * mmPerUnit(unit), 3);
  });
});

describe('ADR-716 Φ6 — το render ΔΕΝ ξαναερμηνεύει, ό,τι κι αν διάλεξε ο χρήστης', () => {
  it.each(ALL_UNITS)('«%s»: κάθε σκηνή που παράγει ο builder αποδίδεται σε mm', (unit) => {
    // Ο builder γράφει πάντα `units: 'mm'` (ADR-462). Άρα ΚΑΜΙΑ επιλογή δεν επιτρέπεται
    // να αλλάξει τη μονάδα απόδοσης — αλλιώς οι διαστάσεις βγαίνουν ×(1/mmPerUnit) λάθος.
    const scene = DxfSceneBuilder.buildScene(makeDxf({ insunits: 0, extents: ORDINARY_EXTENTS }), unit);
    expect(scene.units).toBe('mm');
    expect(resolveRenderUnits(scene, unit)).toBe('mm');
    expect(mmToSceneUnits(resolveRenderUnits(scene, unit))).toBe(1);
  });

  it.each(ALL_UNITS)('«%s»: legacy σκηνή ΧΩΡΙΣ δήλωση κρατά την ετικέτα του χρήστη', (unit) => {
    // Η μόνη περίπτωση όπου το ADR-368 label εξακολουθεί να έχει νόημα: blob γραμμένο
    // πριν το canonical-mm, που δεν δηλώνει τίποτα.
    const legacyScene = { units: null, bounds: { min: { x: 0, y: 0 }, max: { x: 12, y: 8 } } };
    expect(resolveRenderUnits(legacyScene, unit)).toBe(unit);
  });
});
