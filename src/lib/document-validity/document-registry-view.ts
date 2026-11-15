/**
 * =============================================================================
 * Μητρώο λήξεων — οι ΠΡΟΒΟΛΕΣ της οθόνης (ADR-915 Φ4γ)
 * =============================================================================
 *
 * Η οθόνη δείχνει «Όλα» ή ένα από τα φίλτρα της Ε3. Εδώ ζουν: το κλειστό σύνολο προβολών, ο ανεκτικός αναγνώστης
 * της παραμέτρου διεύθυνσης (`?view=`), οι γραμμές μιας προβολής και ο μετρητής κάθε προβολής.
 *
 * 🔑 **Κανένας δεύτερος ταξινομητής**: κάθε απόφαση «ανήκει η γραμμή στην προβολή;» περνά από τον
 *    {@link matchesRegistryFilter} με το `asOf` **της απόκρισης** — ποτέ ρολόι πελάτη. Αν η οθόνη έκρινε μόνη της, το
 *    «μπλοκάρει» θα μπορούσε να λέει άλλο από τον διακομιστή την πρώτη φορά που αλλάζει ο κανόνας.
 *
 * 🏆 **Η προβολή ζει στη διεύθυνση** (Ironclad «saved views» · Zillow): ο σύνδεσμος μοιράζεται, το «πίσω» δουλεύει, και
 *    οι ειδοποιήσεις της Φ5 οδηγούν **κατευθείαν** στο «μπλοκάρει».
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O, μηδέν ρολόι.
 *
 * @module lib/document-validity/document-registry-view
 */

import { withQuery, type WorkspaceHref } from '@/lib/workspace/route-worlds';
import { DOCUMENT_EXPIRY_ROUTE } from '@/lib/document-validity/document-registry-routes';
import {
  isBlockingDependent,
  matchesRegistryFilter,
  REGISTRY_FILTERS,
  registryRowIdOf,
  registryRowKindOf,
  registryRowPartyOf,
  registryRowPropertyIdOf,
  type RegistryFilter,
  type RegistryRow,
  type RegistryRowState,
} from '@/lib/document-validity/document-registry';
import type { DocumentDependent } from '@/lib/document-validity/document-requirement';
import { issuanceKeyOf } from '@/lib/document-validity/issuance-assignment';

/** Η προβολή χωρίς φίλτρο — δείχνει **και** τις αντικατεστημένες γραμμές, υποβαθμισμένες. */
export const REGISTRY_VIEW_ALL = 'all' as const;

/** Οι προβολές του επιλογέα (τα «τσιπ»), στη σειρά εμφάνισης. Κλειστό σύνολο. */
export const REGISTRY_PICKER_VIEWS = [REGISTRY_VIEW_ALL, ...REGISTRY_FILTERS] as const;
export type RegistryPickerView = (typeof REGISTRY_PICKER_VIEWS)[number];

/**
 * Προβολές **κατάστασης** — ό,τι ανοίγει μια κάρτα σύνοψης. Η `missing` και η `expiry-unknown` είναι **ήδη** φίλτρα με
 * ταυτόσημη σημασία (κενό · `state === 'expiry-unknown'`), άρα εδώ μένουν μόνο οι υπόλοιπες. Έτσι **κάθε**
 * `RegistryRowState` είναι `RegistryView` — η κάρτα λέει το όνομά της, χωρίς χάρτη μετάφρασης.
 */
export const REGISTRY_STATE_VIEWS = ['expired', 'expiring', 'valid', 'superseded'] as const satisfies
  readonly Exclude<RegistryRowState, RegistryFilter>[];
type RegistryStateView = (typeof REGISTRY_STATE_VIEWS)[number];

/** Όλες οι προβολές που δέχεται η διεύθυνση. Κλειστό σύνολο. */
export const REGISTRY_VIEWS = [...REGISTRY_PICKER_VIEWS, ...REGISTRY_STATE_VIEWS] as const;
export type RegistryView = (typeof REGISTRY_VIEWS)[number];

const FILTER_SET: ReadonlySet<string> = new Set(REGISTRY_FILTERS);

function isRegistryFilter(view: RegistryView): view is RegistryFilter {
  return FILTER_SET.has(view);
}

/**
 * Η κάρτα μιας κατάστασης ανοίγει την προβολή **με το ίδιο όνομα** (βλ. {@link REGISTRY_STATE_VIEWS})· πατημένη
 * κάρτα ξαναπατιέται ⇒ «Όλα» (εναλλαγή, όπως στο ταμπλό των ακινήτων — ADR-840 §7.8).
 */
