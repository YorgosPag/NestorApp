'use client';

/**
 * useProcurementDashboard — Company-wide procurement stats
 *
 * Pure computation on top of usePurchaseOrders (no extra API call).
 * Shares the ADR-300 stale cache with other PO consumers on the hub.
 *
 * @module hooks/procurement/useProcurementDashboard
 * @see ADR-330 §3 Phase 6
 */

import { useMemo } from 'react';
import { usePurchaseOrders } from './usePurchaseOrders';
import { PO_COMMITTED_STATUSES, PO_DELIVERED_STATUSES } from '@/types/procurement';
import type { PurchaseOrder, PurchaseOrderStatus } from '@/types/procurement';

// ============================================================================
// TYPES
// ============================================================================

export interface CategorySpend {
  code: string;
  total: number;
}

export interface MonthlyPoint {
  month: string;  // 'YYYY-MM'
  total: number;
}

export interface ProcurementDashboardStats {
  totalPOs: number;
  committedAmount: number;
  /** Πόσες παραγγελίες αθροίζει το `committedAmount` — ό,τι δείχνει η λίστα `?status=` της κάρτας (ADR-330 S3.4). */
  committedCount: number;
  deliveredAmount: number;
  /** Πόσες παραγγελίες αθροίζει το `deliveredAmount`. */
  deliveredCount: number;
  activeSuppliersCount: number;
  statusCounts: Partial<Record<PurchaseOrderStatus, number>>;
  topCategories: CategorySpend[];
  monthlyTrend: MonthlyPoint[];
  loading: boolean;
}

// ============================================================================
// COMPUTATION
// ============================================================================

function computeStats(pos: PurchaseOrder[]): Omit<ProcurementDashboardStats, 'loading'> {
  let committedAmount = 0;
  let committedCount = 0;
  let deliveredAmount = 0;
  let deliveredCount = 0;
  const supplierIds = new Set<string>();
  const statusCounts: Partial<Record<PurchaseOrderStatus, number>> = {};
  const categoryTotals: Record<string, number> = {};
  const monthTotals: Record<string, number> = {};

  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  for (const po of pos) {
    statusCounts[po.status] = (statusCounts[po.status] ?? 0) + 1;

    if (po.status !== 'cancelled') {
      supplierIds.add(po.supplierId);
    }
    if (PO_COMMITTED_STATUSES.has(po.status)) {
      committedAmount += po.total;
      committedCount += 1;
    }
    if (PO_DELIVERED_STATUSES.has(po.status)) {
      deliveredAmount += po.total;
      deliveredCount += 1;
    }

    for (const item of po.items) {
      if (item.categoryCode) {
        categoryTotals[item.categoryCode] =
          (categoryTotals[item.categoryCode] ?? 0) + item.total;
      }
    }

    const date = new Date(po.dateCreated);
    if (date >= sixMonthsAgo) {
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthTotals[key] = (monthTotals[key] ?? 0) + po.total;
    }
  }

  const topCategories = Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([code, total]) => ({ code, total }));

  const monthlyTrend: MonthlyPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyTrend.push({ month: key, total: monthTotals[key] ?? 0 });
  }

  return {
    totalPOs: pos.length,
    committedAmount,
    committedCount,
    deliveredAmount,
    deliveredCount,
    activeSuppliersCount: supplierIds.size,
    statusCounts,
    topCategories,
    monthlyTrend,
  };
}

// ============================================================================
// HOOK
// ============================================================================

export function useProcurementDashboard(): ProcurementDashboardStats {
  const { purchaseOrders, loading } = usePurchaseOrders();

  const stats = useMemo(() => computeStats(purchaseOrders), [purchaseOrders]);

  return { ...stats, loading };
}
