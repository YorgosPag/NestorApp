/**
 * ADR-654 — Σύνθεση εμφανιζόμενου ονόματος entourage (M7, N-facet).
 *
 * Ο ΜΟΝΑΔΙΚΟΣ κανόνας σύνθεσης ονόματος από τα {@link EntourageLabelParts}: «Κατηγορία · facet1 ·
 * facet2 … NN». Η σειρά των facets έρχεται από τον UI descriptor (`facetKeys`) — τα facets που
 * λείπουν από το sprite παραλείπονται σιωπηλά. Ένα σημείο σύνθεσης ⇒ μηδέν αντιγραφή στην παλέτα
 * (N.18· πριν το M7 η `EntouragePalette` αντέγραφε τη λογική με hardcoded `.secondary.`).
 *
 * Pure (μηδέν React): δέχεται μια συνάρτηση μετάφρασης `(key) => string`.
 *
 * @see ./entourage-catalog-core.ts — `entourageLabelParts` (η σύμβαση κλειδιών)
 */

import type { EntourageLabelParts } from './entourage-catalog-core';

/**
 * @param translate  η i18n `t()` (ή οποιαδήποτε `(key) => string`)
 * @param labelParts τα κλειδιά του sprite ({@link entourageLabelParts})
 * @param facetOrder η σειρά εμφάνισης των facets (από τον descriptor· κενή = μόνο κατηγορία)
 */
export function composeEntourageDisplayName(
  translate: (key: string) => string,
  labelParts: EntourageLabelParts,
  facetOrder: readonly string[],
): string {
  const parts = [translate(labelParts.categoryKey)];
  for (const facetName of facetOrder) {
    const key = labelParts.facetKeys[facetName];
    if (key) parts.push(translate(key));
  }
  return `${parts.join(' · ')} ${labelParts.series}`;
}
