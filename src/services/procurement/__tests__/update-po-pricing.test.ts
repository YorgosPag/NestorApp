/**
 * `updatePO` — η επεξεργασία ΚΡΑΤΑ τους όρους της παραγγελίας (ADR-923 §5.11 «3γ», Α9).
 *
 * Ζωντανό εύρημα Σ6: με δεύτερη εξίσου ειδική σύμβαση μετά τη δημιουργία, ΚΑΘΕ PATCH (ακόμα και
 * μόνο-σημειώσεις) ξανατιμολογούσε και έσβηνε σιωπηλά την έκπτωση (1.178 → 1.240).
 */

jest.mock('server-only', () => ({}));
jest.mock('@/lib/auth', () => ({ logAuditEvent: jest.fn(() => Promise.resolve()) }));
jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: jest.fn(() => Promise.resolve()) },
}));
jest.mock('@/subapps/procurement/services/framework-agreement-service', () => ({
  listFrameworkAgreements: jest.fn(),
}));
jest.mock('@/services/enterprise-id.service', () => ({ generatePOItemId: jest.fn(() => 'poi_new') }));
jest.mock('../procurement-repository', () => ({
  getPurchaseOrder: jest.fn(),
  updatePurchaseOrder: jest.fn(() => Promise.resolve()),
}));

import { logAuditEvent, type AuthContext } from '@/lib/auth';
import { listFrameworkAgreements } from '@/subapps/procurement/services/framework-agreement-service';
import { POPricingConflictError } from '@/lib/procurement/po-pricing-carry';
import { FA_INSIDE_MS, makeAgreement } from '@/subapps/procurement/__fixtures__/framework-agreement-fixture';
import type { POItemInput, PurchaseOrder, PurchaseOrderItem } from '@/types/procurement';
import { getPurchaseOrder, updatePurchaseOrder } from '../procurement-repository';
import { updatePO } from '../procurement-service';

const ctx = { uid: 'u1', companyId: 'co_1', globalRole: 'user', email: 'a@b.gr' } as unknown as AuthContext;

const FWA_1 = makeAgreement('fwa_1', { applicableMaterialIds: ['m_cable'] });
const FWA_2 = makeAgreement('fwa_2', { applicableMaterialIds: ['m_cable'], flatDiscountPercent: 15 });

function item(id: string, materialId: string, categoryCode: string, faDiscount: PurchaseOrderItem['faDiscount']): PurchaseOrderItem {
  return {
    id, description: id, quantity: 1, unit: 'τεμ', unitPrice: 500, total: 500, boqItemId: null,
    categoryCode, materialId, faDiscount, quantityReceived: 0, quantityRemaining: 1,
  };
}

/** PO-0001 όπως είναι στη βάση: καλώδιο −10% (FWA-001) + σκυρόδεμα ⇒ 1.178. */
function po0001(): PurchaseOrder {
  return {
    id: 'po_1', poNumber: 'PO-0001', companyId: 'co_1', projectId: 'p_1', buildingId: null, supplierId: 'sup_1',
    status: 'draft',
    items: [
      item('poi_cable', 'm_cable', 'OIK-9', { agreementId: 'fwa_1', discountPercent: 10, discountAmount: 50 }),
      item('poi_concrete', 'm_concrete', 'OIK-2', null),
    ],
    currency: 'EUR', subtotal: 1000, faDiscountAmount: 50, taxableAmount: 950, taxRate: 24, taxAmount: 228, total: 1178,
    dateCreated: new Date(FA_INSIDE_MS).toISOString(), dateNeeded: null, dateOrdered: null, dateDelivered: null,
    dateInvoiced: null, deliveryAddress: null, paymentTermsDays: null, paymentDueDate: null, linkedInvoiceIds: [],
    supplierNotes: null, internalNotes: null, attachments: [], cancellationReason: null, cancellationComment: null,
    sourceQuoteId: null, appliedFaIds: ['fwa_1'], createdBy: 'u1', approvedBy: null, updatedAt: '', isDeleted: false,
  };
}

/** Οι γραμμές όπως τις στέλνει η φόρμα (χωρίς id, χωρίς όρους). */
function formItems(po: PurchaseOrder): POItemInput[] {
  return po.items.map(({ description, quantity, unit, unitPrice, total, boqItemId, categoryCode, materialId }) => ({
    description, quantity, unit, unitPrice, total, boqItemId, categoryCode, materialId: materialId ?? null,
  }));
}

function savedUpdates(): Partial<PurchaseOrder> {
  const calls = jest.mocked(updatePurchaseOrder).mock.calls;
  return calls[calls.length - 1][1];
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getPurchaseOrder).mockResolvedValue(po0001());
  jest.mocked(listFrameworkAgreements).mockResolvedValue([FWA_1, FWA_2]);
});

describe('Σ6 — δεύτερη εξίσου ειδική σύμβαση μετά τη δημιουργία', () => {
  it('PATCH μόνο σημειώσεων ⇒ το πληρωτέο μένει 1.178', async () => {
    await updatePO(ctx, 'po_1', { internalNotes: 'σχόλιο' });
    expect(savedUpdates()).toMatchObject({ total: 1178, faDiscountAmount: 50, appliedFaIds: ['fwa_1'] });
    expect(logAuditEvent).not.toHaveBeenCalledWith(ctx, 'procurement.po.repriced', expect.anything(), expect.anything(), expect.anything());
  });

  it('η φόρμα στέλνει όλες τις γραμμές ⇒ ίδιοι όροι και ίδια ids γραμμών', async () => {
    await updatePO(ctx, 'po_1', { items: formItems(po0001()), expectedTotal: 1178 });
    const updates = savedUpdates();
    expect(updates.total).toBe(1178);
    expect(updates.items?.map((i) => i.id)).toEqual(['poi_cable', 'poi_concrete']);
    expect(updates.items?.[0].faDiscount).toEqual({ agreementId: 'fwa_1', discountPercent: 10, discountAmount: 50 });
  });

  it('η φόρμα έδειξε άλλο πληρωτέο ⇒ 409, καμία εγγραφή', async () => {
    await expect(updatePO(ctx, 'po_1', { items: formItems(po0001()), expectedTotal: 1240 })).rejects.toBeInstanceOf(POPricingConflictError);
    expect(updatePurchaseOrder).not.toHaveBeenCalled();
  });

  it('ρητή Επανατιμολόγηση ⇒ σημερινοί όροι (ισοπαλία ⇒ 1.240) + ίχνος με παλιό/νέο σύνολο', async () => {
    await updatePO(ctx, 'po_1', { items: formItems(po0001()), pricingMode: 'redetermine', expectedTotal: 1240 });
    expect(savedUpdates()).toMatchObject({ total: 1240, faDiscountAmount: 0, appliedFaIds: [] });
    expect(logAuditEvent).toHaveBeenCalledWith(ctx, 'procurement.po.repriced', 'po_1', 'purchase_order', {
      metadata: expect.objectContaining({ pricingMode: 'redetermine', oldTotal: 1178, newTotal: 1240 }),
    });
  });

  it('νέα γραμμή ⇒ νέο id μόνο σε αυτή', async () => {
    const items = [...formItems(po0001()), { ...formItems(po0001())[1], description: 'τσιμέντο', materialId: 'm_cement', unitPrice: 200, total: 200 }];
    await updatePO(ctx, 'po_1', { items });
    expect(savedUpdates().items?.map((i) => i.id)).toEqual(['poi_cable', 'poi_concrete', 'poi_new']);
    expect(savedUpdates().faDiscountAmount).toBe(50);
  });
});
