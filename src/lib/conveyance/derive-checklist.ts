/**
 * =============================================================================
 * Conveyance — παραγωγή κατάστασης καταλόγου (ADR-901 §5.5) — ο ΕΝΑΣ υπολογισμός
 * =============================================================================
 *
 * `κατάλογος + γεγονότα + αποκλίσεις + αρχεία + σήμερα + ημέρα υπογραφής → γραμμές + σύνοψη`
 *
 * Τον τρέχει ο server (απάντηση API, AI knowledge base, αργότερα το email §5.6) **και** ο
 * client (optimistic updates) — ίδιος κώδικας, άρα η οθόνη δεν μπορεί να διαφωνήσει με
 * τον server.
 *
 * Σειρά απόφασης ανά γραμμή:
 *  1. γεγονός άγνωστο ⇒ `needs_answer` · γεγονός αντίθετο ⇒ `not_applicable` (fact)
 *  2. ρητό «δεν εφαρμόζεται» ⇒ `not_applicable` (manual)
 *  3. υπάρχει έλεγχος:
 *     - το ελεγμένο αρχείο ΔΕΝ είναι πια το νεότερο / άλλαξε έκδοση ⇒ `stale` (accepted)
 *       ή `uploaded` (rejected — «revise & resubmit»)
 *     - `rejected` ⇒ `rejected`
 *     - `accepted` ⇒ ισχύς: `expired` · `expiring` (≤7 ημ. ή λήγει πριν την υπογραφή) · `accepted`
 *  4. χωρίς έλεγχο: αρχεία ⇒ `uploaded` · συμβολαιογράφος ⇒ `notary_side` · σφραγισμένη παράδοση (Π2) ⇒
 *     `delivered_sealed` · αλλιώς `missing`
 *
 * **Layering**: leaf — καθαρές συναρτήσεις (το «σήμερα» το δίνει ο καλών).
 *
 * @module lib/conveyance/derive-checklist
 */

import { EXPIRING_WINDOW_DAYS } from '@/config/conveyance-checklist/catalog';
import { ruleExpiresOn, type DocumentExpiry } from '@/lib/document-validity/document-expiry';
import { resolvedDocumentExpiry } from '@/lib/document-validity/document-facts';
import { coveringIssueFrom } from '@/lib/document-validity/validity-bounds';
import { documentStanding, type DocumentStandingState } from '@/lib/document-validity/document-requirement';
import type { ChecklistItem, ConveyanceRole } from '@/config/conveyance-checklist/types';
import type {
  ChecklistItemOverride,
  ChecklistItemReview,
  ChecklistRow,
  ChecklistRowStatus,
  ChecklistSummary,
  DerivedChecklist,
  EvidenceFile,
  OpenQuestion,
  SealedDelivery,
} from '@/types/conveyance-case';
import { conveyanceNeededOn } from './conveyance-requirements';
import { rowFacts, rowFiles, type CaseFacts, type CaseRow } from './case-rows';
import type { FactValues } from './derive-facts';

export interface DeriveChecklistInput {
  /** ADR-915 §22 — οι γραμμές της υπόθεσης (κατάλογος × πρόσωπα, `caseRowsOf`). */
  readonly rows: readonly CaseRow[];
  /** Τα επιλυμένα γεγονότα της υπόθεσης και κάθε προσώπου (`resolveCaseFacts`). */
  readonly facts: CaseFacts;
  readonly overrides: Readonly<Record<string, ChecklistItemOverride>>;
  readonly evidence: readonly EvidenceFile[];
  /** Π2 — παραδόσεις που ο θεατής **δεν** βλέπει, σε γραμμές που βλέπει (`sealedDeliveries`). */
  readonly sealed: readonly SealedDelivery[];
  /** Σήμερα, `YYYY-MM-DD`. */
  readonly today: string;
  readonly targetSigningDate: string | null;
  /** `host` = ο οικοδεσπότης της υπόθεσης (βλέπει όλα)· αλλιώς φίλτρο `visibleTo` (Α4). */
  readonly viewer: ConveyanceRole | 'host';
}

