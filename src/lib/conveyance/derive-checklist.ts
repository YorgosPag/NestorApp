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
 *  4. χωρίς έλεγχο: αρχεία ⇒ `uploaded` · συμβολαιογράφος ⇒ `notary_side` · αλλιώς `missing`
 *
 * **Layering**: leaf — καθαρές συναρτήσεις (το «σήμερα» το δίνει ο καλών).
 *
 * @module lib/conveyance/derive-checklist
 */

import { addDaysToDateKey, isDateKey } from '@/lib/calendar/date-key';
import { EXPIRING_WINDOW_DAYS } from '@/config/conveyance-checklist/catalog';
import type { ChecklistItem, ConveyanceFactId, ConveyanceRole } from '@/config/conveyance-checklist/types';
import type {
  ChecklistItemOverride,
  ChecklistItemReview,
  ChecklistRow,
  ChecklistRowStatus,
  ChecklistSummary,
  DerivedChecklist,
  EvidenceFile,
} from '@/types/conveyance-case';
import { filesForMatchers } from './evidence-match';
import type { FactValues } from './derive-facts';

export interface DeriveChecklistInput {
  readonly items: readonly ChecklistItem[];
  readonly facts: FactValues;
  readonly overrides: Readonly<Record<string, ChecklistItemOverride>>;
  readonly evidence: readonly EvidenceFile[];
  /** Σήμερα, `YYYY-MM-DD`. */
  readonly today: string;
  readonly targetSigningDate: string | null;
  /** `host` = ο οικοδεσπότης της υπόθεσης (βλέπει όλα)· αλλιώς φίλτρο `visibleTo` (Α4). */
  readonly viewer: ConveyanceRole | 'host';
}

type Base = Omit<ChecklistRow, 'status' | 'expiresOn' | 'validOnSigning' | 'notApplicableBy' | 'pendingFact'>;

interface Validity {
  readonly status: ChecklistRowStatus;
  readonly expiresOn: string | null;
  readonly validOnSigning: boolean | null;
}

const NO_VALIDITY = { expiresOn: null, validOnSigning: null } as const;

function isVisibleTo(item: ChecklistItem, viewer: DeriveChecklistInput['viewer']): boolean {
  return viewer === 'host' || item.visibleTo.includes(viewer);
}

function itemFiles(item: ChecklistItem, evidence: readonly EvidenceFile[]): readonly EvidenceFile[] {
  return item.satisfaction.kind === 'files' ? filesForMatchers(item.satisfaction.matchers, evidence) : [];
}

/** Ισχύς αποδεκτής γραμμής ως προς σήμερα ΚΑΙ ως προς την ημέρα υπογραφής (Σ-5). */
function validityOf(item: ChecklistItem, review: ChecklistItemReview, input: DeriveChecklistInput): Validity {
  if (item.validity.kind !== 'days' || review.issuedOn === null || !isDateKey(review.issuedOn)) {
    return { status: 'accepted', ...NO_VALIDITY };
  }
  const expiresOn = addDaysToDateKey(review.issuedOn, item.validity.days);
  if (expiresOn === null) return { status: 'accepted', ...NO_VALIDITY };
  const signing = input.targetSigningDate !== null && isDateKey(input.targetSigningDate) ? input.targetSigningDate : null;
  const validOnSigning = signing === null ? null : expiresOn >= signing;
  if (expiresOn < input.today) return { status: 'expired', expiresOn, validOnSigning };
  const warnFrom = addDaysToDateKey(expiresOn, -EXPIRING_WINDOW_DAYS) ?? expiresOn;
  const expiring = input.today >= warnFrom || validOnSigning === false;
  return { status: expiring ? 'expiring' : 'accepted', expiresOn, validOnSigning };
}

/** Είναι ο έλεγχος ακόμη δεμένος στο νεότερο αρχείο, στην ίδια έκδοση; */
function reviewIsCurrent(review: ChecklistItemReview, files: readonly EvidenceFile[]): boolean {
  if (review.fileId === null) return true;
  const newest = files[0];
  return newest !== undefined && newest.fileId === review.fileId && newest.fingerprint === review.fileFingerprint;
}

