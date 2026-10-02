'use client';

/**
 * @fileoverview **Ο συγχρονισμός του χάρτη τιμών της ΑΝΑΖΗΤΗΣΗΣ με τον ζωντανό χάρτη** (ADR-890 §14) — δύο βαθμίδες,
 * διάταξη κάτω από όριο/αγγελίες, γεγονότα. Ο μηχανισμός (καταστάσεις, διάταξη, μοτίβο, αυτοδιόρθωση σε `styledata`)
 * ζει **μία** φορά στο `components/market/choropleth/choropleth-sync.ts` — εδώ μένει μόνο ό,τι είναι της αναζήτησης.
 * @related `PriceMapLayer.tsx` (η απόδοση) · `components/market/choropleth/*` · `lib/market/price-map-view.ts`
 * @module components/search-results/price-map/price-map-sync
 */

import type { Map as MapInstance } from 'maplibre-gl';
import { useEffect, useMemo } from 'react';

import { useFeatureStateSync, useLayerOrderBelow } from '@/components/market/choropleth/choropleth-sync';
import { adminOverviewPropertiesOf, type AdminOverviewFile, type AdminOverviewProperties, type AdminOverviewTier } from '@/lib/geo/admin-overview-file';
import type { MapLayerMouseEvent } from '@/lib/maps/maplibre';
import { PICKABLE_LAYER_IDS } from '@/lib/maps/map-pick';
import type { PriceMapAreas } from '@/lib/market/price-map';
import { featureStatesOf, type PriceMapChoice } from '@/lib/market/price-map-view';

import { BELOW_LISTINGS, LOWEST_BOUNDARY_LAYER } from '../boundary-paint';

/**
 * Οι βαθμίδες του χάρτη της **αναζήτησης**: Δήμοι και Δ.Ε. Οι Π.Ε. (`regional_unit`) υπάρχουν στην επισκόπηση για τη
 * σελίδα Περιφέρειας (ADR-890 §16) — ο χάρτης της αναζήτησης δεν τις δείχνει, άρα δεν αλλάζει ούτε byte.
 */
const PRICE_MAP_TIERS = ['municipality', 'municipal_unit'] as const satisfies readonly AdminOverviewTier[];
export type PriceMapTier = (typeof PRICE_MAP_TIERS)[number];

interface PriceMapTierIds {
  readonly source: string;
  readonly fill: string;
  readonly hatch: string;
  readonly line: string;
  /** Οι ετικέτες τιμής (ADR-890 §18) — δική τους πηγή σημείων, όχι τα πολύγωνα. */
  readonly labelSource: string;
  readonly labels: string;
}

export const PRICE_MAP_TIER_IDS: Readonly<Record<PriceMapTier, PriceMapTierIds>> = {
  municipality: {
    source: 'price-map-municipality',
    fill: 'price-map-municipality-fill',
    hatch: 'price-map-municipality-hatch',
    line: 'price-map-municipality-line',
    labelSource: 'price-map-municipality-label-points',
    labels: 'price-map-municipality-labels',
  },
  municipal_unit: {
    source: 'price-map-unit',
    fill: 'price-map-unit-fill',
    hatch: 'price-map-unit-hatch',
    line: 'price-map-unit-line',
    labelSource: 'price-map-unit-label-points',
    labels: 'price-map-unit-labels',
  },
};
const FILL_LAYERS = [PRICE_MAP_TIER_IDS.municipality.fill, PRICE_MAP_TIER_IDS.municipal_unit.fill];
/** Και οι ετικέτες κάτω από τις αγγελίες: η αγγελία μένει πάντα πάνω από τον αριθμό της περιοχής. */
const OWN_LAYERS = Object.values(PRICE_MAP_TIER_IDS).flatMap(({ fill, hatch, line, labels }) => [fill, hatch, line, labels]);
/** Κάτω από το όριο περιοχής (αν υπάρχει) και πάντα κάτω από τις αγγελίες. */
const BELOW = [LOWEST_BOUNDARY_LAYER, BELOW_LISTINGS];

/** Οι καταστάσεις μιας βαθμίδας από τις τιμές + την επιλογή — ο μηχανισμός είναι ο κοινός `useFeatureStateSync`. */
export function useTierStates(
  map: MapInstance | undefined,
  tier: PriceMapTier,
  file: AdminOverviewFile | null,
  areas: PriceMapAreas | null,
  choice: PriceMapChoice,
  selectedId: string | null,
): void {
  const states = useMemo(() => (file === null || areas === null ? null : featureStatesOf(file.features, areas, choice)), [areas, choice, file]);
  useFeatureStateSync(file === null ? undefined : map, PRICE_MAP_TIER_IDS[tier].source, states, selectedId);
}

/** Κάτω από το όριο περιοχής (αν υπάρχει) και πάντα κάτω από τις αγγελίες — επανέλεγχος σε κάθε αλλαγή στυλ. */
export function useLayerOrder(map: MapInstance | undefined): void {
  useLayerOrderBelow(map, OWN_LAYERS, BELOW);
}

/** Ορατές περιοχές (ταξινομημένες, για σύγκριση συνόλων) — από τις στρώσεις που **φαίνονται** σε αυτό το zoom. */
function renderedAreas(map: MapInstance): AdminOverviewProperties[] {
  const layers = FILL_LAYERS.filter((id) => map.getLayer(id) !== undefined);
  if (layers.length === 0) return [];
  const unique = new Map<string, AdminOverviewProperties>();
  for (const feature of map.queryRenderedFeatures({ layers })) {
    const properties = adminOverviewPropertiesOf(feature.properties);
    if (properties !== null) unique.set(properties.id, properties);
  }
  return [...unique.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
}

interface MapEventHandlers {
  readonly onZoom: (zoom: number) => void;
  readonly onRendered: (rendered: readonly AdminOverviewProperties[]) => void;
  readonly select: (properties: AdminOverviewProperties | null) => void;
}

/** Κλικ (όχι πάνω σε αγγελία), δείκτης, zoom και ορατές περιοχές σε κάθε ηρεμία του χάρτη. */
export function useMapEvents(map: MapInstance | undefined, { onZoom, onRendered, select }: MapEventHandlers): void {
  useEffect(() => {
    if (map === undefined) return;
    const report = () => { onZoom(map.getZoom()); onRendered(renderedAreas(map)); };
    const handleClick = (event: MapLayerMouseEvent) => {
      const listings = PICKABLE_LAYER_IDS.filter((id) => map.getLayer(id) !== undefined);
      if (listings.length > 0 && map.queryRenderedFeatures(event.point, { layers: listings }).length > 0) return;
      select(adminOverviewPropertiesOf(event.features?.[0]?.properties));
    };
    const pointer = () => { map.getCanvas().style.cursor = 'pointer'; };
    const reset = () => { map.getCanvas().style.cursor = ''; };
    map.on('idle', report);
    map.on('click', FILL_LAYERS, handleClick);
    map.on('mouseenter', FILL_LAYERS, pointer);
    map.on('mouseleave', FILL_LAYERS, reset);
    report();
    return () => {
      map.off('idle', report);
      map.off('click', FILL_LAYERS, handleClick);
      map.off('mouseenter', FILL_LAYERS, pointer);
      map.off('mouseleave', FILL_LAYERS, reset);
    };
  }, [map, onRendered, onZoom, select]);
}
