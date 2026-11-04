import { plasteringTerms, SAMPLE_LINE } from '../../agreements/__tests__/agreement-fixtures';
import { REQUIRED_DOCUMENT_KINDS } from '../../types/commercial-terms';
import { NEW_CREW, NEW_PENALTY, newCostSharingItem, newCrewMember, newMinimumOutput, newRequiredDocument } from '../term-edits';
import { validateCommercialTerms } from '../validate-commercial-terms';

const lineIds = new Set([SAMPLE_LINE.id]);
const codesOf = (terms: typeof plasteringTerms) => validateCommercialTerms(terms, 'terms', lineIds).map((issue) => `${issue.code}@${issue.path}`);

describe('term-edits — οι προεπιλογές ζητούν ΜΟΝΟ ό,τι πρέπει να αποφασίσει ο άνθρωπος (ADR-928 Φ3γ-2)', () => {
  const base = { ...plasteringTerms, minimumOutputs: [], costSharing: [], requiredDocuments: [], crew: null, penalty: null };

  it('οι όροι-βάση περνούν (αλλιώς τα παρακάτω δεν αποδεικνύουν τίποτα)', () => {
    expect(codesOf(base)).toEqual([]);
  });

  it('ποινή και συνεργείο χωρίς μέλη: έγκυρα', () => {
    expect(codesOf({ ...base, penalty: NEW_PENALTY, crew: NEW_CREW })).toEqual([]);
  });

  it('νέο μέλος συνεργείου ⇒ ζητείται μόνο ο ρόλος', () => {
    expect(codesOf({ ...base, crew: { ...NEW_CREW, members: [newCrewMember()] } })).toEqual(['parameterLabelRequired@terms.crew.members.0.role']);
  });

  it('νέος επιμερισμός ⇒ 50/50 έγκυρο, ζητείται μόνο η περιγραφή', () => {
    expect(codesOf({ ...base, costSharing: [newCostSharingItem()] })).toEqual(['lineDescriptionRequired@terms.costSharing.0.description']);
  });

  it('νέο απαιτούμενο έγγραφο: έγκυρο, χωρίς διπλότυπο είδος, και τέλος όταν ζητούνται όλα', () => {
    const first = newRequiredDocument([]);
    expect(first?.kind).toBe(REQUIRED_DOCUMENT_KINDS[0]);
    expect(codesOf({ ...base, requiredDocuments: first ? [first] : [] })).toEqual([]);
    expect(newRequiredDocument(first ? [first] : [])?.kind).toBe(REQUIRED_DOCUMENT_KINDS[1]);
    expect(newRequiredDocument(REQUIRED_DOCUMENT_KINDS.map((kind) => ({ kind, when: { kind: 'before_each_payment' as const } })))).toBeNull();
  });

  it('νέα ελάχιστη απόδοση ⇒ δείχνει σε γραμμή του εγγράφου, ζητείται μόνο η ποσότητα', () => {
    const output = newMinimumOutput([SAMPLE_LINE], []);
    expect(output).toEqual({ lineId: SAMPLE_LINE.id, milliUnitsPerDay: 0 });
    expect(codesOf({ ...base, minimumOutputs: output ? [output] : [] })).toEqual(['quantityInvalid@terms.minimumOutputs.0']);
    expect(newMinimumOutput([SAMPLE_LINE], output ? [output] : [])).toBeNull();
  });
});