function reviewedStatus(item: ChecklistItem, review: ChecklistItemReview, files: readonly EvidenceFile[], input: DeriveChecklistInput): Validity {
  if (!reviewIsCurrent(review, files)) {
    // Αποδεκτό που άλλαξε ⇒ ξανά έλεγχος· απορριφθέν που ξαναήρθε ⇒ «revise & resubmit».
    return { status: review.verdict === 'accepted' ? 'stale' : files.length > 0 ? 'uploaded' : 'missing', ...NO_VALIDITY };
  }
  if (review.verdict === 'rejected') return { status: 'rejected', ...NO_VALIDITY };
  return validityOf(item, review, input);
}

function unreviewedStatus(item: ChecklistItem, files: readonly EvidenceFile[]): ChecklistRowStatus {
  if (files.length > 0) return 'uploaded';
  const satisfaction = item.satisfaction;
  if (satisfaction.kind === 'notary_issued') return 'notary_side';
  if (satisfaction.kind === 'files' && satisfaction.notaryFallback) return 'notary_side';
  return 'missing';
}

/** Ισχύει η γραμμή; `'unknown'` ⇒ το γεγονός θέλει απάντηση. */
function applicability(item: ChecklistItem, facts: FactValues): boolean | 'unknown' {
  if (item.requirement.kind === 'mandatory') return true;
  const value = facts[item.requirement.fact];
  if (value === undefined) return 'unknown';
  return value === item.requirement.equals;
}

function deriveRow(item: ChecklistItem, input: DeriveChecklistInput): ChecklistRow {
  const override = input.overrides[item.id];
  const files = itemFiles(item, input.evidence);
  const base: Base = {
    itemId: item.id, item, section: item.section, provider: item.provider, files,
    review: override?.review ?? null, notApplicable: override?.notApplicable ?? null,
  };
  const applies = applicability(item, input.facts);
  if (applies === 'unknown') {
    const fact = item.requirement.kind === 'when' ? item.requirement.fact : null;
    return { ...base, status: 'needs_answer', notApplicableBy: null, pendingFact: fact, ...NO_VALIDITY };
  }
  if (!applies) return { ...base, status: 'not_applicable', notApplicableBy: 'fact', pendingFact: null, ...NO_VALIDITY };
  if (override?.notApplicable) {
    return { ...base, status: 'not_applicable', notApplicableBy: 'manual', pendingFact: null, ...NO_VALIDITY };
  }
  const outcome = override?.review
    ? reviewedStatus(item, override.review, files, input)
    : { status: unreviewedStatus(item, files), ...NO_VALIDITY };
  return { ...base, ...outcome, notApplicableBy: null, pendingFact: null };
}

function countOf(rows: readonly ChecklistRow[], ...statuses: ChecklistRowStatus[]): number {
  return rows.filter((row) => statuses.includes(row.status)).length;
}

/** Η σύνοψη — ο ΕΝΑΣ αριθμός που διαβάζουν καρτέλα, AI και (Φ3) email (Σ-2). */
export function summarizeChecklist(rows: readonly ChecklistRow[]): ChecklistSummary {
  const openQuestions = [...new Set(
    rows.map((row) => row.pendingFact).filter((fact): fact is ConveyanceFactId => fact !== null),
  )];
  return {
    applicable: rows.length - countOf(rows, 'not_applicable', 'needs_answer'),
    complete: countOf(rows, 'accepted', 'notary_side'),
    awaitingReview: countOf(rows, 'uploaded', 'stale'),
    missing: countOf(rows, 'missing'),
    rejected: countOf(rows, 'rejected'),
    expiring: countOf(rows, 'expiring'),
    expired: countOf(rows, 'expired'),
    openQuestions,
  };
}

export function deriveChecklist(input: DeriveChecklistInput): DerivedChecklist {
  const rows = input.items
    .filter((item) => isVisibleTo(item, input.viewer))
    .map((item) => deriveRow(item, input));
  return { rows, summary: summarizeChecklist(rows) };
}
