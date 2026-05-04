/**
 * Procurement Service — Business Logic & Validation
 *
 * Orchestrates repository calls, enforces status transitions,
 * calculates financials, and logs audit events.
 *
 * @module services/procurement/procurement-service
 * @see ADR-267 §4.3 (Status State Machine)
 */

import { logAuditEvent } from '@/lib/auth';
import type { AuthContext } from '@/lib/auth';
import {
  type CreatePurchaseOrderDTO,
  type UpdatePurchaseOrderDTO,
  type RecordDeliveryDTO,
  type PurchaseOrder,
  type ProcurementAuditAction,
} from '@/types/procurement';
import { EntityAuditService } from '@/services/entity-audit.service';
import {
  loadAndComputeFaDiscount,
  computeGrossTotal,
} from '@/lib/procurement/recompute-fa-discount';
import {
  createPurchaseOrder,
  getPurchaseOrder,
  listPurchaseOrders,
  updatePurchaseOrder,
  updatePOStatus,
  softDeletePurchaseOrder,
  recordDelivery,
  linkInvoice,
  getPriceHistory,
  type POListFilters,
  type PriceHistoryEntry,
} from './procurement-repository';
import { generatePOItemId } from '@/services/enterprise-id.service';
import { nowISO } from '@/lib/date-local';

// ============================================================================
// VALIDATION
// ============================================================================

// `assertTransition` extracted to po-status-service.ts (2026-05-04) along
// with the four FSM functions that consumed it.

/** Validate DTO has required fields */
function validateCreateDTO(dto: CreatePurchaseOrderDTO): string | null {
  if (!dto.projectId) return 'projectId is required';
  if (!dto.supplierId) return 'supplierId is required';
  if (!dto.items || dto.items.length === 0) return 'At least 1 item is required';
  if (dto.items.length > 100) return 'Max 100 items per PO';

  for (let i = 0; i < dto.items.length; i++) {
    const item = dto.items[i];
    if (!item.description) return `Item ${i + 1}: description is required`;
    if (item.quantity <= 0) return `Item ${i + 1}: quantity must be > 0`;
    if (item.unitPrice < 0) return `Item ${i + 1}: unitPrice must be >= 0`;
    if (!item.categoryCode) return `Item ${i + 1}: categoryCode (ΑΤΟΕ) is required`;
  }

  return null;
}

// ============================================================================
// AUDIT HELPER
// ============================================================================

async function audit(
  ctx: AuthContext,
  action: ProcurementAuditAction,
  poId: string,
  meta?: Record<string, unknown>
): Promise<void> {
  await logAuditEvent(ctx, action, poId, 'purchase_order', {
    metadata: meta as Record<string, string | number | boolean | null> | undefined,
  });
}

// ============================================================================
// CREATE
// ============================================================================

export async function createPO(
  ctx: AuthContext,
  dto: CreatePurchaseOrderDTO
): Promise<{ id: string; poNumber: string }> {
  const validationError = validateCreateDTO(dto);
  if (validationError) throw new Error(validationError);

  // Phase 5.5 (server-side validation, 2026-05-04) — recompute FA discount
  // server-side from canonical framework_agreements collection. Any client-
  // submitted FA fields on `dto` are discarded.
  const grossTotal = computeGrossTotal(dto.items, dto.taxRate);
  const faFields = await loadAndComputeFaDiscount(
    ctx,
    dto.supplierId,
    dto.projectId,
    grossTotal,
  );

  const result = await createPurchaseOrder(
    ctx.companyId,
    ctx.uid,
    {
      ...dto,
      appliedFaId: faFields.appliedFaId,
      faDiscountPercent: faFields.faDiscountPercent,
      faDiscountAmount: faFields.faDiscountAmount,
      netTotal: faFields.netTotal,
    }
  );

  await audit(ctx, 'procurement.po.created', result.id, {
    poNumber: result.poNumber,
    supplierId: dto.supplierId,
    projectId: dto.projectId,
    itemCount: dto.items.length,
  });

  // Entity audit trail (fire-and-forget)
  EntityAuditService.recordChange({
    entityType: 'purchase_order',
    entityId: result.id,
    entityName: result.poNumber,
    action: 'created',
    changes: [{ field: 'status', oldValue: null, newValue: 'draft', label: 'Status' }],
    performedBy: ctx.uid,
    performedByName: null,
    companyId: ctx.companyId,
  }).catch(() => {});

  return result;
}

