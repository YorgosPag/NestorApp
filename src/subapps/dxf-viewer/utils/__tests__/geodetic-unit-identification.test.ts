/**
 * ADR-716 Φ0 — γεωδαιτική ΤΑΥΤΟΠΟΙΗΣΗ μονάδων: το bug, κλειδωμένο με ground truth.
 *
 * Πραγματικό αρχείο: `47_ergasia.dxf` (τοπογραφικό ΕΓΣΑ87 σε ΜΕΤΡΑ). Οι τιμές της
 * σταθεράς `ERGASIA_47_HEADER` διαβάστηκαν από το ίδιο το αρχείο, όχι από ADR:
 *
 *   $INSUNITS    = 0                       ← unitless ⇒ η ευρετική αναλαμβάνει
 *   $MEASUREMENT = 0                       ← «English»/imperial (ΔΕΝ χρησιμοποιείται, ADR-716 §4)
 *   $EXTMIN      = 407565.2907102597 , 4502055.67106188
 *   $EXTMAX      = 408152.0910632098 , 4502543.611061878
 *                  dx = 586.80   dy = 487.94   διαγώνιος = 763.17
 *
 * Η ευρετική διαγωνίου ρωτά «πόσο ΜΕΓΑΛΟ;» — ερώτημα μαθηματικά διφορούμενο (ADR-716 §2).
 * 763.17 πέφτει στον κάδο `cm` (500 – 50k) ⇒ σφάλμα ×100 σε γεωαναφορά, εμβαδά, όγκους, BOQ.
 * Η ταυτοποίηση ρωτά «ΠΟΥ;»: οι συντεταγμένες κάθονται μέσα στο ελληνικό προβολικό πλέγμα
 * ΜΟΝΟ αν ερμηνευθούν ως μέτρα (ADR-716 §5.5) — απόδειξη, όχι μαντεψιά.
 *
 * 🔴 Τα κατώφλια της `detectSceneUnits` ΔΕΝ αγγίζονται (ADR-716 §2) — το `cm` της
 * ευρετικής κλειδώνεται εδώ ΩΣ ΑΝΑΜΕΝΟΜΕΝΟ, ώστε καμία επόμενη συνεδρία να μη «διορθώσει»
 * το πρόβλημα μετακινώντας το 500.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-716-geodetic-unit-identification-dxf-import.md
 */

import { detectSceneUnits } from '../scene-units';
import { resolveSourceUnits } from '../dxf-canonical-mm-scale';
import { DxfSceneBuilder } from '../dxf-scene-builder';
import type { DxfHeaderData } from '../dxf-parser-types';
// ADR-716 Φ5 — το ground truth του αρχείου ζει σε ΕΝΑ σημείο· το μοιράζεται και η σουίτα
// idempotency του ρητού override (N.18: όχι δεύτερο αντίγραφο των ίδιων συντεταγμένων).
import {
  ERGASIA_47_HEADER,
  ERGASIA_47_EXTENTS,
  ERGASIA_47_WIDTH_M,
  ERGASIA_47_HEIGHT_M,
  makeErgasia47Dxf,
} from './fixtures/dxf-fixtures';

describe('ADR-716 §2 — η ευρετική διαγωνίου (ΑΜΕΤΑΒΛΗΤΗ) πέφτει έξω στο τοπογραφικό', () => {
  it('detectSceneUnits λέει "cm" για ένα ΜΕΤΡΙΚΟ τοπογραφικό 587 m × 488 m', () => {
    // Αυτό ΔΕΝ είναι επιθυμητή συμπεριφορά — είναι η τεκμηρίωση του γιατί χρειάζεται
    // σκαλί ΠΑΝΩ από την ευρετική. Το κατώφλι 500 μένει byte-identical (ADR-716 §2).
    expect(detectSceneUnits(ERGASIA_47_EXTENTS)).toBe('cm');
  });

  it('ένα οικόπεδο ΜΟΝΟ του (~107 m) θα δούλευε — άρα το λάθος μεγαλώνει με τη σωστή αποτύπωση', () => {
    const plotOnly = { min: { x: 407_565, y: 4_502_055 }, max: { x: 407_640, y: 4_502_131 } };
    expect(detectSceneUnits(plotOnly)).toBe('m');
  });
});

