/**
 * @fileoverview **ΟΙ ΠΙΝΑΚΕΣ ΣΥΝΤΕΛΕΣΤΩΝ ΤΟΥ ΑΝΤΙΚΕΙΜΕΝΙΚΟΥ ΣΥΣΤΗΜΑΤΟΣ** — αυτούσιοι από τον νόμο, μόνο δεδομένα.
 * @related ADR-898 · ΠΟΛ.1149/1994 (κωδικοποιημένη με ΥΑ 60449 ΕΞ 2021, 105894 ΕΞ 2022, 138311 ΕΞ 2024)
 * @module lib/objective-value/objective-value-tables
 *
 * 🔒 **Κάθε αριθμός εδώ έχει παραπομπή σε άρθρο/παράγραφο.** Μεταγράφηκαν από το **κείμενο** της απόφασης, όχι από
 * οδηγούς τρίτων (οι οποίοι, μετρημένα, μπέρδευαν πίνακες εντύπων). Αλλαγή αριθμού = αλλαγή νόμου ⇒ νέα γραμμή στο
 * changelog του ADR-898 με τον αριθμό της νέας απόφασης.
 *
 * ⚠️ **Τρία έντυπα, τρεις ΔΙΑΦΟΡΕΤΙΚΟΙ πίνακες παλαιότητας/αποπεράτωσης/κατασκευής**: η κατοικία (έντυπο 1) πέφτει
 * έως 0,60, η αποθήκη και η θέση στάθμευσης (έντυπα 4, 5) έως 0,70. Ποτέ κοινός πίνακας «παλαιότητας».
 */

/** Κλιμάκιο: ισχύει για τιμές `≤ upTo` (το τελευταίο έχει `upTo: Infinity`). */
export interface Band {
  readonly upTo: number;
  readonly factor: number;
}

// ============================================================================
// ΚΟΙΝΑ (άρθρο 2)
// ============================================================================

/** Άρθ. 2 §17: μικτή επιφάνεια (με κοινόχρηστους) μειωμένη κατά 10%. */
export const MIXED_AREA_FACTOR = 0.9;

/** Άρθ. 3 §5 · 6 §5: εξωτερικοί τοίχοι πάχους ≥ 0,50 μ. (π.χ. πέτρα). */
export const THICK_WALLS_FACTOR = 0.9;

/** Άρθ. 3 §12 · 6 §10 · 7 §10: συνιδιοκτησία κατά πλήρη κυριότητα. */
export const CO_OWNERSHIP_FACTOR = 0.9;

/** Άρθ. 3 §8 · 6 §7 · 7 §7: διατηρητέο (υπερισχύει του απαλλοτριωτέου, άρθ. 2 §22) / απαλλοτριωτέο. */
export const LISTED_FACTOR = 0.8;
export const EXPROPRIATED_FACTOR = 0.75;

// ============================================================================
// ΕΝΤΥΠΟ 1 — ΚΑΤΟΙΚΙΑ / ΔΙΑΜΕΡΙΣΜΑ (άρθρο 3)
// ============================================================================

/** Άρθ. 3 §3. */
export const RESIDENCE_FRONTAGE = {
  single: 1.0,
  multiple: 1.05,
  narrow: 0.8,
  rearOnly: 0.8,
} as const;

/** Άρθ. 3 §4: γραμμή ανά κλιμάκιο ΣΕ — `[υπόγειο, ισόγειο, Α', Β', Γ', Δ', Ε', ΣΤ' και πάνω]`. */
export const RESIDENCE_FLOOR_BY_SE: readonly { readonly seBelow: number; readonly floors: readonly number[] }[] = [
  { seBelow: 1.5, floors: [0.6, 0.9, 1.0, 1.05, 1.1, 1.15, 1.2, 1.25] },
  { seBelow: 3, floors: [0.6, 1.2, 1.1, 1.05, 1.1, 1.15, 1.2, 1.25] },
  { seBelow: 5, floors: [0.6, 1.25, 1.15, 1.1, 1.1, 1.15, 1.2, 1.25] },
  { seBelow: Infinity, floors: [0.6, 1.3, 1.2, 1.15, 1.15, 1.15, 1.2, 1.25] },
];

/** Άρθ. 3 §6α: συνάρτηση της **συνολικής** επιφάνειας (και σε πολυώροφη, §6β). */
export const RESIDENCE_AREA_BANDS: readonly Band[] = [
  { upTo: 25, factor: 1.05 },
  { upTo: 100, factor: 1.0 },
  { upTo: 200, factor: 1.05 },
  { upTo: 300, factor: 1.1 },
  { upTo: 500, factor: 1.2 },
  { upTo: Infinity, factor: 1.3 },
];

/** Άρθ. 3 §7 (έτη παλαιότητας κατά άρθ. 2 §20· 0 έτη ⇒ 1,00). */
export const RESIDENCE_AGE_BANDS: readonly Band[] = [
  { upTo: 0, factor: 1.0 },
  { upTo: 5, factor: 0.9 },
  { upTo: 10, factor: 0.8 },
  { upTo: 15, factor: 0.75 },
  { upTo: 20, factor: 0.7 },
  { upTo: 25, factor: 0.65 },
  { upTo: Infinity, factor: 0.6 },
];

