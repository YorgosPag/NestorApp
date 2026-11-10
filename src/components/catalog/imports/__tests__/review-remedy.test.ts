/**
 * **Το μοντέλο λύσης του πλαισίου** (ADR-923 §5.5.2 Β8 βήματα Β + Γ) — κάθε αιτία → οι σωστές ενέργειες, με δικαιώματα και κρίση
 * αποφασισιμότητας· το «Κράτα» κρατά την άγκυρα της τιμής του (φάντασμα) · η «Τιμή» ζητά πρώτα τιμοκατάλογο αντί να κρύβεται.
 * Καθαρό: καμία οθόνη, κανένα δίκτυο.
 */
import type { ImportIssue, ImportProposalField, SourceAnchor } from '@/subapps/catalog/types/catalog-import';
import { ANY_SLOT } from '@/subapps/catalog/types/product';
import type { LineState } from '../import-text';
import type { ReviewBoxTarget, ReviewReason } from '../review-overlay-model';
import { keepValuesOf, lineActionsOf, remedyOf, type RemedyContext } from '../review-remedy';

const FIELD_ANCHOR: SourceAnchor = { kind: 'page', page: 87, regions: [{ x: 0.2, y: 0.4, width: 0.1, height: 0.02 }], verified: true };
const OTHER_ANCHOR: SourceAnchor = { kind: 'page', page: 87, regions: [{ x: 0.2, y: 0.6, width: 0.1, height: 0.02 }], verified: true };

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
  it('η τυπωμένη πρώτη (με την άγκυρα του πεδίου), μετά οι εναλλακτικές (με τη δική τους)', () => {
    expect(keepValuesOf(field({ anchor: FIELD_ANCHOR, alternatives: [{ text: '099-03-001', anchor: OTHER_ANCHOR }] }))).toEqual([
      { text: 'MFP-34K1M-Q1AA1', anchor: FIELD_ANCHOR }, { text: '099-03-001', anchor: OTHER_ANCHOR },
    ]);
  });
  it('καμία εναλλακτική ⇒ καμία επιλογή (ούτε μόνη η τυπωμένη)', () => {
    expect(keepValuesOf(field())).toEqual([]);
    expect(keepValuesOf(field({ alternatives: [] }))).toEqual([]);
  });
});

describe('lineActionsOf — ο ένας κανόνας λίστας και popover', () => {
  it('όλα τα δικαιώματα ⇒ αντιστοίχιση · νέα · τιμή · αγνόηση, με αυτή τη σειρά', () => {
    expect(lineActionsOf({ canManage: true, canPrice: true, hasPriceTarget: true })).toEqual([
      { kind: 'lineTool', mode: 'map' }, { kind: 'lineTool', mode: 'new' }, { kind: 'lineTool', mode: 'price' }, { kind: 'ignoreLine' },
    ]);
  });
  it('δικαίωμα τιμολόγησης χωρίς τιμοκατάλογο ⇒ στην ΙΔΙΑ θέση «διάλεξε πρώτα τιμοκατάλογο», ποτέ κρυμμένη', () => {
    expect(lineActionsOf({ canManage: true, canPrice: true, hasPriceTarget: false })).toEqual([
      { kind: 'lineTool', mode: 'map' }, { kind: 'lineTool', mode: 'new' }, { kind: 'pickPriceTarget' }, { kind: 'ignoreLine' },
    ]);
  });
  it('χωρίς δικαιώματα ⇒ μόνο αντιστοίχιση και αγνόηση (ξένο ≡ ανύπαρκτο, και με τιμοκατάλογο)', () => {
    expect(lineActionsOf({ canManage: false, canPrice: false, hasPriceTarget: true })).toEqual([{ kind: 'lineTool', mode: 'map' }, { kind: 'ignoreLine' }]);
  });
});

describe('remedyOf — πεδίο', () => {
  const reason: ReviewReason = { kind: 'issue', issue: REPEATED };

  it('«η πηγή δίνει και άλλη τιμή» με εναλλακτικές ⇒ ένα «Κράτα» ανά τιμή, με την άγκυρά της', () => {
    const repeated = field({ issues: [REPEATED], anchor: FIELD_ANCHOR, alternatives: [{ text: '099-03-001', anchor: OTHER_ANCHOR }] });
    expect(remedyOf(fieldEntry(repeated, reason), ALL)).toEqual({
      why: reason,
      actions: [{ kind: 'keepValue', text: 'MFP-34K1M-Q1AA1', anchor: FIELD_ANCHOR }, { kind: 'keepValue', text: '099-03-001', anchor: OTHER_ANCHOR }],
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
    expect(remedyOf(lineEntry('pending'), ALL)).toEqual({ why: { kind: 'unmapped' }, actions: lineActionsOf(ALL) });
  });

  it('η θέση «Τιμή»: διάλογος με τιμοκατάλογο · «διάλεξε πρώτα» χωρίς · τίποτα χωρίς δικαίωμα', () => {
    const modes = (ctx: RemedyContext) => remedyOf(lineEntry('pending'), ctx).actions.map((action) => (action.kind === 'lineTool' ? action.mode : action.kind));
    expect(modes(ALL)).toEqual(['map', 'new', 'price', 'ignoreLine']);
    expect(modes({ ...ALL, hasPriceTarget: false })).toEqual(['map', 'new', 'pickPriceTarget', 'ignoreLine']);
    expect(modes({ ...ALL, canPrice: false })).toEqual(['map', 'new', 'ignoreLine']);
    expect(modes(NONE)).toEqual(['map', 'ignoreLine']);
  });

  it('άρνηση «λείπει τιμοκατάλογος» ⇒ το ΙΔΙΟ «διάλεξε πρώτα», μία φορά (όχι δεύτερο κουμπί)', () => {
    const refused: ReviewReason = { kind: 'refused', refusal: 'priceTargetMissing' };
    const { why, actions } = remedyOf(lineEntry('refused', refused), { ...ALL, hasPriceTarget: false });
    expect(why).toEqual(refused);
    expect(actions.filter((action) => action.kind === 'pickPriceTarget')).toHaveLength(1);
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