export function toggledRegistryView(current: RegistryView, state: RegistryRowState): RegistryView {
  return current === state ? REGISTRY_VIEW_ALL : state;
}

/** Η παράμετρος της διεύθυνσης — ΕΝΑ όνομα. */
export const REGISTRY_VIEW_PARAM = 'view' as const;

const VIEW_SET: ReadonlySet<string> = new Set(REGISTRY_VIEWS);

export function isRegistryView(value: unknown): value is RegistryView {
  return typeof value === 'string' && VIEW_SET.has(value);
}

/** Ανεκτικός αναγνώστης: άγνωστη ή κενή τιμή ⇒ «Όλα» (ένας παλιός σύνδεσμος δεν σπάει τη σελίδα). */
export function registryViewOf(param: string | null | undefined): RegistryView {
  return isRegistryView(param) ? param : REGISTRY_VIEW_ALL;
}



/**
 * Ταιριάζει η γραμμή στην προβολή; Το «Όλα» δέχεται τα πάντα· κάθε φίλτρο ρωτά τον ΕΝΑ ταξινομητή· η προβολή
 * κατάστασης διαβάζει την κατάσταση **του διακομιστή** — ίδια πηγή με τον αριθμό της κάρτας.
 */
export function matchesRegistryView(row: RegistryRow, view: RegistryView, asOf: string): boolean {
  if (view === REGISTRY_VIEW_ALL) return true;
  if (isRegistryFilter(view)) return matchesRegistryFilter(row, view, asOf);
  return row.state === (view satisfies RegistryStateView);
}

/** Οι γραμμές μιας προβολής, **στη σειρά του διακομιστή** (επείγον πρώτα). */
export function rowsOfRegistryView(rows: readonly RegistryRow[], view: RegistryView, asOf: string): readonly RegistryRow[] {
  return rows.filter((row) => matchesRegistryView(row, view, asOf));
}

/** Πόσες γραμμές σε κάθε προβολή — **όλες, και οι μηδενικές** («κοίταξα, 0» ≠ «δεν υπάρχει φίλτρο»). */
export function registryViewTally(rows: readonly RegistryRow[], asOf: string): Readonly<Record<RegistryView, number>> {
  const tally = Object.fromEntries(REGISTRY_VIEWS.map((view) => [view, 0])) as Record<RegistryView, number>;
  for (const row of rows) {
    for (const view of REGISTRY_VIEWS) if (matchesRegistryView(row, view, asOf)) tally[view] += 1;
  }
  return tally;
}

// =============================================================================
// ADR-915 §41.5 — ΚΑΡΤΕΛΕΣ · ΟΜΑΔΟΠΟΙΗΣΗ · ΠΛΑΪΝΟ ΠΑΝΕΛ (όλα στη διεύθυνση)
// =============================================================================

/**
 * Οι καρτέλες της σελίδας, στη σειρά εμφάνισης. Κλειστό σύνολο. Η πρώτη είναι η προεπιλογή.
 * - `action`    — ό,τι θέλει ενέργεια **τώρα** (έληξε · λήγει · λείπει-και-μπλοκάρει), κατά το **πότε μπλοκάρει**
 * - `all`       — το πλήρες μητρώο σε πυκνό πίνακα, με τις προβολές `?view=` και ομαδοποίηση `?group=`
 * - `decisions` — οι προτάσεις μόνιμων υποχρεώσεων (§35): **απόφαση**, όχι κατάσταση εγγράφου — γι' αυτό χωριστά
 * (Η «Ανά ακίνητο» της §41.3 είναι Φάση Β.)
 */
export const REGISTRY_TABS = ['action', 'all', 'decisions'] as const;
export type RegistryTab = (typeof REGISTRY_TABS)[number];
export const REGISTRY_DEFAULT_TAB: RegistryTab = 'action';

/** Οι άξονες ομαδοποίησης της καρτέλας «Όλα» — ο άνθρωπος διαλέγει (§41.1 αιτία β: ΕΝΑΣ άξονας σκόρπιζε το ακίνητο). */
export const REGISTRY_GROUPINGS = ['state', 'property', 'kind'] as const;
export type RegistryGrouping = (typeof REGISTRY_GROUPINGS)[number];
export const REGISTRY_DEFAULT_GROUPING: RegistryGrouping = 'state';

/** Οι παράμετροι της διεύθυνσης — ΕΝΑ όνομα η καθεμία. */
export const REGISTRY_TAB_PARAM = 'tab' as const;
export const REGISTRY_GROUP_PARAM = 'group' as const;
export const REGISTRY_DOC_PARAM = 'doc' as const;

