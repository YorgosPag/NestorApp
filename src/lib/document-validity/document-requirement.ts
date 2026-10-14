/**
 * =============================================================================
 * Απαιτήσεις εγγράφων — «σε ισχύ ΟΤΑΝ χρειάζεται» + «τι σταματά αν λήξει αυτό» (ADR-915 Φ2)
 * =============================================================================
 *
 * Κάθε διαδικασία **δηλώνει** ποιο έγγραφο θέλει σε ισχύ και **για πότε** (`DocumentRequirement`). Από τις δηλώσεις
 * παράγονται δύο όψεις, και καμία δεν αποθηκεύεται:
 *
 *  - **`documentStanding`** — ο ΕΝΑΣ κριτής «ισχύει / λήγει / έληξε / δεν ξέρουμε», ως προς **σήμερα** ΚΑΙ ως προς
 *    **τη μέρα που χρειάζεται**. Τον ρωτά ο κατάλογος μεταβίβασης (`deriveChecklist`)· το `validOnSigning` είναι πλέον
 *    το `validAtNeed` του.
 *  - **`dependentsOf`** — η ανάποδη όψη: «αν λήξει αυτό το έγγραφο, ποιες διαδικασίες σταματούν, με ποια πολιτική,
 *    από ποια μέρα». Δεν τη βρήκαμε σε κανέναν μεγάλο (ADR-915 §2): το Procore λέει «non-compliant», δεν λέει
 *    «και αυτό σταματά την πληρωμή Χ και την υπογραφή Υ».
 *
 * 🔑 **Οι απαιτήσεις δεν γράφονται εδώ.** Τις **παράγουν** οι υπάρχοντες κατάλογοι — ο κατάλογος μεταβίβασης
 * (`lib/conveyance/conveyance-requirements.ts`) και ο πίνακας νομιμότητας (`lib/legality/publication-requirements.ts`).
 * Ένας τρίτος, χειρόγραφος κατάλογος «ποια διαδικασία ζητά τι» θα ήταν ελεύθερος να αποκλίνει από αυτούς.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O, **μηδέν ρολόι** (το `asOf` το δίνει ο καλών).
 *
 * @module lib/document-validity/document-requirement
 */

import { addDaysToDateKey, isDateKey } from '@/lib/calendar/date-key';
import type { DocumentKind } from '@/config/document-validity/document-validity';

// =============================================================================
// 1. ΤΟ ΛΕΞΙΛΟΓΙΟ
// =============================================================================

/**
 * **Πότε** πρέπει να ισχύει το έγγραφο:
 * - `on`          — μία συγκεκριμένη μέρα (η υπογραφή του συμβολαίου)
 * - `continuous`  — όσο τρέχει η διαδικασία (δημοσιευμένη αγγελία)
 * - `unscheduled` — τη μέρα μιας πράξης που **δεν ορίστηκε ακόμη**. Όχι `null`: το `null` θα διαβαζόταν «δεν χρειάζεται».
 */
export type NeededOn =
  | { readonly kind: 'on'; readonly day: string }
  | { readonly kind: 'continuous' }
  | { readonly kind: 'unscheduled' };

/** `block` = η διαδικασία δεν προχωρά· `warn` = προχωρά, και το λέει (ADR-915 Α1: η αγγελία μένει, γράφει «έληξε»). */
export type RequirementPolicy = 'block' | 'warn';

/** Οι διαδικασίες που ζητούν έγγραφα σε ισχύ. Κλειστό σύνολο. */
export const DOCUMENT_PROCESSES = ['conveyance', 'listing-publication'] as const;
export type DocumentProcess = (typeof DOCUMENT_PROCESSES)[number];

/** Ποια **συγκεκριμένη** διαδικασία — ώστε το «τι σταματά» να δείχνει υπόθεση/αγγελία, όχι είδος. */
export type RequirementProcessRef =
  | { readonly kind: 'conveyance'; readonly caseId: string }
  | { readonly kind: 'listing-publication'; readonly listingId: string };

/**
 * **Γιατί** το ζητά — ποτέ σιωπηλό:
 * - `checklist-item` — γραμμή του καταλόγου μεταβίβασης (ADR-901 §5.5· επαληθεύεται από επαγγελματία, §11)
 * - `statute`        — κελί `raised` του πίνακα νομιμότητας, με τη διάταξη
 * - `unresolved`     — κελί `unresolved`: δεν ξέρουμε αν το ζητά ο νόμος, και **το λέμε** αντί να το σβήσουμε
 */
export type RequirementBasis =
  | { readonly kind: 'checklist-item'; readonly itemId: string; readonly verifiedAt: string | null }
  | { readonly kind: 'statute'; readonly statute: string }
  | { readonly kind: 'unresolved'; readonly question: string };

/** Το ακίνητο που αφορά το έγγραφο (ΠΕΑ και ταυτότητα κτιρίου είναι αξιώσεις `whole-property`, ADR-838). */
export interface RequirementSubject {
  readonly propertyId: string;
}

/** Μία δήλωση: «αυτή η διαδικασία θέλει αυτό το έγγραφο, για αυτό το ακίνητο, σε ισχύ τότε». */
export interface DocumentRequirement {
  readonly documentKind: DocumentKind;
  readonly subject: RequirementSubject;
  readonly process: RequirementProcessRef;
  readonly neededOn: NeededOn;
  readonly policy: RequirementPolicy;
  /** Πόσες μέρες πριν τη λήξη η κατάσταση γίνεται `expiring` για **αυτή** τη διαδικασία. */
  readonly warnWindowDays: number;
  readonly basis: RequirementBasis;
}

// =============================================================================
// 2. Ο ΚΡΙΤΗΣ — ισχύει σήμερα, και τη μέρα που χρειάζεται;
// =============================================================================

