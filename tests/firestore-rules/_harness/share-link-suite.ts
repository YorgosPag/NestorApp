/**
 * Firestore Rules Test Harness — share-link anchors (ADR-884 Φ0.12)
 *
 * `file_shares` and `shares` share one rule (`allow read, write: if false`) and
 * one history: until 2026-09-25 both were `allow read: if true` with an anonymous
 * counter write. The matrix cells (via `defineDenyAllCell`) prove the rule; the
 * anchors below prove it against a **seeded** document — the exact requests the
 * old rule allowed — because an empty collection denies trivially.
 *
 * Owned once here so the two suites do not become sibling clones (N.18).
 *
 * @module tests/firestore-rules/_harness/share-link-suite
 */

import { assertFails } from '@firebase/rules-unit-testing';

import { getContext } from './auth-contexts';
import type { EnvAccessor } from './deny-all-suite';
import { seedShareLink } from './seed-helpers-dxf';

export function defineShareLinkAnchors(env: EnvAccessor, collection: 'file_shares' | 'shares'): void {
  describe('🔴 the hole that closed (seeded document)', () => {
    beforeEach(async () => {
      await seedShareLink(env(), collection, 'share-seeded');
    });

    it('an ANONYMOUS visitor cannot enumerate the collection (the harvest)', async () => {
      const anonymous = getContext(env(), 'anonymous');

      await assertFails(anonymous.firestore().collection(collection).get());
    });

    it('an ANONYMOUS visitor cannot reset or bump the access counter', async () => {
      const anonymous = getContext(env(), 'anonymous');

      await assertFails(anonymous.firestore().collection(collection).doc('share-seeded').update({ accessCount: 0 }));
    });

    it('not even the OWNING tenant reads the hashes from a client', async () => {
      const owner = getContext(env(), 'same_tenant_admin');

      await assertFails(owner.firestore().collection(collection).doc('share-seeded').get());
    });

    it('not even the OWNING tenant re-activates or extends a link from a client', async () => {
      const owner = getContext(env(), 'same_tenant_admin');

      await assertFails(owner.firestore().collection(collection).doc('share-seeded').update({ isActive: true }));
    });
  });
}
