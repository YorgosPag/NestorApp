'use client';

/**
 * # Η ΣΧΕΔΙΑΣΜΕΝΗ ΠΕΡΙΟΧΗ ΣΤΟΝ ΧΑΡΤΗ (ADR-885)
 *
 * Ίδια χρώματα και ίδια θέση στη στοίβα με το διοικητικό όριο (`boundary-paint.ts`):
 * για τον άνθρωπο είναι το ίδιο πράγμα, *«εδώ ψάχνω»*.
 *
 * ⚠️ **Γέμισμα ΜΕΣΑ, όχι μάσκα ΕΞΩ** — η μόνη διαφορά από το όριο, και είναι αναγκαστική.
 * Η μάσκα του ορίου είναι «ο κόσμος με τρύπες» (`regionMaskGeometry`)· δύο σχήματα που
 * **επικαλύπτονται** θα ήταν δύο επικαλυπτόμενες τρύπες, που ο τριγωνισμός του MapLibre
 * (earcut) δεν ορίζει. Το ελαφρύ γέμισμα μέσα λέει το ίδιο χωρίς να ρωτά τη γεωμετρία.
 *
 * 🔑 **Ένα component, δύο στιγμές**: εφαρμοσμένη περιοχή (σταθερή γραμμή) και σχέδιο σε
 * εξέλιξη (διακεκομμένη γραμμή + τα σημεία που πατήθηκαν ένα-ένα).
 */

import React, { useMemo } from 'react';

import { Layer, Source } from '@/lib/maps/maplibre';
import { outlineToGeoJson, pointsToGeoJson } from '@/lib/geo/geo-geojson';
import type { GeoOutline, GeoPoint } from '@/types/geo/coordinates';
import {
  BELOW_LISTINGS,
  BOUNDARY_HALO_WIDTH,
  BOUNDARY_LINE_WIDTH,
  readBoundaryPaint,
} from '../boundary-paint';

interface DrawnAreaLayerProps {
  readonly shapes: readonly GeoOutline[];
  /** Σχέδιο σε εξέλιξη; — διακεκομμένη γραμμή, ώστε να μη μοιάζει ήδη εφαρμοσμένο. */
  readonly draft?: boolean;
  /** Τα σημεία που πατήθηκαν ένα-ένα και δεν έχουν κλείσει ακόμη σε σχήμα. */
  readonly trace?: readonly GeoPoint[];
}

const FILL_OPACITY = 0.12;
const DRAFT_DASH = [2, 1.5];
const VERTEX_RADIUS_PX = 4;

export function DrawnAreaLayer({ shapes, draft = false, trace = [] }: DrawnAreaLayerProps) {
  const paint = readBoundaryPaint();
  const prefix = draft ? 'drawn-area-draft' : 'drawn-area';

  const polygons = useMemo<GeoJSON.FeatureCollection<GeoJSON.Polygon>>(
    () => ({ type: 'FeatureCollection', features: shapes.map(outlineToGeoJson) }),
    [shapes]
  );
  const traceLine = useMemo(() => (trace.length >= 2 ? pointsToGeoJson(trace) : null), [trace]);
  const traceVertices = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(
    () => ({
      type: 'FeatureCollection',
      features: trace.map((point) => ({
        type: 'Feature',
        properties: {},
        geometry: { type: 'Point', coordinates: [point.lng, point.lat] },
      })),
    }),
    [trace]
  );
  const linePaint = draft
    ? { 'line-color': paint.line, 'line-width': BOUNDARY_LINE_WIDTH, 'line-dasharray': DRAFT_DASH }
    : { 'line-color': paint.line, 'line-width': BOUNDARY_LINE_WIDTH };

  return (
    <>
      <Source id={prefix} type="geojson" data={polygons}>
        <Layer
          id={`${prefix}-fill`}
          type="fill"
          beforeId={BELOW_LISTINGS}
          paint={{ 'fill-color': paint.mask, 'fill-opacity': FILL_OPACITY }}
        />
        <Layer
          id={`${prefix}-halo`}
          type="line"
          beforeId={BELOW_LISTINGS}
          layout={{ 'line-join': 'round' }}
          paint={{ 'line-color': paint.halo, 'line-width': BOUNDARY_HALO_WIDTH, 'line-opacity': 0.85 }}
        />
        <Layer id={`${prefix}-line`} type="line" beforeId={BELOW_LISTINGS} layout={{ 'line-join': 'round' }} paint={linePaint} />
      </Source>

      {traceLine !== null && (
        <Source id={`${prefix}-trace`} type="geojson" data={traceLine}>
          <Layer id={`${prefix}-trace-line`} type="line" paint={{ 'line-color': paint.line, 'line-width': 2, 'line-dasharray': DRAFT_DASH }} />
        </Source>
      )}
      {trace.length > 0 && (
        <Source id={`${prefix}-trace-vertices`} type="geojson" data={traceVertices}>
          <Layer
            id={`${prefix}-trace-vertex`}
            type="circle"
            paint={{
              'circle-radius': VERTEX_RADIUS_PX,
              'circle-color': paint.halo,
              'circle-stroke-color': paint.line,
              'circle-stroke-width': 2,
            }}
          />
        </Source>
      )}
    </>
  );
}
