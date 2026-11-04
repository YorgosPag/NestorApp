import type { SubcontractAgreement } from '../../types/agreement';
import type { SubcontractTradeTemplate } from '../../types/trade-template';
import { clauseUsageOf } from '../clause-usage';

type TemplateFacts = Pick<SubcontractTradeTemplate, 'id' | 'code' | 'title' | 'clauses'>;
type DraftFacts = Pick<SubcontractAgreement, 'id' | 'documentNumber' | 'title' | 'status' | 'clauses'>;

const template = (code: string, keys: readonly string[]): TemplateFacts => ({
  id: `sctt_${code}`, code, title: { el: code }, clauses: keys.map((clauseKey) => ({ clauseKey, parameterOverrides: {} })),
});

const agreement = (id: string, status: SubcontractAgreement['status'], pins: Readonly<Record<string, number>>): DraftFacts => ({
  id, documentNumber: id.toUpperCase(), title: { el: id }, status,
  clauses: Object.entries(pins).map(([clauseKey, version]) => ({ clauseId: `sccl_${clauseKey}`, clauseKey, version, parameterValues: {}, deviations: {} })),
});

describe('clause-usage — επίπτωση πριν την απόφαση', () => {
  const templates = [template('rebar', ['retention.performance', 'vat.treatment']), template('plaster', ['vat.treatment'])];
  const drafts = [
    agreement('a1', 'draft', { 'retention.performance': 1 }),
    agreement('a2', 'draft', { 'retention.performance': 2 }),
    agreement('a3', 'issued', { 'retention.performance': 1 }),
    agreement('a4', 'draft', { 'vat.treatment': 1 }),
  ];

  it('πρότυπα με το κλειδί · μόνο πρόχειρα · «πίσω» όσα είναι σε παλιότερη έκδοση', () => {
    const usage = clauseUsageOf('retention.performance', 2, templates, drafts);
    expect(usage.templates.map((item) => item.code)).toEqual(['rebar']);
    expect(usage.drafts.map((use) => [use.agreement.id, use.pinnedVersion, use.behind])).toEqual([['a1', 1, true], ['a2', 2, false]]);
  });

  it('χωρίς έκδοση σε ισχύ κανένα πρόχειρο δεν είναι «πίσω»', () => {
    expect(clauseUsageOf('retention.performance', null, templates, drafts).drafts.every((use) => !use.behind)).toBe(true);
  });
});
