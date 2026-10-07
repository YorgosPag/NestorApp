/**
 * @jest-environment node
 *
 * ⚓ Οι πίσω πόρτες προς αποσυρμένο ακίνητο (ADR-281 · ADR-329 §3.9, Στάδιο 3β)
 *
 * Το Στάδιο 2 έκλεισε **μία** πόρτα: το `PATCH /api/properties/[id]`. Ένα ακίνητο στο αρχείο ή
 * στον κάδο δεχόταν ακόμη επιταγές, πλάνο πληρωμών, πληρωμές, δάνεια, γραμμές ιστορικού,
 * υπόθεση μεταβίβασης και νέα βιτρίνα — κάθε μία από άλλη διαδρομή, καμία από τις οποίες
 * ρωτούσε αν το ακίνητο είναι αποσυρμένο.
 *
 * 🔑 **Ο φρουρός είναι ΠΡΑΓΜΑΤΙΚΟΣ** (`requirePropertyInTenantScope` + `assertNotRetired`), και
 * κάθε διαδρομή **εκτελείται**: δοκιμή που μιμείται τον φρουρό θα επιβεβαίωνε τον εαυτό της.
 * Ψεύτικα είναι η ταυτότητα, η βάση και οι υπηρεσίες που θα έγραφαν — και **αυτές** είναι το
 * κριτήριο: αν κληθεί έστω μία, η πόρτα ήταν ανοιχτή.
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
jest.mock('@/lib/telemetry/Logger', () => ({
  createModuleLogger: () => ({ warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() }),
}));

jest.mock('@/lib/middleware/with-rate-limit', () => ({
  withStandardRateLimit: <T>(handler: T) => handler,
  withHeavyRateLimit: <T>(handler: T) => handler,
}));

const authContext = {
  uid: 'uid_1', companyId: 'comp_1', email: 'g@example.com', globalRole: 'company_admin', isAuthenticated: true as const,
};
jest.mock('@/lib/auth', () => ({
  withAuth:
    (callback: (...args: unknown[]) => Promise<unknown>) =>
    async (request: unknown) => callback(request, authContext, {}),
  logAuditEvent: jest.fn(async () => undefined),
}));
jest.mock('@/lib/auth/audit', () => ({
  logAuditEvent: jest.fn(async () => undefined),
  logFinancialTransition: jest.fn(async () => undefined),
}));
jest.mock('@/lib/auth/permissions', () => ({ hasPermission: async () => true }));

/** Το ακίνητο όπως κάθεται στη βάση — κάθε δοκιμή ορίζει το δικό της. */
let stored: Record<string, unknown> = {};
const fakeDb = {
  collection: () => ({
    doc: (id: string) => ({ id, get: async () => ({ exists: true, id, data: () => stored }) }),
  }),
};
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => fakeDb, getAdminBucket: jest.fn() }));
jest.mock('@/lib/api/admin-db', () => ({ requireAdminFirestore: () => fakeDb }));

/** Κάθε γραφή που θα έκανε οποιαδήποτε διαδρομή καταλήγει εδώ. Το κριτήριο: **μηδέν** κλήσεις. */
const wrote = jest.fn();
function mockWriter(name: string) {
  return async () => { wrote(name); return { success: true }; };
}

jest.mock('@/services/cheque-registry.service', () => ({
  ChequeRegistryService: {
    createCheque: mockWriter('cheque.create'),
    transitionStatus: mockWriter('cheque.transition'),
    getChequesByProperty: jest.fn(async () => ({ success: true, cheques: [] })),
  },
}));
jest.mock('@/services/payment-plan.service', () => ({
  PaymentPlanService: {
    createPaymentPlan: mockWriter('plan.create'),
    createSplitPaymentPlans: mockWriter('plan.createSplit'),
    recordPayment: mockWriter('payment.record'),
    addInstallment: mockWriter('installment.add'),
    getPaymentPlanByProperty: jest.fn(async () => ({ success: true, plan: null })),
    getPaymentPlansByProperty: jest.fn(async () => ({ success: true, plans: [] })),
  },
}));
jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: mockWriter('audit.recordChange') },
}));
jest.mock('@/services/conveyance/conveyance-case.service', () => ({
  openConveyanceCase: mockWriter('conveyance.open'),
  getConveyanceCaseView: jest.fn(async () => ({ ok: true, value: null })),
  readOwnedConveyanceCase: jest.fn(async () => null),
}));

