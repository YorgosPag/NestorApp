'use client';

/**
 * **Ο χάρτης σύγκρισης ΜΕΣΑ στον χάρτη της σελίδας Δήμου** (ADR-890 §15) — οι Δ.Ε. βαμμένες με την **ίδια** εθνική
 * κλίμακα και το **ίδιο** ζωγράφισμα με τον χάρτη της αναζήτησης, με την τιμή γραμμένη πάνω τους. Ζει ως **παιδί** του
 * `PlaceMap` (υποδοχή `children`): ένας χάρτης, όχι δεύτερος.
 *
 * 🔑 **Ανάλογα με τη συσκευή, όχι «ένα κλικ για όλους»** (idealista/Zillow: hover = προεπισκόπηση, κλικ = μπες μέσα ·
 *   Figma: κλικ = επιλογή, δεύτερο = μπες μέσα):
 *   - **ποντίκι/γραφίδα**: πέρασμα ⇒ τονισμός + κείμενο + prefetch · κλικ ⇒ η σελίδα της Δ.Ε.
 *   - **αφή**: 1ο πάτημα ⇒ τονισμός + κείμενο με σύνδεσμο · 2ο πάτημα στην **ίδια** ⇒ η σελίδα της.
 *   Κανείς δεν πλοηγείται «στα τυφλά» χωρίς να έχει δει την τιμή — και ο δείκτης που απλώς πέρασε δεν «οπλίζει» τίποτα.
 * 🔑 **Το είδος του δείκτη από το `pointerdown` του καμβά**: το `click` της MapLibre είναι `MouseEvent` και για την αφή
 *   (συνθετικό), άρα δεν το λέει.
 * 🔑 **Κάτω από το όριο του Δήμου** (`place-shape-line`): το περίγραμμα του Δήμου μένει πάνω από τις Δ.Ε. του.
 */

import type { Map as MapInstance } from 'maplibre-gl';
import React, { useEffect, useMemo, useRef } from 'react';

import { useFeatureStateSync, useHatchImage, useLayerOrderBelow } from '@/components/market/choropleth/choropleth-sync';
import { priceMapFillPaint, priceMapHatchPaint, priceMapLinePaint } from '@/components/market/choropleth/price-map-paint';
import { PriceMapLabelLayer } from '@/components/market/choropleth/PriceMapLabelLayer';
import { PLACE_SHAPE_LINE_LAYER } from '@/components/geo/PlaceMap';
import type { AdminOverviewFile } from '@/lib/geo/admin-overview-file';
import { areaMarketHref } from '@/lib/listings/listing-routes';
import { Layer, Source, useMap, type MapLayerMouseEvent } from '@/lib/maps/maplibre';
import { useBasemapScheme } from '@/lib/maps/use-basemap-scheme';
import { featureStatesOf, priceMapLabelPointsOf, type PriceMapLabelText } from '@/lib/market/price-map-view';
import { useRouter } from '@/lib/workspace/navigation';

import type { AreaChildMapModel } from './useAreaChildMap';

const IDS = {
  source: 'area-children',
  fill: 'area-children-fill',
  hatch: 'area-children-hatch',
  line: 'area-children-line',
  labels: 'area-children-labels',
  labelSource: 'area-children-label-points',
} as const;
const OWN_LAYERS = [IDS.fill, IDS.hatch, IDS.line];
const BELOW = [PLACE_SHAPE_LINE_LAYER];

interface AreaChildPriceLayerProps {
  readonly model: AreaChildMapModel;
  readonly file: AdminOverviewFile;
  readonly labelText: PriceMapLabelText;
}

function useChildMapInstance(): MapInstance | undefined {
  const { current: mapRef } = useMap();
  return mapRef?.getMap();
}

/** Το είδος του τελευταίου δείκτη που πάτησε στον καμβά — `mouse` μέχρι να ειπωθεί άλλο. */
function usePointerKind(map: MapInstance | undefined) {
  const kind = useRef<string>('mouse');
  useEffect(() => {
    if (map === undefined) return;
    const canvas = map.getCanvas();
    const remember = (event: PointerEvent) => { kind.current = event.pointerType; };
    canvas.addEventListener('pointerdown', remember);
    return () => canvas.removeEventListener('pointerdown', remember);
  }, [map]);
  return kind;
}

function idOf(event: MapLayerMouseEvent): string | null {
  const id = event.features?.[0]?.properties?.id;
  return typeof id === 'string' ? id : null;
}

/** Πέρασμα, έξοδος και κλικ — η απόφαση «προεπισκόπηση ή πλοήγηση» ζει ΕΔΩ, μία φορά. */
function useChildInteraction(map: MapInstance | undefined, model: AreaChildMapModel): void {
  const router = useRouter();
  const pointerKind = usePointerKind(map);
  const { active, activate } = model;
  useEffect(() => {
    if (map === undefined) return;
    const hover = (event: MapLayerMouseEvent) => {
      const id = idOf(event);
      map.getCanvas().style.cursor = 'pointer';
      if (id === null || pointerKind.current === 'touch' || active?.id === id) return;
      activate({ id, via: 'pointer' });
      router.prefetch(areaMarketHref(id));
    };
    const leave = () => {
      map.getCanvas().style.cursor = '';
      if (active?.via === 'pointer') activate(null);
    };
    const click = (event: MapLayerMouseEvent) => {
      const id = idOf(event);
      if (id === null) return;
      const armed = active?.id === id && active.via === 'touch';
      if (pointerKind.current !== 'touch' || armed) router.push(areaMarketHref(id));
      else activate({ id, via: 'touch' });
    };
    map.on('mousemove', IDS.fill, hover);
    map.on('mouseleave', IDS.fill, leave);
    map.on('click', IDS.fill, click);
    return () => {
      map.off('mousemove', IDS.fill, hover);
      map.off('mouseleave', IDS.fill, leave);
      map.off('click', IDS.fill, click);
    };
  }, [activate, active, map, pointerKind, router]);
}

export function AreaChildPriceLayer({ model, file, labelText }: AreaChildPriceLayerProps) {
  const map = useChildMapInstance();
  const scheme = useBasemapScheme();
  const states = useMemo(() => featureStatesOf(file.features, model.areas, model.choice), [file, model.areas, model.choice]);
  const activeId = model.active?.id ?? null;
  const labels = useMemo(() => priceMapLabelPointsOf(file.features, model.rows, labelText, activeId), [activeId, file, labelText, model.rows]);
  // Το θέμα στις εξαρτήσεις: αλλαγή θέματος ⇒ νέα χρώματα από τα tokens + νέα διαφάνεια για το νέο υπόβαθρο.
  const paint = useMemo(
    () => ({ fill: priceMapFillPaint(scheme), hatch: priceMapHatchPaint(scheme), line: priceMapLinePaint() }),
    [scheme],
  );

  useHatchImage(map, scheme);
  useLayerOrderBelow(map, OWN_LAYERS, BELOW);
  useFeatureStateSync(map, IDS.source, states, activeId);
  useChildInteraction(map, model);

  if (map === undefined) return null;
  return (
    <>
      <Source id={IDS.source} type="geojson" data={file as GeoJSON.FeatureCollection} promoteId="id">
        <Layer id={IDS.fill} type="fill" paint={paint.fill} />
        <Layer id={IDS.hatch} type="fill" paint={paint.hatch} />
        <Layer id={IDS.line} type="line" paint={paint.line} />
      </Source>
      <PriceMapLabelLayer sourceId={IDS.labelSource} layerId={IDS.labels} points={labels} />
    </>
  );
}
