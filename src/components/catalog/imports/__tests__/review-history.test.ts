/**
 * **Η στοίβα αναίρεσης της οθόνης ελέγχου** (ADR-923 §5.5.2 Β9β): το βήμα είναι κατάσταση, η αναίρεση στέλνει την πλευρά
 * `before` από την ίδια πόρτα, και **ποτέ** δεν πατά πεδίο που άλλαξε κάποιος άλλος στο μεταξύ.
 */
import { importTargetKey } from '@/subapps/catalog/import/proposal-values';
import type { ImportProposalField } from '@/subapps/catalog/types/catalog-import';
import type { ImportProposalWire } from '@/subapps/catalog/types/catalog-import-requests';
import { ANY_SLOT } from '@/subapps/catalog/types/product';
import { planReviewStep, reviewStepOf } from '../review-history';

jest.mock('@/services/catalog/catalog-import-api.client', () => ({}));

const target = (attributeId: string) => ({ kind: 'attribute', attributeId, channel: ANY_SLOT, locale: ANY_SLOT } as const);
const keyOf = (attributeId: string) => importTargetKey(target(attributeId));

const field = (attributeId: string, overrides: Partial<ImportProposalField> = {}): ImportProposalField => ({
  target: target(attributeId), sourceText: '1 W', incoming: { type: 'measurement', amount: '1', unitCode: 'W' }, live: null, base: null,
  status: 'new', confidence: 1, anchor: null, issues: [], decision: 'pending', decisionBy: 'rule', ...overrides,
});

const proposal = (fields: readonly ImportProposalField[], extra: Record<string, unknown> = {}): ImportProposalWire => ({
  rows: [{ rowKey: 'r0', holderKind: 'product', holderId: null, expectedRevision: null, action: 'create', label: 'A', fields, issues: [] }],
  id: 'p1', revision: 1, status: 'pending', edits: [], ...extra,
} as unknown as ImportProposalWire);

const decide = (attributeId: string, decision: 'accept' | 'reject' | null) => ({ decisions: [{ rowKey: 'r0', targetKey: keyOf(attributeId), decision }] });

describe('reviewStepOf — η καταγραφή', () => {
  it('απόφαση πάνω σε πεδίο του κανόνα: πριν = κανόνας (`null`), μετά = η απόφαση, με όνομα', () => {
    const step = reviewStepOf(proposal([field('a')]), decide('a', 'accept'));
    expect(step?.before.marks).toEqual([{ rowKey: 'r0', targetKey: keyOf('a'), decision: null }]);
    expect(step?.after.marks).toEqual([{ rowKey: 'r0', targetKey: keyOf('a'), decision: 'accept' }]);
    expect(step?.after.label).toMatchObject({ kind: 'accept', count: 1 });
  });

  it('η «Αποδοχή γραμμής» είναι ΕΝΑ βήμα για όλα τα πεδία', () => {
    const step = reviewStepOf(proposal([field('a'), field('b', { decision: 'reject', decisionBy: 'human' })]), {
      decisions: [{ rowKey: 'r0', targetKey: keyOf('a'), decision: 'accept' }, { rowKey: 'r0', targetKey: keyOf('b'), decision: 'accept' }],
    });
    expect(step?.after.label).toMatchObject({ kind: 'acceptRow', count: 2 });
    expect(step?.before.marks.map((mark) => mark.decision)).toEqual([null, 'reject']);
  });

  it('η διόρθωση θυμάται το προηγούμενο κείμενο ΚΑΙ την απόφαση· μετά δεν δηλώνει απόφαση (τη δίνει ο διακομιστής)', () => {
    const value = proposal([field('a', { decision: 'reject', decisionBy: 'human' })], { edits: [{ rowKey: 'r0', targetKey: keyOf('a'), text: '5', sourceText: '1' }] });
    const step = reviewStepOf(value, { edits: [{ rowKey: 'r0', targetKey: keyOf('a'), text: '7' }] });
    expect(step?.before.marks).toEqual([{ rowKey: 'r0', targetKey: keyOf('a'), decision: 'reject', edit: '5' }]);
    expect(step?.after.marks).toEqual([{ rowKey: 'r0', targetKey: keyOf('a'), edit: '7' }]);
    expect(step?.after.label.kind).toBe('edit');
  });

  it('μόνο κωδικός μοντέλου ή άγνωστο πεδίο ⇒ τίποτα να θυμηθεί', () => {
    expect(reviewStepOf(proposal([field('a')]), { modelCode: 'X' })).toBeNull();
    expect(reviewStepOf(proposal([field('a')]), decide('zz', 'accept'))).toBeNull();
  });
});

