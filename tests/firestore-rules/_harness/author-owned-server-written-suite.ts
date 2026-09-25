/**
 * **Ο κάτοχος διαβάζει, γράφει ΜΟΝΟ ο διακομιστής** — τα κοινά κομμάτια σουίτας για κάθε
 * συλλογή με μήτρα `serverWrittenAuthorOwnedMatrix()` που δεν χρειάζεται ειδικές άγκυρες.
 *
 * 🔑 Γεννήθηκε με το ημερολόγιο καταλύματος (ADR-835 §20): **τρεις** συλλογές με το ίδιο
 * σύνορο. Τρεις αντιγραμμένες σουίτες θα ήταν ακριβώς οι κλώνοι που μετρά το CHECK 3.28.
 *
 * ⚠️ **Ο βρόχος `for (const cell of COVERAGE.matrix)` μένει ΣΤΗ ΣΟΥΙΤΑ**, όπως στο
 * `deny-all-suite.ts`: το CHECK 3.16 τον αναζητά στο αρχείο της σουίτας, ώστε κάθε σουίτα να
 * αποδεικνύει μόνη της ότι εκτελεί τη μήτρα του μητρώου.
 *
 * ⚠️ Δεν αντικαθιστά τη σουίτα του `owner_properties`: εκείνη έχει άγκυρες **περιεχομένου**.
 */

import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import type { CoverageCell } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS } from '../_registry/personas';
import { assertCell, type AssertTarget } from './assertions';
import { getContext, withSeedContext } from './auth-contexts';
import type { EnvAccessor } from './deny-all-suite';

export { useDenyAllEmulator as useAuthorOwnedEmulator } from './deny-all-suite';

export type AuthorOwnedPayload = (authorUserId: string) => Record<string, unknown>;

/**
 * Το πεδίο κατόχου που ρωτά ο κανόνας. `authorUserId` για τις αγγελίες και τα παράγωγά τους· `userId` για τα
 * διαμερίσματα `*_personal` (`CustodyScope`, ADR-884 Φ0.9). Το ίδιο πεδίο οδηγεί το φίλτρο της λίστας.
 */
export type OwnerField = 'authorUserId' | 'userId';

const OWNER_UID = PERSONA_CLAIMS.same_tenant_user.uid;

const docIdOf = (collection: string): string => `${collection}-owned-1`;

function seed(env: EnvAccessor, collection: string, id: string, payload: Record<string, unknown>): Promise<void> {
  return withSeedContext(env(), async (ctx) => {
    await ctx.firestore().collection(collection).doc(id).set(payload);
  });
}

/** Ένα κελί της μήτρας — ο συντάκτης είναι ο `same_tenant_user`. */
export function defineAuthorOwnedCell(
  env: EnvAccessor,
  cell: CoverageCell,
  collection: string,
  payload: AuthorOwnedPayload,
  ownerField: OwnerField = 'authorUserId',
): void {
  describe(`${cell.persona} × ${cell.operation}`, () => {
    it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
      await seed(env, collection, docIdOf(collection), payload(OWNER_UID));
      const target: AssertTarget = {
        collection,
        docId: docIdOf(collection),
        data: { updatedAt: '2030-01-01T00:00:00.000Z' },
        createData: payload(OWNER_UID),
        listFilter: { field: ownerField, op: '==', value: OWNER_UID },
      };
      await assertCell(getContext(env(), cell.persona), cell, target);
    });
  });
}

/** Οι δύο άγκυρες που ισχύουν για **κάθε** τέτοια συλλογή. */
export function defineAuthorOwnedAnchors(
  env: EnvAccessor,
  collection: string,
  payload: AuthorOwnedPayload,
  ownerField: OwnerField = 'authorUserId',
): void {
  const docId = docIdOf(collection);

  it('🔴 ούτε ο ΙΔΙΟΣ ο συντάκτης γράφει — ο κριτής κατάληψης τρέχει μόνο στον διακομιστή', async () => {
    await seed(env, collection, docId, payload(OWNER_UID));
    const owner = getContext(env(), 'same_tenant_user').firestore().collection(collection);
    await assertFails(owner.doc(`${collection}-self`).set(payload(OWNER_UID)));
    await assertFails(owner.doc(docId).update({ updatedAt: '2030-01-01T00:00:00.000Z' }));
    await assertFails(owner.doc(docId).delete());
  });

  it('🔴 η αφιλτράριστη λίστα απορρίπτεται, και το φιλτραρισμένο ερώτημα δεν διαρρέει τρίτους', async () => {
    await seed(env, collection, docId, payload(OWNER_UID));
    await seed(env, collection, `${collection}-other`, payload(PERSONA_CLAIMS.cross_tenant_user.uid));
    const owner = getContext(env(), 'same_tenant_user').firestore().collection(collection);
    await assertFails(owner.get());
    const snap = await assertSucceeds(owner.where(ownerField, '==', OWNER_UID).get());
    expect(snap.docs.map((doc) => doc.id)).toEqual([docId]);
  });
}
