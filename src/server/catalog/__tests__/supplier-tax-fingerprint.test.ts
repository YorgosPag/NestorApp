/**
 * @jest-environment node
 *
 * @fileoverview Άγκυρες του αποτυπώματος ΑΦΜ επιχείρησης — ADR-923 §5.13 Ε1β.
 */

import { createHmac } from 'crypto';

import { supplierTaxFingerprint } from '@/server/catalog/supplier-tax-fingerprint.server';

jest.mock('server-only', () => ({}));

const TAX_ID = '123456783';
const SECRET = 'supplier-test-secret';

describe('supplierTaxFingerprint', () => {
  beforeEach(() => {
    process.env.SUPPLIER_TAX_FINGERPRINT_HMAC_SECRET = SECRET;
    process.env.OWNERSHIP_TAX_ID_HMAC_SECRET = 'ownership-test-secret';
  });

  it('είναι HMAC με το δικό του μυστικό και δεν περιέχει το ΑΦΜ', () => {
    const fingerprint = supplierTaxFingerprint(TAX_ID);
    expect(fingerprint).toBe(createHmac('sha256', SECRET).update(TAX_ID).digest('hex'));
    expect(fingerprint).not.toContain(TAX_ID);
  });

  it('δεν συμπίπτει με το αποτύπωμα του ownership', () => {
    const ownership = createHmac('sha256', 'ownership-test-secret').update(TAX_ID).digest('hex');
    expect(supplierTaxFingerprint(TAX_ID)).not.toBe(ownership);
  });

  it('αγνοεί κενά της γραφής', () => {
    expect(supplierTaxFingerprint('123 456 783')).toBe(supplierTaxFingerprint(TAX_ID));
  });

  it('χωρίς μυστικό ρίχνει', () => {
    delete process.env.SUPPLIER_TAX_FINGERPRINT_HMAC_SECRET;
    expect(() => supplierTaxFingerprint(TAX_ID)).toThrow('SUPPLIER_TAX_FINGERPRINT_HMAC_SECRET');
  });
});
