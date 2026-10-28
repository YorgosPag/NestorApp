/**
 * ΑΓΚΥΡΑ — **ο ΕΝΑΣ επιλυτής «επαφή του μισθωτή → όνομα»** του ιστορικού (ADR-195 · ADR-327 §8.5 Γ, 2026-10-29).
 *
 * Κρίνεται ό,τι είναι δικό του: ρωτά τον **κριτή μισθωτή** (ξένη ≡ ανύπαρκτη ⇒ `null`, ποτέ όνομα άλλου μισθωτή στο
 * ιστορικό μας), χρησιμοποιεί τον **κανόνα ονόματος** του SSoT (εταιρεία → επωνυμία, πρόσωπο → «Όνομα Επώνυμο»), και
 * δεν γράφει ποτέ `''` ως ετικέτα.
 */

/* global describe, it, expect, beforeEach, jest */

import type { Firestore } from 'firebase-admin/firestore';

import { readOwnedContactDocs } from '@/server/lib/owned-contact-docs';
import { ownedContactNameResolver } from '../owned-contact-name-resolver';

jest.mock('server-only', () => ({}));
jest.mock('@/server/lib/owned-contact-docs', () => ({ readOwnedContactDocs: jest.fn() }));

const readOwned = readOwnedContactDocs as jest.MockedFunction<typeof readOwnedContactDocs>;
const db = {} as Firestore;

const OWNED: Record<string, Record<string, unknown>> = {
  cont_macon: { type: 'company', companyName: 'MACON ATEE', companyId: 'co_a' },
  cont_person: { type: 'individual', firstName: 'Γιώργος', lastName: 'Παπάς', companyId: 'co_a' },
  cont_blank: { type: 'company', companyName: '   ', companyId: 'co_a' },
};

beforeEach(() => {
  readOwned.mockReset();
  readOwned.mockImplementation(async (_db, companyId, ids) =>
    new Map(ids.filter((id) => companyId === 'co_a' && OWNED[id]).map((id) => [id, OWNED[id]] as const)));
});

describe('ownedContactNameResolver', () => {
  it('Ε1 — εταιρεία ⇒ επωνυμία· πρόσωπο ⇒ «Όνομα Επώνυμο» (ο κανόνας του SSoT, όχι μόνο `companyName`)', async () => {
    const resolve = ownedContactNameResolver(db, 'co_a');

    await expect(resolve('cont_macon')).resolves.toBe('MACON ATEE');
    await expect(resolve('cont_person')).resolves.toBe('Γιώργος Παπάς');
  });

  it('Ε2 — ο κριτής μισθωτή ρωτιέται με τον ΔΟΣΜΕΝΟ μισθωτή: ξένη επαφή ⇒ null, ποτέ ξένο όνομα', async () => {
    await expect(ownedContactNameResolver(db, 'co_b')('cont_macon')).resolves.toBeNull();
    expect(readOwned).toHaveBeenCalledWith(db, 'co_b', ['cont_macon']);
  });

  it('Ε3 — ανύπαρκτη ή χωρίς όνομα ⇒ null (ο αναγνώστης πέφτει στην τιμή), ποτέ ετικέτα `\'\'`', async () => {
    const resolve = ownedContactNameResolver(db, 'co_a');

    await expect(resolve('cont_missing')).resolves.toBeNull();
    await expect(resolve('cont_blank')).resolves.toBeNull();
  });

  it('Ε4 — ό,τι δεν είναι μη κενό id ⇒ null ΧΩΡΙΣ ανάγνωση', async () => {
    const resolve = ownedContactNameResolver(db, 'co_a');

    await expect(resolve(null)).resolves.toBeNull();
    await expect(resolve('')).resolves.toBeNull();
    await expect(resolve(42)).resolves.toBeNull();
    expect(readOwned).not.toHaveBeenCalled();
  });
});
