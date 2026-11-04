/**
 * **Ο συντελεστής ΦΠΑ που ισχύει σε μια κατηγορία** (ADR-923 §5.13 Ε3 · Σ6): ο δικός της, αλλιώς του πλησιέστερου προγόνου που
 * δηλώνει. Είναι ο κανόνας **ενός κλάδου**: εδώ η αλυσίδα είναι μία (ρίζα → γονέας), άρα αμφισημία δεν υπάρχει. Η βιτρίνα
 * (`showcaseVatRateOf`, ανασκόπηση Χ2) τον εφαρμόζει σε **κάθε** κλάδο του SKU χωριστά· αν οι κλάδοι διαφωνούν ⇒ `null`
 * («Κατόπιν προσφοράς»), ό,τι κι αν είναι το βάθος τους. Ο γραφέας τον χρησιμοποιεί για τον φράκτη Χ4 της μετακίνησης.
 *
 * **Layering**: καθαρό, χωρίς I/O. Το διαβάζει η οθόνη κατηγορίας για την ένδειξη «ισχύει».
 * @module subapps/catalog/schema/category-vat
 */

import type { GreekVatRatePercent } from '@/subapps/accounting/services/config/vat-rates';
import type { CatalogCategoryDefinition } from '../types/category';

/** Ό,τι χρειάζεται η κληρονομιά από μια κατηγορία: το id, ο δηλωμένος συντελεστής και (για τη βιτρίνα) η διαδρομή της. */
export type CategoryVatHolder = Pick<CatalogCategoryDefinition, 'vatRate'> & { readonly id: string; readonly ancestorIds: readonly string[] };
type VatHolder = Pick<CategoryVatHolder, 'id' | 'vatRate'>;

/** Από πού έρχεται ο συντελεστής: η ίδια η κατηγορία ή ένας πρόγονος (με το id του). */
export type CategoryVatSource =
  | { readonly kind: 'own'; readonly rate: GreekVatRatePercent }
  | { readonly kind: 'inherited'; readonly rate: GreekVatRatePercent; readonly fromCategoryId: string }
  | { readonly kind: 'none' };

/**
 * @param ownRate ο συντελεστής της ίδιας της κατηγορίας (από το πρόχειρο της φόρμας)· `null` = «κληρονομείται».
 * @param ancestorIds ρίζα → γονέας, όπως το `ancestorIds` της κατηγορίας.
 * @param byId οι κατηγορίες του χώρου· πρόγονος που λείπει (διαγραμμένος) απλώς παραλείπεται.
 */
export function categoryVatSource(ownRate: GreekVatRatePercent | null, ancestorIds: readonly string[], byId: ReadonlyMap<string, VatHolder>): CategoryVatSource {
  if (ownRate !== null) return { kind: 'own', rate: ownRate };
  for (let index = ancestorIds.length - 1; index >= 0; index -= 1) {
    const ancestor = byId.get(ancestorIds[index]);
    const rate = ancestor?.vatRate ?? null;
    if (ancestor !== undefined && rate !== null) return { kind: 'inherited', rate, fromCategoryId: ancestor.id };
  }
  return { kind: 'none' };
}

const effectiveRate = (source: CategoryVatSource): GreekVatRatePercent | null => (source.kind === 'none' ? null : source.rate);

/**
 * Οι κατηγορίες ενός υποδέντρου των οποίων ο **ενεργός** συντελεστής αλλάζει όταν αλλάζουν οι διαδρομές τους (ADR-923 §5.13 Σ6,
 * ανασκόπηση Μ-1). Η μετακίνηση δεν αγγίζει κανένα `vatRate`, αλλά κάτω από ρίζα με άλλον συντελεστή αλλάζει την **τελική** τιμή
 * προς τον καταναλωτή όσων κληρονομούν: ο φράκτης Χ4 ρωτά αυτή τη συνάρτηση, όχι το αν «γράφτηκε συντελεστής».
 *
 * @param nodes η κατηγορία που μετακινείται και όλοι οι απόγονοί της, με τις **τρέχουσες** διαδρομές τους.
 * @param nextAncestors οι **νέες** διαδρομές ανά id (`rebaseSubtree`)· ό,τι λείπει κρατά την τρέχουσα.
 * @param byId παλιοί **και** νέοι πρόγονοι, μαζί με τους κόμβους του υποδέντρου.
 */
export function vatRateShifts(
  nodes: readonly CategoryVatHolder[],
  nextAncestors: ReadonlyMap<string, readonly string[]>,
  byId: ReadonlyMap<string, VatHolder>,
): readonly string[] {
  return nodes
    .filter((node) => {
      const own = node.vatRate ?? null;
      const before = effectiveRate(categoryVatSource(own, node.ancestorIds, byId));
      const after = effectiveRate(categoryVatSource(own, nextAncestors.get(node.id) ?? node.ancestorIds, byId));
      return before !== after;
    })
    .map((node) => node.id);
}
