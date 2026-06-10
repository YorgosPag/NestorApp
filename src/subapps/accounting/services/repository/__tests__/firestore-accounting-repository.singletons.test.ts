/**
 * Unit tests for FirestoreAccountingRepository sibling singletons (ADR-439 Phase 2c).
 *
 * Pins the per-tenant composite doc-id: service_presets / matching_config MUST
 * address `accounting_settings/{companyId}__<type>` (via `accountingDocId`) and stamp
 * `companyId` — NOT the legacy global singleton.
 *
 * ADR-440: partners / members / shareholders are NO LONGER stored as singletons —
 * they are read from the company profile (SSoT). Their per-tenant singleton tests
 * were removed; see `profile-entity-accessors.test.ts` for the new coverage.
 *
 * @module subapps/accounting/services/repository/__tests__/singletons
 * @enterprise ADR-439 — Tenant Identity SSoT & Provisioning — Phase 2c
 * @enterprise ADR-440 — Accounting Entity-Data SSoT
 */

import { SYSTEM_DOCS } from '@/config/firestore-collections';
import { accountingDocId } from '@/subapps/accounting/services/repository/accounting-doc-ids';

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
  safeFirestoreOperation: async <T,>(op: (db: unknown) => Promise<T>, _fallback: T): Promise<T> => {
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

describe('FirestoreAccountingRepository — sibling singletons per-tenant (ADR-439 Phase 2c)', () => {
  beforeEach(() => {
    accessedDocIds.length = 0;
    docStore = {};
    lastWrite = null;
  });

  // ── Service Presets (Phase 2c: now stamps companyId) ──────────────────────
  it('saveServicePresets writes {companyId}__service_presets and stamps companyId', async () => {
    const repo = new FirestoreAccountingRepository(tenant);
    await repo.saveServicePresets([{ id: 'sp1', isActive: true }] as never);

    expect(lastWrite?.docId).toBe(`${COMPANY_ID}__service_presets`);
    expect(lastWrite?.data.companyId).toBe(COMPANY_ID);
  });

  it('getServicePresets reads {companyId}__service_presets and returns only active presets', async () => {
    docStore[accountingDocId(COMPANY_ID, 'service_presets')] = {
      presets: [{ id: 'a', isActive: true }, { id: 'b', isActive: false }],
      companyId: COMPANY_ID,
    };
    const repo = new FirestoreAccountingRepository(tenant);

    const result = await repo.getServicePresets();

    expect(accessedDocIds).toContain(`${COMPANY_ID}__service_presets`);
    expect(accessedDocIds).not.toContain(SYSTEM_DOCS.ACCT_SERVICE_PRESETS);
    expect(result).toHaveLength(1);
  });

  // ── Matching Config ───────────────────────────────────────────────────────
  it('getMatchingConfig reads {companyId}__matching_config (null when missing)', async () => {
    const repo = new FirestoreAccountingRepository(tenant);

    const missing = await repo.getMatchingConfig();
    expect(missing).toBeNull();
    expect(accessedDocIds).toContain(`${COMPANY_ID}__matching_config`);
    expect(accessedDocIds).not.toContain(SYSTEM_DOCS.ACCT_MATCHING_CONFIG);
  });

  it('saveMatchingConfig writes {companyId}__matching_config and stamps companyId', async () => {
    const repo = new FirestoreAccountingRepository(tenant);
    await repo.saveMatchingConfig({ amountTolerancePercent: 5 } as never);

    expect(lastWrite?.docId).toBe(`${COMPANY_ID}__matching_config`);
    expect(lastWrite?.data.companyId).toBe(COMPANY_ID);
    expect(lastWrite?.data.amountTolerancePercent).toBe(5);
  });

  // ── EFKA User Config (separate collection → bare {companyId} doc id) ───────
  it('getEFKAUserConfig reads accounting_efka_config/{companyId}, not the legacy global doc', async () => {
    docStore[COMPANY_ID] = { contributionClass: 1, companyId: COMPANY_ID };
    const repo = new FirestoreAccountingRepository(tenant);

    const result = await repo.getEFKAUserConfig();

    expect(accessedDocIds).toContain(COMPANY_ID);
    expect(accessedDocIds).not.toContain(SYSTEM_DOCS.ACCT_EFKA_USER_CONFIG);
    expect(result).not.toBeNull();
  });

  it('saveEFKAUserConfig writes accounting_efka_config/{companyId} and stamps companyId', async () => {
    const repo = new FirestoreAccountingRepository(tenant);
    await repo.saveEFKAUserConfig({ contributionClass: 1 } as never);

    expect(lastWrite?.docId).toBe(COMPANY_ID);
    expect(lastWrite?.data.companyId).toBe(COMPANY_ID);
    expect(accessedDocIds).not.toContain(SYSTEM_DOCS.ACCT_EFKA_USER_CONFIG);
  });
});
