'use client';

/**
 * **Το όριο της περιοχής στον χάρτη** — τα ΙΔΙΑ αρχεία ορίων με την αναζήτηση (ADR-883), μέσω του ίδιου
 * φορτωτή (`useAdminBoundary`) και του ίδιου χάρτη (`PlaceMap`, σχήματα + καρέ `fit`).
 *
 * 🔑 **Τρεις καταστάσεις, ποτέ κενό κουτί**: φορτώνει · έτοιμο · μη διαθέσιμο (λέγεται). Το ύψος είναι σταθερό
 * σε όλες, ώστε η σελίδα να μη μετακινείται όταν φτάσει το όριο (CLS).
 *
 * 🔑 **ADR-889 Φ5 — ζώνες αντικειμενικών αξιών** πάνω στον ίδιο χάρτη (`AreaValueZoneLayer`, ως παιδί του `PlaceMap`),
 * με το υπόμνημα και την επιλογή σε κείμενο από κάτω (`AreaValueZonePanel`). Ορατές από προεπιλογή· όταν φαίνονται,
 * το όριο χάνει το μπλε γέμισμά του, που θα διαβαζόταν ως η πρώτη κλάση της κλίμακας.
 */

import React, { useCallback, useMemo, useState } from 'react';

import { PlaceMap } from '@/components/geo/PlaceMap';
import { useAdminBoundary } from '@/hooks/geo/useAdminBoundary';
import { useValueZoneLayer, type ValueZoneLayerState } from '@/hooks/market/useValueZoneLayer';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { valueZonePriceClasses } from '@/lib/market/value-zone-classes';
import type { CameraFrame } from '@/types/geo/camera-frame';

import { AreaValueZoneLayer, type ValueZoneSelection } from './AreaValueZoneLayer';
import { AreaValueZonePanel } from './AreaValueZonePanel';
import { readClassColors } from './value-zone-paint';

const NS = 'area-market';
const MAP_HEIGHT_CLASS = 'h-72 md:h-80';

interface AreaBoundaryMapProps {
  readonly areaId: string;
  /** Από τον server (`AreaMarketPageData.valueZoneFiles`): `null` = άγνωστο · `[]` = καμία ζώνη. */
  readonly valueZoneFiles: readonly string[] | null;
}

/** Κλάσεις και χρώματα της στρώσης — από τις τιμές **όλων** των ζωνών και των μετώπων της περιοχής. */
function useZonePaint(state: ValueZoneLayerState) {
  return useMemo(() => {
    if (state.status !== 'ready') return { classes: [], colors: [] };
    const prices = [...state.layer.zones, ...state.layer.fronts].map((zone) => zone.price);
    const classes = valueZonePriceClasses(prices);
    return { classes, colors: readClassColors(classes) };
  }, [state]);
}

export function AreaBoundaryMap({ areaId, valueZoneFiles }: AreaBoundaryMapProps) {
  const { t } = useTranslation([NS]);
  const state = useAdminBoundary(areaId);
  const zones = useValueZoneLayer(valueZoneFiles);
  const { classes, colors } = useZonePaint(zones);
  const [zonesVisible, setZonesVisible] = useState(true);
  const [selection, setSelection] = useState<ValueZoneSelection | null>(null);
  const handleSelect = useCallback((next: ValueZoneSelection | null) => setSelection(next), []);
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

  const showZones = zonesVisible && zones.status === 'ready';
  const { south, west, north, east } = region.bbox;
  return (
    <section className="flex flex-col gap-3">
      <PlaceMap
        center={{ lat: (south + north) / 2, lng: (west + east) / 2 }}
        shapes={region.rings}
        shapeFill={!showZones}
        fit={fit}
        heightClass={MAP_HEIGHT_CLASS}
      >
        {showZones && <AreaValueZoneLayer layer={zones.layer} classes={classes} colors={colors} onSelect={handleSelect} />}
      </PlaceMap>
      <AreaValueZonePanel
        status={zones.status}
        visible={zonesVisible}
        onVisibleChange={setZonesVisible}
        classes={classes}
        selection={selection}
      />
    </section>
  );
}