const TAB_SET: ReadonlySet<string> = new Set(REGISTRY_TABS);
const GROUPING_SET: ReadonlySet<string> = new Set(REGISTRY_GROUPINGS);

export function isRegistryTab(value: unknown): value is RegistryTab {
  return typeof value === 'string' && TAB_SET.has(value);
}

function isRegistryGrouping(value: unknown): value is RegistryGrouping {
  return typeof value === 'string' && GROUPING_SET.has(value);
}

/**
 * Η καρτέλα από τη διεύθυνση. Ρητή έγκυρη καρτέλα κερδίζει· αλλιώς μια **προβολή** (`?view=` ≠ «Όλα») σημαίνει «Όλα» —
 * έτσι κάθε σύνδεσμος πριν τις καρτέλες (ειδοποιήσεις Φ5: `?view=blocking`) προσγειώνεται εκεί που έδειχνε.
 */
export function registryTabOf(tabParam: string | null | undefined, viewParam: string | null | undefined): RegistryTab {
  if (isRegistryTab(tabParam)) return tabParam;
  return registryViewOf(viewParam) === REGISTRY_VIEW_ALL ? REGISTRY_DEFAULT_TAB : 'all';
}

/** Ανεκτικός αναγνώστης της ομαδοποίησης: άγνωστη ⇒ κατά κατάσταση. */
export function registryGroupingOf(param: string | null | undefined): RegistryGrouping {
  return isRegistryGrouping(param) ? param : REGISTRY_DEFAULT_GROUPING;
}

export interface RegistryHrefExtra {
  readonly tab?: RegistryTab;
  /** Η γραμμή του πλαϊνού πάνελ — `registryRowIdOf` **ή** κλειδί υποκειμένου (βλ. {@link registryRowOfDocParam}). */
  readonly doc?: string;
}

/**
 * **Η ΜΙΑ διεύθυνση της σελίδας.** Παράμετρος γράφεται μόνο όταν διαφέρει από ό,τι θα έβγαζε μόνη της η διεύθυνση: μία
 * διεύθυνση ανά περιεχόμενο. Χωρίς `extra` είναι η ίδια με πριν τις καρτέλες (οι ειδοποιήσεις του διακομιστή δεν αλλάζουν).
 */
export function documentExpiryHref(view: RegistryView = REGISTRY_VIEW_ALL, extra: RegistryHrefExtra = {}): WorkspaceHref {
  const params = new URLSearchParams();
  if (view !== REGISTRY_VIEW_ALL) params.set(REGISTRY_VIEW_PARAM, view);
  if (extra.tab !== undefined && extra.tab !== registryTabOf(null, view)) params.set(REGISTRY_TAB_PARAM, extra.tab);
  if (extra.doc !== undefined) params.set(REGISTRY_DOC_PARAM, extra.doc);
  const query = params.toString();
  return query === '' ? DOCUMENT_EXPIRY_ROUTE : withQuery(DOCUMENT_EXPIRY_ROUTE, query);
}

/**
 * ADR-915 §43 — **άγνωστη λήξη που τη ζητά διαδικασία `block`**: δεν αποδεικνύεται ότι ισχύει, άρα θέλει προσοχή — αλλά
 * **δεν** λέγεται «μπλοκάρει» (η μεταβίβαση τη δέχεται σήμερα· δύο κριτές δεν διαφωνούν). Οι διαδικασίες που περιμένουν.
 */
export function undeterminedBlockersOf(row: RegistryRow): readonly DocumentDependent[] {
  if (row.state !== 'expiry-unknown') return [];
  return row.dependents.filter((dependent) => dependent.requirement.policy === 'block');
}

/**
 * Θέλει ενέργεια; — έληξε · λήγει · λείπει **και μπλοκάρει** · άγνωστη λήξη που τη ζητά διαδικασία `block` (§43).
 * Κατάσταση και `blocking` είναι κρίση του διακομιστή.
 */
export function needsRegistryAction(row: RegistryRow): boolean {
  if (row.state === 'expired' || row.state === 'expiring') return true;
  if (row.state === 'missing') return row.blocking;
  return undeterminedBlockersOf(row).length > 0;
}

/** Μία διαδικασία που μπλοκάρει, με τη μέρα της (ADR-915 §43 — «ΤΙ μπλοκάρει», όχι μόνο «πότε»). */
export interface RegistryBlocker {
  readonly dependent: DocumentDependent;
  /** Η μέρα που μπλοκάρει — ποτέ πριν από το `asOf` (παρελθόν ⇒ «ήδη»). */
  readonly day: string;
}

