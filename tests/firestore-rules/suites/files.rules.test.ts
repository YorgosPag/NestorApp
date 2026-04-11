/**
 * Firestore Rules — `files` collection
 *
 * Pattern: tenant_direct. Files are the most-hit storage-backed collection;
 * tests exercise full CRUD with companyId-gated list queries.
 *
 * Migrated from `tests/firestore-rules/pr-1a-files.test.ts` (2026-01-29).
 * See ADR-298 §3.3.
 *
 * @since 2026-04-11 (ADR-298 Phase A)
 */

import {
  initEmulator,
  teardownEmulator,
  resetData,
} from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedFile } from '../_harness/seed-helpers';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  PERSONA_CLAIMS,
  SAME_TENANT_COMPANY_ID,
  isAuthenticatedPersona,
} from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'files',
)!;

/**
 * Derive a plausible `createdBy` for a fresh-create test. The files create
 * rule requires `request.resource.data.createdBy == request.auth.uid`, so
 * each persona's payload must reference its own synthetic uid.
 *
 * `anonymous` is never used for allow-create cells, but return a sentinel
 * for completeness so the helper is total.
 */
function createdByFor(persona: (typeof COVERAGE.matrix)[number]['persona']): string {
  if (!isAuthenticatedPersona(persona)) {
    return 'anonymous-cannot-create';
  }
  return PERSONA_CLAIMS[persona].uid;
}

describe('files.rules — tenant_state_machine pattern', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await initEmulator();
  });

  afterAll(async () => {
    await teardownEmulator(env);
  });

  afterEach(async () => {
    await resetData(env);
  });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        const docId = 'file-same-tenant';
        // Seed uses a neutral `seed-system` creator so that no persona gets
        // ownership-leg access for free. Cross-tenant personas must fail the
        // rule on the company check, not on an accidentally-matching uid —
        // super admin still passes through `isSuperAdminOnly()`, and the
        // same-tenant admin passes through `isCompanyAdminOfCompany()`.
        const seedCreatedBy = 'seed-system';
        await seedFile(env, docId, {
          companyId: SAME_TENANT_COMPANY_ID,
          createdBy: seedCreatedBy,
        });

        const ctx = getContext(env, cell.persona);
        const target: AssertTarget = {
          collection: 'files',
          docId,
          // Update payload exercises the `ready → trashed` transition of the
          // files state machine (firestore.rules:424). All immutable fields
          // are preserved verbatim from the seed.
          data: {
            id: docId,
            fileName: `seed-${docId}.pdf`,
            mimeType: 'application/pdf',
            size: 1024,
            status: 'ready',
            isDeleted: true,
            storagePath: `companies/${SAME_TENANT_COMPANY_ID}/files/${docId}`,
            createdBy: seedCreatedBy,
            companyId: SAME_TENANT_COMPANY_ID,
          },
          // Fresh-doc create payload — status MUST be 'pending', and
          // createdBy MUST match the acting persona's uid.
          createData: {
            fileName: 'created.pdf',
            mimeType: 'application/pdf',
            size: 2048,
            status: 'pending',
            isDeleted: false,
            storagePath: `companies/${SAME_TENANT_COMPANY_ID}/files/created.pdf`,
            createdBy: createdByFor(cell.persona),
            companyId: SAME_TENANT_COMPANY_ID,
          },
          listFilter: {
            field: 'companyId',
            op: '==',
            value: SAME_TENANT_COMPANY_ID,
          },
        };

        await assertCell(ctx, cell, target);
      });
    });
  }
});
