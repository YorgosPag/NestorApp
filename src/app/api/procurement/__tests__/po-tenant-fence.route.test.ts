/**
 * ADR-923 κύμα 3 Λ5 — ο φράχτης εταιρείας του `/api/procurement/[poId]` ζει στην ΥΠΗΡΕΣΙΑ.
 *
 * Το κενό: το `getPurchaseOrder(poId)` διάβαζε χωρίς εταιρεία και οι υπηρεσίες (έγκριση, παραγγελία,
 * κλείσιμο, ακύρωση, παραλαβή, επεξεργασία, αντιγραφή, διαγραφή) δεν ρωτούσαν ποτέ ποιανού είναι η
 * παραγγελία ⇒ ξένη εταιρεία διάβαζε/ενέκρινε/έσβηνε PO.
 *
 * Εδώ τρέχουν ΑΛΗΘΙΝΑ: το route (`defineRoute`), οι υπηρεσίες (`procurement-service`,
 * `po-status-service`) και ο φράχτης (`po-tenant-scope`). Ψεύτικα είναι μόνο η βάση (repository) και οι
 * παρενέργειες (ίχνος, ειδοποίηση). Άρα αν αφαιρεθεί ο έλεγχος από την υπηρεσία, αυτό το αρχείο κοκκινίζει
 * — και αν κάποιος τον «διορθώσει» μόνο στο route, οι υπηρεσίες μένουν εκτεθειμένες σε κάθε άλλον καλούντα.
 */

jest.mock('server-only', () => ({}));

jest.mock('next/server', () =>
  jest.requireActual<typeof import('@/test-utils/next-response-json-mock')>('@/test-utils/next-response-json-mock')
    .nextServerJsonMock(),
);

jest.mock('@/lib/middleware/with-rate-limit', () => ({
  withHighRateLimit: <T>(h: T) => h,
  withStandardRateLimit: <T>(h: T) => h,
  withSensitiveRateLimit: <T>(h: T) => h,
  withHeavyRateLimit: <T>(h: T) => h,
  withWebhookRateLimit: <T>(h: T) => h,
  withTelegramRateLimit: <T>(h: T) => h,
}));

var authCtx = {
  uid: 'user_1',
  companyId: 'comp_1',
  email: 'g@example.com',
  globalRole: 'company_admin',
  isAuthenticated: true as const,
};

jest.mock('@/lib/auth', () => ({
  withAuth: (callback: (...args: unknown[]) => Promise<unknown>) =>
    async (request: unknown, segmentData?: unknown) =>
      callback(request, authCtx, { cache: true }, segmentData),
  logAuditEvent: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/lib/telemetry/Logger', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

/** Τα logs ανά module — για να φανεί ότι η άρνηση εγγραφής του bypass ρόλου λέγεται «denied» (Λ5β Μ5). */
type ModuleLog = { info: jest.Mock; warn: jest.Mock; error: jest.Mock };
jest.mock('@/lib/telemetry', () => {
  const logs: Record<string, ModuleLog> = {};
  return {
    moduleLogs: logs,
    createModuleLogger: (name: string) => {
      logs[name] = logs[name] ?? { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
      return logs[name];
    },
  };
});
const { moduleLogs } = jest.requireMock<{ moduleLogs: Record<string, ModuleLog> }>('@/lib/telemetry');

jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: jest.fn(() => Promise.resolve()) },
}));
jest.mock('@/services/procurement/po-notification-service', () => ({
  notifyPOApproved: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/subapps/procurement/services/framework-agreement-service', () => ({
  listFrameworkAgreements: jest.fn(async () => []),
}));
jest.mock('@/services/enterprise-id.service', () => ({ generatePOItemId: jest.fn(() => 'poi_new') }));

var repo = {
  getPurchaseOrder: jest.fn(),
  updatePurchaseOrder: jest.fn(async () => undefined),
  updatePOStatus: jest.fn(async () => undefined),
  softDeletePurchaseOrder: jest.fn(async () => undefined),
  recordDelivery: jest.fn(async () => ({ newStatus: 'delivered' })),
  createPurchaseOrder: jest.fn(async () => ({ id: 'po_copy', poNumber: 'PO-0002' })),
};
jest.mock('@/services/procurement/procurement-repository', () => ({
  getPurchaseOrder: (...a: unknown[]) => repo.getPurchaseOrder(...a),
  updatePurchaseOrder: (...a: unknown[]) => repo.updatePurchaseOrder(...a),
  updatePOStatus: (...a: unknown[]) => repo.updatePOStatus(...a),
  softDeletePurchaseOrder: (...a: unknown[]) => repo.softDeletePurchaseOrder(...a),
  recordDelivery: (...a: unknown[]) => repo.recordDelivery(...a),
  createPurchaseOrder: (...a: unknown[]) => repo.createPurchaseOrder(...a),
  listPurchaseOrders: jest.fn(async () => []),
  linkInvoice: jest.fn(),
  getPriceHistory: jest.fn(async () => []),
}));

