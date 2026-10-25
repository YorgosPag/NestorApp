/**
 * **Διαβάζει ο εσωτερικός χρήστης του μισθωτή, γράφει ΜΟΝΟ ο διακομιστής** — τα κοινά κομμάτια σουίτας για
 * κάθε συλλογή με μήτρα `serverWrittenTenantInternalMatrix()` που δεν χρειάζεται ειδικές άγκυρες.
 *
 * 🔑 Γεννήθηκε με το σχήμα του καταλόγου (ADR-923 §5.9): **πέντε** συλλογές με το ίδιο σύνορο. Πέντε
 * αντιγραμμένες σουίτες θα ήταν ακριβώς οι κλώνοι που μετρά το CHECK 3.28 — ίδιο σκεπτικό με το
 * `author-owned-server-written-suite.ts`.
 *
 * ⚠️ **Ο βρόχος `for (const cell of COVERAGE.matrix)` μένει ΣΤΗ ΣΟΥΙΤΑ**: το CHECK 3.16 τον αναζητά στο αρχείο
 * της σουίτας, ώστε κάθε σουίτα να αποδεικνύει μόνη της ότι εκτελεί τη μήτρα του μητρώου.
 */

import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import type { CoverageCell } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import { assertCell, type AssertTarget } from './assertions';
import { getContext, withSeedContext } from './auth-contexts';
import type { EnvAccessor } from './deny-all-suite';

export { useDenyAllEmulator as useServerWrittenTenantEmulator } from './deny-all-suite';

/** Το περιεχόμενο ενός εγγράφου της συλλογής, για τον δοσμένο μισθωτή. */
export type TenantPayload = (companyId: string) => Record<string, unknown>;

const docIdOf = (collection: string): string => `${collection}-seeded-1`;

function seed(env: EnvAccessor, collection: string, id: string, payload: Record<string, unknown>): Promise<void> {
  return withSeedContext(env(), async (ctx) => {
    await ctx.firestore().collection(collection).doc(id).set(payload);
  });
}

/** Ένα κελί της μήτρας — το έγγραφο ανήκει στον `SAME_TENANT_COMPANY_ID`. */
export function defineServerWrittenTenantCell(
  env: EnvAccessor,
  cell: CoverageCell,
  collection: string,
  payload: TenantPayload,
): void {
  describe(`${cell.persona} × ${cell.operation}`, () => {
    it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
      await seed(env, collection, docIdOf(collection), payload(SAME_TENANT_COMPANY_ID));
      const target: AssertTarget = {
        collection,
        docId: docIdOf(collection),
        data: { revision: 99 },
        createData: payload(SAME_TENANT_COMPANY_ID),
        listFilter: { field: 'companyId', op: '==', value: SAME_TENANT_COMPANY_ID },
      };
      await assertCell(getContext(env(), cell.persona), cell, target);
    });
  });
}

/** Οι δύο άγκυρες που ισχύουν για **κάθε** τέτοια συλλογή. */
export function defineServerWrittenTenantAnchors(env: EnvAccessor, collection: string, payload: TenantPayload): void {
  const docId = docIdOf(collection);

  it('🔴 rules are not filters — η αφιλτράριστη λίστα απορρίπτεται, η φιλτραρισμένη δεν διαρρέει ξένο μισθωτή', async () => {
    await seed(env, collection, docId, payload(SAME_TENANT_COMPANY_ID));
    await seed(env, collection, `${collection}-rival`, payload('company-b'));
    const col = getContext(env(), 'same_tenant_user').firestore().collection(collection);
    await assertFails(col.get());
    const snap = await assertSucceeds(col.where('companyId', '==', SAME_TENANT_COMPANY_ID).get());
    expect(snap.docs.map((doc) => doc.id)).toEqual([docId]);
  });

  it('🔴 ούτε ο διαχειριστής του ίδιου μισθωτή γράφει — η επικύρωση ζει μόνο στον ΕΝΑ γραφέα', async () => {
    await seed(env, collection, docId, payload(SAME_TENANT_COMPANY_ID));
    const col = getContext(env(), 'same_tenant_admin').firestore().collection(collection);
    await assertFails(col.doc(docId).update({ revision: 99 }));
    await assertFails(col.doc(`${collection}-forged`).set(payload(SAME_TENANT_COMPANY_ID)));
    await assertFails(col.doc(docId).delete());
  });
}
