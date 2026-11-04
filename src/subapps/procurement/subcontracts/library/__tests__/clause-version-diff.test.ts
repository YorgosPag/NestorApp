import { DEFAULT_CLAUSE_LIBRARY } from '@/config/subcontracts/default-clause-library';
import { documentLocaleOf } from '../../document/document-locale';
import type { SubcontractClauseDraft } from '../../types/clause';
import type { ClauseParameterDefinition } from '../../types/clause-parameter';
import { clausePrintedText, diffClauseVersions, diffParameters } from '../clause-version-diff';
import { hasTextChange } from '../text-diff';

const el = documentLocaleOf('el');
const retention = DEFAULT_CLAUSE_LIBRARY.find((clause) => clause.clauseKey === 'retention.performance') as SubcontractClauseDraft;
const rate = retention.parameters[0];

const withRate = (patch: Partial<ClauseParameterDefinition>): SubcontractClauseDraft => ({
  ...retention,
  parameters: [{ ...rate, ...patch } as ClauseParameterDefinition],
});

describe('clause-version-diff — κείμενο και παράμετροι', () => {
  it('ίδια έκδοση (ακόμη και με άλλη σειρά κλειδιών) ⇒ καμία αλλαγή', () => {
    const reordered = { ...retention, parameters: [JSON.parse(JSON.stringify({ tolerance: rate.tolerance, ...rate }))] };
    const diff = diffClauseVersions(retention, reordered, el);
    expect(hasTextChange(diff.text)).toBe(false);
    expect(diff.parameters).toEqual([]);
  });

  it('το κείμενο συγκρίνεται όπως τυπώνεται: η προτιμώμενη τιμή εμφανίζεται ως λέξη', () => {
    expect(clausePrintedText(retention, el)).toContain(el.percent(500));
    const diff = diffClauseVersions(retention, withRate({ preferred: { kind: 'percent', value: 1000 } }), el);
    // Μόνο ο αριθμός αλλάζει· το «%» είναι δικό του τμήμα και μένει ίδιο.
    const changed = (kind: 'added' | 'removed') => diff.text.filter((part) => part.kind === kind).map((part) => part.text).join('');
    expect([changed('removed'), changed('added')]).toEqual(['5', '10']);
  });

  it('στενότερες ζώνες: η παλιά συνηθισμένη τιμή θέλει πλέον έγκριση', () => {
    const narrowed = withRate({
      preferred: { kind: 'percent', value: 800 },
      tolerance: { kind: 'numeric', acceptable: { min: 800, max: 1000 }, walkAway: { min: 300, max: 1500 } },
    });
    const [change] = diffParameters(retention.parameters, narrowed.parameters);
    expect(change).toMatchObject({ change: 'changed', key: 'rate', aspects: ['preferred', 'tolerance'], previousPreferredUnderNew: 'needs_approval' });
  });

  it('παράμετρος που προστέθηκε / αφαιρέθηκε', () => {
    const extra: ClauseParameterDefinition = { ...rate, key: 'cap', source: { kind: 'clause' } };
    expect(diffParameters([rate], [rate, extra])).toEqual([{ change: 'added', key: 'cap', after: extra }]);
    expect(diffParameters([rate, extra], [rate])).toEqual([{ change: 'removed', key: 'cap', before: extra }]);
  });

  it('πρώτη έκδοση: όλο το κείμενο και όλες οι παράμετροι «προστέθηκαν»', () => {
    const diff = diffClauseVersions(null, retention, el);
    expect(diff.text.every((part) => part.kind === 'added')).toBe(true);
    expect(diff.parameters.map((change) => change.change)).toEqual(['added']);
  });

  it('κάθε σπαρμένη ρήτρα αποδίδεται σε κείμενο χωρίς «λείπει τιμή»', () => {
    const missing = el.phrase('parameter.missing');
    for (const clause of DEFAULT_CLAUSE_LIBRARY) expect(clausePrintedText(clause, el)).not.toContain(missing);
  });
});
