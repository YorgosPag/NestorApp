/**
 * Ο κύκλος ζωής στις αναγνώσεις του πράκτορα — τι σημαίνει «μόνο ζωντανά» για ένα σύνολο φίλτρων
 *
 * Καθαρές αποφάσεις, καμία ανάγνωση. Η αλυσίδα ασφαλείας (`firestore-query-plan`) ρωτά
 * {@link retiredStatusNamed} για να αποφασίσει **αν** ισχύει ο περιορισμός· ο handler ρωτά
 * {@link planLiveCount} για να μετρήσει χωρίς να φέρει έγγραφα.
 *
 * Κανόνας (ίδιος με τις επιμετρήσεις, `boq-target-properties`): εύρος συνόλου ⇒ μόνο ζωντανά·
 * **ρητή αναφορά** σε αποσυρμένη κατάσταση ⇒ μένει ό,τι ονομάστηκε.
 *
 * @module services/ai-pipeline/tools/handlers/firestore-live-scope
 * @see ADR-281 (SSOT Soft-Delete) · ADR-329 §3.9 · ADR-171 (Autonomous AI Agent)
 */

import { RETIRED_STATUSES } from '@/lib/firestore/trashed-status';
import type { QueryFilter } from '../executor-shared-types';

const STATUS_FIELD = 'status';

/** Οι τιμές ενός φίλτρου ως λίστα συμβολοσειρών — ό,τι δεν είναι κείμενο δεν είναι κατάσταση. */
function statusValuesOf(filter: QueryFilter): string[] {
  const values = Array.isArray(filter.value) ? filter.value : [filter.value];
  return values.filter((value): value is string => typeof value === 'string');
}

/** Φίλτρο που **καρφώνει** την κατάσταση σε συγκεκριμένες τιμές. */
const pinsStatus = (filter: QueryFilter): boolean =>
  filter.field === STATUS_FIELD && (filter.operator === '==' || filter.operator === 'in');

/** «Ζήτησε ο καλών ρητά αποσυρμένες εγγραφές;» — π.χ. `status == 'archived'`. */
export function retiredStatusNamed(filters: readonly QueryFilter[]): boolean {
  return filters
    .filter(pinsStatus)
    .some((filter) => statusValuesOf(filter).some((value) => RETIRED_STATUSES.includes(value)));
}

/**
 * Πώς μετριούνται οι **ζωντανές** εγγραφές που ταιριάζουν στα φίλτρα, χωρίς ανάγνωση εγγράφων.
 *
 * - `single`   — μία μέτρηση αρκεί (η κατάσταση είναι ήδη καρφωμένη σε ζωντανές τιμές, ή ένα
 *                υπάρχον `not-in` διευρύνεται ώστε να αποκλείει και τις αποσυρμένες)·
 * - `subtract` — `count(όλα)` − `count(ίδια φίλτρα ∧ αποσυρμένα)`. Όχι `not-in`: εκείνο δεν
 *                μετρά έγγραφα **χωρίς** `status` και δεν συνδυάζεται με `!=`.
 */
export type LiveCountPlan =
  | { readonly kind: 'single'; readonly filters: QueryFilter[] }
  | { readonly kind: 'subtract'; readonly filters: QueryFilter[]; readonly retired: QueryFilter[] };

export function planLiveCount(filters: readonly QueryFilter[]): LiveCountPlan {
  if (filters.some(pinsStatus)) return { kind: 'single', filters: [...filters] };

  const excludesStatuses = (filter: QueryFilter): boolean =>
    filter.field === STATUS_FIELD && filter.operator === 'not-in';

  if (filters.some(excludesStatuses)) {
    return {
      kind: 'single',
      filters: filters.map((filter) =>
        excludesStatuses(filter)
          ? { ...filter, value: [...new Set([...statusValuesOf(filter), ...RETIRED_STATUSES])] }
          : filter,
      ),
    };
  }

  return {
    kind: 'subtract',
    filters: [...filters],
    retired: [...filters, { field: STATUS_FIELD, operator: 'in', value: [...RETIRED_STATUSES] }],
  };
}

/**
 * Το πλήθος των **ζωντανών** εγγραφών που ταιριάζουν — εκτελεί το {@link planLiveCount} με τον
 * μετρητή του καλούντος (η ανάγνωση μένει δική του: αυτό το module δεν αγγίζει βάση).
 */
export async function countLive(
  countOf: (filters: readonly QueryFilter[]) => Promise<number>,
  filters: readonly QueryFilter[],
): Promise<number> {
  const plan = planLiveCount(filters);
  const total = await countOf(plan.filters);
  if (plan.kind === 'single' || total === 0) return total;

  return total - (await countOf(plan.retired));
}
