/**
 * Η γέφυρα όρος ↔ ρήτρα (ADR-928 Φ3γ-2 απόφαση 2): το πεδίο του όρου βλέπει τη ζώνη και το μονοπάτι του κριτή.
 */

import { COMMERCIAL_TERM_BINDINGS } from '../../clauses/commercial-term-bindings';
import { COMMERCIAL_TERM_BINDING_KEYS } from '../../types/clause-parameter';
import type { CommercialTerms } from '../../types/commercial-terms';
import { draftInputOf } from '../agreement-draft-input';
import { boundTermsAt, boundTermsOf } from '../bound-terms';
import { issuesAt } from '../issue-paths';
import { judgeAgreementDraft } from '../judge-agreement-draft';
import { instrumentInput, LIBRARY, plasteringTerms, retentionInput, sampleAgreement, termsWithRetention } from './agreement-fixtures';

/** Όροι όπου ισχύει **κάθε** δέσιμο (παρακράτηση, ποινή, επανάληψη με ημέρα εβδομάδας). */
const ALL_BOUND: CommercialTerms = {
  ...plasteringTerms,
  withholding: { applies: true, rate: 300 },
  penalty: { perDay: 5_000, capOfContractValue: 1_000 },
  paymentPlan: {
    ...plasteringTerms.paymentPlan,
    schedule: { kind: 'recurring', every: 2, unit: 'week', anchor: { kind: 'weekday', weekday: 5 }, holidayShift: 'previous_business_day' },
  },
};

/** Η τιμή στο μονοπάτι — ανεξάρτητα από τον κώδικα που ελέγχεται. */
function valueAt(root: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((node, segment) => (node !== null && typeof node === 'object' ? (node as Record<string, unknown>)[segment] : undefined), root);
}

describe('termPath — άγκυρα πληρότητας: κάθε δέσιμο λέει ΠΟΙΟ πεδίο διαβάζει, και λέει αλήθεια', () => {
  it.each([...COMMERCIAL_TERM_BINDING_KEYS])('%s: το `termPath` δίνει την ίδια τιμή με το `read`', (key) => {
    const spec = COMMERCIAL_TERM_BINDINGS[key];
    const read = spec.read(ALL_BOUND);
    expect(read).not.toBeNull();
    expect(valueAt(ALL_BOUND, spec.termPath)).toEqual(read?.value);
  });

  it('δύο δεσίματα δεν δείχνουν ποτέ το ίδιο πεδίο', () => {
    const paths = COMMERCIAL_TERM_BINDING_KEYS.map((key) => COMMERCIAL_TERM_BINDINGS[key].termPath);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe('boundTermsOf — η ζώνη της ρήτρας στο πεδίο του όρου', () => {
  const clauses = [instrumentInput('bank'), retentionInput];

  it('κράτηση 5% ⇒ ελεύθερη, στο `paymentPlan.retention.rate`, με το μονοπάτι της ρήτρας', () => {
    const [bound] = boundTermsOf(clauses, LIBRARY, termsWithRetention(500)).get('paymentPlan.retention.rate') ?? [];
    expect(bound).toMatchObject({ clauseIndex: 1, clauseKey: 'retention.performance', verdict: 'preferred', clausePath: 'clauses.1.parameterValues.rate' });
  });

  it('κράτηση 4% ⇒ «θέλει έγκριση», και ο κριτής γράφει το εύρημα ΑΚΡΙΒΩΣ στο `clausePath`', () => {
    const terms = { ...termsWithRetention(400), minimumOutputs: [] };
    const draft = { ...draftInputOf(sampleAgreement()), terms };
    const [bound] = boundTermsOf(draft.clauses, LIBRARY, terms).get('paymentPlan.retention.rate') ?? [];
    expect(bound.verdict).toBe('needs_approval');
    const judged = judgeAgreementDraft(draft, { library: LIBRARY, previous: [], actorUid: 'u_author', today: '2026-11-03' });
    expect(issuesAt(judged.issues, bound.clausePath).map((issue) => issue.code)).toEqual(['deviationReasonRequired']);
  });

  it('ο λόγος του πρόχειρου ταξιδεύει στο πεδίο του όρου', () => {
    const withReason = [instrumentInput('bank'), { ...retentionInput, deviationReasons: { rate: 'μικρό έργο' } }];
    const [bound] = boundTermsOf(withReason, LIBRARY, termsWithRetention(400)).get('paymentPlan.retention.rate') ?? [];
    expect(bound.reason).toBe('μικρό έργο');
  });

  it('ρήτρα σε παλιά έκδοση ή όρος που δεν ισχύει ⇒ καμία ζώνη (ο κριτής το λέει στη ρήτρα)', () => {
    expect(boundTermsOf([{ ...retentionInput, version: 0 }], LIBRARY, termsWithRetention(400)).size).toBe(0);
    const noRetention = { ...plasteringTerms, paymentPlan: { ...plasteringTerms.paymentPlan, retention: null } };
    expect(boundTermsOf([retentionInput], LIBRARY, noRetention).size).toBe(0);
  });

  it('`boundTermsAt` ρωτά σχετικά με το τμήμα της ενότητας', () => {
    const bound = boundTermsOf(clauses, LIBRARY, termsWithRetention(400));
    expect(boundTermsAt(bound, 'paymentPlan')('retention.rate')).toHaveLength(1);
    expect(boundTermsAt(bound, '')('paymentPlan.retention.rate')).toHaveLength(1);
    expect(boundTermsAt(bound, 'paymentPlan')('withholding.rate')).toEqual([]);
  });
});
