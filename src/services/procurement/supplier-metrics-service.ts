/**
 * Supplier Metrics Service — Performance analytics for procurement
 *
 * Calculates: on-time delivery rate, average lead time, cancellation rate,
 * category breakdown, price trends. All from existing PO data.
 *
 * @module services/procurement/supplier-metrics-service
 * @see ADR-267 Phase C, Feature 3
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { ATOE_MASTER_CATEGORIES } from '@/config/boq-categories';
import {
  PO_COMMITTED_STATUSES,
  type PurchaseOrder,
  type SupplierMetrics,
  type CategorySpend,
  type SupplierComparison,
  type SupplierPriceTrend,
} from '@/types/procurement';
import { listPurchaseOrders } from './procurement-repository';
import { compareByLocale } from '@/lib/intl-formatting';

// ============================================================================
// CATEGORY NAME LOOKUP (SSoT from boq-categories)
// ============================================================================

const CATEGORY_NAME_MAP = new Map(
  ATOE_MASTER_CATEGORIES.map(c => [c.code, c.nameEL])
);

function getCategoryName(code: string): string {
  return CATEGORY_NAME_MAP.get(code) ?? code;
}

// ============================================================================
// CALCULATE SUPPLIER METRICS
// ============================================================================

/** Calculate performance metrics for a single supplier */
export async function calculateSupplierMetrics(
  companyId: string,
  supplierId: string,
  supplierName: string
): Promise<SupplierMetrics> {
  const [allPOs, detailsMap] = await Promise.all([
    listPurchaseOrders({ companyId, supplierId }),
    fetchSupplierDetails(companyId, [supplierId]),
  ]);
  const activePOs = allPOs.filter(po => !po.isDeleted);

  const nonCancelled = activePOs.filter(po => po.status !== 'cancelled');
  const cancelled = activePOs.filter(po => po.status === 'cancelled');

  const totalOrders = nonCancelled.length;
  const totalSpend = sumTotal(nonCancelled);
  const averageOrderValue = totalOrders > 0 ? totalSpend / totalOrders : 0;

  return {
    supplierId,
    supplierName,
    totalOrders,
    totalSpend,
    averageOrderValue,
    onTimeDeliveryRate: calcOnTimeRate(nonCancelled),
    averageLeadTimeDays: calcAverageLeadTime(nonCancelled),
    cancellationRate: calcCancellationRate(activePOs, cancelled),
    categoryBreakdown: buildCategoryBreakdown(nonCancelled),
    lastOrderDate: calcLastOrderDate(nonCancelled),
    tradeSpecialties: detailsMap.get(supplierId)?.tradeSpecialties ?? [],
  };
}

// ============================================================================
// SUPPLIER COMPARISON
// ============================================================================

/** Compare all suppliers with POs for this company */
export async function getSupplierComparison(
  companyId: string
): Promise<SupplierComparison> {
  const allPOs = await listPurchaseOrders({ companyId });
  const activePOs = allPOs.filter(po => !po.isDeleted);

  // Group by supplier
  const bySupplier = new Map<string, PurchaseOrder[]>();
  for (const po of activePOs) {
    const list = bySupplier.get(po.supplierId) ?? [];
    list.push(po);
    bySupplier.set(po.supplierId, list);
  }

  // Fetch supplier names + trade specialties
  const supplierDetails = await fetchSupplierDetails(
    companyId,
    Array.from(bySupplier.keys())
  );

  const suppliers: SupplierMetrics[] = [];
  for (const [sId, pos] of bySupplier) {
    const nonCancelled = pos.filter(po => po.status !== 'cancelled');
    const cancelled = pos.filter(po => po.status === 'cancelled');
    const details = supplierDetails.get(sId);

    suppliers.push({
      supplierId: sId,
      supplierName: details?.name ?? sId,
      totalOrders: nonCancelled.length,
      totalSpend: sumTotal(nonCancelled),
      averageOrderValue: nonCancelled.length > 0
        ? sumTotal(nonCancelled) / nonCancelled.length
        : 0,
      onTimeDeliveryRate: calcOnTimeRate(nonCancelled),
      averageLeadTimeDays: calcAverageLeadTime(nonCancelled),
      cancellationRate: calcCancellationRate(pos, cancelled),
      categoryBreakdown: buildCategoryBreakdown(nonCancelled),
      lastOrderDate: calcLastOrderDate(nonCancelled),
      tradeSpecialties: details?.tradeSpecialties ?? [],
    });
  }

  // Sort by total spend descending
  suppliers.sort((a, b) => b.totalSpend - a.totalSpend);

  return { suppliers, totalSuppliers: suppliers.length };
}

// ============================================================================
// PRICE TRENDS
// ============================================================================