type Base = Omit<ChecklistRow, 'status' | 'expiresOn' | 'expiryIsFloor' | 'validOnSigning' | 'notApplicableBy' | 'pendingFact'>;

interface Validity {
  readonly status: ChecklistRowStatus;
  readonly expiresOn: string | null;
  readonly expiryIsFloor: boolean;
  readonly validOnSigning: boolean | null;
}

const NO_VALIDITY = { expiresOn: null, expiryIsFloor: false, validOnSigning: null } as const;

/**
 * Βλέπει ο θεατής τη γραμμή; Ο οικοδεσπότης βλέπει **όλο** τον κατάλογο· κάθε ρόλος μόνο το `visibleTo` (Α4). Η ΜΙΑ
 * κρίση — τη ρωτούν και ο κριτής αιτημάτων (`document-request-policy`) και οι σφραγισμένες παραδόσεις (Π2).
 */
export function viewerSeesItem(viewer: ConveyanceRole | 'host', item: Pick<ChecklistItem, 'visibleTo'>): boolean {
  return viewer === 'host' || item.visibleTo.includes(viewer);
}

/** Τα αρχεία μίας γραμμής που βλέπει ο θεατής. */
export interface VisibleRowFiles {
  readonly itemId: string;
  readonly files: readonly EvidenceFile[];
}

/**
 * ADR-905 §6.2 — ό,τι από τα τεκμήρια **φτάνει στην όψη** του θεατή: μόνο γραμμές που βλέπει (`viewerSeesItem`),
 * μόνο αρχεία που αντιστοιχούν σε αυτές (`itemFiles`) — οι **ίδιες** δύο κρίσεις με το `deriveChecklist`. Τεκμήριο που
 * δεν πέφτει σε καμία γραμμή του θεατή δεν εμφανίζεται εδώ· άρα ούτε η αλλαγή του είναι αλλαγή της όψης του.
 */
export function visibleRowFiles(
  rows: readonly CaseRow[],
  viewer: ConveyanceRole | 'host',
  evidence: readonly EvidenceFile[],
): readonly VisibleRowFiles[] {
  return rows
    .filter((row) => viewerSeesItem(viewer, row.item))
    .map((row) => ({ itemId: row.key, files: rowFiles(row, evidence) }))
    .filter((row) => row.files.length > 0);
}

/**
 * Κατάσταση του κριτή → κατάσταση γραμμής. ⚠️ `expiry-unknown` → `accepted` **όπως πριν τη Φ2**: ο κατάλογος δεν έχει
 * ακόμη κατάσταση «άγνωστη λήξη» (π.χ. εγκεκριμένη γραμμή με κανόνα `unverified`). Νέα κατάσταση γραμμής αγγίζει
 * οθόνη, i18n και σύνοψη ⇒ απόφαση της ADR-915 Φ4, όχι παρενέργεια εδώ.
 */
const ROW_STATUS_OF: Readonly<Record<DocumentStandingState, ChecklistRowStatus>> = {
  valid: 'accepted',
  expiring: 'expiring',
  expired: 'expired',
  'expiry-unknown': 'accepted',
};

/**
 * Η ημέρα λήξης της εγκεκριμένης γραμμής. ADR-915 Φ3β (Α3): γραμμή με είδος εγγράφου διαβάζει τα γεγονότα **του
 * αρχείου που εγκρίθηκε** (έκδοση + τυπωμένη λήξη, Α4)· η ημερομηνία του ελεγκτή είναι η εφεδρεία όταν το αρχείο δεν ξέρει.
 */
