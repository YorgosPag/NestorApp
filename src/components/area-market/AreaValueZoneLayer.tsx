'use client';

/**
 * **Οι ζώνες αντικειμενικών αξιών ΜΕΣΑ στον χάρτη** (ADR-889 Φ5) — πηγές + στρώσεις MapLibre + κλικ.
 * Ζει ως **παιδί** του `PlaceMap` (υποδοχή `children`): ένας χάρτης, όχι δεύτερος.
 *
 * 🔑 **Επιφάνειες κάτω, μέτωπα πάνω**: το μέτωπο είναι γραμμή πάνω στο όριο ενός τετραγώνου· κάτω από το γέμισμα θα
 * χανόταν. Ίδια κλίμακα και για τα δύο — ένα μέτωπο 8.550 €/m² έχει το χρώμα που θα είχε μια ζώνη 8.550 €/m².
 */

import React, { useEffect, useMemo } from 'react';

import { Layer, Source, useMap, type MapLayerMouseEvent } from '@/lib/maps/maplibre';
import type { PriceClass } from '@/lib/market/value-zone-classes';
import type { ValueZoneLayer } from '@/lib/market/value-zones';

import { priceStepColor } from './value-zone-paint';

const ZONES_SOURCE = 'value-zones';
const FRONTS_SOURCE = 'value-zone-fronts';
const ZONE_FILL_ID = 'value-zones-fill';
const ZONE_LINE_ID = 'value-zones-line';
const FRONT_CASING_ID = 'value-zone-fronts-casing';
const FRONT_LINE_ID = 'value-zone-fronts-line';
const INTERACTIVE_LAYERS = [FRONT_LINE_ID, ZONE_FILL_ID] as const;

/** Αρκετά διαφανές ώστε να διαβάζονται οι δρόμοι από κάτω, αρκετά αδιαφανές ώστε να ξεχωρίζουν οι κλάσεις. */
const ZONE_FILL_OPACITY = 0.55;

/** Ό,τι επιλέχθηκε με κλικ — ό,τι χρειάζεται η γραμμή κειμένου κάτω από τον χάρτη. */
export type ValueZoneSelection =
  | { readonly kind: 'zone'; readonly name: string; readonly price: number }
  | { readonly kind: 'front'; readonly street: string; readonly price: number };

function zonesGeoJson(layer: ValueZoneLayer): GeoJSON.FeatureCollection<GeoJSON.MultiPolygon> {
  return {
    type: 'FeatureCollection',
    features: layer.zones.map((zone) => ({
      type: 'Feature',
      geometry: zone.geometry,
      properties: { price: zone.price, name: zone.name },
    })),
  };
}

function frontsGeoJson(layer: ValueZoneLayer): GeoJSON.FeatureCollection<GeoJSON.MultiLineString> {
  return {
    type: 'FeatureCollection',
    features: layer.fronts.map((front) => ({
      type: 'Feature',
      geometry: front.geometry,
      properties: { price: front.price, street: front.street },
    })),
  };
}

/** Το πάνω-πάνω στοιχείο στο σημείο του κλικ → επιλογή, ή `null` (κλικ έξω από ζώνη). */
function selectionOf(event: MapLayerMouseEvent): ValueZoneSelection | null {
  const feature = event.features?.[0];
  const props = feature?.properties;
  if (props === undefined || props === null || typeof props.price !== 'number') return null;
  if (feature?.layer.id === FRONT_LINE_ID && typeof props.street === 'string') return { kind: 'front', street: props.street, price: props.price };
  if (typeof props.name === 'string') return { kind: 'zone', name: props.name, price: props.price };
  return null;
}

/** Κλικ και δείκτης — δεμένα στον **ίδιο** χάρτη με `useMap()`, ώστε το `PlaceMap` να μη μάθει τίποτα για ζώνες. */
function useZoneInteraction(onSelect: (selection: ValueZoneSelection | null) => void): void {
  const { current: mapRef } = useMap();
  useEffect(() => {
    const map = mapRef?.getMap();
    if (map === undefined) return;
    const handleClick = (event: MapLayerMouseEvent) => onSelect(selectionOf(event));
    const pointer = () => { map.getCanvas().style.cursor = 'pointer'; };
    const reset = () => { map.getCanvas().style.cursor = ''; };
    for (const id of INTERACTIVE_LAYERS) {
      map.on('click', id, handleClick);
      map.on('mouseenter', id, pointer);
      map.on('mouseleave', id, reset);
    }
    return () => {
      for (const id of INTERACTIVE_LAYERS) {
        map.off('click', id, handleClick);
        map.off('mouseenter', id, pointer);
        map.off('mouseleave', id, reset);
      }
    };
  }, [mapRef, onSelect]);
}

interface AreaValueZoneLayerProps {
  readonly layer: ValueZoneLayer;
  readonly classes: readonly PriceClass[];
  readonly colors: readonly string[];
  readonly onSelect: (selection: ValueZoneSelection | null) => void;
}

export function AreaValueZoneLayer({ layer, classes, colors, onSelect }: AreaValueZoneLayerProps) {
  const zones = useMemo(() => zonesGeoJson(layer), [layer]);
  const fronts = useMemo(() => frontsGeoJson(layer), [layer]);
  const color = useMemo(() => priceStepColor(classes, colors), [classes, colors]);
  const outline = colors[colors.length - 1];
  useZoneInteraction(onSelect);

  return (
    <>
      <Source id={ZONES_SOURCE} type="geojson" data={zones}>
        <Layer id={ZONE_FILL_ID} type="fill" paint={{ 'fill-color': color, 'fill-opacity': ZONE_FILL_OPACITY }} />
        <Layer id={ZONE_LINE_ID} type="line" paint={{ 'line-color': outline, 'line-width': 0.75, 'line-opacity': 0.7 }} />
      </Source>
      <Source id={FRONTS_SOURCE} type="geojson" data={fronts}>
        {/* Περίβλημα στη σκουρότερη απόχρωση: ένα μέτωπο πάνω σε ζώνη της ΙΔΙΑΣ κλάσης θα χανόταν χωρίς αυτό. */}
        <Layer id={FRONT_CASING_ID} type="line" layout={{ 'line-cap': 'round' }} paint={{ 'line-color': outline, 'line-width': 6 }} />
        <Layer id={FRONT_LINE_ID} type="line" layout={{ 'line-cap': 'round' }} paint={{ 'line-color': color, 'line-width': 3.5 }} />
      </Source>
    </>
  );
}
