/**
 * ΑΓΚΥΡΑ — **σταθερό ≠ κινητό**, και η απάντηση ανήκει ΠΑΝΤΑ στο υποσύνολο του κατόχου (ADR-327 §8.5.4, 2026-10-29).
 *
 * Μετρημένο ζωντανά: η σάρωση MACON ATEE γέννησε επαφή με `+30 2310 428900` ως `type: 'mobile'`· και η πρώτη
 * διόρθωση (σταθερό εταιρείας ⇒ `work`) έδινε τιμή που η φόρμα εταιρείας δεν προσφέρει ⇒ κενή λίστα «Τύπος».
 */

/* global describe, it, expect, jest */

import { inferPhoneType } from '../phone-line-type';
import { PHONE_TYPES_BY_OWNER, type PhoneOwnerKind } from '@/lib/contact/phone-type-vocabulary';

jest.mock('server-only', () => ({}));

const OWNERS: readonly PhoneOwnerKind[] = ['individual', 'company', 'service'];
const NUMBERS = [
  '+30 2310 428900', '2101234567', '6971234567', '+30 697 123 4567', '+44 7911 123456', '+39 06 1234 5678',
  '800 11 12345', '+1 202 555 0123', 'όχι αριθμός', '',
] as const;

describe('inferPhoneType', () => {
  it.each([
    ['+30 2310 428900', 'company', 'main'], // MACON ATEE — το περιστατικό
    ['+30 2310 428900', 'individual', 'home'],
    ['2101234567', 'service', 'main'],
    ['6971234567', 'company', 'main'], // εταιρεία: ο άξονας είναι ο ρόλος, όχι κινητό/σταθερό
    ['+30 697 123 4567', 'individual', 'mobile'],
    ['+44 7911 123456', 'individual', 'mobile'],
    ['+39 06 1234 5678', 'individual', 'home'],
    ['800 11 12345', 'individual', 'work'],
  ] as const)('Τ1 — %s (%s) ⇒ %s', (raw, owner, expected) => {
    expect(inferPhoneType(raw, owner)).toBe(expected);
  });

  it('Τ2 — ό,τι η βιβλιοθήκη ΔΕΝ ξεχωρίζει ⇒ η προεπιλογή του κατόχου, ποτέ μαντεψιά', () => {
    expect(inferPhoneType('+1 202 555 0123', 'individual')).toBe('mobile'); // FIXED_LINE_OR_MOBILE
    expect(inferPhoneType('όχι αριθμός', 'individual')).toBe('mobile');
    expect(inferPhoneType('', 'individual')).toBe('mobile');
  });

  it('Τ3 — ΚΛΑΣΗ: για κάθε αριθμό × κάτοχο, η απάντηση ανήκει στο υποσύνολο που η φόρμα του κατόχου προσφέρει', () => {
    for (const owner of OWNERS) {
      for (const raw of NUMBERS) {
        expect(PHONE_TYPES_BY_OWNER[owner]).toContain(inferPhoneType(raw, owner));
      }
    }
  });
});
