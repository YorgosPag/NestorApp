/**
 * @fileoverview **Η απόφαση γραμμής μέσα στη στοίβα αναίρεσης** (ADR-923 §5.5.2 Β9δ). Καθαρό, χωρίς React.
 * @module components/catalog/imports/review-history-line
 *
 * 🔑 **Το βήμα είναι κατάσταση**: «η γραμμή `(σελίδα, πίνακας, θέση)` είχε αυτή την απόφαση — ή καμία — και την είχε δώσει ο
 *    άνθρωπος ή η μνήμη». Η αναίρεση περνά από την **ίδια** πόρτα με την πράξη (`decideLine` → ξαναερμηνεία του πίνακα).
 * 🔑 **Καταγραφή τη στιγμή της πράξης, εμπλουτισμός με την απάντηση** (Figma: η σειρά της στοίβας = η σειρά των πράξεων). Το βήμα
 *    γράφεται με ό,τι ζητήθηκε· όταν ο διακομιστής απαντήσει, αντικαθίσταται με ό,τι **έγινε** (`settledLineStep`) — ή φεύγει, αν
 *    η πράξη αρνήθηκε ή δεν άλλαξε τίποτα.
 * 🔑 **Α — το δέσιμο στην οικογένεια μένει.** Το σχήμα της οικογένειας είναι κοινή βιβλιοθήκη (Figma: αλλαγή σε δημοσιευμένη
 *    βιβλιοθήκη δεν αναιρείται από το αρχείο που τη χρησιμοποιεί). Η αναίρεση στέλνει `bind: null`· η επανάληψη το αρχικό `bind`.
 * 🔑 **Β — επιστροφή στη μνήμη χωρίς δήλωση προέλευσης**: `decision: null` + `fallback: 'memory'`, και ο διακομιστής ρωτά ξανά.
 * 🔑 **Δ — μία πράξη = μία μονάδα, και στις συνέπειες** (συναλλαγή του Revit): αν η ξαναερμηνεία έσβησε αποφάσεις πεδίων του
 *    ανθρώπου, το βήμα τις κρατά (`restore`) και η αναίρεση τις επαναφέρει **αφού** ξαναχτιστεί ο πίνακας, με τον ίδιο έλεγχο
 *    «είναι ακόμη όπως το άφησες;». **Γ**: πεδίο που δεν ξαναεμφανίζεται ίδιο παρακάμπτεται και μετριέται.
 */

import { fieldAddress } from '@/subapps/catalog/import/human-edits';
import { sameLineDecision } from '@/subapps/catalog/import/label-memory';
import { lineOverrideOf, sameLine, stepAttributeIdOf } from '@/subapps/catalog/import/page-line-overrides';
import { importTargetKey } from '@/subapps/catalog/import/proposal-values';
import type { ImportLineDecision, ImportTarget } from '@/subapps/catalog/types/catalog-import';
import type { ImportBatchDetailView, ImportProposalWire, SetImportLineRequest, SetImportLineResult } from '@/subapps/catalog/types/catalog-import-requests';
import { ANY_SLOT } from '@/subapps/catalog/types/product';
import {
  fieldsOf,
  humanDecisionOf,
  pendingProposalOf,
  type FieldAt,
  type FieldFollowUp,
  type FieldMark,
  type FieldRestore,
  type LineMark,
  type LineStep,
  type LineStepKind,
  type ReviewStepLabel,
  type ReviewStepPlan,
  type StepPair,
} from './review-history';

type LineAddress = Pick<LineMark, 'page' | 'table' | 'line'>;

/** Η γραμμή όπως είναι **τώρα** στην όψη. */
function currentMark(view: ImportBatchDetailView, address: LineAddress): LineMark {
  const override = lineOverrideOf(view.batch.pages?.lineOverrides, address);
  return { page: address.page, table: address.table, line: address.line, decision: override?.decision ?? null, memory: override?.origin !== undefined, bind: null };
}

/** Ο ΕΝΑΣ κανόνας ισότητας αποφάσεων γραμμής (`sameLineDecision`, ίδιος με τη μνήμη του προμηθευτή), επεκταμένος στο «καμία». */
const sameDecision = (a: ImportLineDecision | null, b: ImportLineDecision | null): boolean =>
  a === null || b === null ? a === b : sameLineDecision(a, b);

/** Είναι η γραμμή όπως τη λέει η πλευρά; Απόφαση **και** προέλευση: πάνω σε απόφαση μνήμης που ήρθε στο μεταξύ δεν πατάμε. */
const lineHolds = (view: ImportBatchDetailView, mark: LineMark): boolean => {
  const now = currentMark(view, mark);
  return sameDecision(now.decision, mark.decision) && now.memory === mark.memory;
};

const LINE_KIND: Readonly<Record<ImportLineDecision['kind'], LineStepKind>> = {
  attribute: 'lineAttribute',
  axis: 'lineAxis',
  price: 'linePrice',
  ignore: 'lineIgnore',
};

const attributeTarget = (attributeId: string): ImportTarget => ({ kind: 'attribute', attributeId, channel: ANY_SLOT, locale: ANY_SLOT });

/** Η λέξη της γραμμής όπως τη βλέπει ο άνθρωπος στη λίστα («ΠΑΡ.ΝΕΡΟΥ · m³/h»)· αλλιώς ο αριθμός της. */
const lineTextOf = (view: ImportBatchDetailView, address: LineAddress): string =>
  view.batch.pages?.unmappedLines?.find((line) => sameLine(line, address))?.label ?? String(address.line + 1);

