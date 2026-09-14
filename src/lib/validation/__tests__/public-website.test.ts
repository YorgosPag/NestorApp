/**
 * ADR-841 §7 Α21.17 — ο ΕΝΑΣ κριτής «ιστοσελίδα που επιτρέπεται να δει ο κόσμος» (γραφέας + αναγνώστης).
 */

import { MAX_PUBLIC_WEBSITE_LENGTH, normalisePublicWebsite } from '../email-validation';

describe('normalisePublicWebsite', () => {
  it.each([
    ['www.vafes.gr', 'https://www.vafes.gr/'],
    ['  https://vafes.gr/epikoinonia ', 'https://vafes.gr/epikoinonia'],
    ['http://vafes.gr', 'http://vafes.gr/'],
  ])('%s → %s', (raw, expected) => {
    expect(normalisePublicWebsite(raw)).toBe(expected);
  });

  it.each([
    ['javascript:alert(1)', 'σχήμα που εκτελεί κώδικα'],
    ['ftp://vafes.gr', 'σχήμα που δεν είναι ιστοσελίδα'],
    ['https://bank.gr@evil.example', 'διαπιστευτήρια μέσα στο URL (phishing)'],
    ['https://intranet', 'host χωρίς τελεία'],
    ['', 'κενό'],
  ])('🔴 %s ⇒ null (%s)', (raw) => {
    expect(normalisePublicWebsite(raw)).toBeNull();
  });

  it('πάνω από το ταβάνι ⇒ null', () => {
    expect(normalisePublicWebsite(`https://vafes.gr/${'α'.repeat(MAX_PUBLIC_WEBSITE_LENGTH)}`)).toBeNull();
  });
});
