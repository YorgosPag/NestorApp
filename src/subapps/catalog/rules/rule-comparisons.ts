/**
 * Οι στοιχειώδεις συγκρίσεις των κανόνων συνέπειας (ADR-923 §21) — **μία** φορά, ώστε ο
 * αξιολογητής και η οθόνη (προεπισκόπηση κανόνα) να μη γράψουν δεύτερη εκδοχή του «≥».
 * @module subapps/catalog/rules/rule-comparisons
 */

import type { CatalogAttributeDefinition } from '../types/attribute';
import type { CompareOperator, OrderDirection } from '../types/family';

/** Ισχύει η διάταξη `previous → next` στη ζητούμενη κατεύθυνση; */
export function holdsOrder(previous: number, next: number, direction: OrderDirection, strict: boolean): boolean {
  if (direction === 'ascending') return strict ? previous < next : previous <= next;
  return strict ? previous > next : previous >= next;
}

export function compareNumbers(left: number, operator: CompareOperator, right: number): boolean {
  switch (operator) {
    case 'lt':
      return left < right;
    case 'lte':
      return left <= right;
    case 'gt':
      return left > right;
    case 'gte':
      return left >= right;
    case 'eq':
      return left === right;
    case 'neq':
      return left !== right;
  }
}

/**
 * **Η θέση μιας τιμής πάνω στον άξονα** — για να ταξινομηθούν οι παραλλαγές:
 * μέτρηση/αριθμός → η ίδια η τιμή (σε πρότυπο) · επιλογή → η **δηλωμένη** σειρά της
 * επιλογής (το «S < M < L» το λέει ο προμηθευτής, όχι το αλφάβητο) · ναι/όχι → 0/1.
 * `null` όταν η τιμή δεν έχει θέση (λείπει ή δεν αναγνωρίζεται).
 */
export function axisRank(axis: CatalogAttributeDefinition, value: unknown): number | null {
  switch (axis.type) {
    case 'measurement':
    case 'number':
      return typeof value === 'number' ? value : null;
    case 'select': {
      const index = axis.config.options.findIndex((option) => option.code === value);
      return index === -1 ? null : index;
    }
    case 'boolean':
      return typeof value === 'boolean' ? Number(value) : null;
    default:
      return null;
  }
}
