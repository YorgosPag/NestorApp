/**
 * ADR-716 Φ2 — η σκάλα τεκμηρίων: ΣΕΙΡΑ, ΤΕΚΜΗΡΙΟ, ΟΡΑΤΟ ΜΕΓΕΘΟΣ.
 *
 * Δεν αρκεί «βγάζει σωστή μονάδα». Κλειδώνουμε και **ποιο σκαλί μίλησε** (`confidence`), γιατί
 * αυτό είναι που εμφανίζεται στον μηχανικό και που καθορίζει αν η απόφαση είναι απόδειξη ή
 * εικασία. Ένα σωστό αποτέλεσμα από λάθος σκαλί είναι τύχη, όχι μηχανική.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-716-geodetic-unit-identification-dxf-import.md §8
 */

import { resolveImportSourceUnitsWithEvidence, UNIT_EVIDENCE_KEYS } from '../import-unit-decision';
import { computeUnitSuggestion } from '../scene-units';

/** Πραγματικό `47_ergasia.dxf` — ΕΓΣΑ87 μέτρα, `$INSUNITS = 0`. */
const ERGASIA_47 = {
  min: { x: 407565.2907102597, y: 4502055.67106188 },
  max: { x: 408152.0910632098, y: 4502543.611061878 },
};

/** Τοπογραφικό ADR-362 R20: δηλώνει mm, είναι μέτρα, ΕΚΤΟΣ ελληνικού προβολικού παραθύρου. */
const LOCAL_SURVEY = { min: { x: 131685.13, y: 741755.33 }, max: { x: 131992.93, y: 741923.53 } };

/** Τίμια κάτοψη κτιρίου σε mm: 40 m × 30 m κοντά στην αρχή. */
const MM_FLOORPLAN = { min: { x: 0, y: 0 }, max: { x: 40_000, y: 30_000 } };

describe('ADR-716 §8 σκαλί 1 — ταυτοποίηση: νικά ΚΑΙ το $INSUNITS', () => {
  it('47_ergasia.dxf ($INSUNITS=0) ⇒ m, confidence "identified"', () => {
    const d = resolveImportSourceUnitsWithEvidence(0, ERGASIA_47);
    expect(d.units).toBe('m');
    expect(d.confidence).toBe('identified');
    expect(d.evidenceKey).toBe(UNIT_EVIDENCE_KEYS.identified);
  });

  it('ελληνικό DXF με mm-ψέμα ($INSUNITS=4) + ΕΓΣΑ87 συντεταγμένες ⇒ m, "identified"', () => {
    const d = resolveImportSourceUnitsWithEvidence(4, ERGASIA_47);
    expect(d.units).toBe('m');
    expect(d.confidence).toBe('identified');
    expect(d.declared).toBe('mm');
    expect(d.mismatch).toBe(true);
  });

  it('δείχνει το μέγεθος σε ΜΕΤΡΑ ώστε να επαληθεύεται με το μάτι: 587 m × 488 m (§8.1)', () => {
    const { resultingExtentM } = resolveImportSourceUnitsWithEvidence(0, ERGASIA_47);
    expect(resultingExtentM?.width).toBeCloseTo(586.8, 1);
    expect(resultingExtentM?.height).toBeCloseTo(487.94, 1);
  });
});

describe('ADR-716 §8 σκαλί 0 — η ρητή επιλογή του μηχανικού νικά τα πάντα', () => {
  it('override "cm" πάνω σε γεωαναφερμένο τοπογραφικό ⇒ cm, "explicit"', () => {
    const d = resolveImportSourceUnitsWithEvidence(0, ERGASIA_47, null, 'cm');
    expect(d.units).toBe('cm');
    expect(d.confidence).toBe('explicit');
    expect(d.evidenceKey).toBe(UNIT_EVIDENCE_KEYS.explicit);
  });

  it('το readout ακολουθεί την επιλογή: cm ⇒ 5,87 m × 4,88 m (ορατά λάθος στον μηχανικό)', () => {
    const d = resolveImportSourceUnitsWithEvidence(0, ERGASIA_47, null, 'cm');
    expect(d.resultingExtentM?.width).toBeCloseTo(5.868, 2);
  });

  it('σημειώνει διαφωνία με τη δήλωση ($INSUNITS=6 αλλά ο χρήστης λέει mm)', () => {
    const d = resolveImportSourceUnitsWithEvidence(6, MM_FLOORPLAN, null, 'mm');
    expect(d.declared).toBe('m');
    expect(d.mismatch).toBe(true);
  });
});

describe('ADR-716 §8 σκαλιά 2–4 — αναλλοίωτη η υπάρχουσα συμπεριφορά', () => {
  it('τίμιο mm κτίριο ⇒ mm, "declared", χωρίς διαφωνία', () => {
    const d = resolveImportSourceUnitsWithEvidence(4, MM_FLOORPLAN);
    expect(d.units).toBe('mm');
    expect(d.confidence).toBe('declared');
    expect(d.mismatch).toBe(false);
  });

  it('mm-ψέμα ΕΚΤΟΣ ελληνικού παραθύρου ⇒ m από το carve-out, "weak" (όχι "identified")', () => {
    const d = resolveImportSourceUnitsWithEvidence(4, LOCAL_SURVEY);
    expect(d.units).toBe('m');
    expect(d.confidence).toBe('weak');
    expect(d.evidenceKey).toBe(UNIT_EVIDENCE_KEYS.weak);
  });

  it('unitless + κάτοψη ⇒ ευρετική διαγωνίου, "weak"', () => {
    const d = resolveImportSourceUnitsWithEvidence(0, MM_FLOORPLAN);
    expect(d.units).toBe('mm');
    expect(d.confidence).toBe('weak');
  });

  it('κανένα σήμα (unitless, χωρίς extent) ⇒ mm, "default", extent null', () => {
    const d = resolveImportSourceUnitsWithEvidence(0, null);
    expect(d.units).toBe('mm');
    expect(d.confidence).toBe('default');
    expect(d.resultingExtentM).toBeNull();
  });
});

describe('ADR-716 §5.6 — μηδέν regression: η σκάλα συμφωνεί με τη ΠΑΛΙΑ όπου δεν ταυτοποιεί', () => {
  const nonGeodeticCases = [
    { insunits: 4, extents: MM_FLOORPLAN },
    { insunits: 4, extents: LOCAL_SURVEY },
    { insunits: 0, extents: MM_FLOORPLAN },
    { insunits: 6, extents: { min: { x: 0, y: 0 }, max: { x: 40, y: 30 } } },
    { insunits: 0, extents: null },
    { insunits: 1, extents: { min: { x: 0, y: 0 }, max: { x: 1_500, y: 1_200 } } },
  ];

  it.each(nonGeodeticCases)('$insunits / μη-γεωαναφερμένο ⇒ ίδια μονάδα με computeUnitSuggestion', ({ insunits, extents }) => {
    const legacy = computeUnitSuggestion(insunits, extents);
    const decision = resolveImportSourceUnitsWithEvidence(insunits, extents);
    expect(decision.units).toBe(legacy.suggested);
    expect(decision.declared).toBe(legacy.declared);
    expect(decision.mismatch).toBe(legacy.mismatch);
  });
});
