/**
 * **Η στοίβα αναίρεσης της οθόνης ελέγχου** (ADR-923 §5.5.2 Β9β · Β9δ): το βήμα είναι κατάσταση, η αναίρεση στέλνει την πλευρά
 * `before` από την ίδια πόρτα, και **ποτέ** δεν πατά πεδίο που άλλαξε κάποιος άλλος στο μεταξύ.
 */
import { importTargetKey } from '@/subapps/catalog/import/proposal-values';
import type { ImportProposalField } from '@/subapps/catalog/types/catalog-import';
import type { ImportBatchDetailView, ImportProposalWire } from '@/subapps/catalog/types/catalog-import-requests';
import { ANY_SLOT } from '@/subapps/catalog/types/product';
import { isGroupStep, reviewStepOf, type FieldsStep, type ReviewStep, type ReviewStepPlan, type StepPair } from '../review-history';
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
  id: 'p1', revision: 1, status: 'pending', edits: [], extracted: { modelCode: 'SRC' }, ...extra,
} as unknown as ImportProposalWire);

const view = (proposals: readonly ImportProposalWire[]): ImportBatchDetailView =>
  ({ batch: { id: 'b1', pages: { lineOverrides: [] } }, proposals } as unknown as ImportBatchDetailView);

const decide = (attributeId: string, decision: 'accept' | 'reject' | null) => ({ decisions: [{ rowKey: 'r0', targetKey: keyOf(attributeId), decision }] });

/** Το βήμα πεδίων — αποτυγχάνει δυνατά αν βγήκε άλλο είδος. */
function fieldsStep(step: StepPair | null): StepPair<FieldsStep> {
  if (!step || step.before.kind !== 'fields' || step.after.kind !== 'fields') throw new Error('fields step');
  return { before: step.before, after: step.after };
}

const plan = (proposals: readonly ImportProposalWire[], from: ReviewStep, to: ReviewStep): ReviewStepPlan => planReviewStep(view(proposals), from, to);
const changeOf = (value: ReviewStepPlan) => (value.send?.door === 'change' ? value.send.change : null);

describe('reviewStepOf — η καταγραφή', () => {
  it('απόφαση πάνω σε πεδίο του κανόνα: πριν = κανόνας (`null`), μετά = η απόφαση, με όνομα', () => {
    const step = fieldsStep(reviewStepOf(proposal([field('a')]), decide('a', 'accept')));
    expect(step.before.marks).toEqual([{ rowKey: 'r0', targetKey: keyOf('a'), decision: null }]);
    expect(step.after.marks).toEqual([{ rowKey: 'r0', targetKey: keyOf('a'), decision: 'accept' }]);
    expect(step.after.label).toMatchObject({ kind: 'accept', count: 1 });
  });

  it('η «Αποδοχή γραμμής» είναι ΕΝΑ βήμα για όλα τα πεδία', () => {
    const step = fieldsStep(reviewStepOf(proposal([field('a'), field('b', { decision: 'reject', decisionBy: 'human' })]), {
      decisions: [{ rowKey: 'r0', targetKey: keyOf('a'), decision: 'accept' }, { rowKey: 'r0', targetKey: keyOf('b'), decision: 'accept' }],
    }));
    expect(step.after.label).toMatchObject({ kind: 'acceptRow', count: 2 });
    expect(step.before.marks.map((mark) => mark.decision)).toEqual([null, 'reject']);
  });

  it('η διόρθωση θυμάται το προηγούμενο κείμενο ΚΑΙ την απόφαση· μετά δεν δηλώνει απόφαση (τη δίνει ο διακομιστής)', () => {
    const value = proposal([field('a', { decision: 'reject', decisionBy: 'human' })], { edits: [{ rowKey: 'r0', targetKey: keyOf('a'), text: '5', sourceText: '1' }] });
    const step = fieldsStep(reviewStepOf(value, { edits: [{ rowKey: 'r0', targetKey: keyOf('a'), text: '7' }] }));
    expect(step.before.marks).toEqual([{ rowKey: 'r0', targetKey: keyOf('a'), decision: 'reject', edit: '5' }]);
    expect(step.after.marks).toEqual([{ rowKey: 'r0', targetKey: keyOf('a'), edit: '7' }]);
    expect(step.after.label.kind).toBe('edit');
  });

  it('άγνωστο πεδίο ⇒ τίποτα να θυμηθεί', () => {
    expect(reviewStepOf(proposal([field('a')]), decide('zz', 'accept'))).toBeNull();
  });
});

