/**
 * @fileoverview SSoT — **ποιο κτίριο δείχνει ο χάρτης σε αυτό το pixel**, από τα πλακίδια που **ήδη** φορτώθηκαν.
 * @related ADR-777 §8.104 (βαθμίδα 1) · ADR-937 (χάρτης προσανατολισμού) · lib/geo/osm/protomaps-osm-identity
 * @module lib/maps/rendered-buildings
 *
 * 🔑 **Η πρώτη βαθμίδα της ταυτότητας κτιρίου: 0 ms, 0 δίκτυο.** Ο διανυσματικός χάρτης έχει ήδη στη μνήμη κάθε κτίριο
 *    της οθόνης με την ταυτότητα OSM του (`feature.id`, μετρημένη κωδικοποίηση). Ένα κλικ δεν χρειάζεται να ρωτήσει
 *    κανέναν «τι είναι εδώ» — το ξέρει. Ο διακομιστής **επαληθεύει** στην εγγραφή από το **ίδιο** αρχείο (§14.4 κ.2).
 *
 * 🔑 **Ένας αναγνώστης για όλες τις οθόνες.** Ζούσε μέσα στο `useOrientationMapPick` (ADR-937)· ο επιλογέας τόπου
 *    χρειάστηκε την ίδια ερώτηση, άρα εξήχθη εδώ αντί να γραφτεί δεύτερη φορά.
 *
 * ⚠️ **Το περίγραμμα που επιστρέφει είναι ΘΡΑΥΣΜΑ** όταν το κτίριο διασχίζει όριο πλακιδίου (το `queryRenderedFeatures`
 *    δίνει τη γεωμετρία **ανά πλακίδιο** — Mapbox/MapLibre το δηλώνουν ρητά). Για **τονισμό** δεν χρειάζεται καθόλου
 *    γεωμετρία: η στρώση με φίλτρο `['==', ['id'], featureId]` ζωγραφίζει **κάθε** κομμάτι, χωρίς ραφές. Για τον
 *    προσανατολισμό (πλευρές) αρκεί, όπως πριν.
 *
 * ⚠️ Στον εφεδρικό χάρτη (raster, `use-default-basemap`) η στρώση κτιρίων **δεν υπάρχει** ⇒ `null`, και ο καλών
 *    ρωτά τον διακομιστή (βαθμίδα 2).
 */

import type { GeoPoint } from '@/types/geo/coordinates';
import type { PlanarPoint } from '@/lib/geometry/planar-polygon';
import { buildingRingOf } from '@/lib/property/orientation-from-map';
import { geoOutlineAreaSqm } from '@/lib/geo/geo-ring';
import {
  osmRefOfTileFeatureId,
  PROTOMAPS_BUILDINGS_STYLE_LAYER,
  type ProtomapsOsmRef,
} from '@/lib/geo/osm/protomaps-osm-identity';

import type { MapLayerMouseEvent } from './maplibre';

/** Ο χάρτης όπως τον δίνει ένα γεγονός της MapLibre (`event.target`). */
export type RenderedMap = MapLayerMouseEvent['target'];

/** Πού ζουν τα κτίρια του στυλ — όπως τα δηλώνει η ίδια η στρώση `buildings`. */
export interface BuildingSource {
  readonly source: string;
  readonly sourceLayer: string;
}

/** Ένα κτίριο της οθόνης. */
export interface RenderedBuilding {
  /** Ο δακτύλιος **στην οθόνη** — θραύσμα όταν διασχίζει όριο πλακιδίου (δες την κεφαλίδα). */
  readonly ring: GeoPoint[];
  /** `null` όταν το χαρακτηριστικό δεν έχει `id` (δεν τονίζεται ούτε ονομάζεται). */
  readonly featureId: number | null;
}

/** Η επιλογή κτιρίου που ταξιδεύει από τον χάρτη στον επιλογέα: **ποιο** στοιχείο OSM + **πού** να τονιστεί. */
export interface RenderedBuildingPick {
  readonly ref: ProtomapsOsmRef;
  readonly featureId: number;
  readonly source: BuildingSource;
}

