/**
 * ADR-915 §45.15 — οι αναγνώστες ωμού εγγράφου επαφής: κύριο τηλέφωνο (ίδια σειρά με το `getPrimaryPhone`) και ΑΦΜ
 * (`vatNumber`, αλλιώς το παλιό `taxNumber`). Συνθετικά δεδομένα.
 */

jest.mock('server-only', () => ({}));

import { extractContactPrimaryPhone, extractContactVatNumber } from '@/server/lib/contact-doc-fields';

describe('extractContactPrimaryPhone', () => {
  it('το σημειωμένο κύριο κερδίζει το πρώτο', () => {
    expect(extractContactPrimaryPhone({ phones: [{ number: '2101111111' }, { number: '6900000000', isPrimary: true }] })).toBe('6900000000');
  });

  it('χωρίς κύριο ⇒ το πρώτο με αριθμό· κενά αγνοούνται', () => {
    expect(extractContactPrimaryPhone({ phones: [{ number: '  ' }, { number: ' 2102222222 ' }] })).toBe('2102222222');
  });

  it('χωρίς λίστα ⇒ τα παλιά πεδία υπηρεσίας, με τη σειρά τους', () => {
    expect(extractContactPrimaryPhone({ telephone: '2103333333', centralPhone: '2104444444' })).toBe('2103333333');
  });

  it('τίποτα ⇒ `null`, ποτέ κενό', () => {
    expect(extractContactPrimaryPhone({ phones: [] })).toBeNull();
  });
});

describe('extractContactVatNumber', () => {
  it('`vatNumber` πρώτα, αλλιώς το παλιό `taxNumber`, αλλιώς `null`', () => {
    expect(extractContactVatNumber({ vatNumber: ' 090000045 ', taxNumber: '111111111' })).toBe('090000045');
    expect(extractContactVatNumber({ taxNumber: '111111111' })).toBe('111111111');
    expect(extractContactVatNumber({ vatNumber: '' })).toBeNull();
  });
});