/** Άρθ. 3 §9: στάδιο → `[ΣΑΟ ≤ 0,40, 0,40 < ΣΑΟ ≤ 1,00, ΣΑΟ > 1,00]`. Η θεμελίωση μόνο σε υπόγειο/ισόγειο. */
export const RESIDENCE_COMPLETION = {
  foundation: [0.65, 0.4, 0.3],
  frame: [0.7, 0.5, 0.4],
  masonry: [0.75, 0.55, 0.45],
  plaster: [0.8, 0.65, 0.55],
  flooring: [0.85, 0.75, 0.7],
} as const;

/** Όρια ΣΑΟ των στηλών του {@link RESIDENCE_COMPLETION}. */
export const COMPLETION_SAO_LIMITS = [0.4, 1.0] as const;

/** Άρθ. 3 §10: ένας από τους τρεις + (πρόσθετα) ελαφριά στέγη. */
export const RESIDENCE_CONSTRUCTION = { frame: 1.0, masonry: 0.95, makeshift: 0.7, lightRoof: 0.8 } as const;

/** Άρθ. 3 §11: χωρίς κεντρική θέρμανση · πάνω από τον Β' όροφο χωρίς ανελκυστήρα. */
export const NO_CENTRAL_HEATING_FACTOR = 0.95;
export const NO_ELEVATOR_FACTOR = 0.9;
/** Ο χαμηλότερος όροφος όπου μετρά ο ανελκυστήρας («πάνω από το Β'» ⇒ Γ'). */
export const ELEVATOR_FROM_FLOOR = 3;

// ============================================================================
// ΕΝΤΥΠΑ 4 + 5 — ΑΠΟΘΗΚΗ / ΘΕΣΗ ΣΤΑΘΜΕΥΣΗΣ (άρθρα 6, 7)
// ============================================================================

/** Άρθ. 6 §6 · 7 §6 — **ίδιος** πίνακας στα δύο, διαφορετικός από της κατοικίας. */
export const ANCILLARY_AGE_BANDS: readonly Band[] = [
  { upTo: 0, factor: 1.0 },
  { upTo: 5, factor: 0.95 },
  { upTo: 10, factor: 0.9 },
  { upTo: 15, factor: 0.85 },
  { upTo: 20, factor: 0.8 },
  { upTo: 25, factor: 0.75 },
  { upTo: Infinity, factor: 0.7 },
];

/** Άρθ. 6 §8 · 7 §8. */
export const ANCILLARY_COMPLETION = { frame: 0.8, masonry: 0.85, plaster: 0.9 } as const;

/** Άρθ. 6 §4: θέση αποθήκης — `perSe: true` ⇒ ο συντελεστής πολλαπλασιάζεται με τον ΣΕ. */
export const STORAGE_POSITION = {
  groundNotCounted: { factor: 0.3, perSe: true },
  basementStreetEntrance: { factor: 0.25, perSe: true },
  basementYardEntrance: { factor: 0.2, perSe: true },
  basementShopEntrance: { factor: 0.15, perSe: true },
  basementInternalEntrance: { factor: 0.15, perSe: false },
} as const;

/** Άρθ. 6 §9 (η αποθήκη: πρόχειρο 0,70, στέγη 0,80). */
export const STORAGE_CONSTRUCTION = { frame: 1.0, masonry: 0.95, makeshift: 0.7, lightRoof: 0.8 } as const;

/** Άρθ. 7 §4α: κλειστή θέση — γραμμή ανά κλιμάκιο ΣΕ `[υπόγειο, ισόγειο, όροφος]`. */
export const PARKING_CLOSED_BY_SE: readonly { readonly seUpTo: number; readonly levels: readonly [number, number, number] }[] = [
  { seUpTo: 1, levels: [0.2, 0.3, 0.25] },
  { seUpTo: 2, levels: [0.25, 0.35, 0.3] },
  { seUpTo: 3, levels: [0.3, 0.4, 0.35] },
  { seUpTo: Infinity, levels: [0.35, 0.45, 0.4] },
];

/** Άρθ. 7 §4β-γ: ανοιχτή θέση (ακάλυπτος/ασκεπές δώμα · πυλωτή) — **χωρίς** ΣΕ. */
export const PARKING_OPEN = { yardOrRoof: 0.1, pilotis: 0.15 } as const;

/** Άρθ. 7 §5: επιφάνεια όταν ο τίτλος δεν τη γράφει. */
export const PARKING_DEFAULT_AREA_M2 = 20;

/** Άρθ. 7 §9 (η θέση στάθμευσης: πρόχειρο 0,80, στέγη 0,90 — ΟΧΙ ίδια με αποθήκη). */
export const PARKING_CONSTRUCTION = { frame: 1.0, masonry: 0.95, makeshift: 0.8, lightRoof: 0.9 } as const;