export type DocumentStandingState = 'valid' | 'expiring' | 'expired' | 'expiry-unknown';

export interface DocumentStanding {
  readonly state: DocumentStandingState;
  readonly expiresOn: string | null;
  /** Ισχύει τη μέρα που χρειάζεται; `null` = η μέρα ή η λήξη δεν είναι γνωστή — **ποτέ** «ναι». */
  readonly validAtNeed: boolean | null;
}

export interface DocumentStandingInput {
  /** Τελευταία μέρα ισχύος (`YYYY-MM-DD`, μέσα) — από το `ruleExpiresOn`/`documentExpiry`. */
  readonly expiresOn: string | null;
  /** Σήμερα, `YYYY-MM-DD`. */
  readonly asOf: string;
  readonly neededOn: NeededOn;
  readonly warnWindowDays: number;
}

/** Ισχύει τη μέρα που χρειάζεται; Η τελευταία μέρα είναι μέσα (`>=`). */
function validAtNeedOf(expiresOn: string, asOf: string, neededOn: NeededOn): boolean | null {
  if (neededOn.kind === 'continuous') return expiresOn >= asOf;
  if (neededOn.kind === 'unscheduled' || !isDateKey(neededOn.day)) return null;
  return expiresOn >= neededOn.day;
}

/**
 * **Ο ΕΝΑΣ κριτής** — `expired` όταν η τελευταία μέρα πέρασε· `expiring` όταν μπήκαμε στο παράθυρο **ή** δεν θα
 * ισχύει τη μέρα που χρειάζεται· αλλιώς `valid`. Άγνωστη λήξη ⇒ `expiry-unknown`, ποτέ `valid` (ADR-915 §3.3).
 */
export function documentStanding({ expiresOn, asOf, neededOn, warnWindowDays }: DocumentStandingInput): DocumentStanding {
  if (expiresOn === null || !isDateKey(expiresOn)) return { state: 'expiry-unknown', expiresOn: null, validAtNeed: null };
  const validAtNeed = validAtNeedOf(expiresOn, asOf, neededOn);
  if (expiresOn < asOf) return { state: 'expired', expiresOn, validAtNeed };
  const warnFrom = addDaysToDateKey(expiresOn, -warnWindowDays) ?? expiresOn;
  const expiring = asOf >= warnFrom || validAtNeed === false;
  return { state: expiring ? 'expiring' : 'valid', expiresOn, validAtNeed };
}

// =============================================================================
// 3. Η ΑΝΑΠΟΔΗ ΟΨΗ — τι σταματά αν λήξει αυτό
// =============================================================================

/** Ένα συγκεκριμένο έγγραφο, όπως το ξέρει ο καλών. */
export interface TrackedDocument {
  readonly kind: DocumentKind;
  readonly subject: RequirementSubject;
  readonly expiresOn: string | null;
}

/**
 * - `stops`        — η διαδικασία **θα** βρεθεί χωρίς έγκυρο έγγραφο (από το `stopsOn`)
 * - `unaffected`   — το έγγραφο καλύπτει τη μέρα που χρειάζεται
 * - `undetermined` — η λήξη ή η μέρα δεν είναι γνωστή. **Ποτέ** «ανεπηρέαστο» από άγνοια.
 */
export type DependentImpact = 'stops' | 'unaffected' | 'undetermined';

export interface DocumentDependent {
  readonly requirement: DocumentRequirement;
  readonly impact: DependentImpact;
  /** Η πρώτη μέρα **εκτός** ισχύος (`expiresOn + 1`) — μόνο όταν `impact === 'stops'`. */
  readonly stopsOn: string | null;
}

function impactOf(expiresOn: string | null, neededOn: NeededOn): DependentImpact {
  if (expiresOn === null || !isDateKey(expiresOn)) return 'undetermined';
  if (neededOn.kind === 'continuous') return 'stops';
  if (neededOn.kind === 'unscheduled' || !isDateKey(neededOn.day)) return 'undetermined';
  return expiresOn < neededOn.day ? 'stops' : 'unaffected';
}

function dependentOf(document: TrackedDocument, requirement: DocumentRequirement): DocumentDependent {
  const impact = impactOf(document.expiresOn, requirement.neededOn);
  const stopsOn = impact === 'stops' && document.expiresOn !== null ? addDaysToDateKey(document.expiresOn, 1) : null;
  return { requirement, impact, stopsOn };
}

const POLICY_ORDER: Readonly<Record<RequirementPolicy, number>> = { block: 0, warn: 1 };

/** `block` πρώτα, μετά η νωρίτερη μέρα διακοπής· το άγνωστο στο τέλος της ομάδας του (σταθερή σειρά). */
function byUrgency(a: DocumentDependent, b: DocumentDependent): number {
  const policy = POLICY_ORDER[a.requirement.policy] - POLICY_ORDER[b.requirement.policy];
  if (policy !== 0) return policy;
  return (a.stopsOn ?? '9999-99-99').localeCompare(b.stopsOn ?? '9999-99-99');
}

/**
 * **Αν λήξει αυτό το έγγραφο, τι σταματά;** — οι απαιτήσεις **του ίδιου είδους, για το ίδιο ακίνητο**, η καθεμία με
 * τον αντίκτυπό της. Χωρίς ρολόι: η απάντηση αφορά τη λήξη του εγγράφου, όχι το σήμερα.
 */
export function dependentsOf(
  document: TrackedDocument,
  requirements: readonly DocumentRequirement[],
): readonly DocumentDependent[] {
  return requirements
    .filter((requirement) => requirement.documentKind === document.kind)
    .filter((requirement) => requirement.subject.propertyId === document.subject.propertyId)
    .map((requirement) => dependentOf(document, requirement))
    .sort(byUrgency);
}
