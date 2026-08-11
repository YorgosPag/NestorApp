'use client';

/**
 * @fileoverview **Η ΕΠΙΦΑΝΕΙΑ ΤΟΥ ΧΑΡΤΗ** για τον εντοπισμό τόπου — μία, για τρεις χειρονομίες.
 * @related ADR-777 · SPEC-777A §13.6 · §21.4 · components/geo/PlaceChooser.tsx
 * @module components/geo/PlaceMap
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ **ΜΙΑ** ΕΠΙΦΑΝΕΙΑ ΚΑΙ ΟΧΙ ΤΡΕΙΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Οι τρεις χειρονομίες του §21.4 που γίνονται **πάνω στον χάρτη** — διάλεξε κτίριο ·
 * βάλε πινέζα · ζωγράφισε περίγραμμα — είναι, από την πλευρά της επιφάνειας, **η ίδια
 * πράξη**: ένα κλικ σε συντεταγμένες. Ό,τι διαφέρει είναι **τι ζωγραφίζεται μετά**,
 * και αυτό είναι δεδομένο (`outline`, `pin`), όχι δεύτερος χάρτης.
 *
 * 🔑 Τρεις χάρτες θα ήταν το σχήμα που το SPEC-777-CHANGELOG **ήδη κατήγγειλε**:
 * *«ο χάρτης υπάρχει **ΤΡΕΙΣ** φορές … ADR-749 σε χαρτογραφική μορφή»*. Δεν
 * προστίθεται τέταρτος.
 *
 * ⚠️ **Καμία νέα εξάρτηση.** `react-map-gl/maplibre` είναι ήδη εγκατεστημένο και το
 * `OSM_MAP_STYLE` υπάρχει ως SSoT στο `components/projects/ika/map-shared` — το ίδιο
 * που χρησιμοποιούν οι δύο χάρτες του ΙΚΑ. Ένα εργαλείο σχεδίασης από πακέτο
 * (`mapbox-gl-draw`) θα ήταν **νέα άδεια προς έλεγχο** (N.5) για κάτι που εδώ είναι
 * ένας πίνακας κορυφών.
 *
 * ⛔ **ΔΕΝ αγγίζει το Geo-Canvas** (ADR-782, ξένο subapp με ανοιχτή δουλειά τρίτου).
 */

import React, { useCallback } from 'react';
import { Layer, Map, Marker, Source, type MapLayerMouseEvent } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapPin } from 'lucide-react';

import { OSM_MAP_STYLE } from '@/components/projects/ika/map-shared';
import { outlineToGeoJson, pointsToGeoJson } from '@/lib/geo/geo-geojson';
import { cn } from '@/lib/utils';
import type { GeoOutline, GeoPoint } from '@/types/geo/coordinates';

/** Ζουμ κτιρίου — αρκετά κοντά ώστε ένα κλικ να διακρίνει **κτίριο**, όχι τετράγωνο. */
const BUILDING_ZOOM = 18;

const SHAPE_SOURCE = 'place-shape';
const TRACE_SOURCE = 'place-trace';

/* eslint-disable design-system/no-hardcoded-colors -- Το MapLibre δέχεται ΜΟΝΟ literal
   χρώματα στο `paint`: δεν αποτιμά CSS custom properties. Ίδιος λόγος και ίδια
   δήλωση με το `map-shared/map-styles.ts`, που είναι ο SSoT των στρώσεων χάρτη. */
const SHAPE_FILL = {
  id: 'place-shape-fill',
  type: 'fill' as const,
  source: SHAPE_SOURCE,
  paint: { 'fill-color': '#2563eb', 'fill-opacity': 0.18 },
};

const SHAPE_LINE = {
  id: 'place-shape-line',
  type: 'line' as const,
  source: SHAPE_SOURCE,
  paint: { 'line-color': '#2563eb', 'line-width': 2 },
};

