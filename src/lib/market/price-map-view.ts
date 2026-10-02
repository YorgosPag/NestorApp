/**
 * @fileoverview **Η καθαρή όψη του χάρτη τιμών** (ADR-890 §14) — επιλογή πηγής/τμήματος, κατάσταση ανά περιοχή
 * (`feature-state`), η περιοχή του κλικ, οι γραμμές του πίνακα «Περιοχές στην οθόνη». Καμία εξάρτηση χάρτη ή React.
 * @related `price-map.ts` (κλάσεις, αναγωγή) · `components/search-results/price-map/*` · `hooks/market/usePriceMap.ts`
 * @module lib/market/price-map-view
 */

import { valuesOf, type ListingCriteria } from '@/lib/criteria/listing-criteria';
import { compareByLocale } from '@/lib/intl-formatting';
import { MARKET_SEGMENTS, marketSegmentOfType, type MarketSegment } from '@/lib/market/market-segments';
import {
  PRICE_MAP_BREAKS,
  resolvePriceMapArea,
  type PriceMapAreas,
  type PriceMapResolution,
  type PriceMapSource,
} from '@/lib/market/price-map';
import type { AdminOverviewFeature, AdminOverviewProperties } from '@/lib/geo/admin-overview-file';
import type { AskingOffer } from '@/types/area-market';

/** Από αυτό το zoom και πάνω φαίνονται οι Δ.Ε.· κάτω οι Δήμοι (≈ 240 m/pixel στο πλάτος της Ελλάδας). */
export const UNIT_TIER_MIN_ZOOM = 9;
/** Οι Δ.Ε. (463 KB gzip) αρχίζουν να φορτώνονται **ένα** zoom νωρίτερα, ώστε να είναι έτοιμες όταν χρειαστούν. */
export const UNIT_PREFETCH_ZOOM = UNIT_TIER_MIN_ZOOM - 1;
/** Πόσες περιοχές δείχνει ο πίνακας «Περιοχές στην οθόνη». */
export const VISIBLE_ROWS_LIMIT = 20;

export interface PriceMapChoice {
  readonly offer: AskingOffer;
  readonly source: PriceMapSource;
  readonly segment: MarketSegment;
}

/** Η κατάσταση ανά περιοχή στον χάρτη: `k` 0 = δική της τιμή · 1 = τιμή Δήμου · 2 = λίγα· `c` = κλάση ή −1. */
export interface PriceMapFeatureState {
  readonly c: number;
  readonly k: 0 | 1 | 2;
}

/** Τα τμήματα που έχουν όρια για την προσφορά — με τη σειρά του λεξιλογίου. */
export function segmentsFor(offer: AskingOffer): readonly MarketSegment[] {
  return MARKET_SEGMENTS.filter((segment) => PRICE_MAP_BREAKS[offer][segment] !== undefined);
}

/** Συμβόλαια υπάρχουν **μόνο** για πώληση (ΜΑΜΑ = μεταβιβάσεις)· το ενοίκιο έχει μόνο ζητούμενες. */
export function sourcesFor(offer: AskingOffer): readonly PriceMapSource[] {
  return offer === 'sale' ? ['contracts', 'asking'] : ['asking'];
}

/** Η επιλογή, διορθωμένη ώστε να υπάρχει: πηγή που δεν στέκει για την προσφορά ⇒ η πρώτη που στέκει. */
export function normalizeChoice(choice: PriceMapChoice): PriceMapChoice {
  const sources = sourcesFor(choice.offer);
  const segments = segmentsFor(choice.offer);
  return {
    offer: choice.offer,
    source: sources.includes(choice.source) ? choice.source : sources[0],
    segment: segments.includes(choice.segment) ? choice.segment : segments[0],
  };
}

/**
 * **Η αφετηρία από την αναζήτηση**: ζητά μόνο ενοικίαση ⇒ ενοίκιο· ένας τύπος ακινήτου ⇒ το τμήμα του.
 * Αλλιώς: πώληση, διαμέρισμα, συμβόλαια (η πλουσιότερη πηγή — 1.247 περιοχές).
 */
