/**
 * @module config/report-builder/domain-defs-procurement
 * @enterprise ADR-268 Phase 5 — Procurement Domain Definition
 *
 * C4: Purchase Orders (top-level collection)
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import type { DomainDefinition } from './report-builder-types';

// ============================================================================
// Enum Constants (SSoT)
// ============================================================================

const PO_STATUSES = [
  'draft', 'approved', 'ordered', 'partially_delivered',
  'delivered', 'closed', 'cancelled',
] as const;

const PO_VAT_RATES = [24, 13, 6, 0] as const;

const PO_AGING_BUCKETS = ['0-30', '31-60', '61-90', '90+'] as const;

// ============================================================================
// Computed Field Helpers — Purchase Orders (C4)
// ============================================================================

interface POItemLike {
  quantity?: number;
  quantityReceived?: number;
}

const PO_TERMINAL = new Set(['delivered', 'closed', 'cancelled']);

function getItems(doc: Record<string, unknown>): POItemLike[] {
  const arr = doc['items'];
  return Array.isArray(arr) ? (arr as POItemLike[]) : [];
}

function computeDeliveryPct(doc: Record<string, unknown>): number | null {
  const items = getItems(doc);
  if (items.length === 0) return null;
  let totalQty = 0;
  let totalReceived = 0;
  for (const item of items) {
    totalQty += item.quantity ?? 0;
    totalReceived += item.quantityReceived ?? 0;
  }
  if (totalQty === 0) return null;
  return Math.round((totalReceived / totalQty) * 10000) / 100;
}

function computePOIsOverdue(doc: Record<string, unknown>): boolean {
  const needed = doc['dateNeeded'];
  const status = doc['status'];
  if (typeof needed !== 'string' || typeof status !== 'string') return false;
  return new Date(needed).getTime() < Date.now() && !PO_TERMINAL.has(status);
}

function computePODaysOverdue(doc: Record<string, unknown>): number {
  const needed = doc['dateNeeded'];
  if (typeof needed !== 'string') return 0;
  const diffMs = Date.now() - new Date(needed).getTime();
  return diffMs > 0 ? Math.floor(diffMs / 86_400_000) : 0;
}

function computePOAgingBucket(doc: Record<string, unknown>): string | null {
  const days = computePODaysOverdue(doc);
  if (days === 0) return null;
  if (days <= 30) return '0-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '90+';
}

function computePODaysInStatus(doc: Record<string, unknown>): number | null {
  const updated = doc['updatedAt'];
  if (typeof updated !== 'string') return null;
  return Math.max(0, Math.floor((Date.now() - new Date(updated).getTime()) / 86_400_000));
}

function computeItemCount(doc: Record<string, unknown>): number {
  return getItems(doc).length;
}

function computeReceivedItemCount(doc: Record<string, unknown>): number {
  return getItems(doc).filter(
    (item) => (item.quantityReceived ?? 0) >= (item.quantity ?? 1),
  ).length;
}

function computePaymentOverdue(doc: Record<string, unknown>): boolean {
  const due = doc['paymentDueDate'];
  const status = doc['status'];
  if (typeof due !== 'string' || typeof status !== 'string') return false;
  return new Date(due).getTime() < Date.now() && !PO_TERMINAL.has(status);
}

function computeDaysSinceOrdered(doc: Record<string, unknown>): number | null {
  const ordered = doc['dateOrdered'];
  if (typeof ordered !== 'string') return null;
  return Math.max(0, Math.floor((Date.now() - new Date(ordered).getTime()) / 86_400_000));
}

// ============================================================================
// C4: Purchase Orders
// ============================================================================

export const PURCHASE_ORDERS_DEFINITION: DomainDefinition = {
  id: 'purchaseOrders',
  collection: COLLECTIONS.PURCHASE_ORDERS,
  group: 'financial',
  // eslint-disable-next-line custom/no-hardcoded-strings
  labelKey: 'domains.purchaseOrders.label',
  descriptionKey: 'domains.purchaseOrders.description',
  // eslint-disable-next-line custom/no-hardcoded-strings
  entityLinkPath: '/procurement/{id}',
  defaultSortField: 'dateCreated',
  defaultSortDirection: 'desc',
  fields: [
    // Identity
    { key: 'poNumber', labelKey: 'domains.purchaseOrders.fields.poNumber', type: 'text', filterable: true, sortable: true, defaultVisible: true },
    { key: 'status', labelKey: 'domains.purchaseOrders.fields.status', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: PO_STATUSES, enumLabelPrefix: 'domains.purchaseOrders.enums.status' },
    // Financial
    { key: 'total', labelKey: 'domains.purchaseOrders.fields.total', type: 'currency', filterable: true, sortable: true, defaultVisible: true, format: 'currency' },
    { key: 'subtotal', labelKey: 'domains.purchaseOrders.fields.subtotal', type: 'currency', filterable: true, sortable: true, defaultVisible: false, format: 'currency' },
    { key: 'taxRate', labelKey: 'domains.purchaseOrders.fields.taxRate', type: 'enum', filterable: true, sortable: false, defaultVisible: false, enumValues: PO_VAT_RATES.map(String) as unknown as readonly string[], enumLabelPrefix: 'domains.purchaseOrders.enums.taxRate' },
    { key: 'taxAmount', labelKey: 'domains.purchaseOrders.fields.taxAmount', type: 'currency', filterable: true, sortable: true, defaultVisible: false, format: 'currency' },
    // Dates
    { key: 'dateCreated', labelKey: 'domains.purchaseOrders.fields.dateCreated', type: 'date', filterable: true, sortable: true, defaultVisible: true, format: 'date' },
    { key: 'dateNeeded', labelKey: 'domains.purchaseOrders.fields.dateNeeded', type: 'date', filterable: true, sortable: true, defaultVisible: true, format: 'date' },
    { key: 'dateOrdered', labelKey: 'domains.purchaseOrders.fields.dateOrdered', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
    { key: 'dateDelivered', labelKey: 'domains.purchaseOrders.fields.dateDelivered', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
    { key: 'paymentTermsDays', labelKey: 'domains.purchaseOrders.fields.paymentTermsDays', type: 'number', filterable: true, sortable: true, defaultVisible: false, format: 'number' },
    { key: 'paymentDueDate', labelKey: 'domains.purchaseOrders.fields.paymentDueDate', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
    // Refs
    { key: 'supplierId', labelKey: 'domains.purchaseOrders.fields.supplier', type: 'text', filterable: true, sortable: false, defaultVisible: true, refDomain: 'suppliers', refDisplayField: 'firstName' },
    { key: 'projectId', labelKey: 'domains.purchaseOrders.fields.project', type: 'text', filterable: true, sortable: false, defaultVisible: true, refDomain: 'projects', refDisplayField: 'name' },
    // Computed — Delivery
    { key: 'deliveryPct', labelKey: 'domains.purchaseOrders.fields.deliveryPct', type: 'percentage', filterable: true, sortable: true, defaultVisible: true, format: 'percentage', computed: true, computeFn: computeDeliveryPct },
    { key: 'isOverdue', labelKey: 'domains.purchaseOrders.fields.isOverdue', type: 'boolean', filterable: true, sortable: false, defaultVisible: false, computed: true, computeFn: computePOIsOverdue },
    { key: 'daysOverdue', labelKey: 'domains.purchaseOrders.fields.daysOverdue', type: 'number', filterable: true, sortable: true, defaultVisible: false, format: 'number', computed: true, computeFn: computePODaysOverdue },
    { key: 'agingBucket', labelKey: 'domains.purchaseOrders.fields.agingBucket', type: 'enum', filterable: true, sortable: true, defaultVisible: false, enumValues: PO_AGING_BUCKETS, enumLabelPrefix: 'domains.purchaseOrders.enums.agingBucket', computed: true, computeFn: computePOAgingBucket },
    { key: 'daysInStatus', labelKey: 'domains.purchaseOrders.fields.daysInStatus', type: 'number', filterable: true, sortable: true, defaultVisible: false, format: 'number', computed: true, computeFn: computePODaysInStatus },
    { key: 'itemCount', labelKey: 'domains.purchaseOrders.fields.itemCount', type: 'number', filterable: true, sortable: true, defaultVisible: false, format: 'number', computed: true, computeFn: computeItemCount },
    { key: 'receivedItemCount', labelKey: 'domains.purchaseOrders.fields.receivedItemCount', type: 'number', filterable: true, sortable: true, defaultVisible: false, format: 'number', computed: true, computeFn: computeReceivedItemCount },
    { key: 'paymentOverdue', labelKey: 'domains.purchaseOrders.fields.paymentOverdue', type: 'boolean', filterable: true, sortable: false, defaultVisible: false, computed: true, computeFn: computePaymentOverdue },
    { key: 'daysSinceOrdered', labelKey: 'domains.purchaseOrders.fields.daysSinceOrdered', type: 'number', filterable: true, sortable: true, defaultVisible: false, format: 'number', computed: true, computeFn: computeDaysSinceOrdered },
    // Audit
    { key: 'updatedAt', labelKey: 'domains.purchaseOrders.fields.updatedAt', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
  ],
};