function lineLabelOf(view: ImportBatchDetailView, before: LineMark, after: LineMark): ReviewStepLabel {
  const { decision } = after;
  // §5.5.2 Β3 Γ13: «και σε άλλη ιδιότητα» ονομάζει τη νέα, όχι την κύρια που υπήρχε ήδη.
  const attributeId = stepAttributeIdOf(before.decision, decision);
  const target = attributeId === null ? null : attributeTarget(attributeId);
  const bound = decision?.kind === 'attribute' && after.bind !== null;
  return { kind: decision === null ? 'lineUndo' : LINE_KIND[decision.kind], line: lineTextOf(view, after), target, bound, count: 1 };
}

function linePair(view: ImportBatchDetailView, ownerId: string, before: LineMark, after: LineMark, restore: readonly FieldRestore[]): StepPair<LineStep> {
  const label = lineLabelOf(view, before, after);
  return {
    before: { kind: 'line', proposalId: ownerId, label, line: before, restore },
    after: { kind: 'line', proposalId: ownerId, label, line: after, restore: [] },
  };
}

/**
 * Το βήμα τη στιγμή της πράξης: πριν = η όψη τώρα, μετά = ό,τι ζητήθηκε. `null` ⇒ το αίτημα δεν αλλάζει τίποτα. Νέα ιδιότητα (`create`,
 * §5.5.2 Β3 Γ11) αλλάζει **πάντα** τη γραμμή, με id που μαθαίνεται από την απάντηση (`settledLineStep`)· η αναίρεσή της αφήνει την
 * ιδιότητα στη βιβλιοθήκη και στην οικογένεια (Α).
 */
export function lineStepOf(view: ImportBatchDetailView, owner: ImportProposalWire, request: SetImportLineRequest): StepPair<LineStep> | null {
  const before = currentMark(view, request);
  const after: LineMark = { page: request.page, table: request.table, line: request.line, decision: request.decision, memory: false, bind: request.bind };
  if (request.create === undefined && sameDecision(before.decision, after.decision) && !before.memory) return null;
  return linePair(view, owner.id, before, after, []);
}

/** Οι αποφάσεις πεδίων του ανθρώπου που υπήρχαν πριν και δεν υπάρχουν μετά, ανά πρόταση (απόφαση Δ). */
function lostDecisions(before: ImportBatchDetailView, after: ImportBatchDetailView): FieldRestore[] {
  return before.proposals.flatMap((proposal): FieldRestore[] => {
    const next = after.proposals.find((item) => item.id === proposal.id);
    const fields: ReadonlyMap<string, FieldAt> = next ? fieldsOf(next) : new Map<string, FieldAt>();
    const marks = proposal.rows.flatMap((row) => row.fields.flatMap((field): FieldMark[] => {
      const decision = humanDecisionOf(field);
      const targetKey = importTargetKey(field.target);
      const now = fields.get(fieldAddress(row.rowKey, targetKey));
      return decision !== null && (!now || humanDecisionOf(now.field) !== decision) ? [{ rowKey: row.rowKey, targetKey, decision }] : [];
    }));
    return marks.length > 0 ? [{ proposalId: proposal.id, marks }] : [];
  });
}

/**
 * Το βήμα με ό,τι **έγινε**: η απόφαση που γράφτηκε όντως (π.χ. η μνήμη απάντησε στο `fallback`) και οι αποφάσεις πεδίων που
 * έσβησε η ξαναερμηνεία. `null` ⇒ το βήμα φεύγει (άρνηση · αποτυχία μεταφοράς · τίποτα δεν άλλαξε).
 */
export function settledLineStep(step: StepPair<LineStep>, before: ImportBatchDetailView, result: SetImportLineResult | null): StepPair<LineStep> | null {
  if (!result || result.outcome.kind !== 'settled') return null;
  const done: LineMark = { ...currentMark(result.view, step.after.line), bind: step.after.line.bind };
  const was = step.before.line;
  if (sameDecision(was.decision, done.decision) && was.memory === done.memory) return null;
  return linePair(before, step.before.proposalId, was, done, lostDecisions(before, result.view));
}

/** Από την όψη που θα επιστρέψει η ξαναερμηνεία: «ήταν του κανόνα» → «ξανά του ανθρώπου», με τον ίδιο έλεγχο. */
const followUpsOf = (restore: readonly FieldRestore[]): FieldFollowUp[] =>
  restore.map(({ proposalId, marks }) => ({ proposalId, from: marks.map((mark) => ({ ...mark, decision: null })), to: marks }));

function requestTo(to: LineMark): SetImportLineRequest {
  const address = { page: to.page, table: to.table, line: to.line };
  if (to.memory && to.decision !== null) return { ...address, decision: null, bind: null, fallback: 'memory' };
  return { ...address, decision: to.decision, bind: to.bind };
}

/**
 * Από την πλευρά `from` στην πλευρά `to`. Η γραμμή πηγαίνει μόνο αν είναι **ακόμη** όπως την άφησε το βήμα και η πρόταση του
 * πίνακα εκκρεμεί. Οι συνέπειες (Δ) κρίνονται **μετά**, πάνω στην όψη που θα επιστρέψει η ξαναερμηνεία.
 */
export function planLineStep(view: ImportBatchDetailView, from: LineStep, to: LineStep): ReviewStepPlan {
  const proposal: ImportProposalWire | null = pendingProposalOf(view.proposals, to.proposalId);
  if (!proposal || !lineHolds(view, from.line)) return { send: null, skipped: 1 };
  const bindKept = from.label.kind === 'lineAttribute' && from.label.bound && to.line.bind === null;
  return { send: { door: 'line', proposal, request: requestTo(to.line), then: followUpsOf(to.restore), bindKept }, skipped: 0 };
}
