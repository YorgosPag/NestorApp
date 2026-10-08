/**
 * @jest-environment node
 *
 * @fileoverview 🌍 **Η ΠΡΟΩΘΗΣΗ ΕΚΔΟΣΗΣ ΞΑΝΑΠΡΟΒΑΛΛΕΙ ΤΗΝ ΑΓΓΕΛΙΑ** — ADR-845 §7.17 Α3 (κλάση Ο-35).
 * @related app/api/files/[fileId]/versions/promote/route.ts · services/listings/listing-media-refresh.ts
 *
 * 🔴 **ΤΙ ΦΥΛΑΕΙ**: η προώθηση αρχειοθετεί την τρέχουσα έκδοση και ο διάδοχος γεννιέται **χωρίς**
 * διαβάθμιση· δημοσιευμένη φωτογραφία έφευγε από το κοινό χωρίς να το μάθει η αγγελία.
 *
 * ⚠️ Ο PEP (`fileResource`) και ο βοηθός επαναπροβολής **ΔΕΝ** γίνονται mock. Mock μόνο ο
 * ενορχηστρωτής της προώθησης *(δικές του άγκυρες)*, η ορατότητα, η ταυτότητα και ο ΕΝΑΣ γραφέας
 * της αγγελίας.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

jest.mock('server-only', () => ({}));

let fake: FakeFirestore;

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: (): AdminFirestore => fake as unknown as AdminFirestore,
}));

jest.mock('next/server', () => {
  class MockNextResponse {
    readonly status: number;
    private readonly body: unknown;
    constructor(body: unknown, init?: { status?: number }) {
      this.body = body;
      this.status = init?.status ?? 200;
    }
    async json(): Promise<unknown> { return this.body; }
    static json(body: unknown, init?: { status?: number }): MockNextResponse {
      return new MockNextResponse(body, init);
    }
  }
  return { NextResponse: MockNextResponse, NextRequest: class {} };
});

jest.mock('@/lib/middleware/with-rate-limit', () => ({ withSensitiveRateLimit: <T>(h: T) => h }));
jest.mock('@/lib/auth/container-visibility-guard', () => ({ containerVisibilityRefusal: async () => null }));

const caller = { uid: 'u_alpha', companyId: 'c_alpha', globalRole: 'company_admin', isAuthenticated: true };
let custody: 'company' | 'personal' = 'company';
jest.mock('@/app/api/files/_shared/file-custody-route', () => ({
  withFileCustodyAuth:
    (handler: (...args: unknown[]) => Promise<unknown>) =>
    async (request: unknown, segment: unknown) =>
      handler(request, custody === 'company' ? { custody, ctx: caller } : { custody, uid: caller.uid }, segment),
}));

jest.mock('@/services/iso19650/container-transitions', () => ({
  containerActorOf: () => ({ uid: 'u_alpha' }),
  personalContainerActorOf: () => ({ uid: 'u_alpha' }),
}));

const promoteVersion = jest.fn();
jest.mock('@/services/iso19650/version-promotion', () => ({
  promoteVersion: (...args: unknown[]) => promoteVersion(...args),
}));

const republishListing = jest.fn(async (..._args: unknown[]): Promise<string> => 'published');
jest.mock('@/services/listings/publish-public-listing', () => ({
  republishListing: (...args: unknown[]) => republishListing(...args),
  reportProjectionFailure: (): string => 'failed',
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { POST } = require('../route') as typeof import('../route');

const PROPERTY_A = 'prop_a';
const PROPERTY_B = 'prop_b';
const SOURCE = 'file_v2';
const HEAD = 'file_v3';

interface Wire {
  success: boolean;
  listings?: { propertyId: string; outcome: string }[];
}

async function promote(fileId: string, expectedHeadFileId: string): Promise<{ status: number; body: Wire }> {
  const response = (await (POST as unknown as (request: unknown, segment: unknown) => Promise<unknown>)(
    { json: async () => ({ expectedHeadFileId }) },
    { params: Promise.resolve({ fileId }) },
  )) as { status: number; json: () => Promise<Wire> };
  return { status: response.status, body: await response.json() };
}

function seedVersion(id: string, propertyId: string, companyId = 'c_alpha'): void {
  fake.seed(COLLECTIONS.FILES, id, { id, companyId, entityType: 'property', entityId: propertyId });
}

function republishedProperties(): unknown[] {
  return republishListing.mock.calls.map((args) => args[1]);
}

beforeEach(() => {
  jest.clearAllMocks();
  custody = 'company';
  fake = new FakeFirestore();
  fake.seed(COLLECTIONS.PROPERTIES, PROPERTY_A, { companyId: 'c_alpha', status: 'active' });
  fake.seed(COLLECTIONS.PROPERTIES, PROPERTY_B, { companyId: 'c_alpha', status: 'active' });
  seedVersion(SOURCE, PROPERTY_A);
  seedVersion(HEAD, PROPERTY_A);
  promoteVersion.mockResolvedValue({ kind: 'promoted', successorId: 'file_v4', previousHeadFileId: HEAD });
});

describe('ADR-845 §7.17 Α3 — η πόρτα της προώθησης έκδοσης ξαναπροβάλλει', () => {
  it('🌍 Ρ1 — προώθηση που ΕΓΙΝΕ ⇒ ΜΙΑ επαναπροβολή του ακινήτου (πηγή και κεφαλή στο ίδιο)', async () => {
    const { status, body } = await promote(SOURCE, HEAD);

    expect(status).toBe(200);
    expect(body.listings).toEqual([{ propertyId: PROPERTY_A, outcome: 'published' }]);
    expect(republishedProperties()).toEqual([PROPERTY_A]);
  });

  it('🔑 Ρ2 — η κεφαλή ΜΕΤΑΚΙΝΗΘΗΚΕ σε άλλο ακίνητο ⇒ ξαναπροβάλλονται ΚΑΙ ΤΑ ΔΥΟ', async () => {
    seedVersion(HEAD, PROPERTY_B);

    await promote(SOURCE, HEAD);

    expect(republishedProperties()).toEqual([PROPERTY_A, PROPERTY_B]);
  });

  it('🔒 Ρ3 — κεφαλή ΞΕΝΟΥ μισθωτή δεν ξαναπροβάλλει ξένη αγγελία (ίδιος PEP: ξένο = ανύπαρκτο)', async () => {
    seedVersion(HEAD, PROPERTY_B, 'c_beta');

    await promote(SOURCE, HEAD);

    expect(republishedProperties()).toEqual([PROPERTY_A]);
  });

  it('🔴 Ρ4 — «τίποτα να αλλάξει» ή άρνηση ⇒ ΚΑΜΙΑ επαναπροβολή', async () => {
    promoteVersion.mockResolvedValueOnce({ kind: 'noop', why: 'already-current' });
    const noop = await promote(SOURCE, HEAD);

    promoteVersion.mockResolvedValueOnce({ kind: 'refused', why: 'head-moved' });
    const refused = await promote(SOURCE, HEAD);

    expect(noop.status).toBe(200);
    expect(refused.status).toBe(409);
    expect(republishListing).not.toHaveBeenCalled();
  });
});
