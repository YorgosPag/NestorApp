/**
 * Storage Rules — imported partner meshes (ADR-683 Φ3)
 *
 * Pattern: company_scoped_with_project
 *
 * Path: /companies/{companyId}/projects/{projectId}/imported-meshes/{fileName}
 *
 * Rule: read   — isAuthenticated() && (belongsToCompany(companyId) || isSuperAdmin())
 *       write  — isAuthenticated() && (belongsToCompany(companyId) || isSuperAdmin())
 *                && isValidFileSize()
 *       delete — isAuthenticated() && (belongsToCompany(companyId) || isSuperAdmin())
 *
 * Το συμβόλαιο που φυλάει αυτό το suite: **ο απλός μηχανικός γράφει εδώ**. Το
 * `/bim-mesh-library/` δίπλα είναι curated κατάλογος με write μόνο από super_admin·
 * αν κάποιος «ενοποιήσει» τα δύο δέντρα κάτω από τα ίδια rules, είτε ανοίγει τη
 * βιβλιοθήκη σε κάθε χρήστη (κακό) είτε κλειδώνει την εισαγωγή (άχρηστο). Η γραμμή
 * `same_tenant_user × write → allow` είναι ακριβώς αυτός ο φύλακας.
 *
 * Το tenant isolation ελέγχεται και στα τρία σκέλη: cross-tenant → cross_tenant,
 * anonymous → missing_claim.
 *
 * @since 2026-07-20 (ADR-683 Φ3 — imported mesh roundtrip)
 */

import {
  initStorageEmulator,
  teardownStorageEmulator,
  resetStorageData,
} from '../_harness/emulator';
import { getStorageContext } from '../_harness/auth-contexts';
import { assertStorageCell, type AssertStorageTarget } from '../_harness/assertions';
import { seedStorageFile } from '../_harness/seed-helpers';
import { STORAGE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = STORAGE_RULES_COVERAGE.find(
  (c) => c.pathId === 'imported_meshes',
)!;

const COMPANY_ID = SAME_TENANT_COMPANY_ID;
const PROJECT_ID = 'proj-test-001';
/** Ένα αρχείο ανά εισαγωγή — τα entities δείχνουν σε αυτό ως `<uploadId>#<nodeName>`. */
const FILE_NAME = 'upl-test-001.glb';

const TEST_PATH =
  `companies/${COMPANY_ID}/projects/${PROJECT_ID}/imported-meshes/${FILE_NAME}`;

describe('imported-meshes.storage — company_scoped_with_project (ADR-683 Φ3)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await initStorageEmulator();
  });

  afterAll(async () => {
    await teardownStorageEmulator(env);
  });

  afterEach(async () => {
    await resetStorageData(env);
  });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        // Χωρίς προϋπάρχον αρχείο, getMetadata()/delete() γυρίζουν `object-not-found`
        // αντί για `unauthorized` — ένα deny cell θα περνούσε για λάθος λόγο.
        if (cell.operation === 'read' || cell.operation === 'delete') {
          await seedStorageFile(env, TEST_PATH);
        }

        const ctx = getStorageContext(env, cell.persona);
        const target: AssertStorageTarget = { path: TEST_PATH };

        await assertStorageCell(ctx, cell, target);
      });
    });
  }
});
