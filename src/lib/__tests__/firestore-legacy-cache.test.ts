/**
 * ADR-367 §2.5 — καθαρισμός της IndexedDB της παλιάς `persistentLocalCache`.
 *
 * Το όνομα της βάσης είναι ο κανόνας του SDK (`firestore/<app.name>/<projectId>/main`)·
 * αν σβήναμε λάθος όνομα, το test θα ήταν πράσινο ενώ τα δεδομένα θα έμεναν στον δίσκο —
 * γι' αυτό καρφώνεται η ακριβής συμβολοσειρά.
 */

jest.mock('../firebase', () => ({
  __esModule: true,
  default: { name: '[DEFAULT]', options: { projectId: 'nestor-test' } },
}));

import { purgeLegacyFirestoreCache } from '../firestore-legacy-cache';

interface FakeRequest {
  onsuccess: (() => void) | null;
}

function installFakeIndexedDb(): jest.Mock<FakeRequest, [string]> {
  const deleteDatabase = jest.fn<FakeRequest, [string]>(() => ({ onsuccess: null }));
  Object.defineProperty(globalThis, 'indexedDB', {
    value: { deleteDatabase },
    configurable: true,
    writable: true,
  });
  return deleteDatabase;
}

describe('purgeLegacyFirestoreCache', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('σβήνει την ακριβή βάση που δημιουργούσε το SDK', () => {
    const deleteDatabase = installFakeIndexedDb();
    purgeLegacyFirestoreCache();
    expect(deleteDatabase).toHaveBeenCalledWith('firestore/[DEFAULT]/nestor-test/main');
  });

  it('σβήνει τις σημαίες lease του SDK και ΜΟΝΟ αυτές', () => {
    installFakeIndexedDb();
    localStorage.setItem('firestore_zombie_[DEFAULT]_abc', 'x');
    localStorage.setItem('theme-preference', 'dark');
    purgeLegacyFirestoreCache();
    expect(localStorage.getItem('firestore_zombie_[DEFAULT]_abc')).toBeNull();
    expect(localStorage.getItem('theme-preference')).toBe('dark');
  });

  it('σημαία μόνο μετά από επιτυχία — μετά δεν ξανατρέχει', () => {
    const deleteDatabase = installFakeIndexedDb();
    purgeLegacyFirestoreCache();
    purgeLegacyFirestoreCache();
    expect(deleteDatabase).toHaveBeenCalledTimes(2);

    deleteDatabase.mock.results[1].value.onsuccess?.();
    purgeLegacyFirestoreCache();
    expect(deleteDatabase).toHaveBeenCalledTimes(2);
  });
});
