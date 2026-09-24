'use client';

/**
 * @fileoverview **Ο κρυφός χάρτης** — ΕΝΑ WebGL context που ζωγραφίζει τις κάρτες μία-μία.
 * @related ADR-777 §8.70 (Φάση 2) · lib/maps/capture-map-snapshot · search-results/ResultsMapSources
 * @module components/listing-map-snapshot/ListingMapSnapshotStage
 *
 * 🔑 **Ό,τι βλέπει ο κόσμος, κυριολεκτικά.** Το υπόβαθρο είναι το {@link INITIAL_MAP_STYLE} του
 * δημόσιου χάρτη και τα σχήματα ζωγραφίζονται από τα **ίδια** `ResultsMapSources` πάνω στο feature
 * του **ίδιου** `listingFeature`. Δεν υπάρχει δεύτερος ζωγράφος που να μπορεί να αποκλίνει: αν
 * αλλάξει η «σκιασμένη πόλη» στον δημόσιο χάρτη, αλλάζει και εδώ.
 *
 * ⚠️ Φορτώνεται **δυναμικά** (`next/dynamic`, χωρίς SSR) από τον provider, και **μόνο** όταν
 * κάποια κάρτα ζητήσει στιγμιότυπο: ένας κάτοχος που έχει παντού φωτογραφίες δεν κατεβάζει ποτέ
 * τη MapLibre.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';

import { Map, type MapRef } from '@/lib/maps/maplibre';
import { captureMapSnapshot } from '@/lib/maps/capture-map-snapshot';
import { listingSnapshotCamera } from '@/lib/maps/map-snapshot-camera';
import type { MapSnapshotJob } from '@/lib/maps/map-snapshot-store';
import { listingFeature, splitListingGeometry } from '@/lib/listings/listings-geojson';
import { NO_LISTING_FOCUS } from '@/lib/listings/listing-focus';
import { ResultsMapSources } from '@/components/search-results/ResultsMapSources';
import { readListingMapPaint } from '@/components/search-results/listing-map-paint';
import { getAllMapStyleUrls, INITIAL_MAP_STYLE } from '@/subapps/geo-canvas/services/map/MapStyleManager';

import { SNAPSHOT_VIEWPORT, STAGE_FRAME } from './snapshot-frame';
import type { ListingSnapshotPayload, ListingSnapshotStore } from './use-listing-map-snapshot';

/**
 * Πυκνότητα pixel της λήψης. Με κουτί 360×240 (§8.80) το 2× δίνει 720×480 pixel — ευκρινές στην
 * κάρτα αποτελεσμάτων (~23rem) σε οθόνη 2× και στην κάρτα κατόχου (176px) ακόμη και σε 3×. Το
 * παλιό 3× υπήρχε επειδή το κουτί ήταν 176px· με το διπλάσιο κουτί θα ήταν 2,25× τα bytes για
 * καμία ορατή διαφορά.
 */
const SNAPSHOT_PIXEL_RATIO = 2;

const SNAPSHOT_FEATURE_ID = 'owner-listing-snapshot';
const INITIAL_VIEW = { longitude: 23.7275, latitude: 37.9755, zoom: 6 } as const;
const CANVAS_ATTRIBUTES = { preserveDrawingBuffer: true, antialias: true } as const;

interface ListingMapSnapshotStageProps {
  readonly store: ListingSnapshotStore;
}

function useNextJob(store: ListingSnapshotStore, ready: boolean) {
  const [job, setJob] = useState<MapSnapshotJob<ListingSnapshotPayload> | null>(null);

  useEffect(() => {
    if (!ready || job !== null) return undefined;
    const pull = (): void => {
      const next = store.takeNext();
      if (next !== null) setJob(next);
    };
    pull();
    return store.subscribe(pull);
  }, [store, ready, job]);

  return [job, setJob] as const;
}

export default function ListingMapSnapshotStage({ store }: ListingMapSnapshotStageProps): React.ReactElement {
  const mapRef = useRef<MapRef>(null);
  const [loaded, setLoaded] = useState(false);
  const [job, setJob] = useNextJob(store, loaded);
  const mapStyle = useMemo(() => getAllMapStyleUrls()[INITIAL_MAP_STYLE], []);
  const idlePaint = useMemo(() => readListingMapPaint(), []);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || job === null) return undefined;
    const camera = listingSnapshotCamera(job.payload.mark, SNAPSHOT_VIEWPORT);
    return captureMapSnapshot(map, camera, (result) => {
      store.settle(job.key, result);
      setJob(null);
    });
  }, [job, store, setJob]);

  const geometry = useMemo(
    () =>
      splitListingGeometry({
        type: 'FeatureCollection',
        features: job === null ? [] : [listingFeature(SNAPSHOT_FEATURE_ID, '', job.payload.mark)],
      }),
    [job],
  );
  const paint = job?.payload.paint ?? idlePaint;

  return (
    <div aria-hidden inert className={`pointer-events-none fixed -left-[10000px] top-0 ${STAGE_FRAME}`}>
      <Map
        ref={mapRef}
        mapStyle={mapStyle}
        initialViewState={INITIAL_VIEW}
        interactive={false}
        attributionControl={false}
        fadeDuration={0}
        pixelRatio={SNAPSHOT_PIXEL_RATIO}
        canvasContextAttributes={CANVAS_ATTRIBUTES}
        onLoad={() => setLoaded(true)}
      >
        <ResultsMapSources geometry={geometry} mark={paint.mark} surface={paint.surface} focus={NO_LISTING_FOCUS} />
      </Map>
    </div>
  );
}
