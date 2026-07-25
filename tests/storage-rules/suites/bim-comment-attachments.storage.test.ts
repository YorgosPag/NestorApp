/**
 * Storage Rules — συνημμένα εικόνων σε σχόλια BIM (ADR-366 Φ9/C.2)
 *
 * Pattern: company_scoped_with_project
 *
 * Path: /companies/{companyId}/bim-comment-attachments/{commentId}/{fileName}
 *
 * Rule: read   — isAuthenticated() && (belongsToCompany(companyId) || isSuperAdmin())
 *       write  — isAuthenticated() && (belongsToCompany(companyId) || isSuperAdmin())
 *                && size < 5 MB && contentType matches image/*
 *       delete — isAuthenticated() && (belongsToCompany(companyId) || isSuperAdmin())
 *
 * Το συμβόλαιο που φυλάει αυτό το suite: **ο απλός μηχανικός επισυνάπτει εικόνα**. Ο
 * σχολιασμός του μοντέλου είναι καθημερινή ενέργεια όποιου το βλέπει, όχι διαχείριση
 * καταλόγου — αν κάποιος ευθυγραμμίσει αυτό το path με τα curated δέντρα δίπλα
 * (`/bim-mesh-library/`, write μόνο από super_admin), τα ανεβάσματα σταματούν **σιωπηλά**:
 * η φόρμα θα δείξει σφάλμα ανεβάσματος και το σχόλιο απλώς δεν θα αποκτήσει ποτέ συνημμένο.
 * Η γραμμή `same_tenant_user × write → allow` είναι ακριβώς αυτός ο φύλακας.
 *
 * Το δεύτερο τμήμα του path είναι το `commentId` — ο ιδιοκτήτης του αρχείου είναι το
 * σχόλιο, όχι το έργο. Το tenant isolation μένει στο `{companyId}` και ελέγχεται και στα
 * τρία σκέλη: cross-tenant → cross_tenant, anonymous → missing_claim.
 *
 * @since 2026-07-26 (ADR-366 Φ9/C.2 — ζωντάνεμα των συνημμένων)
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
  (c) => c.pathId === 'bim_comment_attachments',
)!;

const COMPANY_ID = SAME_TENANT_COMPANY_ID;
const COMMENT_ID = 'cmt_bim_test0001';
/** Το πλήρες object· η μικρογραφία (`…-thumb.jpg`) ζει στον ίδιο φάκελο, ίδια rules. */
const FILE_NAME = 'att_test0001.png';

const TEST_PATH =
  `companies/${COMPANY_ID}/bim-comment-attachments/${COMMENT_ID}/${FILE_NAME}`;

describe('bim-comment-attachments.storage — company_scoped_with_project (ADR-366 Φ9/C.2)', () => {
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
