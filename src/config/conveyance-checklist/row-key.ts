/**
 * =============================================================================
 * Conveyance Checklist — η ταυτότητα μιας ΓΡΑΜΜΗΣ (ADR-915 §22)
 * =============================================================================
 *
 * Μία γραμμή του καταλόγου (`ChecklistItem`) μπορεί να γίνει **πολλές** γραμμές μιας υπόθεσης — μία ανά πρόσωπο του
 * ρόλου της (`partyRole`). Το κλειδί γραμμής είναι **υπερσύνολο** του `itemId`:
 *
 * - γραμμή υπόθεσης   → `itemId`               (π.χ. `title_deed` — **ίδιο** με πριν, μηδέν μετάπτωση)
 * - γραμμή προσώπου   → `itemId@partyKey`      (π.χ. `seller_tax_clearance@cont_…`)
 *
 * Ό,τι αποθηκεύεται ή ταξιδεύει ως «γραμμή» (`overrides`, εντολές, αιτήματα, αποστολές, σήματα, ειδοποιήσεις) κρατά
 * αυτό το κλειδί στο **ίδιο** πεδίο `itemId` / `checklistItemId` που κρατούσε ήδη. Η συναρμολόγηση και η ανάλυσή του
 * ζουν **μόνο** εδώ — κανένα δεύτερο `${id}@${key}` στον κώδικα.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις.
 *
 * @module config/conveyance-checklist/row-key
 */

import { getChecklistItem } from './catalog';
import type { ChecklistItem } from './types';

/** Ο διαχωριστής γραμμής καταλόγου ↔ προσώπου. Κανένα `itemId` δεν τον περιέχει (άγκυρα στον κατάλογο). */
export const ROW_PARTY_SEPARATOR = '@';

export interface ParsedRowKey {
  readonly itemId: string;
  /** `null` = γραμμή της υπόθεσης — ή παλιό κλειδί πριν από τις γραμμές ανά πρόσωπο (`canonicalRowKey`). */
  readonly partyKey: string | null;
}

/** Το κλειδί της γραμμής: σκέτο `itemId` για την υπόθεση, `itemId@partyKey` για πρόσωπο. */
export function rowKeyOf(itemId: string, partyKey: string | null): string {
  return partyKey === null ? itemId : `${itemId}${ROW_PARTY_SEPARATOR}${partyKey}`;
}

/** Το αντίστροφο του `rowKeyOf` — χωρίζει στον **πρώτο** διαχωριστή. */
export function parseRowKey(rowKey: string): ParsedRowKey {
  const at = rowKey.indexOf(ROW_PARTY_SEPARATOR);
  if (at < 0) return { itemId: rowKey, partyKey: null };
  return { itemId: rowKey.slice(0, at), partyKey: rowKey.slice(at + ROW_PARTY_SEPARATOR.length) };
}

/**
 * Η γραμμή **του καταλόγου** πίσω από ένα κλειδί γραμμής — για ό,τι ρωτά μόνο τον κατάλογο (ετικέτα, είδος εγγράφου,
 * ορατότητα). ⚠️ **Δεν** επικυρώνει ότι το πρόσωπο ανήκει στην υπόθεση: αυτό το κάνει το `resolveCaseRow`.
 */
export function checklistItemOfRowKey(rowKey: string): ChecklistItem | undefined {
  return getChecklistItem(parseRowKey(rowKey).itemId);
}
