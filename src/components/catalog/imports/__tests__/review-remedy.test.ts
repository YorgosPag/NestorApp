/**
 * **Το μοντέλο λύσης του πλαισίου** (ADR-923 §5.5.2 Β8 βήμα Β) — κάθε αιτία → οι σωστές ενέργειες, με δικαιώματα και κρίση
 * αποφασισιμότητας. Καθαρό: καμία οθόνη, κανένα δίκτυο.
 */
import type { ImportIssue, ImportProposalField } from '@/subapps/catalog/types/catalog-import';
import { ANY_SLOT } from '@/subapps/catalog/types/product';
import type { LineState } from '../import-text';
import type { ReviewBoxTarget, ReviewReason } from '../review-overlay-model';
import { keepValuesOf, lineActionsOf, remedyOf, type RemedyContext } from '../review-remedy';

const REPEATED: ImportIssue = { code: 'attributeRepeated', path: 'rows.0', params: { others: '099-03-001' } };

const field = (overrides: Partial<ImportProposalField> = {}): ImportProposalField => ({
  target: { kind: 'attribute', attributeId: 'cattr_code', channel: ANY_SLOT, locale: ANY_SLOT },
  sourceText: 'MFP-34K1M-Q1AA1',
  incoming: { type: 'text', text: 'MFP-34K1M-Q1AA1' },
  live: null,
  base: null,
  status: 'new',
  confidence: 0.9,
  anchor: null,
  issues: [],
  decision: null,
  ...overrides,
});

const fieldEntry = (subject: ImportProposalField, reason: ReviewReason | null = null): ReviewBoxTarget => ({
  target: { kind: 'field', proposalId: 'p', rowKey: 'r', targetKey: 'k' }, key: 'f', tone: reason ? 'problem' : 'pending', reason,
  subject: { kind: 'field', field: subject }, printed: subject.sourceText,
});

const lineEntry = (state: LineState, reason: ReviewReason | null = null): ReviewBoxTarget => ({
  target: { kind: 'line', lineKey: 'l' }, key: 'l', tone: 'unmapped', reason, subject: { kind: 'line', label: 'ΕΝΑΛΛΑΚΤΗΣ', state }, printed: 'A · B',
});

const ALL: RemedyContext = { decidable: true, canManage: true, canPrice: true, hasPriceTarget: true };
const NONE: RemedyContext = { decidable: true, canManage: false, canPrice: false, hasPriceTarget: false };

describe('keepValuesOf', () => {
  it('η τυπωμένη πρώτη, μετά οι εναλλακτικές', () => {
    expect(keepValuesOf(field({ alternatives: [{ text: '099-03-001', anchor: null }] }))).toEqual(['MFP-34K1M-Q1AA1', '099-03-001']);
  });
  it('καμία εναλλακτική ⇒ καμία επιλογή (ούτε μόνη η τυπωμένη)', () => {
    expect(keepValuesOf(field())).toEqual([]);
    expect(keepValuesOf(field({ alternatives: [] }))).toEqual([]);
  });
});

describe('lineActionsOf — ο ένας κανόνας λίστας και popover', () => {
  it('όλα τα δικαιώματα ⇒ αντιστοίχιση · νέα · τιμή · αγνόηση, με αυτή τη σειρά', () => {
    expect(lineActionsOf({ canManage: true, pricesEnabled: true })).toEqual([
      { kind: 'lineTool', mode: 'map' }, { kind: 'lineTool', mode: 'new' }, { kind: 'lineTool', mode: 'price' }, { kind: 'ignoreLine' },
    ]);
  });
  it('χωρίς δικαιώματα ⇒ μόνο αντιστοίχιση και αγνόηση', () => {
    expect(lineActionsOf({ canManage: false, pricesEnabled: false })).toEqual([{ kind: 'lineTool', mode: 'map' }, { kind: 'ignoreLine' }]);
  });
});

