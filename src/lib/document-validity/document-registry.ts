/**
 * =============================================================================
 * Μητρώο λήξεων εγγράφων — ΠΑΡΑΓΟΜΕΝΗ ΟΨΗ, όχι νέα αλήθεια (ADR-915 Φ4)
 * =============================================================================
 *
 * Από **έγγραφα** (γεγονότα αρχείου ή δήλωση ακινήτου χωρίς αρχείο, Α3) και **απαιτήσεις** (μεταβίβαση · αγγελία, Φ2)
 * παράγει τις γραμμές του μητρώου. **Τίποτα δεν αποθηκεύεται**: κατάσταση, ασυμφωνία, αντικατάσταση και «τι σταματά»
 * υπολογίζονται σε κάθε ανάγνωση, από τους ΙΔΙΟΥΣ κριτές που ρωτούν μεταβίβαση και ακίνητο:
 *
 *  - λήξη (Α4)          → `documentFactsExpiry` (κανόνας του είδους + τυπωμένη, η νωρίτερη)
 *  - κατάσταση          → `documentStanding` (`continuous`, παράθυρο = `renewalLeadDays` του είδους)
 *  - «τι σταματά»       → `dependentsOf`
 *
 * 🏆 **Πού ξεπερνάμε τους μεγάλους** (ADR-915 §11): το «λήγει» του Procore είναι σταθερό παράθυρο 14 ημερών· εδώ είναι ο
 * **χρόνος που χρειάζεται η ανανέωση** του είδους (ΠΕΑ = νέα επιθεώρηση, 60 ημέρες). Και κάθε γραμμή λέει **ποια
 * συγκεκριμένη** διαδικασία σταματά — δεν το δείχνει κανείς.
 *
 * 🔑 **Α5 — αντικατάσταση, παραγόμενη**: ανά (ακίνητο, είδος) **τρέχον** είναι το αρχείο που ονομάζει το ίδιο το ακίνητο
 * ως πηγή (`pinned`), αλλιώς η νεότερη έκδοση. Τα υπόλοιπα είναι `superseded` — **ποτέ** «έληξε»: η αντικατάσταση είναι
 * ανανέωση. Κανένα αποθηκευμένο `supersededByFileId` για ΠΕΑ, άρα καμία μετάπτωση.
 *
 * 🔑 **Φ4δ — το μητρώο λέει και ό,τι ΛΕΙΠΕΙ** (Ε7, ιδέα Street «Listings with no EPC»): απαίτηση `required` χωρίς
 * κάτοχο (`document-registry-holders`) γίνεται γραμμή `missing` — μία ανά (ακίνητο, είδος), στην **ίδια** λίστα, στο
 * **ίδιο** `tally`, από τον **ίδιο** ταξινομητή. Ακίνητο **χωρίς** απαίτηση δεν «λείπει» τίποτα: η υποχρέωση γεννιέται
 * με τη διαδικασία (πώληση · μίσθωση · αγγελία), όχι με την ύπαρξη του ακινήτου.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O, **μηδέν ρολόι** (το `asOf` το δίνει ο καλών).
 *
 * @module lib/document-validity/document-registry
 */

import { addDaysToDateKey } from '@/lib/calendar/date-key';
import {
  documentKindSpec,
  type DocumentClassification,
  type DocumentKind,
} from '@/config/document-validity/document-validity';
import type { DocumentExpiry } from '@/lib/document-validity/document-expiry';
import { documentFactsExpiry, type DocumentFactsSource } from '@/lib/document-validity/document-facts';
import {
  attestedDocumentsOf,
  registryGroupKeyOf,
  requirementHolders,
  trackedDocumentOf,
  withoutYieldingUndeclared,
} from '@/lib/document-validity/document-registry-holders';
import {
  absentDependentsOf,
  dependentsOf,
  documentStanding,
  withPartySuffix,
  type DocumentDependent,
  type DocumentRequirement,
  type RequirementParty,
} from '@/lib/document-validity/document-requirement';

// =============================================================================
// 1. ΤΟ ΛΕΞΙΛΟΓΙΟ
// =============================================================================

