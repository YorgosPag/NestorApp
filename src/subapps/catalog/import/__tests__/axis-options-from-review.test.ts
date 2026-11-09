/**
 * ADR-923 §5.5.2 Β7 — νέες τιμές άξονα από τον έλεγχο: πρόταση, απόδειξη, εύρεση γραμμής, προσθετική απόφαση γραμμής.
 */

import { MFP_ATTRIBUTES } from '../../__tests__/fixtures/mfp-fan-coil.fixture';
import type { CatalogAttributeDefinition } from '../../types/attribute';
import type { ImportProposalRow } from '../../types/catalog-import';
import { axisCandidatesOf, axisLineOf, axisRowTexts, proveAxisTexts, suggestAxisOptions, withAxisOptions } from '../axis-options-from-review';
import { applyLineOverrides } from '../page-line-overrides';

const size = MFP_ATTRIBUTES.find((attribute) => attribute.code === 'size') as CatalogAttributeDefinition;
const CASSETTES = ['MFP-25K1M-Q1AA1', 'MFP-35K1M-Q1AA1', 'MFP-68K1M-Q1AA1'];

const row = (rowKey: string, label: string, issues: ImportProposalRow['issues'] = []): ImportProposalRow => ({
  rowKey, holderKind: 'product', holderId: null, expectedRevision: null, action: 'create', label, fields: [], issues,
});

describe('suggestAxisOptions', () => {
  it('προτείνει μία τιμή ανά κείμενο που δεν αναγνωρίζεται, με κωδικό από την ετικέτα', () => {
    expect(suggestAxisOptions(size, [...CASSETTES, CASSETTES[0]])).toEqual([
      { code: 'mfp_25k1m_q1aa1', label: 'MFP-25K1M-Q1AA1' },
      { code: 'mfp_35k1m_q1aa1', label: 'MFP-35K1M-Q1AA1' },
    ]);
  });

  it('κωδικός πιασμένος ⇒ επίθημα, ντετερμινιστικά', () => {
    const taken = { ...size, config: { options: [{ code: 'mfp_25k1m_q1aa1', labels: { el: 'άλλο' } }] } } as CatalogAttributeDefinition;
    expect(suggestAxisOptions(taken, ['MFP-25K1M-Q1AA1'])[0].code).toBe('mfp_25k1m_q1aa1_2');
  });
});

describe('withAxisOptions + proveAxisTexts', () => {
  it('νέες τιμές ⇒ κάθε κείμενο λύνεται στη δική του', () => {
    const plan = withAxisOptions(size, [{ code: 'mfp_25k1m', label: 'MFP-25K1M' }]);
    expect(plan.issues.size).toBe(0);
    expect(proveAxisTexts(plan.next, ['MFP-25K1M-Q1AA1'], size)).toEqual([{ kind: 'resolved', optionCode: 'mfp_25k1m', prefixOf: false }]);
  });

  it('η κασέτα MFP-68K1M λύνεται ΣΗΜΕΡΑ στο MFP-68 του καναλάτου ⇒ σημαδεύεται prefixOf', () => {
    expect(proveAxisTexts(size, ['MFP-68K1M-Q1AA1'], size)).toEqual([{ kind: 'resolved', optionCode: 'mfp_68', prefixOf: true }]);
  });

  it('MFP-68 + MFP-68K1M πάνω στο MFP-68K1M-Q1AA1 ⇒ αμφίσημο, με τις δύο υποψήφιες', () => {
    const plan = withAxisOptions(size, [{ code: 'mfp_68k1m', label: 'MFP-68K1M' }]);
    expect(proveAxisTexts(plan.next, ['MFP-68K1M-Q1AA1'])).toEqual([{ kind: 'ambiguous', candidates: ['mfp_68', 'mfp_68k1m'] }]);
  });

  it('ιδεμπότητο: ίδια επιλογή ⇒ τίποτα να προστεθεί· ίδιος κωδικός με άλλη ετικέτα ⇒ codeTaken', () => {
    expect(withAxisOptions(size, [{ code: 'mfp_34', label: 'MFP-34' }]).added).toEqual([]);
    expect(withAxisOptions(size, [{ code: 'mfp_34', label: 'άλλο' }]).issues.get(0)).toBe('codeTaken');
  });
});

describe('axisLineOf', () => {
  const next = withAxisOptions(size, CASSETTES.map((label) => ({ code: label.toLowerCase().replace(/-/g, '_'), label }))).next;

  it('μία γραμμή λύνεται ⇒ αυτή· ο διπλός κωδικός της πηγής ΔΕΝ την αποκλείει', () => {
    expect(axisLineOf(next, [['ΜΟΝΤΕΛΟ', 'x', 'y'], [CASSETTES[0], CASSETTES[2], CASSETTES[2]]])).toEqual({ kind: 'found', line: 1 });
  });

  it('καμία ⇒ missing · δύο ⇒ ambiguous', () => {
    expect(axisLineOf(next, [['a', 'b']])).toEqual({ kind: 'missing' });
    expect(axisLineOf(next, [[CASSETTES[0]], [CASSETTES[1]]])).toEqual({ kind: 'ambiguous', lines: [0, 1] });
  });
});

describe('axisCandidatesOf + axisRowTexts', () => {
  it('ο άξονας από το axisValueMissing της γραμμής', () => {
    expect(axisCandidatesOf([row('v0', 'MFP-25K1M-Q1AA1', [{ code: 'axisValueMissing', path: 'values.size' }])])).toEqual(['size']);
  });

  it('χωρίς πεδίο ταυτότητας ⇒ η ετικέτα, χωρίς διόρθωση', () => {
    expect(axisRowTexts([row('v0', 'MFP-25K1M-Q1AA1')], [], () => false)).toEqual([{ rowKey: 'v0', printed: 'MFP-25K1M-Q1AA1', corrected: null }]);
  });
});

describe('applyLineOverrides — απόφαση axis', () => {
  const mapping = { table: 't0', role: 'variants' as const, variantsIn: 'columns' as const, lines: [{ line: 2, attribute: 'model_code', confidence: 0.9 }], imageCheck: [] };
  const codeById = new Map([['size', 'size']]);
  const stamp = { by: 'u', at: '2026-11-09T00:00:00Z' };

  it('ΠΡΟΣΘΕΤΙΚΗ: η γραμμή κρατά τον κωδικό SKU και δίνει και τον άξονα', () => {
    const { mapping: out } = applyLineOverrides(mapping, [{ page: 87, table: 't0', line: 2, decision: { kind: 'axis', attributeId: 'size' }, ...stamp }], codeById, new Set(['model_code', 'size']));
    expect(out.lines).toEqual([{ line: 2, attribute: 'model_code', confidence: 0.9 }, { line: 2, attribute: 'size', confidence: 1 }]);
  });
});
