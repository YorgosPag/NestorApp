/**
 * @fileoverview **Η στοίβα αναίρεσης της οθόνης ελέγχου — το καθαρό μοντέλο** (ADR-923 §5.5.2 Β9β · Β9δ).
 * @module components/catalog/imports/review-history
 *
 * Κάθε ενέργεια του ανθρώπου στην οθόνη γίνεται **ένα** βήμα `{ before, after }` της γενικής στοίβας `grid-history` — μία πράξη =
 * μία μονάδα (Figma · Revit · ArchiCAD). Τρία είδη βήματος, ΜΙΑ στοίβα: **πεδία** (απόφαση · αναίρεση απόφασης · διόρθωση ·
 * «Αποδοχή γραμμής»), **κωδικός μοντέλου** (Β9δ) και **απόφαση γραμμής** (Β9δ, `review-history-line`). Καθαρό, χωρίς React.
 *
 * 🔑 **Το βήμα είναι κατάσταση, όχι εντολή.** Κάθε πλευρά λέει «πώς ήταν»: απόφαση **ανθρώπου** (`accept`/`reject`) ή `null` =
 *    κρίση του κανόνα, διόρθωση (κείμενο) ή `null` = καμία, κωδικός του ανθρώπου ή `null` = της πηγής. Η αναίρεση στέλνει την
 *    πλευρά `before` από την **ίδια** πόρτα με την αρχική πράξη, άρα είναι ιδεμπότητη και περνά τον ίδιο κριτή.
 * 🔑 **Αναιρείς μόνο ό,τι είναι ακόμη δικό σου** (Figma: η στοίβα είναι ανά χρήστη). Η όψη είναι ζωντανή (ADR-905): άλλη καρτέλα
 *    ή άλλος άνθρωπος μπορεί να το άλλαξε στο μεταξύ. Ό,τι **δεν** είναι πια όπως το άφησε το βήμα παρακάμπτεται και μετριέται —
 *    δεν πατιέται ποτέ ξένη απόφαση. Πρόταση που εγκρίθηκε ή απορρίφθηκε ⇒ τίποτα να αναιρεθεί.
 * 🔑 **Η απόφαση μετά από διόρθωση τη δίνει ο διακομιστής** (`withEditDecisions`), άρα η πλευρά `after` μιας διόρθωσης **δεν**
 *    δηλώνει απόφαση (`decision` απόν) — ούτε την ελέγχει ούτε τη στέλνει.
 * 🔑 **Ο κωδικός μοντέλου κανονικοποιείται με τον ΙΔΙΟ κανόνα με τον γραφέα** (`normalizedModelCodeEdit`): «ίδιο με την πηγή» ή κενό
 *    = καμία διόρθωση, άρα η πλευρά `after` λέει ακριβώς ό,τι θα φυλαχτεί.
 */

import { decisionSourceOf } from '@/subapps/catalog/import/field-diff';
import { editsByAddress, fieldAddress, normalizedModelCodeEdit } from '@/subapps/catalog/import/human-edits';
import { importTargetKey } from '@/subapps/catalog/import/proposal-values';
import type { ImportLineDecision, ImportProposalField, ImportTarget } from '@/subapps/catalog/types/catalog-import';
import type {
  ImportFieldDecisionInput,
  ImportFieldEditInput,
  ImportProposalWire,
  SetImportLineRequest,
} from '@/subapps/catalog/types/catalog-import-requests';
import type { HumanFieldDecision, ImportLineBindLevel } from '@/subapps/catalog/vocabulary/catalog-import';
import type { ProposalChange } from './proposal-change-queue';

/** Η κατάσταση ενός πεδίου σε μία πλευρά του βήματος. Απόν μέρος = «δεν το αφορά αυτό το βήμα». */
export interface FieldMark {
  readonly rowKey: string;
  readonly targetKey: string;
  readonly decision?: HumanFieldDecision;
  /** Κείμενο διόρθωσης · `null` = καμία διόρθωση (τιμή της πηγής). */
  readonly edit?: string | null;
}

