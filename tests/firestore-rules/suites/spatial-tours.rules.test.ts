/**
 * Firestore Rules — `spatial_tours` (ADR-884 Φ0.9 · εταιρικό διαμέρισμα)
 *
 * Σχήμα κανόνα (firestore.rules):
 *   - read/list: `isInternalUserOfCompany(resource.data.companyId)` — ο ζωντανός επεξεργαστής του γραφείου
 *   - create/update/delete: `if false` — γράφει **μόνο** ο διακομιστής (`server/spatial-tour/*`)
 *   - υποσυλλογές: λήψεις = ίδιος αναγνώστης (μέσω `get()` γονέα)· αιτήματα θέασης / άδειες λήψης = κανείς
 *
 * 🔴 **Ο πελάτης του γραφείου (`external_user`) ΔΕΝ διαβάζει**: το «ποιος βλέπει» μιας περιήγησης είναι
 * απόφαση ορατότητας (δημόσια · αίτημα · σύνδεσμος) που επιβάλλει ο διακομιστής — ένα `belongsToCompany`
 * εδώ θα την παρέκαμπτε για κάθε πελάτη του γραφείου.
 *
 * @since 2026-09-25 (ADR-884 Κ2α)
 */

import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';

import { assertCell, type AssertTarget } from '../_harness/assertions';
import { getContext, withSeedContext } from '../_harness/auth-contexts';
import { useDenyAllEmulator } from '../_harness/deny-all-suite';
import { defineSpatialTourSubcollectionAnchors } from '../_harness/spatial-tour-subcollections';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'spatial_tours')!;

const DOC_ID = 'stour-seeded-1';

const tourPayload = (companyId: string): Record<string, unknown> => ({
  companyId,
  subject: { kind: 'company-property', id: 'prop-seed' },
  visibility: 'on-request',
  lifecycle: 'draft',
  levels: [],
  nodes: [],
  revision: 0,
  createdBy: PERSONA_CLAIMS.same_tenant_user.uid,
  createdAt: '2026-09-25T10:00:00.000Z',
  updatedBy: PERSONA_CLAIMS.same_tenant_user.uid,
  updatedAt: '2026-09-25T10:00:00.000Z',
});

describe('spatial_tours.rules — διαβάζει ο εσωτερικός χρήστης του μισθωτή, γράφει ΜΟΝΟ ο διακομιστής', () => {
  const env = useDenyAllEmulator();

  const seed = (id: string, companyId: string) =>
    withSeedContext(env(), async (ctx) => {
      await ctx.firestore().collection(COVERAGE.collection).doc(id).set(tourPayload(companyId));
    });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        await seed(DOC_ID, SAME_TENANT_COMPANY_ID);
        const target: AssertTarget = {
          collection: COVERAGE.collection,
          docId: DOC_ID,
          data: { visibility: 'public' },
          createData: tourPayload(SAME_TENANT_COMPANY_ID),
          listFilter: { field: 'companyId', op: '==', value: SAME_TENANT_COMPANY_ID },
        };
        await assertCell(getContext(env(), cell.persona), cell, target);
      });
    });
  }

  it('🔴 rules are not filters — η αφιλτράριστη λίστα απορρίπτεται, η φιλτραρισμένη δεν διαρρέει ξένο μισθωτή', async () => {
    await seed(DOC_ID, SAME_TENANT_COMPANY_ID);
    await seed('stour-rival', 'company-b');
    const col = getContext(env(), 'same_tenant_user').firestore().collection(COVERAGE.collection);
    await assertFails(col.get());
    const snap = await assertSucceeds(col.where('companyId', '==', SAME_TENANT_COMPANY_ID).get());
    expect(snap.docs.map((doc) => doc.id)).toEqual([DOC_ID]);
  });

  defineSpatialTourSubcollectionAnchors(env, {
    collection: 'spatial_tours',
    tourDoc: tourPayload(SAME_TENANT_COMPANY_ID),
    reader: 'same_tenant_user',
    outsiders: ['external_user', 'cross_tenant_admin', 'cross_tenant_user', 'anonymous'],
  });
});
