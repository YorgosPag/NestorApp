/**
 * Tests — PKCE (S256) + κανονικοποίηση resource URI (ADR-738)
 *
 * Οι δύο μαζί επειδή είναι το ίδιο ερώτημα από δύο πλευρές: **ταυτίζεται αυτό
 * που παρουσιάζει ο client με αυτό που περιμένουμε;** — για το μυστικό (PKCE)
 * και για το ακροατήριο (RFC 8707).
 */

import { createHash } from 'node:crypto';

import {
  isWellFormedS256Challenge,
  verifyPkceS256,
} from '../oauth-authorization-code';
import { canonicalizeResourceUri, isSupportedScope, SUPPORTED_SCOPES } from '../oauth-config';

jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: jest.fn() }));

const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';

function challengeFor(verifier: string): string {
  return createHash('sha256').update(verifier, 'ascii').digest('base64url');
}

describe('verifyPkceS256', () => {
  it('δέχεται σωστό verifier', () => {
    expect(verifyPkceS256(VERIFIER, challengeFor(VERIFIER))).toBe(true);
  });

  it('απορρίπτει λάθος verifier', () => {
    expect(verifyPkceS256('x'.repeat(43), challengeFor(VERIFIER))).toBe(false);
  });

  it('απορρίπτει verifier εκτός ορίων μήκους του RFC 7636', () => {
    expect(verifyPkceS256('a'.repeat(42), challengeFor('a'.repeat(42)))).toBe(false);
    expect(verifyPkceS256('a'.repeat(129), challengeFor('a'.repeat(129)))).toBe(false);
  });

  it('δέχεται στα ακριβή όρια 43 και 128', () => {
    const short = 'a'.repeat(43);
    const long = 'a'.repeat(128);
    expect(verifyPkceS256(short, challengeFor(short))).toBe(true);
    expect(verifyPkceS256(long, challengeFor(long))).toBe(true);
  });

  it('απορρίπτει challenge σε base64 ΜΕ padding', () => {
    // Το RFC 7636 ορίζει base64url ΧΩΡΙΣ `=`. Ένα challenge με padding δεν
    // ταιριάζει — και δεν πρέπει να «διορθωθεί» με χαλάρωση της σύγκρισης.
    const padded = createHash('sha256').update(VERIFIER, 'ascii').digest('base64');
    expect(verifyPkceS256(VERIFIER, padded)).toBe(false);
  });

  it('ΔΕΝ δέχεται plain (verifier === challenge)', () => {
    // Στο `plain` ο verifier ταξιδεύει αυτούσιος: όποιος βλέπει τον code βλέπει
    // και τον verifier, δηλαδή το μέτρο ακυρώνει τον εαυτό του.
    expect(verifyPkceS256(VERIFIER, VERIFIER)).toBe(false);
  });
});

describe('isWellFormedS256Challenge', () => {
  it('δέχεται 43 χαρακτήρες base64url', () => {
    expect(isWellFormedS256Challenge(challengeFor(VERIFIER))).toBe(true);
  });

  it.each([
    ['a'.repeat(42), 'πολύ κοντό'],
    ['a'.repeat(44), 'πολύ μακρύ'],
    [`${'a'.repeat(42)}+`, 'χαρακτήρας base64 αντί base64url'],
    [`${'a'.repeat(42)}/`, 'χαρακτήρας base64 αντί base64url'],
    [`${'a'.repeat(42)}=`, 'padding'],
  ])('απορρίπτει %s (%s)', (challenge) => {
    expect(isWellFormedS256Challenge(challenge)).toBe(false);
  });
});

describe('canonicalizeResourceUri', () => {
  it('πεζοποιεί scheme και host', () => {
    expect(canonicalizeResourceUri('HTTPS://Nestor.EXAMPLE/api/mcp')).toBe(
      'https://nestor.example/api/mcp',
    );
  });

  it('αφαιρεί trailing slash', () => {
    expect(canonicalizeResourceUri('https://nestor.example/api/mcp/')).toBe(
      'https://nestor.example/api/mcp',
    );
  });

  it('κρατά το port', () => {
    expect(canonicalizeResourceUri('https://nestor.example:8443/api/mcp')).toBe(
      'https://nestor.example:8443/api/mcp',
    );
  });

  it('απορρίπτει URI με fragment (άκυρο κατά RFC 8707)', () => {
    expect(canonicalizeResourceUri('https://nestor.example/api/mcp#x')).toBeNull();
  });

  it('απορρίπτει URI χωρίς scheme', () => {
    expect(canonicalizeResourceUri('nestor.example/api/mcp')).toBeNull();
  });
});

describe('scopes', () => {
  it('υποστηρίζεται μόνο το boq:read', () => {
    expect([...SUPPORTED_SCOPES]).toEqual(['boq:read']);
  });

  it('boq:write ΔΕΝ είναι υποστηριζόμενο (Φάση 4)', () => {
    // Ένα scope που δεν αντιστοιχεί σε τίποτα εκτελέσιμο θα ζητούσε από τον
    // χρήστη να εγκρίνει εξουσία που δεν υπάρχει.
    expect(isSupportedScope('boq:write')).toBe(false);
  });
});
