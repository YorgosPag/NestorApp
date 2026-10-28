/**
 * ADR-923 §5.11 «3γ» Α12 — the public PO view is an ALLOWLIST.
 *
 *   Π1 · the output has EXACTLY the declared keys (top level and every line) — a spread of the
 *        stored document (`...po` / `...item`) adds keys and turns this red.
 *   Π2 · no internal value reaches the wire, at any depth (tenant · project · creator UID ·
 *        agreements · catalog/BOQ links · internal notes).
 *   Π3 · the disclosed values are carried unchanged (the page renders the same as before).
 */

import type { PurchaseOrder, PurchaseOrderItem } from '@/types/procurement';
import {
  PUBLIC_PO_FIELDS,
  PUBLIC_PO_LINE_FIELDS,
  toPublicPurchaseOrder,
} from '../po-public-projection';

const SECRET = {
  companyId: 'comp_SECRET_TENANT',
  projectId: 'proj_SECRET_PROJECT',
  buildingId: 'bld_SECRET_BUILDING',
  supplierId: 'cont_SECRET_SUPPLIER',
  createdBy: 'uid_SECRET_CREATOR',
  approvedBy: 'uid_SECRET_APPROVER',
  appliedFaId: 'fwa_SECRET_AGREEMENT',
  materialId: 'mat_SECRET_MATERIAL',
  boqItemId: 'boq_SECRET_ITEM',
  internalNotes: 'SECRET internal margin note',
  sourceQuoteId: 'qt_SECRET_QUOTE',
  invoiceId: 'inv_SECRET_INVOICE',
} as const;

function line(): PurchaseOrderItem {
  return {
    id: 'poi_1', description: 'Σκυρόδεμα C25/30', quantity: 10, unit: 'm3', unitPrice: 100, total: 1000,
    boqItemId: SECRET.boqItemId, categoryCode: 'OIK-2', materialId: SECRET.materialId,
    faDiscount: { agreementId: SECRET.appliedFaId, discountPercent: 5, discountAmount: 50 },
    quantityReceived: 3, quantityRemaining: 7,
  };
}

function storedPO(): PurchaseOrder {
  return {
    id: 'po_1', poNumber: 'PO-0001', companyId: SECRET.companyId,
    projectId: SECRET.projectId, buildingId: SECRET.buildingId, supplierId: SECRET.supplierId,
    status: 'approved', items: [line()],
    currency: 'EUR', subtotal: 1000, faDiscountAmount: 50, taxableAmount: 950, taxRate: 24, taxAmount: 228, total: 1178,
    dateCreated: '2026-10-27T10:00:00.000Z', dateNeeded: '2026-11-01', dateOrdered: null, dateDelivered: null, dateInvoiced: null,
    deliveryAddress: 'Οδός 1, Αθήνα', paymentTermsDays: 30, paymentDueDate: null,
    linkedInvoiceIds: [SECRET.invoiceId],
    supplierNotes: 'Παράδοση πρωί', internalNotes: SECRET.internalNotes,
    attachments: [], cancellationReason: null, cancellationComment: null,
    sourceQuoteId: SECRET.sourceQuoteId, appliedFaIds: [SECRET.appliedFaId],
    createdBy: SECRET.createdBy, approvedBy: SECRET.approvedBy, updatedAt: '2026-10-27T10:00:00.000Z', isDeleted: false,
  };
}

describe('toPublicPurchaseOrder — allowlist (ADR-923 «3γ» Α12)', () => {
  it('Π1 · top-level keys are exactly the declared allowlist', () => {
    const view = toPublicPurchaseOrder(storedPO());
    expect(Object.keys(view).sort()).toEqual([...PUBLIC_PO_FIELDS].sort());
  });

  it('Π1 · every line has exactly the declared line keys', () => {
    const view = toPublicPurchaseOrder(storedPO());
    for (const item of view.items) {
      expect(Object.keys(item).sort()).toEqual([...PUBLIC_PO_LINE_FIELDS].sort());
    }
  });

  it('Π2 · no internal value appears anywhere in the serialized response', () => {
    const wire = JSON.stringify(toPublicPurchaseOrder(storedPO()));
    for (const value of Object.values(SECRET)) {
      expect(wire).not.toContain(value);
    }
  });

  it('Π3 · disclosed values are carried unchanged', () => {
    expect(toPublicPurchaseOrder(storedPO())).toEqual({
      poNumber: 'PO-0001', status: 'approved', dateCreated: '2026-10-27T10:00:00.000Z', dateNeeded: '2026-11-01',
      deliveryAddress: 'Οδός 1, Αθήνα',
      items: [{ id: 'poi_1', description: 'Σκυρόδεμα C25/30', quantity: 10, unit: 'm3', unitPrice: 100, total: 1000 }],
      subtotal: 1000, faDiscountAmount: 50, taxableAmount: 950, taxAmount: 228, total: 1178, taxRate: 24,
      supplierNotes: 'Παράδοση πρωί',
    });
  });
});
