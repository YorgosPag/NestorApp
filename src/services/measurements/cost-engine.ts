/**
 * BOQ Cost Engine — Pure Functions
 *
 * Υπολογιστική μηχανή κοστολόγησης χωρίς side effects.
 * Τα αποτελέσματα δεν αποθηκεύονται — υπολογίζονται at runtime.
 *
 * @module services/measurements/cost-engine
 * @see ADR-175 §4.1.4 (Waste Factor), §3.4 (Cost Breakdown)
 */

import type { BOQItem, BOQSummary, BOQCategorySummary } from '@/types/boq';
import type { CostBreakdown, VarianceResult } from '@/types/boq';

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
  categories.sort((a, b) => a.categoryCode.localeCompare(b.categoryCode));

  return {
    buildingId,
    totalItems: items.length,
    totalEstimatedCost,
    totalActualCost,
    categories,
    lastUpdated: new Date().toISOString(),
  };
}
