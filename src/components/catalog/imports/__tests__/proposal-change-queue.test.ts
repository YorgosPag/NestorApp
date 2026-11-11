/**
 * **Η επικάλυψη αποφάσεων** (ADR-923 §5.5.2 Α1 · Α5): ό,τι περιμένει στην ουρά ζωγραφίζεται πάνω από την απάντηση του διακομιστή,
 * με τον ίδιο κανόνα με τον γραφέα, και η προέλευση δηλώνεται.
 */
import { decisionSourceOf } from '@/subapps/catalog/import/field-diff';
import { importTargetKey } from '@/subapps/catalog/import/proposal-values';
import type { ImportProposalField } from '@/subapps/catalog/types/catalog-import';
import type { ImportBatchDetailView, ImportProposalWire } from '@/subapps/catalog/types/catalog-import-requests';
import { ANY_SLOT } from '@/subapps/catalog/types/product';
import { overlayDecisions, overlayView } from '../proposal-change-queue';

jest.mock('@/services/catalog/catalog-import-api.client', () => ({}));

const target = (attributeId: string) => ({ kind: 'attribute', attributeId, channel: ANY_SLOT, locale: ANY_SLOT } as const);

const field = (attributeId: string, overrides: Partial<ImportProposalField> = {}): ImportProposalField => ({
  target: target(attributeId), sourceText: '1 W', incoming: { type: 'measurement', amount: '1', unitCode: 'W' }, live: null, base: null,
  status: 'new', confidence: 1, anchor: null, issues: [], decision: 'accept', decisionBy: 'rule', ...overrides,
});

const proposal = (fields: readonly ImportProposalField[], id = 'p1'): ImportProposalWire => ({
  rows: [{ rowKey: 'r0', holderKind: 'product', holderId: null, expectedRevision: null, action: 'create', label: 'A', fields, issues: [] }],
  id, revision: 1,
} as unknown as ImportProposalWire);

const keyOf = (attributeId: string) => importTargetKey(target(attributeId));

describe('overlayDecisions', () => {
  it('η απόφαση της ουράς φαίνεται αμέσως, ως ανθρώπινη', () => {
    const next = overlayDecisions(proposal([field('a', { decision: 'pending' })]), [{ rowKey: 'r0', targetKey: keyOf('a'), decision: 'reject' }]);
    expect(next.rows[0].fields[0]).toMatchObject({ decision: 'reject', decisionBy: 'human' });
  });

  it('τιμή που δεν διαβάστηκε δεν γίνεται αποδεκτή, όπως και στον γραφέα', () => {
    const unread = field('a', { incoming: null, decision: 'pending' });
    const next = overlayDecisions(proposal([unread]), [{ rowKey: 'r0', targetKey: keyOf('a'), decision: 'accept' }]);
    expect(next.rows[0].fields[0]).toBe(unread);
  });

  it('η τελευταία απόφαση για το ίδιο πεδίο κερδίζει· τα άλλα πεδία μένουν ανέγγιχτα', () => {
    const other = field('b');
    const next = overlayDecisions(proposal([field('a'), other]), [
      { rowKey: 'r0', targetKey: keyOf('a'), decision: 'reject' },
      { rowKey: 'r0', targetKey: keyOf('a'), decision: 'accept' },
    ]);
    expect(next.rows[0].fields[0]).toMatchObject({ decision: 'accept', decisionBy: 'human' });
    expect(next.rows[0].fields[1]).toBe(other);
  });

  it('χωρίς αποφάσεις επιστρέφει την ίδια πρόταση', () => {
    const value = proposal([field('a')]);
    expect(overlayDecisions(value, [])).toBe(value);
  });
});

describe('overlayView', () => {
  it('μια επαναφόρτωση δεν σβήνει απόφαση που δεν έφτασε ακόμη στον διακομιστή', () => {
    const view = { proposals: [proposal([field('a')], 'p1'), proposal([field('a')], 'p2')] } as unknown as ImportBatchDetailView;
    const next = overlayView(view, new Map([['p2', [{ rowKey: 'r0', targetKey: keyOf('a'), decision: 'reject' as const }]]]));
    expect(next.proposals[0]).toBe(view.proposals[0]);
    expect(next.proposals[1].rows[0].fields[0]).toMatchObject({ decision: 'reject', decisionBy: 'human' });
  });
});

describe('decisionSourceOf', () => {
  it('πρόταση παλαιότερη της Φάσης 4β δεν δηλώνει προέλευση ⇒ κανόνας', () => {
    expect(decisionSourceOf({})).toBe('rule');
    expect(decisionSourceOf({ decisionBy: 'human' })).toBe('human');
  });
});

describe('αναίρεση απόφασης πεδίου (§5.5.2 Β9α) — `null` ⇒ επιστροφή στην κρίση του κανόνα', () => {
  const issue = { code: 'repeatedValue' } as unknown as ImportProposalField['issues'][number];
  const undo = (value: ImportProposalField) =>
    overlayDecisions(proposal([value]), [{ rowKey: 'r0', targetKey: keyOf('a'), decision: null }]).rows[0].fields[0];

  it('πεδίο με δεύτερη τιμή στην πηγή (εύρημα) επιστρέφει σε «Εκκρεμεί» — το ζωντανό εύρημα της σελ. 87', () => {
    expect(undo(field('a', { decisionBy: 'human', issues: [issue] }))).toMatchObject({ decision: 'pending', decisionBy: 'rule' });
  });

  it('καθαρό πεδίο επιστρέφει στην αυτόματη αποδοχή, ως απόφαση του κανόνα', () => {
    expect(undo(field('a', { decision: 'reject', decisionBy: 'human' }))).toMatchObject({ decision: 'accept', decisionBy: 'rule' });
  });

  it('σύγκρουση επιστρέφει σε «Εκκρεμεί»', () => {
    expect(undo(field('a', { status: 'conflict', decisionBy: 'human' }))).toMatchObject({ decision: 'pending', decisionBy: 'rule' });
  });

  it('είναι ιδεμπότητη: δεύτερη αναίρεση δίνει την ίδια απόφαση', () => {
    const once = undo(field('a', { decision: 'reject', decisionBy: 'human' }));
    expect(undo(once)).toEqual(once);
  });

  it('απόφαση και αναίρεση στην ίδια ουρά: η τελευταία κερδίζει', () => {
    const next = overlayDecisions(proposal([field('a', { decision: 'pending', status: 'conflict' })]), [
      { rowKey: 'r0', targetKey: keyOf('a'), decision: 'accept' },
      { rowKey: 'r0', targetKey: keyOf('a'), decision: null },
    ]);
    expect(next.rows[0].fields[0]).toMatchObject({ decision: 'pending', decisionBy: 'rule' });
  });
});