/**
 * **Τι χρειάζεται ο χάρτης για να τονίσει ένα κτίριο του φόντου**: ταυτότητα + πηγή — καμία γεωμετρία (η στρώση
 * φιλτράρει `['==', ['id'], featureId]` και ζωγραφίζει κάθε κομμάτι μόνη της).
 */
export type BuildingHighlight = Pick<RenderedBuildingPick, 'featureId' | 'source'>;

/** Η πηγή κτιρίων του **τρέχοντος** στυλ, ή `null` όταν το φόντο δεν έχει κτίρια (εφεδρεία raster). */
export function renderedBuildingSourceOf(map: RenderedMap): BuildingSource | null {
  const layer = map.getLayer(PROTOMAPS_BUILDINGS_STYLE_LAYER);
  return layer?.source && layer.sourceLayer ? { source: layer.source, sourceLayer: layer.sourceLayer } : null;
}

function renderedBuildingOf(feature: { geometry: Parameters<typeof buildingRingOf>[0]; id?: string | number }): RenderedBuilding | null {
  const ring = buildingRingOf(feature.geometry);
  if (ring === null) return null;
  return { ring, featureId: typeof feature.id === 'number' ? feature.id : null };
}

/**
 * **Τα κτίρια κάτω από αυτό το pixel** (ή μέσα σε ένα πλαίσιο pixel), όπως τα ζωγραφίζει ο χάρτης τώρα.
 * Κενό όταν η στρώση δεν υπάρχει — **ποτέ** εξαίρεση.
 */
export function renderedBuildingsAt(
  map: RenderedMap,
  where: PlanarPoint | readonly [PlanarPoint, PlanarPoint],
): RenderedBuilding[] {
  if (!map.getLayer(PROTOMAPS_BUILDINGS_STYLE_LAYER)) return [];
  const query: [number, number] | [[number, number], [number, number]] =
    'x' in where ? [where.x, where.y] : [[where[0].x, where[0].y], [where[1].x, where[1].y]];
  return map
    .queryRenderedFeatures(query, { layers: [PROTOMAPS_BUILDINGS_STYLE_LAYER] })
    .map(renderedBuildingOf)
    .filter((building): building is RenderedBuilding => building !== null);
}

/** Το **πάνω** κτίριο κάτω από το pixel (σειρά απόδοσης) — ό,τι βλέπει ο άνθρωπος ότι πάτησε. */
export function renderedBuildingAt(map: RenderedMap, pixel: PlanarPoint): RenderedBuilding | null {
  return renderedBuildingsAt(map, pixel)[0] ?? null;
}

/**
 * **Ποιο κτίριο OSM πάτησε ο άνθρωπος** — έτοιμο να γίνει χειρονομία `picked-osm-building`, ή `null`.
 *
 * 🔑 Όταν το pixel πέφτει σε **περισσότερα** (κτίριο + `building_part`), νικά το **μικρότερο** — ο ίδιος κανόνας με τον
 *    διακομιστή (`findArchiveBuildingAt` · `findOsmBuildingAt`, SPEC-777A §13.3): το πιο συγκεκριμένο, όχι εικασία.
 * ⚠️ `null` σημαίνει «η οθόνη δεν ξέρει» (raster · κενό · ταυτότητα εκτός μετρημένης ζώνης) — ο καλών ρωτά τον
 *    διακομιστή, **ποτέ** «δεν υπάρχει κτίριο».
 */
export function renderedBuildingPickAt(map: RenderedMap, pixel: PlanarPoint): RenderedBuildingPick | null {
  const source = renderedBuildingSourceOf(map);
  if (source === null) return null;
  const candidates = renderedBuildingsAt(map, pixel)
    .map((building) => ({ building, ref: osmRefOfTileFeatureId(building.featureId) }))
    .filter((candidate): candidate is { building: RenderedBuilding; ref: ProtomapsOsmRef } => candidate.ref !== null)
    .sort((a, b) => geoOutlineAreaSqm(a.building.ring) - geoOutlineAreaSqm(b.building.ring));
  const winner = candidates[0];
  return winner === undefined || winner.building.featureId === null
    ? null
    : { ref: winner.ref, featureId: winner.building.featureId, source };
}