/**
 * Οι καταστάσεις γραμμής, **στη σειρά επείγοντος**. Το `missing` αμέσως μετά το `expired`: και τα δύο σημαίνουν «η
 * διαδικασία είναι ΗΔΗ χωρίς έγκυρο έγγραφο». Το `superseded` είναι πάντα τελευταίο.
 */
export const REGISTRY_ROW_STATES = ['expired', 'missing', 'expiring', 'expiry-unknown', 'valid', 'superseded'] as const;
export type RegistryRowState = (typeof REGISTRY_ROW_STATES)[number];

/** Τα φίλτρα του μητρώου. Κλειστό σύνολο. */
export const REGISTRY_FILTERS = ['renewal-due', 'missing', 'within-window', 'blocking', 'expiry-unknown', 'discrepancy'] as const;
export type RegistryFilter = (typeof REGISTRY_FILTERS)[number];

/** Κυλιόμενο παράθυρο του φίλτρου `within-window` (ημέρες από σήμερα, μέσα). */
export const REGISTRY_WINDOW_DAYS = 30;

/**
 * Από πού ήρθε η γραμμή: αρχείο με γεγονότα · δήλωση στο ακίνητο **χωρίς** αρχείο (Α3 εφεδρεία) · έγκριση επαγγελματία
 * στον έλεγχο μιας υπόθεσης, όταν το έγγραφο δεν είναι αλλιώς γνωστό (Φ4δ Ε8 — `fileId: null` = εκτός πλατφόρμας).
 */
export type RegistryDocumentOrigin =
  | { readonly kind: 'file'; readonly fileId: string }
  | { readonly kind: 'declared' }
  | { readonly kind: 'attested'; readonly caseId: string; readonly fileId: string | null };

/** Ένα έγγραφο όπως το συνέλεξε ο αναγνώστης — ήδη μέσα από τον ανεκτικό αναγνώστη, ποτέ ωμό. */
export interface RegistryDocument {
  /** Σταθερή ταυτότητα γραμμής (π.χ. `file:<id>` · `declared:<propertyId>:<kind>`). */
  readonly id: string;
  readonly kind: DocumentKind;
  /** `null` = το έγγραφο δεν δένεται σε ακίνητο ⇒ κανένα «τι σταματά», καμία αντικατάσταση. */
  readonly propertyId: string | null;
  /**
   * ADR-915 §25 (5γ) — **ποιανού** είναι το έγγραφο, όταν είναι ανά πρόσωπο: αρχείο στην κάρτα επαφής · έγκριση σε
   * γραμμή πωλητή. `null` = έγγραφο του ακινήτου (ή χωρίς γνωστό πρόσωπο). Χωρίζει ομάδες: η ενημερότητα του Α
   * **δεν** αντικαθιστά του Β.
   */
  readonly party: RequirementParty | null;
  readonly origin: RegistryDocumentOrigin;
  readonly issuedOn: string | null;
  readonly printedValidUntil: string | null;
  /** Η κατάταξη του εκδότη (ADR-915 §32)· `null` = το είδος δεν κατατάσσεται ή δεν ξέρουμε. */
  readonly classification: DocumentClassification | null;
  /**
   * Προέλευση των γεγονότων· `null` για δήλωση ακινήτου, για έγκριση χωρίς γεγονότα, και (ADR-915 §33) για **αρχείο
   * χωρίς στοιχεία**: θέση που υπόσχεται το είδος, κανείς δεν δήλωσε ή διάβασε ημερομηνίες ⇒ `expiry-unknown`.
   */
  readonly source: DocumentFactsSource | null;
  /** Το ακίνητο ονομάζει **αυτό** το αρχείο ως πηγή του μπλοκ του (`sourceFileId`). */
  readonly pinned: boolean;
}

