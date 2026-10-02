'use client';

/**
 * **Ο χάρτης τιμών €/τ.μ. ΜΕΣΑ στον χάρτη αποτελεσμάτων** (ADR-890 §14 = ADR-889 Φ3) — δύο βαθμίδες, μία κλίμακα.
 * Ζει ως **παιδί** του `ResultsMap` (υποδοχή `children`): ένας χάρτης, όχι δεύτερος.
 *
 * 🔑 **Δήμοι κάτω από το zoom 9, Δ.Ε. από εκεί και πάνω** (idealista: επίπεδα ανά zoom). Μέχρι να φτάσουν οι Δ.Ε.,
 *   οι Δήμοι μένουν ορατοί — ποτέ κενός χάρτης στη μετάβαση.
 * 🔑 **Κάτω από το πλαίσιο**: κάτω από το όριο περιοχής και τις αγγελίες — περιεχόμενο, όχι χειριστήριο· κλικ πάνω σε
 *   αγγελία **δεν** φτάνει ποτέ εδώ. Τη διάταξη την κρατά ο συγχρονισμός (`price-map-sync.ts`), όχι το `beforeId`.
 * 🔑 **Χρώμα από `feature-state`**: η γεωμετρία φορτώνεται μία φορά· πηγή/τμήμα αλλάζουν μόνο καταστάσεις.
 * 🔑 **Η τιμή γραμμένη πάνω στην περιοχή** (ADR-890 §18, idealista): ο **ίδιος** μηχανισμός με τις σελίδες περιοχής
 *   (`priceMapLabelPointsOf` + `PriceMapLabelLayer`), με την ορατότητα της βαθμίδας του. Όσες δεν χωρούν κρύβονται με
 *   δηλωμένη προτεραιότητα· η **επιλεγμένη** δεν κρύβεται ποτέ, και καμία δεν χάνεται (πίνακας «στην οθόνη»).
 */

import type { Map as MapInstance } from 'maplibre-gl';
import React, { useMemo } from 'react';

import { childMapWordsOf } from '@/components/area-market/area-level-words';
import { usePriceMapModel } from '@/components/search-results/price-map/PriceMapProvider';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ADMIN_LEVEL } from '@/lib/geo/admin-area-index-file';
import type { AdminOverviewFile } from '@/lib/geo/admin-overview-file';
import type { BasemapScheme } from '@/lib/maps/basemap-catalog';
import { Layer, Source, useMap } from '@/lib/maps/maplibre';
import { useBasemapScheme } from '@/lib/maps/use-basemap-scheme';
import type { PriceMapAreas } from '@/lib/market/price-map';
import {
  UNIT_TIER_MIN_ZOOM,
  priceMapLabelPointsOf,
  selectionOf,
  type PriceMapChoice,
  type PriceMapLabelText,
} from '@/lib/market/price-map-view';

import { useHatchImage } from '@/components/market/choropleth/choropleth-sync';
import { priceMapFillPaint, priceMapHatchPaint, priceMapLinePaint } from '@/components/market/choropleth/price-map-paint';
import { PRICE_MAP_WORD_NAMESPACES, usePriceMapLabelText } from '@/components/market/choropleth/price-map-words';
import { PriceMapLabelLayer } from '@/components/market/choropleth/PriceMapLabelLayer';

import { PRICE_MAP_TIER_IDS, useLayerOrder, useMapEvents, useTierStates, type PriceMapTier } from './price-map-sync';

const MAX_ZOOM = 24;

/** Ό,τι χρειάζονται οι ετικέτες μιας βαθμίδας — `areas` `null` ⇒ καμία ετικέτα μέχρι να έρθουν οι τιμές. */
interface TierLabelInput {
  readonly areas: PriceMapAreas | null;
  readonly choice: PriceMapChoice;
  readonly selectedId: string | null;
  readonly text: PriceMapLabelText;
}

interface TierLayersProps {
  readonly tier: PriceMapTier;
  readonly file: AdminOverviewFile;
  readonly minzoom: number;
  readonly maxzoom: number;
  readonly scheme: BasemapScheme;
  readonly labels: TierLabelInput;
}

const NO_POINTS: GeoJSON.FeatureCollection<GeoJSON.Point> = { type: 'FeatureCollection', features: [] };

/** Οι ετικέτες της βαθμίδας: η τιμή κάθε περιοχής, όπως τη λέει και ο πίνακας (`selectionOf`) — καμία δεύτερη αναγωγή. */
function useTierLabelPoints(file: AdminOverviewFile, { areas, choice, selectedId, text }: TierLabelInput) {
  const rows = useMemo(
    () => (areas === null ? [] : file.features.map(({ properties }) => selectionOf(properties, areas, choice))),
    [areas, choice, file],
  );
  return useMemo(
    () => (rows.length === 0 ? NO_POINTS : priceMapLabelPointsOf(file.features, rows, text, selectedId)),
    [file, rows, selectedId, text],
  );
}