import type { NextRequest } from 'next/server';
import { GET, PATCH, DELETE } from '../[poId]/route';

interface Envelope {
  status: number;
  json: () => Promise<Record<string, unknown>>;
}

const seg = { params: Promise.resolve({ poId: 'po_1' }) };
const BASE = 'https://app.test/api/procurement/po_1';

function req(url: string, method: string, body?: unknown): NextRequest {
  return { url, method, json: async () => body } as unknown as NextRequest;
}

function storedPO(companyId: string | null, status = 'ordered') {
  return {
    id: 'po_1', poNumber: 'PO-0001', companyId, projectId: 'p_1', buildingId: null, supplierId: 'sup_1', status,
    items: [{ id: 'poi_1', description: 'x', quantity: 2, unit: 'kg', unitPrice: 1, total: 2, boqItemId: null,
      categoryCode: 'A1', materialId: null, faDiscount: null, quantityReceived: 0, quantityRemaining: 2 }],
    taxRate: 24, total: 2.48, deliveryAddress: null, paymentTermsDays: null, supplierNotes: null, internalNotes: null,
    dateCreated: '2026-10-01T00:00:00.000Z', isDeleted: false, createdBy: 'u_other',
  };
}

/** Κάθε πράξη PATCH, με σώμα που περνά την επικύρωση — ώστε το 404 να έρχεται ΜΟΝΟ από τον φράχτη. */
const PATCH_ACTIONS: ReadonlyArray<readonly [string, unknown]> = [
  ['approve', {}],
  ['order', {}],
  ['close', {}],
  ['cancel', { reason: 'plan_change' }],
  ['record-delivery', { items: [{ itemId: 'poi_1', quantityReceived: 1 }] }],
  ['duplicate', {}],
  ['update', { internalNotes: 'note' }],
];

function expectNoWrite(): void {
  expect(repo.updatePurchaseOrder).not.toHaveBeenCalled();
  expect(repo.updatePOStatus).not.toHaveBeenCalled();
  expect(repo.softDeletePurchaseOrder).not.toHaveBeenCalled();
  expect(repo.recordDelivery).not.toHaveBeenCalled();
  expect(repo.createPurchaseOrder).not.toHaveBeenCalled();
}

async function bodyOf(res: Envelope): Promise<Record<string, unknown>> {
  return res.json();
}

beforeEach(() => {
  jest.clearAllMocks();
  authCtx.companyId = 'comp_1';
  authCtx.globalRole = 'company_admin';
});

