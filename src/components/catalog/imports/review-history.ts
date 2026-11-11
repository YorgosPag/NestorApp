/**
 * @fileoverview **Η στοίβα αναίρεσης της οθόνης ελέγχου — το καθαρό μοντέλο** (ADR-923 §5.5.2 Β9β).
 * @module components/catalog/imports/review-history
 *
 * Κάθε ενέργεια του ανθρώπου πάνω σε πεδία (απόφαση · αναίρεση απόφασης · διόρθωση · «Αποδοχή γραμμής») γίνεται **ένα** βήμα
 * `{ before, after }` της γενικής στοίβας `grid-history` — μία πράξη = μία μονάδα (Figma · Revit · ArchiCAD). Καθαρό, χωρίς React.
 *
 * 🔑 **Το βήμα είναι κατάσταση, όχι εντολή.** Κάθε πλευρά λέει «πώς ήταν τα πεδία»: απόφαση **ανθρώπου** (`accept`/`reject`) ή
 *    `null` = κρίση του κανόνα, και διόρθωση (κείμενο) ή `null` = καμία. Η αναίρεση στέλνει την πλευρά `before` από την **ίδια**
 *    πόρτα με κάθε άλλη αλλαγή (`decidedField` · `recordEdits` στον γραφέα), άρα είναι ιδεμπότητη και περνά τον ίδιο κριτή.
 * 🔑 **Αναιρείς μόνο ό,τι είναι ακόμη δικό σου** (Figma: η στοίβα είναι ανά χρήστη). Η όψη είναι ζωντανή (ADR-905): άλλη καρτέλα
 *    ή άλλος άνθρωπος μπορεί να άλλαξε το πεδίο στο μεταξύ. Πεδίο που **δεν** είναι πια όπως το άφησε το βήμα παρακάμπτεται και
 *    μετριέται — δεν πατιέται ποτέ ξένη απόφαση. Πρόταση που εγκρίθηκε ή απορρίφθηκε ⇒ τίποτα να αναιρεθεί.
 * 🔑 **Η απόφαση μετά από διόρθωση τη δίνει ο διακομιστής** (`withEditDecisions`), άρα η πλευρά `after` μιας διόρθωσης **δεν**
 *    δηλώνει απόφαση (`decision` απόν) — ούτε την ελέγχει ούτε τη στέλνει.
 */

import { decisionSourceOf } from '@/subapps/catalog/import/field-diff';
import { editsByAddress, fieldAddress } from '@/subapps/catalog/import/human-edits';
import { importTargetKey } from '@/subapps/catalog/import/proposal-values';
import type { ImportProposalField, ImportTarget } from '@/subapps/catalog/types/catalog-import';
import type { ImportFieldDecisionInput, ImportFieldEditInput, ImportProposalWire } from '@/subapps/catalog/types/catalog-import-requests';
import type { HumanFieldDecision } from '@/subapps/catalog/vocabulary/catalog-import';
import type { ProposalChange } from './proposal-change-queue';

/** Η κατάσταση ενός πεδίου σε μία πλευρά του βήματος. Απόν μέρος = «δεν το αφορά αυτό το βήμα». */
export interface FieldMark {
  readonly rowKey: string;
  readonly targetKey: string;
  readonly decision?: HumanFieldDecision;
  /** Κείμενο διόρθωσης · `null` = καμία διόρθωση (τιμή της πηγής). */
  readonly edit?: string | null;
}

/** Τι έκανε ο άνθρωπος — για το όνομα του βήματος («Αναίρεση: Αποδοχή «Κωδικός»», λίστα αναίρεσης του Revit). */
export type ReviewStepKind = 'accept' | 'reject' | 'undoDecision' | 'edit' | 'revertEdit' | 'acceptRow';

export interface ReviewStepLabel {
  readonly kind: ReviewStepKind;
  /** Ο στόχος του πρώτου πεδίου — ο καταναλωτής τον ονομάζει με τον ίδιο ονοματοδότη με τη λίστα. */
  readonly target: ImportTarget;
  readonly count: number;
}

/**
 * **Ομαδική πράξη** = πάνω από ένα πεδίο με μία κίνηση (§5.5.2 Β9γ). Μόνο αυτή παίρνει toast «Αναίρεση» (Gmail): η πράξη σε ΕΝΑ
 * πεδίο φαίνεται ήδη στη θέση της και αναιρείται εκεί (↺) — toast σε κάθε κλικ θα ήταν θόρυβος.
 */
export const isGroupStep = (label: ReviewStepLabel): boolean => label.count > 1;

