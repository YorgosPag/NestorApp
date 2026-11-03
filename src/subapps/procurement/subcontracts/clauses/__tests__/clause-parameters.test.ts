/**
 * ADR-928 Φ1 — επικύρωση τιμών/ορισμών παραμέτρων και ετυμηγορία ζώνης.
 */

import { toleranceVerdict } from '../tolerance-verdict';
import { CLAUSE_TEXT_PARAMETER_MAX_LENGTH, validateParameterValue } from '../validate-clause-parameter';
import { validateParameterDefinitions } from '../validate-parameter-definition';
import type { ClauseParameterDefinition, ClauseParameterValue } from '../../types/clause-parameter';
import { crewRatio, paymentInstrument, retentionRate } from './clause-fixtures';

const codes = (definition: ClauseParameterDefinition, value: ClauseParameterValue) =>
  validateParameterValue(definition, value, 'v').map((issue) => issue.code);

const definitionOf = (kind: ClauseParameterDefinition['kind'], preferred: ClauseParameterValue): ClauseParameterDefinition => ({
  key: 'p', kind, label: { el: 'Π' }, source: { kind: 'clause' }, preferred, tolerance: null,
});

describe('validateParameterValue — κάθε είδος δέχεται το έγκυρο και αρνείται το άκυρο', () => {
  it.each<[ClauseParameterDefinition['kind'], ClauseParameterValue, ClauseParameterValue]>([
    ['percent', { kind: 'percent', value: 10_000 }, { kind: 'percent', value: 10_001 }],
    ['percent', { kind: 'percent', value: 0 }, { kind: 'percent', value: 2.5 }],
    ['money', { kind: 'money', value: 10_000 }, { kind: 'money', value: -1 }],
    ['days', { kind: 'days', value: 15 }, { kind: 'days', value: 1.5 }],
    ['weekday', { kind: 'weekday', value: 5 }, { kind: 'weekday', value: 8 as 5 }],
    ['milestone', { kind: 'milestone', value: 'structure.frame_complete' }, { kind: 'milestone', value: 'Φέρων' }],
    ['unit', { kind: 'unit', value: 'ton' }, { kind: 'unit', value: 'τόνος' as 'ton' }],
    ['party', { kind: 'party', value: 'shared' }, { kind: 'party', value: 'nobody' as 'shared' }],
    ['text', { kind: 'text', value: 'Γ. Παπαδόπουλος' }, { kind: 'text', value: '   ' }],
  ])('%s', (kind, valid, invalid) => {
    const definition = definitionOf(kind, valid);
    expect(codes(definition, valid)).toEqual([]);
    expect(codes(definition, invalid)).toEqual(['parameterValueInvalid']);
  });

  it('είδος που δεν ταιριάζει με τον ορισμό', () => {
    expect(codes(retentionRate, { kind: 'money', value: 500 })).toEqual(['parameterKindMismatch']);
  });

  it('enum: μόνο κλειδί από τα options', () => {
    expect(codes(paymentInstrument, { kind: 'enum', value: 'cheque' })).toEqual([]);
    expect(codes(paymentInstrument, { kind: 'enum', value: 'barter' })).toEqual(['parameterOptionUnknown']);
  });

  it('ratio: μήκος = πλήθος μελών, θετικοί ακέραιοι', () => {
    expect(codes(crewRatio, { kind: 'ratio', value: [2, 1, 1] })).toEqual([]);
    expect(codes(crewRatio, { kind: 'ratio', value: [1, 1] })).toEqual(['parameterRatioLength']);
    expect(codes(crewRatio, { kind: 'ratio', value: [1, 0, 1] })).toEqual(['parameterValueInvalid']);
  });

  it('text: όριο μήκους', () => {
    const definition = definitionOf('text', { kind: 'text', value: 'α' });
    expect(codes(definition, { kind: 'text', value: 'α'.repeat(CLAUSE_TEXT_PARAMETER_MAX_LENGTH + 1) })).toEqual(['parameterTextTooLong']);
  });
});

