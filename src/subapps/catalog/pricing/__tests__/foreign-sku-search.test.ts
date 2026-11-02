/**
 * Η γραμμή αποτελέσματος στον επιλογέα του αγοραστή (ADR-923 §5.12).
 */

import { foreignSkuRowOf, foreignSkuRowText } from '../foreign-sku-search';

describe('foreignSkuRowText', () => {
  it('🔴 ετικέτα ίση με τον κωδικό γράφεται μία φορά', () => {
    expect(foreignSkuRowText({ code: '099-01-002', label: '099-01-002' })).toBe('099-01-002');
  });

  it('διαφορετική ετικέτα: κωδικός και όνομα', () => {
    expect(foreignSkuRowText({ code: 'FC-100', label: 'Fan coil' })).toBe('FC-100 — Fan coil');
  });

  it('όποιο λείπει παραλείπεται', () => {
    expect(foreignSkuRowText({ code: null, label: 'Fan coil' })).toBe('Fan coil');
    expect(foreignSkuRowText({ code: 'FC-100', label: null })).toBe('FC-100');
  });
});

describe('foreignSkuRowOf', () => {
  const sku = { id: 'cprod_1', derived: { label: 'Όνομα', identifier: 'FC-100', searchText: 'εσωτερικη σημειωση' } };

  it('🔴 το κείμενο του ευρετηρίου δεν περνά στη γραμμή', () => {
    expect(foreignSkuRowOf(sku, 'visible')).toEqual({ variantId: 'cprod_1', code: 'FC-100', label: 'Όνομα', priced: true });
  });

  it('🔴 κρυφό δεν γίνεται γραμμή', () => {
    expect(foreignSkuRowOf(sku, 'hidden')).toBeNull();
  });
});
