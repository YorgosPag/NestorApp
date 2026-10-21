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

/** Ομάδες σε σειρά πρώτης εμφάνισης — η ταξινόμηση είναι του καλούντα */
export function groupBoqCost<T extends BOQItem>(
  items: readonly T[],
  keyOf: (item: T) => string,
): BoqCostGroup<T>[] {
  const summaries = excludedSummaryIds(items);
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
