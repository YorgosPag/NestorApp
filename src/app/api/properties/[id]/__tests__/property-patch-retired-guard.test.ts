/**
 * @jest-environment node
 *
 * ⚓ Η πίσω πόρτα του `PATCH /api/properties/[id]` προς τον κύκλο ζωής (ADR-281 · ADR-329 §3.9)
 *
 * Το σχήμα του σώματος αρνείται ρητό `status: 'deleted' | 'archived'`. Αυτό κλείνει την
 * **είσοδο** στον κάδο και στο αρχείο. Η **έξοδος** δεν περνά από το σχήμα: ένα σώμα με μόνο
 * `commercialStatus` είναι έγκυρο, και ο καθρέφτης του `property-write-normalizer` γράφει
 * `status = commercialStatus` — πάνω στο `'archived'`.
 *
 * Τι θα σήμαινε αυτό: το ακίνητο βγαίνει από το αρχείο **χωρίς τη μηχανή** — χωρίς γραμμή
 * ιστορικού μετάβασης, με `previousStatus` / `archivedAt` / `archivedBy` να μένουν ορφανά
 * στο έγγραφο, και χωρίς τον κανόνα «από το αρχείο επιστρέφει εκτός αγοράς».
 *
 * 🔑 Ο καθρέφτης, το σχήμα, το κλείδωμα πεδίων **και ο φρουρός** (`requirePropertyInTenantScope`
 * με `intent: 'write'` — Στάδιο 3β: ο έλεγχος μετακόμισε στο ΕΝΑ σημείο) είναι **ΠΡΑΓΜΑΤΙΚΑ** — αυτά κρίνονται.
 * Ψεύτικα είναι η ταυτότητα, η βάση και ό,τι τρέχει **μετά** τη γραφή.
 */

jest.mock('server-only', () => ({}));

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

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() }),
}));

jest.mock('@/lib/middleware/with-rate-limit', () => ({ withRateLimit: <T>(handler: T) => handler }));

const authContext = {
  uid: 'uid_1', companyId: 'comp_1', email: 'g@example.com', globalRole: 'company_admin', isAuthenticated: true as const,
};
jest.mock('@/lib/auth', () => ({
  withAuth:
    (callback: (...args: unknown[]) => Promise<unknown>) =>
    async (request: unknown) => callback(request, authContext),
  logAuditEvent: jest.fn(async () => undefined),
}));

jest.mock('@/lib/auth/audit', () => ({ logAuditEvent: jest.fn(async () => undefined) }));

/** Το έγγραφο όπως κάθεται στη βάση — κάθε δοκιμή ορίζει το δικό της. */
let stored: Record<string, unknown> = {};
const fakeDb = {
  collection: () => ({
    doc: () => ({ get: async () => ({ exists: true, data: () => stored }) }),
  }),
};
jest.mock('@/lib/api/admin-db', () => ({ requireAdminFirestore: () => fakeDb }));
// Ο φρουρός διαβάζει το ΙΔΙΟ έγγραφο από το Admin SDK.
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => fakeDb }));

/** Η ΜΙΑ γραφή της διαδρομής — ό,τι φτάνει εδώ γράφεται στο έγγραφο. */
const withVersionCheck = jest.fn(async (_options: { updates: Record<string, unknown> }) => ({ newVersion: 2 }));
jest.mock('@/lib/firestore/version-check', () => ({
  withVersionCheck: (options: { updates: Record<string, unknown> }) => withVersionCheck(options),
  ConflictError: class ConflictError extends Error {},
}));

jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: {
    diffFieldsWithResolution: jest.fn(async () => []),
    recordChange: jest.fn(async () => 'audit_1'),
  },
}));