describe('planReviewStep — αναίρεση και επανάληψη', () => {
  const step = reviewStepOf(proposal([field('a')]), decide('a', 'accept'));
  if (!step) throw new Error('step');

  it('αναίρεση: το πεδίο είναι ακόμη όπως το άφησες ⇒ στέλνεται η πλευρά «πριν» (επιστροφή στον κανόνα)', () => {
    const now = proposal([field('a', { decision: 'accept', decisionBy: 'human' })]);
    const plan = planReviewStep([now], step.after, step.before);
    expect(plan.change).toEqual({ decisions: [{ rowKey: 'r0', targetKey: keyOf('a'), decision: null }], edits: [] });
    expect(plan.skipped).toBe(0);
  });

  it('επανάληψη: από το «πριν» στο «μετά»', () => {
    const plan = planReviewStep([proposal([field('a')])], step.before, step.after);
    expect(plan.change?.decisions).toEqual([{ rowKey: 'r0', targetKey: keyOf('a'), decision: 'accept' }]);
  });

  it('🔑 άλλος άλλαξε το πεδίο στο μεταξύ ⇒ ΔΕΝ πατιέται, μετριέται', () => {
    const now = proposal([field('a', { decision: 'reject', decisionBy: 'human' })]);
    const plan = planReviewStep([now], step.after, step.before);
    expect(plan.change).toBeNull();
    expect(plan.skipped).toBe(1);
  });

  it('πρόταση που δεν εκκρεμεί πια (εγκρίθηκε) ή χάθηκε ⇒ τίποτα να σταλεί', () => {
    const applied = proposal([field('a', { decision: 'accept', decisionBy: 'human' })], { status: 'applied' });
    expect(planReviewStep([applied], step.after, step.before)).toMatchObject({ change: null, skipped: 1 });
    expect(planReviewStep([], step.after, step.before)).toMatchObject({ proposal: null, change: null, skipped: 1 });
  });

  it('ομαδική πράξη: αναιρούνται μόνο τα πεδία που είναι ακόμη δικά σου', () => {
    const row = reviewStepOf(proposal([field('a'), field('b')]), {
      decisions: [{ rowKey: 'r0', targetKey: keyOf('a'), decision: 'accept' }, { rowKey: 'r0', targetKey: keyOf('b'), decision: 'accept' }],
    });
    if (!row) throw new Error('row');
    const now = proposal([field('a', { decision: 'accept', decisionBy: 'human' }), field('b', { decision: 'reject', decisionBy: 'human' })]);
    const plan = planReviewStep([now], row.after, row.before);
    expect(plan.change?.decisions).toEqual([{ rowKey: 'r0', targetKey: keyOf('a'), decision: null }]);
    expect(plan.skipped).toBe(1);
  });

  it('αναίρεση διόρθωσης: επιστρέφει κείμενο και απόφαση· διόρθωση που δεν υπήρχε ⇒ `revert`', () => {
    const edit = reviewStepOf(proposal([field('a')]), { edits: [{ rowKey: 'r0', targetKey: keyOf('a'), text: '7' }] });
    if (!edit) throw new Error('edit');
    const now = proposal([field('a', { decision: 'accept', decisionBy: 'human' })], { edits: [{ rowKey: 'r0', targetKey: keyOf('a'), text: '7', sourceText: '1' }] });
    const plan = planReviewStep([now], edit.after, edit.before);
    expect(plan.change).toEqual({
      decisions: [{ rowKey: 'r0', targetKey: keyOf('a'), decision: null }],
      edits: [{ rowKey: 'r0', targetKey: keyOf('a'), text: '', revert: true }],
    });
  });
});
