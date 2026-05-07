/**
 * Firestore Rules — `floorplan_backgrounds` collection (ADR-340 Phase 7)
 *
 * Pattern: role_dual — Q9 RBAC. Reads tenant-scoped; writes restricted to
 * super_admin / company_admin / internal_user (external_user denied).
 *
 * @since 2026-05-07 (ADR-340 Phase 7)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedFloorplanBackground } from '../_harness/seed-helpers-dxf';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'floorplan_backgrounds',
)!;

describe('floorplan_backgrounds.rules — role_dual (ADR-340 Phase 7)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        const docId = 'rbg-same-tenant';
        await seedFloorplanBackground(env, docId);
        const ctx = getContext(env, cell.persona);
        const personaClaims = cell.persona !== 'anonymous' ? PERSONA_CLAIMS[cell.persona] : null;
        const target: AssertTarget = {
          collection: 'floorplan_backgrounds',
          docId,
          // Update payload — only mutable fields. Immutables preserved by spread.
          data: {
            transform: { translateX: 5, translateY: 5, scaleX: 1, scaleY: 1, rotation: 0 },
            opacity: 0.5,
            updatedAt: Date.now(),
            // Preserve immutables (rules require equality with resource.data)
            id: docId,
            companyId: SAME_TENANT_COMPANY_ID,
            floorId: 'floor-test',
            fileId: 'file-test',
            providerId: 'pdf-page',
            naturalBounds: { width: 1000, height: 800 },
            createdBy: PERSONA_CLAIMS.same_tenant_user.uid,
          },
          createData: {
            id: 'rbg-create-test',
            companyId: SAME_TENANT_COMPANY_ID,
            floorId: 'floor-test',
            fileId: 'file-test',
            providerId: 'pdf-page',
            providerMetadata: { pdfPageNumber: 1, imageDecoderUsed: 'native' },
            naturalBounds: { width: 1000, height: 800 },
            transform: { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0 },
            calibration: null,
            opacity: 1,
            visible: true,
            locked: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            createdBy: personaClaims?.uid ?? 'anon-uid',
            updatedBy: personaClaims?.uid ?? 'anon-uid',
          },
          listFilter: { field: 'companyId', op: '==', value: SAME_TENANT_COMPANY_ID },
        };
        await assertCell(ctx, cell, target);
      });
    });
  }
});
