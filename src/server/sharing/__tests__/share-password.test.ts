/**
 * @jest-environment node
 */

/**
 * Share password hashing (ADR-884 Φ0.12) — scrypt per OWASP, self-describing
 * format, silent upgrade of the pre-Κ4 unsalted SHA-256.
 */

import { createHash, randomBytes, scryptSync } from 'crypto';

import { hashSharePassword, verifySharePassword } from '../share-password';

const legacyHash = (password: string) => createHash('sha256').update(password).digest('hex');

describe('hashSharePassword', () => {
  it('writes the parameters next to the hash: scrypt$1$N,r,p$salt$key', async () => {
    const stored = await hashSharePassword('correct horse');

    expect(stored).toMatch(/^scrypt\$1\$65536,8,2\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]{43}$/);
  });

  it('salts every hash — the same password never produces the same record', async () => {
    const [a, b] = await Promise.all([hashSharePassword('same'), hashSharePassword('same')]);

    expect(a).not.toBe(b);
  });
});

describe('verifySharePassword — current format', () => {
  it('accepts the right password without asking for a rehash', async () => {
    const stored = await hashSharePassword('correct horse');

    await expect(verifySharePassword('correct horse', stored)).resolves.toEqual({ ok: true, needsRehash: false });
  });

  it('refuses a wrong password', async () => {
    const stored = await hashSharePassword('correct horse');

    await expect(verifySharePassword('battery staple', stored)).resolves.toEqual({ ok: false, needsRehash: false });
  });

  it('asks for a rehash when the record was written with older parameters', async () => {
    // A genuinely valid record under weaker, older parameters.
    const salt = randomBytes(16);
    const key = scryptSync('pw', salt, 32, { N: 16384, r: 8, p: 1 });
    const older = `scrypt$1$16384,8,1$${salt.toString('base64url')}$${key.toString('base64url')}`;

    await expect(verifySharePassword('pw', older)).resolves.toEqual({ ok: true, needsRehash: true });
  });
});

describe('verifySharePassword — legacy SHA-256 (pre-Κ4)', () => {
  it('still opens old links, and asks for the upgrade', async () => {
    await expect(verifySharePassword('old secret', legacyHash('old secret')))
      .resolves.toEqual({ ok: true, needsRehash: true });
  });

  it('refuses a wrong password against a legacy hash — and asks for nothing', async () => {
    await expect(verifySharePassword('guess', legacyHash('old secret')))
      .resolves.toEqual({ ok: false, needsRehash: false });
  });
});

describe('verifySharePassword — hostile or broken records', () => {
  it.each([
    ['empty', ''],
    ['unknown algorithm', 'bcrypt$2b$10$abc'],
    ['truncated', 'scrypt$1$65536,8,2$c2FsdA'],
    ['short key', 'scrypt$1$65536,8,2$c2FsdA$c2hvcnQ'],
    // A forged record must not make us burn gigabytes of RAM.
    ['absurd cost', 'scrypt$1$1073741824,8,2$c2FsdA$' + 'A'.repeat(43)],
  ])('refuses %s without throwing', async (_label, stored) => {
    await expect(verifySharePassword('anything', stored)).resolves.toEqual({ ok: false, needsRehash: false });
  });
});
