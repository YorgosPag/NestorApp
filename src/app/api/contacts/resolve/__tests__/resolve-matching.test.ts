/**
 * @fileoverview Ταίριασμα προμηθευτή σε υπάρχουσα επαφή (`/api/contacts/resolve`, ADR-327 §8.5 Γ).
 *
 * Κ1 email: ντετερμινιστικό, χωρίς κεφαλαία/κενά, σε `emails[]` ΚΑΙ στο legacy `email` · κενή λίστα ⇒ κανένα ·
 * Κ2 όνομα: ελληνικά/λατινικά, χωρίς νομική μορφή — ξένο όνομα δεν ταιριάζει.
 */

jest.mock('server-only', () => ({}));
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: jest.fn(), FieldValue: {} }));
jest.mock('@/services/entity-audit.service', () => ({ EntityAuditService: { recordChange: jest.fn() } }));
jest.mock('@/services/banking/bank-accounts-server.service', () => ({ BankAccountsServerService: {} }));

import { findContactByEmail, findContactByName, normalizeVat } from '../resolve-helpers';

const CONTACTS = [
  { id: 'c1', displayName: 'Τσιμέντα Βορείου ΑΕ', emails: [{ email: 'sales@tsimenta.gr' }] },
  { id: 'c2', displayName: 'Παλιά Επαφή', email: 'Old@Legacy.gr' },
  { id: 'c3', displayName: 'Άλλος Προμηθευτής' },
];

describe('findContactByEmail', () => {
  it('Κ1 — emails[] και legacy email, χωρίς κεφαλαία/κενά', () => {
    expect(findContactByEmail(CONTACTS, ['sales@tsimenta.gr'])?.id).toBe('c1');
    expect(findContactByEmail(CONTACTS, ['old@legacy.gr'])?.id).toBe('c2');
    expect(findContactByEmail(CONTACTS, ['nobody@x.gr'])).toBeUndefined();
    expect(findContactByEmail(CONTACTS, [])).toBeUndefined();
  });
});

describe('findContactByName', () => {
  it('Κ2 — ίδιο όνομα χωρίς νομική μορφή · ξένο όνομα όχι', () => {
    expect(findContactByName(CONTACTS, 'Τσιμέντα Βορείου')?.id).toBe('c1');
    expect(findContactByName(CONTACTS, 'Εντελώς Διαφορετικό')).toBeUndefined();
  });
});

describe('normalizeVat', () => {
  // ADR-327 (2026-10-28): σαρώσεις αποθήκευσαν το ΚΕΙΜΕΝΟ «null» ως ΑΦΜ — δεν είναι κλειδί ταύτισης.
  it('🔴 Α1 — «null» / «N/A» / «—» ως κείμενο ⇒ κανένας ΑΦΜ (δεν ταιριάζει, δεν γράφεται)', () => {
    for (const absent of ['null', 'NULL', 'N/A', '—', '  ']) expect(normalizeVat(absent)).toBe('');
  });

  it('Α2 — πραγματικός ΑΦΜ: χωρίς κενά, χωρίς πρόθεμα BG', () => {
    expect(normalizeVat(' 094 019 245 ')).toBe('094019245');
    expect(normalizeVat('BG123456789')).toBe('123456789');
  });
});
