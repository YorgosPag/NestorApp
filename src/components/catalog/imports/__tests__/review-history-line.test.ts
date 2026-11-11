/**
 * **Η απόφαση γραμμής μέσα στη στοίβα αναίρεσης** (ADR-923 §5.5.2 Β9δ): καταγραφή τη στιγμή της πράξης, εμπλουτισμός με ό,τι
 * έγινε, επαναφορά από την ίδια πόρτα — και ποτέ πάνω σε γραμμή που άλλαξε κάποιος άλλος. Α (το δέσιμο μένει) · Β (επιστροφή στη
 * μνήμη χωρίς δήλωση προέλευσης) · Δ (οι αποφάσεις πεδίων που έσβησε η ξαναερμηνεία επιστρέφουν μετά).
 */
import { importTargetKey } from '@/subapps/catalog/import/proposal-values';
import type { ImportLineOverride, ImportProposalField } from '@/subapps/catalog/types/catalog-import';
import type { ImportBatchDetailView, ImportProposalWire, SetImportLineRequest, SetImportLineResult } from '@/subapps/catalog/types/catalog-import-requests';
import { ANY_SLOT } from '@/subapps/catalog/types/product';
import type { LineStep, StepPair } from '../review-history';
import { lineStepOf, settledLineStep } from '../review-history-line';
import { planReviewStep } from '../review-history-plan';

jest.mock('@/services/catalog/catalog-import-api.client', () => ({}));

const target = (attributeId: string) => ({ kind: 'attribute', attributeId, channel: ANY_SLOT, locale: ANY_SLOT } as const);
const keyOf = (attributeId: string) => importTargetKey(target(attributeId));

const field = (attributeId: string, overrides: Partial<ImportProposalField> = {}): ImportProposalField => ({
  target: target(attributeId), sourceText: '1 W', incoming: { type: 'measurement', amount: '1', unitCode: 'W' }, live: null, base: null,
  status: 'new', confidence: 1, anchor: null, issues: [], decision: 'pending', decisionBy: 'rule', ...overrides,
});

const proposal = (fields: readonly ImportProposalField[], extra: Record<string, unknown> = {}): ImportProposalWire => ({
  rows: [{ rowKey: 'r0', holderKind: 'product', holderId: null, expectedRevision: null, action: 'create', label: 'A', fields, issues: [] }],
  id: 'p1', revision: 1, status: 'pending', edits: [], extracted: { modelCode: null }, ...extra,
} as unknown as ImportProposalWire);

const ADDRESS = { page: 3, table: 't0', line: 4 } as const;

const override = (decision: ImportLineOverride['decision'], extra: Partial<ImportLineOverride> = {}): ImportLineOverride =>
  ({ ...ADDRESS, decision, by: 'u', at: 't', ...extra });

const MEMORY = { kind: 'memory', memoryId: 'm1', count: 3, sourceBatchId: 'b0' } as const;

const view = (overrides: readonly ImportLineOverride[], proposals: readonly ImportProposalWire[] = [proposal([field('a')])]): ImportBatchDetailView => ({
  batch: { id: 'b1', pages: { lineOverrides: overrides, unmappedLines: [{ ...ADDRESS, label: 'ΠΑΡ.ΝΕΡΟΥ · m³/h', values: [] }] } },
  proposals,
} as unknown as ImportBatchDetailView);

const request = (decision: SetImportLineRequest['decision'], bind: SetImportLineRequest['bind'] = null): SetImportLineRequest => ({ ...ADDRESS, decision, bind });
const settled = (next: ImportBatchDetailView): SetImportLineResult => ({ view: next, outcome: { kind: 'settled' } });

function recorded(before: ImportBatchDetailView, asked: SetImportLineRequest, after: ImportBatchDetailView): StepPair<LineStep> {
  const step = lineStepOf(before, before.proposals[0], asked);
  if (!step) throw new Error('step');
  const done = settledLineStep(step, before, settled(after));
  if (!done) throw new Error('settled');
  return done;
}

const sendOf = (value: ReturnType<typeof planReviewStep>) => (value.send?.door === 'line' ? value.send : null);