const TRACE_LINE = {
  id: 'place-trace-line',
  type: 'line' as const,
  source: TRACE_SOURCE,
  paint: { 'line-color': '#2563eb', 'line-width': 2, 'line-dasharray': [2, 2] },
};
/* eslint-enable design-system/no-hardcoded-colors */

export interface PlaceMapProps {
  /** Πού κοιτάζει ο χάρτης όταν ανοίγει. */
  readonly center: GeoPoint;
  /**
   * Ο άνθρωπος πάτησε εδώ.
   *
   * ⚠️ **Προαιρετικό, και η απουσία είναι ΝΟΗΜΑ**: ο ίδιος χάρτης χρησιμεύει και ως
   * **απάντηση** (η καρτέλα του τόπου δείχνει το περίγραμμα ενός τόπου που έχει ήδη
   * επιλεγεί). Ένα `onPick={() => {}}` εκεί θα ήταν χειριστήριο που **δέχεται** κλικ
   * και τα πετά — δηλαδή επιφάνεια που υπόσχεται πράξη χωρίς να την κάνει. Χωρίς
   * `onPick` ο δείκτης μένει προεπιλεγμένος και δεν προσκαλείται κανείς να πατήσει.
   */
  readonly onPick?: (point: GeoPoint) => void;
  /** Κλειστό σχήμα προς εμφάνιση — κτίριο OSM (**ζωντανά**) ή ολοκληρωμένο σχέδιο. */
  readonly outline?: GeoOutline | null;
  /** Οι κορυφές που **σχεδιάζονται τώρα** — ανοιχτή γραμμή, όχι σχήμα. */
  readonly trace?: readonly GeoPoint[];
  /** Πινέζα. */
  readonly pin?: GeoPoint | null;
  readonly disabled?: boolean;
  readonly heightClass?: string;
}

export function PlaceMap({
  center,
  onPick,
  outline = null,
  trace = [],
  pin = null,
  disabled = false,
  heightClass = 'h-80',
}: PlaceMapProps): React.ReactElement {
  const interactive = onPick !== undefined && !disabled;

  const handleClick = useCallback(
    (event: MapLayerMouseEvent) => {
      if (!interactive) return;
      onPick?.({ lat: event.lngLat.lat, lng: event.lngLat.lng });
    },
    [interactive, onPick],
  );

  return (
    <figure className={cn('relative overflow-hidden rounded-lg border border-border', heightClass)}>
      <Map
        initialViewState={{ latitude: center.lat, longitude: center.lng, zoom: BUILDING_ZOOM }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={OSM_MAP_STYLE}
        onClick={handleClick}
        cursor={interactive ? 'crosshair' : 'default'}
        attributionControl={false}
      >
        {outline !== null && outline.length >= 3 && (
          <Source id={SHAPE_SOURCE} type="geojson" data={outlineToGeoJson(outline)}>
            <Layer {...SHAPE_FILL} />
            <Layer {...SHAPE_LINE} />
          </Source>
        )}

        {/* ⚠️ Η **υπό σχεδίαση** γραμμή είναι ξεχωριστή πηγή από το κλειστό σχήμα: ένα
            ημιτελές σχέδιο **δεν είναι** πολύγωνο, και το να ζωγραφιζόταν ως γεμάτο
            σχήμα θα έλεγε στον άνθρωπο ότι έκλεισε κάτι που δεν έκλεισε. */}
        {trace.length >= 2 && (
          <Source id={TRACE_SOURCE} type="geojson" data={pointsToGeoJson(trace)}>
            <Layer {...TRACE_LINE} />
          </Source>
        )}

        {trace.map((vertex, index) => (
          <Marker key={`${vertex.lat}:${vertex.lng}:${index}`} latitude={vertex.lat} longitude={vertex.lng}>
            <span className="block size-2 rounded-full border border-background bg-foreground" />
          </Marker>
        ))}

        {pin !== null && (
          <Marker latitude={pin.lat} longitude={pin.lng} anchor="bottom">
            <MapPin className="size-6 text-foreground" aria-hidden />
          </Marker>
        )}
      </Map>
    </figure>
  );
}
