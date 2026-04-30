/**
 * BOQ Cost Engine — Pure Functions
 *
 * Υπολογιστική μηχανή κοστολόγησης χωρίς side effects.
 * Τα αποτελέσματα δεν αποθηκεύονται — υπολογίζονται at runtime.
 *
 * @module services/measurements/cost-engine
 * @see ADR-175 §4.1.4 (Waste Factor), §3.4 (Cost Breakdown)
 */

import type { BOQItem, BOQScope, BOQSummary, BOQCategorySummary, CostAllocationMethod } from '@/types/boq';
import type { CostBreakdown, VarianceResult } from '@/types/boq';
import type { Property } from '@/types/property';
import { nowISO } from '@/lib/date-local';
import { compareByLocale } from '@/lib/intl-formatting';
import { propertyAreaOnFloor } from '@/lib/properties/floor-helpers';

// ============================================================================
// GROSS QUANTITY
// ============================================================================

/**
 * Υπολογισμός μικτής ποσότητας (net + waste)
 *
 * @param netQuantity - Καθαρή ποσότητα (από μέτρηση)
 * @param wasteFactor - Ποσοστό φύρας (0.08 = 8%)
 * @returns Μικτή ποσότητα (net × (1 + wasteFactor))
 */
export function computeGrossQuantity(netQuantity: number, wasteFactor: number): number {
  const clampedWaste = Math.max(0, Math.min(wasteFactor, 1));
  return netQuantity * (1 + clampedWaste);
}

// ============================================================================
// ITEM COST BREAKDOWN
// ============================================================================

/**
 * Πλήρης ανάλυση κόστους ενός BOQ item
 *
 * @param item - Το BOQ item
 * @returns CostBreakdown — computed, NEVER stored in Firestore
 */
export function computeItemCost(item: BOQItem): CostBreakdown {
  const grossQuantity = computeGrossQuantity(item.estimatedQuantity, item.wasteFactor);

  const materialCost = grossQuantity * item.materialUnitCost;
  const laborCost = grossQuantity * item.laborUnitCost;
  const equipmentCost = grossQuantity * item.equipmentUnitCost;

  const unitCost = item.materialUnitCost + item.laborUnitCost + item.equipmentUnitCost;
  const totalCost = materialCost + laborCost + equipmentCost;

  return {
    netQuantity: item.estimatedQuantity,
    grossQuantity,
    materialCost,
    laborCost,
    equipmentCost,
    unitCost,
    totalCost,
    wasteFactorApplied: item.wasteFactor,
    unit: item.unit,
  };
}

// ============================================================================
// VARIANCE (ESTIMATED vs ACTUAL)
// ============================================================================

/**
 * Υπολογισμός απόκλισης εκτίμησης vs πραγματικών
 *
 * @param item - Το BOQ item (πρέπει να έχει actualQuantity)
 * @returns VarianceResult ή null αν δεν υπάρχει actualQuantity
 */
export function computeVariance(item: BOQItem): VarianceResult | null {
  if (item.actualQuantity === null || item.actualQuantity === undefined) {
    return null;
  }

  const estimated = item.estimatedQuantity;
  const actual = item.actualQuantity;
  const delta = actual - estimated;
  const percent = estimated !== 0 ? (delta / estimated) * 100 : 0;

  const unitCost = item.materialUnitCost + item.laborUnitCost + item.equipmentUnitCost;
  const estimatedGross = computeGrossQuantity(estimated, item.wasteFactor);
  const actualGross = computeGrossQuantity(actual, item.wasteFactor);

  const estimatedCost = estimatedGross * unitCost;
  const actualCost = actualGross * unitCost;

  return {
    estimated,
    actual,
    delta,
    percent,
    estimatedCost,
    actualCost,
    costDelta: actualCost - estimatedCost,
  };
}

// ============================================================================
// COST ALLOCATION (ADR-329 §3.1.1, §3.7.2)
// ============================================================================

/** Result of cost allocation: per-property breakdown + warnings emitted. */
export interface AllocationResult {
  /** Map of propertyId → allocated cost (€) */
  allocations: Record<string, number>;
  /** Warnings (e.g. partial-area fallback per ADR-329 §3.7.2). */
  warnings: AllocationWarning[];
}

export interface AllocationWarning {
  type: 'partial_area_fallback' | 'no_area_fallback_to_equal' | 'empty_targets';
  propertyId?: string;
  propertyCode?: string;
}

/**
 * Allocate `totalCost` across `targetProperties` according to method.
 * - by_area  : proportional to per-floor area when scope=floor (multi-level
 *              partial via levelData[floorId].areas.gross), else total area.
 *              Falls back to `equal` when all areas are 0.
 * - equal    : even split.
 * - custom   : honor `customAllocations` percentages (sum=100 caller-validated).
 *
 * Pure function — no side effects.
 *
 * @see ADR-329 §3.1.1, §3.7.2
 */
