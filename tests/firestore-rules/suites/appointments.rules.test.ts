/**
 * Firestore Rules — `appointments` collection
 *
 * Pattern: admin_write_only — tenant-scoped reads (`isSuperAdminOnly() ||
 * (doc.hasAny(['companyId']) && belongsToCompany(companyId))`), all client
 * writes denied (`if false`). Appointments are created by the AI Pipeline
 * (UC-001) via Admin SDK — no client-side creation.
 *
 * See ADR-298 §4 Phase C.5 (2026-04-13).
 *
 * @since 2026-04-13 (ADR-298 Phase C.5)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedAppointment } from '../_harness/seed-helpers-system';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'appointments',
)!;

describe('appointments.rules — admin_write_only (tenant read, write=false)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        const docId = 'appt-same-tenant';
        await seedAppointment(env, docId);
        const ctx = getContext(env, cell.persona);
        const target: AssertTarget = {
          collection: 'appointments',
          docId,
          data: { status: 'confirmed' },
          createData: { title: 'New Appt', scheduledAt: new Date(), status: 'pending', companyId: SAME_TENANT_COMPANY_ID },
          listFilter: { field: 'companyId', op: '==', value: SAME_TENANT_COMPANY_ID },
        };
        await assertCell(ctx, cell, target);
      });
    });
  }
});