function expiryOf(item: ChecklistItem, review: ChecklistItemReview, files: readonly EvidenceFile[]): Pick<DocumentExpiry, 'expiresOn' | 'source'> {
  if (item.documentKind === undefined) return { expiresOn: ruleExpiresOn(item.validity, review.issuedOn), source: 'rule' };
  const facts = files.find((file) => file.fileId === review.fileId)?.documentFacts ?? null;
  return resolvedDocumentExpiry(item.documentKind, facts, review.issuedOn, review.printedValidUntil ?? null);
}

/**
 * Ισχύς αποδεκτής γραμμής ως προς σήμερα ΚΑΙ ως προς την ημέρα υπογραφής (Σ-5). ADR-915: η ημέρα λήξης από τον ΕΝΑ
 * υπολογισμό (Φ1) και η κρίση από τον ΕΝΑ κριτή (Φ2)· το `validOnSigning` είναι το `validAtNeed` της απαίτησης.
 */
function validityOf(item: ChecklistItem, review: ChecklistItemReview, files: readonly EvidenceFile[], input: DeriveChecklistInput): Validity {
  const expiry = expiryOf(item, review, files);
  const standing = documentStanding({
    expiresOn: expiry.expiresOn,
    asOf: input.today,
    neededOn: conveyanceNeededOn(input.targetSigningDate),
    warnWindowDays: EXPIRING_WINDOW_DAYS,
  });
  return {
    status: ROW_STATUS_OF[standing.state],
    expiresOn: standing.expiresOn,
    expiryIsFloor: standing.expiresOn !== null && expiry.source === 'floor',
    validOnSigning: standing.validAtNeed,
  };
}

/** Είναι ο έλεγχος ακόμη δεμένος στο νεότερο αρχείο, στην ίδια έκδοση; */
function reviewIsCurrent(review: ChecklistItemReview, files: readonly EvidenceFile[]): boolean {
  if (review.fileId === null) return true;
  const newest = files[0];
  return newest !== undefined && newest.fileId === review.fileId && newest.fingerprint === review.fileFingerprint;
}

/** Χωρίς ορατό αρχείο: παραδόθηκε σφραγισμένα (Π2) ή λείπει. */
function absentStatus(sealed: SealedDelivery | null): ChecklistRowStatus {
  return sealed ? 'delivered_sealed' : 'missing';
}

function reviewedStatus(item: ChecklistItem, review: ChecklistItemReview, evidence: RowEvidence, input: DeriveChecklistInput): Validity {
  const { files, sealed } = evidence;
  if (!reviewIsCurrent(review, files)) {
    // Αποδεκτό που άλλαξε ⇒ ξανά έλεγχος· απορριφθέν που ξαναήρθε ⇒ «revise & resubmit».
    return { status: review.verdict === 'accepted' ? 'stale' : files.length > 0 ? 'uploaded' : absentStatus(sealed), ...NO_VALIDITY };
  }
  if (review.verdict === 'rejected') return { status: 'rejected', ...NO_VALIDITY };
  return validityOf(item, review, files, input);
}

function unreviewedStatus(item: ChecklistItem, { files, sealed }: RowEvidence): ChecklistRowStatus {
  if (files.length > 0) return 'uploaded';
  const satisfaction = item.satisfaction;
  if (satisfaction.kind === 'notary_issued') return 'notary_side';
  if (satisfaction.kind === 'files' && satisfaction.notaryFallback) return 'notary_side';
  return absentStatus(sealed);
}

/** Ό,τι ξέρει ο θεατής για τα έγγραφα μιας γραμμής: τα αρχεία που βλέπει + η νεότερη σφραγισμένη παράδοση. */
interface RowEvidence {
  readonly files: readonly EvidenceFile[];
  readonly sealed: SealedDelivery | null;
}

function newestSealed(itemId: string, sealed: readonly SealedDelivery[]): SealedDelivery | null {
  return sealed
    .filter((delivery) => delivery.itemId === itemId)
    .reduce<SealedDelivery | null>((newest, delivery) => (newest === null || delivery.deliveredAt > newest.deliveredAt ? delivery : newest), null);
}

