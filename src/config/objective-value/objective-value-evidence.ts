/**
 * @fileoverview ADR-949 Α-1 — **ποιο επίσημο έγγραφο δίνει κάθε είσοδο του υπολογιστή, και από πού βγαίνει**. Μόνο
 *   δεδομένα· τη σειρά την αποφασίζει το `lib/objective-value/objective-value-evidence-plan.ts`.
 * @related `lib/objective-value/objective-value-types.ts` (`ObjectiveValueMissing` — το κλειδί) ·
 *   `config/upload-entry-points/*` (τα είδη αρχείων — ΚΑΝΕΝΑ νέο εδώ) · `config/document-validity/document-issuers.ts`
 *   (`AUTHORITY_SERVICE_SPECS` — φορέας και είσοδος) · ADR-949 §5 Α1
 * @module config/objective-value/objective-value-evidence
 *
 * 🔑 **Το έγγραφο ΕΙΝΑΙ id του καταλόγου ανεβάσματος** (ίδιο μοτίβο με το `issuance-request-catalog.ts`): το Α-6
 *    «κράτησέ το στον φάκελό μου» πηγαίνει στη **σωστή** θέση χωρίς δεύτερη αντιστοίχιση.
 * 🔑 **Ολικός πίνακας**: νέο `ObjectiveValueMissing` δεν μεταγλωττίζεται χωρίς απάντηση. Είσοδος που κανένα έγγραφο
 *    δεν τη γράφει ⇒ `none` **με λόγο** — η οθόνη το λέει, δεν το αποσιωπά.
 * 🔴 **Μόνο ό,τι αποδείχθηκε**: «πού θα το δείτε» (`whereKey`) υπάρχει **μόνο** όταν το πεδίο βρέθηκε σε πραγματικό
 *    δείγμα (ανωνυμοποιημένο, 2026-11-22: 2 Ε9 · 3 αναγνώσιμα ΕΝΦΙΑ · 4 πράξεις e-Άδειες). Το ΠΕΑ **λείπει επίτηδες**:
 *    το εμβαδόν του είναι ωφέλιμο (όχι αυτό που ζητά ο υπολογιστής) και κανένα δείγμα δεν έδειξε «κεντρική θέρμανση».
 * ⛔ **Καμία ετικέτα εδώ** (N.11): οι λέξεις ζουν στο `objective-value.json`.
 *
 * **Layering**: leaf — μόνο δεδομένα, μηδέν I/O.
 */

import type { AuthorityService } from '@/config/document-validity/document-issuers';
import type { ObjectiveValueMissing } from '@/lib/objective-value/objective-value-types';

/** Τα έγγραφα του οδηγού — **υπάρχοντα** id του καταλόγου ανεβάσματος. Κλειστό: οι πίνακες ετικετών είναι ολικοί. */
export const OBJECTIVE_VALUE_EVIDENCE_DOCUMENTS = ['owner-e9', 'owner-enfia-assessment', 'unit-permit', 'title-deed'] as const;
export type ObjectiveValueEvidenceDocument = (typeof OBJECTIVE_VALUE_EVIDENCE_DOCUMENTS)[number];

/**
 * Πώς το αποκτά ο άνθρωπος:
 * - `authority` — μόνος του, από ψηφιακή υπηρεσία φορέα ({@link AuthorityService})
 * - `held`      — το έχει ήδη (το συμβόλαιο το παρέδωσε ο συμβολαιογράφος στην απόκτηση)
 */
export type ObjectiveValueEvidenceObtain =
  | { readonly kind: 'authority'; readonly service: AuthorityService }
  | { readonly kind: 'held' };

export const OBJECTIVE_VALUE_EVIDENCE_DOCUMENT_SPECS: Readonly<Record<ObjectiveValueEvidenceDocument, ObjectiveValueEvidenceObtain>> = {
  'owner-e9': { kind: 'authority', service: 'aade-e9' },
  'owner-enfia-assessment': { kind: 'authority', service: 'aade-enfia-assessment' },
  'unit-permit': { kind: 'authority', service: 'ypen-e-adeies-search' },
  'title-deed': { kind: 'held' },
};

