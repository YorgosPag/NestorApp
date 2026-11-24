/**
 * @fileoverview **ΕΝΑ ΠΛΑΚΙΔΙΟ ΤΟΥ ΔΙΚΟΥ ΜΑΣ ΑΡΧΕΙΟΥ OSM → ΘΡΑΥΣΜΑΤΑ ΚΤΙΡΙΩΝ** — καθαρό, δοκιμάσιμο χωρίς δίκτυο.
 * @related ADR-777 · SPEC-777A §13.5 · ADR-891 (αρχείο Protomaps) · ./protomaps-osm-identity · ./osm-archive-building
 * @module lib/geo/osm/osm-archive-tile
 *
 * 🔑 **Θραύσμα, όχι κτίριο.** Ένα διανυσματικό πλακίδιο κόβει κάθε γεωμετρία στο δικό του πλαίσιο (+ μια μικρή ζώνη
 *    ασφαλείας). Κτίριο πάνω σε όριο πλακιδίου έρχεται **σε κομμάτια, με το ίδιο `id`** σε κάθε πλακίδιο που αγγίζει —
 *    ακριβώς όπως το `queryRenderedFeatures` της MapLibre/Mapbox, που το λέει ρητά στην τεκμηρίωσή του. Εδώ λοιπόν
 *    παράγονται **θραύσματα** και το καθένα δηλώνει **προς ποια πλευρά ξεχειλίζει** (`spills`), ώστε ο αναγνώστης να ζητήσει
 *    **μόνο** τους γείτονες που χρειάζονται (το ~97 % των κτιρίων χωρά σε ένα πλακίδιο z15 ≈ 940 m).
 *
 * 📐 **Οι κορυφές μένουν στο ΑΚΕΡΑΙΟ ΠΛΕΓΜΑ του πλακιδίου** (`GridPair`: παγκόσμιες μονάδες = πλακίδιο × 4096 + τοπική
 *    θέση). Ο λόγος είναι μετρήσιμος: η ένωση θραυσμάτων (`polygon-clipping`, Martinez-Rueda) είναι **εύθραυστη σε
 *    μικροσκοπικές συντεταγμένες** — ένα κτίριο σε μοίρες έχει εύρος ~0,0002 (δες το `safe-polygon-boolean.ts` του
 *    dxf-viewer, που κλιμακώνει ακριβώς γι' αυτό). Στο πλέγμα το ίδιο κτίριο έχει εύρος ~100 μονάδες σε τιμές ~10^8,
 *    δηλαδή η ένωση τρέχει εκεί όπου ο αλγόριθμος είναι σταθερός, και η μετατροπή σε μοίρες γίνεται **μία φορά**, στο τέλος.
 *
 * ⚖️ ODbL (§13.4): τίποτα από εδώ δεν αποθηκεύεται — είναι ανάγνωση **ενός** πλακιδίου για **μία** ανθρώπινη χειρονομία.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις + αποκωδικοποιητής MVT (`@mapbox/vector-tile`, `pbf` — BSD-3, ίδιες
 * εκδόσεις με της MapLibre, CHECK 3.65). Καμία εξάρτηση από δίκτυο/Firestore/React.
 */

import { VectorTile, classifyRings, type VectorTileFeature } from '@mapbox/vector-tile';
import Pbf from 'pbf';

import { lngLatToWorldPixel, MAPLIBRE_TILE_SIZE_PX, worldPixelToLngLat } from '@/lib/maps/metric-size';
import type { GeoPoint } from '@/types/geo/coordinates';

import { isProtomapsBuildingKind, PROTOMAPS_BUILDINGS_SOURCE_LAYER, PROTOMAPS_ROADS_SOURCE_LAYER } from './protomaps-osm-identity';

/** Οι ιδιότητες ονόματος ενός δρόμου — το τοπικό (`name`) και το ελληνικό (`name:el`), όπου διαφέρουν. */
const ROAD_NAME_PROPERTIES = ['name', 'name:el'] as const;

