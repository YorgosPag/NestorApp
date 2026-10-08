/**
 * 🏢 SPOT CARD STAT BUILDERS (ADR-585)
 *
 * Shared StatItem builders for spatial-inventory cards (parking / storage /
 * property). The floor / area / price rows were built identically across every
 * spatial card; centralized here so each entity model just composes them in its
 * own order with its own label. Returns `null` when the value is absent so
 * callers can `.filter(Boolean)`.
 *
 * @see ADR-585 Domain card view-model hook SSoT
 */

import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import type { StatItem } from '@/design-system';
import {
  resolveDisplayPrice,
  type PricedPropertyLike,
  type ResolvedPrice,
} from '@/lib/properties/price-resolver';
import {
  priceStandingLabel,
  resolvedPriceLabel,
  type PriceLabelT,
} from '@/lib/listings/listing-price-label';

/**
 * Floor / level row. `value` is the ALREADY-localized label — callers render it with
 * `useFloorLabel()` (ADR-903: one formatter, one parser; this builder only lays out the row).
 */
export function floorStat(value: string | undefined | null, label: string): StatItem | null {
  if (!value) return null;
  return {
    icon: NAVIGATION_ENTITIES.floor.icon,
    iconColor: NAVIGATION_ENTITIES.floor.color,
    label,
    value,
  };
}

/** Area row in m². */
export function areaStat(area: number | undefined | null, label: string): StatItem | null {
  if (!area) return null;
  return {
    icon: NAVIGATION_ENTITIES.area.icon,
    iconColor: NAVIGATION_ENTITIES.area.color,
    label,
    value: `${area} m²`,
  };
}

/** Το εικονίδιο ποσού που δεν είναι προσφορά — ουδέτερο, ποτέ το χρώμα της τιμής. */
const OUT_OF_OFFER_ICON_COLOR = 'text-muted-foreground';

/**
 * Price row — **με τη μονάδα του ρόλου** («12.000 €» · «60 €/μήνα»), από τον ΕΝΑ επιλυτή.
 *
 * 🔴 ADR-777 §8.60.18: ως τις 2026-09-18 διάβαζε το @deprecated flat `price` — άρα θέση προς
 * ενοικίαση **δεν έδειχνε καμία τιμή** στις λίστες θέσεων/αποθηκών, και μια παλιά `price`
 * θα γραφόταν «€» ακόμη κι αν ήταν μηνιαίο ενοίκιο. Πλέον: `resolveDisplayPrice` → το ίδιο
 * κείμενο με τους πίνακες (`resolvedPriceLabel`). Χωρίς τιμή ⇒ καμία γραμμή.
 *
 * 🔴 ADR-329 §3.9 (Ν3, 2026-10-08): η ετυμηγορία φέρει και τη **στάθμη** — και εδώ πετιόταν. Θέση
 * «Μη διαθέσιμη» έγραφε «Τιμή 12.000 €» στο πράσινο της προσφοράς. Το `label` του καλούντα ισχύει
 * πλέον **μόνο** για ποσό σε ισχύ· αλλιώς μιλά ο ΕΝΑΣ πίνακας λέξεων (`priceStandingLabel`).
 */
export function priceStat(item: PricedPropertyLike, label: string, t: PriceLabelT): StatItem | null {
  const price = resolveDisplayPrice(item);
  if (price.kind !== 'priced') return null;
  return priceAmountStat(price.headline, label, priceStandingLabel(t, price), t);
}

/**
 * **Ένα ποσό → μία γραμμή**, για κάθε κάρτα χώρου ή ακινήτου (ADR-329 §3.9).
 *
 * `standingLabel` είναι η απάντηση του {@link priceStandingLabel}: `null` ⇒ προσφορά — η λέξη του
 * καλούντα, με το χρώμα της τιμής· αλλιώς το ίδιο ποσό με **άλλη σημασία** — η λέξη της στάθμης,
 * ουδέτερο εικονίδιο και **κανένα** `valueColor`. Το χρώμα αποφασίζεται εδώ, μία φορά: καμία κάρτα
 * δεν μπορεί να πάρει τη λέξη «Τιμή ζήτησης» και να κρατήσει το πράσινο.
 */
export function priceAmountStat(
  price: ResolvedPrice,
  label: string,
  standingLabel: string | null,
  t: PriceLabelT,
): StatItem {
  const row = {
    icon: NAVIGATION_ENTITIES.price.icon,
    value: resolvedPriceLabel(t, price),
  };
  return standingLabel === null
    ? { ...row, iconColor: NAVIGATION_ENTITIES.price.color, label, valueColor: NAVIGATION_ENTITIES.price.color }
    : { ...row, iconColor: OUT_OF_OFFER_ICON_COLOR, label: standingLabel };
}
