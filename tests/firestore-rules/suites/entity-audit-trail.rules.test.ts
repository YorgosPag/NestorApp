/**
 * Firestore Rules — `entity_audit_trail` collection
 *
 * Pattern: immutable append-only audit trail. Reads follow tenant isolation
 * with a super_admin short-circuit; writes are server-only (any client-side
 * create/update/delete must deny).
 *
 * **Bug #1 regression test** (2026-04-11, ADR-195 Phase 10 hotfix).
 * Before the hotfix, super-admin reads returned `permission-denied` because
 * the `allow read` expression's first OR leg was the `belongsToCompany()`
 * check instead of `isSuperAdminOnly()`. CHECK 3.16's rule-shape validator
 * catches the static regression; this suite catches any dynamic regression
 * that bypasses the static analyser.
 *
 * See ADR-298 §1.1 Bug #1 and §3.3.
 *
 * @since 2026-04-11 (ADR-298 Phase A)
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
import { seedEntityAuditTrail } from '../_harness/seed-helpers';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  SAME_TENANT_COMPANY_ID,
  CROSS_TENANT_COMPANY_ID,
} from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'entity_audit_trail',
)!;

describe('entity_audit_trail.rules — immutable pattern (Bug #1 regression)', () => {
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
        const docId = 'audit-same-tenant';
        await seedEntityAuditTrail(env, docId, {
          companyId: SAME_TENANT_COMPANY_ID,
          entityType: 'contact',
          entityId: 'seeded-contact-1',
        });

        const ctx = getContext(env, cell.persona);
        const target: AssertTarget = {
          collection: 'entity_audit_trail',
          docId,
          data: {
            entityType: 'contact',
            entityId: 'seeded-contact-1',
            action: 'updated',
            timestamp: new Date(),
            companyId: SAME_TENANT_COMPANY_ID,
          },
          listFilter: {
            field: 'companyId',
            op: '==',
            value:
              cell.persona.startsWith('cross_tenant')
                ? CROSS_TENANT_COMPANY_ID
                : SAME_TENANT_COMPANY_ID,
          },
        };

        await assertCell(ctx, cell, target);
      });
    });
  }

  // --- Bug #1 targeted regression assertion -------------------------------
  //
  // Tightened, positive-signal check that super-admin reads succeed even
  // when the audit doc belongs to a different tenant (the exact shape of
  // the 2026-04-11 production incident).
  describe('Bug #1 — super_admin reads across tenants', () => {
    it('should allow super_admin to read an audit doc belonging to any company', async () => {
      const docId = 'audit-cross-tenant';
      await seedEntityAuditTrail(env, docId, {
        companyId: CROSS_TENANT_COMPANY_ID,
        entityType: 'project',
        entityId: 'cross-tenant-project',
      });

      const ctx = getSuperAdmin(env);
      await expectAllow(
        ctx.firestore().collection('entity_audit_trail').doc(docId).get(),
      );
    });
  });
});