/** Τι έκανε ο άνθρωπος — για το όνομα του βήματος (λίστα αναίρεσης του Revit). */
export type FieldStepKind = 'accept' | 'reject' | 'undoDecision' | 'edit' | 'revertEdit' | 'acceptRow';
export type ModelCodeStepKind = 'modelCode' | 'removeModelCode';
export type LineStepKind = 'lineAttribute' | 'lineAxis' | 'linePrice' | 'lineIgnore' | 'lineUndo';
export type ReviewStepKind = FieldStepKind | ModelCodeStepKind | LineStepKind;

/** Το όνομα του βήματος. Ο στόχος ονομάζεται από τον ίδιο ονοματοδότη με τη λίστα (`useTargetLabeler`). */
export type ReviewStepLabel =
  | { readonly kind: FieldStepKind; readonly target: ImportTarget; readonly count: number }
  | { readonly kind: ModelCodeStepKind; readonly code: string; readonly count: 1 }
  /** `bound`: η πράξη έδεσε νέα ιδιότητα στην οικογένεια — η αναίρεση επαναφέρει τη γραμμή, το σχήμα μένει (απόφαση Α). */
  | { readonly kind: LineStepKind; readonly line: string; readonly target: ImportTarget | null; readonly bound: boolean; readonly count: 1 };

/**
 * **Ομαδική πράξη** = πάνω από ένα πεδίο με μία κίνηση (§5.5.2 Β9γ). Μόνο αυτή παίρνει toast «Αναίρεση» (Gmail): η πράξη σε ΕΝΑ
 * πεδίο φαίνεται ήδη στη θέση της και αναιρείται εκεί (↺) — toast σε κάθε κλικ θα ήταν θόρυβος.
 */
export const isGroupStep = (label: ReviewStepLabel): boolean => label.count > 1;

/** Η κατάσταση μιας γραμμής πίνακα σε μία πλευρά του βήματος (Β9δ). */
export interface LineMark {
  readonly page: number;
  readonly table: string;
  readonly line: number;
  readonly decision: ImportLineDecision | null;
  /** Την απόφαση την είχε δώσει η μνήμη του προμηθευτή (απόφαση Β): η επιστροφή σε αυτήν τη ρωτά ξανά, δεν τη δηλώνει. */
  readonly memory: boolean;
  /** Μόνο στην πλευρά `after`: η επανάληψη ξαναστέλνει το αρχικό αίτημα ακριβώς (το δέσιμο είναι ιδεμπότητο). */
  readonly bind: ImportLineBindLevel | null;
}

/** Αποφάσεις πεδίων μιας πρότασης που έσβησε η ξαναερμηνεία του πίνακα: η αναίρεση της γραμμής τις επαναφέρει (απόφαση Δ). */
export interface FieldRestore {
  readonly proposalId: string;
  readonly marks: readonly FieldMark[];
}

interface StepSide {
  readonly proposalId: string;
  readonly label: ReviewStepLabel;
}

export interface FieldsStep extends StepSide {
  readonly kind: 'fields';
  readonly marks: readonly FieldMark[];
}

export interface ModelCodeStep extends StepSide {
  readonly kind: 'modelCode';
  /** Ο κωδικός του ανθρώπου · `null` = της πηγής. */
  readonly modelCode: string | null;
}

/** `restore` υπάρχει μόνο στην πλευρά `before`: ό,τι πρέπει να ξαναγίνει **μετά** την επαναφορά της γραμμής. */
export interface LineStep extends StepSide {
  readonly kind: 'line';
  readonly line: LineMark;
  readonly restore: readonly FieldRestore[];
}

/** Μία πλευρά του βήματος. Οι δύο πλευρές έχουν πάντα το ίδιο είδος και το ίδιο όνομα. */
export type ReviewStep = FieldsStep | ModelCodeStep | LineStep;

export interface StepPair<S extends ReviewStep = ReviewStep> {
  readonly before: S;
  readonly after: S;
}

/** Ό,τι στέλνεται για να πάει η πρόταση στην άλλη πλευρά — από την ΙΔΙΑ πόρτα με την αρχική πράξη. */
export type ReviewSend =
  | { readonly door: 'change'; readonly proposal: ImportProposalWire; readonly change: ProposalChange }
  | { readonly door: 'line'; readonly proposal: ImportProposalWire; readonly request: SetImportLineRequest; readonly then: readonly FieldFollowUp[]; readonly bindKept: boolean };