/** Οι μονάδες του πλέγματος ανά πλακίδιο — το σύνηθες `extent` του MVT· άλλο `extent` κλιμακώνεται σε αυτό. */
export const GRID_UNITS_PER_TILE = 4096;

/** Η διεύθυνση ενός πλακιδίου XYZ. */
export interface ArchiveTileAddress {
  readonly z: number;
  readonly x: number;
  readonly y: number;
}

/** Κορυφή στο παγκόσμιο πλέγμα του ζουμ (δες την κεφαλίδα). Μεταβλητή ζεύγος: η μορφή που δέχεται το `polygon-clipping`. */
export type GridPair = [number, number];
/** Πολύγωνο: `[εξωτερικός, ...τρύπες]`, κάθε δακτύλιος **κλειστός** (πρώτη = τελευταία κορυφή). */
export type GridPolygon = GridPair[][];

/** Προς ποιες πλευρές το θραύσμα βγαίνει έξω από το πλακίδιό του (στη ζώνη ασφαλείας) ⇒ το κτίριο ίσως συνεχίζει εκεί. */
export interface TileSpills {
  readonly west: boolean;
  readonly east: boolean;
  readonly north: boolean;
  readonly south: boolean;
}

/** Το κομμάτι ενός κτιρίου που περιέχει **ένα** πλακίδιο. */
export interface BuildingFragment {
  /** Το `id` του χαρακτηριστικού — ίδιο σε κάθε πλακίδιο (δες `protomaps-osm-identity`). */
  readonly featureId: number;
  readonly polygons: readonly GridPolygon[];
  readonly spills: TileSpills;
  /** `addr_housenumber` — η μόνη διευθυνσιακή ιδιότητα που κρατά η στρώση κτιρίων. */
  readonly houseNumber: string | null;
}

/** Το πλακίδιο του αρχείου που περιέχει ένα σημείο, στο ζουμ `z`. */
export function archiveTileOf(point: GeoPoint, z: number): ArchiveTileAddress {
  const [px, py] = lngLatToWorldPixel(point.lng, point.lat, z);
  const last = 2 ** z - 1;
  const index = (value: number): number => Math.min(last, Math.max(0, Math.floor(value / MAPLIBRE_TILE_SIZE_PX)));
  return { z, x: index(px), y: index(py) };
}

/** Σημείο WGS84 → κορυφή πλέγματος στο ζουμ `z`. */
export function gridPairOf(point: GeoPoint, z: number): GridPair {
  const [px, py] = lngLatToWorldPixel(point.lng, point.lat, z);
  const scale = GRID_UNITS_PER_TILE / MAPLIBRE_TILE_SIZE_PX;
  return [px * scale, py * scale];
}

/** Κορυφή πλέγματος στο ζουμ `z` → σημείο WGS84. */
export function geoPointOfGrid([gx, gy]: GridPair, z: number): GeoPoint {
  const scale = MAPLIBRE_TILE_SIZE_PX / GRID_UNITS_PER_TILE;
  const [lng, lat] = worldPixelToLngLat(gx * scale, gy * scale, z);
  return { lat, lng };
}

/**
 * **Οι γείτονες που χρειάζονται** για να ολοκληρωθούν τα δοσμένα θραύσματα — μαζί με τις διαγωνίους όταν ξεχειλίζει
 * προς δύο κάθετες πλευρές. Ποτέ πέρα από τον δακτύλιο 3×3: κτίριο μεγαλύτερο από πλακίδιο z15 (~940 m) είναι δηλωμένο όριο.
 */
export function neighbourTilesFor(tile: ArchiveTileAddress, fragments: readonly BuildingFragment[]): ArchiveTileAddress[] {
  const last = 2 ** tile.z - 1;
  const wanted = new Map<string, ArchiveTileAddress>();
  for (const { spills } of fragments) {
    const dxs = [0, ...(spills.west ? [-1] : []), ...(spills.east ? [1] : [])];
    const dys = [0, ...(spills.north ? [-1] : []), ...(spills.south ? [1] : [])];
    for (const dx of dxs) {
      for (const dy of dys) {
        const x = tile.x + dx;
        const y = tile.y + dy;
        if ((dx === 0 && dy === 0) || x < 0 || y < 0 || x > last || y > last) continue;
        wanted.set(`${x}/${y}`, { z: tile.z, x, y });
      }
    }
  }
  return [...wanted.values()];
}

