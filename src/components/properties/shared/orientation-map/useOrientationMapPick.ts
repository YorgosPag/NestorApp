'use client';

/**
 * @fileoverview **ΤΙ ΣΗΜΑΙΝΕΙ ΚΑΘΕ ΚΙΝΗΣΗ ΣΤΟΝ ΧΑΡΤΗ ΠΡΟΣΑΝΑΤΟΛΙΣΜΟΥ** — πρόταση κτιρίου, επιλογή πλευρών με ανοχή,
 * τονισμός κάτω από τον δείκτη, ρητή αλλαγή κτιρίου.
 * @related ADR-937 Φάση Γ · lib/property/orientation-from-map (οι καθαρές αποφάσεις) · ./orientation-map-layers
 * @module components/properties/shared/orientation-map/useOrientationMapPick
 *
 * 🔑 **Αφού διαλεχτεί κτίριο, το κλικ ΔΕΝ το αλλάζει ποτέ σιωπηλά.** Πριν, ένα κλικ λίγα pixel έξω από τη γραμμή έπεφτε
 *    στο διπλανό κτίριο και η επιλογή χανόταν. Τώρα το κλικ ή εναλλάσσει την πλησιέστερη πλευρά (μέσα στην ανοχή) ή δεν
 *    κάνει τίποτα· άλλο κτίριο **μόνο** με το «Άλλο κτίριο» (όπως το «Tab» / Esc του Revit: η επιλογή αλλάζει ρητά).
 * 🔑 **Η πρόταση κτιρίου δεν είναι απόφαση**: τονίζεται το κτίριο στη θέση (ή το πλησιέστερο), οι πλευρές τις διαλέγει
 *    πάντα ο άνθρωπος, και το «Άλλο κτίριο» την ακυρώνει.
 */

import { useCallback, useMemo, useRef, useState } from 'react';

import type { MapLayerMouseEvent } from '@/lib/maps/maplibre';
import type { OrientationType } from '@/constants/property-features-enterprise';
import type { PlanarPoint } from '@/lib/geometry/planar-polygon';
import {
  BUILDING_SUGGEST_RADIUS_PX,
  buildingRingOf,
  nearestEdgeIndex,
  orientationsOfSelectedEdges,
  suggestedBuildingIndex,
} from '@/lib/property/orientation-from-map';
import type { GeoPoint } from '@/types/geo/coordinates';

import { BUILDINGS_LAYER, type BuildingSource } from './orientation-map-layers';

type MapInstance = MapLayerMouseEvent['target'];
type MapEvent = { readonly target: MapInstance };

function toScreen(map: MapInstance, ring: readonly GeoPoint[]): PlanarPoint[] {
  return ring.map((p) => {
    const { x, y } = map.project([p.lng, p.lat]);
    return { x, y };
  });
}

function buildingSourceOf(map: MapInstance): BuildingSource | null {
  const layer = map.getLayer(BUILDINGS_LAYER);
  return layer?.source && layer.sourceLayer ? { source: layer.source, sourceLayer: layer.sourceLayer } : null;
}

function buildingAt(map: MapInstance, point: PlanarPoint): GeoPoint[] | null {
  if (!map.getLayer(BUILDINGS_LAYER)) return null;
  const feature = map.queryRenderedFeatures([point.x, point.y], { layers: [BUILDINGS_LAYER] })[0];
  return feature ? buildingRingOf(feature.geometry) : null;
}

function suggestBuilding(map: MapInstance, center: GeoPoint): GeoPoint[] | null {
  if (!map.getLayer(BUILDINGS_LAYER)) return null;
  const c = map.project([center.lng, center.lat]);
  const r = BUILDING_SUGGEST_RADIUS_PX;
  const rings = map
    .queryRenderedFeatures([[c.x - r, c.y - r], [c.x + r, c.y + r]], { layers: [BUILDINGS_LAYER] })
    .map((feature) => buildingRingOf(feature.geometry))
    .filter((ring): ring is GeoPoint[] => ring !== null);
  const index = suggestedBuildingIndex(rings.map((ring) => toScreen(map, ring)), { x: c.x, y: c.y });
  return index === null ? null : rings[index];
}

/** Ίδιο κτίριο ⇒ ίδιο κλειδί: η κίνηση του δείκτη μέσα στο ίδιο κτίριο δεν ξαναζωγραφίζει τίποτα. */
function ringKey(ring: readonly GeoPoint[] | null): string {
  return ring === null || ring.length === 0 ? '' : `${ring.length}:${ring[0].lat},${ring[0].lng}`;
}

