/**
 * Firestore Rules — `property_handovers` (ADR-916 §5.2 · παράδοση φακέλου από πώληση)
 *
 * Σχήμα κανόνα (firestore.rules):
 *   - read/list: `isInternalUserOfCompany(resource.data.companyId)` — το γραφείο του πωλητή
 *   - create/update/delete: `if false` — γράφει **μόνο** ο διακομιστής (`property-handover-write.service.ts`)
 *
 * 🔴 **Ο πελάτης του γραφείου (`external_user`) ΔΕΝ διαβάζει** — ακόμη κι αν είναι ο ίδιος ο αγοραστής: το
 * έγγραφο κρατά τη σχέση του γραφείου με **όλους** τους συνιδιοκτήτες (ADR-916 Δ10). Ο αγοραστής βλέπει τον
 * **δικό** του φάκελο (`property_dossiers`).
 *
 * @since 2026-10-19 (ADR-916 Φ-Α)
 */

import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';

import { assertCell, type AssertTarget } from '../_harness/assertions';
import { getContext, withSeedContext } from '../_harness/auth-contexts';
import { useDenyAllEmulator } from '../_harness/deny-all-suite';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'property_handovers')!;

const DOC_ID = 'phov-seeded-1';

const handoverPayload = (companyId: string): Record<string, unknown> => ({
  companyId,
  propertyId: 'prop-seed',
  recipientContactId: 'cont-buyer',
  lifecycle: 'awaiting-completion',
  completion: null,
  createdAt: '2026-10-19T10:00:00.000Z',
  updatedAt: '2026-10-19T10:00:00.000Z',
});

describe('property_handovers.rules — διαβάζει το γραφείο του πωλητή, γράφει ΜΟΝΟ ο διακομιστής', () => {
  const env = useDenyAllEmulator();

  const seed = (id: string, companyId: string) =>
    withSeedContext(env(), async (ctx) => {
      await ctx.firestore().collection(COVERAGE.collection).doc(id).set(handoverPayload(companyId));
    });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        await seed(DOC_ID, SAME_TENANT_COMPANY_ID);
        const target: AssertTarget = {
          collection: COVERAGE.collection,
          docId: DOC_ID,
          data: { lifecycle: 'ready' },
          createData: handoverPayload(SAME_TENANT_COMPANY_ID),
          listFilter: { field: 'companyId', op: '==', value: SAME_TENANT_COMPANY_ID },
        };
        await assertCell(getContext(env(), cell.persona), cell, target);
      });
    });
  }

  it('🔴 rules are not filters — η αφιλτράριστη λίστα απορρίπτεται, η φιλτραρισμένη δεν διαρρέει ξένο μισθωτή', async () => {
    await seed(DOC_ID, SAME_TENANT_COMPANY_ID);
    await seed('phov-rival', 'company-b');
    const col = getContext(env(), 'same_tenant_user').firestore().collection(COVERAGE.collection);
    await assertFails(col.get());
    const snap = await assertSucceeds(col.where('companyId', '==', SAME_TENANT_COMPANY_ID).get());
    expect(snap.docs.map((doc) => doc.id)).toEqual([DOC_ID]);
  });

  it('🔴 ούτε ο διαχειριστής του ίδιου μισθωτή γράφει — η παράδοση έχει ΕΝΑΝ γραφέα', async () => {
    await seed(DOC_ID, SAME_TENANT_COMPANY_ID);
    const doc = getContext(env(), 'same_tenant_admin').firestore().collection(COVERAGE.collection).doc(DOC_ID);
    await assertFails(doc.update({ lifecycle: 'ready' }));
  });
});