export function defaultPriceMapChoice(criteria: ListingCriteria): PriceMapChoice {
  const offers = valuesOf(criteria, 'offerKind') ?? [];
  const offer: AskingOffer = offers.length > 0 && offers.every((kind) => kind === 'leaseOut') ? 'rent' : 'sale';
  const types = valuesOf(criteria, 'type') ?? [];
  const segments = new Set(types.map(marketSegmentOfType));
  const [only] = [...segments];
  const segment = segments.size === 1 && only !== null && only !== undefined ? only : 'apartment';
  return normalizeChoice({ offer, source: 'contracts', segment });
}

function breaksOf(choice: PriceMapChoice): readonly number[] {
  return PRICE_MAP_BREAKS[choice.offer][choice.segment] ?? [];
}

function resolve(properties: AdminOverviewProperties, areas: PriceMapAreas, choice: PriceMapChoice): PriceMapResolution {
  return resolvePriceMapArea(areas, choice.segment, breaksOf(choice), properties.id, properties.parent);
}

function stateOf(resolution: PriceMapResolution): PriceMapFeatureState {
  if (resolution.kind === 'few') return { c: -1, k: 2 };
  return { c: resolution.classIndex, k: resolution.kind === 'own' ? 0 : 1 };
}

/** Η κατάσταση **κάθε** περιοχής της βαθμίδας — καμία δεν μένει με μπαγιάτικη κατάσταση από προηγούμενη επιλογή. */
export function featureStatesOf(
  features: readonly { readonly properties: AdminOverviewProperties }[],
  areas: PriceMapAreas,
  choice: PriceMapChoice,
): readonly (readonly [string, PriceMapFeatureState])[] {
  return features.map(({ properties }) => [properties.id, stateOf(resolve(properties, areas, choice))]);
}

/** Η περιοχή που επιλέχθηκε (κλικ ή γραμμή πίνακα) — ό,τι χρειάζεται το κείμενο. */
export interface PriceMapSelection {
  readonly id: string;
  readonly name: string;
  readonly parentName: string | null;
  readonly resolution: PriceMapResolution;
}

export function selectionOf(properties: AdminOverviewProperties, areas: PriceMapAreas, choice: PriceMapChoice): PriceMapSelection {
  return { id: properties.id, name: properties.name, parentName: properties.parentName, resolution: resolve(properties, areas, choice) };
}

/** Η τιμή που δείχνει η γραμμή, ή `null` (λίγα) — για ταξινόμηση. */
function shownMedian(selection: PriceMapSelection): number | null {
  return selection.resolution.kind === 'few' ? null : selection.resolution.median;
}

/**
 * **Κατάταξη περιοχών**: ακριβότερη πρώτα, όσες έχουν λίγα στο τέλος (με όνομα). Μία γραμμή ανά περιοχή. Κοινή για
 * τον πίνακα «στην οθόνη» της αναζήτησης και τον πίνακα Δ.Ε. της σελίδας Δήμου (ADR-890 §15) — ίδια σειρά παντού.
 */
export function rankedSelectionsOf(
  properties: readonly AdminOverviewProperties[],
  areas: PriceMapAreas,
  choice: PriceMapChoice,
): readonly PriceMapSelection[] {
  const unique = new Map(properties.map((item) => [item.id, item]));
  return [...unique.values()]
    .map((item) => selectionOf(item, areas, choice))
    .sort((a, b) => {
      const [ma, mb] = [shownMedian(a), shownMedian(b)];
      if (ma !== mb) return ma === null ? 1 : mb === null ? -1 : mb - ma;
      return compareByLocale(a.name, b.name);
    });
}

/** Βαθμίδα προτεραιότητας ετικέτας: δική τιμή → τιμή γονέα (αναγωγή) → λίγα. */
const LABEL_TIER: Readonly<Record<PriceMapResolution['kind'], number>> = { own: 0, parent: 1, few: 2 };

