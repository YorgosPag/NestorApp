/**
 * Firestore Rules — `attendance_events` collection
 *
 * Pattern: tenant_dual_path — reads resolve via `companyId` direct OR
 * `projectId` crossdoc; client create is allowed (with field + enum
 * validation, but NO tenant check — see security note); update/delete deny.
 *
 * Matrix delta over `tenant_direct`:
 *   - `same_tenant_user` can create (no role gate on create rule)
 *   - `cross_tenant_admin` can create (SECURITY GAP — documented in ADR-298
 *     §8 Phase B.1 changelog)
 *   - update/delete deny for every persona with `immutable` reason
 *
 * See ADR-298 §4 Phase B (2026-04-11 correction) and §8 Phase B.1.
 *
 * @since 2026-04-11 (ADR-298 Phase B.1)
 */

import {
  initEmulator,
  teardownEmulator,
  resetData,
} from '../_harness/emulator';
import { getContext, getSuperAdmin } from '../_harness/auth-contexts';
import {
  assertCell,
  expectAllow,
  type AssertTarget,
} from '../_harness/assertions';
import { seedAttendanceEvent, seedProject } from '../_harness/seed-helpers';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'attendance_events',
)!;

describe('attendance_events.rules — tenant_dual_path + append-only writes', () => {
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
        const projectId = 'project-attendance-parent';
        const eventId = 'event-same-tenant';

        // Parent project carries the same companyId so the crossdoc leg
        // would also resolve — the direct `belongsToCompany(companyId)`
        // leg wins first and is what the canonical matrix exercises.
        await seedProject(env, projectId, { companyId: SAME_TENANT_COMPANY_ID });
        await seedAttendanceEvent(env, eventId, projectId, {
          companyId: SAME_TENANT_COMPANY_ID,
        });

        const ctx = getContext(env, cell.persona);
        const target: AssertTarget = {
          collection: 'attendance_events',
          docId: eventId,
          // update payload — the rule denies every update with `if false`
          // so the shape is irrelevant (assertion only checks deny outcome).
          data: {
            touchedAt: new Date(),
          },
          // create payload MUST satisfy the full field + enum validation
          // in firestore.rules:211-224, otherwise `allow` cells deny for
          // the wrong reason (field_not_allowlisted instead of the intended
          // outcome). NO companyId field — the create rule ignores it.
          createData: {
            projectId,
            contactId: 'contact-fixture-1',
            eventType: 'check_in',
            method: 'manual',
            timestamp: new Date(),
            recordedBy: 'test-runner',
            createdAt: new Date(),
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

  // --- Crossdoc read-leg regression ---------------------------------------
  //
  // The canonical matrix seeds docs with an explicit companyId so the
  // direct `belongsToCompany()` OR leg wins. This block seeds a doc WITHOUT
  // companyId but WITH a projectId whose parent project carries the tenant
  // claim, exercising the second OR leg (`belongsToProjectCompany(projectId)`).
  // Without this block, a regression that removes the crossdoc leg from
  // firestore.rules:205-207 would pass the canonical matrix silently.
  describe('crossdoc read leg — projectId → belongsToProjectCompany', () => {
    it('should allow same_tenant_admin to read a doc with no companyId field but projectId pointing to same-tenant project', async () => {
      const projectId = 'project-attendance-crossdoc';
      const eventId = 'event-crossdoc-only';

      await seedProject(env, projectId, { companyId: SAME_TENANT_COMPANY_ID });
      await seedAttendanceEvent(env, eventId, projectId, {
        // Force crossdoc: omit companyId entirely so the direct
        // `belongsToCompany()` OR leg fails and the crossdoc leg fires.
        skipCompanyId: true,
      });

      const ctx = getContext(env, 'same_tenant_admin');
      await expectAllow(
        ctx.firestore().collection('attendance_events').doc(eventId).get(),
      );
    });

    it('should allow super_admin to read a pure-crossdoc doc regardless of tenant', async () => {
      const projectId = 'project-attendance-crossdoc-2';
      const eventId = 'event-crossdoc-only-2';

      await seedProject(env, projectId, { companyId: SAME_TENANT_COMPANY_ID });
      await seedAttendanceEvent(env, eventId, projectId, {
        skipCompanyId: true,
      });

      const ctx = getSuperAdmin(env);
      await expectAllow(
        ctx.firestore().collection('attendance_events').doc(eventId).get(),
      );
    });
  });
});
