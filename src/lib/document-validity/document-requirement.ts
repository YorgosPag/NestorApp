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

/**
 * Η μέρα πράξης που **δεν ξέρουμε**: δεν ορίστηκε ακόμη, ή είναι αδιάβαστη. Ένας κανόνας για όσους ρωτούν, ώστε ο
 * κριτής και η ετικέτα «γιατί δεν κρίνεται» να μη διαφωνούν (ADR-915 §15).
 */
export function isNeededDayUnknown(neededOn: NeededOn): boolean {
  return neededOn.kind === 'unscheduled' || (neededOn.kind === 'on' && !isDateKey(neededOn.day));
}

/** `block` = η διαδικασία δεν προχωρά· `warn` = προχωρά, και το λέει (ADR-915 Α1: η αγγελία μένει, γράφει «έληξε»). */
export type RequirementPolicy = 'block' | 'warn';

/**
 * Οι διαδικασίες που ζητούν έγγραφα σε ισχύ. Κλειστό σύνολο. `property-upkeep` (ADR-915 §35) = η **μόνιμη υποχρέωση**
 * του ακινήτου: ζει όσο ζει το ακίνητο, και υπάρχει **μόνο** όταν την επιβεβαίωσε άνθρωπος.
 */
export const DOCUMENT_PROCESSES = ['conveyance', 'listing-publication', 'property-upkeep'] as const;
export type DocumentProcess = (typeof DOCUMENT_PROCESSES)[number];

/** Ποια **συγκεκριμένη** διαδικασία — ώστε το «τι σταματά» να δείχνει υπόθεση/αγγελία/ακίνητο, όχι είδος. */
export type RequirementProcessRef =
  | { readonly kind: 'conveyance'; readonly caseId: string }
  | { readonly kind: 'listing-publication'; readonly listingId: string }
  | { readonly kind: 'property-upkeep'; readonly propertyId: string };

/**
 * **Γιατί** το ζητά — ποτέ σιωπηλό:
 * - `checklist-item`      — γραμμή του καταλόγου μεταβίβασης (ADR-901 §5.5· επαληθεύεται από επαγγελματία, §11)
 * - `statute`             — κελί `raised` του πίνακα νομιμότητας, με τη διάταξη
 * - `unresolved`          — κελί `unresolved`: δεν ξέρουμε αν το ζητά ο νόμος, και **το λέμε** αντί να το σβήσουμε
 * - `standing-obligation` — μόνιμη υποχρέωση (ADR-915 §35): η διάταξη **και** ποιος την επιβεβαίωσε για αυτό το
 *                           ακίνητο, πότε. Ο νόμος λέει «ισχύει για εγκαταστάσεις»· ότι **αυτό** το ακίνητο έχει τέτοια
 *                           εγκατάσταση το λέει άνθρωπος, και το ίχνος του μένει στη βάση.
 */
export type RequirementBasis =
  | { readonly kind: 'checklist-item'; readonly itemId: string; readonly verifiedAt: string | null }
  | { readonly kind: 'statute'; readonly statute: string }
  | { readonly kind: 'unresolved'; readonly question: string }
  | {
    readonly kind: 'standing-obligation';
    readonly statute: string;
    readonly declaredAt: string;
    readonly declaredByUid: string;
  };

/**
 * ADR-915 §25 (5γ) — το **πρόσωπο** που αφορά το έγγραφο, όταν εκδίδεται ανά πρόσωπο (φορολογική · ασφαλιστική · ΕΝΦΙΑ:
 * §22.2). Το `key` είναι η ταυτότητα του προσώπου στη διαδικασία (στη μεταβίβαση: `sellerKeyOf` = η επαφή του), ώστε
 * δύο συμπωλητές να είναι **δύο** απαιτήσεις, **δύο** κάτοχοι, **δύο** γραμμές — ποτέ μία που «καλύπτει» και τους δύο.
 */
