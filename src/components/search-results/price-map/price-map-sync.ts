'use client';

/**
 * @fileoverview **Ο συγχρονισμός του χάρτη τιμών με τον ΖΩΝΤΑΝΟ χάρτη** (ADR-890 §14) — καταστάσεις, διάταξη
 * στρώσεων, μοτίβο, γεγονότα. Όλα **αυτοδιορθούμενα** πάνω στο `styledata`.
 * @related `PriceMapLayer.tsx` (η απόδοση) · `price-map-paint.ts` · `lib/market/price-map-view.ts`
 * @module components/search-results/price-map/price-map-sync
 *
 * 🔴 **Γιατί αυτοδιόρθωση και όχι «μία φορά στην προσάρτηση»** — μετρημένο ζωντανά 2026-09-28, διαλείπον:
 * η ενυδάτωση του θέματος **αλλάζει το στυλ υποβάθρου** (ADR-891). Η αλλαγή στυλ (α) ξαναφτιάχνει κάθε πηγή, άρα
 * **σβήνει τα `feature-state`**, (β) σβήνει τις εικόνες που προστέθηκαν, και (γ) ξαναπροσθέτει τις στρώσεις σε σειρά
 * που δεν ελέγχουμε: το `<Layer beforeId>` του `@vis.gl/react-maplibre` καλεί `addLayer(…, beforeId)` και, αν οι
 * στρώσεις των αγγελιών δεν υπάρχουν **ακόμη**, το MapLibre αρνείται και η στρώση **δεν προστίθεται ποτέ**. Ο χάρτης
 * έμενε άβαφος χωρίς κανένα ορατό σφάλμα. Γι' αυτό: καμία `beforeId` στο JSX· η θέση, οι καταστάσεις και το μοτίβο
 * αποκαθίστανται σε **κάθε** `styledata`, μόνο όταν χρειάζεται (χωρίς βρόχο).
 */

import type { Map as MapInstance } from 'maplibre-gl';
import { useEffect, useMemo, useRef } from 'react';

import { adminOverviewPropertiesOf, type AdminOverviewFile, type AdminOverviewProperties, type AdminOverviewTier } from '@/lib/geo/admin-overview-file';
import type { BasemapScheme } from '@/lib/maps/basemap-catalog';
import type { MapLayerMouseEvent } from '@/lib/maps/maplibre';
import { PICKABLE_LAYER_IDS } from '@/lib/maps/map-pick';
import type { PriceMapAreas } from '@/lib/market/price-map';
import { featureStatesOf, type PriceMapChoice } from '@/lib/market/price-map-view';

import { BELOW_LISTINGS, LOWEST_BOUNDARY_LAYER } from '../boundary-paint';
import { ensurePriceMapHatch } from './price-map-paint';

export const PRICE_MAP_TIER_IDS: Readonly<Record<AdminOverviewTier, { source: string; fill: string; hatch: string; line: string }>> = {
  municipality: { source: 'price-map-municipality', fill: 'price-map-municipality-fill', hatch: 'price-map-municipality-hatch', line: 'price-map-municipality-line' },
  municipal_unit: { source: 'price-map-unit', fill: 'price-map-unit-fill', hatch: 'price-map-unit-hatch', line: 'price-map-unit-line' },
};
const FILL_LAYERS = [PRICE_MAP_TIER_IDS.municipality.fill, PRICE_MAP_TIER_IDS.municipal_unit.fill];
const OWN_LAYERS = Object.values(PRICE_MAP_TIER_IDS).flatMap(({ fill, hatch, line }) => [fill, hatch, line]);

/**
 * **Καταστάσεις ανά περιοχή + επιλογή, σε ΕΝΑ πέρασμα**, ξαναγραμμένες όταν αλλάξουν οι τιμές/η επιλογή **ή** η ίδια
 * η πηγή (αλλαγή στυλ ⇒ νέο αντικείμενο πηγής ⇒ άδειες καταστάσεις). Χωρίς τιμές (ακόμη): καθάρισμα — ποτέ «λίγα» από άγνοια.
 */
export function useTierStates(
  map: MapInstance | undefined,
  tier: AdminOverviewTier,
  file: AdminOverviewFile | null,
  areas: PriceMapAreas | null,
  choice: PriceMapChoice,
  selectedId: string | null,
): void {
  const states = useMemo(() => (file === null || areas === null ? null : featureStatesOf(file.features, areas, choice)), [areas, choice, file]);
  const applied = useRef<{ source: unknown; states: unknown; selectedId: string | null } | null>(null);
  useEffect(() => {
    if (map === undefined || file === null) return;
    const sourceId = PRICE_MAP_TIER_IDS[tier].source;
    const apply = () => {
      const source = map.getSource(sourceId);
      if (source === undefined) return;
      const last = applied.current;
      if (last !== null && last.source === source && last.states === states && last.selectedId === selectedId) return;
      // 🔴 ΟΧΙ `removeFeatureState` πριν από τα `set` (μετρημένο ζωντανά 2026-09-28): το MapLibre συγχωνεύει τη διαγραφή
      //    ΜΕΤΑ τις εγγραφές του ίδιου καρέ, άρα έσβηνε ό,τι μόλις γράφτηκε (Δήμος με δική του τιμή ⇒ άβαφος). Γράφεται
      //    κατάσταση για ΚΑΘΕ περιοχή, οπότε καμία δεν κρατά μπαγιάτικη· η διαγραφή μένει μόνο για «καμία τιμή ακόμη».
      if (states === null) map.removeFeatureState({ source: sourceId });
      else for (const [id, state] of states) map.setFeatureState({ source: sourceId, id }, { ...state, s: id === selectedId });
      applied.current = { source, states, selectedId };
    };
    apply();
    map.on('styledata', apply);
    map.on('sourcedata', apply);
    return () => {
      map.off('styledata', apply);
      map.off('sourcedata', apply);
    };
  }, [file, map, selectedId, states, tier]);
}

/** Κάτω από το όριο περιοχής (αν υπάρχει) και πάντα κάτω από τις αγγελίες — επανέλεγχος σε κάθε αλλαγή στυλ. */
export function useLayerOrder(map: MapInstance | undefined): void {
  useEffect(() => {
    if (map === undefined) return;
    const place = () => {
      const target = [LOWEST_BOUNDARY_LAYER, BELOW_LISTINGS].find((id) => map.getLayer(id) !== undefined);
      if (target === undefined) return;
      const order = map.getLayersOrder();
      const targetIndex = order.indexOf(target);
      // Μόνο όταν η σειρά είναι λάθος: το `moveLayer` γεννά `styledata`, και χωρίς τον έλεγχο θα ήταν βρόχος.
      for (const id of OWN_LAYERS) if (order.indexOf(id) > targetIndex) map.moveLayer(id, target);
    };
    place();
    map.on('styledata', place);
    return () => { map.off('styledata', place); };
  }, [map]);
}

/** Το μοτίβο στο στυλ — και ξανά όταν το ζητήσει ο χάρτης (η αλλαγή στυλ σβήνει τις εικόνες που προστέθηκαν). */
export function useHatchImage(map: MapInstance | undefined, scheme: BasemapScheme): void {
  useEffect(() => {
    if (map === undefined) return;
    const ensure = () => ensurePriceMapHatch(map, scheme);
    ensure();
    map.on('styleimagemissing', ensure);
    return () => { map.off('styleimagemissing', ensure); };
  }, [map, scheme]);
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
