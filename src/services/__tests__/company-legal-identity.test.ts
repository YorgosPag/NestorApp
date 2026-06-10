/**
 * Unit tests for `readCompanyLegalIdentity` (ADR-439 Phase 1).
 *
 * The per-tenant company profile (`accounting_settings/{companyId}`) is the
 * legal-identity SSoT. Post-Phase-2b the reader consults the per-tenant doc
 * ONLY — the legacy global singleton (`accounting_settings/company_profile`)
 * is never read. These tests pin per-tenant-only resolution and guard the
 * "Georgios Pagonis" regression (no profile → null → resolver uses the user
 * displayName only as a last resort).
 *
 * @module services/__tests__/company-legal-identity
 * @enterprise ADR-439 — Tenant Identity SSoT & Provisioning
 */

import { COLLECTIONS, SYSTEM_DOCS } from '@/config/firestore-collections';

// Mutable doc store keyed by Firestore doc id within `accounting_settings`.
let docStore: Record<string, Record<string, unknown> | undefined> = {};

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({
    collection: (_name: string) => ({
      doc: (id: string) => ({
        get: async () => {
          const data = docStore[id];
          return { exists: data !== undefined, data: () => data };
        },
      }),
    }),
  }),
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

import { readCompanyLegalIdentity } from '@/services/company/company-legal-identity';

const COMPANY_ID = 'comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757';
const GLOBAL_DOC = SYSTEM_DOCS.ACCT_COMPANY_PROFILE;

describe('readCompanyLegalIdentity (ADR-439)', () => {
  beforeEach(() => {
    docStore = {};
  });

  it('reads the per-tenant profile (SSoT) and ignores the global singleton', async () => {
    docStore[COMPANY_ID] = { businessName: 'ΠΑΓΩΝΗΣ Ενεργειακή Κατασκευαστική Α.Ε.' };
    docStore[GLOBAL_DOC] = { businessName: 'ΛΑΘΟΣ global όνομα' };

    const identity = await readCompanyLegalIdentity(COMPANY_ID);

    expect(identity).toEqual({ businessName: 'ΠΑΓΩΝΗΣ Ενεργειακή Κατασκευαστική Α.Ε.' });
  });

  it('does NOT fall back to the global singleton when the per-tenant doc is missing (Phase 2b)', async () => {
    docStore[GLOBAL_DOC] = {
      businessName: 'ΠΑΓΩΝΗΣ Ενεργειακή Κατασκευαστική Α.Ε.',
      vatNumber: '801832652',
    };

    const identity = await readCompanyLegalIdentity(COMPANY_ID);

    // Per-tenant doc absent → null, regardless of the legacy global doc.
    expect(identity).toBeNull();
  });

  it('returns the trade name alongside the business name when present', async () => {
    docStore[COMPANY_ID] = {
      businessName: 'ΠΑΓΩΝΗΣ Α.Ε.',
      tradeName: 'PAGONIS ENERGY',
    };

    const identity = await readCompanyLegalIdentity(COMPANY_ID);

    expect(identity).toEqual({ businessName: 'ΠΑΓΩΝΗΣ Α.Ε.', tradeName: 'PAGONIS ENERGY' });
  });

  it('returns null when neither per-tenant nor global profile exists', async () => {
    const identity = await readCompanyLegalIdentity(COMPANY_ID);
    expect(identity).toBeNull();
  });

  it('returns null when the profile has no business or trade name', async () => {
    docStore[COMPANY_ID] = { vatNumber: '801832652', taxOffice: 'ΦΑΕ Θεσσαλονίκης' };

    const identity = await readCompanyLegalIdentity(COMPANY_ID);

    expect(identity).toBeNull();
  });

  it('ignores blank/whitespace-only names', async () => {
    docStore[COMPANY_ID] = { businessName: '   ', tradeName: '' };

    const identity = await readCompanyLegalIdentity(COMPANY_ID);

    expect(identity).toBeNull();
  });

  it('uses the configured collection/doc constants (no hardcoded paths)', () => {
    expect(COLLECTIONS.ACCOUNTING_SETTINGS).toBe('accounting_settings');
    expect(SYSTEM_DOCS.ACCT_COMPANY_PROFILE).toBe('company_profile');
  });
});
