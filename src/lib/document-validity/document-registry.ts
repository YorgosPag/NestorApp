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
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O, **μηδέν ρολόι** (το `asOf` το δίνει ο καλών).
 *
 * @module lib/document-validity/document-registry
 */

import { addDaysToDateKey } from '@/lib/calendar/date-key';
import { documentKindSpec, type DocumentKind } from '@/config/document-validity/document-validity';
import type { DocumentExpiry } from '@/lib/document-validity/document-expiry';
import { documentFactsExpiry, type DocumentFactsSource } from '@/lib/document-validity/document-facts';
import {
  dependentsOf,
  documentStanding,
  type DocumentDependent,
  type DocumentRequirement,
  type DocumentStandingState,
} from '@/lib/document-validity/document-requirement';

// =============================================================================
// 1. ΤΟ ΛΕΞΙΛΟΓΙΟ
// =============================================================================

/** Οι καταστάσεις γραμμής, **στη σειρά επείγοντος**. Το `superseded` είναι πάντα τελευταίο. */
export const REGISTRY_ROW_STATES = ['expired', 'expiring', 'expiry-unknown', 'valid', 'superseded'] as const;
export type RegistryRowState = DocumentStandingState | 'superseded';

/** Τα φίλτρα του μητρώου. Κλειστό σύνολο. */
export const REGISTRY_FILTERS = ['renewal-due', 'within-window', 'blocking', 'expiry-unknown', 'discrepancy'] as const;
export type RegistryFilter = (typeof REGISTRY_FILTERS)[number];

/** Κυλιόμενο παράθυρο του φίλτρου `within-window` (ημέρες από σήμερα, μέσα). */
export const REGISTRY_WINDOW_DAYS = 30;

/** Από πού ήρθε η γραμμή: αρχείο με γεγονότα, ή δήλωση στο ακίνητο **χωρίς** αρχείο (Α3 εφεδρεία). */
export type RegistryDocumentOrigin =
  | { readonly kind: 'file'; readonly fileId: string }
  | { readonly kind: 'declared' };

/** Ένα έγγραφο όπως το συνέλεξε ο αναγνώστης — ήδη μέσα από τον ανεκτικό αναγνώστη, ποτέ ωμό. */
export interface RegistryDocument {
  /** Σταθερή ταυτότητα γραμμής (π.χ. `file:<id>` · `declared:<propertyId>:<kind>`). */
  readonly id: string;
  readonly kind: DocumentKind;
  /** `null` = το έγγραφο δεν δένεται σε ακίνητο ⇒ κανένα «τι σταματά», καμία αντικατάσταση. */
  readonly propertyId: string | null;
  readonly origin: RegistryDocumentOrigin;
  readonly issuedOn: string | null;
  readonly printedValidUntil: string | null;
  /** Προέλευση των γεγονότων· `null` για δήλωση ακινήτου. */
  readonly source: DocumentFactsSource | null;
  /** Το ακίνητο ονομάζει **αυτό** το αρχείο ως πηγή του μπλοκ του (`sourceFileId`). */
  readonly pinned: boolean;
}

