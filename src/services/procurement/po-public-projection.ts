/**
 * PO Public Projection — what a supplier sees behind a share link (no sign-in)
 *
 * 🔴 ADR-923 §5.11 «3γ» Α12: the public route used to return the **whole** document minus
 * `internalNotes` (a denylist spread) ⇒ `companyId`, `projectId`, the creator's UID,
 * `appliedFaIds` and every line's `materialId` / `boqItemId` / `faDiscount` reached a third
 * party, and so would every field added to `PurchaseOrder` later.
 *
 * Pattern (Ariba/Coupa supplier view · `toPublicRfqLine`): an **explicit allowlist** with its
 * own DTO type. Each field is picked by name — never `...po` — so a new field on the PO is
 * private until someone decides to publish it here. Adding a field here IS a disclosure
 * decision.
 *
 * Pure module (no `server-only`): the public page imports the type.
 *
 * @module services/procurement/po-public-projection
 * @enterprise ADR-267 Phase B · ADR-923 §5.11 «3γ» Α12
 */

import type { PurchaseOrder, PurchaseOrderItem } from '@/types/procurement';

export interface PublicPurchaseOrderLine {
  readonly id: string;
  readonly description: string;
  readonly quantity: number;
  readonly unit: string;
  readonly unitPrice: number;
  readonly total: number;
}

export interface PublicPurchaseOrder {
  readonly poNumber: string;
  readonly status: PurchaseOrder['status'];
  readonly dateCreated: string;
  readonly dateNeeded: string | null;
  readonly deliveryAddress: string | null;
  readonly items: readonly PublicPurchaseOrderLine[];
  readonly subtotal: number;
  readonly faDiscountAmount: number;
  readonly taxableAmount: number;
  readonly taxAmount: number;
  readonly total: number;
  readonly taxRate: PurchaseOrder['taxRate'];
  readonly supplierNotes: string | null;
}

/** The disclosed keys — the anchor test compares the projection's output against these. */
export const PUBLIC_PO_FIELDS = [
  'poNumber', 'status', 'dateCreated', 'dateNeeded', 'deliveryAddress', 'items', 'subtotal',
  'faDiscountAmount', 'taxableAmount', 'taxAmount', 'total', 'taxRate', 'supplierNotes',
] as const satisfies readonly (keyof PublicPurchaseOrder)[];

export const PUBLIC_PO_LINE_FIELDS = [
  'id', 'description', 'quantity', 'unit', 'unitPrice', 'total',
] as const satisfies readonly (keyof PublicPurchaseOrderLine)[];

export function toPublicPurchaseOrderLine(item: PurchaseOrderItem): PublicPurchaseOrderLine {
  return {
    id: item.id,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    unitPrice: item.unitPrice,
    total: item.total,
  };
}

export function toPublicPurchaseOrder(po: PurchaseOrder): PublicPurchaseOrder {
  return {
    poNumber: po.poNumber,
    status: po.status,
    dateCreated: po.dateCreated,
    dateNeeded: po.dateNeeded,
    deliveryAddress: po.deliveryAddress,
    items: po.items.map(toPublicPurchaseOrderLine),
    subtotal: po.subtotal,
    faDiscountAmount: po.faDiscountAmount,
    taxableAmount: po.taxableAmount,
    taxAmount: po.taxAmount,
    total: po.total,
    taxRate: po.taxRate,
    supplierNotes: po.supplierNotes,
  };
}
