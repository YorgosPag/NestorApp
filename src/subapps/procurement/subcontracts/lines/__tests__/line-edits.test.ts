import { validateAgreementLine } from '../validate-agreement-line';
import { duplicateLine, newAgreementLine, newLineStage, optionalText, remainderShare, setLinePricing, shareTotal } from '../line-edits';

describe('line-edits (ADR-928 Φ3γ-2)', () => {
  it('νέα γραμμή: ο επικυρωτής ζητά ΜΟΝΟ την περιγραφή', () => {
    const issues = validateAgreementLine(newAgreementLine('scal_1', 'm2'), 'lines.0');
    expect(issues).toEqual([{ code: 'lineDescriptionRequired', path: 'lines.0.description' }]);
  });

  it('διπλασιασμός: νέο id, ίδιο περιεχόμενο', () => {
    const line = { ...newAgreementLine('scal_1', 'm2'), description: { el: 'Σοβάς' }, unitPrice: 900 };
    expect(duplicateLine(line, 'scal_2')).toEqual({ ...line, id: 'scal_2' });
  });

  it('κατ\' αποκοπή ⇒ ποσότητα null ρητά· επιστροφή σε τιμή μονάδας δεν εφευρίσκει ποσότητα', () => {
    const line = { ...newAgreementLine('scal_1', 'm2'), estimatedMilliQuantity: 12_500 };
    const lump = setLinePricing(line, 'lump_sum');
    expect(lump.estimatedMilliQuantity).toBeNull();
    expect(setLinePricing(lump, 'unit_rate').estimatedMilliQuantity).toBeNull();
    expect(setLinePricing(line, 'day_rate').estimatedMilliQuantity).toBe(12_500);
  });

  it.each([
    [[1000, 2000, 4500, 0], 3, 2500],
    [[5000, 0], 1, 5000],
    [[0], 0, 10_000],
    [[6000, 5000, 0], 2, null],
    [[10_000, 0], 1, null],
    [[525.5, 0], 1, null],
  ])('remainderShare(%p, %p) = %p', (shares, index, expected) => {
    expect(remainderShare(shares, index)).toBe(expected);
  });

  it('newLineStage: κλειδί που δεν συγκρούεται, ακόμη και μετά από αφαίρεση', () => {
    const stage = (key: string) => ({ key, label: { el: key }, share: 0 });
    expect(newLineStage([]).key).toBe('stage_1');
    expect(newLineStage([stage('stage_1'), stage('stage_3')]).key).toBe('stage_4');
    expect(newLineStage([stage('stage_2')]).key).toBe('stage_3');
  });

  it('optionalText: κενό σε κάθε γλώσσα ⇒ null', () => {
    expect(optionalText({ el: ' ', en: '' })).toBeNull();
    expect(optionalText({ el: '', en: 'note' })).toEqual({ el: '', en: 'note' });
  });

  it('shareTotal: άθροισμα ή null για άκυρο', () => {
    expect(shareTotal([1000, 2000, 4500, 2500])).toBe(10_000);
    expect(shareTotal([])).toBe(0);
    expect(shareTotal([5000, Number.NaN])).toBeNull();
  });
});