// Η βιτρίνα: ό,τι τρέχει ΜΕΤΑ τη φόρτωση του ακινήτου είναι ψεύτικο — η φόρτωση είναι πραγματική.
jest.mock('@/services/property-showcase/brand-logo-assets', () => ({ loadBrandLogoAssets: jest.fn() }));
jest.mock('@/services/property-media/property-media.service', () => ({ countPropertyMedia: async () => 0 }));
jest.mock('@/services/company/company-branding-resolver', () => ({
  resolveShowcaseCompanyBranding: async () => { wrote('showcase.proceeded'); return {}; },
}));
jest.mock('@/services/property-showcase/snapshot-builder', () => ({
  loadShowcaseRelations: async () => ({}),
  buildPropertyShowcaseSnapshot: jest.fn(),
}));
jest.mock('@/services/property-showcase/labels', () => ({ loadShowcasePdfLabels: jest.fn() }));
jest.mock('@/services/pdf/PropertyShowcasePDFService', () => ({ createPropertyShowcasePdfService: jest.fn() }));
jest.mock('../showcase/generate/showcase-pdf-assets', () => ({
  loadShowcaseFloorplans: jest.fn(),
  loadShowcaseLinkedSpaceFloorplans: jest.fn(),
  loadShowcasePhotos: jest.fn(),
  loadShowcasePropertyFloorFloorplans: jest.fn(),
}));

import type { NextRequest } from 'next/server';
import { ARCHIVED_STATUS, TRASHED_STATUS } from '@/lib/firestore/trashed-status';
import { POST as postActivity } from '../activity/route';
import { GET as getCheques, POST as postCheque } from '../cheques/route';
import { POST as postPaymentPlan } from '../payment-plan/route';
import { POST as postInstallment } from '../payment-plan/installments/route';
import { POST as postPayment } from '../payments/route';
import { POST as postConveyanceCase } from '../../../conveyance-cases/route';
import { loadShowcaseSources } from '../showcase/generate/helpers';

const PROPERTY_ID = 'prop_1';
const base = { companyId: 'comp_1', name: 'Α2', commercialStatus: 'unavailable' };

type RouteHandler = (request: NextRequest, segment: { params: Promise<{ id: string }> }) => unknown;

function call(handler: unknown, path: string, body: Record<string, unknown> = {}): unknown {
  const url = `http://localhost:3000/api/properties/${PROPERTY_ID}${path}`;
  const request = { url, nextUrl: new URL(url), json: async () => body, text: async () => JSON.stringify(body) };
  return (handler as RouteHandler)(request as unknown as NextRequest, { params: Promise.resolve({ id: PROPERTY_ID }) });
}

/** Η άρνηση ως `[status, κωδικός]` — ή `null` αν η διαδρομή προχώρησε. */
async function refusalOf(run: () => unknown): Promise<readonly [number, string | undefined] | null> {
  try {
    await run();
    return null;
  } catch (err) {
    const refusal = err as { statusCode?: number; errorCode?: string };
    return [refusal.statusCode ?? 0, refusal.errorCode];
  }
}

/** Κάθε πόρτα που **γράφει** πάνω σε ακίνητο, μία ανά οικογένεια. */
const BACK_DOORS: ReadonlyArray<readonly [string, () => unknown]> = [
  ['γραμμή ιστορικού (activity)', () => call(postActivity, '/activity', { action: 'updated', changes: [{ field: 'x', oldValue: null, newValue: 'y' }] })],
  ['επιταγή', () => call(postCheque, '/cheques', {})],
  ['πλάνο πληρωμών', () => call(postPaymentPlan, '/payment-plan', {})],
  ['δόση', () => call(postInstallment, '/payment-plan/installments', {})],
  ['πληρωμή', () => call(postPayment, '/payments', {})],
  ['υπόθεση μεταβίβασης', () => call(postConveyanceCase, '', { propertyId: PROPERTY_ID })],
  ['βιτρίνα (δημιουργία · αναγέννηση · pdf)', () => loadShowcaseSources(PROPERTY_ID, 'comp_1')],
];

beforeEach(() => {
  wrote.mockClear();
});

describe.each([
  ['αρχείο', ARCHIVED_STATUS],
  ['κάδος', TRASHED_STATUS],
])('🔴 ακίνητο στο %s — καμία πίσω πόρτα δεν γράφει', (_place, status) => {
  it.each(BACK_DOORS)('%s ⇒ 409 ENTITY_RETIRED, καμία γραφή', async (_door, run) => {
    stored = { ...base, status, previousStatus: 'unavailable' };

    const refusal = await refusalOf(run);

    expect(wrote).not.toHaveBeenCalled();
    expect(refusal).toEqual([409, 'ENTITY_RETIRED']);
  });

  it('η ΑΝΑΓΝΩΣΗ μένει ανοιχτή — το πλαίσιο πρέπει να μπορεί να δείξει το αποσυρμένο', async () => {
    stored = { ...base, status, previousStatus: 'unavailable' };

    expect(await refusalOf(() => call(getCheques, '/cheques'))).toBeNull();
  });
});

describe('ζωντανό ακίνητο — ο φρουρός δεν το αγγίζει', () => {
  it.each(BACK_DOORS)('%s ⇒ δεν αρνείται ως αποσυρμένο', async (_door, run) => {
    stored = { ...base, status: 'unavailable' };

    const refusal = await refusalOf(run);

    expect(refusal?.[1]).not.toBe('ENTITY_RETIRED');
  });
});
