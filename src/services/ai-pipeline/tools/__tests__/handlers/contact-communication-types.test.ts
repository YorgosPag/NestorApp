/**
 * ΑΓΚΥΡΑ — οι χάρτες ετικέτας→τύπου τηλεφώνου του AI μιλούν το λεξιλόγιο που η φόρμα του κατόχου **προσφέρει**
 * (ADR-327 §8.5.4, 2026-10-29). Αλλιώς ο AI γράφει τύπο που η φόρμα δείχνει κενό — το σχήμα της MACON ATEE.
 */

/* global describe, it, expect, jest */

import {
  EMAIL_LABEL_MAPS, PHONE_LABEL_MAPS, WEBSITE_LABEL_MAPS, resolveEmailType, resolvePhoneType, resolveSocialPlatform,
  resolveWebsiteType, resolvedInMap,
} from '../../handlers/contact-communication-types';
import { PHONE_TYPES_BY_OWNER, type PhoneOwnerKind } from '@/lib/contact/phone-type-vocabulary';
import { DEFAULT_EMAIL_TYPE, EMAIL_TYPES_BY_OWNER } from '@/lib/contact/email-type-vocabulary';
import { DEFAULT_WEBSITE_TYPE, WEBSITE_TYPES_BY_OWNER } from '@/lib/contact/website-type-vocabulary';

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

describe('resolveEmailType / resolveWebsiteType — ίδια κλάση (ADR-327 §8.5.4)', () => {
  it('Χ4 — ΚΛΑΣΗ: κάθε τιμή κάθε χάρτη email/ιστοσελίδας ανήκει στο υποσύνολο του κατόχου της', () => {
    for (const owner of OWNERS) {
      for (const type of Object.values(EMAIL_LABEL_MAPS[owner])) expect(EMAIL_TYPES_BY_OWNER[owner]).toContain(type);
      for (const type of Object.values(WEBSITE_LABEL_MAPS[owner])) expect(WEBSITE_TYPES_BY_OWNER[owner]).toContain(type);
    }
  });

  it('Χ5 — γνωστή ετικέτα ⇒ τύπος του κατόχου· άγνωστη ⇒ η προεπιλογή της ΡΙΖΑΣ', () => {
    expect(resolveEmailType('εργασία', 'company')).toBe('general');
    expect(resolveEmailType('πληροφορίες', 'service')).toBe('info');
    expect(resolveWebsiteType('company', 'service')).toBe('official');
    for (const owner of OWNERS) {
      expect(resolveEmailType('άγνωστο', owner)).toBe(DEFAULT_EMAIL_TYPE[owner]);
      expect(resolveWebsiteType('άγνωστο', owner)).toBe(DEFAULT_WEBSITE_TYPE[owner]);
    }
  });

  it('Χ6 — κλειδιά πρωτοτύπου (`constructor`) ΔΕΝ είναι ετικέτες, σε κανέναν χάρτη', () => {
    expect(resolveEmailType('constructor', 'company')).toBe('general');
    expect(resolveWebsiteType('constructor', 'company')).toBe('corporate');
    expect(resolveSocialPlatform('constructor')).toBeUndefined();
    expect(resolvedInMap('constructor', 'company', 'email')).toBe(false);
    expect(resolvedInMap('πωλήσεις', 'company', 'email')).toBe(true);
  });

  it('Χ7 — πλατφόρμες που προσφέρει η φόρμα (tiktok/whatsapp/telegram) ΔΕΝ γίνονται `other`', () => {
    expect(resolveSocialPlatform('tiktok')).toBe('tiktok');
    expect(resolveSocialPlatform('whatsapp')).toBe('whatsapp');
    expect(resolveSocialPlatform('telegram')).toBe('telegram');
  });
});
