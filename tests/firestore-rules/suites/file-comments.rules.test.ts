/**
 * Firestore Rules — `file_comments` collection
 *
 * Pattern: custom (fileCommentsMatrix) — threaded file comments.
 *
 * Key behaviors:
 *   - read:   `isAuthenticated() && belongsToCompany(companyId)` — NO super bypass.
 *     super_admin (company-root) fails → DENY.
 *   - create: `isAuthenticated() && (isSuperAdminOnly || companyId==getUserCompanyId())`
 *   - update: `isAuthenticated() && belongsToCompany && authorId NOT changed`.
 *     Any same-tenant member can update (not just the author) as long as the
 *     `authorId` field is preserved.
 *   - delete: `isAuthenticated() && belongsToCompany && authorId==request.auth.uid`.
 *     Only the original author can delete. Seed: authorId = same_tenant_user.uid.
 *
 * Update data: `{ content: 'updated', updatedAt: new Date() }` — does NOT change
 * authorId, so Firestore merges authorId from existing doc → update gate passes for
 * same-tenant members.
 *
 * See ADR-298 §4 Phase C.3 (2026-04-14).
 *
 * @since 2026-04-14 (ADR-298 Phase C.3)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedFileComment } from '../_harness/seed-helpers-dxf';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'file_comments',
)!;

describe('file_comments.rules — custom (fileCommentsMatrix, author delete, super read denied)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        const docId = 'comment-same-tenant';
        // authorId = same_tenant_user.uid → exercised by update (preserved) and delete (matched)
        await seedFileComment(env, docId);
        const ctx = getContext(env, cell.persona);
        const personaClaims = cell.persona !== 'anonymous' ? PERSONA_CLAIMS[cell.persona] : null;
        const uid = personaClaims?.uid ?? 'anon-uid';
        const target: AssertTarget = {
          collection: 'file_comments',
          docId,
          // Update: change content but NOT authorId — preserves author identity
          data: { content: 'Updated comment text', updatedAt: new Date() },
          createData: {
            content: 'New comment',
            fileId: 'file-new',
            authorId: uid,
            companyId: SAME_TENANT_COMPANY_ID,
            createdAt: new Date(),
          },
          listFilter: { field: 'companyId', op: '==', value: SAME_TENANT_COMPANY_ID },
        };
        await assertCell(ctx, cell, target);
      });
    });
  }
});
