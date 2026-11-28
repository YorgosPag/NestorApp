/**
 * ADR-920 §14.12 Β4 — οι πηγές και τα στρώματα της δοκιμής πάνω στον χάρτη. Προστακτικά (όχι `<Source>`): οι μετρήσεις
 * αλλάζουν τη διεύθυνση πλακιδίων της πηγής εδάφους ανάμεσα σε όψεις, και ένα React prop θα την ξανάγραφε.
 *
 * 🔑 **Δύο πηγές `raster-dem`**: έδαφος = σύντηξη (το πρωτόκολλο της παραγωγής) · σκίαση γύρω χώρου = το ωμό αρχείο.
 * Η MapLibre προειδοποιεί όταν σκίαση και έδαφος μοιράζονται πηγή.
 */

import type { GeoJSONSourceSpecification, Map as MapLibreMap, RasterDEMTileSource } from 'maplibre-gl';

import { DEFAULT_ELEVATION_SOURCE_ID, attributionHtml, elevationSource } from '@/lib/maps/basemap-catalog';
import type { TerrainFusionSurface } from '@/lib/terrain/elevation-fusion/terrain-fusion-surface';

const FUSED_SOURCE_ID = 'probe-fused-dem';
const RELIEF_SOURCE_ID = 'probe-relief-dem';
const RELIEF_LAYER_ID = 'probe-relief';
const OUTLINE_ID = 'probe-outline';
const HAIRLINES_ID = 'probe-hairlines';

/** Απόσταση των γραμμών δοκιμής οξύτητας (ε). Δεν είναι ισοϋψείς — είναι παράλληλες γραμμές του 1 px. */
const HAIRLINE_SPACING_M = 2;

/** (Ξανα)δηλώνει την πηγή εδάφους. Αλλαγή `maxZoom` ⇒ νέα πηγή — η MapLibre δεν το αλλάζει επί τόπου. */
export function setFusedSource(map: MapLibreMap, tileTemplate: string, maxZoom: number, exaggeration: number): void {
  if (map.getSource(FUSED_SOURCE_ID) !== undefined) {
    map.setTerrain(null);
    map.removeSource(FUSED_SOURCE_ID);
  }
  const source = elevationSource(DEFAULT_ELEVATION_SOURCE_ID);
  map.addSource(FUSED_SOURCE_ID, {
    type: 'raster-dem',
    tiles: [tileTemplate],
    tileSize: source.tileSizePx,
    maxzoom: maxZoom,
    encoding: source.encoding,
    attribution: attributionHtml(source.attribution),
  });
  map.setTerrain({ source: FUSED_SOURCE_ID, exaggeration });
}

/** Νέα διεύθυνση πλακιδίων ⇒ η MapLibre πετά ό,τι κρατούσε και ξαναρωτά το πρωτόκολλο. */
export function retargetFusedTiles(map: MapLibreMap, tileTemplate: string): void {
  map.getSource<RasterDEMTileSource>(FUSED_SOURCE_ID)?.setTiles([tileTemplate]);
}

export function setExaggeration(map: MapLibreMap, exaggeration: number): void {
  if (map.getSource(FUSED_SOURCE_ID) !== undefined) map.setTerrain({ source: FUSED_SOURCE_ID, exaggeration });
}

/** Η σκίαση του γύρω χώρου, από το ωμό αρχείο υψομέτρου (δεύτερη πηγή `raster-dem`). */
export function setRelief(map: MapLibreMap, visible: boolean): void {
  const present = map.getSource(RELIEF_SOURCE_ID) !== undefined;
  if (visible === present) return;
  if (!visible) {
    map.removeLayer(RELIEF_LAYER_ID);
    map.removeSource(RELIEF_SOURCE_ID);
    return;
  }
  const source = elevationSource(DEFAULT_ELEVATION_SOURCE_ID);
  map.addSource(RELIEF_SOURCE_ID, {
    type: 'raster-dem',
    url: source.archiveUrl,
    tileSize: source.tileSizePx,
    maxzoom: source.maxZoom,
    encoding: source.encoding,
  });
  map.addLayer(
    { id: RELIEF_LAYER_ID, type: 'hillshade', source: RELIEF_SOURCE_ID, paint: { 'hillshade-exaggeration': 0.35 } },
    map.getLayer(HAIRLINES_ID) === undefined ? undefined : HAIRLINES_ID,
  );
}

type FramePoint = readonly [number, number];

function lines(surface: TerrainFusionSurface, segments: readonly (readonly [FramePoint, FramePoint])[]): GeoJSON.Feature {
  const coordinates = segments.map((segment) =>
    segment.map(([x, y]) => {
      const { lng, lat } = surface.placement.toGeo(x, y);
      return [lng, lat];
    }),
  );
  return { type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates } };
}

/** Παράλληλες γραμμές πάνω στο πλαίσιο του πλέγματος (η εμβέλεια χωρίς τη ζώνη μετάβασης). */
function hairlines(surface: TerrainFusionSurface): GeoJSON.Feature {
  const { reach, transitionM } = surface;
  const segments: [FramePoint, FramePoint][] = [];
  for (let y = reach.minY + transitionM; y <= reach.maxY - transitionM; y += HAIRLINE_SPACING_M) {
    segments.push([[reach.minX + transitionM, y], [reach.maxX - transitionM, y]]);
  }
  return lines(surface, segments);
}

/** Το χείλος του μετρημένου εδάφους — οι ίδιες ακμές από τις οποίες μετρά η ζώνη μετάβασης. */
function rim(surface: TerrainFusionSurface): GeoJSON.Feature {
  return lines(surface, surface.rim.map(({ a, b }) => [[a.x, a.y], [b.x, b.y]]));
}

function geojson(data: GeoJSON.Feature): GeoJSONSourceSpecification {
  return { type: 'geojson', data };
}

/** Το χείλος και οι γραμμές δοκιμής, ντυμένα στο έδαφος. Καλείται μία φορά, αφού υπάρχει επιφάνεια. */
export function addOverlays(map: MapLibreMap, surface: TerrainFusionSurface): void {
  if (map.getSource(OUTLINE_ID) !== undefined) return;
  map.addSource(HAIRLINES_ID, geojson(hairlines(surface)));
  map.addLayer({ id: HAIRLINES_ID, type: 'line', source: HAIRLINES_ID, paint: { 'line-color': '#1d4ed8', 'line-width': 1 } });
  map.addSource(OUTLINE_ID, geojson(rim(surface)));
  map.addLayer({ id: OUTLINE_ID, type: 'line', source: OUTLINE_ID, paint: { 'line-color': '#b91c1c', 'line-width': 2.5 } });
}

export function setHairlinesVisible(map: MapLibreMap, visible: boolean): void {
  if (map.getLayer(HAIRLINES_ID) !== undefined) map.setLayoutProperty(HAIRLINES_ID, 'visibility', visible ? 'visible' : 'none');
}