export interface RequirementParty {
  readonly key: string;
  /** Η επαφή του προσώπου — `null` όταν ο πωλητής δεν έχει (ακόμη) επαφή (`UNIDENTIFIED_SELLER_KEY`). */
  readonly contactId: string | null;
}

/** Το ακίνητο που αφορά το έγγραφο (ΠΕΑ και ταυτότητα κτιρίου είναι αξιώσεις `whole-property`, ADR-838). */
export interface RequirementSubject {
  readonly propertyId: string;
  /** `null` = έγγραφο **του ακινήτου** (ΠΕΑ · ταυτότητα)· αλλιώς το πρόσωπο που το φέρνει (§25). */
  readonly party: RequirementParty | null;
}

/** Η μία σύνθεση «ομάδα + πρόσωπο» — κάθε ταυτότητα γραμμής/ομάδας που ξεχωρίζει πρόσωπα περνά από εδώ. */
export function withPartySuffix(base: string, party: RequirementParty | null): string {
  return party === null ? base : `${base}@${party.key}`;
}

/**
 * **Λέγεται η απουσία του;** (ADR-915 Φ4δ Ε7)
 * - `required` — η διαδικασία **οφείλει** να το έχει: χωρίς έγγραφο, το μητρώο γράφει «λείπει».
 * - `tracked`  — παρακολουθείται **η ισχύς του, αν υπάρχει**. Άγνωστο γεγονός ή ανοιχτή νομική ερώτηση: «λείπει» από
 *                άγνοια θα ήταν ισχυρισμός που δεν στέκει.
 */
export type RequirementPresence = 'required' | 'tracked';

/**
 * **Ο επαγγελματίας ενέκρινε έγγραφο γι' αυτή την απαίτηση** (ADR-915 Φ4δ Ε8) — ο έλεγχος της γραμμής του καταλόγου
 * (`review.verdict === 'accepted'`). `fileId: null` = παραλαβή εκτός πλατφόρμας (γραμμές `offline`, π.χ. ταυτότητα
 * κτιρίου). Είναι **έγγραφο που υπάρχει**, άρα ποτέ «λείπει»· και το `fileId` δένει ρητά αρχείο χωρίς ακίνητο (Δ3).
 */
export interface RequirementAttestation {
  readonly fileId: string | null;
  /** Η ημερομηνία έκδοσης που δήλωσε ο ελεγκτής (`YYYY-MM-DD`) — η εφεδρεία του καταλόγου όταν το αρχείο δεν ξέρει. */
  readonly issuedOn: string | null;
  /** Η τυπωμένη λήξη που δήλωσε ο ελεγκτής (ADR-915 §14) — ίδια εφεδρεία, για τα είδη με κανόνα `printed`. */
  readonly printedValidUntil: string | null;
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
  readonly presence: RequirementPresence;
  /** `null` = κανείς επαγγελματίας δεν ενέκρινε έγγραφο γι' αυτή την απαίτηση (ή η διαδικασία δεν έχει έλεγχο). */
  readonly attestation: RequirementAttestation | null;
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
  if (neededOn.kind === 'unscheduled' || isNeededDayUnknown(neededOn)) return null;
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
  /** `null` = το έγγραφο δεν δένεται σε ακίνητο (π.χ. ΠΕΑ επιπέδου έργου, Δ3). */
  readonly subject: RequirementSubject | null;
  /** Το αρχείο του — για τον **ρητό** δεσμό μιας βεβαίωσης ({@link RequirementAttestation}). */
  readonly fileId: string | null;
  readonly expiresOn: string | null;
}

/**
 * - `stops`        — η διαδικασία **θα** βρεθεί χωρίς έγκυρο έγγραφο (από το `stopsOn`)
 * - `unaffected`   — το έγγραφο καλύπτει τη μέρα που χρειάζεται
 * - `undetermined` — η λήξη ή η μέρα δεν είναι γνωστή. **Ποτέ** «ανεπηρέαστο» από άγνοια.
 * - `absent`       — **δεν υπάρχει** έγγραφο: η διαδικασία είναι ήδη χωρίς έγκυρο (ADR-915 Φ4δ Ε7).
 */
