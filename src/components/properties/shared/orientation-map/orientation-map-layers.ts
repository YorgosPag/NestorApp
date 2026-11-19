/**
 * @fileoverview **ΟΙ ΣΤΡΩΣΕΙΣ ΤΟΥ ΧΑΡΤΗ ΠΡΟΣΑΝΑΤΟΛΙΣΜΟΥ** — περιγράμματα κτιρίων, κτίριο κάτω από τον δείκτη, πλευρές.
 * @related ADR-937 Φάση Γ · components/properties/shared/OrientationFromMapDialog · ./useOrientationMapPick
 * @module components/properties/shared/orientation-map/orientation-map-layers
 *
 * 🔑 **Τρία επίπεδα ανάδρασης, όπως η προεπιλογή του Revit / Figma** (pre-selection highlight):
 *   1. **αχνό περίγραμμα σε κάθε κτίριο**: φαίνεται τι μπορείς να πατήσεις πριν πατήσεις·
 *   2. **έντονο περίγραμμα** στο κτίριο κάτω από τον δείκτη ή στην πλευρά που θα επιλεγεί·
 *   3. **επιλεγμένες πλευρές** σε δικό τους χρώμα και πάχος.
 * ⚠️ Τα περιγράμματα διαβάζουν την **ίδια** πηγή και την ίδια στρώση με τη στρώση `buildings` του στυλ: η πηγή
 *    λύνεται από το ίδιο το στυλ σε χρόνο εκτέλεσης (`buildingSourceOf`), όχι από σταθερά εδώ.
 */

import type { FeatureCollection, LineString, Polygon } from 'geojson';

import { protomapsBuildingKindFilter } from '@/lib/geo/osm/protomaps-osm-identity';
import type { LayerProps } from '@/lib/maps/maplibre';
import type { BuildingSource } from '@/lib/maps/rendered-buildings';
import type { GeoPoint } from '@/types/geo/coordinates';

export const EDGE_SOURCE = 'orientation-edges';
export const HOVER_SOURCE = 'orientation-hover-building';
export const BUILDING_ZOOM = 18;


/* eslint-disable design-system/no-hardcoded-colors -- Το MapLibre δέχεται ΜΟΝΟ literal χρώματα στο `paint`: δεν αποτιμά
   CSS custom properties (ίδια δήλωση με το `components/geo/PlaceMap.tsx`). */
const OUTLINE = '#2563eb';
const HOVER = '#1d4ed8';
const SELECTED = '#d97706';

export function buildingOutlineLayer(building: BuildingSource): LayerProps {
  return {
    id: 'orientation-building-outlines',
    type: 'line',
    source: building.source,
    'source-layer': building.sourceLayer,
    filter: protomapsBuildingKindFilter(),
    paint: { 'line-color': OUTLINE, 'line-opacity': 0.45, 'line-width': 1 },
  };
}

export const HOVER_OUTLINE_LAYER: LayerProps = {
  id: 'orientation-hover-building-line',
  type: 'line',
  source: HOVER_SOURCE,
  paint: { 'line-color': HOVER, 'line-width': 3 },
};

export const EDGE_LINE_LAYER: LayerProps = {
  id: 'orientation-edges-line',
  type: 'line',
  source: EDGE_SOURCE,
  paint: {
    'line-color': ['case', ['==', ['get', 'selected'], 1], SELECTED, ['==', ['get', 'hovered'], 1], HOVER, OUTLINE],
    'line-width': ['case', ['==', ['get', 'selected'], 1], 7, ['==', ['get', 'hovered'], 1], 6, 4],
  },
};
/* eslint-enable design-system/no-hardcoded-colors */

/** Οι πλευρές του δακτυλίου ως γραμμές, με το `index` τους και την κατάσταση επιλογής / δείκτη. */
export function edgesGeoJson(
  ring: readonly GeoPoint[],
  selected: ReadonlySet<number>,
  hovered: number | null,
): FeatureCollection<LineString> {
  return {
    type: 'FeatureCollection',
    features: ring.map((a, i) => {
      const b = ring[(i + 1) % ring.length];
      return {
        type: 'Feature',
        properties: { index: i, selected: selected.has(i) ? 1 : 0, hovered: hovered === i ? 1 : 0 },
        geometry: { type: 'LineString', coordinates: [[a.lng, a.lat], [b.lng, b.lat]] },
      };
    }),
  };
}

/** Το κτίριο κάτω από τον δείκτη ως κλειστό πολύγωνο. */
export function ringGeoJson(ring: readonly GeoPoint[]): FeatureCollection<Polygon> {
  const coordinates = ring.map((p) => [p.lng, p.lat]);
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [[...coordinates, coordinates[0]]] },
      },
    ],
  };
}