describe('reviewStepOf — κωδικός μοντέλου (Β9δ)', () => {
  it('ορισμός κωδικού: πριν = της πηγής (`null`), μετά = ο κωδικός, κανονικοποιημένος όπως στον γραφέα', () => {
    const step = reviewStepOf(proposal([field('a')]), { modelCode: '  MFP-34K1M  ' });
    expect(step?.before).toMatchObject({ kind: 'modelCode', modelCode: null });
    expect(step?.after).toMatchObject({ kind: 'modelCode', modelCode: 'MFP-34K1M', label: { kind: 'modelCode', code: 'MFP-34K1M' } });
  });

  it('επαναφορά στην πηγή (`\'\'`): πριν = ο κωδικός του ανθρώπου, μετά = `null`', () => {
    const own = proposal([field('a')], { modelCodeEdit: { modelCode: 'X1', sourceModelCode: 'SRC', by: 'u', at: 't' } });
    const step = reviewStepOf(own, { modelCode: '' });
    expect(step?.before).toMatchObject({ kind: 'modelCode', modelCode: 'X1' });
    expect(step?.after).toMatchObject({ kind: 'modelCode', modelCode: null, label: { kind: 'removeModelCode', code: 'X1' } });
  });

  it('🔑 ίδιος με την πηγή ή ίδιος με τον τρέχοντα ⇒ καμία αλλαγή, κανένα βήμα (ο ΙΔΙΟΣ κανόνας με τον γραφέα)', () => {
    expect(reviewStepOf(proposal([field('a')]), { modelCode: 'SRC' })).toBeNull();
    expect(reviewStepOf(proposal([field('a')]), { modelCode: '' })).toBeNull();
  });

  it('αναίρεση: ο κωδικός είναι ακόμη όπως τον άφησες ⇒ `\'\'` (επιστροφή στην πηγή)· άλλαξε ⇒ μετριέται', () => {
    const step = reviewStepOf(proposal([field('a')]), { modelCode: 'X1' });
    if (!step) throw new Error('step');
    const ours = proposal([field('a')], { modelCodeEdit: { modelCode: 'X1', sourceModelCode: 'SRC', by: 'u', at: 't' } });
    expect(changeOf(plan([ours], step.after, step.before))).toEqual({ modelCode: '' });
    const theirs = proposal([field('a')], { modelCodeEdit: { modelCode: 'Y9', sourceModelCode: 'SRC', by: 'u', at: 't' } });
    expect(plan([theirs], step.after, step.before)).toEqual({ send: null, skipped: 1 });
  });
});

describe('planReviewStep — αναίρεση και επανάληψη πεδίων', () => {
  const step = fieldsStep(reviewStepOf(proposal([field('a')]), decide('a', 'accept')));

  it('αναίρεση: το πεδίο είναι ακόμη όπως το άφησες ⇒ στέλνεται η πλευρά «πριν» (επιστροφή στον κανόνα)', () => {
    const now = proposal([field('a', { decision: 'accept', decisionBy: 'human' })]);
    const result = plan([now], step.after, step.before);
    expect(changeOf(result)).toEqual({ decisions: [{ rowKey: 'r0', targetKey: keyOf('a'), decision: null }], edits: [] });
    expect(result.skipped).toBe(0);
  });

  it('επανάληψη: από το «πριν» στο «μετά»', () => {
    expect(changeOf(plan([proposal([field('a')])], step.before, step.after))?.decisions).toEqual([{ rowKey: 'r0', targetKey: keyOf('a'), decision: 'accept' }]);
  });

  it('🔑 άλλος άλλαξε το πεδίο στο μεταξύ ⇒ ΔΕΝ πατιέται, μετριέται', () => {
    const now = proposal([field('a', { decision: 'reject', decisionBy: 'human' })]);
    expect(plan([now], step.after, step.before)).toEqual({ send: null, skipped: 1 });
  });

  it('πρόταση που δεν εκκρεμεί πια (εγκρίθηκε) ή χάθηκε ⇒ τίποτα να σταλεί', () => {
    const applied = proposal([field('a', { decision: 'accept', decisionBy: 'human' })], { status: 'applied' });
    expect(plan([applied], step.after, step.before)).toEqual({ send: null, skipped: 1 });
    expect(plan([], step.after, step.before)).toEqual({ send: null, skipped: 1 });
  });

  it('ομαδική πράξη: αναιρούνται μόνο τα πεδία που είναι ακόμη δικά σου', () => {
    const row = fieldsStep(reviewStepOf(proposal([field('a'), field('b')]), {
      decisions: [{ rowKey: 'r0', targetKey: keyOf('a'), decision: 'accept' }, { rowKey: 'r0', targetKey: keyOf('b'), decision: 'accept' }],
    }));
    const now = proposal([field('a', { decision: 'accept', decisionBy: 'human' }), field('b', { decision: 'reject', decisionBy: 'human' })]);
    const result = plan([now], row.after, row.before);
    expect(changeOf(result)?.decisions).toEqual([{ rowKey: 'r0', targetKey: keyOf('a'), decision: null }]);
    expect(result.skipped).toBe(1);
  });

  it('αναίρεση διόρθωσης: επιστρέφει κείμενο και απόφαση· διόρθωση που δεν υπήρχε ⇒ `revert`', () => {
    const edit = fieldsStep(reviewStepOf(proposal([field('a')]), { edits: [{ rowKey: 'r0', targetKey: keyOf('a'), text: '7' }] }));
    const now = proposal([field('a', { decision: 'accept', decisionBy: 'human' })], { edits: [{ rowKey: 'r0', targetKey: keyOf('a'), text: '7', sourceText: '1' }] });
    expect(changeOf(plan([now], edit.after, edit.before))).toEqual({
      decisions: [{ rowKey: 'r0', targetKey: keyOf('a'), decision: null }],
      edits: [{ rowKey: 'r0', targetKey: keyOf('a'), text: '', revert: true }],
    });
  });
});

describe('isGroupStep — ποια πράξη παίρνει toast «Αναίρεση» (Β9γ)', () => {
  it('ομαδική (πάνω από ένα πεδίο, π.χ. «Αποδοχή γραμμής») ⇒ ναι · ένα πεδίο ⇒ όχι (αναιρείται στη θέση του)', () => {
    const row = reviewStepOf(proposal([field('a'), field('b')]), {
      decisions: [{ rowKey: 'r0', targetKey: keyOf('a'), decision: 'accept' }, { rowKey: 'r0', targetKey: keyOf('b'), decision: 'accept' }],
    });
    const single = reviewStepOf(proposal([field('a')]), decide('a', 'accept'));
    expect(row && isGroupStep(row.after.label)).toBe(true);
    expect(single && isGroupStep(single.after.label)).toBe(false);
  });
});
