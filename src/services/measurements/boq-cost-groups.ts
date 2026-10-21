/**
 * BOQ cost groups — γραμμές BOQ ομαδοποιημένες ανά κλειδί, με το σύνολο κόστους της ομάδας
 *
 * Ο ΕΝΑΣ ομαδοποιητής των πινάκων μετρήσεων (ανά κατηγορία, ανά όροφο). Ήταν αντίγραφο σε δύο
 * components (`BOQFloorGroup`, `BOQCategoryAccordion`).
 *
 * - Κόστος γραμμής ΜΟΝΟ από `cost-engine.computeItemCost` (ADR-917 Δ1).
 * - Η ομάδα **δείχνει** κάθε γραμμή, αλλά το σύνολο **δεν** αθροίζει γονέα-σύνοψη (τοίχος DNA) —
 *   το «μετράει;» αποφασίζεται στο **πλήρες** σύνολο, πριν την ομαδοποίηση (ADR-917 Λ7).
 *
 * @module services/measurements/boq-cost-groups
 * @see ADR-917 §2.4 Λ7
 */

import type { BOQItem } from '@/types/boq';
import { computeItemCost } from './cost-engine';
import { excludedSummaryIds } from './boq-line-role';

interface BoqCostGroup<T extends BOQItem> {
  key: string;
  /** Όλες οι γραμμές της ομάδας, και οι γονείς-σύνοψη (φαίνονται) */
  items: T[];
  /** Σ κόστους των γραμμών που μετρούν */
  totalCost: number;
}

/**
 * Ομάδες σε σειρά πρώτης εμφάνισης — η ταξινόμηση είναι του καλούντα.
 * `summaries`: οι συνόψεις εκτός αθροίσματος, αποφασισμένες στο ΠΛΗΡΕΣ σύνολο (Α25) όταν ο πίνακας δείχνει
 * φιλτραρισμένο υποσύνολο· προεπιλογή = απόφαση πάνω στις ίδιες τις γραμμές.
 */
export function groupBoqCost<T extends BOQItem>(
  items: readonly T[],
  keyOf: (item: T) => string,
  summaries: ReadonlySet<string> = excludedSummaryIds(items),
): BoqCostGroup<T>[] {
  const groups = new Map<string, BoqCostGroup<T>>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key) ?? { key, items: [], totalCost: 0 };
    group.items.push(item);
    if (!summaries.has(item.id)) group.totalCost += computeItemCost(item).totalCost;
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** ADR-917 Ε2 — the cost of a summary parent, DERIVED from its layers (never its own price). */
export interface DerivedSummaryCost {
  /** Present layers that replace the parent in every sum */
  layerCount: number;
  /** Σ of the layers' costs */
  totalCost: number;
  /** Σ ÷ the parent's quantity (€ per m² of wall — Autodesk Build: subitems roll up, ÷ parent quantity); `null` without quantity */
  unitRate: number | null;
}

/** The ONE rule, for callers that already hold the layer costs (3D tab: its own quantity basis). */
export function deriveSummaryCost(summaryQuantity: number, layerCosts: readonly number[]): DerivedSummaryCost {
  const totalCost = layerCosts.reduce((sum, cost) => sum + cost, 0);
  return { layerCount: layerCosts.length, totalCost, unitRate: summaryQuantity > 0 ? totalCost / summaryQuantity : null };
}

/**
 * Every summary parent of a FULL set that its layers replace (Λ7 `excludedSummaryIds`), with its derived cost.
 * A summary WITHOUT present layers is absent: it still counts with its own price (Α22) and stays editable.
 */
export function derivedSummaryCosts<T extends BOQItem>(items: readonly T[]): ReadonlyMap<string, DerivedSummaryCost> {
  const summaries = excludedSummaryIds(items);
  const layerCosts = new Map<string, number[]>();
  for (const item of items) {
    if (!item.parentBoqItemId || !summaries.has(item.parentBoqItemId)) continue;
    const costs = layerCosts.get(item.parentBoqItemId) ?? [];
    costs.push(computeItemCost(item).totalCost);
    layerCosts.set(item.parentBoqItemId, costs);
  }
  const derived = new Map<string, DerivedSummaryCost>();
  for (const item of items) {
    const costs = layerCosts.get(item.id);
    if (costs) derived.set(item.id, deriveSummaryCost(item.estimatedQuantity, costs));
  }
  return derived;
}
