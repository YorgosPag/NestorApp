'use client';

/**
 * @fileoverview **ΠΡΟΣΑΝΑΤΟΛΙΣΜΟΣ ΑΠΟ ΤΟΝ ΧΑΡΤΗ** — ο άνθρωπος πατά το κτίριο, μετά τις πλευρές του με ανοίγματα, και οι
 * όψεις βγαίνουν μόνες τους με τον **αληθινό** Βορρά (ADR-937 Φάση Γ). Για ακίνητα χωρίς κάτοψη.
 * @related lib/property/orientation-from-map (ο υπολογισμός) · lib/maps/maplibre (το σύνορο του χάρτη, CHECK 3.75) ·
 *   lib/maps/use-default-basemap (το στυλ — έχει τη στρώση `buildings` των διανυσματικών πλακιδίων)
 * @module components/properties/shared/OrientationFromMapDialog
 *
 * 🔑 **Δεν είναι μαντεψιά του συστήματος**: τις πλευρές τις διαλέγει ο ίδιος ο άνθρωπος, ο χάρτης απλώς μεταφράζει «αυτή
 *    η πλευρά» σε «Νοτιοδυτικό». Γι' αυτό η «Εφαρμογή» γράφει κατευθείαν στη **φόρμα** (που ο άνθρωπος αποθηκεύει) και όχι
 *    σε πρόταση.
 * ⚠️ Το περίγραμμα OSM δεν αποθηκεύεται (ODbL) — μόνο οι κατευθύνσεις.
 */

import React, { useCallback, useMemo, useState } from 'react';
import type { TFunction } from 'i18next';
import type { FeatureCollection, LineString } from 'geojson';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ORIENTATION_LABELS, type OrientationType } from '@/constants/property-features-enterprise';
import { Layer, Map, Source, type LayerProps, type MapLayerMouseEvent } from '@/lib/maps/maplibre';
import { useDefaultBasemap } from '@/lib/maps/use-default-basemap';
import { buildingRingOf, orientationsOfSelectedEdges } from '@/lib/property/orientation-from-map';
import type { GeoPoint } from '@/types/geo/coordinates';

/** Η στρώση κτιρίων του στυλ Protomaps (`@protomaps/basemaps`). Στον εφεδρικό χάρτη δεν υπάρχει — τότε το κλικ δεν κάνει τίποτα. */
const BUILDINGS_LAYER = 'buildings';
const EDGE_SOURCE = 'orientation-edges';
const EDGE_LAYER = 'orientation-edges-line';
const BUILDING_ZOOM = 18;

/* eslint-disable design-system/no-hardcoded-colors -- Το MapLibre δέχεται ΜΟΝΟ literal χρώματα στο `paint`: δεν αποτιμά
   CSS custom properties (ίδια δήλωση με το `components/geo/PlaceMap.tsx`). */
const EDGE_LINE: LayerProps = {
  id: EDGE_LAYER,
  type: 'line',
  source: EDGE_SOURCE,
  paint: {
    'line-color': ['case', ['==', ['get', 'selected'], 1], '#d97706', '#2563eb'],
    'line-width': ['case', ['==', ['get', 'selected'], 1], 7, 4],
  },
};
/* eslint-enable design-system/no-hardcoded-colors */

function edgesGeoJson(ring: readonly GeoPoint[], selected: ReadonlySet<number>): FeatureCollection<LineString> {
  return {
    type: 'FeatureCollection',
    features: ring.map((a, i) => {
      const b = ring[(i + 1) % ring.length];
      return {
        type: 'Feature',
        properties: { index: i, selected: selected.has(i) ? 1 : 0 },
        geometry: { type: 'LineString', coordinates: [[a.lng, a.lat], [b.lng, b.lat]] },
      };
    }),
  };
}

export interface OrientationFromMapDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly center: GeoPoint;
  readonly onApply: (values: readonly OrientationType[]) => void;
  /** Το `t` του namespace `properties-enums`. */
  readonly t: TFunction;
}

export function OrientationFromMapDialog({ open, onOpenChange, center, onApply, t }: OrientationFromMapDialogProps) {
  const basemap = useDefaultBasemap();
  const [ring, setRing] = useState<GeoPoint[] | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());

  const values = useMemo(() => (ring ? orientationsOfSelectedEdges(ring, selected) : []), [ring, selected]);

  const handleClick = useCallback((event: MapLayerMouseEvent) => {
    const edge = event.features?.find((f) => f.layer.id === EDGE_LAYER);
    const index = Number(edge?.properties?.index);
    if (edge && Number.isInteger(index)) {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        return next;
      });
      return;
    }
    const map = event.target;
    if (!map.getLayer(BUILDINGS_LAYER)) return;
    const building = map.queryRenderedFeatures(event.point, { layers: [BUILDINGS_LAYER] })[0];
    const next = building ? buildingRingOf(building.geometry) : null;
    if (next) {
      setRing(next);
      setSelected(new Set());
    }
  }, []);

  const apply = () => {
    onApply(values);
    onOpenChange(false);
  };

  const hint = ring === null ? t('orientation.map.pickBuilding') : t('orientation.map.pickEdges');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{t('orientation.map.title')}</DialogTitle>
          <DialogDescription>{hint}</DialogDescription>
        </DialogHeader>
        <figure className="relative m-0 h-[60vh] overflow-hidden rounded-lg border border-border">
          <Map
            initialViewState={{ latitude: center.lat, longitude: center.lng, zoom: BUILDING_ZOOM }}
            style={{ width: '100%', height: '100%' }}
            {...basemap}
            interactiveLayerIds={ring ? [EDGE_LAYER] : []}
            onClick={handleClick}
            cursor="pointer"
          >
            {ring && (
              <Source id={EDGE_SOURCE} type="geojson" data={edgesGeoJson(ring, selected)}>
                <Layer {...EDGE_LINE} />
              </Source>
            )}
          </Map>
        </figure>
        <p aria-live="polite" className="m-0 text-sm">
          {values.length > 0
            ? t('orientation.map.selected', { names: values.map((o) => t(ORIENTATION_LABELS[o])).join(', ') })
            : t('orientation.map.noneSelected')}
        </p>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t('orientation.map.cancel')}
          </Button>
          <Button type="button" disabled={values.length === 0} onClick={apply}>
            {t('orientation.map.apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
