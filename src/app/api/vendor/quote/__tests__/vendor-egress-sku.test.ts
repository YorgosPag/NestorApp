/**
 * @jest-environment node
 *
 * @fileoverview **Άγκυρα εξόδων: το SKU και το στιγμιότυπο τιμής δεν φεύγουν ποτέ προς προμηθευτή** (ADR-923 §5.8).
 *
 * 🔴 Το στιγμιότυπο της γραμμής RFQ είναι τιμή του προμηθευτή Α, και το ίδιο RFQ φτάνει στον ανταγωνιστή Β. Το τι ζήτησε ο αγοραστής
 * είναι επίσης εμπορικό μυστικό. Εδώ τρέχουν οι **πραγματικοί** handlers και ο πραγματικός αναγνώστης γραμμών πάνω σε αποθηκευμένο έγγραφο
 * με ΟΛΑ τα πεδία, και ελέγχεται το **σύρμα**: Ε1 GET της πύλης · Ε2 POST της πύλης · Ε3 παραγγελία (άρα PDF · email · δημόσιος σύνδεσμος).
 */

jest.mock('server-only', () => ({}));

const STORED_LINE = {
  id: 'L1', rfqId: 'rfq1', companyId: 'co1', source: 'boq', boqItemId: 'boq1', description: 'Τσιμέντο', trade: 'concrete', categoryCode: 'OIK-1',
  quantity: 2, unit: 'pcs', unitPrice: 12, notes: null, displayOrder: 0,
  catalogRef: { supplierCompanyId: 'comp-aries', variantId: 'var_secret' },
  priceSnapshot: { authority: 'supplier', supplierCompanyId: 'comp-aries', variantId: 'var_secret', priceListVersionId: 'plv_secret', breakdown: { material: 987654, labor: 0, equipment: 0 } },
  futureInternalField: 'internal_canary',
};
const SECRETS = ['comp-aries', 'var_secret', 'plv_secret', '987654', 'internal_canary', 'catalogRef', 'priceSnapshot'];

const STORED_QUOTE_LINE = {
  id: 'ql1', description: 'Τσιμέντο', categoryCode: 'OIK-1', quantity: 2, unit: 'pcs', unitPrice: 10, vatRate: 24, lineTotal: 20, notes: null, rfqLineId: 'L1',
  catalogRef: STORED_LINE.catalogRef, futureInternalField: 'internal_canary',
};

const mockLines = { orderBy: () => ({ get: async () => ({ docs: [{ id: 'L1', data: () => STORED_LINE }] }) }) };
const mockDb = { collection: () => ({ doc: () => ({ collection: () => mockLines, update: async () => undefined }) }) };
jest.mock('@/lib/firebaseAdmin', () => ({
  safeFirestoreOperation: async (operation: (db: unknown) => Promise<unknown>) => operation(mockDb),
  getAdminFirestore: () => mockDb,
}));

const OPENED = {
  invite: { id: 'inv1', companyId: 'co1', rfqId: 'rfq1', vendorContactId: 'cont_vendor', status: 'submitted', editWindowExpiresAt: null },
  credential: { id: 'cred1', expiresAt: '2026-12-01T00:00:00.000Z' },
};
jest.mock('@/server/vendor-portal/vendor-link-door', () => ({
  withVendorLinkDoor: (_options: unknown, handler: (request: unknown, opened: unknown) => Promise<unknown>) => (request: unknown) => handler(request, OPENED),
  vendorPortalError: (error: string, status: number) => new Response(JSON.stringify({ success: false, error }), { status }),
}));
jest.mock('@/lib/middleware/with-rate-limit', () => ({ withHeavyRateLimit: <T,>(handler: T) => handler }));
jest.mock('next/server', () => ({ ...jest.requireActual('next/server'), after: jest.fn() }));

const RFQ = { id: 'rfq1', companyId: 'co1', title: 'RFQ', description: null, lines: [], linesStorage: 'boq', deadlineDate: null, projectId: 'p1', buildingId: null, createdBy: 'u1' };
jest.mock('@/subapps/procurement/services/rfq-service', () => ({ getRfq: jest.fn(async () => RFQ) }));
jest.mock('@/subapps/procurement/services/vendor-invite-service', () => ({ markInviteOpened: jest.fn(), markInviteSubmitted: jest.fn() }));
jest.mock('@/subapps/procurement/services/vendor-invite-resolver', () => ({ vendorInvitePermits: jest.fn(() => ({})) }));
jest.mock('@/services/vendor-portal/vendor-invite-credential-store', () => ({ touchVendorCredential: jest.fn() }));
jest.mock('@/server/notifications/notification-orchestrator', () => ({ dispatchProcurementNotification: jest.fn() }));
jest.mock('@/server/notifications/notification-title', () => ({ notificationFallbackTitle: jest.fn(() => '') }));
jest.mock('@/services/enterprise-id.service', () => ({ generateQuoteId: () => 'qt_1', generateQuoteLineId: () => 'ql_new', generateRfqLineId: () => 'rfqln_1' }));
jest.mock('../upload', () => ({ uploadVendorFiles: jest.fn(async () => []) }));

