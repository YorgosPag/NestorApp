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
  type POPricing,
  type POPricingLine,
} from '@/lib/procurement/price-purchase-order-pure';
import { POPricingConflictError, type POCarryInput } from '@/lib/procurement/po-pricing-carry';
import { minorFromMajor } from '@/lib/money/money';
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
  /** Επεξεργασία: οι όροι της αποθηκευμένης PO (ADR-923 «3γ», Α9). */
  carry?: POCarryInput;
}

interface POPricingResult<TItem> {
  record: POPricedRecord<TItem>;
  pricing: POPricing;
}

/**
 * Τιμολογεί αυθεντικά (συμβάσεις από τη βάση, ποτέ από τον πελάτη) και αρνείται γραμμή που δεν
 * αναπαρίσταται ακριβώς — καμία σιωπηλή στρογγύλευση ποσότητας ή τιμής.
 */
async function pricePOItems<TItem extends POPricingLine>(
  ctx: AuthContext,
  { carry, ...input }: POPricingRequest<TItem>,
): Promise<POPricingResult<TItem>> {
  const pricing = await loadAndPricePurchaseOrder(ctx, input, carry);
  const [invalid] = pricing.invalidLineIndexes;
  if (invalid !== undefined) {
    throw new Error(`Item ${invalid + 1}: quantity or unitPrice cannot be represented exactly`);
  }
  return { record: pricedRecord(input.items, pricing), pricing };
}

/** Compare-and-set στο πληρωτέο: ό,τι έδειξε η φόρμα είναι ό,τι αποθηκεύεται — αλλιώς τίποτα. */
function assertExpectedTotal(expectedTotal: number | undefined, total: number): void {
  if (expectedTotal === undefined) return;
  if (minorFromMajor(expectedTotal) !== minorFromMajor(total)) throw new POPricingConflictError(expectedTotal, total);
}

/** Οι γραμμές που αντιστοιχούν σε αποθηκευμένες κρατούν το `id` τους· οι νέες παίρνουν καινούργιο. */
function withStableItemIds(
  items: readonly PurchaseOrderItem[],
  pricing: POPricing,
  stored: readonly PurchaseOrderItem[],
): PurchaseOrderItem[] {
  return items.map((item, index) => {
    const storedIndex = pricing.lines[index]?.storedIndex ?? null;
    return { ...item, id: storedIndex !== null ? stored[storedIndex].id : generatePOItemId() };
  });
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
  const { record: priced } = await pricePOItems(ctx, {
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
  const taxRate = dto.taxRate ?? po.taxRate;
  const { record, pricing } = await priceEditedPO(ctx, po, dto);
  Object.assign(updates, financialUpdates(record, taxRate));

  await updatePurchaseOrder(poId, updates);

  await audit(ctx, 'procurement.po.items_edited', poId, {
    poNumber: po.poNumber,
    fieldsChanged: Object.keys(updates).join(', '),
  });
  await auditRepricing(ctx, po, dto, pricing, record.total);
}

/**
 * ADR-923 «3γ» Α9 — η επεξεργασία ΚΡΑΤΑ τους όρους της PO (σύμβαση-πηγή ανά γραμμή,
 * `po-pricing-carry`), στην ημερομηνία του εγγράφου. Νέα τιμολόγηση όλων μόνο με
 * `pricingMode: 'redetermine'`. Άλλο πληρωτέο από αυτό που έδειξε η φόρμα ⇒ 409, καμία εγγραφή.
 */
async function priceEditedPO(
  ctx: AuthContext,
  po: PurchaseOrder,
  dto: UpdatePurchaseOrderDTO,
): Promise<POPricingResult<PurchaseOrderItem>> {
  const items: PurchaseOrderItem[] = dto.items
    ? dto.items.map((item) => ({ ...item, id: '', quantityReceived: 0, quantityRemaining: item.quantity }))
    : po.items;
  const { record, pricing } = await pricePOItems(ctx, {
    supplierId: dto.supplierId ?? po.supplierId,
    projectId: dto.projectId ?? po.projectId,
    items,
    taxRate: dto.taxRate ?? po.taxRate,
    atMs: pricingDateOf(po),
    carry: { stored: po, mode: dto.pricingMode ?? 'carry' },
  });
  assertExpectedTotal(dto.expectedTotal, record.total);
  const stableItems = dto.items ? withStableItemIds(record.items, pricing, po.items) : record.items;
  return { record: { ...record, items: stableItems }, pricing };
}

/** Ίχνος κάθε αλλαγής όρων: ρητή Επανατιμολόγηση, ή επεξεργασία που άλλαξε το πληρωτέο. */
async function auditRepricing(
  ctx: AuthContext,
  po: PurchaseOrder,
  dto: UpdatePurchaseOrderDTO,
  pricing: POPricing,
  newTotal: number,
): Promise<void> {
  const mode = dto.pricingMode ?? 'carry';
  if (mode === 'carry' && newTotal === po.total) return;
  await audit(ctx, 'procurement.po.repriced', po.id, {
    poNumber: po.poNumber,
    pricingMode: mode,
    oldTotal: po.total,
    newTotal,
    repricedLines: pricing.repricedLineIndexes.length,
  });
  EntityAuditService.recordChange({
    entityType: 'purchase_order',
    entityId: po.id,
    entityName: po.poNumber,
    action: 'updated',
    changes: [{ field: 'total', oldValue: po.total, newValue: newTotal, label: 'Total' }],
    performedBy: ctx.uid,
    performedByName: null,
    companyId: ctx.companyId,
  }).catch(() => {});
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
