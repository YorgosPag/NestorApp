/**
 * procurementDashboardStats — Funzione pura per le stat cards del dashboard procurement
 *
 * Rispecchia i 7 KPI di PurchaseOrderKPIs ma nel formato DashboardStat[]
 * compatibile con UnifiedDashboard (ADR-267 Phase E).
 *
 * @see ADR-267 Phase E — Procurement Layout Unification
 */

import {
  Package,
  Truck,
  DollarSign,
  AlertTriangle,
  PackageOpen,
  FileWarning,
  TrendingUp,
} from 'lucide-react';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { PurchaseOrder } from '@/types/procurement';
import type { TFunction } from 'i18next';
import { nowISO } from '@/lib/date-local';

// =============================================================================
// HELPERS
// =============================================================================

function formatEur(n: number): string {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Calcola i 7 KPI dal array di PurchaseOrder e li restituisce come DashboardStat[].
 * Usa le chiavi i18n dal namespace 'procurement' (kpi.*).
 *
 * @param pos - Array di PurchaseOrder (già filtrato dalla pagina)
 * @param t   - TFunction dal namespace 'procurement'
 */
export function buildProcurementDashboardStats(
  pos: PurchaseOrder[],
  t: TFunction,
): DashboardStat[] {
  const now = nowISO();
  const currentMonth = now.substring(0, 7); // YYYY-MM

  const active = pos.filter((po) =>
    ['ordered', 'partially_delivered', 'delivered'].includes(po.status),
  );
  const pendingDelivery = pos.filter((po) => po.status === 'ordered');
  const totalCommitted = active.reduce((s, po) => s + po.total, 0);
  const overdue = pos.filter(
    (po) =>
      po.dateNeeded &&
      po.dateNeeded < now &&
      ['ordered', 'partially_delivered'].includes(po.status),
  );
  const partial = pos.filter((po) => po.status === 'partially_delivered');
  const awaitingInvoice = pos.filter(
    (po) => po.status === 'delivered' && po.linkedInvoiceIds.length === 0,
  );
  const monthlySpend = pos
    .filter(
      (po) =>
        po.dateOrdered?.startsWith(currentMonth) &&
        ['ordered', 'partially_delivered', 'delivered', 'closed'].includes(po.status),
    )
    .reduce((s, po) => s + po.total, 0);

  return [
    {
      title: t('kpi.activePO'),
      value: active.length,
      icon: Package,
      color: 'green',
    },
    {
      title: t('kpi.pendingDelivery'),
      value: pendingDelivery.length,
      icon: Truck,
      color: 'blue',
    },
    {
      title: t('kpi.totalCommitted'),
      value: formatEur(totalCommitted),
      icon: DollarSign,
      color: 'purple',
    },
    {
      title: t('kpi.overdue'),
      value: overdue.length,
      icon: AlertTriangle,
      color: overdue.length > 0 ? 'red' : 'gray',
    },
    {
      title: t('kpi.partialDelivery'),
      value: partial.length,
      icon: PackageOpen,
      color: 'orange',
    },
    {
      title: t('kpi.awaitingInvoice'),
      value: awaitingInvoice.length,
      icon: FileWarning,
      color: awaitingInvoice.length > 0 ? 'red' : 'gray',
    },
    {
      title: t('kpi.monthlySpend'),
      value: formatEur(monthlySpend),
      icon: TrendingUp,
      color: 'indigo',
    },
  ];
}