describe('remedyOf — πεδίο', () => {
  const reason: ReviewReason = { kind: 'issue', issue: REPEATED };

  it('«η πηγή δίνει και άλλη τιμή» με εναλλακτικές ⇒ ένα «Κράτα» ανά τιμή', () => {
    const repeated = field({ issues: [REPEATED], alternatives: [{ text: '099-03-001', anchor: null }] });
    expect(remedyOf(fieldEntry(repeated, reason), ALL)).toEqual({
      why: reason,
      actions: [{ kind: 'keepValue', text: 'MFP-34K1M-Q1AA1' }, { kind: 'keepValue', text: '099-03-001' }],
    });
  });

  it('παλιά πρόταση χωρίς εναλλακτικές ⇒ «Διόρθωση», ποτέ σιωπηλό κενό', () => {
    expect(remedyOf(fieldEntry(field({ issues: [REPEATED] }), reason), ALL).actions).toEqual([{ kind: 'editField' }]);
  });

  it('το εύρημα μετρά ακόμη κι αν δεν είναι το πρώτο του πεδίου', () => {
    const other: ImportIssue = { code: 'attributeUnknown', path: 'rows.0' };
    expect(remedyOf(fieldEntry(field({ issues: [other, REPEATED] }), { kind: 'issue', issue: other }), ALL).actions).toEqual([{ kind: 'editField' }]);
  });

  it('άλλη αιτία (δεν διαβάστηκε · δεν επιβεβαιώθηκε) ⇒ μόνο το «γιατί»', () => {
    expect(remedyOf(fieldEntry(field(), { kind: 'unread' }), ALL)).toEqual({ why: { kind: 'unread' }, actions: [] });
  });

  it('μη αποφασίσιμη πρόταση ⇒ μόνο το «γιατί», κανένα κουμπί που θα αρνιόταν', () => {
    const repeated = field({ issues: [REPEATED], alternatives: [{ text: '099-03-001', anchor: null }] });
    expect(remedyOf(fieldEntry(repeated, reason), { ...ALL, decidable: false })).toEqual({ why: reason, actions: [] });
  });
});

describe('remedyOf — γραμμή', () => {
  it('χωρίς πεδίο ⇒ «γιατί: χωρίς πεδίο» + οι ενέργειες της λίστας', () => {
    expect(remedyOf(lineEntry('pending'), ALL)).toEqual({ why: { kind: 'unmapped' }, actions: lineActionsOf({ canManage: true, pricesEnabled: true }) });
  });

  it('τιμή μόνο με δικαίωμα τιμολόγησης ΚΑΙ τιμοκατάλογο', () => {
    const modes = (ctx: RemedyContext) => remedyOf(lineEntry('pending'), ctx).actions.map((action) => (action.kind === 'lineTool' ? action.mode : action.kind));
    expect(modes({ ...ALL, hasPriceTarget: false })).toEqual(['map', 'new', 'ignoreLine']);
    expect(modes({ ...ALL, canPrice: false })).toEqual(['map', 'new', 'ignoreLine']);
    expect(modes(NONE)).toEqual(['map', 'ignoreLine']);
  });

  it('άρνηση «λείπει τιμοκατάλογος» ⇒ «Διάλεξε τιμοκατάλογο» πρώτο', () => {
    const refused: ReviewReason = { kind: 'refused', refusal: 'priceTargetMissing' };
    const { why, actions } = remedyOf(lineEntry('refused', refused), { ...ALL, hasPriceTarget: false });
    expect(why).toEqual(refused);
    expect(actions[0]).toEqual({ kind: 'pickPriceTarget' });
  });

  it('«λείπει τιμοκατάλογος» χωρίς δικαίωμα τιμολόγησης ⇒ όχι κουμπί τιμοκαταλόγου (ξένο ≡ ανύπαρκτο)', () => {
    const refused: ReviewReason = { kind: 'refused', refusal: 'priceTargetMissing' };
    expect(remedyOf(lineEntry('refused', refused), NONE).actions).not.toContainEqual({ kind: 'pickPriceTarget' });
  });

  it('σε αποθήκευση · αντιστοιχισμένη · αγνοημένη ⇒ καμία ενέργεια', () => {
    for (const state of ['saving', 'mapped', 'ignored'] as const) expect(remedyOf(lineEntry(state), ALL).actions).toEqual([]);
  });

  it('μη αποφασίσιμη ⇒ μόνο το «γιατί»', () => {
    expect(remedyOf(lineEntry('pending'), { ...ALL, decidable: false })).toEqual({ why: { kind: 'unmapped' }, actions: [] });
  });
});
