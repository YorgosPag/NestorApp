/**
 * @fileoverview ADR-942 Φ1 (Δ6 · Ε5) — **τι ζητά ο μηχανικός** μιας ανάθεσης έκδοσης, ως ΔΕΔΟΜΕΝΑ ανά είδος εγγράφου.
 * @related config/upload-entry-points/* (τα είδη αρχείων — ΚΑΝΕΝΑ νέο εδώ) · ADR-942 §9.5 (βαθμίδες)
 * @module config/document-requests/issuance-request-catalog
 *
 * 🔑 **Αντιστοίχιση με δήλωση, όχι με μαντεψιά**: κάθε στοιχείο ΕΙΝΑΙ ένα υπάρχον id του καταλόγου ανεβάσματος. Έτσι
 *    το «το έχει ήδη ο φάκελος» είναι **ερώτημα** (σκοπός του αρχείου), και το ανέβασμα πάει στη **σωστή** θέση.
 * 🔑 **Ολικός πίνακας**: νέο `DocumentKind` δεν μεταγλωττίζεται χωρίς απάντηση. Είδος χωρίς στοιχεία ⇒ `[]` ⇒ η
 *    ενότητα δεν εμφανίζεται (δεν ζητείται τίποτα που δεν δηλώθηκε).
 * ⚠️ **Δηλωμένο όριο (Ε5)**: η απόδοση σε βαθμίδα **δεν** την έχει επιβεβαιώσει εν ενεργεία ενεργειακός επιθεωρητής
 *    (`TIERS_VERIFIED = false`). Εκτός καταλόγου επίτηδες: το **Ε9** (έγγραφο επαφής, όχι ακινήτου — `owner-e9`) και το
 *    **φύλλο συντήρησης λέβητα** (δεν υπάρχει είδος αρχείου).
 *
 * **Layering**: leaf — μόνο δεδομένα, μηδέν I/O.
 */

import type { DocumentKind } from '@/config/document-validity/document-validity';

/**
 * «Τι κοστίζει η απουσία» (ADR-942 §9.5 — ΤΟΤΕΕ 20701-4):
 * - `A` ταυτοποίηση — δεν μαντεύεται ⇒ μπλοκάρει την υποβολή
 * - `B` γεωμετρία — αποτύπωση επί τόπου ⇒ χρόνος + πιθανή χρέωση
 * - `C` κέλυφος & συστήματα — παραδοχές της ΤΟΤΕΕ ⇒ συνήθως χειρότερη κλάση
 */
export const ISSUANCE_REQUEST_TIERS = ['A', 'B', 'C'] as const;
export type IssuanceRequestTier = (typeof ISSUANCE_REQUEST_TIERS)[number];

/** Ε5 — η απόδοση σε βαθμίδα είναι **προς επιβεβαίωση**· η οθόνη το λέει, δεν το κρύβει. */
export const ISSUANCE_REQUEST_TIERS_VERIFIED = false;

/**
 * Το **κλειστό** σύνολο των αιτήσιμων ειδών — κάθε id είναι υπάρχον id του καταλόγου ανεβάσματος (`entries-property.ts`
 * / `entries-studies.ts`). Κλειστό ώστε οι πίνακες ετικετών να είναι **ολικοί** (νέο είδος δεν μεταγλωττίζεται χωρίς λέξη).
 */
export const ISSUANCE_REQUEST_ITEM_IDS = [
  'study-admin-title-deed',
  'study-admin-cadastre',
  'study-admin-topographic',
  'unit-floor-plan',
  'unit-section-drawing',
  'unit-permit',
  'study-energy-insulation',
  'study-mep-hvac',
  'unit-electrical-plan',
  'study-energy-certificate',
] as const;
export type IssuanceRequestItemId = (typeof ISSUANCE_REQUEST_ITEM_IDS)[number];

/** Ένα αιτήσιμο στοιχείο: ένα **υπάρχον** είδος αρχείου του καταλόγου + η βαθμίδα του. */
export interface IssuanceRequestItem {
  /** Το id του καταλόγου ανεβάσματος — και η ταυτότητα του αιτήματος. */
  readonly itemId: IssuanceRequestItemId;
  readonly tier: IssuanceRequestTier;
}

const PEA_ITEMS: readonly IssuanceRequestItem[] = [
  { itemId: 'study-admin-title-deed', tier: 'A' },
  { itemId: 'study-admin-cadastre', tier: 'A' },
  { itemId: 'study-admin-topographic', tier: 'B' },
  { itemId: 'unit-floor-plan', tier: 'B' },
  { itemId: 'unit-section-drawing', tier: 'B' },
  { itemId: 'unit-permit', tier: 'B' },
  { itemId: 'study-energy-insulation', tier: 'C' },
  { itemId: 'study-mep-hvac', tier: 'C' },
  { itemId: 'unit-electrical-plan', tier: 'C' },
  { itemId: 'study-energy-certificate', tier: 'C' },
];

/** Ολικός: κάθε είδος εγγράφου απαντά — `[]` ⇒ «δεν ζητείται τίποτα ακόμη» (ρητό, όχι ξεχασμένο). */
export const ISSUANCE_REQUEST_CATALOG: Readonly<Record<DocumentKind, readonly IssuanceRequestItem[]>> = {
  'energy-certificate': PEA_ITEMS,
  'building-identity': [],
  'electrical-installation': [],
  'tax-clearance': [],
  'insurance-clearance': [],
  'enfia-certificate': [],
};

/** Τα αιτήσιμα στοιχεία ενός είδους. */
export function issuanceRequestItemsOf(kind: DocumentKind): readonly IssuanceRequestItem[] {
  return ISSUANCE_REQUEST_CATALOG[kind];
}

/** Στενεύει ένα αποθηκευμένο/ληφθέν id στο κλειστό σύνολο — `null` ⇒ δεν είναι αιτήσιμο είδος. */
export function asIssuanceRequestItemId(value: string): IssuanceRequestItemId | null {
  return ISSUANCE_REQUEST_ITEM_IDS.find((id) => id === value) ?? null;
}
