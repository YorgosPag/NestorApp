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
import { formatFloorString } from '@/lib/intl-utils';
import { resolveDisplayPrice, type PricedPropertyLike } from '@/lib/properties/price-resolver';
import { priceCellLabel, type PriceLabelT } from '@/lib/listings/listing-price-label';

/** Floor / level row (localized via `formatFloorString`). */
export function floorStat(value: string | undefined | null, label: string): StatItem | null {
  if (!value) return null;
  return {
    icon: NAVIGATION_ENTITIES.floor.icon,
    iconColor: NAVIGATION_ENTITIES.floor.color,
    label,
    value: formatFloorString(value),
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

/**
 * Price row — **με τη μονάδα του ρόλου** («12.000 €» · «60 €/μήνα»), από τον ΕΝΑ επιλυτή.
 *
 * 🔴 ADR-777 §8.60.18: ως τις 2026-09-18 διάβαζε το @deprecated flat `price` — άρα θέση προς
 * ενοικίαση **δεν έδειχνε καμία τιμή** στις λίστες θέσεων/αποθηκών, και μια παλιά `price`
 * θα γραφόταν «€» ακόμη κι αν ήταν μηνιαίο ενοίκιο. Πλέον: `resolveDisplayPrice` → το ίδιο
 * κείμενο κελιού με τους πίνακες (`priceCellLabel`). Χωρίς τιμή ⇒ καμία γραμμή.
 */
export function priceStat(item: PricedPropertyLike, label: string, t: PriceLabelT): StatItem | null {
  const price = resolveDisplayPrice(item);
  if (price.kind !== 'priced') return null;
  return {
    icon: NAVIGATION_ENTITIES.price.icon,
    iconColor: NAVIGATION_ENTITIES.price.color,
    label,
    value: priceCellLabel(t, price),
    valueColor: NAVIGATION_ENTITIES.price.color,
  };
}
