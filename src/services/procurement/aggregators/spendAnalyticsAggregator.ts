import 'server-only';

import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { PurchaseOrder } from '@/types/procurement';
import { PO_COMMITTED_STATUSES, PO_DELIVERED_STATUSES } from '@/types/procurement';
import { normalizeBOQItem } from '@/services/measurements/boq-document-normalize';
import { fetchCompanyPurchaseOrders } from './project-purchase-orders';
import { computeCostLedger, hasBudgetOrCommitment, type LedgerBoqItem } from '@/services/project-cost/cost-ledger';
import { athensDateRangeToUtc, getPreviousPeriod } from '@/lib/date/quarter-helpers';
import { compareByLocale } from '@/lib/intl-utils';

// ============================================================================
// TYPES
// ============================================================================

export interface SpendAnalyticsFilters {
  from: string; // YYYY-MM-DD (Athens local)
  to: string;   // YYYY-MM-DD (Athens local)
  projectId: string[];
  supplierId: string[];
  categoryCode: string[];
  status: string[];
}

export interface SpendKpis {
  totalPOs: number;
  committedAmount: number;
  deliveredAmount: number;
  activeSuppliers: number;
}

export interface CategoryPoint { code: string; total: number }
export interface VendorPoint { supplierId: string; supplierName: string; total: number; poCount: number }
export interface ProjectPoint { projectId: string; total: number }
export interface MonthlyPoint { month: string; total: number } // 'YYYY-MM'
export interface BudgetVsActualPoint { categoryCode: string; budget: number; committed: number; delivered: number }

export interface SpendAnalyticsCurrentData {
  kpis: SpendKpis;
  byCategory: CategoryPoint[];
  byVendor: VendorPoint[];
  byProject: ProjectPoint[];
  monthlyTrend: MonthlyPoint[];
  budgetVsActual: BudgetVsActualPoint[];
}

