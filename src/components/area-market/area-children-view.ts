/**
 * @fileoverview **Η όψη του χάρτη σύγκρισης μιας σελίδας περιοχής** (ADR-890 §15 · §16) — καθαρές συναρτήσεις: ποια
 * τμήματα έχουν νόημα, η κατάταξη των παιδιών, οι ετικέτες πάνω στον χάρτη, οι τρόποι του χάρτη. Καμία εξάρτηση
 * React/MapLibre. Ίδια για κάθε βαθμίδα: Περιφέρεια → Π.Ε. · Π.Ε. → Δήμοι · Δήμος → Δ.Ε.
 * @related `lib/market/price-map-view.ts` (η κατάταξη και οι καταστάσεις — ΙΔΙΕΣ με τον χάρτη της αναζήτησης) ·
 *   `AreaChildPriceLayer.tsx` · `AreaChildrenTable.tsx`
 * @module components/area-market/area-children-view
 *
 * 🔑 **Μηδέν δεύτερη λογική τιμής**: το παιδί γίνεται `AdminOverviewProperties` με γονέα τη σελίδα, και από εκεί ό,τι
 *   λέει ο χάρτης της αναζήτησης (`resolvePriceMapArea` → δική τιμή · τιμή γονέα · λίγα) λέγεται ίδιο και εδώ.
 * 🔑 **Μόνο συμβόλαια**: οι ζητούμενες δεν περνούν ακόμη το κατώφλι σε καμία περιοχή (§14.9) — διακόπτης πηγής που
 *   δίνει παντού «λίγα» θα ήταν νεκρό χειριστήριο. Ανοίγει όταν περάσουν (§15 δηλωμένα ανοιχτά).
 */

import type { AdminArea } from '@/lib/geo/admin-area-index-file';
import type { AdminOverviewFeature, AdminOverviewProperties } from '@/lib/geo/admin-overview-file';
import type { MarketSegment } from '@/lib/market/market-segments';
import type { PriceMapAreas } from '@/lib/market/price-map';
import { rankedSelectionsOf, segmentsFor, type PriceMapChoice, type PriceMapSelection } from '@/lib/market/price-map-view';

/** Το τμήμα με το οποίο ανοίγει ο χάρτης, όταν έχει νόημα — ίδια αφετηρία με τον χάρτη της αναζήτησης. */
const DEFAULT_SEGMENT: MarketSegment = 'apartment';

/** Η επιλογή του χάρτη σύγκρισης: πώληση · συμβόλαια · τμήμα. */
export function childMapChoice(segment: MarketSegment): PriceMapChoice {
  return { offer: 'sale', source: 'contracts', segment };
}

/** Τα παιδιά ως περιοχές του χάρτη, με γονέα τη σελίδα — ώστε η αναγωγή να είναι η **ίδια** με της αναζήτησης. */
export function childPropertiesOf(parent: AdminArea, children: readonly AdminArea[]): readonly AdminOverviewProperties[] {
  return children.map((child) => ({ id: child.id, name: child.name, parent: parent.id, parentName: parent.name }));
}

/**
 * Τα τμήματα που **λένε κάτι** για αυτή τη σελίδα: τουλάχιστον ένα παιδί με τιμή (δική του ή του γονέα). Κανένα ⇒ μόνο
 * η αφετηρία, ώστε ο πίνακας να πει τίμια «λίγα» αντί να εξαφανιστεί.
 */
export function childSegmentsOf(areas: PriceMapAreas, properties: readonly AdminOverviewProperties[]): readonly MarketSegment[] {
  const meaningful = segmentsFor('sale').filter((segment) =>
    rankedSelectionsOf(properties, areas, childMapChoice(segment)).some((row) => row.resolution.kind !== 'few'),
  );
  return meaningful.length > 0 ? meaningful : [DEFAULT_SEGMENT];
}

export function defaultChildSegment(segments: readonly MarketSegment[]): MarketSegment {
  return segments.includes(DEFAULT_SEGMENT) ? DEFAULT_SEGMENT : (segments[0] ?? DEFAULT_SEGMENT);
}

/** Οι τρόποι του χάρτη μιας σελίδας: σύγκριση παιδιών (όπου υπάρχουν τιμές τους) και ζώνες (μόνο Δήμος/Δ.Ε., `hasValueZoneMap`). */
export const AREA_MAP_MODES = ['prices', 'zones'] as const;
export type AreaMapMode = (typeof AREA_MAP_MODES)[number];

/** Το κείμενο της ετικέτας ενός παιδιού πάνω στον χάρτη — ο καλών το φτιάχνει από τις λέξεις του (i18n). */
export type ChildLabelText = (row: PriceMapSelection) => string;

/**
 * **Οι ετικέτες τιμής**, ένα σημείο ανά παιδί (το προϋπολογισμένο `label` του γεννήτορα). Το κείμενο ζει σε
 * **ιδιότητα**, όχι σε `feature-state`: η MapLibre δεν διαβάζει κατάσταση σε `layout` (`text-field`).
 */
export function childLabelsOf(
  features: readonly AdminOverviewFeature[],
  rows: readonly PriceMapSelection[],
  text: ChildLabelText,
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const points: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (const feature of features) {
    const { id, label } = feature.properties;
    const row = byId.get(id);
    if (label === undefined || row === undefined) continue;
    points.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [...label] }, properties: { id, text: text(row) } });
  }
  return { type: 'FeatureCollection', features: points };
}