/** «Πού στο έγγραφο» — κλειδιά locale, ένα ανά (έγγραφο, πεδίο) που **είδαμε** σε δείγμα. */
export type ObjectiveValueEvidenceWhereKey =
  | 'objective-value:evidence.where.e9Area'
  | 'objective-value:evidence.where.e9Floor'
  | 'objective-value:evidence.where.enfiaArea'
  | 'objective-value:evidence.where.enfiaFloor'
  | 'objective-value:evidence.where.permitDate';

export interface ObjectiveValueEvidenceSource {
  readonly document: ObjectiveValueEvidenceDocument;
  /** `null` = το έγγραφο το γράφει, αλλά δεν το είδαμε σε δείγμα ⇒ δεν υποσχόμαστε θέση. */
  readonly whereKey: ObjectiveValueEvidenceWhereKey | null;
}

/**
 * Γιατί καμία πηγή:
 * - `zone-tables`   — βγαίνει από τους πίνακες ζωνών της θέσης, όχι από έγγραφο του ιδιοκτήτη
 * - `property-fact` — γεγονός του ακινήτου που ξέρει ο άνθρωπος· κανένα δείγμα εγγράφου δεν το γράφει
 */
export const OBJECTIVE_VALUE_NO_EVIDENCE_REASONS = ['zone-tables', 'property-fact'] as const;
export type ObjectiveValueNoEvidenceReason = (typeof OBJECTIVE_VALUE_NO_EVIDENCE_REASONS)[number];

export type ObjectiveValueEvidence =
  | { readonly kind: 'documents'; readonly sources: readonly ObjectiveValueEvidenceSource[] }
  | { readonly kind: 'none'; readonly reason: ObjectiveValueNoEvidenceReason };

const E9 = 'owner-e9';
const ENFIA = 'owner-enfia-assessment';
const PERMIT = 'unit-permit';
const DEED = 'title-deed';

function documents(...sources: ObjectiveValueEvidenceSource[]): ObjectiveValueEvidence {
  return { kind: 'documents', sources };
}

/** Η σειρά των πηγών μέσα σε κάθε γραμμή = σειρά προτίμησης (ισοπαλία στο πλάνο). */
export const OBJECTIVE_VALUE_EVIDENCE: Readonly<Record<ObjectiveValueMissing, ObjectiveValueEvidence>> = {
  area: documents(
    { document: E9, whereKey: 'objective-value:evidence.where.e9Area' },
    { document: ENFIA, whereKey: 'objective-value:evidence.where.enfiaArea' },
    { document: DEED, whereKey: null },
  ),
  floor: documents(
    { document: E9, whereKey: 'objective-value:evidence.where.e9Floor' },
    { document: ENFIA, whereKey: 'objective-value:evidence.where.enfiaFloor' },
    { document: DEED, whereKey: null },
  ),
  // Ο υπολογιστής ζητά την ΗΜΕΡΟΜΗΝΙΑ ΑΔΕΙΑΣ (ετικέτα `result.missing.ageYears`). Το «έτος κατασκευής» του Ε9/ΕΝΦΙΑ
  // είναι άλλο μέγεθος — θα ήταν υπόθεση, όχι απόδειξη· γι' αυτό δεν μπαίνει εδώ.
  ageYears: documents({ document: PERMIT, whereKey: 'objective-value:evidence.where.permitDate' }),
  // ADR-949 Α-3: η πράξη ΕΝΦΙΑ γράφει τιμή ζώνης, αλλά **χρονολογημένη** (1/1 του έτους της πράξης — το ΕΝΦΙΑ 2020 έχει
  // τιμή πριν από αναθεώρηση 2022, μετρημένο). Αυθεντία είναι ο πίνακας ζωνών της θέσης· το έγγραφο μόνο διασταυρώνεται.
  zonePrice: { kind: 'none', reason: 'zone-tables' },
  // ΣΑΟ και ΣΕ είναι στήλες των πινάκων ζωνών (όπως η τιμή ζώνης) — όχι μεγέθη της άδειας ή του Ε9.
  plotUtilisation: { kind: 'none', reason: 'zone-tables' },
  commercialityFactor: { kind: 'none', reason: 'zone-tables' },
  frontage: { kind: 'none', reason: 'property-fact' },
  hasCentralHeating: { kind: 'none', reason: 'property-fact' },
  hasElevator: { kind: 'none', reason: 'property-fact' },
  position: { kind: 'none', reason: 'property-fact' },
  completion: { kind: 'none', reason: 'property-fact' },
};
