/**
 * @jest-environment node
 */

/**
 * Share token grammar (ADR-884 Φ0.12) — generation, fingerprint, cheap rejection.
 */

import {
  generateShareToken,
  hashShareToken,
  isPlausibleShareToken,
  SHARE_TOKEN_BYTES,
} from '../share-token';

describe('generateShareToken', () => {
  it('carries 256 bits as 43 base64url characters, no padding', () => {
    const token = generateShareToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, 'base64url')).toHaveLength(SHARE_TOKEN_BYTES);
  });

  it('never repeats across a thousand draws', () => {
    const seen = new Set(Array.from({ length: 1000 }, generateShareToken));

    expect(seen.size).toBe(1000);
  });

  it('is itself a plausible token (the lookup would not reject our own links)', () => {
    expect(isPlausibleShareToken(generateShareToken())).toBe(true);
  });
});

describe('hashShareToken', () => {
  it('is SHA-256 hex — the same fingerprint the migration and the lookup compute', async () => {
    // SHA-256("abc"), FIPS 180-2 test vector.
    expect(await hashShareToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('never equals the token it fingerprints', async () => {
    const token = generateShareToken();

    expect(await hashShareToken(token)).not.toBe(token);
  });
});

describe('isPlausibleShareToken', () => {
  it('accepts both generations: legacy 32 alphanumerics and new 43 base64url', () => {
    expect(isPlausibleShareToken('A'.repeat(32))).toBe(true);
    expect(isPlausibleShareToken(`${'a'.repeat(40)}-_Z`)).toBe(true);
  });

  it.each([
    ['too short', 'abc'],
    ['path traversal', '../../etc/passwd-aaaaaaaaaaaaaaaaaaaa'],
    ['whitespace', `${'a'.repeat(30)} x`],
    ['too long', 'a'.repeat(129)],
  ])('rejects %s before any database read', (_label, candidate) => {
    expect(isPlausibleShareToken(candidate)).toBe(false);
  });

  it('rejects non-strings', () => {
    expect(isPlausibleShareToken(undefined)).toBe(false);
    expect(isPlausibleShareToken(42)).toBe(false);
  });
});
