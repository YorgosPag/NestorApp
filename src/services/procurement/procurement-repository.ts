/**
 * Procurement Repository — Firestore CRUD + Sequential PO Counter
 *
 * Follows the proven accounting repository pattern:
 * - safeFirestoreOperation() for all DB calls
 * - sanitizeForFirestore() to prevent undefined values
 * - Atomic transaction for PO number counter
 * - Soft delete only (SAP/Procore pattern)
 *
 * @module services/procurement/procurement-repository
 * @see ADR-267 §4.4 (Firestore Collection)
 */

import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { sanitizeForFirestore } from '@/utils/firestore-sanitize';
import { generatePurchaseOrderId, generatePOItemId } from '@/services/enterprise-id.service';
import type {
  PurchaseOrder,
  PurchaseOrderStatus,
  CreatePurchaseOrderDTO,
  RecordDeliveryDTO,
} from '@/types/procurement';

// ============================================================================
// HELPERS
// ============================================================================

function isoNow(): string {
  return new Date().toISOString();
}

// ============================================================================
// PO NUMBER — ATOMIC COUNTER
// ============================================================================

/**
 * Get next sequential PO number via Firestore transaction.
 * Pattern: PO-NNNN (no year reset, no project prefix).
 * Race-condition safe via runTransaction().
 */
export async function getNextPONumber(companyId: string): Promise<string> {
  return safeFirestoreOperation(async (db) => {
    const counterRef = db
      .collection(COLLECTIONS.PURCHASE_ORDER_COUNTERS)
      .doc(companyId);

    const nextNumber = await db.runTransaction(async (txn) => {
      const snap = await txn.get(counterRef);
      const current = snap.exists
        ? (snap.data() as { lastNumber: number }).lastNumber
        : 0;
      const next = current + 1;
      txn.set(counterRef, { lastNumber: next }, { merge: true });
      return next;
    });

    return `PO-${String(nextNumber).padStart(4, '0')}`;
  }, 'PO-0000');
}

// ============================================================================
// CREATE
// ============================================================================

export async function createPurchaseOrder(
  companyId: string,
  userId: string,
  dto: CreatePurchaseOrderDTO
): Promise<{ id: string; poNumber: string }> {
  const id = generatePurchaseOrderId();
  const now = isoNow();
  const poNumber = await getNextPONumber(companyId);

  // Build items with IDs and zero delivery
  const items = dto.items.map((item) => ({
    ...item,
    id: generatePOItemId(),
    quantityReceived: 0,
    quantityRemaining: item.quantity,
  }));

  // Calculate totals
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const taxRate = dto.taxRate;
  const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;

  const doc: PurchaseOrder = {
    id,
    poNumber,
    companyId,
    projectId: dto.projectId,
    buildingId: dto.buildingId ?? null,
    supplierId: dto.supplierId,
    status: 'draft',
    items,
    currency: 'EUR',
    subtotal,
    taxRate,
    taxAmount,
    total,
    dateCreated: now,
    dateNeeded: dto.dateNeeded ?? null,
    dateOrdered: null,
    dateDelivered: null,
    dateInvoiced: null,
    deliveryAddress: dto.deliveryAddress ?? null,
    paymentTermsDays: dto.paymentTermsDays ?? null,
    paymentDueDate: null,
    linkedInvoiceIds: [],
    supplierNotes: dto.supplierNotes ?? null,
    internalNotes: dto.internalNotes ?? null,
    attachments: [],
    cancellationReason: null,
    cancellationComment: null,
    createdBy: userId,
    approvedBy: null,
    updatedAt: now,
    isDeleted: false,
  };

  await safeFirestoreOperation(async (db) => {
    await db
      .collection(COLLECTIONS.PURCHASE_ORDERS)
      .doc(id)
      .set(sanitizeForFirestore(doc as unknown as Record<string, unknown>));
  }, undefined);

  return { id, poNumber };
}

// ============================================================================
// READ
// ============================================================================

export async function getPurchaseOrder(
  poId: string
): Promise<PurchaseOrder | null> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db
      .collection(COLLECTIONS.PURCHASE_ORDERS)
      .doc(poId)
      .get();
    if (!snap.exists) return null;
    return snap.data() as PurchaseOrder;
  }, null);
}

// ============================================================================
// LIST
// ============================================================================

export interface POListFilters {
  companyId: string;
  status?: PurchaseOrderStatus | PurchaseOrderStatus[];
  projectId?: string;
  supplierId?: string;
  isDeleted?: boolean;
  pageSize?: number;
}

export async function listPurchaseOrders(
  filters: POListFilters
): Promise<PurchaseOrder[]> {
  return safeFirestoreOperation(async (db) => {
    let query: FirebaseFirestore.Query = db
      .collection(COLLECTIONS.PURCHASE_ORDERS)
      .where('companyId', '==', filters.companyId)
      .where('isDeleted', '==', filters.isDeleted ?? false);

    if (filters.projectId) {
      query = query.where('projectId', '==', filters.projectId);
    }
    if (filters.supplierId) {
      query = query.where('supplierId', '==', filters.supplierId);
    }
    if (filters.status) {
      const statuses = Array.isArray(filters.status)
        ? filters.status
        : [filters.status];
      query = query.where('status', 'in', statuses);
    }

    query = query
      .orderBy('dateCreated', 'desc')
      .limit(filters.pageSize ?? 100);

    const snap = await query.get();
    return snap.docs.map((d) => d.data() as PurchaseOrder);
  }, []);
}

