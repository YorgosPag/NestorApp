'use client';

/**
 * **Η στρώση ετικετών τιμής ενός χωροπληθούς** (ADR-890 §15 · §17 · §18) — **μία** απόδοση για κάθε χάρτη που γράφει
 * τιμή πάνω στην περιοχή: σελίδες περιοχής (`AreaChildPriceLayer`) και αναζήτηση (`PriceMapLayer`, ανά βαθμίδα).
 * Τα σημεία τα δίνει το καθαρό `priceMapLabelPointsOf`· εδώ ζουν μόνο η διάταξη και το χρώμα.
 *
 * 🔑 **Διάταξη σε επίπεδο module**: το react-map-gl διαφοροποιεί το `layout` ανά κλειδί (deepEqual) ⇒ καμία απόδοση
 *   δεν ξαναστέλνει τη διάταξη στη MapLibre. Στο JSX ξαναδηλώνονται ρητά `text-field` + `text-font`, γιατί το
 *   CHECK 3.95 Κ3 διαβάζει **μόνο** κυριολεκτικό `layout`.
 * 🔑 **Χρώμα ανά θέμα**: κείμενο του θέματος με φωτοστέφανο του φόντου (`priceMapLabelPaint`) — ξαναδιαβάζεται όταν
 *   αλλάξει το θέμα του υποβάθρου.
 */

import React, { useMemo } from 'react';

import { priceMapLabelLayout, priceMapLabelPaint } from '@/components/market/choropleth/price-map-paint';
import { BASEMAP_OVERLAY_TEXT_FONT } from '@/lib/maps/basemap-catalog';
import { Layer, Source } from '@/lib/maps/maplibre';
import { useBasemapScheme } from '@/lib/maps/use-basemap-scheme';

const LABEL_LAYOUT = priceMapLabelLayout(BASEMAP_OVERLAY_TEXT_FONT);
/** Πάχος φωτοστέφανου σε pixels — αρκετό για κάθε κλάση της κλίμακας, στα δύο υπόβαθρα. */
const HALO_WIDTH = 1.5;

interface PriceMapLabelLayerProps {
  readonly sourceId: string;
  readonly layerId: string;
  readonly points: GeoJSON.FeatureCollection<GeoJSON.Point>;
  /** Η ορατότητα της βαθμίδας — **ίδια** με τα πολύγωνά της, ώστε αριθμός χωρίς χρώμα να μη μείνει ποτέ. */
  readonly minzoom?: number;
  readonly maxzoom?: number;
}

export function PriceMapLabelLayer({ sourceId, layerId, points, minzoom, maxzoom }: PriceMapLabelLayerProps) {
  const scheme = useBasemapScheme();
  // Το θέμα στις εξαρτήσεις: αλλαγή θέματος ⇒ νέα χρώματα από τα tokens.
  const paint = useMemo(() => {
    const { color, halo } = priceMapLabelPaint();
    return { 'text-color': color, 'text-halo-color': halo, 'text-halo-width': HALO_WIDTH };
  }, [scheme]);
  return (
    <Source id={sourceId} type="geojson" data={points}>
      <Layer
        id={layerId}
        type="symbol"
        minzoom={minzoom}
        maxzoom={maxzoom}
        layout={{ ...LABEL_LAYOUT, 'text-field': ['get', 'text'], 'text-font': BASEMAP_OVERLAY_TEXT_FONT }}
        paint={paint}
      />
    </Source>
  );
}