// ============================================================================
// READ
// ============================================================================

export async function getPO(poId: string): Promise<PurchaseOrder | null> {
  return getPurchaseOrder(poId);
}

export async function listPOs(
  filters: POListFilters
): Promise<PurchaseOrder[]> {
  return listPurchaseOrders(filters);
}

// ============================================================================
// UPDATE ITEMS / DETAILS
// ============================================================================

export async function updatePO(
  ctx: AuthContext,
  poId: string,
  dto: UpdatePurchaseOrderDTO
): Promise<void> {
  const po = await getPurchaseOrder(poId);
  if (!po) throw new Error(`PO not found: ${poId}`);

  // Only draft/approved POs can be edited
  if (!['draft', 'approved'].includes(po.status)) {
    throw new Error(`Cannot edit PO in status: ${po.status}`);
  }

  const updates: Partial<PurchaseOrder> = {};

  if (dto.projectId !== undefined) updates.projectId = dto.projectId;
  if (dto.buildingId !== undefined) updates.buildingId = dto.buildingId ?? null;
  if (dto.supplierId !== undefined) updates.supplierId = dto.supplierId;
  if (dto.dateNeeded !== undefined) updates.dateNeeded = dto.dateNeeded ?? null;
  if (dto.deliveryAddress !== undefined) updates.deliveryAddress = dto.deliveryAddress ?? null;
  if (dto.paymentTermsDays !== undefined) updates.paymentTermsDays = dto.paymentTermsDays ?? null;
  if (dto.supplierNotes !== undefined) updates.supplierNotes = dto.supplierNotes ?? null;
  if (dto.internalNotes !== undefined) updates.internalNotes = dto.internalNotes ?? null;
  // Phase 5.5 (server-side validation, 2026-05-04) — the four FA fields
  // (appliedFaId / faDiscountPercent / faDiscountAmount / netTotal) are NOT
  // copied from `dto`. They are recomputed authoritatively below from the
  // canonical framework_agreements collection.

  // Recalculate items + totals if items changed
  if (dto.items) {
    const items = dto.items.map((item) => ({
      ...item,
      id: generatePOItemId(),
      quantityReceived: 0,
      quantityRemaining: item.quantity,
    }));
    updates.items = items;

    const taxRate = dto.taxRate ?? po.taxRate;
    const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;

    updates.subtotal = subtotal;
    updates.taxRate = taxRate;
    updates.taxAmount = taxAmount;
    updates.total = Math.round((subtotal + taxAmount) * 100) / 100;
  } else if (dto.taxRate !== undefined && dto.taxRate !== po.taxRate) {
    // Tax rate changed without item changes — recalc tax
    const taxAmount = Math.round(po.subtotal * (dto.taxRate / 100) * 100) / 100;
    updates.taxRate = dto.taxRate;
    updates.taxAmount = taxAmount;
    updates.total = Math.round((po.subtotal + taxAmount) * 100) / 100;
  }

  // Phase 5.5 (server-side validation, 2026-05-04) — recompute FA discount
  // server-side after totals settle. Always runs (cheap query) so any change to
  // supplierId / projectId / items / taxRate is reflected and the doc cannot
  // drift from the canonical framework_agreements state.
  const supplierId = dto.supplierId ?? po.supplierId;
  const projectId = dto.projectId ?? po.projectId;
  const grossTotal = updates.total ?? po.total;
  const faFields = await loadAndComputeFaDiscount(
    ctx,
    supplierId,
    projectId,
    grossTotal,
  );
  updates.appliedFaId = faFields.appliedFaId;
  updates.faDiscountPercent = faFields.faDiscountPercent;
  updates.faDiscountAmount = faFields.faDiscountAmount;
  updates.netTotal = faFields.netTotal;

  await updatePurchaseOrder(poId, updates);

  await audit(ctx, 'procurement.po.items_edited', poId, {
    poNumber: po.poNumber,
    fieldsChanged: Object.keys(updates).join(', '),
  });
}

// ============================================================================
// STATUS TRANSITIONS
// ============================================================================
// `approvePO`, `markOrdered`, `closePO`, `cancelPO` were extracted to
// `po-status-service.ts` on 2026-05-04 to keep this file under the 500-line
// Google limit (CLAUDE.md N.7.1). They are re-exported via the barrel
// `./index.ts` so callers see no API change.