const mockPersist = jest.fn(async (_args: { payload: { lines: { catalogRef?: unknown }[] } }) => ({ quoteId: 'qt_1' }));
const mockExisting = jest.fn();
jest.mock('@/subapps/procurement/services/vendor-portal-submit-service', () => ({
  findExistingPortalQuote: () => mockExisting(),
  persistVendorQuote: (args: { payload: { lines: { catalogRef?: unknown }[] } }) => mockPersist(args),
}));

const mockCreatePO = jest.fn(async (_ctx: unknown, _dto: { items: unknown[] }) => ({ id: 'po1', poNumber: 'PO-1' }));
jest.mock('@/services/procurement/procurement-service', () => ({ createPO: (ctx: unknown, dto: { items: unknown[] }) => mockCreatePO(ctx, dto) }));

/* eslint-disable import/first -- τα mocks πρέπει να δηλωθούν πριν φορτωθούν οι handlers */
import type { NextRequest } from 'next/server';
import type { AuthContext } from '@/lib/auth';
import { generatePoFromAwardedQuote } from '@/subapps/procurement/services/po-generation-service';
import type { Quote } from '@/subapps/procurement/types/quote';
import { GET, POST } from '../route';
/* eslint-enable import/first */

type Handler = (request: NextRequest) => Promise<Response>;
const expectClean = (wire: string) => { for (const secret of SECRETS) expect(wire).not.toContain(secret); };

beforeEach(() => {
  jest.clearAllMocks();
  mockExisting.mockResolvedValue({
    id: 'qt_1',
    data: { id: 'qt_1', lines: [STORED_QUOTE_LINE], alternates: [STORED_QUOTE_LINE], scopeResponses: [], totals: {}, paymentTerms: null, deliveryTerms: null, warranty: null, notes: null, validUntil: null, attachments: [], status: 'submitted' },
  });
});

describe('🔒 κάθε έξοδος προς προμηθευτή', () => {
  it('Ε1 GET πύλης: ούτε από τη γραμμή RFQ ούτε από τη δική του προσφορά', async () => {
    const response = await (GET as unknown as Handler)({} as NextRequest);
    const wire = await response.text();
    expect(response.status).toBe(200);
    expect(wire).toContain('Τσιμέντο'); // το σύρμα έχει όντως γραμμές: ο έλεγχος δεν περνά στο κενό
    expectClean(wire);
  });

  it('Ε2 POST πύλης: το SKU γράφεται στην προσφορά, αλλά δεν γυρίζει στον προμηθευτή, και ο πελάτης δεν το γράφει', async () => {
    const form = new FormData();
    form.set('lines', JSON.stringify([{ description: 'πλαστό', quantity: 2, unit: 'pcs', unitPrice: 10, vatRate: 24, rfqLineId: 'L1', catalogRef: { supplierCompanyId: 'evil', variantId: 'v' } }]));
    const response = await (POST as unknown as Handler)({ formData: async () => form, headers: new Headers() } as unknown as NextRequest);
    expect(response.status).toBe(200);
    expectClean(await response.text());
    expect(mockPersist.mock.calls[0][0].payload.lines[0].catalogRef).toEqual(STORED_LINE.catalogRef);
  });

  it('Ε3 παραγγελία: τα είδη (PDF · email · δημόσιος σύνδεσμος) δεν κουβαλούν SKU', async () => {
    const winner = { id: 'qt_1', displayNumber: 'QT-1', projectId: 'p1', buildingId: null, vendorContactId: 'cont_vendor', notes: null, totals: { vatRate: 24, total: 20 }, lines: [STORED_QUOTE_LINE] } as unknown as Quote;
    await generatePoFromAwardedQuote({ uid: 'u1', companyId: 'co1' } as AuthContext, winner);
    expectClean(JSON.stringify(mockCreatePO.mock.calls[0][1].items));
  });
});
