/**
 * Firestore Rules — `catalog_pricing_view_signals` (ADR-923 §5.11 «3δ» Ζ · ADR-905 — σήμα ανά όψη τιμών)
 *
 * Σχήμα κανόνα: `get` = ανύπαρκτο **ή** `isInternalUserOfCompany(companyId)` · `list` / γραφή = `if false`
 * (γράφει ΜΟΝΟ η μηχανή του καταλόγου, μέσα στη συναλλαγή της αλλαγής).
 * 🔑 Ο αριθμός είναι ο ΜΟΝΟΣ δρόμος της οθόνης προς τις τιμές που βλέπει ο πελάτης απευθείας — οι 8 συλλογές
 *    τιμολόγησης είναι `deny_all`. Ο αριθμός λέει «άλλαξε κάτι», ποτέ «τι».
 * @since 2026-10-28 (ADR-923 Φ3δ)
 */

import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import { getContext, withSeedContext } from '../_harness/auth-contexts';
import {
  defineServerWrittenTenantCell,
  useServerWrittenTenantEmulator,
  type TenantPayload,
} from '../_harness/server-written-tenant-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'catalog_pricing_view_signals')!;

const SIGNALS = 'catalog_pricing_view_signals';
const payload: TenantPayload = (companyId) => ({ companyId, view: 'lists', revision: 3 });

describe('catalog_pricing_view_signals.rules — ο εσωτερικός του χώρου ακούει, γράφει ΜΟΝΟ η μηχανή', () => {
  const env = useServerWrittenTenantEmulator();
  for (const cell of COVERAGE.matrix) {
    defineServerWrittenTenantCell(env, cell, COVERAGE.collection, payload);
  }

  it('Σ1 — ανύπαρκτο σήμα: ο εσωτερικός ✅ (ο listener ζει πριν από την 1η αύξηση) · ανώνυμος ❌', async () => {
    const missing = 'cpvs_never_written_0001';
    await assertSucceeds(getContext(env(), 'same_tenant_user').firestore().collection(SIGNALS).doc(missing).get());
    await assertFails(getContext(env(), 'anonymous').firestore().collection(SIGNALS).doc(missing).get());
  });

  it('Σ2 — ούτε ο διαχειριστής «αυξάνει» ή πλαστογραφεί σήμα (ψεύτικη ανανέωση = άρνηση υπηρεσίας στις οθόνες των άλλων)', async () => {
    await withSeedContext(env(), async (ctx) => {
      await ctx.firestore().collection(SIGNALS).doc('cpvs_seeded_0001').set(payload(SAME_TENANT_COMPANY_ID));
    });
    const col = getContext(env(), 'same_tenant_admin').firestore().collection(SIGNALS);
    await assertFails(col.doc('cpvs_seeded_0001').update({ revision: 4 }));
    await assertFails(col.doc('cpvs_forged_0001').set(payload(SAME_TENANT_COMPANY_ID)));
    await assertFails(col.where('companyId', '==', SAME_TENANT_COMPANY_ID).get());
  });
});
