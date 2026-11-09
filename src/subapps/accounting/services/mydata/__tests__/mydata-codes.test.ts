/**
 * Κωδικοί ΑΑΔΕ — άγκυρα απέναντι στο Παράρτημα §8 του myDATA ERP v2.0.2.
 * Αν αλλάξει η ΑΑΔΕ τον πίνακα, αυτό το test πρέπει να κοκκινίσει **πριν** φύγει λάθος δήλωση.
 */

import {
  MYDATA_COUNTERPART_REQUIRED,
  MYDATA_INVOICE_TYPE_CODES,
  MYDATA_PAYMENT_METHOD_CODES,
  MYDATA_VAT_CATEGORY_ZERO,
  isValidMyDataVatExemption,
  myDataVatCategoryOf,
  myDataWithholdingCategoryOf,
} from '../mydata-codes';

describe('myDATA codes (ΑΑΔΕ v2.0.2 §8)', () => {
  it('§8.1 — τύποι παραστατικών', () => {
    expect(MYDATA_INVOICE_TYPE_CODES).toEqual({
      sales_invoice: '1.1',
      service_invoice: '2.1',
      service_invoice_eu: '2.2',
      service_invoice_3rd: '2.3',
      credit_invoice: '5.1',
      retail_receipt: '11.1',
      service_receipt: '11.2',
    });
  });

  it('οι αποδείξεις λιανικής (11.x) δεν απαιτούν λήπτη· τα τιμολόγια ναι', () => {
    expect(MYDATA_COUNTERPART_REQUIRED.has('retail_receipt')).toBe(false);
    expect(MYDATA_COUNTERPART_REQUIRED.has('service_receipt')).toBe(false);
    expect(MYDATA_COUNTERPART_REQUIRED.has('service_invoice')).toBe(true);
    expect(MYDATA_COUNTERPART_REQUIRED.has('credit_invoice')).toBe(true);
  });

  it('§8.2 — κατηγορίες ΦΠΑ από τον ΕΝΑ πίνακα συντελεστών· 0% = 7, ΟΧΙ 8', () => {
    expect(myDataVatCategoryOf(24)).toBe(1);
    expect(myDataVatCategoryOf(13)).toBe(2);
    expect(myDataVatCategoryOf(6)).toBe(3);
    expect(myDataVatCategoryOf(0)).toBe(MYDATA_VAT_CATEGORY_ZERO);
    expect(MYDATA_VAT_CATEGORY_ZERO).toBe(7);
    expect(myDataVatCategoryOf(23)).toBeNull();
  });

  it('§8.3 — αιτία εξαίρεσης: ακέραιος 1–31', () => {
    expect(isValidMyDataVatExemption(1)).toBe(true);
    expect(isValidMyDataVatExemption(31)).toBe(true);
    expect(isValidMyDataVatExemption(0)).toBe(false);
    expect(isValidMyDataVatExemption(32)).toBe(false);
    expect(isValidMyDataVatExemption(2.5)).toBe(false);
    expect(isValidMyDataVatExemption(null)).toBe(false);
    expect(isValidMyDataVatExemption(undefined)).toBe(false);
  });

  it('§8.4 — παρακράτηση: μόνο το μονοσήμαντο 3% → 4 (Τεχνικά Έργα)· 1% και 20% ανοιχτά', () => {
    expect(myDataWithholdingCategoryOf(3)).toBe(4);
    expect(myDataWithholdingCategoryOf(20)).toBeNull();
    expect(myDataWithholdingCategoryOf(1)).toBeNull();
  });

  it('§8.12 — τρόποι πληρωμής (3 = Μετρητά, ΟΧΙ 1)', () => {
    expect(MYDATA_PAYMENT_METHOD_CODES).toEqual({
      bank_transfer: 1,
      cash: 3,
      check: 4,
      credit: 5,
      card: 7,
      mixed: null,
      non_cash: null,
    });
  });
});