/** Γραμμή **εγγράφου** που υπάρχει. */
export interface RegistryDocumentRow {
  readonly kind: 'document';
  readonly document: RegistryDocument;
  readonly state: Exclude<RegistryRowState, 'missing'>;
  readonly expiry: DocumentExpiry;
  /** Η γραμμή που την αντικατέστησε — μόνο όταν `state === 'superseded'`. */
  readonly supersededBy: string | null;
  /** «Τι σταματά αν λήξει» — κενό για αντικατεστημένη γραμμή (το κουβαλά η τρέχουσα). */
  readonly dependents: readonly DocumentDependent[];
  /** Μπλοκάρει **ήδη** διαδικασία `block` (βλ. {@link isBlockingDependent}). */
  readonly blocking: boolean;
}

/** Ό,τι λείπει: ένα είδος εγγράφου για ένα ακίνητο. **Όχι** έγγραφο — δεν έχει λήξη, πηγή ή αρχείο. */
export interface RegistryGap {
  /** Σταθερή ταυτότητα (`missing:<propertyId>:<kind>` — και `@<πρόσωπο>` για έγγραφο ανά πρόσωπο, §25). */
  readonly id: string;
  readonly kind: DocumentKind;
  readonly propertyId: string;
  /** ADR-915 §25 (5γ) — ποιανού λείπει· `null` = λείπει από το ακίνητο. */
  readonly party: RequirementParty | null;
}

/** Γραμμή **κενού** (Φ4δ Ε7): απαίτηση `required` που κανένα έγγραφο δεν κρατά. */
export interface RegistryGapRow {
  readonly kind: 'gap';
  readonly gap: RegistryGap;
  readonly state: 'missing';
  /** Ποιες διαδικασίες το ζητούν — όλες `absent`. */
  readonly dependents: readonly DocumentDependent[];
  readonly blocking: boolean;
}

/** Μία γραμμή του μητρώου — έγγραφο ή κενό. Ο τύπος κάνει αδύνατη μια «λήξη» σε έγγραφο που δεν υπάρχει. */
export type RegistryRow = RegistryDocumentRow | RegistryGapRow;

/** Η σταθερή ταυτότητα κάθε γραμμής (κλειδί λίστας · «αντικαταστάθηκε από»). */
export function registryRowIdOf(row: RegistryRow): string {
  return row.kind === 'gap' ? row.gap.id : row.document.id;
}

/** Το ακίνητο της γραμμής (`null` για έγγραφο που δεν δένεται σε ακίνητο) — ADR-915 Φ5β: η αλυσίδα υπευθυνότητας ρωτά εδώ. */
export function registryRowPropertyIdOf(row: RegistryRow): string | null {
  return row.kind === 'gap' ? row.gap.propertyId : row.document.propertyId;
}

/** Το πρόσωπο της γραμμής (`null` = του ακινήτου) — ADR-915 §25: το «Το φέρνει» ρωτά εδώ. */
export function registryRowPartyOf(row: RegistryRow): RequirementParty | null {
  return row.kind === 'gap' ? row.gap.party : row.document.party;
}

/** Το είδος εγγράφου της γραμμής — ό,τι λείπει ή ό,τι υπάρχει (ADR-915 §24: το «Επόμενο βήμα» ρωτά εδώ). */
export function registryRowKindOf(row: RegistryRow): DocumentKind {
  return row.kind === 'gap' ? row.gap.kind : row.document.kind;
}

export interface DocumentRegistry {
  readonly rows: readonly RegistryRow[];
  /** Πόσες σε κάθε κατάσταση — **όλες, και οι μηδενικές** («κοίταξα, 0» ≠ «δεν υπάρχει έλεγχος»). */
  readonly tally: Readonly<Record<RegistryRowState, number>>;
}

export interface DocumentRegistryInput {
  readonly documents: readonly RegistryDocument[];
  readonly requirements: readonly DocumentRequirement[];
  /** Σήμερα, `YYYY-MM-DD`. */
  readonly asOf: string;
}

// =============================================================================
// 2. Α5 — ΠΟΙΟ ΕΙΝΑΙ ΤΟ ΤΡΕΧΟΝ
// =============================================================================

