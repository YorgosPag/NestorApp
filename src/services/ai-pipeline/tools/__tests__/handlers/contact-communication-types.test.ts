/**
 * ΑΓΚΥΡΑ — οι χάρτες ετικέτας→τύπου τηλεφώνου του AI μιλούν το λεξιλόγιο που η φόρμα του κατόχου **προσφέρει**
 * (ADR-327 §8.5.4, 2026-10-29). Αλλιώς ο AI γράφει τύπο που η φόρμα δείχνει κενό — το σχήμα της MACON ATEE.
 */

/* global describe, it, expect, jest */

import { PHONE_LABEL_MAPS, resolvePhoneType } from '../../handlers/contact-communication-types';
import { PHONE_TYPES_BY_OWNER, type PhoneOwnerKind } from '@/lib/contact/phone-type-vocabulary';

jest.mock('server-only', () => ({}));

const OWNERS: readonly PhoneOwnerKind[] = ['individual', 'company', 'service'];

describe('resolvePhoneType', () => {
  it('Χ1 — ΚΛΑΣΗ: κάθε τιμή κάθε χάρτη ανήκει στο υποσύνολο του κατόχου της', () => {
    for (const owner of OWNERS) {
      for (const type of Object.values(PHONE_LABEL_MAPS[owner])) {
        expect(PHONE_TYPES_BY_OWNER[owner]).toContain(type);
      }
    }
  });

  it('Χ2 — χωρίς γνωστή ετικέτα ⇒ το SSoT συναγωγής: εταιρεία ⇒ `main`, πρόσωπο ⇒ από τον αριθμό', () => {
    expect(resolvePhoneType('', 'company', '+30 2310 428900')).toBe('main');
    expect(resolvePhoneType('', 'individual', '+30 2310 428900')).toBe('home');
    expect(resolvePhoneType('εργασία', 'company', '6971234567')).toBe('main');
    expect(resolvePhoneType('πωλήσεις', 'company', '')).toBe('sales');
  });

  it('Χ3 — κλειδιά πρωτοτύπου (`constructor`) ΔΕΝ είναι ετικέτες', () => {
    expect(resolvePhoneType('constructor', 'company', '')).toBe('main');
  });
});