/** Βήμα πεδίων που κρίνεται **μετά** την ξαναερμηνεία, πάνω στην όψη που αυτή επέστρεψε (απόφαση Δ). */
export interface FieldFollowUp {
  readonly proposalId: string;
  readonly from: readonly FieldMark[];
  readonly to: readonly FieldMark[];
}

export interface ReviewStepPlan {
  readonly send: ReviewSend | null;
  /** Πόσα δεν πήγαν πίσω γιατί τα άλλαξε κάποιος άλλος (ή η πρόταση δεν εκκρεμεί πια). */
  readonly skipped: number;
}

export interface FieldAt {
  readonly field: ImportProposalField;
  readonly edit: string | null;
}

export function fieldsOf(proposal: ImportProposalWire): ReadonlyMap<string, FieldAt> {
  const edits = editsByAddress(proposal.edits);
  const entries = proposal.rows.flatMap((row) => row.fields.map((field) => {
    const address = fieldAddress(row.rowKey, importTargetKey(field.target));
    return [address, { field, edit: edits.get(address)?.text ?? null }] as const;
  }));
  return new Map(entries);
}

/** Η απόφαση ενός πεδίου όπως τη ζητά ο άνθρωπος: δική του ⇒ η τιμή της, του κανόνα ⇒ `null`. */
export const humanDecisionOf = (field: ImportProposalField): HumanFieldDecision =>
  decisionSourceOf(field) === 'human' && field.decision !== 'pending' ? field.decision : null;

/** Είναι το πεδίο όπως το λέει η πλευρά; Μετριούνται μόνο τα μέρη που δηλώνει. */
function holds(at: FieldAt | undefined, mark: FieldMark): boolean {
  if (!at) return false;
  if (mark.decision !== undefined && humanDecisionOf(at.field) !== mark.decision) return false;
  return mark.edit === undefined || at.edit === mark.edit;
}

function labelOf(change: ProposalChange, first: ImportTarget): ReviewStepLabel | null {
  const decisions = change.decisions ?? [];
  const edits = change.edits ?? [];
  if (edits.length > 0) return { kind: edits[0].revert === true ? 'revertEdit' : 'edit', target: first, count: edits.length };
  if (decisions.length === 0) return null;
  if (decisions.length > 1) return { kind: 'acceptRow', target: first, count: decisions.length };
  const decision = decisions[0].decision;
  return { kind: decision === null ? 'undoDecision' : decision, target: first, count: 1 };
}

export const addressOf = (input: { readonly rowKey: string; readonly targetKey: string }): string => fieldAddress(input.rowKey, input.targetKey);

/** Η πλευρά `after`: ό,τι ζητήθηκε. Η διόρθωση δεν δηλώνει απόφαση (τη δίνει ο διακομιστής). */
function afterMarks(decisions: readonly ImportFieldDecisionInput[], edits: readonly ImportFieldEditInput[]): FieldMark[] {
  const marks = new Map<string, FieldMark>();
  for (const input of decisions) marks.set(addressOf(input), { rowKey: input.rowKey, targetKey: input.targetKey, decision: input.decision });
  for (const input of edits) {
    const previous = marks.get(addressOf(input));
    marks.set(addressOf(input), { ...previous, rowKey: input.rowKey, targetKey: input.targetKey, edit: input.revert === true ? null : input.text });
  }
  return [...marks.values()];
}

function fieldsStepOf(proposal: ImportProposalWire, change: ProposalChange): StepPair<FieldsStep> | null {
  const fields = fieldsOf(proposal);
  const after = afterMarks(change.decisions ?? [], change.edits ?? []).filter((mark) => fields.has(addressOf(mark)));
  if (after.length === 0) return null;
  const label = labelOf(change, (fields.get(addressOf(after[0])) as FieldAt).field.target);
  if (!label) return null;
  const before = after.map((mark): FieldMark => {
    const at = fields.get(addressOf(mark)) as FieldAt;
    return { rowKey: mark.rowKey, targetKey: mark.targetKey, decision: humanDecisionOf(at.field), ...(mark.edit !== undefined ? { edit: at.edit } : {}) };
  });
  return { before: { kind: 'fields', proposalId: proposal.id, label, marks: before }, after: { kind: 'fields', proposalId: proposal.id, label, marks: after } };
}

