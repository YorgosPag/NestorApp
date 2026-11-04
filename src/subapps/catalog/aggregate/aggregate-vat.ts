/**
 * **Ο φράκτης Χ4 στην ανάθεση κατηγοριών** (ADR-923 §5.13 Σ6, ανασκόπηση Μ-1): ποια SKU ενός συνόλου αλλάζουν **ενεργό**
 * συντελεστή ΦΠΑ με αυτή την εγγραφή.
 *
 * Ο συντελεστής ενός SKU δεν γράφεται πάνω του: βγαίνει από τις κατηγορίες της αλυσίδας του (`showcaseVatRateOf`). Άρα η αλλαγή
 * `categoryIds` ενός SKU ή ενός μοντέλου-φορέα, ή η μετακίνηση SKU σε άλλο μοντέλο, μπορεί να αλλάξει την **τελική** τιμή προς τον
 * καταναλωτή χωρίς να αγγίξει τιμή ή συντελεστή. Κρίνεται ο ίδιος κανόνας με τη βιτρίνα, πριν και μετά, πάνω στο ίδιο σύνολο.
 *
 * 🔑 Μόνο SKU που ζουν **και πριν και μετά**: νέο SKU δεν είχε τελική τιμή να αλλάξει (καμία γραμμή τιμής δεν το ονομάζει ακόμη),
 *    και διαγραμμένο δεν δείχνεται πια. Αυτά τα κρίνει η τιμολόγηση όταν αποκτήσουν τιμή.
 *
 * **Layering**: καθαρό, χωρίς I/O.
 * @module subapps/catalog/aggregate/aggregate-vat
 */

import { showcaseVatRateOf } from '../public/showcase-price';
import type { CategoryVatHolder } from '../schema/category-vat';
import { chainOf, productMembers, type AggregateSide, type CatalogAggregate } from './aggregate-model';

/** Οι κατηγορίες της αλυσίδας ενός SKU σε μία πλευρά της αλλαγής (το ίδιο σύνολο με το `readPublicVariantPlacements`). */
function chainCategoryIds(aggregate: CatalogAggregate, memberId: string, side: AggregateSide): readonly string[] {
  return chainOf(aggregate, memberId, side).flatMap((link) => link.holder.categoryIds);
}

/** Οι κατηγορίες των αλυσίδων αυτών των SKU, πριν **και** μετά: ό,τι πρέπει να διαβαστεί (μαζί με τους προγόνους τους). */
export function chainCategoryIdsOf(aggregate: CatalogAggregate, skuIds: readonly string[]): readonly string[] {
  const sides: readonly AggregateSide[] = ['before', 'after'];
  return [...new Set(skuIds.flatMap((id) => sides.flatMap((side) => chainCategoryIds(aggregate, id, side))))];
}

/** Τα SKU που ζουν πριν **και** μετά: τα μόνα που είχαν τελική τιμή και μπορεί να την αλλάξουν. */
function survivingSkuIds(aggregate: CatalogAggregate): readonly string[] {
  const before = new Set(productMembers(aggregate, 'before').map((member) => member.id));
  return productMembers(aggregate, 'after').map((member) => member.id).filter((id) => before.has(id));
}

const sameIds = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && [...left].sort().join('\u0000') === [...right].sort().join('\u0000');

/** Τα SKU των οποίων **άλλαξε το σύνολο** κατηγοριών της αλυσίδας. Κενό ⇒ καμία μετατόπιση δυνατή, καμία ανάγνωση χρειάζεται. */
export function skusWithChangedChains(aggregate: CatalogAggregate): readonly string[] {
  return survivingSkuIds(aggregate).filter(
    (id) => !sameIds(chainCategoryIds(aggregate, id, 'before'), chainCategoryIds(aggregate, id, 'after')),
  );
}

/** Τα SKU (ζωντανά πριν και μετά) των οποίων ο ενεργός συντελεστής αλλάζει. `byId`: οι κατηγορίες και οι πρόγονοί τους. */
export function aggregateVatShifts(aggregate: CatalogAggregate, byId: ReadonlyMap<string, CategoryVatHolder>): readonly string[] {
  return skusWithChangedChains(aggregate).filter((id) => {
    const was = showcaseVatRateOf(chainCategoryIds(aggregate, id, 'before'), byId);
    const will = showcaseVatRateOf(chainCategoryIds(aggregate, id, 'after'), byId);
    return was !== will;
  });
}