export type DependentImpact = 'stops' | 'unaffected' | 'undetermined' | 'absent';

export interface DocumentDependent {
  readonly requirement: DocumentRequirement;
  readonly impact: DependentImpact;
  /** Η πρώτη μέρα **εκτός** ισχύος (`expiresOn + 1`) — μόνο όταν `impact === 'stops'`. */
  readonly stopsOn: string | null;
}

function impactOf(expiresOn: string | null, neededOn: NeededOn): DependentImpact {
  if (expiresOn === null || !isDateKey(expiresOn)) return 'undetermined';
  if (neededOn.kind === 'continuous') return 'stops';
  if (neededOn.kind === 'unscheduled' || isNeededDayUnknown(neededOn)) return 'undetermined';
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
 * **Καλύπτει αυτό το έγγραφο αυτή την απαίτηση;** — ο ΕΝΑΣ κριτής (ADR-915 Φ4δ Ε9): ίδιο είδος, και
 *  - ο επαγγελματίας ενέκρινε **αυτό** το αρχείο γι' αυτήν (ρητός δεσμός — ο μόνος δρόμος για έγγραφο χωρίς ακίνητο), ή
 *  - το έγγραφο είναι του **ίδιου ακινήτου**.
 * Το σιωπηρό «αρχείο έργου ⇒ όλα τα ακίνητά του» **δεν** υπάρχει: ένα έργο έχει πολλά κτίρια.
 *
 * §25 (5γ) — **και του ίδιου προσώπου**: έγγραφο του Α **ποτέ** δεν καλύπτει απαίτηση του Β. Έγγραφο **χωρίς** πρόσωπο
 * (π.χ. αρχείο ανεβασμένο στο ακίνητο) καλύπτει εδώ· το αν είναι **αμφίσημο** (δύο πρόσωπα το ίδιο είδος) το κρίνει ο
 * κάτοχος (`document-registry-holders`), που βλέπει όλες τις απαιτήσεις — ποτέ μαντεψιά ανάμεσα σε συμπωλητές.
 */
export function requirementCoveredBy(document: TrackedDocument, requirement: DocumentRequirement): boolean {
  if (requirement.documentKind !== document.kind) return false;
  if (document.fileId !== null && requirement.attestation?.fileId === document.fileId) return true;
  if (document.subject === null || requirement.subject.propertyId !== document.subject.propertyId) return false;
  const documentParty = document.subject.party;
  if (documentParty === null) return true;
  return requirement.subject.party !== null && requirement.subject.party.key === documentParty.key;
}

/**
 * **Αν λήξει αυτό το έγγραφο, τι σταματά;** — οι απαιτήσεις που **καλύπτει** ({@link requirementCoveredBy}), η καθεμία
 * με τον αντίκτυπό της. Χωρίς ρολόι: η απάντηση αφορά τη λήξη του εγγράφου, όχι το σήμερα.
 */
export function dependentsOf(
  document: TrackedDocument,
  requirements: readonly DocumentRequirement[],
): readonly DocumentDependent[] {
  return requirements
    .filter((requirement) => requirementCoveredBy(document, requirement))
    .map((requirement) => dependentOf(document, requirement))
    .sort(byUrgency);
}

/** **Τι σταματά επειδή ΛΕΙΠΕΙ** — κάθε απαίτηση χωρίς έγγραφο είναι ήδη χωρίς έγκυρο (`absent`), στη σειρά επείγοντος. */
export function absentDependentsOf(requirements: readonly DocumentRequirement[]): readonly DocumentDependent[] {
  return requirements
    .map((requirement): DocumentDependent => ({ requirement, impact: 'absent', stopsOn: null }))
    .sort(byUrgency);
}