// ============================================================================
// DELIVERY
// ============================================================================

export async function recordPODelivery(
  ctx: AuthContext,
  poId: string,
  dto: RecordDeliveryDTO
): Promise<{ newStatus: PurchaseOrderStatus }> {
  const po = await getPurchaseOrder(poId);
  if (!po) throw new Error(`PO not found: ${poId}`);

  if (!['ordered', 'partially_delivered'].includes(po.status)) {
    throw new Error(`Cannot record delivery for PO in status: ${po.status}`);
  }

  const result = await recordDelivery(poId, dto);

  // Phase 4.5 (CF variant, 2026-05-04) — material avgPrice/lastPrice are now
  // recomputed by the `materialPriceSyncOnPODelivery` Cloud Function trigger
  // (functions/src/procurement/material-price-sync.cf.ts). The route-layer
  // fire-and-forget call has been removed; CF is the canonical SSoT.

  await audit(ctx, 'procurement.po.delivery_recorded', poId, {
    poNumber: po.poNumber,
    newStatus: result.newStatus,
    itemsDelivered: dto.items.length,
  });

  EntityAuditService.recordChange({
    entityType: 'purchase_order',
    entityId: poId,
    entityName: po.poNumber,
    action: 'status_changed',
    changes: [{ field: 'status', oldValue: po.status, newValue: result.newStatus, label: 'Status' }],
    performedBy: ctx.uid,
    performedByName: null,
    companyId: ctx.companyId,
  }).catch(() => {});

  return result;
}

// ============================================================================
// INVOICE LINKING
// ============================================================================

export async function linkInvoiceToPO(
  ctx: AuthContext,
  poId: string,
  invoiceId: string
): Promise<void> {
  await linkInvoice(poId, invoiceId);

  await audit(ctx, 'procurement.po.invoice_linked', poId, {
    invoiceId,
  });

  EntityAuditService.recordChange({
    entityType: 'purchase_order',
    entityId: poId,
    entityName: poId,
    action: 'linked',
    changes: [{ field: 'linkedInvoiceIds', oldValue: null, newValue: invoiceId, label: 'Invoice Linked' }],
    performedBy: ctx.uid,
    performedByName: null,
    companyId: ctx.companyId,
  }).catch(() => {});
}

// ============================================================================
// SOFT DELETE
// ============================================================================

export async function deletePO(
  ctx: AuthContext,
  poId: string
): Promise<void> {
  const po = await getPurchaseOrder(poId);
  if (!po) throw new Error(`PO not found: ${poId}`);

  await softDeletePurchaseOrder(poId);

  await audit(ctx, 'procurement.po.deleted', poId, {
    poNumber: po.poNumber,
  });

  EntityAuditService.recordChange({
    entityType: 'purchase_order',
    entityId: poId,
    entityName: po.poNumber,
    action: 'deleted',
    changes: [{ field: 'isDeleted', oldValue: false, newValue: true, label: 'Deleted' }],
    performedBy: ctx.uid,
    performedByName: null,
    companyId: ctx.companyId,
  }).catch(() => {});
}

// ============================================================================
// DUPLICATE PO
// ============================================================================

export async function duplicatePO(
  ctx: AuthContext,
  sourcePoId: string
): Promise<{ id: string; poNumber: string }> {
  const source = await getPurchaseOrder(sourcePoId);
  if (!source) throw new Error(`Source PO not found: ${sourcePoId}`);

  const dto: CreatePurchaseOrderDTO = {
    projectId: source.projectId,
    buildingId: source.buildingId,
    supplierId: source.supplierId,
    items: source.items.map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unit: i.unit,
      unitPrice: i.unitPrice,
      total: i.total,
      boqItemId: i.boqItemId,
      categoryCode: i.categoryCode,
    })),
    taxRate: source.taxRate,
    dateNeeded: null,
    deliveryAddress: source.deliveryAddress,
    paymentTermsDays: source.paymentTermsDays,
    supplierNotes: source.supplierNotes,
    internalNotes: source.internalNotes,
  };

  return createPO(ctx, dto);
}

// ============================================================================
// PRICE HISTORY (re-export)
// ============================================================================

export { getPriceHistory, type PriceHistoryEntry };