/** Ισχύει η γραμμή; `'unknown'` ⇒ το γεγονός θέλει απάντηση. Ο ΕΝΑΣ κριτής — τον ρωτά και το μητρώο λήξεων (ADR-915 Φ4β). */
export function checklistItemApplicability(item: ChecklistItem, facts: FactValues): boolean | 'unknown' {
  if (item.requirement.kind === 'mandatory') return true;
  const value = facts[item.requirement.fact];
  if (value === undefined) return 'unknown';
  return value === item.requirement.equals;
}

function deriveRow(row: CaseRow, input: DeriveChecklistInput): ChecklistRow {
  const { item } = row;
  const override = input.overrides[row.key];
  const files = rowFiles(row, input.evidence);
  const sealed = newestSealed(row.key, input.sealed);
  const base: Base = {
    itemId: row.key, item, party: row.party, section: item.section, provider: item.provider, files, sealed,
    review: override?.review ?? null, notApplicable: override?.notApplicable ?? null,
    issueFrom: input.targetSigningDate === null ? null : coveringIssueFrom(item.validity, input.targetSigningDate),
  };
  const applies = checklistItemApplicability(item, rowFacts(row, input.facts));
  if (applies === 'unknown') {
    const fact = item.requirement.kind === 'when' ? item.requirement.fact : null;
    return { ...base, status: 'needs_answer', notApplicableBy: null, pendingFact: fact, ...NO_VALIDITY };
  }
  if (!applies) return { ...base, status: 'not_applicable', notApplicableBy: 'fact', pendingFact: null, ...NO_VALIDITY };
  if (override?.notApplicable) {
    return { ...base, status: 'not_applicable', notApplicableBy: 'manual', pendingFact: null, ...NO_VALIDITY };
  }
  const outcome = override?.review
    ? reviewedStatus(item, override.review, { files, sealed }, input)
    : { status: unreviewedStatus(item, { files, sealed }), ...NO_VALIDITY };
  return { ...base, ...outcome, notApplicableBy: null, pendingFact: null };
}

function countOf(rows: readonly ChecklistRow[], ...statuses: ChecklistRowStatus[]): number {
  return rows.filter((row) => statuses.includes(row.status)).length;
}

/** Η σύνοψη — ο ΕΝΑΣ αριθμός που διαβάζουν καρτέλα, AI και (Φ3) email (Σ-2). */
export function summarizeChecklist(rows: readonly ChecklistRow[]): ChecklistSummary {
  return {
    applicable: rows.length - countOf(rows, 'not_applicable', 'needs_answer'),
    complete: countOf(rows, 'accepted', 'notary_side', 'delivered_sealed'),
    awaitingReview: countOf(rows, 'uploaded', 'stale'),
    missing: countOf(rows, 'missing'),
    rejected: countOf(rows, 'rejected'),
    expiring: countOf(rows, 'expiring'),
    expired: countOf(rows, 'expired'),
    openQuestions: openQuestionsOf(rows),
  };
}

/** ADR-915 §22 — μία ερώτηση ανά (γεγονός, πρόσωπο): το «πληρεξούσιο;» του Α δεν απαντά για τον Β. */
function openQuestionsOf(rows: readonly ChecklistRow[]): readonly OpenQuestion[] {
  const questions = new Map<string, OpenQuestion>();
  for (const row of rows) {
    if (row.pendingFact === null) continue;
    const partyKey = row.party?.key ?? null;
    questions.set(`${partyKey ?? ''}|${row.pendingFact}`, { factId: row.pendingFact, partyKey });
  }
  return [...questions.values()];
}

export function deriveChecklist(input: DeriveChecklistInput): DerivedChecklist {
  const rows = input.rows
    .filter((row) => viewerSeesItem(input.viewer, row.item))
    .map((row) => deriveRow(row, input));
  return { rows, summary: summarizeChecklist(rows) };
}