/**
 * **Ποια ετικέτα τιμής τοποθετείται πρώτη όταν δεν χωρούν όλες** (ADR-890 §17). Μετρημένο στο πυκνό κέντρο της Π.Ε.
 * Θεσσαλονίκης: 7 σημεία σε ~40×35 px ⇒ κάποιες κρύβονται αναγκαστικά, και χωρίς δηλωμένη σειρά κέρδιζε η **σειρά του
 * πίνακα** (έκρυβε την Καλαμαριά, την ακριβότερη). Κανόνας: πρώτα οι **δικές** τιμές, και ανάμεσά τους ο **πιο
 * αξιόπιστος** αριθμός (μεγαλύτερο δείγμα)· μετά η αναγωγή, τέλος τα «λίγα». Ισοπαλία κατά id — ντετερμινιστικά.
 * Ό,τι κρύβεται μένει στον πίνακα (SSR) και στο πέρασμα/πάτημα.
 */
export function comparePriceMapLabelPriority(a: PriceMapSelection, b: PriceMapSelection): number {
  const byTier = LABEL_TIER[a.resolution.kind] - LABEL_TIER[b.resolution.kind];
  if (byTier !== 0) return byTier;
  const bySample = b.resolution.n - a.resolution.n;
  if (bySample !== 0) return bySample;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Το κείμενο της ετικέτας μιας περιοχής πάνω στον χάρτη — ο καλών το φτιάχνει από τις λέξεις του (i18n).
 * `null` = **καμία** ετικέτα: ο χάρτης της αναζήτησης δεν γράφει «λίγα» πάνω σε ~100 περιοχές (ADR-890 §18).
 */
export type PriceMapLabelText = (row: PriceMapSelection) => string | null;

/**
 * **Οι ετικέτες τιμής ενός χωροπληθούς** (ADR-890 §15 · §17 · §18) — ένα σημείο ανά περιοχή, στο προϋπολογισμένο
 * `label` του γεννήτορα. **Ένας** μηχανισμός για κάθε χάρτη τιμών (σελίδες περιοχής + αναζήτηση).
 * - Το κείμενο ζει σε **ιδιότητα**, όχι σε `feature-state`: η MapLibre δεν διαβάζει κατάσταση σε `layout` (`text-field`).
 * - Το `rank` (0 = πρώτη) είναι η δηλωμένη προτεραιότητα (`comparePriceMapLabelPriority`) και το διαβάζει το
 *   `symbol-sort-key` της κοινής διάταξης (`priceMapLabelLayout`).
 * - 🏆 Η **επιλεγμένη** περιοχή (κλικ · πέρασμα · γραμμή πίνακα) παίρνει `rank` −1: ο αριθμός που ζήτησε ο άνθρωπος
 *   **δεν** κρύβεται ποτέ από σύγκρουση, όσο πυκνός κι αν είναι ο χάρτης.
 */
export function priceMapLabelPointsOf(
  features: readonly AdminOverviewFeature[],
  rows: readonly PriceMapSelection[],
  text: PriceMapLabelText,
  selectedId: string | null = null,
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const rankOf = new Map([...rows].sort(comparePriceMapLabelPriority).map((row, rank) => [row.id, rank]));
  const points: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (const feature of features) {
    const { id, label } = feature.properties;
    const row = byId.get(id);
    const content = row === undefined ? null : text(row);
    if (label === undefined || content === null) continue;
    const rank = id === selectedId ? -1 : rankOf.get(id);
    points.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [...label] }, properties: { id, text: content, rank } });
  }
  return { type: 'FeatureCollection', features: points };
}

/**
 * **Οι περιοχές στην οθόνη**, για τον πίνακα που αντικαθιστά το κλικ στο πληκτρολόγιο (WCAG 2.1.1): η κατάταξη του
 * `rankedSelectionsOf`, έως `VISIBLE_ROWS_LIMIT`.
 */
export function visibleRowsOf(
  rendered: readonly AdminOverviewProperties[],
  areas: PriceMapAreas,
  choice: PriceMapChoice,
): readonly PriceMapSelection[] {
  return rankedSelectionsOf(rendered, areas, choice).slice(0, VISIBLE_ROWS_LIMIT);
}