/** Οι δακτύλιοι ενός χαρακτηριστικού MVT → πολύγωνα πλέγματος + ποιες πλευρές ξεχειλίζουν. */
function fragmentGeometry(
  rings: ReturnType<VectorTileFeature['loadGeometry']>,
  tile: ArchiveTileAddress,
  extent: number,
): { polygons: GridPolygon[]; spills: TileSpills } {
  const scale = GRID_UNITS_PER_TILE / extent;
  const originX = tile.x * GRID_UNITS_PER_TILE;
  const originY = tile.y * GRID_UNITS_PER_TILE;
  let west = false, east = false, north = false, south = false;
  const polygons = classifyRings(rings).map((polygon) =>
    polygon.map((ring) =>
      ring.map((p): GridPair => {
        if (p.x < 0) west = true;
        if (p.x > extent) east = true;
        if (p.y < 0) north = true;
        if (p.y > extent) south = true;
        return [originX + p.x * scale, originY + p.y * scale];
      }),
    ),
  );
  return { polygons, spills: { west, east, north, south } };
}

/**
 * **Τα θραύσματα κτιρίων ενός πλακιδίου** (ήδη αποσυμπιεσμένου).
 *
 * ⚠️ Χαρακτηριστικό **χωρίς `id`** απορρίπτεται: χωρίς ταυτότητα δεν ράβεται με τα κομμάτια του, δεν τονίζεται και δεν
 *    γίνεται αναφορά OSM — θα ήταν «κτίριο» που κανείς δεν μπορεί να ονομάσει.
 */
export function decodeBuildingFragments(bytes: Uint8Array, tile: ArchiveTileAddress): BuildingFragment[] {
  const layer = new VectorTile(new Pbf(bytes)).layers[PROTOMAPS_BUILDINGS_SOURCE_LAYER];
  if (layer === undefined) return [];
  const fragments: BuildingFragment[] = [];
  for (let i = 0; i < layer.length; i += 1) {
    const feature = layer.feature(i);
    // 3 = Polygon (MVT). Η στρώση κρατά και σημεία διευθύνσεων (`kind: address`) — δεν είναι κτίρια.
    if (feature.type !== 3 || feature.id === undefined || !isProtomapsBuildingKind(feature.properties.kind)) continue;
    const { polygons, spills } = fragmentGeometry(feature.loadGeometry(), tile, layer.extent);
    if (polygons.length === 0) continue;
    const houseNumber = feature.properties.addr_housenumber;
    fragments.push({
      featureId: feature.id,
      polygons,
      spills,
      houseNumber: typeof houseNumber === 'string' && houseNumber.trim() !== '' ? houseNumber.trim() : null,
    });
  }
  return fragments;
}

/**
 * **Τα ονόματα οδών ενός πλακιδίου** (ήδη αποσυμπιεσμένου) — ADR-950 §8.13, «Μήπως εννοείτε…».
 * Μόνο το **όνομα**: καμία γεωμετρία, τίποτα δεν αποθηκεύεται (ODbL §13.4).
 */
export function decodeRoadNames(bytes: Uint8Array): string[] {
  const layer = new VectorTile(new Pbf(bytes)).layers[PROTOMAPS_ROADS_SOURCE_LAYER];
  if (layer === undefined) return [];
  const names = new Set<string>();
  for (let i = 0; i < layer.length; i += 1) {
    const properties = layer.feature(i).properties;
    for (const key of ROAD_NAME_PROPERTIES) {
      const name = properties[key];
      if (typeof name === 'string' && name.trim() !== '') names.add(name.trim());
    }
  }
  return [...names];
}
