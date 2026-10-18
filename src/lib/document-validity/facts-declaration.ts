/**
 * =============================================================================
 * «Συμπλήρωση στοιχείων» — η δήλωση γεγονότων εγγράφου από το μητρώο λήξεων (ADR-915 §33)
 * =============================================================================
 *
 * Arthur Online: ένα έγγραφο συμμόρφωσης «λείπει» μέχρι να υπάρχει **και** αρχείο **και** ημερομηνία. Εδώ το αρχείο
 * που **υπόσχεται** παρακολουθούμενο είδος αλλά δεν έχει γεγονότα (ΥΔΕ · σαρωμένη φορολογική) φαίνεται στο μητρώο, και
 * ο άνθρωπος δηλώνει έκδοση · τυπωμένη λήξη · κατηγορία. **Ο ΙΔΙΟΣ κριτής** τρέχει στον διάλογο (ζωντανά) και στον
 * διακομιστή (πριν από τον ΕΝΑ γραφέα) — καμία δεύτερη επικύρωση που θα απέκλινε.
 *
 * 🔑 **Ποιος μπορεί να διορθώσει τι**: η δήλωση του μητρώου είναι η **ελαφρύτερη** μαρτυρία (`DOCUMENT_ATTESTATION_PATHS`).
 *    Ό,τι διάβασε ο αναγνώστης ή ενέκρινε ελεγκτής μεταβίβασης **δεν** αλλάζει από εδώ — η ενέργεια δεν προσφέρεται, και
 *    ο γραφέας την αρνείται (`outranked`) αν φτάσει.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O, μηδέν ρολόι.
 *
 * @module lib/document-validity/facts-declaration
 */

import { z } from 'zod';

import { isDateKey } from '@/lib/calendar/date-key';
import {
  DOCUMENT_KINDS,
  documentKindSpec,
  isClassificationOf,
  type DocumentClassification,
  type DocumentKind,
} from '@/config/document-validity/document-validity';
import type { RegistryDocument } from '@/lib/document-validity/document-registry';

// =============================================================================
// 1. ΠΟΤΕ ΠΡΟΣΦΕΡΕΤΑΙ
// =============================================================================

/** `declare` = το αρχείο δεν έχει γεγονότα · `correct` = τα δήλωσε άνθρωπος από το μητρώο και διορθώνονται. */
export type FactsDeclarationMode = 'declare' | 'correct';

/**
 * Προσφέρεται «Συμπλήρωση» / «Διόρθωση» για αυτή τη γραμμή; Μόνο για **αρχείο** (δήλωση ακινήτου ή έγκριση υπόθεσης
 * διορθώνονται εκεί όπου γεννήθηκαν), και μόνο όταν τίποτα βαρύτερο δεν έχει μιλήσει.
 */
export function factsDeclarationOf(document: Pick<RegistryDocument, 'origin' | 'source'>): FactsDeclarationMode | null {
  if (document.origin.kind !== 'file') return null;
  if (document.source === null) return 'declare';
  return document.source.kind === 'attested' && document.source.via === 'registry-declaration' ? 'correct' : null;
}

// =============================================================================
// 2. Ο ΚΡΙΤΗΣ — client και server
// =============================================================================

/**
 * Γιατί μια δήλωση δεν γίνεται δεκτή:
 * - `empty`                  — καμία ημερομηνία· μια δήλωση χωρίς τίποτα θα έκρυβε το «χωρίς στοιχεία»
 * - `invalid-date`           — τιμή που δεν είναι ημέρα `YYYY-MM-DD`
 * - `not-printed`            — τυπωμένη λήξη για είδος που **δεν** τυπώνει λήξη (π.χ. ΠΕΑ: 10 έτη από την έκδοση)
 * - `validity-before-issue`  — λήξη πριν από την έκδοση (ADR-915 §14 Ε4: άρνηση, ποτέ μαντεψιά ποια είναι λάθος)
 * - `classification-invalid` — κατηγορία εκτός του λεξιλογίου **του είδους**
 */
export const FACTS_DECLARATION_REFUSALS = [
  'empty',
  'invalid-date',
  'not-printed',
  'validity-before-issue',
  'classification-invalid',
] as const;
export type FactsDeclarationRefusal = (typeof FACTS_DECLARATION_REFUSALS)[number];

/**
 * Οι αρνήσεις που ξέρει **μόνο** ο διακομιστής (το αρχείο · ο ΕΝΑΣ γραφέας):
 * - `absent`            — όχι (πια) ζωντανό αρχείο **του γραφείου** (ξένο ≡ ανύπαρκτο)
 * - `kind-not-promised` — η θέση του αρχείου δεν φιλοξενεί αυτό το είδος εγγράφου
 * - `not-this-object`   — νέα έκδοση του αρχείου στο μεταξύ (CAS)
 * - `outranked`         — τα στοιχεία διαβάστηκαν από το έγγραφο ή εγκρίθηκαν στον έλεγχο μεταβίβασης· διορθώνονται εκεί
 */
