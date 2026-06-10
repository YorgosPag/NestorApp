/**
 * Unit tests for FirestoreAccountingRepository Company Setup (ADR-439 Phase 2).
 *
 * Pins the per-tenant doc-id: `getCompanySetup` / `saveCompanySetup` MUST address
 * `accounting_settings/{companyId}` — the legal-identity SSoT — NOT the legacy
 * global singleton `accounting_settings/company_profile`.
 *
 * @module subapps/accounting/services/repository/__tests__/company-setup
 * @enterprise ADR-439 — Tenant Identity SSoT & Provisioning
 */

import { COLLECTIONS, SYSTEM_DOCS } from '@/config/firestore-collections';

// ── Fake Firestore that records the doc id each call addresses ──────────────
const accessedDocIds: string[] = [];
let docStore: Record<string, Record<string, unknown> | undefined> = {};
let lastWrite: { docId: string; data: Record<string, unknown> } | null = null;

function makeDocRef(docId: string) {
  accessedDocIds.push(docId);
  return {
    get: async () => {
      const data = docStore[docId];
      return { exists: data !== undefined, data: () => data };
    },
    set: async (data: Record<string, unknown>) => {
      lastWrite = { docId, data };
      docStore[docId] = data;
    },
  };
}

jest.mock('@/lib/firebaseAdmin', () => ({
  safeFirestoreOperation: async <T,>(op: (db: unknown) => Promise<T>): Promise<T> => {
    const db = {
      collection: (_name: string) => ({ doc: (id: string) => makeDocRef(id) }),
    };
    return op(db);
  },
}));

import { FirestoreAccountingRepository } from '@/subapps/accounting/services/repository/firestore-accounting-repository';
import type { TenantContext } from '@/subapps/accounting/types/common';

const COMPANY_ID = 'comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757';
const tenant: TenantContext = { companyId: COMPANY_ID, userId: 'user_test' };

describe('FirestoreAccountingRepository — Company Setup per-tenant (ADR-439)', () => {
  beforeEach(() => {
    accessedDocIds.length = 0;
    docStore = {};
    lastWrite = null;
  });

  it('getCompanySetup reads accounting_settings/{companyId}, not the global doc', async () => {
    docStore[COMPANY_ID] = { businessName: 'ΠΑΓΩΝΗΣ Α.Ε.', entityType: 'sa' };
    const repo = new FirestoreAccountingRepository(tenant);

    const result = await repo.getCompanySetup();

    expect(accessedDocIds).toContain(COMPANY_ID);
    expect(accessedDocIds).not.toContain(SYSTEM_DOCS.ACCT_COMPANY_PROFILE);
    expect(result?.businessName).toBe('ΠΑΓΩΝΗΣ Α.Ε.');
  });

  it('getCompanySetup returns null when the per-tenant doc is missing', async () => {
    const repo = new FirestoreAccountingRepository(tenant);
    const result = await repo.getCompanySetup();
    expect(result).toBeNull();
  });

  it('getCompanySetup back-fills entityType for legacy docs without it', async () => {
    docStore[COMPANY_ID] = { businessName: 'Sole Prop' };
    const repo = new FirestoreAccountingRepository(tenant);

    const result = await repo.getCompanySetup();

    expect(result?.entityType).toBe('sole_proprietor');
  });

  it('saveCompanySetup writes to accounting_settings/{companyId} and stamps companyId', async () => {
    const repo = new FirestoreAccountingRepository(tenant);

    await repo.saveCompanySetup({ entityType: 'sa', businessName: 'ΠΑΓΩΝΗΣ Α.Ε.' } as never);

    expect(lastWrite?.docId).toBe(COMPANY_ID);
    expect(lastWrite?.data.companyId).toBe(COMPANY_ID);
    expect(accessedDocIds).not.toContain(SYSTEM_DOCS.ACCT_COMPANY_PROFILE);
  });

  it('saveCompanySetup preserves the original createdAt on an existing doc', async () => {
    docStore[COMPANY_ID] = { businessName: 'old', createdAt: '2020-01-01T00:00:00.000Z' };
    const repo = new FirestoreAccountingRepository(tenant);

    await repo.saveCompanySetup({ entityType: 'sa', businessName: 'new' } as never);

    expect(lastWrite?.data.createdAt).toBe('2020-01-01T00:00:00.000Z');
  });

  it('uses the configured collection constant (no hardcoded path)', () => {
    expect(COLLECTIONS.ACCOUNTING_SETTINGS).toBe('accounting_settings');
  });
});