describe('GET — ξένη παραγγελία είναι αδιάκριτη από ανύπαρκτη', () => {
  it('foreign PO → 404, byte-identical to a missing PO', async () => {
    repo.getPurchaseOrder.mockResolvedValue(storedPO('comp_other'));
    const foreign = (await GET(req(BASE, 'GET'), seg)) as Envelope;

    repo.getPurchaseOrder.mockResolvedValue(null);
    const missing = (await GET(req(BASE, 'GET'), seg)) as Envelope;

    expect(foreign.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(await bodyOf(foreign)).toEqual(await bodyOf(missing));
  });

  it('own PO → 200 (positive control: the 404 above comes from the fence, not a broken route)', async () => {
    repo.getPurchaseOrder.mockResolvedValue(storedPO('comp_1'));
    const res = (await GET(req(BASE, 'GET'), seg)) as Envelope;
    expect(res.status).toBe(200);
  });

  it('PO without a tenant and a caller with an empty companyId do NOT match (empty-tenant trap)', async () => {
    authCtx.companyId = '';
    repo.getPurchaseOrder.mockResolvedValue(storedPO(''));
    const res = (await GET(req(BASE, 'GET'), seg)) as Envelope;
    expect(res.status).toBe(404);
  });
});

describe('PATCH — κάθε πράξη πάνω σε ξένη παραγγελία ⇒ 404 και καμία εγγραφή', () => {
  it.each(PATCH_ACTIONS)('action=%s on a foreign PO → 404 PO not found, nothing written', async (action, body) => {
    repo.getPurchaseOrder.mockResolvedValue(storedPO('comp_other', action === 'approve' ? 'draft' : 'ordered'));
    const res = (await PATCH(req(`${BASE}?action=${action}`, 'PATCH', body), seg)) as Envelope;
    expect(res.status).toBe(404);
    expect((await bodyOf(res)).error).toBe('PO not found');
    expectNoWrite();
  });

  it('own PO → the action runs (positive control)', async () => {
    repo.getPurchaseOrder.mockResolvedValue(storedPO('comp_1', 'draft'));
    const res = (await PATCH(req(`${BASE}?action=approve`, 'PATCH', {}), seg)) as Envelope;
    expect(res.status).toBe(200);
    expect(repo.updatePOStatus).toHaveBeenCalledWith('po_1', 'approved', { approvedBy: 'user_1' });
  });
});

describe('DELETE — ξένη παραγγελία δεν σβήνεται', () => {
  it('foreign PO → 404 PO not found, no soft delete', async () => {
    repo.getPurchaseOrder.mockResolvedValue(storedPO('comp_other'));
    const res = (await DELETE(req(BASE, 'DELETE'), seg)) as Envelope;
    expect(res.status).toBe(404);
    expect((await bodyOf(res)).error).toBe('PO not found');
    expectNoWrite();
  });

  it('own PO → 200 and soft-deleted (positive control)', async () => {
    repo.getPurchaseOrder.mockResolvedValue(storedPO('comp_1'));
    const res = (await DELETE(req(BASE, 'DELETE'), seg)) as Envelope;
    expect(res.status).toBe(200);
    expect(repo.softDeletePurchaseOrder).toHaveBeenCalledWith('po_1');
  });
});

describe('bypass ρόλος — διαβάζει (ADR-232, καταγράφεται), ΔΕΝ μεταβάλλει ξένη παραγγελία', () => {
  beforeEach(() => {
    authCtx.globalRole = 'super_admin';
    repo.getPurchaseOrder.mockResolvedValue(storedPO('comp_other'));
  });

  it('GET foreign PO → 200', async () => {
    const res = (await GET(req(BASE, 'GET'), seg)) as Envelope;
    expect(res.status).toBe(200);
  });

  it('DELETE foreign PO → 404, nothing written (the audit row would land in the wrong ledger)', async () => {
    const res = (await DELETE(req(BASE, 'DELETE'), seg)) as Envelope;
    expect(res.status).toBe(404);
    expectNoWrite();
  });

  it('the refused write is logged as DENIED, not only as «Cross-tenant access» (Λ5β Μ5)', async () => {
    await DELETE(req(BASE, 'DELETE'), seg);
    expect(moduleLogs.PurchaseOrderTenantScope.warn).toHaveBeenCalledWith(
      expect.stringContaining('denied'),
      expect.objectContaining({ action: 'delete', poId: 'po_1', callerCompanyId: 'comp_1' }),
    );
  });

  it('the allowed read logs no denial', async () => {
    await GET(req(BASE, 'GET'), seg);
    expect(moduleLogs.PurchaseOrderTenantScope.warn).not.toHaveBeenCalled();
  });
});

describe('διαγραμμένη παραγγελία = ανύπαρκτη (Λ5β Μ6)', () => {
  beforeEach(() => {
    repo.getPurchaseOrder.mockResolvedValue({ ...storedPO('comp_1', 'draft'), isDeleted: true });
  });

  it('GET → 404 PO not found', async () => {
    const res = (await GET(req(BASE, 'GET'), seg)) as Envelope;
    expect(res.status).toBe(404);
    expect((await bodyOf(res)).error).toBe('PO not found');
  });

  it.each(PATCH_ACTIONS)('PATCH action=%s → 404, nothing written', async (action, body) => {
    const res = (await PATCH(req(`${BASE}?action=${action}`, 'PATCH', body), seg)) as Envelope;
    expect(res.status).toBe(404);
    expectNoWrite();
  });

  it('DELETE again → 404, nothing written', async () => {
    const res = (await DELETE(req(BASE, 'DELETE'), seg)) as Envelope;
    expect(res.status).toBe(404);
    expectNoWrite();
  });
});
