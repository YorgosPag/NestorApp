/**
 * ADR-716 Φ5 — Η ΡΗΤΗ ΕΠΙΛΟΓΗ ΤΟΥ ΜΗΧΑΝΙΚΟΥ ΦΤΑΝΕΙ ΣΤΗΝ ΚΛΙΜΑΚΑ, ΚΑΙ ΜΕΝΕΙ ΕΚΕΙ.
 *
 * Το Εύρημα Α (ADR-716 §7) δεν ήταν «λείπει ένα όρισμα» — ήταν ότι η μονάδα
 * αντιμετωπιζόταν ως **γεγονός της στιγμής** ενώ είναι **ιδιότητα του συνδέσμου**: τρεις
 * από τις πέντε διαδρομές ξανα-διαβάζουν το DXF από το Storage πολύ αργότερα (άλλη
 * συνεδρία, άλλο μηχάνημα, ακόμη και ο server), όπου δεν υπάρχει κανείς να ρωτηθεί.
 *
 * Αυτή η σουίτα κλειδώνει την **ιδιότητα**, όχι την καλωδίωση:
 *
 *   ίδιο αρχείο + ίδια αποθηκευμένη επιλογή  ⇒  ίδια κλίμακα.
 *   Πάντα. Σε κάθε επαναφόρτωση. Σε client ΚΑΙ σε server.
 *
 * 🔴 Το τεστ «περνά το όρισμα» θα ήταν άχρηστο: θα ήταν πράσινο και με το bug, αν το
 * όρισμα αγνοούνταν παρακάτω. Γι' αυτό εδώ μετριούνται **αποτελέσματα** (bounds σε mm),
 * και υπάρχει ρητός έλεγχος ότι χωρίς την επιλογή το αποτέλεσμα είναι ΔΙΑΦΟΡΕΤΙΚΟ —
 * αλλιώς το τεστ δεν θα μπορούσε ποτέ να κοκκινίσει.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-716-geodetic-unit-identification-dxf-import.md §7
 */

import { DxfSceneBuilder } from '../dxf-scene-builder';
import {
  ERGASIA_47_WIDTH_M,
  ERGASIA_47_HEIGHT_M,
  makeErgasia47Dxf,
} from './fixtures/ergasia47-dxf';

/** Πλάτος/ύψος της σκηνής σε canonical mm — ό,τι «βλέπει» κάθε downstream καταναλωτής. */
function extentMm(scene: { bounds: { min: { x: number; y: number }; max: { x: number; y: number } } }) {
  return {
    width: scene.bounds.max.x - scene.bounds.min.x,
    height: scene.bounds.max.y - scene.bounds.min.y,
  };
}

describe('ADR-716 Φ5 — ίδιο αρχείο + ίδια επιλογή ⇒ ίδια κλίμακα', () => {
  const content = makeErgasia47Dxf();

  it('δύο διαδοχικά parse με την ΙΔΙΑ αποθηκευμένη επιλογή δίνουν ΤΑΥΤΟΣΗΜΑ bounds', () => {
    // Αυτό είναι το σενάριο «επαναφόρτωση σελίδας / άλλο μηχάνημα»: το ίδιο αρχείο
    // ξαναδιαβάζεται με την ίδια, αποθηκευμένη ετυμηγορία.
    const first = extentMm(DxfSceneBuilder.buildScene(content, 'm'));
    const second = extentMm(DxfSceneBuilder.buildScene(content, 'm'));
    expect(second).toEqual(first);
  });

  it('η ρητή «Μέτρα» δίνει 587 m × 488 m σε canonical mm', () => {
    const { width, height } = extentMm(DxfSceneBuilder.buildScene(content, 'm'));
    expect(width).toBeCloseTo(ERGASIA_47_WIDTH_M * 1000, 0);
    expect(height).toBeCloseTo(ERGASIA_47_HEIGHT_M * 1000, 0);
  });

  it('🔴 το όρισμα ΣΗΚΩΝΕΙ ΒΑΡΟΣ: ρητά «Εκατοστά» δίνει ×100 μικρότερο σχέδιο', () => {
    // Χωρίς αυτόν τον έλεγχο, η σουίτα θα ήταν πράσινη ακόμη κι αν το `unitsOverride`
    // αγνοούνταν σιωπηλά (η αυτόματη σκάλα βγάζει ούτως ή άλλως «μέτρα» εδώ).
    const asCm = extentMm(DxfSceneBuilder.buildScene(content, 'cm'));
    expect(asCm.width).toBeCloseTo(ERGASIA_47_WIDTH_M * 10, 0);
    expect(asCm.width).not.toBeCloseTo(ERGASIA_47_WIDTH_M * 1000, 0);
  });

  it('η ρητή επιλογή ΝΙΚΑ το γεωδαιτικό σκαλί — ο μηχανικός έχει τον τελευταίο λόγο', () => {
    // Το σκαλί 1 (ταυτοποίηση από τη ΘΕΣΗ) λέει «μέτρα» με απόδειξη. Το σκαλί 0 είναι
    // πάνω του: αν ο μηχανικός δηλώσει «χιλιοστά», αυτό εκτελείται — καμία σιωπηλή
    // «διόρθωση» της ανθρώπινης απόφασης (το δίδαγμα ΟΛΩΝ των μεγάλων, ADR-716 §3).
    const asMm = extentMm(DxfSceneBuilder.buildScene(content, 'mm'));
    expect(asMm.width).toBeCloseTo(ERGASIA_47_WIDTH_M, 0);
  });
});

describe('ADR-716 Φ5 — client και server συμφωνούν κατά κατασκευή', () => {
  it('η ΙΔΙΑ επιλογή δίνει την ΙΔΙΑ κλίμακα σε όποιον δρόμο κι αν παρσαριστεί', () => {
    // Ο server (`api/floorplans/process`) καλεί `buildSceneWithDiagnostics(content, units)`
    // με τη μονάδα που διαβάζει από το FileRecord· ο client φτάνει στην ίδια συνάρτηση
    // μέσω `runDxfParse`. Ένα SSoT κλιμάκωσης ⇒ μία απάντηση, όχι δύο.
    const content = makeErgasia47Dxf();
    const viaBuilder = extentMm(DxfSceneBuilder.buildScene(content, 'm'));
    const { scene } = DxfSceneBuilder.buildSceneWithDiagnostics(content, 'm');
    expect(extentMm(scene)).toEqual(viaBuilder);
  });

  it('χωρίς αποθηκευμένη επιλογή, η σκάλα τεκμηρίων δίνει το ΙΔΙΟ αποτέλεσμα (μέτρα)', () => {
    // Ό,τι αποφασίζει αυτόματα η σκάλα είναι ντετερμινιστικά επαναπαραγώγιμο από το ίδιο
    // το αρχείο — γι' αυτό ΔΕΝ αποθηκεύεται. Η απουσία του πεδίου δεν είναι απώλεια.
    const content = makeErgasia47Dxf();
    const auto = extentMm(DxfSceneBuilder.buildScene(content));
    const explicitMetres = extentMm(DxfSceneBuilder.buildScene(content, 'm'));
    expect(auto).toEqual(explicitMetres);
  });
});
