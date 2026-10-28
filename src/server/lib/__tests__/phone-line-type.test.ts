/**
 * ΑΓΚΥΡΑ — **σταθερό ≠ κινητό** (ADR-327 §8.5.4, 2026-10-29).
 *
 * Μετρημένο ζωντανά: η σάρωση MACON ATEE γέννησε επαφή με `+30 2310 428900` ως `type: 'mobile'`. Ο τύπος έρχεται
 * πλέον από τα metadata του αριθμού (libphonenumber, `/max`) — ΟΧΙ από πρόθεμα, που έχανε `+30 2…` και κάθε ξένο.
 */

/* global describe, it, expect, jest */

import { inferPhoneType, phoneOwnerKindOf } from '../phone-line-type';

jest.mock('server-only', () => ({}));

describe('inferPhoneType', () => {
  it.each([
    ['+30 2310 428900', 'company', 'work'],
    ['+30 2310 428900', 'individual', 'home'],
    ['2101234567', 'service', 'work'],
    ['6971234567', 'company', 'mobile'],
    ['+30 697 123 4567', 'individual', 'mobile'],
    ['+44 7911 123456', 'individual', 'mobile'],
    ['+39 06 1234 5678', 'company', 'work'],
    ['800 11 12345', 'individual', 'work'],
  ] as const)('Τ1 — %s (%s) ⇒ %s', (raw, owner, expected) => {
    expect(inferPhoneType(raw, owner, 'mobile')).toBe(expected);
  });

  it('Τ2 — ό,τι η βιβλιοθήκη ΔΕΝ ξεχωρίζει ⇒ η προεπιλογή του καλούντος, ποτέ μαντεψιά', () => {
    expect(inferPhoneType('+1 202 555 0123', 'company', 'mobile')).toBe('mobile'); // FIXED_LINE_OR_MOBILE
    expect(inferPhoneType('όχι αριθμός', 'company', 'work')).toBe('work');
    expect(inferPhoneType('', 'individual', 'mobile')).toBe('mobile');
  });
});

describe('phoneOwnerKindOf', () => {
  it('Τ3 — εταιρεία/υπηρεσία όπως είναι· ό,τι άλλο ⇒ πρόσωπο', () => {
    expect(phoneOwnerKindOf('company')).toBe('company');
    expect(phoneOwnerKindOf('service')).toBe('service');
    expect(phoneOwnerKindOf('individual')).toBe('individual');
    expect(phoneOwnerKindOf(undefined)).toBe('individual');
    expect(phoneOwnerKindOf('weird')).toBe('individual');
  });
});