describe('toleranceVerdict — όρια ακριβώς πάνω στα άκρα', () => {
  const verdict = (value: number) => toleranceVerdict(retentionRate, { kind: 'percent', value });
  it.each([
    [500, 'preferred'],
    [1000, 'acceptable'],
    [499, 'needs_approval'],
    [300, 'needs_approval'],
    [299, 'forbidden'],
    [1500, 'needs_approval'],
    [1501, 'forbidden'],
  ])('%i → %s', (value, expected) => expect(verdict(value)).toBe(expected));

  it('επιλογές: αποδεκτή · χωρίς ζώνη ⇒ έγκριση · απαγορευμένη', () => {
    expect(toleranceVerdict(paymentInstrument, { kind: 'enum', value: 'bank' })).toBe('preferred');
    expect(toleranceVerdict(paymentInstrument, { kind: 'enum', value: 'cheque' })).toBe('needs_approval');
    expect(toleranceVerdict(paymentInstrument, { kind: 'enum', value: 'cash' })).toBe('forbidden');
  });

  it('fixed: μόνο η προτιμώμενη περνά ελεύθερα (η αναλογία συγκρίνεται κατά στοιχείο)', () => {
    expect(toleranceVerdict(crewRatio, { kind: 'ratio', value: [1, 1, 1] })).toBe('preferred');
    expect(toleranceVerdict(crewRatio, { kind: 'ratio', value: [2, 1, 1] })).toBe('needs_approval');
  });

  it('χωρίς ζώνη: κάθε έγκυρη τιμή είναι αποδεκτή', () => {
    const free = { ...retentionRate, tolerance: null };
    expect(toleranceVerdict(free, { kind: 'percent', value: 9000 })).toBe('acceptable');
  });
});

describe('validateParameterDefinitions — συνέπεια ορισμού', () => {
  const codesOf = (definitions: ClauseParameterDefinition[]) => validateParameterDefinitions(definitions, 'parameters').map((issue) => issue.code);

  it('οι ορισμοί των fixtures είναι έγκυροι', () => {
    expect(codesOf([retentionRate, paymentInstrument, crewRatio])).toEqual([]);
  });

  it('διπλό κλειδί', () => {
    expect(codesOf([retentionRate, retentionRate])).toEqual(['parameterKeyDuplicate']);
  });

  it('προτιμώμενη έξω από το αποδεκτό · αποδεκτό έξω από το επιτρεπτό · ανάποδο εύρος', () => {
    const tolerance = retentionRate.tolerance as Extract<ClauseParameterDefinition['tolerance'], { kind: 'numeric' }>;
    expect(codesOf([{ ...retentionRate, preferred: { kind: 'percent', value: 400 } }])).toEqual(['tolerancePreferredOutsideAcceptable']);
    expect(codesOf([{ ...retentionRate, tolerance: { ...tolerance, walkAway: { min: 600, max: null } } }])).toEqual(['toleranceAcceptableOutsideWalkAway']);
    expect(codesOf([{ ...retentionRate, tolerance: { ...tolerance, acceptable: { min: 900, max: 800 } } }])).toEqual(['toleranceRangeInvalid']);
  });

  it('ζώνη λάθος είδους: αριθμητική σε enum', () => {
    expect(codesOf([{ ...paymentInstrument, tolerance: retentionRate.tolerance }])).toEqual(['toleranceKindMismatch']);
  });

  it('enum χωρίς επιλογές · ratio χωρίς μέλη', () => {
    expect(codesOf([{ ...paymentInstrument, options: [] }])).toContain('parameterOptionsMissing');
    expect(codesOf([{ ...crewRatio, terms: [] }])).toContain('parameterTermsMissing');
  });

  it('δέσιμο: το είδος του όρου πρέπει να ταιριάζει, και το enum να ορίζει ακριβώς τις επιλογές του όρου', () => {
    expect(codesOf([{ ...retentionRate, source: { kind: 'term', term: 'retention.rate' } }])).toEqual([]);
    expect(codesOf([{ ...retentionRate, source: { kind: 'term', term: 'penalty.perDay' } }])).toEqual(['bindingKindMismatch']);
    expect(codesOf([{ ...paymentInstrument, source: { kind: 'term', term: 'vat.treatment' } }])).toContain('bindingKindMismatch');
  });
});