function sameSource(a: BuildingSource | null | undefined, b: BuildingSource | null): boolean {
  return a !== undefined && a?.source === b?.source && a?.sourceLayer === b?.sourceLayer;
}

export interface OrientationMapPick {
  readonly ring: GeoPoint[] | null;
  readonly suggested: boolean;
  readonly selected: ReadonlySet<number>;
  readonly hoverEdge: number | null;
  readonly hoverRing: GeoPoint[] | null;
  /** `undefined` = ο χάρτης δεν φόρτωσε ακόμη· `null` = το φόντο δεν έχει κτίρια (εφεδρεία). */
  readonly buildingSource: BuildingSource | null | undefined;
  readonly values: OrientationType[];
  readonly cursor: string;
  readonly onClick: (event: MapLayerMouseEvent) => void;
  readonly onMouseMove: (event: MapLayerMouseEvent) => void;
  readonly onMouseLeave: () => void;
  readonly onStyleData: (event: MapEvent) => void;
  readonly onIdle: (event: MapEvent) => void;
  readonly changeBuilding: () => void;
  readonly reset: () => void;
}

export function useOrientationMapPick(center: GeoPoint): OrientationMapPick {
  const [ring, setRing] = useState<GeoPoint[] | null>(null);
  const [suggested, setSuggested] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [hoverEdge, setHoverEdge] = useState<number | null>(null);
  const [hoverRing, setHoverRing] = useState<GeoPoint[] | null>(null);
  const [buildingSource, setBuildingSource] = useState<BuildingSource | null | undefined>(undefined);
  const suggestionAsked = useRef(false);

  const values = useMemo(() => (ring ? orientationsOfSelectedEdges(ring, selected) : []), [ring, selected]);

  const chooseBuilding = useCallback((next: GeoPoint[], isSuggestion: boolean) => {
    setRing(next);
    setSuggested(isSuggestion);
    setSelected(new Set());
    setHoverRing(null);
    setHoverEdge(null);
  }, []);

  const onClick = useCallback((event: MapLayerMouseEvent) => {
    const map = event.target;
    if (ring) {
      const index = nearestEdgeIndex(toScreen(map, ring), event.point);
      if (index === null) return;
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        return next;
      });
      return;
    }
    const next = buildingAt(map, event.point);
    if (next) chooseBuilding(next, false);
  }, [ring, chooseBuilding]);

  const onMouseMove = useCallback((event: MapLayerMouseEvent) => {
    const map = event.target;
    if (ring) {
      setHoverEdge(nearestEdgeIndex(toScreen(map, ring), event.point));
      return;
    }
    const next = buildingAt(map, event.point);
    setHoverRing((prev) => (ringKey(prev) === ringKey(next) ? prev : next));
  }, [ring]);

  const onMouseLeave = useCallback(() => {
    setHoverEdge(null);
    setHoverRing(null);
  }, []);

  const onStyleData = useCallback((event: MapEvent) => {
    const next = buildingSourceOf(event.target);
    setBuildingSource((prev) => (sameSource(prev, next) ? prev : next));
  }, []);

  /** Μία φορά ανά άνοιγμα, όταν φορτώσουν τα πλακίδια — και ποτέ πάνω από επιλογή που έκανε ήδη ο άνθρωπος. */
  const onIdle = useCallback((event: MapEvent) => {
    if (suggestionAsked.current) return;
    suggestionAsked.current = true;
    if (ring !== null) return;
    const next = suggestBuilding(event.target, center);
    if (next) chooseBuilding(next, true);
  }, [center, ring, chooseBuilding]);

  const changeBuilding = useCallback(() => {
    setRing(null);
    setSuggested(false);
    setSelected(new Set());
    setHoverEdge(null);
  }, []);

  const reset = useCallback(() => {
    changeBuilding();
    setHoverRing(null);
    setBuildingSource(undefined);
    suggestionAsked.current = false;
  }, [changeBuilding]);

  const cursor = (ring ? hoverEdge !== null : hoverRing !== null) ? 'pointer' : 'default';

  return {
    ring, suggested, selected, hoverEdge, hoverRing, buildingSource, values, cursor,
    onClick, onMouseMove, onMouseLeave, onStyleData, onIdle, changeBuilding, reset,
  };
}
