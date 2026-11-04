import { validateAgreementLine } from '../validate-agreement-line';
import { duplicateLine, newAgreementLine, newLineStage, nextAgreementLine, optionalText, remainderShare, setLinePricing, shareTotal } from '../line-edits';

describe('line-edits (ADR-928 Φ3γ-2)', () => {
  it('νέα γραμμή: ο επικυρωτής ζητά ΜΟΝΟ την περιγραφή', () => {
    const issues = validateAgreementLine(newAgreementLine('scal_1', 'm2'), 'lines.0');
    expect(issues).toEqual([{ code: 'lineDescriptionRequired', path: 'lines.0.description' }]);
  });

  describe('nextAgreementLine — η νέα γραμμή συνεχίζει την τελευταία ως ζεύγος (μετρημένο στην παραγωγή)', () => {
    const lumpSum = { ...newAgreementLine('scal_1', 'lump'), kind: 'supply' as const, pricing: 'lump_sum' as const, unitPrice: 70_000 };

    it('μετά από κατ\' αποκοπή: κατ\' αποκοπή + ίδια μονάδα — ποτέ «τιμή μονάδας · κ.α.»', () => {
      const next = nextAgreementLine('scal_2', [lumpSum], 'm2');
      expect([next.kind, next.pricing, next.unit, next.estimatedMilliQuantity]).toEqual(['supply', 'lump_sum', 'lump', null]);
    });

    it('μετά από τιμή μονάδας: ίδιο ζεύγος, ποτέ η τιμή ή η περιγραφή της προηγούμενης', () => {
      const unitRate = { ...newAgreementLine('scal_1', 'm2'), description: { el: 'Σοβάς' }, unitPrice: 320, estimatedMilliQuantity: 5_000 };
      const next = nextAgreementLine('scal_2', [lumpSum, unitRate], 'pcs');
      expect(next).toEqual({ ...newAgreementLine('scal_2', 'm2') });
    });

    it('χωρίς γραμμές: η προεπιλογή του καλούντος, τιμή μονάδας', () => {
      expect(nextAgreementLine('scal_1', [], 'm2')).toEqual(newAgreementLine('scal_1', 'm2'));
    });
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