/** `pinned` πρώτα · μετά η νεότερη έκδοση (άγνωστη τελευταία) · μετά η ταυτότητα (σταθερή σειρά). */
function byCurrency(a: RegistryDocument, b: RegistryDocument): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  const issued = (b.issuedOn ?? '').localeCompare(a.issuedOn ?? '');
  return issued !== 0 ? issued : a.id.localeCompare(b.id);
}

/** `id` → το `id` της τρέχουσας γραμμής της ομάδας του (για την τρέχουσα: ο εαυτός της). */
function currentOfEach(documents: readonly RegistryDocument[]): ReadonlyMap<string, string> {
  const groups = new Map<string, RegistryDocument[]>();
  for (const document of documents) {
    const key = registryGroupKeyOf(document);
    groups.set(key, [...(groups.get(key) ?? []), document]);
  }
  const current = new Map<string, string>();
  for (const members of groups.values()) {
    const head = [...members].sort(byCurrency)[0];
    for (const member of members) current.set(member.id, head.id);
  }
  return current;
}

// =============================================================================
// 3. Η ΓΡΑΜΜΗ
// =============================================================================

/**
 * **Μπλοκάρει ήδη;** — απαίτηση `block`, και:
 *  - το έγγραφο **λείπει** (`absent`: η διαδικασία είναι ήδη χωρίς έγκυρο — όπως το «έληξε»), ή
 *  - **θα** σταματήσει και η μέρα της είναι συγκεκριμένη (`on`: η λήξη πέφτει πριν την υπογραφή — πρόβλημα **τώρα**), ή
 *  - **θα** σταματήσει, είναι διαρκής, και το έγγραφο έληξε ή μπήκε στο παράθυρο ανανέωσης.
 * Διαρκής απαίτηση πάνω σε έγγραφο που ισχύει ως το 2036 «θα σταματήσει» — αλλά δεν μπλοκάρει τίποτα σήμερα.
 */
export function isBlockingDependent(dependent: DocumentDependent, state: RegistryRowState): boolean {
  if (dependent.requirement.policy !== 'block') return false;
  if (dependent.impact === 'absent') return true;
  if (dependent.impact !== 'stops') return false;
  return dependent.requirement.neededOn.kind === 'on' || state === 'expired' || state === 'expiring';
}

function rowOf(
  document: RegistryDocument,
  currentId: string,
  held: readonly DocumentRequirement[],
  asOf: string,
): RegistryDocumentRow {
  const expiry = documentFactsExpiry(document);
  if (currentId !== document.id) {
    return { kind: 'document', document, state: 'superseded', expiry, supersededBy: currentId, dependents: [], blocking: false };
  }
  const warnWindowDays = documentKindSpec(document.kind).renewalLeadDays ?? 0;
  const { state } = documentStanding({ expiresOn: expiry.expiresOn, asOf, neededOn: { kind: 'continuous' }, warnWindowDays });
  const dependents = dependentsOf(trackedDocumentOf(document, expiry.expiresOn), held);
  const blocking = dependents.some((dependent) => isBlockingDependent(dependent, state));
  return { kind: 'document', document, state, expiry, supersededBy: null, dependents, blocking };
}

/**
 * Τα κενά: απαιτήσεις `required` χωρίς κάτοχο, μία γραμμή ανά (ακίνητο, είδος, **πρόσωπο** — §25). Οι `tracked` δεν
 * ισχυρίζονται «λείπει». Δύο συμπωλητές χωρίς φορολογική = **δύο** κενά, το καθένα με το όνομά του.
 */
function gapRowsOf(unheld: readonly DocumentRequirement[]): readonly RegistryGapRow[] {
  const groups = new Map<string, DocumentRequirement[]>();
  for (const requirement of unheld) {
    if (requirement.presence !== 'required') continue;
    const { propertyId, party } = requirement.subject;
    const key = withPartySuffix(`${propertyId}:${requirement.documentKind}`, party);
    groups.set(key, [...(groups.get(key) ?? []), requirement]);
  }
  return [...groups.entries()].map(([key, members]): RegistryGapRow => {
    const dependents = absentDependentsOf(members);
    const { propertyId, party } = members[0].subject;
    const gap: RegistryGap = { id: `missing:${key}`, kind: members[0].documentKind, propertyId, party };
    return { kind: 'gap', gap, state: 'missing', dependents, blocking: dependents.some((d) => isBlockingDependent(d, 'missing')) };
  });
}