jest.mock('@/lib/firestore/soft-delete-engine', () => ({ softDelete: jest.fn() }));
jest.mock('@/lib/firestore/deletion-guard', () => ({ assertDeletionAllowed: jest.fn() }));
jest.mock('@/lib/firestore/entity-linking.service', () => ({
  linkEntity: jest.fn(async () => undefined),
  validateLinkedSpacesUniqueness: jest.fn(async () => undefined),
}));
jest.mock('@/services/building-spaces/space-placement.server', () => ({
  announceSpacePlacements: jest.fn(),
  spacePlacementCompanion: jest.fn(),
}));
jest.mock('@/services/payment-plan.service', () => ({
  PaymentPlanService: { resyncTotalAmount: jest.fn(async () => undefined) },
}));
jest.mock('@/lib/floor/host-floor.server', () => ({ resolveHostedFloorPatch: async () => ({}) }));
jest.mock('../property-contact-links', () => ({
  activateClientPersona: jest.fn(async () => undefined),
  autoCreatePropertyContactLinks: jest.fn(async () => undefined),
  deactivatePropertyContactLinks: jest.fn(async () => undefined),
}));
jest.mock('../property-commercial-validation', () => ({ validateCommercialTransaction: jest.fn() }));
jest.mock('../property-publish-projection', () => ({ republishPublicProjection: jest.fn(async () => undefined) }));
jest.mock('../property-objective-value-patch', () => ({
  OBJECTIVE_VALUE_BODY_KEY: 'objectiveValue',
  patchPropertyObjectiveValue: jest.fn(),
}));
jest.mock('../property-anchor-guard', () => ({ assertPropertyAnchorWrite: async () => ({}) }));

import type { NextRequest } from 'next/server';
import { ARCHIVED_STATUS, TRASHED_STATUS } from '@/lib/firestore/trashed-status';
import { PATCH } from '../route';

const PROPERTY_ID = 'prop_1';

const base = { companyId: 'comp_1', name: 'Α2', commercialStatus: 'unavailable' };

function patchWith(body: Record<string, unknown>): Promise<Response> | Response {
  const request = {
    url: `http://localhost:3000/api/properties/${PROPERTY_ID}`,
    json: async () => body,
  } as unknown as NextRequest;
  return PATCH(request);
}

/** Η άρνηση της διαδρομής ως `[status, κωδικός]` — ή `null` αν η διαδρομή έγραψε. */
async function refusalOf(body: Record<string, unknown>): Promise<readonly [number, string | undefined] | null> {
  try {
    await patchWith(body);
    return null;
  } catch (err) {
    const refusal = err as { statusCode?: number; errorCode?: string };
    return [refusal.statusCode ?? 0, refusal.errorCode];
  }
}

const written = () => withVersionCheck.mock.calls[0]?.[0].updates;

beforeEach(() => {
  withVersionCheck.mockClear();
});

describe('🔴 PATCH δεν βγάζει εγγραφή από το αρχείο ή τον κάδο', () => {
  it.each([
    ['αρχείο', ARCHIVED_STATUS],
    ['κάδος', TRASHED_STATUS],
  ])('%s + `commercialStatus` στο σώμα ⇒ 409, καμία γραφή', async (_place, status) => {
    stored = { ...base, status, previousStatus: 'unavailable' };

    const refusal = await refusalOf({ commercialStatus: 'for-sale' });

    expect(written()).toBeUndefined();
    expect(refusal).toEqual([409, 'ENTITY_RETIRED']);
  });

  it.each([
    ['αρχείο', ARCHIVED_STATUS],
    ['κάδος', TRASHED_STATUS],
  ])('%s + οποιοδήποτε άλλο πεδίο ⇒ 409: το αποσυρμένο δεν επεξεργάζεται', async (_place, status) => {
    stored = { ...base, status, previousStatus: 'unavailable' };

    const refusal = await refusalOf({ name: 'Νέο όνομα' });

    expect(written()).toBeUndefined();
    expect(refusal).toEqual([409, 'ENTITY_RETIRED']);
  });
});

describe('ζωντανό ακίνητο — ο φρουρός δεν το αγγίζει', () => {
  it('`commercialStatus` στο σώμα ⇒ γράφεται, με το `status` καθρέφτη του', async () => {
    stored = { ...base, status: 'unavailable' };

    expect(await refusalOf({ commercialStatus: 'for-sale' })).toBeNull();
    expect(written()).toMatchObject({ commercialStatus: 'for-sale', status: 'for-sale' });
  });
});
