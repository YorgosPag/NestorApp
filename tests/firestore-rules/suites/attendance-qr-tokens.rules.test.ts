/**
 * Firestore Rules — `attendance_qr_tokens` collection
 *
 * Pattern: admin_write_only — reads are tenant-scoped via the same dual OR
 * path as `attendance_events` (companyId direct OR projectId crossdoc);
 * every client-side create/update/delete denies with `if false`. Tokens are
 * minted and rotated exclusively by the server via Admin SDK (ADR-170).
 *
 * Uses `adminWriteOnlyMatrix()` unchanged — the rule shape matches the
 * canonical pattern; the only diff from the `buildings` suite is the dual
 * read path, which is exercised in the dedicated regression block below.
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
import { seedAttendanceQrToken, seedProject } from '../_harness/seed-helpers';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'attendance_qr_tokens',
)!;

describe('attendance_qr_tokens.rules — admin_write_only with dual-path reads', () => {
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
        const projectId = 'project-qr-parent';
        const tokenId = 'token-same-tenant';

        await seedProject(env, projectId, { companyId: SAME_TENANT_COMPANY_ID });
        await seedAttendanceQrToken(env, tokenId, projectId, {
          companyId: SAME_TENANT_COMPANY_ID,
        });

        const ctx = getContext(env, cell.persona);
        const target: AssertTarget = {
          collection: 'attendance_qr_tokens',
          docId: tokenId,
          // Every client write denies at the rule level regardless of shape
          // — the `allow create/update/delete: if false` gate short-circuits
          // before any field inspection. Payloads below are placeholders
          // that drive the Firestore set/update calls.
          data: {
            status: 'revoked',
            projectId,
            companyId: SAME_TENANT_COMPANY_ID,
          },
          createData: {
            projectId,
            tokenHash: 'hmac-new',
            status: 'active',
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

  // --- Crossdoc read-leg regression ---------------------------------------
  //
  // Mirror of the attendance_events crossdoc regression block. A token doc
  // without companyId but with a projectId must still be readable by same-
  // tenant personas via `belongsToProjectCompany()`. Without this check, a
  // regression that drops the crossdoc OR leg from firestore.rules:249-251
  // would pass the canonical matrix silently.
  describe('crossdoc read leg — projectId → belongsToProjectCompany', () => {
    it('should allow same_tenant_admin to read a token with no companyId but projectId pointing to same-tenant project', async () => {
      const projectId = 'project-qr-crossdoc';
      const tokenId = 'token-crossdoc-only';

      await seedProject(env, projectId, { companyId: SAME_TENANT_COMPANY_ID });
      await seedAttendanceQrToken(env, tokenId, projectId, {
        skipCompanyId: true,
      });

      const ctx = getContext(env, 'same_tenant_admin');
      await expectAllow(
        ctx.firestore().collection('attendance_qr_tokens').doc(tokenId).get(),
      );
    });

    it('should allow super_admin to read a pure-crossdoc token regardless of tenant', async () => {
      const projectId = 'project-qr-crossdoc-2';
      const tokenId = 'token-crossdoc-only-2';

      await seedProject(env, projectId, { companyId: SAME_TENANT_COMPANY_ID });
      await seedAttendanceQrToken(env, tokenId, projectId, {
        skipCompanyId: true,
      });

      const ctx = getSuperAdmin(env);
      await expectAllow(
        ctx.firestore().collection('attendance_qr_tokens').doc(tokenId).get(),
      );
    });
  });
});
