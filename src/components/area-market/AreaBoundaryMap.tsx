'use client';

/**
 * **Το όριο της περιοχής στον χάρτη** — τα ΙΔΙΑ αρχεία ορίων με την αναζήτηση (ADR-883), μέσω του ίδιου
 * φορτωτή (`useAdminBoundary`) και του ίδιου χάρτη (`PlaceMap`, σχήματα + καρέ `fit`).
 *
 * 🔑 **Τρεις καταστάσεις, ποτέ κενό κουτί**: φορτώνει · έτοιμο · μη διαθέσιμο (λέγεται). Το ύψος είναι σταθερό
 * σε όλες, ώστε η σελίδα να μη μετακινείται όταν φτάσει το όριο (CLS).
 */

import React, { useMemo } from 'react';

import { PlaceMap } from '@/components/geo/PlaceMap';
import { useAdminBoundary } from '@/hooks/geo/useAdminBoundary';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { CameraFrame } from '@/types/geo/camera-frame';

const NS = 'area-market';
const MAP_HEIGHT_CLASS = 'h-72 md:h-80';

interface AreaBoundaryMapProps {
  readonly areaId: string;
}

export function AreaBoundaryMap({ areaId }: AreaBoundaryMapProps) {
  const { t } = useTranslation([NS]);
  const state = useAdminBoundary(areaId);
  const region = state.status === 'ready' ? state.boundary.region : null;
  const fit = useMemo<CameraFrame | null>(() => (region === null ? null : { kind: 'extent', extent: region.bbox }), [region]);

  if (region === null) {
    return (
      <p
        role={state.status === 'unavailable' ? 'alert' : 'status'}
        className={`m-0 flex ${MAP_HEIGHT_CLASS} items-center justify-center rounded-lg border border-border bg-muted text-sm text-muted-foreground`}
      >
        {t(state.status === 'unavailable' ? `${NS}:map.unavailable` : `${NS}:map.loading`)}
      </p>
    );
  }

  const { south, west, north, east } = region.bbox;
  return (
    <PlaceMap
      center={{ lat: (south + north) / 2, lng: (west + east) / 2 }}
      shapes={region.rings}
      fit={fit}
      heightClass={MAP_HEIGHT_CLASS}
    />
  );
}
