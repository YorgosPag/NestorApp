'use client';

/**
 * @fileoverview **ΠΡΟΣΑΝΑΤΟΛΙΣΜΟΣ ΑΠΟ ΤΟΝ ΧΑΡΤΗ** — ο άνθρωπος πατά το κτίριο, μετά τις πλευρές του με ανοίγματα, και οι
 * όψεις βγαίνουν μόνες τους με τον **αληθινό** Βορρά (ADR-937 Φάση Γ). Για ακίνητα χωρίς κάτοψη.
 * @related lib/property/orientation-from-map (ο υπολογισμός) · lib/maps/maplibre (το σύνορο του χάρτη, CHECK 3.75) ·
 *   lib/maps/use-default-basemap (το στυλ — έχει τη στρώση `buildings` των διανυσματικών πλακιδίων) ·
 *   ./orientation-map/useOrientationMapPick (η αλληλεπίδραση) · ./orientation-map/orientation-map-layers (οι στρώσεις)
 * @module components/properties/shared/OrientationFromMapDialog
 *
 * 🔑 **Δεν είναι μαντεψιά του συστήματος**: τις πλευρές τις διαλέγει ο ίδιος ο άνθρωπος, ο χάρτης απλώς μεταφράζει «αυτή
 *    η πλευρά» σε «Νοτιοδυτικό». Γι' αυτό η «Εφαρμογή» γράφει κατευθείαν στη **φόρμα** (που ο άνθρωπος αποθηκεύει) και όχι
 *    σε πρόταση. Το κτίριο στη θέση **προτείνεται** τονισμένο· το «Άλλο κτίριο» το αλλάζει ρητά.
 * ⚠️ Το περίγραμμα OSM δεν αποθηκεύεται (ODbL) — μόνο οι κατευθύνσεις.
 */

import React, { useCallback } from 'react';
import type { TFunction } from 'i18next';

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
import { Layer, Map, Source } from '@/lib/maps/maplibre';
import { useDefaultBasemap } from '@/lib/maps/use-default-basemap';
import type { GeoPoint } from '@/types/geo/coordinates';

import {
  BUILDING_ZOOM,
  EDGE_LINE_LAYER,
  EDGE_SOURCE,
  HOVER_OUTLINE_LAYER,
  HOVER_SOURCE,
  buildingOutlineLayer,
  edgesGeoJson,
  ringGeoJson,
} from './orientation-map/orientation-map-layers';
import { useOrientationMapPick, type OrientationMapPick } from './orientation-map/useOrientationMapPick';

export interface OrientationFromMapDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly center: GeoPoint;
  readonly onApply: (values: readonly OrientationType[]) => void;
  /** Το `t` του namespace `properties-enums`. */
  readonly t: TFunction;
}

type HintKey =
  | 'orientation.map.noBuildings'
  | 'orientation.map.pickBuilding'
  | 'orientation.map.suggested'
  | 'orientation.map.pickEdges';

function hintKey(pick: OrientationMapPick): HintKey {
  if (pick.buildingSource === null) return 'orientation.map.noBuildings';
  if (pick.ring === null) return 'orientation.map.pickBuilding';
  return pick.suggested ? 'orientation.map.suggested' : 'orientation.map.pickEdges';
}

function OrientationMapLayers({ pick }: { readonly pick: OrientationMapPick }) {
  return (
    <>
      {pick.buildingSource && <Layer {...buildingOutlineLayer(pick.buildingSource)} />}
      {!pick.ring && pick.hoverRing && (
        <Source id={HOVER_SOURCE} type="geojson" data={ringGeoJson(pick.hoverRing)}>
          <Layer {...HOVER_OUTLINE_LAYER} />
        </Source>
      )}
      {pick.ring && (
        <Source id={EDGE_SOURCE} type="geojson" data={edgesGeoJson(pick.ring, pick.selected, pick.hoverEdge)}>
          <Layer {...EDGE_LINE_LAYER} />
        </Source>
      )}
    </>
  );
}

export function OrientationFromMapDialog({ open, onOpenChange, center, onApply, t }: OrientationFromMapDialogProps) {
  const basemap = useDefaultBasemap();
  const pick = useOrientationMapPick(center);
  const { reset, values } = pick;

  const handleOpenChange = useCallback((next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  }, [onOpenChange, reset]);

  const apply = () => {
    onApply(values);
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{t('orientation.map.title')}</DialogTitle>
          <DialogDescription>{t(hintKey(pick))}</DialogDescription>
        </DialogHeader>
        <figure className="relative m-0 h-[60vh] overflow-hidden rounded-lg border border-border">
          <Map
            initialViewState={{ latitude: center.lat, longitude: center.lng, zoom: BUILDING_ZOOM }}
            style={{ width: '100%', height: '100%' }}
            {...basemap}
            onClick={pick.onClick}
            onMouseMove={pick.onMouseMove}
            onMouseOut={pick.onMouseLeave}
            onStyleData={pick.onStyleData}
            onIdle={pick.onIdle}
            cursor={pick.cursor}
          >
            <OrientationMapLayers pick={pick} />
          </Map>
        </figure>
        <p aria-live="polite" className="m-0 text-sm">
          {values.length > 0
            ? t('orientation.map.selected', { names: values.map((o) => t(ORIENTATION_LABELS[o])).join(', ') })
            : t('orientation.map.noneSelected')}
        </p>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pick.ring === null} onClick={pick.changeBuilding}>
            {t('orientation.map.changeBuilding')}
          </Button>
          <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
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