describe('ADR-716 §5 — ταυτοποίηση: το πραγματικό header του 47_ergasia.dxf δίνει ΜΕΤΡΑ', () => {
  it('resolveSourceUnits επιστρέφει "m" (σήμερα ΚΟΚΚΙΝΟ: δίνει "cm")', () => {
    const computedBounds = ERGASIA_47_EXTENTS; // καθαρό αρχείο: computed ≡ declared
    expect(resolveSourceUnits(ERGASIA_47_HEADER, computedBounds)).toBe('m');
  });

  it('ΔΕΝ πέφτει σε ίντσες μέσω $MEASUREMENT=0 (ADR-716 §4 — απορρίφθηκε ΜΕΤΡΗΜΕΝΑ)', () => {
    // Ο κανόνας του AutoCAD ($INSUNITS=0 → $MEASUREMENT) θα έδινε 'in' εδώ: σφάλμα ×39,4.
    expect(resolveSourceUnits(ERGASIA_47_HEADER, ERGASIA_47_EXTENTS)).not.toBe('in');
  });

  it('η ρητή επιλογή του χρήστη νικά την ταυτοποίηση (σκαλί 0 > σκαλί 1)', () => {
    expect(resolveSourceUnits(ERGASIA_47_HEADER, ERGASIA_47_EXTENTS, 'cm')).toBe('cm');
  });
});

describe('ADR-716 §5.6 — fail-closed: μηδέν regression στα μη-γεωαναφερμένα σχέδια', () => {
  it('κάτοψη κτιρίου σε cm κοντά στο (0,0) παραμένει "cm"', () => {
    // 2000 × 1500 cm = 20 m × 15 m, διαγώνιος 2500 → κάδος cm. Καμία γεωδαιτική θέση.
    const header: DxfHeaderData = { ...ERGASIA_47_HEADER, extmin: undefined, extmax: undefined };
    const bounds = { min: { x: 0, y: 0 }, max: { x: 2000, y: 1500 } };
    expect(resolveSourceUnits(header, bounds)).toBe('cm');
  });

  it('κάτοψη κτιρίου σε mm κοντά στο (0,0) με τίμιο $INSUNITS=4 παραμένει "mm"', () => {
    const header: DxfHeaderData = { ...ERGASIA_47_HEADER, insunits: 4, extmin: undefined, extmax: undefined };
    const bounds = { min: { x: 0, y: 0 }, max: { x: 40_000, y: 30_000 } };
    expect(resolveSourceUnits(header, bounds)).toBe('mm');
  });
});

describe('ADR-716 §11.2 — end-to-end: το τοπογραφικό βγαίνει 587 m × 488 m', () => {
  it('DxfSceneBuilder κλιμακώνει ×1000 (μέτρα → canonical mm)', () => {
    const scene = DxfSceneBuilder.buildScene(makeErgasia47Dxf());
    const widthMm = scene.bounds.max.x - scene.bounds.min.x;
    const heightMm = scene.bounds.max.y - scene.bounds.min.y;
    // 0 δεκαδικά ψηφία ⇒ ανοχή ±0,5 mm σε 586 800 mm.
    expect(widthMm).toBeCloseTo(ERGASIA_47_WIDTH_M * 1000, 0);
    expect(heightMm).toBeCloseTo(ERGASIA_47_HEIGHT_M * 1000, 0);
  });

  it('η αφετηρία μένει στο ΕΓΣΑ87 πλέγμα σε canonical mm (407.565.291, όχι 4.075.653)', () => {
    const scene = DxfSceneBuilder.buildScene(makeErgasia47Dxf());
    expect(scene.bounds.min.x).toBeCloseTo(407_565_290.71, 0);
    expect(scene.bounds.min.y).toBeCloseTo(4_502_055_671.06, 0);
  });
});