export const FACTS_DECLARATION_SERVER_REFUSALS = ['absent', 'kind-not-promised', 'not-this-object', 'outranked'] as const;
export type FactsDeclarationServiceRefusal = FactsDeclarationRefusal | (typeof FACTS_DECLARATION_SERVER_REFUSALS)[number];

/** Άρνηση → κωδικός της απόκρισης: ΕΝΑΣ πίνακας για το route (γράφει) και την οθόνη (διαβάζει). */
export const FACTS_DECLARATION_ERROR_CODES: Readonly<Record<FactsDeclarationServiceRefusal, string>> = {
  absent: 'NOT_FOUND',
  'kind-not-promised': 'KIND_NOT_PROMISED',
  'not-this-object': 'STALE_FILE',
  outranked: 'OUTRANKED',
  empty: 'EMPTY_DECLARATION',
  'invalid-date': 'INVALID_DATE',
  'not-printed': 'NOT_PRINTED',
  'validity-before-issue': 'VALIDITY_BEFORE_ISSUE',
  'classification-invalid': 'CLASSIFICATION_INVALID',
};

/** Ο κωδικός της απόκρισης → η άρνηση· άγνωστος κωδικός ή δίκτυο ⇒ `null` («δεν αποθηκεύτηκε»). */
export function factsDeclarationRefusalOfCode(code: string | null): FactsDeclarationServiceRefusal | null {
  const all: readonly FactsDeclarationServiceRefusal[] = [...FACTS_DECLARATION_REFUSALS, ...FACTS_DECLARATION_SERVER_REFUSALS];
  return all.find((refusal) => FACTS_DECLARATION_ERROR_CODES[refusal] === code) ?? null;
}

export interface FactsDeclarationInput {
  readonly kind: DocumentKind;
  readonly issuedOn: string | null;
  readonly printedValidUntil: string | null;
  /** `null` = «το έγγραφο δεν τη γράφει / δεν ξέρω» ⇒ ισχύει το μέγιστο του καθεστώτος ως ανώτατο (ADR-915 §32 Υ4). */
  readonly classification: string | null;
}

/** Τα γεγονότα που δηλώνονται — ήδη ελεγμένα. */
export interface DeclaredFacts {
  readonly issuedOn: string | null;
  readonly printedValidUntil: string | null;
  readonly classification: DocumentClassification | null;
}

export type FactsDeclarationJudgement =
  | { readonly ok: true; readonly facts: DeclaredFacts }
  | { readonly ok: false; readonly refusal: FactsDeclarationRefusal };

const validDate = (value: string | null): boolean => value === null || isDateKey(value);

/** Δέχεται τυπωμένη λήξη αυτό το είδος; — μόνο ο κανόνας `printed` (ADR-915 §14). */
export function acceptsPrintedValidity(kind: DocumentKind): boolean {
  return documentKindSpec(kind).rule.kind === 'printed';
}

/** **Ο ΕΝΑΣ κριτής της δήλωσης.** Κάθε άρνηση έχει όνομα· τίποτα δεν διορθώνεται σιωπηλά. */
export function judgeFactsDeclaration(input: FactsDeclarationInput): FactsDeclarationJudgement {
  const { kind, issuedOn, printedValidUntil, classification } = input;
  if (!validDate(issuedOn) || !validDate(printedValidUntil)) return { ok: false, refusal: 'invalid-date' };
  if (issuedOn === null && printedValidUntil === null) return { ok: false, refusal: 'empty' };
  if (printedValidUntil !== null && !acceptsPrintedValidity(kind)) return { ok: false, refusal: 'not-printed' };
  if (issuedOn !== null && printedValidUntil !== null && printedValidUntil < issuedOn) {
    return { ok: false, refusal: 'validity-before-issue' };
  }
  if (classification === null) return { ok: true, facts: { issuedOn, printedValidUntil, classification: null } };
  if (!isClassificationOf(kind, classification)) return { ok: false, refusal: 'classification-invalid' };
  return { ok: true, facts: { issuedOn, printedValidUntil, classification } };
}

// =============================================================================
// 3. ΤΟ ΑΙΤΗΜΑ — ένα σχήμα για client και server
// =============================================================================

/** Το σώμα του `PUT /api/document-registry/document-facts`. Η μορφή των ημερομηνιών κρίνεται από τον κριτή, όχι εδώ. */
export const factsDeclarationBody = z.object({
  fileId: z.string().trim().min(1),
  kind: z.enum(DOCUMENT_KINDS),
  issuedOn: z.string().nullable(),
  printedValidUntil: z.string().nullable(),
  classification: z.string().nullable(),
  /** Το αντικείμενο που είδε η οθόνη — CAS: νέα έκδοση στο μεταξύ ⇒ άρνηση (`expectedStoragePath` του γραφέα). */
  storagePath: z.string().trim().min(1),
});

export type FactsDeclarationBody = z.infer<typeof factsDeclarationBody>;
