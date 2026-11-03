/**
 * ADR-928 Φ1 — **άγκυρα δεδομένων**: η προεπιλεγμένη βιβλιοθήκη και τα πρότυπα περνούν από τους ΙΔΙΟΥΣ επικυρωτές με
 * τον γραφέα. Μια ρήτρα που δεν θα δεχόταν ο γραφέας δεν φτάνει ποτέ στη σπορά.
 */

import { validateClauseContent, validateClauseIdentity } from '@/subapps/procurement/subcontracts/clauses/validate-clause-version';
import { validateTemplateAgainstLibrary, validateTradeTemplateDefinition } from '@/subapps/procurement/subcontracts/templates/validate-trade-template';
import type { ClauseParameterDefinition } from '@/subapps/procurement/subcontracts/types/clause-parameter';
import { DEFAULT_CLAUSE_LIBRARY } from '../default-clause-library';
import { DEFAULT_TRADE_TEMPLATES } from '../default-trade-templates';

/** Η βιβλιοθήκη σαν να είχε εγκριθεί ολόκληρη — όπως θα τη δει το πρότυπο μετά τις εγκρίσεις του ανθρώπου. */
const approvedLibrary = new Map<string, readonly ClauseParameterDefinition[] | null>(
  DEFAULT_CLAUSE_LIBRARY.map((clause) => [clause.clauseKey, clause.parameters]),
);

/** Λέξεις-ίχνη στοιχείων προσώπων από τα παλιά έγγραφα — δεν επιτρέπεται να ταξιδέψουν σε δεδομένα πλατφόρμας. */
const PERSONAL_TRACES = [/Α\.?Φ\.?Μ\.?\s*:?\s*\d/, /\b\d{9}\b/, /LOMI|ΚΑΛΑΝΙΔΗΣ|Σαμοθράκης/];

describe('DEFAULT_CLAUSE_LIBRARY', () => {
  it('μοναδικά κλειδιά', () => {
    const keys = DEFAULT_CLAUSE_LIBRARY.map((clause) => clause.clauseKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it.each(DEFAULT_CLAUSE_LIBRARY.map((clause) => [clause.clauseKey, clause] as const))('%s — έγκυρη ταυτότητα και περιεχόμενο', (_key, clause) => {
    expect(validateClauseIdentity(clause.clauseKey, clause.title)).toEqual([]);
    expect(validateClauseContent(clause.body, clause.parameters)).toEqual([]);
  });

  it('κανένα ίχνος προσωπικών δεδομένων από τα παλιά έγγραφα', () => {
    const text = JSON.stringify(DEFAULT_CLAUSE_LIBRARY) + JSON.stringify(DEFAULT_TRADE_TEMPLATES);
    for (const trace of PERSONAL_TRACES) expect(text).not.toMatch(trace);
  });

  it('οι όροι υπολογισμού δένονται στα δεδομένα — καμία δεύτερη τιμή στη ρήτρα (Φ1 απόφαση 2)', () => {
    const bound = (key: string) => DEFAULT_CLAUSE_LIBRARY.find((clause) => clause.clauseKey === key)?.parameters.every((p) => p.source.kind === 'term');
    for (const key of ['retention.performance', 'tax.withholding_technical_works', 'payment.instruments', 'vat.treatment', 'penalty.delay']) {
      expect(bound(key)).toBe(true);
    }
  });
});

describe('DEFAULT_TRADE_TEMPLATES', () => {
  it.each(DEFAULT_TRADE_TEMPLATES.map((template) => [template.code, template] as const))('%s — έγκυρο και μέσα στις ελεύθερες ζώνες της βιβλιοθήκης', (_code, template) => {
    expect(validateTradeTemplateDefinition(template)).toEqual([]);
    expect(validateTemplateAgainstLibrary(template, approvedLibrary)).toEqual([]);
  });

  it('παρονομαστής: ο έλεγχος απέναντι στη βιβλιοθήκη ΠΙΑΝΕΙ κράτηση κάτω από το επιτρεπτό', () => {
    const plaster = DEFAULT_TRADE_TEMPLATES.find((template) => template.code === 'plastering.three_coat')!;
    const tooLow = {
      ...plaster,
      defaultTerms: { ...plaster.defaultTerms, paymentPlan: { ...plaster.defaultTerms.paymentPlan, retention: { rate: 200, release: [{ share: 10_000, trigger: { kind: 'final_acceptance' as const } }] } } },
    };
    const at = plaster.clauses.findIndex((ref) => ref.clauseKey === 'retention.performance');
    expect(validateTemplateAgainstLibrary(tooLow, approvedLibrary)).toEqual([{ code: 'overrideForbidden', path: `clauses.${at}.bound.rate` }]);
  });

  it('παρονομαστής: ρήτρα χωρίς εγκεκριμένη έκδοση · ανύπαρκτη ρήτρα', () => {
    const rebar = DEFAULT_TRADE_TEMPLATES[0];
    const pending = new Map(approvedLibrary);
    pending.set('subject.scope', null);
    pending.delete('vat.treatment');
    const codes = validateTemplateAgainstLibrary(rebar, pending).map((issue) => issue.code);
    expect(codes).toEqual(['clauseRefNotApproved', 'clauseRefUnknown']);
  });
});
