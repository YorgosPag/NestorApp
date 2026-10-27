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
  type PurchaseOrderItem,
  type POVatRate,
  type PurchaseOrderStatus,
  type ProcurementAuditAction,
} from '@/types/procurement';
import { EntityAuditService } from '@/services/entity-audit.service';
import { loadAndPricePurchaseOrder } from '@/lib/procurement/price-purchase-order';
import {
  pricedRecord,
  type POPricedRecord,
  type POPricingLine,
} from '@/lib/procurement/price-purchase-order-pure';
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
import { nowISO, normalizeToMillisOrNull } from '@/lib/date-local';

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
// PRICING — ο ΕΝΑΣ δρόμος προς τα οικονομικά μιας PO (ADR-923 §5.11 «3γ»)
// ============================================================================

interface POPricingRequest<TItem extends POPricingLine> {
  supplierId: string;
  projectId: string;
  items: readonly TItem[];
  taxRate: number;
  atMs: number;
}

/**
 * Τιμολογεί αυθεντικά (συμβάσεις από τη βάση, ποτέ από τον πελάτη) και αρνείται γραμμή που δεν
 * αναπαρίσταται ακριβώς — καμία σιωπηλή στρογγύλευση ποσότητας ή τιμής.
 */
async function pricePOItems<TItem extends POPricingLine>(
  ctx: AuthContext,
  request: POPricingRequest<TItem>,
): Promise<POPricedRecord<TItem>> {
  const pricing = await loadAndPricePurchaseOrder(ctx, request);
  const [invalid] = pricing.invalidLineIndexes;
  if (invalid !== undefined) {
    throw new Error(`Item ${invalid + 1}: quantity or unitPrice cannot be represented exactly`);
  }
  return pricedRecord(request.items, pricing);
}

/** Ημερομηνία τιμολόγησης μιας υπάρχουσας PO = ημερομηνία εγγράφου (SAP pricing date). */
function pricingDateOf(po: PurchaseOrder): number {
  return normalizeToMillisOrNull(po.dateCreated) ?? Date.now();
}

/** Τα οικονομικά πεδία μιας PO από την τιμολόγησή της. */
function financialUpdates(
  priced: POPricedRecord<PurchaseOrderItem>,
  taxRate: POVatRate,
): Partial<PurchaseOrder> {
  return {
    items: priced.items,
    subtotal: priced.subtotal,
    faDiscountAmount: priced.discountAmount,
    taxableAmount: priced.taxableAmount,
    taxRate,
    taxAmount: priced.taxAmount,
    total: priced.total,
    appliedFaIds: priced.appliedFaIds,
  };
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

  // Phase 5.5 C.2 + ADR-923 «3γ» — συμβάσεις, εκπτώσεις και σύνολα υπολογίζονται εδώ, από τη βάση.
  const priced = await pricePOItems(ctx, {
    supplierId: dto.supplierId,
    projectId: dto.projectId,
    items: dto.items,
    taxRate: dto.taxRate,
    atMs: Date.now(),
  });

  const result = await createPurchaseOrder(ctx.companyId, ctx.uid, dto, priced);

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
  // Phase 5.5 C.2 + ADR-923 «3γ» — η τιμολόγηση τρέχει ΠΑΝΤΑ (γραμμές, έργο, προμηθευτής ή ΦΠΑ
  // μπορεί να άλλαξαν) πάνω στις τελικές γραμμές, στην ημερομηνία του εγγράφου.
  const items: PurchaseOrderItem[] = dto.items
    ? dto.items.map((item) => ({
        ...item,
        id: generatePOItemId(),
        quantityReceived: 0,
        quantityRemaining: item.quantity,
      }))
    : po.items;
  const taxRate = dto.taxRate ?? po.taxRate;
  const priced = await pricePOItems(ctx, {
    supplierId: dto.supplierId ?? po.supplierId,
    projectId: dto.projectId ?? po.projectId,
    items,
    taxRate,
    atMs: pricingDateOf(po),
  });
  Object.assign(updates, financialUpdates(priced, taxRate));

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
      materialId: i.materialId ?? null,
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