function TierLayers({ tier, file, minzoom, maxzoom, scheme, labels }: TierLayersProps) {
  const ids = PRICE_MAP_TIER_IDS[tier];
  // Το θέμα στις εξαρτήσεις: αλλαγή θέματος ⇒ νέα χρώματα από τα tokens + νέα διαφάνεια για το νέο υπόβαθρο.
  const paint = useMemo(
    () => ({ fill: priceMapFillPaint(scheme), hatch: priceMapHatchPaint(scheme), line: priceMapLinePaint() }),
    [scheme],
  );
  const points = useTierLabelPoints(file, labels);
  return (
    <>
      <Source id={ids.source} type="geojson" data={file as GeoJSON.FeatureCollection} promoteId="id">
        <Layer id={ids.fill} type="fill" minzoom={minzoom} maxzoom={maxzoom} paint={paint.fill} />
        <Layer id={ids.hatch} type="fill" minzoom={minzoom} maxzoom={maxzoom} paint={paint.hatch} />
        <Layer id={ids.line} type="line" minzoom={minzoom} maxzoom={maxzoom} paint={paint.line} />
      </Source>
      <PriceMapLabelLayer sourceId={ids.labelSource} layerId={ids.labels} points={points} minzoom={minzoom} maxzoom={maxzoom} />
    </>
  );
}

/**
 * Το κείμενο των ετικετών της αναζήτησης (ADR-890 §18): η τιμή · «Δήμος: τιμή» στην αναγωγή μιας Δ.Ε. (ο γονέας της
 * Δ.Ε. είναι πάντα Δήμος — ίδιες λέξεις με τη σελίδα Δήμου) · **καμία** ετικέτα στα «λίγα»: σε ~100 περιοχές το «λίγα»
 * θα σκέπαζε τον χάρτη, και το λένε ήδη το γκρι, το υπόμνημα και ο πίνακας.
 */
function useSearchLabelText(choice: PriceMapChoice): PriceMapLabelText {
  const { t } = useTranslation([...PRICE_MAP_WORD_NAMESPACES]);
  const parentLabel = useMemo(() => childMapWordsOf(t, ADMIN_LEVEL.municipality)?.parentLabel ?? null, [t]);
  return usePriceMapLabelText(choice, parentLabel, null);
}

/**
 * Προσαρτάται **μόνο** όταν η στρώση είναι ανοιχτή (ο καλών το αποφασίζει): πηγές, στρώσεις, γεγονότα και
 * καταστάσεις ζουν και φεύγουν μαζί — κλειστή στρώση δεν αφήνει ούτε ακροατή στον χάρτη.
 */
export default function PriceMapLayer() {
  const model = usePriceMapModel();
  const { current: mapRef } = useMap();
  const map: MapInstance | undefined = mapRef?.getMap();
  const municipalities = model.municipalities === 'unavailable' ? null : model.municipalities;
  const units = model.units === 'unavailable' ? null : model.units;
  const areas = model.data.status === 'ready' ? model.data.areas : null;
  const selectedId = model.selected?.id ?? null;
  const scheme = useBasemapScheme();
  const text = useSearchLabelText(model.choice);
  const labels = useMemo(
    (): TierLabelInput => ({ areas, choice: model.choice, selectedId, text }),
    [areas, model.choice, selectedId, text],
  );

  useHatchImage(map, scheme);
  useLayerOrder(map);
  useTierStates(map, 'municipality', municipalities, areas, model.choice, selectedId);
  useTierStates(map, 'municipal_unit', units, areas, model.choice, selectedId);
  useMapEvents(map, model);

  if (map === undefined) return null;
  // Μέχρι να φτάσουν οι Δ.Ε., οι Δήμοι μένουν ορατοί σε κάθε zoom.
  const municipalMax = units === null ? MAX_ZOOM : UNIT_TIER_MIN_ZOOM;
  return (
    <>
      {municipalities !== null && <TierLayers tier="municipality" file={municipalities} minzoom={0} maxzoom={municipalMax} scheme={scheme} labels={labels} />}
      {units !== null && <TierLayers tier="municipal_unit" file={units} minzoom={UNIT_TIER_MIN_ZOOM} maxzoom={MAX_ZOOM} scheme={scheme} labels={labels} />}
    </>
  );
}
