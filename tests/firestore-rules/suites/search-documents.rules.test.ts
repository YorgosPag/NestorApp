/**
 * Firestore Rules — `search_documents` collection
 *
 * Pattern: searchDocumentsMatrix — no client reads or writes, for any persona (ADR-829 §7).
 *
 * The only reader is `GET /api/search` (Admin SDK), which judges each entity type. A client
 * read would bypass that filter, because the rule knows the tenant and not the role.
 * The seed stays same-tenant on purpose: the denial must hold for the owner of the data too.
 *
 * @since 2026-04-14 (ADR-298 Phase C.7)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell } from '../_harness/assertions';
import { seedSearchDocument } from '../_harness/seed-helpers-specialized';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'search_documents',
)!;

describe('search-documents.rules — server only, read=false write=false', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  const docId = 'search-doc-test-001';

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        await seedSearchDocument(env, docId);
        const ctx = getContext(env, cell.persona);
        await assertCell(ctx, cell, {
          collection: 'search_documents',
          docId,
          data: { searchText: 'Updated search' },
          createData: {
            tenantId: SAME_TENANT_COMPANY_ID,
            entityType: 'contact',
            entityId: 'entity-new',
            searchText: 'New search entry',
          },
          // List via tenantId field (NOT companyId — this collection uses tenantId)
          listFilter: { field: 'tenantId', op: '==', value: SAME_TENANT_COMPANY_ID },
        });
      });
    });
  }
});
