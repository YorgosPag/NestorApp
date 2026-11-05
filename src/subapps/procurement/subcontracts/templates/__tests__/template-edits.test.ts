import { DEFAULT_CLAUSE_LIBRARY } from '@/config/subcontracts/default-clause-library';
import { DEFAULT_TRADE_TEMPLATES } from '@/config/subcontracts/default-trade-templates';
import { templateBoundTermsOf } from '../../agreements/bound-terms';
import type { ApprovedLibrary } from '../../agreements/judge-deviations';
import { termsWithRetention } from '../../agreements/__tests__/agreement-fixtures';
import {
  addClauseRef,
  judgeTemplateDraft,
  newTemplateFrom,
  removeClauseRef,
  setOverride,
  specimenAgreementOf,
  templateCodeFromTitle,
  templateDefinitionOf,
} from '../template-edits';
import { validateTemplateAgainstLibrary } from '../validate-trade-template';
import { libraryParametersOf } from '../../library/seed-template-readiness';

const LIBRARY: ApprovedLibrary = new Map(DEFAULT_CLAUSE_LIBRARY.map((draft, index) => [draft.clauseKey, { clauseId: `sccl_${index}`, version: 1, parameters: draft.parameters }]));
const [seed] = DEFAULT_TRADE_TEMPLATES;
const context = { mode: 'edit' as const, takenCodes: new Set<string>(), library: LIBRARY };

describe('template-edits — ο επεξεργαστής προτύπου (ADR-928 §5.22)', () => {
  it('σπαρμένο πρότυπο πάνω σε εγκεκριμένη βιβλιοθήκη ⇒ ο κριτής (του γραφέα) σιωπά', () => {
    expect(judgeTemplateDraft(templateDefinitionOf(seed), context)).toEqual([]);
  });

  it('νέο από υπάρχον: ίδιες γραμμές/ρήτρες/όροι, κενός κωδικός και τίτλος· κωδικός πιασμένος ⇒ `templateCodeTaken`', () => {
    const fresh = newTemplateFrom(seed);
    expect(fresh.lines).toBe(seed.lines);
    expect(fresh.code).toBe('');
    const named = { ...fresh, title: { el: 'Επιχρίσματα' }, code: templateCodeFromTitle('Επιχρίσματα', new Set()) };
    expect(named.code).toBe('epichrismata');
    const issues = judgeTemplateDraft(named, { ...context, mode: 'create', takenCodes: new Set(['epichrismata']) });
    expect(issues).toEqual([{ code: 'templateCodeTaken', path: 'code' }]);
  });

  it('«όπως στη βιβλιοθήκη» = απουσία κλειδιού, όχι αντίγραφο', () => {
    const base = addClauseRef({ ...seed, clauses: [] }, 'payment.instruments');
    const set = setOverride(base, 0, 'instrument', { kind: 'enum', value: 'bank' });
    expect(set.clauses[0].parameterOverrides).toEqual({ instrument: { kind: 'enum', value: 'bank' } });
    expect(setOverride(set, 0, 'instrument', null).clauses[0].parameterOverrides).toEqual({});
    expect(addClauseRef(base, 'payment.instruments')).toBe(base);
    expect(removeClauseRef(base, 0).clauses).toEqual([]);
  });

  it('η ζώνη του όρου στο πρότυπο γράφεται ΑΚΡΙΒΩΣ στο μονοπάτι του κριτή (`clauses.N.bound.<key>`)', () => {
    const definition = { ...seed, clauses: [{ clauseKey: 'retention.performance', parameterOverrides: {} }], defaultTerms: termsWithRetention(400) };
    const issues = validateTemplateAgainstLibrary(definition, libraryParametersOf(LIBRARY));
    const bound = [...templateBoundTermsOf(definition.clauses, LIBRARY, definition.defaultTerms).values()].flat();
    const retention = bound.find((one) => one.clauseKey === 'retention.performance');
    expect(retention?.verdict).toBe('needs_approval');
    expect(issues).toContainEqual({ code: 'termOutsideTolerance', path: retention?.clausePath });
  });

  it('δείγμα εγγράφου: οι ρήτρες του προτύπου στην έκδοση σε ισχύ, με τις τιμές του προτύπου', () => {
    const specimen = specimenAgreementOf(templateDefinitionOf(seed), LIBRARY);
    expect(specimen.clauses.map((selection) => selection.clauseKey)).toEqual(seed.clauses.map((ref) => ref.clauseKey));
    expect(specimen.lines).toBe(seed.lines);
    expect(specimen.parties.subcontractor.name).toBe('');
  });
});
