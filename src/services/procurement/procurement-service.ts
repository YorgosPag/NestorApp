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
  PO_STATUS_TRANSITIONS,
  type PurchaseOrderStatus,
  type CreatePurchaseOrderDTO,
  type UpdatePurchaseOrderDTO,
  type RecordDeliveryDTO,
  type PurchaseOrder,
  type POCancellationReason,
  type ProcurementAuditAction,
} from '@/types/procurement';
import { EntityAuditService } from '@/services/entity-audit.service';
import { notifyPOApproved } from './po-notification-service';
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

// ============================================================================
// VALIDATION
// ============================================================================

/** Validate status transition is allowed */
function assertTransition(
  from: PurchaseOrderStatus,
  to: PurchaseOrderStatus
): void {
  const allowed = PO_STATUS_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new Error(
      `Invalid status transition: ${from} → ${to}. Allowed: ${allowed.join(', ')}`
    );
  }
}

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
  await logAuditEvent(ctx, action as string, poId, 'purchase_order', {
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

  const result = await createPurchaseOrder(
    ctx.companyId,
    ctx.userId,
    dto
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
    performedBy: ctx.userId,
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

  await updatePurchaseOrder(poId, updates);

  await audit(ctx, 'procurement.po.items_edited', poId, {
    poNumber: po.poNumber,
    fieldsChanged: Object.keys(updates).join(', '),
  });
}

// ============================================================================
// STATUS TRANSITIONS
// ============================================================================

export async function approvePO(
  ctx: AuthContext,
  poId: string
): Promise<void> {
  const po = await getPurchaseOrder(poId);
  if (!po) throw new Error(`PO not found: ${poId}`);

  assertTransition(po.status, 'approved');

  await updatePOStatus(poId, 'approved', {
    approvedBy: ctx.userId,
  });

  await audit(ctx, 'procurement.po.approved', poId, {
    poNumber: po.poNumber,
  });

  // Entity audit trail
  EntityAuditService.recordChange({
    entityType: 'purchase_order',
    entityId: poId,
    entityName: po.poNumber,
    action: 'status_changed',
    changes: [{ field: 'status', oldValue: 'draft', newValue: 'approved', label: 'Status' }],
    performedBy: ctx.userId,
    performedByName: null,
    companyId: ctx.companyId,
  }).catch(() => {});

  // Notify creator that PO was approved
  notifyPOApproved(po, po.createdBy).catch(() => {});
}

export async function markOrdered(
  ctx: AuthContext,
  poId: string
): Promise<void> {
  const po = await getPurchaseOrder(poId);
  if (!po) throw new Error(`PO not found: ${poId}`);

  assertTransition(po.status, 'ordered');

  // Auto-calculate payment due date
  const paymentDueDate =
    po.paymentTermsDays != null
      ? new Date(
          Date.now() + po.paymentTermsDays * 24 * 60 * 60 * 1000
        ).toISOString()
      : null;

  await updatePOStatus(poId, 'ordered', { paymentDueDate });

  await audit(ctx, 'procurement.po.ordered', poId, {
    poNumber: po.poNumber,
  });

  EntityAuditService.recordChange({
    entityType: 'purchase_order',
    entityId: poId,
    entityName: po.poNumber,
    action: 'status_changed',
    changes: [{ field: 'status', oldValue: 'approved', newValue: 'ordered', label: 'Status' }],
    performedBy: ctx.userId,
    performedByName: null,
    companyId: ctx.companyId,
  }).catch(() => {});
}

export async function closePO(
  ctx: AuthContext,
  poId: string
): Promise<void> {
  const po = await getPurchaseOrder(poId);
  if (!po) throw new Error(`PO not found: ${poId}`);

  assertTransition(po.status, 'closed');

  await updatePOStatus(poId, 'closed');

  await audit(ctx, 'procurement.po.status_changed', poId, {
    poNumber: po.poNumber,
    from: po.status,
    to: 'closed',
  });

  EntityAuditService.recordChange({
    entityType: 'purchase_order',
    entityId: poId,
    entityName: po.poNumber,
    action: 'status_changed',
    changes: [{ field: 'status', oldValue: po.status, newValue: 'closed', label: 'Status' }],
    performedBy: ctx.userId,
    performedByName: null,
    companyId: ctx.companyId,
  }).catch(() => {});
}

export async function cancelPO(
  ctx: AuthContext,
  poId: string,
  reason: POCancellationReason,
  comment?: string
): Promise<void> {
  const po = await getPurchaseOrder(poId);
  if (!po) throw new Error(`PO not found: ${poId}`);

  assertTransition(po.status, 'cancelled');

  await updatePOStatus(poId, 'cancelled', {
    cancellationReason: reason,
    cancellationComment: comment ?? null,
  });

  await audit(ctx, 'procurement.po.cancelled', poId, {
    poNumber: po.poNumber,
    reason,
  });

  EntityAuditService.recordChange({
    entityType: 'purchase_order',
    entityId: poId,
    entityName: po.poNumber,
    action: 'status_changed',
    changes: [
      { field: 'status', oldValue: po.status, newValue: 'cancelled', label: 'Status' },
      { field: 'cancellationReason', oldValue: null, newValue: reason, label: 'Reason' },
    ],
    performedBy: ctx.userId,
    performedByName: null,
    companyId: ctx.companyId,
  }).catch(() => {});
}

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
    performedBy: ctx.userId,
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
    performedBy: ctx.userId,
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
    performedBy: ctx.userId,
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
