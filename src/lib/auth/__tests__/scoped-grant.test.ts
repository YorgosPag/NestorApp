/**
 * @jest-environment node
 */

/**
 * ⚓ ADR-884 Φ0.5 — ο **ένας** έλεγχος «ισχύει ακόμη η άδεια;».
 *
 * 🔴 Φέρουσα περίπτωση: **Firestore `Timestamp`** στο `expiresAt`. Ο παλιός έλεγχος του
 * `checkPermission` έκανε `new Date(Timestamp)` = `Invalid Date`, και η σύγκριση με NaN είναι πάντα
 * ψευδής ⇒ το grant **δεν έληγε ποτέ**. Μετάλλαξη του κριτή πίσω σε `new Date(x) < now` κοκκινίζει εδώ.
 */

import { Timestamp } from 'firebase-admin/firestore';

import { evaluateScopedGrant, type ScopedGrant } from '../scoped-grant';

type Scope = 'tour:capture:upload' | 'unit:read_basic';

const NOW = Date.parse('2026-09-25T12:00:00.000Z');
const HOUR = 3_600_000;

const grant = (overrides: Partial<ScopedGrant<Scope>> = {}): ScopedGrant<Scope> => ({
  scopes: ['tour:capture:upload'],
  expiresAt: new Date(NOW + HOUR),
  ...overrides,
});

describe('evaluateScopedGrant', () => {
  it('✅ δίνει άδεια όταν δεν έληξε, δεν ανακλήθηκε και καλύπτει το εύρος', () => {
    expect(evaluateScopedGrant(grant(), 'tour:capture:upload', NOW)).toBe('granted');
  });

  it.each([
    ['Firestore Timestamp', Timestamp.fromMillis(NOW - HOUR)],
    ['Date', new Date(NOW - HOUR)],
    ['ISO string', new Date(NOW - HOUR).toISOString()],
    ['σειριοποιημένο Timestamp', { _seconds: (NOW - HOUR) / 1000, _nanoseconds: 0 }],
  ])('🔴 αρνείται ληγμένη άδεια όταν η λήξη είναι %s', (_label, expiresAt) => {
    expect(evaluateScopedGrant(grant({ expiresAt }), 'tour:capture:upload', NOW)).toBe('expired');
  });

  it('✅ διαβάζει ΜΕΛΛΟΝΤΙΚΟ Timestamp ως ενεργό (μάρτυρας: ο κριτής όντως διαβάζει Timestamp)', () => {
    const expiresAt = Timestamp.fromMillis(NOW + HOUR);
    expect(evaluateScopedGrant(grant({ expiresAt }), 'tour:capture:upload', NOW)).toBe('granted');
  });

  it('🔴 η λήξη ΑΚΡΙΒΩΣ τώρα είναι λήξη', () => {
    expect(evaluateScopedGrant(grant({ expiresAt: new Date(NOW) }), 'tour:capture:upload', NOW)).toBe('expired');
  });

  it.each([['άκυρο string', 'όχι-ημερομηνία'], ['απουσία', undefined], ['null', null]])(
    '🔴 αρνείται λήξη που ΔΕΝ διαβάζεται (%s) — fail-closed, με δικό της όνομα',
    (_label, expiresAt) => {
      expect(evaluateScopedGrant(grant({ expiresAt }), 'tour:capture:upload', NOW)).toBe('unreadable-expiry');
    },
  );

  it('🔴 η ανάκληση προηγείται της λήξης — λέμε αυτό που ΕΚΑΝΕ κάποιος', () => {
    const revoked = grant({ expiresAt: new Date(NOW - HOUR), revokedAt: Timestamp.fromMillis(NOW - 2 * HOUR) });
    expect(evaluateScopedGrant(revoked, 'tour:capture:upload', NOW)).toBe('revoked');
  });

  it('🔴 αρνείται εύρος που δεν δόθηκε', () => {
    expect(evaluateScopedGrant(grant(), 'unit:read_basic', NOW)).toBe('scope-missing');
  });
});
