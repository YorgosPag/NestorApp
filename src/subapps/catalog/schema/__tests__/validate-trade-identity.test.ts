/**
 * ADR-934 Σ1β — η κρίση της ταυτότητας εμπορίου (ίδια σε οθόνη και γραφέα).
 */
import type { CatalogProductDefinition } from '../../types/product';
import { CATALOG_LIMITS } from '../../vocabulary/catalog-limits';
import { validateTradeIdentity } from '../validate-trade-identity';

const EAN13 = '4006381333931';

const sku = (over: Partial<CatalogProductDefinition> = {}): CatalogProductDefinition => ({
  values: {}, noValueReasons: {}, categoryIds: [], brand: null, modelId: null, familyId: 'fam', gtin: null, mpn: null, noGtinReason: null, ...over,
});
const productIssues = (over: Partial<CatalogProductDefinition>, depth = 0) => validateTradeIdentity({ kind: 'product', holder: sku(over) }, depth);

describe('validateTradeIdentity', () => {
  it('καθαρό: έγκυρο GTIN, μάρκα στο βάθος 0, MPN', () => {
    expect(productIssues({ gtin: EAN13, brand: 'Daikin', mpn: 'FTXM25R' })).toEqual([]);
  });

  it('🔑 ποτέ μαντεμένος κωδικός: λάθος ψηφίο ελέγχου ⇒ gtinInvalid{checkDigit}', () => {
    expect(productIssues({ gtin: '4006381333932' })).toEqual([{ code: 'gtinInvalid', path: 'gtin', params: { reason: 'checkDigit' } }]);
  });

  it('μήκος · μη ψηφία · μη κανονική μορφή (με διαχωριστικά) ⇒ gtinInvalid', () => {
    expect(productIssues({ gtin: '12345' })[0]).toMatchObject({ code: 'gtinInvalid', params: { reason: 'length' } });
    expect(productIssues({ gtin: 'ABC' })[0]).toMatchObject({ code: 'gtinInvalid', params: { reason: 'format' } });
    expect(productIssues({ gtin: '400 6381 333931' })[0]).toMatchObject({ code: 'gtinInvalid', params: { reason: 'format' } });
  });

  it('GTIN ΚΑΙ «χωρίς GTIN» ⇒ noValueConflict (Δ5)', () => {
    expect(productIssues({ gtin: EAN13, noGtinReason: 'notApplicable' })).toEqual([{ code: 'noValueConflict', path: 'noGtinReason' }]);
  });

  it('🔑 Δ1: μάρκα σε παραλλαγή (βάθος ≠ 0) ⇒ valueWrongLevel', () => {
    expect(productIssues({ brand: 'Daikin' }, 1)).toEqual([{ code: 'valueWrongLevel', path: 'brand', params: { level: 0 } }]);
    expect(validateTradeIdentity({ kind: 'productModel', holder: { brand: 'Daikin' } }, 1)).toEqual([{ code: 'valueWrongLevel', path: 'brand', params: { level: 0 } }]);
    expect(validateTradeIdentity({ kind: 'productModel', holder: { brand: 'Daikin' } }, 0)).toEqual([]);
  });

  it('κενά / πάνω από το όριο ⇒ valueEmpty · valueTooLong', () => {
    expect(productIssues({ mpn: '   ' })).toEqual([{ code: 'valueEmpty', path: 'mpn' }]);
    const long = 'x'.repeat(CATALOG_LIMITS.maxBrandLength + 1);
    expect(productIssues({ brand: long })).toEqual([{ code: 'valueTooLong', path: 'brand', params: { max: CATALOG_LIMITS.maxBrandLength } }]);
  });

  it('🔴 παλιό έγγραφο χωρίς τα πεδία ⇒ κανένα εύρημα', () => {
    expect(validateTradeIdentity({ kind: 'product', holder: {} }, 1)).toEqual([]);
  });
});