const STATE_RANK = new Map<RegistryRowState, number>(REGISTRY_ROW_STATES.map((state, index) => [state, index]));
const NO_EXPIRY = '9999-99-99';

/** Κατάσταση · μπλοκάρει πρώτα · νωρίτερη λήξη (άγνωστη και κενό τελευταία) · ταυτότητα. */
function byUrgency(a: RegistryRow, b: RegistryRow): number {
  const state = (STATE_RANK.get(a.state) ?? 0) - (STATE_RANK.get(b.state) ?? 0);
  if (state !== 0) return state;
  if (a.blocking !== b.blocking) return a.blocking ? -1 : 1;
  const expiresOf = (row: RegistryRow): string => (row.kind === 'gap' ? NO_EXPIRY : (row.expiry.expiresOn ?? NO_EXPIRY));
  const expiry = expiresOf(a).localeCompare(expiresOf(b));
  return expiry !== 0 ? expiry : registryRowIdOf(a).localeCompare(registryRowIdOf(b));
}

function tallyOf(rows: readonly RegistryRow[]): Record<RegistryRowState, number> {
  const tally = Object.fromEntries(REGISTRY_ROW_STATES.map((state) => [state, 0])) as Record<RegistryRowState, number>;
  for (const row of rows) tally[row.state] += 1;
  return tally;
}

/**
 * **Το μητρώο** — μία γραμμή ανά έγγραφο (αρχείο · δήλωση · έγκριση ελέγχου) **και** μία ανά κενό, στη σειρά
 * επείγοντος, με τις μετρήσεις του. Κάθε απαίτηση μετρά κάτω από **ακριβώς μία** γραμμή.
 */
export function documentRegistry({ documents, requirements, asOf }: DocumentRegistryInput): DocumentRegistry {
  const own = withoutYieldingUndeclared(documents, requirements);
  const all = [...own, ...attestedDocumentsOf(own, requirements)];
  const current = currentOfEach(all);
  const { held, unheld } = requirementHolders(all, current, requirements);
  const documentRows = all.map((document) =>
    rowOf(document, current.get(document.id) ?? document.id, held.get(document.id) ?? [], asOf));
  const rows = [...documentRows, ...gapRowsOf(unheld)].sort(byUrgency);
  return { rows, tally: tallyOf(rows) };
}

// =============================================================================
// 4. ΤΑ ΦΙΛΤΡΑ — κρίνουν ό,τι ήδη κρίθηκε, ποτέ δεύτερος ταξινομητής
// =============================================================================

function withinWindow(expiresOn: string | null, asOf: string): boolean {
  const until = addDaysToDateKey(asOf, REGISTRY_WINDOW_DAYS);
  return expiresOn !== null && until !== null && expiresOn >= asOf && expiresOn <= until;
}

/**
 * Ταιριάζει η γραμμή στο φίλτρο; Αντικατεστημένη γραμμή **δεν** ταιριάζει σε κανένα — δεν ζητά τίποτα από κανέναν.
 * Το κενό ταιριάζει **μόνο** στο «λείπουν» και στο «μπλοκάρουν»: δεν έχει λήξη για να «λήγει» ή να «ασυμφωνεί».
 */
export function matchesRegistryFilter(row: RegistryRow, filter: RegistryFilter, asOf: string): boolean {
  if (row.kind === 'gap') return filter === 'missing' || (filter === 'blocking' && row.blocking);
  if (row.state === 'superseded') return false;
  switch (filter) {
    case 'renewal-due': return row.state === 'expiring' || row.state === 'expired';
    case 'missing': return false;
    case 'within-window': return withinWindow(row.expiry.expiresOn, asOf);
    case 'blocking': return row.blocking;
    case 'expiry-unknown': return row.state === 'expiry-unknown';
    case 'discrepancy': return row.expiry.discrepancy !== null;
  }
}