describe('lineStepOf / settledLineStep — η καταγραφή', () => {
  it('ιδιότητα σε γραμμή χωρίς απόφαση: πριν = καμία, μετά = η ιδιότητα, με τη λέξη της γραμμής στο όνομα', () => {
    const step = recorded(view([]), request({ kind: 'attribute', attributeId: 'a' }), view([override({ kind: 'attribute', attributeId: 'a' })]));
    expect(step.before.line).toMatchObject({ decision: null, memory: false });
    expect(step.after.line).toMatchObject({ decision: { kind: 'attribute', attributeId: 'a' }, memory: false });
    expect(step.after.label).toMatchObject({ kind: 'lineAttribute', line: 'ΠΑΡ.ΝΕΡΟΥ · m³/h', bound: false });
  });

  it('άρνηση, αποτυχία μεταφοράς ή καμία αλλαγή ⇒ το βήμα φεύγει', () => {
    const before = view([]);
    const step = lineStepOf(before, before.proposals[0], request({ kind: 'ignore' }));
    if (!step) throw new Error('step');
    expect(settledLineStep(step, before, { view: before, outcome: { kind: 'refused', reason: 'proposalClosed' } })).toBeNull();
    expect(settledLineStep(step, before, null)).toBeNull();
    expect(settledLineStep(step, before, settled(before))).toBeNull();
    expect(lineStepOf(view([override({ kind: 'ignore' })]), before.proposals[0], request({ kind: 'ignore' }))).toBeNull();
  });

  it('Α: νέα ιδιότητα δεμένη στην οικογένεια ⇒ το όνομα το λέει, η επανάληψη ξαναστέλνει το `bind`, η αναίρεση όχι', () => {
    const step = recorded(view([]), request({ kind: 'attribute', attributeId: 'a' }, 'leaf'), view([override({ kind: 'attribute', attributeId: 'a' })]));
    expect(step.after.label).toMatchObject({ bound: true });
    const undo = sendOf(planReviewStep(view([override({ kind: 'attribute', attributeId: 'a' })]), step.after, step.before));
    expect(undo).toMatchObject({ request: { decision: null, bind: null }, bindKept: true });
    const redo = sendOf(planReviewStep(view([]), step.before, step.after));
    expect(redo).toMatchObject({ request: { decision: { kind: 'attribute', attributeId: 'a' }, bind: 'leaf' }, bindKept: false });
  });
});

describe('planReviewStep — αναίρεση απόφασης γραμμής', () => {
  it('🔑 Β: η γραμμή είχε απόφαση της μνήμης ⇒ η αναίρεση ζητά `fallback: \'memory\'`, ΧΩΡΙΣ να δηλώσει ποια ήταν', () => {
    const step = recorded(view([override({ kind: 'ignore' }, { origin: MEMORY })]), request({ kind: 'attribute', attributeId: 'a' }), view([override({ kind: 'attribute', attributeId: 'a' })]));
    expect(step.before.line).toMatchObject({ decision: { kind: 'ignore' }, memory: true });
    const undo = sendOf(planReviewStep(view([override({ kind: 'attribute', attributeId: 'a' })]), step.after, step.before));
    expect(undo?.request).toEqual({ ...ADDRESS, decision: null, bind: null, fallback: 'memory' });
  });

  it('🔑 άλλος άλλαξε τη γραμμή στο μεταξύ (ή της έβαλε απόφαση μνήμης) ⇒ ΔΕΝ πατιέται, μετριέται', () => {
    const step = recorded(view([]), request({ kind: 'ignore' }), view([override({ kind: 'ignore' })]));
    expect(planReviewStep(view([override({ kind: 'price', unitCode: 'pc' })]), step.after, step.before)).toEqual({ send: null, skipped: 1 });
    expect(planReviewStep(view([override({ kind: 'ignore' }, { origin: MEMORY })]), step.after, step.before)).toEqual({ send: null, skipped: 1 });
  });

  it('πρόταση του πίνακα που δεν εκκρεμεί πια ⇒ τίποτα να σταλεί', () => {
    const step = recorded(view([]), request({ kind: 'ignore' }), view([override({ kind: 'ignore' })]));
    const closed = view([override({ kind: 'ignore' })], [proposal([field('a')], { status: 'applied' })]);
    expect(planReviewStep(closed, step.after, step.before)).toEqual({ send: null, skipped: 1 });
  });

  it('🔑 Δ: αποφάσεις πεδίων που έσβησε η ξαναερμηνεία επιστρέφουν ΜΕΤΑ, με τον ίδιο έλεγχο («ήταν του κανόνα»)', () => {
    const before = view([], [proposal([field('a', { decision: 'reject', decisionBy: 'human' }), field('b', { decision: 'accept', decisionBy: 'human' })])]);
    // Η ξαναερμηνεία άλλαξε την τιμή του «a»: η απόφαση του ανθρώπου χάθηκε. Το «b» έμεινε ίδιο.
    const after = view([override({ kind: 'attribute', attributeId: 'a' })], [proposal([field('a'), field('b', { decision: 'accept', decisionBy: 'human' })])]);
    const step = recorded(before, request({ kind: 'attribute', attributeId: 'a' }), after);
    expect(step.before.restore).toEqual([{ proposalId: 'p1', marks: [{ rowKey: 'r0', targetKey: keyOf('a'), decision: 'reject' }] }]);
    const undo = sendOf(planReviewStep(after, step.after, step.before));
    expect(undo?.then).toEqual([{
      proposalId: 'p1',
      from: [{ rowKey: 'r0', targetKey: keyOf('a'), decision: null }],
      to: [{ rowKey: 'r0', targetKey: keyOf('a'), decision: 'reject' }],
    }]);
    // Η επανάληψη δεν ξαναγράφει συνέπειες: τις παράγει ξανά η ίδια η ξαναερμηνεία.
    expect(sendOf(planReviewStep(before, step.before, step.after))?.then).toEqual([]);
  });
});