export interface RegistryRow {
  readonly document: RegistryDocument;
  readonly state: RegistryRowState;
  readonly expiry: DocumentExpiry;
  /** Η γραμμή που την αντικατέστησε — μόνο όταν `state === 'superseded'`. */
  readonly supersededBy: string | null;
  /** «Τι σταματά αν λήξει» — κενό για αντικατεστημένη γραμμή (το κουβαλά η τρέχουσα). */
  readonly dependents: readonly DocumentDependent[];
  /** Μπλοκάρει **ήδη** διαδικασία `block` (βλ. {@link isBlockingDependent}). */
  readonly blocking: boolean;
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

const groupKeyOf = (document: RegistryDocument): string =>
  document.propertyId === null ? `solo:${document.id}` : `${document.propertyId}:${document.kind}`;

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
    const key = groupKeyOf(document);
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
 * **Μπλοκάρει ήδη;** — απαίτηση `block` που **θα** σταματήσει, και:
 *  - η μέρα της είναι συγκεκριμένη (`on`: η λήξη πέφτει πριν την υπογραφή — πρόβλημα **τώρα**), ή
 *  - είναι διαρκής και το έγγραφο έληξε ή μπήκε στο παράθυρο ανανέωσης.
 * Διαρκής απαίτηση πάνω σε έγγραφο που ισχύει ως το 2036 «θα σταματήσει» — αλλά δεν μπλοκάρει τίποτα σήμερα.
 */
export function isBlockingDependent(dependent: DocumentDependent, state: RegistryRowState): boolean {
  if (dependent.requirement.policy !== 'block' || dependent.impact !== 'stops') return false;
  return dependent.requirement.neededOn.kind === 'on' || state === 'expired' || state === 'expiring';
}

function rowOf(
  document: RegistryDocument,
  currentId: string,
  requirements: readonly DocumentRequirement[],
  asOf: string,
): RegistryRow {
  const expiry = documentFactsExpiry(document);
  if (currentId !== document.id) {
    return { document, state: 'superseded', expiry, supersededBy: currentId, dependents: [], blocking: false };
  }
  const warnWindowDays = documentKindSpec(document.kind).renewalLeadDays ?? 0;
  const { state } = documentStanding({ expiresOn: expiry.expiresOn, asOf, neededOn: { kind: 'continuous' }, warnWindowDays });
  const dependents = document.propertyId === null
    ? []
    : dependentsOf({ kind: document.kind, subject: { propertyId: document.propertyId }, expiresOn: expiry.expiresOn }, requirements);
  const blocking = dependents.some((dependent) => isBlockingDependent(dependent, state));
  return { document, state, expiry, supersededBy: null, dependents, blocking };
}

const STATE_RANK = new Map<RegistryRowState, number>(REGISTRY_ROW_STATES.map((state, index) => [state, index]));

/** Κατάσταση · μπλοκάρει πρώτα · νωρίτερη λήξη (άγνωστη τελευταία) · ταυτότητα. */
function byUrgency(a: RegistryRow, b: RegistryRow): number {
  const state = (STATE_RANK.get(a.state) ?? 0) - (STATE_RANK.get(b.state) ?? 0);
  if (state !== 0) return state;
  if (a.blocking !== b.blocking) return a.blocking ? -1 : 1;
  const expiry = (a.expiry.expiresOn ?? '9999-99-99').localeCompare(b.expiry.expiresOn ?? '9999-99-99');
  return expiry !== 0 ? expiry : a.document.id.localeCompare(b.document.id);
}

function tallyOf(rows: readonly RegistryRow[]): Record<RegistryRowState, number> {
  const tally = Object.fromEntries(REGISTRY_ROW_STATES.map((state) => [state, 0])) as Record<RegistryRowState, number>;
  for (const row of rows) tally[row.state] += 1;
  return tally;
}

/** **Το μητρώο** — μία γραμμή ανά έγγραφο, στη σειρά επείγοντος, με τις μετρήσεις του. */
export function documentRegistry({ documents, requirements, asOf }: DocumentRegistryInput): DocumentRegistry {
  const current = currentOfEach(documents);
  const rows = documents
    .map((document) => rowOf(document, current.get(document.id) ?? document.id, requirements, asOf))
    .sort(byUrgency);
  return { rows, tally: tallyOf(rows) };
}

// =============================================================================
// 4. ΤΑ ΦΙΛΤΡΑ — κρίνουν ό,τι ήδη κρίθηκε, ποτέ δεύτερος ταξινομητής
// =============================================================================

function withinWindow(expiresOn: string | null, asOf: string): boolean {
  const until = addDaysToDateKey(asOf, REGISTRY_WINDOW_DAYS);
  return expiresOn !== null && until !== null && expiresOn >= asOf && expiresOn <= until;
}

/** Ταιριάζει η γραμμή στο φίλτρο; Αντικατεστημένη γραμμή **δεν** ταιριάζει σε κανένα — δεν ζητά τίποτα από κανέναν. */
export function matchesRegistryFilter(row: RegistryRow, filter: RegistryFilter, asOf: string): boolean {
  if (row.state === 'superseded') return false;
  switch (filter) {
    case 'renewal-due': return row.state === 'expiring' || row.state === 'expired';
    case 'within-window': return withinWindow(row.expiry.expiresOn, asOf);
    case 'blocking': return row.blocking;
    case 'expiry-unknown': return row.state === 'expiry-unknown';
    case 'discrepancy': return row.expiry.discrepancy !== null;
  }
}