export interface SpendAnalyticsResult {
  filters: SpendAnalyticsFilters;
  current: SpendAnalyticsCurrentData;
  comparison: {
    previousFrom: string;
    previousTo: string;
    deltas: SpendKpis;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TOP_N = 10;

const EMPTY_KPIS: SpendKpis = { totalPOs: 0, committedAmount: 0, deliveredAmount: 0, activeSuppliers: 0 };

// ============================================================================
// FIRESTORE HELPERS
// ============================================================================

async function fetchRawPOs(
  db: FirebaseFirestore.Firestore,
  companyId: string,
  startUtc: string,
  endUtc: string,
): Promise<PurchaseOrder[]> {
  const snap = await db
    .collection(COLLECTIONS.PURCHASE_ORDERS)
    .where('companyId', '==', companyId)
    .where('isDeleted', '==', false)
    .where('dateCreated', '>=', startUtc)
    .where('dateCreated', '<=', endUtc)
    .orderBy('dateCreated', 'desc')
    .get();
  return snap.docs.map(d => d.data() as PurchaseOrder);
}

function applyPoFilters(pos: PurchaseOrder[], f: SpendAnalyticsFilters): PurchaseOrder[] {
  return pos.filter(po => {
    if (f.projectId.length > 0 && !f.projectId.includes(po.projectId)) return false;
    if (f.supplierId.length > 0 && !f.supplierId.includes(po.supplierId)) return false;
    if (f.status.length > 0 && !f.status.includes(po.status)) return false;
    return true;
  });
}

// ============================================================================
// PURE AGGREGATORS
// ============================================================================

function computeSpendKpis(pos: PurchaseOrder[]): SpendKpis {
  let committedAmount = 0;
  let deliveredAmount = 0;
  const suppliers = new Set<string>();
  for (const po of pos) {
    suppliers.add(po.supplierId);
    if (PO_COMMITTED_STATUSES.has(po.status)) committedAmount += po.total ?? 0;
    if (PO_DELIVERED_STATUSES.has(po.status)) deliveredAmount += po.total ?? 0;
  }
  return { totalPOs: pos.length, committedAmount, deliveredAmount, activeSuppliers: suppliers.size };
}

function computeByCategory(pos: PurchaseOrder[], catFilter: string[]): CategoryPoint[] {
  const map = new Map<string, number>();
  for (const po of pos) {
    for (const item of po.items ?? []) {
      if (catFilter.length > 0 && !catFilter.includes(item.categoryCode)) continue;
      const code = item.categoryCode ?? 'OTHER';
      map.set(code, (map.get(code) ?? 0) + (item.total ?? 0));
    }
  }
  return [...map.entries()]
    .map(([code, total]) => ({ code, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, TOP_N);
}

function computeByVendorRaw(pos: PurchaseOrder[]): Map<string, { total: number; poCount: number }> {
  const map = new Map<string, { total: number; poCount: number }>();
  for (const po of pos) {
    const existing = map.get(po.supplierId) ?? { total: 0, poCount: 0 };
    existing.total += po.total ?? 0;
    existing.poCount += 1;
    map.set(po.supplierId, existing);
  }
  return map;
}

function computeByProject(pos: PurchaseOrder[]): ProjectPoint[] {
  const map = new Map<string, number>();
  for (const po of pos) {
    map.set(po.projectId, (map.get(po.projectId) ?? 0) + (po.total ?? 0));
  }
  return [...map.entries()]
    .map(([projectId, total]) => ({ projectId, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, TOP_N);
}

function computeMonthlyTrend(pos: PurchaseOrder[]): MonthlyPoint[] {
  const map = new Map<string, number>();
  for (const po of pos) {
    const month = (po.dateCreated ?? '').slice(0, 7); // 'YYYY-MM'
    if (month.length === 7) map.set(month, (map.get(month) ?? 0) + (po.total ?? 0));
  }
  return [...map.entries()]
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => compareByLocale(a.month, b.month));
}

/** ADR-917 Δ1: the arithmetic lives in the cost ledger — this only shapes the wire point. */
function computeBudgetVsActual(
  boqItems: readonly LedgerBoqItem[],
  pos: PurchaseOrder[],
  catFilter: string[],
): BudgetVsActualPoint[] {
  return computeCostLedger(boqItems, pos, catFilter).rows
    .filter(hasBudgetOrCommitment)
    .map(row => ({
      categoryCode: row.categoryCode,
      budget: row.budget,
      committed: row.committed,
      delivered: row.delivered,
    }));
}

function computeDeltas(current: SpendKpis, prev: SpendKpis): SpendKpis {
  const pct = (curr: number, previous: number): number =>
    previous === 0 ? 0 : Math.round(((curr - previous) / previous) * 1000) / 10;
  return {
    totalPOs: pct(current.totalPOs, prev.totalPOs),
    committedAmount: pct(current.committedAmount, prev.committedAmount),
    deliveredAmount: pct(current.deliveredAmount, prev.deliveredAmount),
    activeSuppliers: pct(current.activeSuppliers, prev.activeSuppliers),
  };
}

// ============================================================================
// PUBLIC ENTRY POINT
// ============================================================================

export async function computeSpendAnalytics(
  companyId: string,
  filters: SpendAnalyticsFilters,
): Promise<SpendAnalyticsResult> {
  const fallback: SpendAnalyticsResult = {
    filters,
    current: { kpis: { ...EMPTY_KPIS }, byCategory: [], byVendor: [], byProject: [], monthlyTrend: [], budgetVsActual: [] },
    comparison: { previousFrom: '', previousTo: '', deltas: { ...EMPTY_KPIS } },
  };

  return safeFirestoreOperation(async (db) => {
    const { start, end } = athensDateRangeToUtc(filters.from, filters.to);
    const prev = getPreviousPeriod(filters.from, filters.to);
    const { start: prevStart, end: prevEnd } = athensDateRangeToUtc(prev.from, prev.to);

    const [rawPos, rawPrevPos, boqSnap, lifetimePos] = await Promise.all([
      fetchRawPOs(db, companyId, start, end),
      fetchRawPOs(db, companyId, prevStart, prevEnd),
      db.collection(COLLECTIONS.BOQ_ITEMS).where('companyId', '==', companyId).get(),
      // ADR-917 Δ3/Δ4: the budget is whole-life, so its comparison reads whole-life orders.
      fetchCompanyPurchaseOrders(db, companyId),
    ]);

    const pos = applyPoFilters(rawPos, filters);
    const prevPos = applyPoFilters(rawPrevPos, { ...filters, from: prev.from, to: prev.to });

    const currentKpis = computeSpendKpis(pos);
    const vendorRaw = computeByVendorRaw(pos);
    const topVendorIds = [...vendorRaw.entries()]
      .sort(([, a], [, b]) => b.total - a.total)
      .slice(0, TOP_N)
      .map(([id]) => id);

    const contactDocs = topVendorIds.length > 0
      ? await db.getAll(...topVendorIds.map(id => db.collection(COLLECTIONS.CONTACTS).doc(id)))
      : [];
    const nameMap = new Map(contactDocs.map(d => {
      const data = d.data();
      const name =
        data?.displayName ??
        data?.name ??
        data?.companyName ??
        (data?.firstName != null
          ? [data.firstName, data.lastName].filter(Boolean).join(' ')
          : null) ??
        data?.serviceName ??
        d.id;
      return [d.id, String(name)];
    }));

    const byVendor: VendorPoint[] = topVendorIds.map(id => ({
      supplierId: id,
      supplierName: nameMap.get(id) ?? id,
      total: vendorRaw.get(id)?.total ?? 0,
      poCount: vendorRaw.get(id)?.poCount ?? 0,
    }));

    const boqItems = boqSnap.docs
      .map(d => normalizeBOQItem(d.id, d.data()))
      .filter(item => filters.projectId.length === 0 || filters.projectId.includes(item.projectId));

    return {
      filters,
      current: {
        kpis: currentKpis,
        byCategory: computeByCategory(pos, filters.categoryCode),
        byVendor,
        byProject: computeByProject(pos),
        monthlyTrend: computeMonthlyTrend(pos),
        budgetVsActual: computeBudgetVsActual(boqItems, applyPoFilters(lifetimePos, filters), filters.categoryCode),
      },
      comparison: {
        previousFrom: prev.from,
        previousTo: prev.to,
        deltas: computeDeltas(currentKpis, computeSpendKpis(prevPos)),
      },
    };
  }, fallback);
}