// ============================================================================
// UPDATE
// ============================================================================

export async function updatePurchaseOrder(
  poId: string,
  updates: Partial<PurchaseOrder>
): Promise<void> {
  await safeFirestoreOperation(async (db) => {
    await db
      .collection(COLLECTIONS.PURCHASE_ORDERS)
      .doc(poId)
      .update(
        sanitizeForFirestore({
          ...updates,
          updatedAt: isoNow(),
        } as unknown as Record<string, unknown>)
      );
  }, undefined);
}

// ============================================================================
// STATUS CHANGE
// ============================================================================

export async function updatePOStatus(
  poId: string,
  status: PurchaseOrderStatus,
  extra?: Partial<PurchaseOrder>
): Promise<void> {
  const now = isoNow();
  const updates: Partial<PurchaseOrder> = {
    status,
    updatedAt: now,
    ...extra,
  };

  // Set date fields based on status
  if (status === 'ordered') updates.dateOrdered = now;
  if (status === 'delivered') updates.dateDelivered = now;

  await updatePurchaseOrder(poId, updates);
}

// ============================================================================
// SOFT DELETE
// ============================================================================

export async function softDeletePurchaseOrder(poId: string): Promise<void> {
  await updatePurchaseOrder(poId, {
    isDeleted: true,
  });
}

// ============================================================================
// DELIVERY RECORDING
// ============================================================================

/**
 * Record delivery quantities and auto-update PO status.
 * Returns the new status after recording.
 */
export async function recordDelivery(
  poId: string,
  dto: RecordDeliveryDTO
): Promise<{ newStatus: PurchaseOrderStatus }> {
  const po = await getPurchaseOrder(poId);
  if (!po) throw new Error(`PO not found: ${poId}`);

  // Update item quantities
  const updatedItems = po.items.map((item) => {
    const delivery = dto.items.find((d) => d.itemId === item.id);
    if (!delivery) return item;

    const newReceived = item.quantityReceived + delivery.quantityReceived;
    return {
      ...item,
      quantityReceived: Math.min(newReceived, item.quantity),
      quantityRemaining: Math.max(item.quantity - newReceived, 0),
    };
  });

  // Calculate overall delivery percentage
  const totalQty = updatedItems.reduce((s, i) => s + i.quantity, 0);
  const totalReceived = updatedItems.reduce((s, i) => s + i.quantityReceived, 0);
  const pct = totalQty > 0 ? (totalReceived / totalQty) * 100 : 0;

  // Auto status: 0% → ordered, 1-99% → partially_delivered, 100% → delivered
  let newStatus: PurchaseOrderStatus = po.status;
  if (pct >= 100) {
    newStatus = 'delivered';
  } else if (pct > 0) {
    newStatus = 'partially_delivered';
  }

  const updates: Partial<PurchaseOrder> = {
    items: updatedItems,
    status: newStatus,
    updatedAt: isoNow(),
  };
  if (newStatus === 'delivered') {
    updates.dateDelivered = isoNow();
  }

  await updatePurchaseOrder(poId, updates);

  return { newStatus };
}

// ============================================================================
// INVOICE LINKING
// ============================================================================

export async function linkInvoice(
  poId: string,
  invoiceId: string
): Promise<void> {
  const po = await getPurchaseOrder(poId);
  if (!po) throw new Error(`PO not found: ${poId}`);

  const linkedInvoiceIds = [...po.linkedInvoiceIds, invoiceId];
  await updatePurchaseOrder(poId, {
    linkedInvoiceIds,
    dateInvoiced: po.dateInvoiced ?? isoNow(),
  });
}

// ============================================================================
// PRICE HISTORY QUERY
// ============================================================================

export interface PriceHistoryEntry {
  poNumber: string;
  poId: string;
  dateCreated: string;
  unitPrice: number;
  quantity: number;
  supplierId: string;
}

/**
 * Get price history for a description+supplier combo.
 * Used for inline price trend display in PO form.
 */
export async function getPriceHistory(
  companyId: string,
  supplierId: string,
  description: string,
  limit: number = 5
): Promise<PriceHistoryEntry[]> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db
      .collection(COLLECTIONS.PURCHASE_ORDERS)
      .where('companyId', '==', companyId)
      .where('supplierId', '==', supplierId)
      .where('isDeleted', '==', false)
      .orderBy('dateCreated', 'desc')
      .limit(50) // Fetch more, filter client-side for item match
      .get();

    const results: PriceHistoryEntry[] = [];
    for (const doc of snap.docs) {
      const po = doc.data() as PurchaseOrder;
      const matchingItem = po.items.find((i) =>
        i.description.toLowerCase().includes(description.toLowerCase())
      );
      if (matchingItem) {
        results.push({
          poNumber: po.poNumber,
          poId: po.id,
          dateCreated: po.dateCreated,
          unitPrice: matchingItem.unitPrice,
          quantity: matchingItem.quantity,
          supplierId: po.supplierId,
        });
      }
      if (results.length >= limit) break;
    }
    return results;
  }, []);
}
