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
 *
 * 🔑 **ADR-890 §15 — δύο τρόποι στη σελίδα Δήμου**: «Τιμές ανά Δ.Ε.» (ο χάρτης σύγκρισης, προεπιλογή) ή «Ζώνες». Οι ζώνες
 * φορτώνονται **μόνο** όταν επιλεγούν — πριν, κατέβαιναν πάντα ανακατεμένες για όλες τις Δ.Ε. (36 KB στη Θεσσαλονίκη).
 * Χωρίς χάρτη σύγκρισης (Δ.Ε., Δήμος με μία Δ.Ε.) ο χάρτης είναι ό,τι ήταν: όριο + ζώνες.
 */

import React, { useCallback, useMemo, useState, type ReactNode } from 'react';

import { PlaceMap } from '@/components/geo/PlaceMap';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import { useAdminBoundary } from '@/hooks/geo/useAdminBoundary';
import { useValueZoneLayer, type ValueZoneLayerState } from '@/hooks/market/useValueZoneLayer';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { valueZonePriceClasses } from '@/lib/market/value-zone-classes';
import type { CameraFrame } from '@/types/geo/camera-frame';

import { AREA_MAP_MODES, type AreaMapMode } from './area-children-view';
import { AreaValueZoneLayer, type ValueZoneSelection } from './AreaValueZoneLayer';
import { AreaValueZonePanel } from './AreaValueZonePanel';
import { readClassColors } from './value-zone-paint';

const NS = 'area-market';
const MAP_HEIGHT_CLASS = 'h-72 md:h-80';

/** Ο χάρτης σύγκρισης των παιδιών (ADR-890 §15 · §16): η στρώση (παιδί του χάρτη, `null` όσο φορτώνει) και οι λέξεις της. */
export interface AreaPriceMapSlot {
  readonly layer: ReactNode | null;
  readonly panel: ReactNode;
  /** Το όνομα του τρόπου «τιμές» για τη βαθμίδα της σελίδας («Τιμές ανά Δημοτική Ενότητα»). */
  readonly label: string;
}

interface AreaBoundaryMapProps {
  readonly areaId: string;
  /** Από τον server (`AreaMarketPageData.valueZoneFiles`): `null` = άγνωστο · `[]` = καμία ζώνη. */
  readonly valueZoneFiles: readonly string[] | null;
  /** `null` = η σελίδα δεν έχει χάρτη σύγκρισης ⇒ μόνο ζώνες, χωρίς επιλογή τρόπου. */
  readonly prices: AreaPriceMapSlot | null;
  readonly mode: AreaMapMode;
  readonly onModeChange: (mode: AreaMapMode) => void;
}

function ModeControl({ mode, onModeChange, pricesLabel }: Pick<AreaBoundaryMapProps, 'mode' | 'onModeChange'> & { readonly pricesLabel: string }) {
  const { t } = useTranslation([NS]);
  const labels: Readonly<Record<AreaMapMode, string>> = { prices: pricesLabel, zones: t(`${NS}:map.mode.zones`) };
  return (
    <SegmentedControl value={mode} onValueChange={onModeChange} aria-label={t(`${NS}:map.mode.label`)}>
      {AREA_MAP_MODES.map((item) => (
        <SegmentedControlItem key={item} value={item}>{labels[item]}</SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
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

/** Η στρώση ζωνών και η κατάστασή της (ορατή · επιλογή) — `null` αρχεία = τίποτα δεν κατεβαίνει. */
function useZones(files: readonly string[] | null) {
  const zones = useValueZoneLayer(files);
  const { classes, colors } = useZonePaint(zones);
  const [zonesVisible, setZonesVisible] = useState(true);
  const [selection, setSelection] = useState<ValueZoneSelection | null>(null);
  const handleSelect = useCallback((next: ValueZoneSelection | null) => setSelection(next), []);
  return { zones, classes, colors, zonesVisible, setZonesVisible, selection, handleSelect };
}

/** Φορτώνει ή δεν είναι διαθέσιμο — **ίδιο ύψος** με τον χάρτη, ώστε η σελίδα να μη μετακινείται (CLS). */
function MapPending({ unavailable }: { readonly unavailable: boolean }) {
  const { t } = useTranslation([NS]);
  return (
    <p
      role={unavailable ? 'alert' : 'status'}
      className={`m-0 flex ${MAP_HEIGHT_CLASS} items-center justify-center rounded-lg border border-border bg-muted text-sm text-muted-foreground`}
    >
      {t(unavailable ? `${NS}:map.unavailable` : `${NS}:map.loading`)}
    </p>
  );
}

export function AreaBoundaryMap({ areaId, valueZoneFiles, prices, mode, onModeChange }: AreaBoundaryMapProps) {
  const state = useAdminBoundary(areaId);
  const showPrices = prices !== null && mode === 'prices';
  const { zones, classes, colors, zonesVisible, setZonesVisible, selection, handleSelect } = useZones(showPrices ? null : valueZoneFiles);
  const region = state.status === 'ready' ? state.boundary.region : null;
  const fit = useMemo<CameraFrame | null>(() => (region === null ? null : { kind: 'extent', extent: region.bbox }), [region]);

  if (region === null) return <MapPending unavailable={state.status === 'unavailable'} />;

  const showZones = !showPrices && zonesVisible && zones.status === 'ready';
  const { south, west, north, east } = region.bbox;
  return (
    <section className="flex flex-col gap-3">
      {prices !== null && valueZoneFiles?.length !== 0 && <ModeControl mode={mode} onModeChange={onModeChange} pricesLabel={prices.label} />}
      <PlaceMap
        center={{ lat: (south + north) / 2, lng: (west + east) / 2 }}
        shapes={region.rings}
        shapeFill={!showZones && !showPrices}
        fit={fit}
        heightClass={MAP_HEIGHT_CLASS}
      >
        {showPrices && prices.layer}
        {showZones && <AreaValueZoneLayer layer={zones.layer} classes={classes} colors={colors} onSelect={handleSelect} />}
      </PlaceMap>
      {showPrices ? (
        prices.panel
      ) : (
        <AreaValueZonePanel
          status={zones.status}
          visible={zonesVisible}
          onVisibleChange={setZonesVisible}
          classes={classes}
          selection={selection}
        />
      )}
    </section>
  );
}
