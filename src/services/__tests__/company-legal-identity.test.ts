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
let failRead = false;

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({
    collection: (_name: string) => ({
      doc: (id: string) => ({
        get: async () => {
          if (failRead) throw new Error('UNAVAILABLE');
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

import {
  readCompanyContactDeclaration,
  readCompanyLegalIdentity,
  readCompanyRegistryDeclaration,
} from '@/services/company/company-legal-identity';

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

  it('a failed read still resolves to null (contract unchanged)', async () => {
    failRead = true;
    await expect(readCompanyLegalIdentity(COMPANY_ID)).resolves.toBeNull();
  });
});

describe('readCompanyContactDeclaration (ADR-841 §7 Α21.19)', () => {
  beforeEach(() => {
    docStore = {};
    failRead = false;
  });

  it('Δ1 returns ONLY the seven contact fields — never ΑΦΜ, shareholders or series', async () => {
    docStore[COMPANY_ID] = {
      businessName: 'ΠΑΓΩΝΗΣ Α.Ε.',
      vatNumber: '801832652',
      shareholders: [{ name: 'Πρόσωπο' }],
      address: 'Σαμοθράκης 16',
      city: 'Θεσσαλονίκη',
      postalCode: '56334',
      phone: '2310 123456',
      mobile: '',
      email: 'info@pagonis.gr',
      website: null,
    };

    const read = await readCompanyContactDeclaration(COMPANY_ID);

    expect(read).toEqual({
      kind: 'present',
      declaration: {
        address: 'Σαμοθράκης 16',
        city: 'Θεσσαλονίκη',
        postalCode: '56334',
        phone: '2310 123456',
        mobile: null,
        email: 'info@pagonis.gr',
        website: null,
      },
    });
  });

  it('Δ2 no profile ⇒ absent', async () => {
    await expect(readCompanyContactDeclaration(COMPANY_ID)).resolves.toEqual({ kind: 'absent' });
  });

  it('Δ3 profile without any contact field ⇒ absent (nothing to import)', async () => {
    docStore[COMPANY_ID] = { businessName: 'ΠΑΓΩΝΗΣ Α.Ε.', vatNumber: '801832652' };
    await expect(readCompanyContactDeclaration(COMPANY_ID)).resolves.toEqual({ kind: 'absent' });
  });

  it('Δ4 🔴 failed read ⇒ unavailable, NEVER absent (N.12)', async () => {
    failRead = true;
    await expect(readCompanyContactDeclaration(COMPANY_ID)).resolves.toEqual({ kind: 'unavailable' });
  });
});

describe('readCompanyRegistryDeclaration (ADR-841 §7 Α23) — the declaration judged against ΓΕΜΗ', () => {
  beforeEach(() => {
    docStore = {};
    failRead = false;
  });

  it('Γ1 business name + ΓΕΜΗ number + entity type from the profile', async () => {
    docStore[COMPANY_ID] = { businessName: 'ΑΛΦΑ Α.Ε.', gemiNumber: ' 123456789000 ', entityType: 'ae', vatNumber: '801832652' };
    await expect(readCompanyRegistryDeclaration(COMPANY_ID)).resolves.toEqual({
      kind: 'present',
      declaration: { entityType: 'ae', businessName: 'ΑΛΦΑ Α.Ε.', gemiNumber: '123456789000' },
    });
  });

  it('Γ2 legacy profile without entityType ⇒ sole proprietor (the repository rule, one place)', async () => {
    docStore[COMPANY_ID] = { businessName: 'Γ. ΠΑΠΑΣ' };
    await expect(readCompanyRegistryDeclaration(COMPANY_ID)).resolves.toEqual({
      kind: 'present',
      declaration: { entityType: 'sole_proprietor', businessName: 'Γ. ΠΑΠΑΣ', gemiNumber: null },
    });
  });

  it('Γ3 unrecognised entity type ⇒ null, never a guess', async () => {
    docStore[COMPANY_ID] = { businessName: 'Χ', entityType: 'ike' };
    const read = await readCompanyRegistryDeclaration(COMPANY_ID);
    expect(read.kind === 'present' && read.declaration.entityType).toBeNull();
  });

  it('Γ4 🔴 failed read ⇒ unavailable, NEVER "no ΓΕΜΗ number"', async () => {
    failRead = true;
    await expect(readCompanyRegistryDeclaration(COMPANY_ID)).resolves.toEqual({ kind: 'unavailable' });
  });
});
