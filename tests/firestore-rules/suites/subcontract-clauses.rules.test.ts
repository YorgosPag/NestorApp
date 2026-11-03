/**
 * Firestore Rules — `subcontract_clauses` + υποσυλλογή `subcontract_clause_versions` (ADR-928 §5.2 · βιβλιοθήκη ρητρών)
 *
 * Σχήμα κανόνα: read = `isInternalUserOfCompany(companyId)` · write = `if false` (μόνο `src/server/subcontracts/**`).
 * Η υποσυλλογή των εκδόσεων είναι ένθετη (εκτός μήτρας του CHECK 3.16)· την ελέγχουν οι ΙΔΙΕΣ άγκυρες πάνω στη
 * διαδρομή της — αλλιώς ένας κανόνας που θα ξεχνούσε το μπλοκ `versions` θα έμενε πράσινος.
 * @since 2026-11-03 (ADR-928 Φ1)
 */

import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { CROSS_TENANT_COMPANY_ID, SAME_TENANT_COMPANY_ID, type Persona } from '../_registry/personas';
import { getContext, withSeedContext } from '../_harness/auth-contexts';
import {
  defineServerWrittenTenantAnchors,
  defineServerWrittenTenantCell,
  useServerWrittenTenantEmulator,
  type TenantPayload,
} from '../_harness/server-written-tenant-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'subcontract_clauses')!;

const VERSIONS_PATH = 'subcontract_clauses/sccl_seed/subcontract_clause_versions';
const VERSION_ID = 'sccv_seed_1';

const clausePayload: TenantPayload = (companyId) => ({
  companyId,
  clauseKey: 'retention.performance',
  title: { el: 'Κράτηση καλής εκτέλεσης' },
  currentVersion: 1,
  latestVersion: 1,
  openProposal: null,
  isArchived: false,
  revision: 2,
});

const versionPayload: TenantPayload = (companyId) => ({
  companyId,
  clauseId: 'sccl_seed',
  version: 1,
  state: 'approved',
  professionalReview: 'needs_professional_review',
  body: { heading: 'Κράτηση καλής εκτέλεσης', blocks: [] },
  parameters: [],
  translations: {},
  contentHash: '0'.repeat(64),
  sourceHash: '0'.repeat(64),
  revision: 2,
});

describe('subcontract_clauses.rules — διαβάζει ο χώρος, γράφει ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useServerWrittenTenantEmulator();
  for (const cell of COVERAGE.matrix) {
    defineServerWrittenTenantCell(env, cell, COVERAGE.collection, clausePayload);
  }
  defineServerWrittenTenantAnchors(env, COVERAGE.collection, clausePayload);

  describe('υποσυλλογή subcontract_clause_versions', () => {
    const versions = (persona: Persona) => getContext(env(), persona).firestore().collection(VERSIONS_PATH);
    const seedVersions = () => withSeedContext(env(), async (ctx) => {
      await ctx.firestore().collection(VERSIONS_PATH).doc(VERSION_ID).set(versionPayload(SAME_TENANT_COMPANY_ID));
      await ctx.firestore().collection(VERSIONS_PATH).doc('sccv_rival').set(versionPayload(CROSS_TENANT_COMPANY_ID));
    });

    it('🔴 ο χώρος διαβάζει την έκδοσή του· ξένος χώρος ΟΧΙ', async () => {
      await seedVersions();
      await assertSucceeds(versions('same_tenant_user').doc(VERSION_ID).get());
      await assertFails(versions('cross_tenant_user').doc(VERSION_ID).get());
      await assertFails(versions('anonymous').doc(VERSION_ID).get());
    });

    it('🔴 rules are not filters — η αφιλτράριστη λίστα απορρίπτεται, η φιλτραρισμένη δεν διαρρέει ξένο μισθωτή', async () => {
      await seedVersions();
      await assertFails(versions('same_tenant_user').get());
      const snap = await assertSucceeds(versions('same_tenant_user').where('companyId', '==', SAME_TENANT_COMPANY_ID).get());
      expect(snap.docs.map((doc) => doc.id)).toEqual([VERSION_ID]);
    });

    it('🔴 ούτε ο διαχειριστής του ίδιου μισθωτή γράφει έκδοση — η διακυβέρνηση ζει μόνο στον ΕΝΑ γραφέα', async () => {
      await seedVersions();
      const col = versions('same_tenant_admin');
      await assertFails(col.doc(VERSION_ID).update({ state: 'approved' }));
      await assertFails(col.doc('sccv_forged').set(versionPayload(SAME_TENANT_COMPANY_ID)));
      await assertFails(col.doc(VERSION_ID).delete());
    });
  });
});