/** Monthly price trend for a supplier, optionally filtered by category */
export async function getSupplierPriceTrend(
  companyId: string,
  supplierId: string,
  categoryCode: string | null
): Promise<SupplierPriceTrend[]> {
  const allPOs = await listPurchaseOrders({ companyId, supplierId });
  const orderedPOs = allPOs.filter(po =>
    !po.isDeleted && po.dateOrdered && po.status !== 'cancelled'
  );

  // Group items by month
  const monthly = new Map<string, { prices: number[]; quantities: number[] }>();
  for (const po of orderedPOs) {
    const month = po.dateOrdered!.slice(0, 7); // 'YYYY-MM'
    const items = categoryCode
      ? po.items.filter(i => i.categoryCode === categoryCode)
      : po.items;

    for (const item of items) {
      const entry = monthly.get(month) ?? { prices: [], quantities: [] };
      entry.prices.push(item.unitPrice);
      entry.quantities.push(item.quantity);
      monthly.set(month, entry);
    }
  }

  // Build trend array sorted by month
  return Array.from(monthly.entries())
    .map(([month, data]) => ({
      month,
      averageUnitPrice: data.prices.reduce((s, p) => s + p, 0) / data.prices.length,
      orderCount: data.prices.length,
      totalQuantity: data.quantities.reduce((s, q) => s + q, 0),
    }))
    .sort((a, b) => compareByLocale(a.month, b.month));
}

// ============================================================================
// CALCULATION HELPERS
// ============================================================================

/** Sum totals of POs in active statuses */
function sumTotal(pos: PurchaseOrder[]): number {
  return pos
    .filter(po => PO_COMMITTED_STATUSES.has(po.status))
    .reduce((sum, po) => sum + po.total, 0);
}

/** On-time delivery rate (0-100) */
function calcOnTimeRate(pos: PurchaseOrder[]): number {
  const withBothDates = pos.filter(po => po.dateDelivered && po.dateNeeded);
  if (withBothDates.length === 0) return 0;

  const onTime = withBothDates.filter(po => po.dateDelivered! <= po.dateNeeded!);
  return Math.round((onTime.length / withBothDates.length) * 100);
}

/** Average lead time in days (dateOrdered → dateDelivered) */
function calcAverageLeadTime(pos: PurchaseOrder[]): number | null {
  const withBothDates = pos.filter(po => po.dateOrdered && po.dateDelivered);
  if (withBothDates.length === 0) return null;

  const totalDays = withBothDates.reduce((sum, po) => {
    const ordered = new Date(po.dateOrdered!).getTime();
    const delivered = new Date(po.dateDelivered!).getTime();
    return sum + (delivered - ordered) / (1000 * 60 * 60 * 24);
  }, 0);

  return Math.round(totalDays / withBothDates.length);
}

/** Most recent non-cancelled PO dateOrdered (ISO string) or null */
function calcLastOrderDate(pos: PurchaseOrder[]): string | null {
  const dates = pos
    .filter(po => po.dateOrdered)
    .map(po => po.dateOrdered!);
  if (dates.length === 0) return null;
  return dates.reduce((max, d) => (d > max ? d : max));
}

/** Cancellation rate (0-100) */
function calcCancellationRate(
  allPOs: PurchaseOrder[],
  cancelled: PurchaseOrder[]
): number {
  if (allPOs.length === 0) return 0;
  return Math.round((cancelled.length / allPOs.length) * 100);
}

/** Build spend breakdown by ΑΤΟΕ category */
function buildCategoryBreakdown(pos: PurchaseOrder[]): CategorySpend[] {
  const map = new Map<string, { spend: number; count: number }>();

  for (const po of pos) {
    if (!PO_COMMITTED_STATUSES.has(po.status)) continue;
    for (const item of po.items) {
      const entry = map.get(item.categoryCode) ?? { spend: 0, count: 0 };
      entry.spend += item.total;
      entry.count++;
      map.set(item.categoryCode, entry);
    }
  }

  return Array.from(map.entries())
    .map(([code, data]) => ({
      categoryCode: code,
      categoryName: getCategoryName(code),
      totalSpend: data.spend,
      orderCount: data.count,
    }))
    .sort((a, b) => b.totalSpend - a.totalSpend);
}

interface SupplierContactDetails {
  name: string;
  tradeSpecialties: string[];
}

/** Fetch display names + trade specialties for a list of supplier contact IDs */
async function fetchSupplierDetails(
  companyId: string,
  supplierIds: string[]
): Promise<Map<string, SupplierContactDetails>> {
  if (supplierIds.length === 0) return new Map();

  const db = getAdminFirestore();
  const details = new Map<string, SupplierContactDetails>();

  // Batch fetch in chunks of 30 (Firestore 'in' limit)
  for (let i = 0; i < supplierIds.length; i += 30) {
    const chunk = supplierIds.slice(i, i + 30);
    const snapshot = await db
      .collection(COLLECTIONS.CONTACTS)
      .where('companyId', '==', companyId)
      .where('__name__', 'in', chunk)
      .get();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const name = String(
        data.displayName ??
        data.name ??
        data.companyName ??
        (data.firstName ? [data.firstName, data.lastName].filter(Boolean).join(' ') : null) ??
        data.serviceName ??
        doc.id
      );
      const personas = Array.isArray(data.personas) ? data.personas : [];
      const supplierPersona = personas.find(
        (p: Record<string, unknown>) => p.personaType === 'supplier'
      );
      const tradeSpecialties: string[] = Array.isArray(supplierPersona?.tradeSpecialties)
        ? supplierPersona.tradeSpecialties as string[]
        : [];

      details.set(doc.id, { name, tradeSpecialties });
    }
  }

  return details;
}
