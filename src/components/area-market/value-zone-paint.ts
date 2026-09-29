/**
 * @fileoverview **Τα χρώματα της στρώσης ζωνών** — κλάση τιμής → απόχρωση της `--map-seq-*`, χωρίς καμία εξάρτηση χάρτη.
 * @related ADR-889 §10 · `lib/market/value-zone-classes.ts` (οι κλάσεις) · `search-results/listing-map-paint.ts` (ίδιο ιδίωμα)
 * @module components/area-market/value-zone-paint
 *
 * ⚠️ Το MapLibre **δεν** αποτιμά CSS custom properties ⇒ η τιμή διαβάζεται **τη στιγμή της απόδοσης** από το θέμα
 * (`readRootCssVar`), ώστε το υπόμνημα (CSS) και ο χάρτης (MapLibre) να δείχνουν το **ίδιο** χρώμα από την ίδια πηγή.
 */

import { readRampColors } from '@/components/market/map-ramp';
import type { FillLayerSpecification } from '@/lib/maps/maplibre';
import type { PriceClass } from '@/lib/market/value-zone-classes';

type ColorValue = NonNullable<FillLayerSpecification['paint']>['fill-color'];

/** Τα χρώματα **τώρα**, ένα ανά κλάση — από την κοινή κλίμακα (`components/market/map-ramp.ts`). */
export function readClassColors(classes: readonly PriceClass[]): readonly string[] {
  return readRampColors(classes.length);
}

/**
 * `['step', τιμή, χρώμα₀, όριο₁, χρώμα₁, …]` — το κατώφλι κάθε κλάσης είναι το `low` της, **η ίδια τιμή** που γράφει
 * το υπόμνημα. Μία κλάση ⇒ σταθερό χρώμα.
 */
export function priceStepColor(classes: readonly PriceClass[], colors: readonly string[]): ColorValue {
  if (colors.length <= 1) return colors[0] ?? readRampColors(1)[0];
  const stops = classes.slice(1).flatMap((item, index) => [item.low, colors[index + 1]]);
  return ['step', ['get', 'price'], colors[0], ...stops] as ColorValue;
}