/** Μία πλευρά του βήματος: η πρόταση, τα πεδία της, και το όνομα της ενέργειας (ίδιο και στις δύο πλευρές). */
export interface ReviewStep {
  readonly proposalId: string;
  readonly label: ReviewStepLabel;
  readonly marks: readonly FieldMark[];
}

interface FieldAt {
  readonly field: ImportProposalField;
  readonly edit: string | null;
}

function fieldsOf(proposal: ImportProposalWire): ReadonlyMap<string, FieldAt> {
  const edits = editsByAddress(proposal.edits);
  const entries = proposal.rows.flatMap((row) => row.fields.map((field) => {
    const address = fieldAddress(row.rowKey, importTargetKey(field.target));
    return [address, { field, edit: edits.get(address)?.text ?? null }] as const;
  }));
  return new Map(entries);
}

/** Η απόφαση ενός πεδίου όπως τη ζητά ο άνθρωπος: δική του ⇒ η τιμή της, του κανόνα ⇒ `null`. */
const humanDecisionOf = (field: ImportProposalField): HumanFieldDecision =>
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

const addressOf = (input: { readonly rowKey: string; readonly targetKey: string }): string => fieldAddress(input.rowKey, input.targetKey);

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

/**
 * Το βήμα μιας αλλαγής πάνω στην πρόταση όπως τη βλέπει **τώρα** ο άνθρωπος. `null` ⇒ τίποτα να θυμηθεί (π.χ. μόνο κωδικός
 * μοντέλου, ή πεδία που δεν υπάρχουν). Η πλευρά `before` κρατά απόφαση **και** διόρθωση για κάθε πεδίο που αγγίζεται.
 */
export function reviewStepOf(proposal: ImportProposalWire, change: ProposalChange): { readonly before: ReviewStep; readonly after: ReviewStep } | null {
  const fields = fieldsOf(proposal);
  const after = afterMarks(change.decisions ?? [], change.edits ?? []).filter((mark) => fields.has(addressOf(mark)));
  if (after.length === 0) return null;
  const label = labelOf(change, (fields.get(addressOf(after[0])) as FieldAt).field.target);
  if (!label) return null;
  const before = after.map((mark): FieldMark => {
    const at = fields.get(addressOf(mark)) as FieldAt;
    return { rowKey: mark.rowKey, targetKey: mark.targetKey, decision: humanDecisionOf(at.field), ...(mark.edit !== undefined ? { edit: at.edit } : {}) };
  });
  return { before: { proposalId: proposal.id, label, marks: before }, after: { proposalId: proposal.id, label, marks: after } };
}

/** Τι θα σταλεί για να πάει η πρόταση από τη μία πλευρά στην άλλη, και πόσα πεδία παρακάμφθηκαν γιατί τα άλλαξε κάποιος άλλος. */
export interface ReviewStepPlan {
  readonly proposal: ImportProposalWire | null;
  readonly change: ProposalChange | null;
  readonly skipped: number;
}

/**
 * Από την πλευρά `from` στην πλευρά `to`: μόνο τα πεδία που είναι **ακόμη** όπως τα λέει το `from`. Πρόταση που δεν εκκρεμεί
 * πια (εγκρίθηκε · απορρίφθηκε · χάθηκε) ⇒ όλα παρακάμπτονται.
 */
export function planReviewStep(proposals: readonly ImportProposalWire[], from: ReviewStep, to: ReviewStep): ReviewStepPlan {
  const proposal = proposals.find((item) => item.id === to.proposalId) ?? null;
  if (!proposal || proposal.status !== 'pending') return { proposal, change: null, skipped: to.marks.length };
  const fields = fieldsOf(proposal);
  const ours = new Set(from.marks.filter((mark) => holds(fields.get(addressOf(mark)), mark)).map(addressOf));
  const marks = to.marks.filter((mark) => ours.has(addressOf(mark)));
  const skipped = to.marks.length - marks.length;
  if (marks.length === 0) return { proposal, change: null, skipped };
  const decisions = marks.flatMap((mark): ImportFieldDecisionInput[] =>
    mark.decision === undefined ? [] : [{ rowKey: mark.rowKey, targetKey: mark.targetKey, decision: mark.decision }]);
  const edits = marks.flatMap((mark): ImportFieldEditInput[] => {
    if (mark.edit === undefined) return [];
    return [mark.edit === null ? { rowKey: mark.rowKey, targetKey: mark.targetKey, text: '', revert: true } : { rowKey: mark.rowKey, targetKey: mark.targetKey, text: mark.edit }];
  });
  return { proposal, change: { decisions, edits }, skipped };
}