/** Ο κωδικός του ανθρώπου όπως ισχύει τώρα στην πρόταση · `null` = της πηγής. */
const ownModelCodeOf = (proposal: ImportProposalWire): string | null => proposal.modelCodeEdit?.modelCode ?? null;

function modelCodeStepOf(proposal: ImportProposalWire, requested: string): StepPair<ModelCodeStep> | null {
  const before = ownModelCodeOf(proposal);
  const after = normalizedModelCodeEdit(requested, proposal.extracted.modelCode);
  if (before === after) return null;
  const label: ReviewStepLabel = after === null ? { kind: 'removeModelCode', code: before ?? '', count: 1 } : { kind: 'modelCode', code: after, count: 1 };
  const side = (modelCode: string | null): ModelCodeStep => ({ kind: 'modelCode', proposalId: proposal.id, label, modelCode });
  return { before: side(before), after: side(after) };
}

/**
 * Το βήμα μιας αλλαγής πάνω στην πρόταση όπως τη βλέπει **τώρα** ο άνθρωπος. `null` ⇒ τίποτα να θυμηθεί (καμία πραγματική αλλαγή,
 * ή πεδία που δεν υπάρχουν). Η οθόνη στέλνει τον κωδικό μοντέλου **μόνος του** (`ProposalReview`)· αλλαγή που φέρει και πεδία
 * καταγράφεται ως βήμα πεδίων.
 */
export function reviewStepOf(proposal: ImportProposalWire, change: ProposalChange): StepPair | null {
  const touchesFields = (change.decisions ?? []).length > 0 || (change.edits ?? []).length > 0;
  if (!touchesFields && typeof change.modelCode === 'string') return modelCodeStepOf(proposal, change.modelCode);
  return fieldsStepOf(proposal, change);
}

/** Η πρόταση, μόνο αν εκκρεμεί ακόμη: εγκεκριμένη ή απορριμμένη δεν αλλάζει πια από την οθόνη. */
export const pendingProposalOf = (proposals: readonly ImportProposalWire[], id: string): ImportProposalWire | null =>
  proposals.find((item) => item.id === id && item.status === 'pending') ?? null;

/**
 * Από τα σημάδια `from` στα σημάδια `to`: μόνο τα πεδία που είναι **ακόμη** όπως τα λέει το `from`. Πρόταση που δεν εκκρεμεί
 * πια (εγκρίθηκε · απορρίφθηκε · χάθηκε) ⇒ όλα παρακάμπτονται.
 */
export function planFieldMarks(proposals: readonly ImportProposalWire[], proposalId: string, from: readonly FieldMark[], to: readonly FieldMark[]): ReviewStepPlan {
  const proposal = pendingProposalOf(proposals, proposalId);
  if (!proposal) return { send: null, skipped: to.length };
  const fields = fieldsOf(proposal);
  const ours = new Set(from.filter((mark) => holds(fields.get(addressOf(mark)), mark)).map(addressOf));
  const marks = to.filter((mark) => ours.has(addressOf(mark)));
  const skipped = to.length - marks.length;
  if (marks.length === 0) return { send: null, skipped };
  const decisions = marks.flatMap((mark): ImportFieldDecisionInput[] =>
    mark.decision === undefined ? [] : [{ rowKey: mark.rowKey, targetKey: mark.targetKey, decision: mark.decision }]);
  const edits = marks.flatMap((mark): ImportFieldEditInput[] => {
    if (mark.edit === undefined) return [];
    return [mark.edit === null ? { rowKey: mark.rowKey, targetKey: mark.targetKey, text: '', revert: true } : { rowKey: mark.rowKey, targetKey: mark.targetKey, text: mark.edit }];
  });
  return { send: { door: 'change', proposal, change: { decisions, edits } }, skipped };
}

/** Ο κωδικός πηγαίνει πίσω μόνο αν είναι ακόμη όπως τον άφησε το βήμα. `''` στην πόρτα = επιστροφή στην πηγή. */
export function planModelCode(proposals: readonly ImportProposalWire[], from: ModelCodeStep, to: ModelCodeStep): ReviewStepPlan {
  const proposal = pendingProposalOf(proposals, to.proposalId);
  if (!proposal || ownModelCodeOf(proposal) !== from.modelCode) return { send: null, skipped: 1 };
  return { send: { door: 'change', proposal, change: { modelCode: to.modelCode ?? '' } }, skipped: 0 };
}