/**
 * **Τι μπλοκάρει και πότε** — οι εξαρτήσεις που ο πυρήνας **ήδη** κρίνει μπλοκαρισμένες (`isBlockingDependent` — κανένα
 * δεύτερο κριτήριο): λείπει ⇒ σήμερα · συγκεκριμένη υπογραφή ⇒ η μέρα της · διαρκής ⇒ η πρώτη μέρα εκτός ισχύος.
 * Παρελθόν ⇒ σήμερα. Νωρίτερη πρώτη (σταθερή σειρά).
 */
export function blockersOf(row: RegistryRow, asOf: string): readonly RegistryBlocker[] {
  const blockers: RegistryBlocker[] = [];
  for (const dependent of row.dependents) {
    if (!isBlockingDependent(dependent, row.state)) continue;
    const { neededOn } = dependent.requirement;
    const day = dependent.impact === 'absent' ? asOf : neededOn.kind === 'on' ? neededOn.day : (dependent.stopsOn ?? asOf);
    blockers.push({ dependent, day: day < asOf ? asOf : day });
  }
  return blockers.sort((a, b) => a.day.localeCompare(b.day));
}

/** **Πότε μπλοκάρει συναλλαγή** — η νωρίτερη μέρα του {@link blockersOf}. `null` = δεν μπλοκάρει τίποτα. */
export function blockingDayOf(row: RegistryRow, asOf: string): string | null {
  return blockersOf(row, asOf)[0]?.day ?? null;
}

/**
 * Οι γραμμές της καρτέλας «Χρειάζονται ενέργεια»: πρώτα όσες μπλοκάρουν, η νωρίτερη μέρα πρώτη· μετά οι υπόλοιπες.
 * Ισοπαλία ⇒ η σειρά του διακομιστή (σταθερή ταξινόμηση — επείγον πρώτα).
 */
export function rowsOfActionTab(rows: readonly RegistryRow[], asOf: string): readonly RegistryRow[] {
  const keyed = rows.filter(needsRegistryAction).map((row) => ({ row, day: blockingDayOf(row, asOf) }));
  keyed.sort((a, b) => {
    if (a.day === b.day) return 0;
    if (a.day === null) return 1;
    if (b.day === null) return -1;
    return a.day.localeCompare(b.day);
  });
  return keyed.map(({ row }) => row);
}

/** Ο αριθμός κάθε καρτέλας. «Προς απόφαση» = όσες προτάσεις **περιμένουν** απόφαση (ίδιο μέτρο με το «Εκκρεμούν»). */
export function registryTabTally(
  rows: readonly RegistryRow[],
  pendingDecisions: number,
): Readonly<Record<RegistryTab, number>> {
  return { action: rows.filter(needsRegistryAction).length, all: rows.length, decisions: pendingDecisions };
}

/**
 * Η γραμμή του πλαϊνού πάνελ από το `?doc=`:
 *  (α) η ταυτότητα της γραμμής (`registryRowIdOf`) — ό,τι γράφει η ίδια η σελίδα·
 *  (β) αλλιώς το **κλειδί υποκειμένου** `issuanceKeyOf(ακίνητο, είδος)` ⇒ η **τρέχουσα** γραμμή του (κενό ή έγγραφο,
 *      ποτέ αντικατεστημένη, μόνο του ακινήτου — `party === null`). Γιατί: όποιος ξέρει μόνο «ΠΕΑ αυτού του ακινήτου»
 *      (η γραμμή «Ανέλαβε» μιας επαφής) δεν μπορεί να ξέρει αν η γραμμή είναι `missing:…` ή το `id` ενός ληγμένου εγγράφου.
 * Άγνωστη τιμή ⇒ `null` (το πάνελ μένει κλειστό — καμία ψευδής κάρτα).
 */
export function registryRowOfDocParam(rows: readonly RegistryRow[], param: string | null | undefined): RegistryRow | null {
  if (typeof param !== 'string' || param === '') return null;
  const byId = rows.find((row) => registryRowIdOf(row) === param);
  if (byId !== undefined) return byId;
  return rows.find((row) => {
    const propertyId = registryRowPropertyIdOf(row);
    return row.state !== 'superseded' && propertyId !== null && registryRowPartyOf(row) === null
      && issuanceKeyOf(propertyId, registryRowKindOf(row)) === param;
  }) ?? null;
}
