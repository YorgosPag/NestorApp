/**
 * ADR-920 §14.12 Β0 — οι πηγές και τα στρώματα της δοκιμής πάνω στον χάρτη. Προστακτικά (όχι `<Source>`): οι
 * μετρήσεις αλλάζουν τη διεύθυνση πλακιδίων της πηγής εδάφους ανάμεσα σε όψεις, και ένα React prop θα την ξανάγραφε.
 *
 * 🔑 **Δύο πηγές `raster-dem`**: έδαφος = σύντηξη · σκίαση γύρω χώρου = το ωμό αρχείο. Η MapLibre προειδοποιεί όταν
 * σκίαση και έδαφος μοιράζονται πηγή.
 */

import type { GeoJSONSourceSpecification, Map as MapLibreMap, RasterDEMTileSource } from 'maplibre-gl';

import { DEFAULT_ELEVATION_SOURCE_ID, attributionHtml, elevationSource } from '@/lib/maps/basemap-catalog';

import { FUSION_TILE_SIZE } from './fusion-math';
import { fusionTileTemplate } from './fusion-protocol';
import { lngLatOfLocal, PROBE_RING, type ProbeSurface } from './synthetic-site';

const FUSED_SOURCE_ID = 'probe-fused-dem';
const RELIEF_SOURCE_ID = 'probe-relief-dem';
const RELIEF_LAYER_ID = 'probe-relief';
const OUTLINE_ID = 'probe-outline';
const HAIRLINES_ID = 'probe-hairlines';

/** Απόσταση των γραμμών δοκιμής οξύτητας (ε). Δεν είναι ισοϋψείς — είναι παράλληλες γραμμές του 1 px. */
const HAIRLINE_SPACING_M = 2;

/** (Ξανα)δηλώνει την πηγή εδάφους. Αλλαγή `maxZoom` ⇒ νέα πηγή — η MapLibre δεν το αλλάζει επί τόπου. */
export function setFusedSource(map: MapLibreMap, revision: number, maxZoom: number, exaggeration: number): void {
  if (map.getSource(FUSED_SOURCE_ID) !== undefined) {
    map.setTerrain(null);
    map.removeSource(FUSED_SOURCE_ID);
  }
  map.addSource(FUSED_SOURCE_ID, {
    type: 'raster-dem',
    tiles: [fusionTileTemplate(revision)],
    tileSize: FUSION_TILE_SIZE,
    maxzoom: maxZoom,
    encoding: elevationSource(DEFAULT_ELEVATION_SOURCE_ID).encoding,
    attribution: attributionHtml(elevationSource(DEFAULT_ELEVATION_SOURCE_ID).attribution),
  });
  map.setTerrain({ source: FUSED_SOURCE_ID, exaggeration });
}

/** Νέα διεύθυνση πλακιδίων ⇒ η MapLibre πετά ό,τι κρατούσε και ξαναρωτά το πρωτόκολλο. */
export function reloadFusedTiles(map: MapLibreMap, revision: number): void {
  const source = map.getSource<RasterDEMTileSource>(FUSED_SOURCE_ID);
  source?.setTiles([fusionTileTemplate(revision)]);
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

function lineFeature(surface: ProbeSurface, points: readonly { readonly x: number; readonly y: number }[]): GeoJSON.Feature {
  const coordinates = points.map((point) => {
    const { lng, lat } = lngLatOfLocal(surface, point);
    return [lng, lat];
  });
  return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } };
}

function hairlines(surface: ProbeSurface): GeoJSON.FeatureCollection {
  const xs = PROBE_RING.map((p) => p.x);
  const ys = PROBE_RING.map((p) => p.y);
  const features: GeoJSON.Feature[] = [];
  for (let y = Math.min(...ys); y <= Math.max(...ys); y += HAIRLINE_SPACING_M) {
    features.push(lineFeature(surface, [{ x: Math.min(...xs), y }, { x: Math.max(...xs), y }]));
  }
  return { type: 'FeatureCollection', features };
}

function geojson(data: GeoJSON.Feature | GeoJSON.FeatureCollection): GeoJSONSourceSpecification {
  return { type: 'geojson', data };
}

/** Το περίγραμμα και οι γραμμές δοκιμής, ντυμένα στο έδαφος. Καλείται μία φορά, αφού υπάρχει επιφάνεια. */
export function addOverlays(map: MapLibreMap, surface: ProbeSurface): void {
  if (map.getSource(OUTLINE_ID) !== undefined) return;
  map.addSource(HAIRLINES_ID, geojson(hairlines(surface)));
  map.addLayer({ id: HAIRLINES_ID, type: 'line', source: HAIRLINES_ID, paint: { 'line-color': '#1d4ed8', 'line-width': 1 } });
  map.addSource(OUTLINE_ID, geojson(lineFeature(surface, [...PROBE_RING, PROBE_RING[0]])));
  map.addLayer({ id: OUTLINE_ID, type: 'line', source: OUTLINE_ID, paint: { 'line-color': '#b91c1c', 'line-width': 2.5 } });
}

export function setHairlinesVisible(map: MapLibreMap, visible: boolean): void {
  if (map.getLayer(HAIRLINES_ID) !== undefined) map.setLayoutProperty(HAIRLINES_ID, 'visibility', visible ? 'visible' : 'none');
}
