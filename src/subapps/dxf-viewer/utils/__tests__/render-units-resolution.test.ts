/**
 * ADR-716 Φ6 — Η ΕΤΙΚΕΤΑ ΔΕΝ ΞΑΝΑΕΡΜΗΝΕΥΕΙ ΨΗΜΕΝΗ ΓΕΩΜΕΤΡΙΑ.
 *
 * Δύο μηχανισμοί μονάδων συνυπήρχαν, με **χρονική** αιτία:
 *
 *   parse-time  `unitsOverride`     (ADR-462) → ΚΛΙΜΑΚΩΝΕΙ τη γεωμετρία σε mm, μία φορά
 *   render-time `userDrawingUnits`  (ADR-368) → ΕΤΙΚΕΤΑ: `dxfScene.units`
 *
 * Το ADR-368 έλυνε το πρόβλημα **πριν** υπάρξει το canonical-mm. Μετά το ADR-462 ο builder
 * γράφει **πάντα** `units: 'mm'`, οπότε η ετικέτα δεν περιγράφει πια — **επιβάλλει**:
 * «Μέτρα» σε γεωμετρία ήδη σε mm ⇒ `mmToSceneUnits('m') = 0,001` ⇒ ύψη κειμένων και
 * διαστάσεων, και το βήμα του grip-drag, **×1000 λάθος** (ADR-716 §7 Εύρημα Β).
 *
 * Αυτή η σουίτα κλειδώνει το κριτήριο **ρητά**: αποφασίζει η ΔΗΛΩΣΗ της σκηνής, όχι το
 * μέγεθος των συντεταγμένων και όχι μια σιωπηλή παραδοχή.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-716-geodetic-unit-identification-dxf-import.md §7
 */

import { resolveRenderUnits, resolveSceneUnits, mmToSceneUnits } from '../scene-units';

/** Σκηνή μετά το ADR-462: η γεωμετρία ΕΙΝΑΙ χιλιοστά και το δηλώνει. */
const CANONICAL_SURVEY = {
  units: 'mm',
  bounds: { min: { x: 0, y: 0 }, max: { x: 586_800, y: 487_940 } },
};

/** Legacy blob από εισαγωγή πριν το ADR-462: καμία δήλωση μονάδας. */
const LEGACY_UNDECLARED = {
  units: null,
  bounds: { min: { x: 0, y: 0 }, max: { x: 586.8, y: 487.94 } },
};

describe('ADR-716 Φ6 — σκηνή που ΔΗΛΩΝΕΙ μονάδα είναι ήδη canonical', () => {
  it('🔴 ΤΟ ΚΛΕΙΔΩΜΑ ×1000: ρητή «Μέτρα» ΔΕΝ αλλάζει μια δηλωμένη mm σκηνή', () => {
    // Αυτό ακριβώς έσπαγε: ο μηχανικός διάλεγε «Μέτρα» στο wizard (σωστά, το DXF ΗΤΑΝ σε
    // μέτρα), η γεωμετρία κλιμακωνόταν σωστά σε mm — και μετά η ίδια επιλογή ξαναέμπαινε
    // στο render σαν να ήταν ακόμη μέτρα.
    expect(resolveRenderUnits(CANONICAL_SURVEY, 'm')).toBe('mm');
  });

  it('ο συντελεστής απόδοσης μένει 1 — καμία δεύτερη κλιμάκωση', () => {
    expect(mmToSceneUnits(resolveRenderUnits(CANONICAL_SURVEY, 'm'))).toBe(1);
    // Η ΠΑΛΙΑ συμπεριφορά, για να φαίνεται το μέγεθος του σφάλματος που κλείνει:
    expect(mmToSceneUnits('m')).toBe(0.001);
  });

  it('τιμά τη δήλωση όποια κι αν είναι — cm σκηνή μένει cm ακόμη κι αν η ετικέτα λέει m', () => {
    expect(resolveRenderUnits({ units: 'cm', bounds: null }, 'm')).toBe('cm');
  });

  it('δέχεται και τις μακρές γραφές που εκπέμπουν παλιοί importers', () => {
    expect(resolveRenderUnits({ units: 'millimeters', bounds: null }, 'm')).toBe('mm');
  });
});

describe('ADR-716 Φ6 — η ετικέτα του ADR-368 επιβιώνει ΜΟΝΟ σε αδήλωτη σκηνή', () => {
  it('legacy σκηνή χωρίς δήλωση: η ρητή επιλογή του χρήστη είναι το μόνο σήμα', () => {
    expect(resolveRenderUnits(LEGACY_UNDECLARED, 'm')).toBe('m');
  });

  it('legacy σκηνή χωρίς δήλωση ΚΑΙ χωρίς ετικέτα: πέφτει στην ευρετική, ΑΜΕΤΑΒΛΗΤΗ', () => {
    // Ίδια απάντηση με το `resolveSceneUnits` — καμία νέα ευρετική, κανένα νέο κατώφλι.
    expect(resolveRenderUnits(LEGACY_UNDECLARED)).toBe(resolveSceneUnits(LEGACY_UNDECLARED));
  });

  it('χωρίς σκηνή καθόλου: back-compat «mm»', () => {
    expect(resolveRenderUnits(null)).toBe('mm');
    expect(resolveRenderUnits(undefined, 'm')).toBe('m');
  });
});