export function allocateCost(
  targetProperties: Property[],
  totalCost: number,
  method: CostAllocationMethod,
  scope: BOQScope,
  linkedFloorId: string | null,
  customAllocations: Record<string, number> | null,
): AllocationResult {
  const warnings: AllocationWarning[] = [];

  if (targetProperties.length === 0) {
    return { allocations: {}, warnings: [{ type: 'empty_targets' }] };
  }

  if (method === 'equal') {
    const per = totalCost / targetProperties.length;
    const allocations: Record<string, number> = {};
    for (const p of targetProperties) allocations[p.id] = per;
    return { allocations, warnings };
  }

  if (method === 'custom' && customAllocations) {
    const allocations: Record<string, number> = {};
    for (const p of targetProperties) {
      const pct = customAllocations[p.id] ?? 0;
      allocations[p.id] = totalCost * (pct / 100);
    }
    return { allocations, warnings };
  }

  // by_area (default)
  const areas: Record<string, number> = {};
  let totalArea = 0;
  for (const p of targetProperties) {
    const info = scope === 'floor' && linkedFloorId
      ? propertyAreaOnFloor(p, linkedFloorId)
      : { area: p.areas?.gross ?? 0, isPartial: false, isFallback: false };
    const area = info?.area ?? 0;
    areas[p.id] = area;
    totalArea += area;
    if (info?.isFallback) {
      warnings.push({ type: 'partial_area_fallback', propertyId: p.id, propertyCode: p.code ?? p.name });
    }
  }

  if (totalArea === 0) {
    warnings.push({ type: 'no_area_fallback_to_equal' });
    const per = totalCost / targetProperties.length;
    const allocations: Record<string, number> = {};
    for (const p of targetProperties) allocations[p.id] = per;
    return { allocations, warnings };
  }

  const allocations: Record<string, number> = {};
  for (const p of targetProperties) {
    allocations[p.id] = totalCost * (areas[p.id] / totalArea);
  }
  return { allocations, warnings };
}

// ============================================================================
// BUILDING SUMMARY — ROLLUP
// ============================================================================

/**
 * Αθροιστική σύνοψη BOQ ανά κτίριο
 *
 * @param buildingId - ID κτιρίου
 * @param items - BOQ items του κτιρίου
 * @param categoryNames - Map categoryCode → ελληνική ονομασία
 * @returns BOQSummary
 */
export function computeBuildingSummary(
  buildingId: string,
  items: BOQItem[],
  categoryNames: Map<string, string>
): BOQSummary {
  // Ομαδοποίηση ανά κατηγορία
  const categoryMap = new Map<string, { items: BOQItem[]; estimatedCost: number; actualCost: number | null }>();

  for (const item of items) {
    const existing = categoryMap.get(item.categoryCode);
    const breakdown = computeItemCost(item);

    // Υπολογισμός actual cost αν υπάρχει actualQuantity
    let itemActualCost: number | null = null;
    if (item.actualQuantity !== null) {
      const actualGross = computeGrossQuantity(item.actualQuantity, item.wasteFactor);
      const unitCost = item.materialUnitCost + item.laborUnitCost + item.equipmentUnitCost;
      itemActualCost = actualGross * unitCost;
    }

    if (existing) {
      existing.items.push(item);
      existing.estimatedCost += breakdown.totalCost;
      if (itemActualCost !== null) {
        existing.actualCost = (existing.actualCost ?? 0) + itemActualCost;
      }
    } else {
      categoryMap.set(item.categoryCode, {
        items: [item],
        estimatedCost: breakdown.totalCost,
        actualCost: itemActualCost,
      });
    }
  }

  // Build category summaries
  const categories: BOQCategorySummary[] = [];
  let totalEstimatedCost = 0;
  let totalActualCost: number | null = null;

  for (const [code, data] of categoryMap.entries()) {
    const categoryName = categoryNames.get(code) ?? code;

    categories.push({
      categoryCode: code,
      categoryName,
      itemCount: data.items.length,
      totalEstimatedCost: data.estimatedCost,
      totalActualCost: data.actualCost,
    });

    totalEstimatedCost += data.estimatedCost;
    if (data.actualCost !== null) {
      totalActualCost = (totalActualCost ?? 0) + data.actualCost;
    }
  }

  // Sort by category code
  categories.sort((a, b) => compareByLocale(a.categoryCode, b.categoryCode));

  return {
    buildingId,
    totalItems: items.length,
    totalEstimatedCost,
    totalActualCost,
    categories,
    lastUpdated: nowISO(),
  };
}
