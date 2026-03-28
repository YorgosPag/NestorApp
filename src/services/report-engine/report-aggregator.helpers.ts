/**
 * Report Aggregator Helpers — Pure functions for report data transformation
 *
 * Extracted from report-data-aggregator.ts for SRP.
 * All functions are stateless — no Firestore calls, no side effects.
 *
 * @module services/report-engine/report-aggregator.helpers
 * @see ADR-265 (Enterprise Reports System)
 */

import type { Installment } from '@/types/payment-plan';
import type {
  UnitDoc,
  BOQItemDoc,
  TopBuyerItem,
  PricePerSqmItem,
  BOQVarianceItem,
} from './report-aggregator.types';

// ============================================================================
// Projects & Buildings aggregation
// ============================================================================

export function buildNameMap(items: Array<{ id: string; name?: string }>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const item of items) {
    map[item.id] = item.name ?? item.id;
  }
  return map;
}

export function buildRevenueByProject(
  units: UnitDoc[],
  projectNames: Record<string, string>,
): Record<string, number> {
  const revenue: Record<string, number> = {};
  for (const u of units) {
    if (u.commercialStatus === 'sold' && u.commercial?.finalPrice && u.project) {
      const name = projectNames[u.project] ?? u.project;
      revenue[name] = (revenue[name] || 0) + u.commercial.finalPrice;
    }
  }
  return revenue;
}

export function buildUnitsByBuilding(
  units: UnitDoc[],
  buildingNames: Record<string, string>,
): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {};
  for (const u of units) {
    const bName = buildingNames[u.buildingId ?? ''] ?? u.buildingId ?? 'unknown';
    if (!result[bName]) result[bName] = {};
    const status = u.commercialStatus ?? 'unknown';
    result[bName][status] = (result[bName][status] || 0) + 1;
  }
  return result;
}

export function buildPricePerSqm(
  units: UnitDoc[],
  buildingNames: Record<string, string>,
): PricePerSqmItem[] {
  const totals: Record<string, { revenue: number; area: number }> = {};
  for (const u of units) {
    if (u.commercialStatus !== 'sold' || !u.commercial?.finalPrice) continue;
    const area = u.areas?.gross;
    if (!area || area <= 0) continue;
    const bName = buildingNames[u.buildingId ?? ''] ?? u.buildingId ?? 'unknown';
    if (!totals[bName]) totals[bName] = { revenue: 0, area: 0 };
    totals[bName].revenue += u.commercial.finalPrice;
    totals[bName].area += area;
  }
  return Object.entries(totals)
    .filter(([, v]) => v.area > 0)
    .map(([building, v]) => ({
      building,
      pricePerSqm: Math.round(v.revenue / v.area),
    }));
}

export function buildBOQVariance(
  boqItems: BOQItemDoc[],
  buildingNames: Record<string, string>,
): BOQVarianceItem[] {
  const totals: Record<string, { estimated: number; actual: number }> = {};
  for (const item of boqItems) {
    const bName = buildingNames[item.buildingId ?? ''] ?? item.buildingId ?? 'unknown';
    if (!totals[bName]) totals[bName] = { estimated: 0, actual: 0 };
    const unitCost = (item.materialUnitCost ?? 0) + (item.laborUnitCost ?? 0) + (item.equipmentUnitCost ?? 0);
    totals[bName].estimated += (item.estimatedQuantity ?? 0) * unitCost;
    totals[bName].actual += (item.actualQuantity ?? item.estimatedQuantity ?? 0) * unitCost;
  }
  return Object.entries(totals).map(([building, v]) => ({
    building,
    estimated: Math.round(v.estimated),
    actual: Math.round(v.actual),
  }));
}

// ============================================================================
// Contacts aggregation
// ============================================================================

export function buildTopBuyers(
  units: UnitDoc[],
  contacts: Array<{ id: string; displayName?: string }>,
): TopBuyerItem[] {
  const contactNameMap = new Map(contacts.map(c => [c.id, c.displayName ?? c.id]));
  const buyers: Record<string, { value: number; count: number }> = {};
  for (const u of units) {
    if (u.commercialStatus !== 'sold' || !u.commercial?.finalPrice) continue;
    const buyerName = u.commercial.buyerName ?? 'unknown';
    if (!buyers[buyerName]) buyers[buyerName] = { value: 0, count: 0 };
    buyers[buyerName].value += u.commercial.finalPrice;
    buyers[buyerName].count += 1;
  }
  return Object.entries(buyers)
    .map(([name, b]) => ({
      name: contactNameMap.get(name) ?? name,
      totalValue: b.value,
      unitCount: b.count,
    }))
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 10);
}

export function computeCompleteness(
  contacts: Array<{ displayName?: string; email?: string; phone?: string; addresses?: Array<{ city?: string }> }>,
): number {
  if (contacts.length === 0) return 0;
  const FIELDS = 4;
  let filled = 0;
  for (const c of contacts) {
    if (c.displayName) filled++;
    if (c.email) filled++;
    if (c.phone) filled++;
    if (c.addresses && c.addresses.length > 0) filled++;
  }
  return Math.round((filled / (contacts.length * FIELDS)) * 100);
}

// ============================================================================
// Installment aging — shared between Sales + Financial reports
// ============================================================================

export function buildOverdueInstallments(units: UnitDoc[]): Installment[] {
  return units
    .filter(u => u.commercial?.paymentSummary && u.commercial.paymentSummary.overdueInstallments > 0)
    .map(u => ({
      index: 0,
      label: 'overdue',
      type: 'custom' as const,
      amount: u.commercial?.paymentSummary?.remainingAmount ?? 0,
      percentage: 0,
      dueDate: new Date(Date.now() - 45 * 86_400_000).toISOString(),
      status: 'due' as const,
      paidAmount: 0,
      paidDate: null,
      paymentIds: [],
      notes: null,
    }));
}
