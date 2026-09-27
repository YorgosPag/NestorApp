'use client';

/**
 * @fileoverview **Ο ΚΥΚΛΟΣ ΖΩΗΣ ΤΗΣ ΡΟΗΣ ΠΛΑΚΙΔΙΩΝ** — ένας streamer ανά μηχανή, `dispose` στην αποπροσάρτηση· και η
 * προφόρτωση της βάσης των γειτόνων όταν ο επισκέπτης φτάσει κάπου (ADR-884 Φ2ε · §4.11).
 * @related `tour-tile-streamer.ts` · `useTourPanoramaEngine.ts` (ίδιο σχήμα κατόχου) · `TourPanoramaStage.tsx` (ο κάτοχος)
 * @module components/spatial-tour/viewer/useTourTileStreamer
 *
 * 🔑 **Ένας κάτοχος**: ο streamer ανήκει σε αυτό το hook· η πλοήγηση μόνο τον **κατευθύνει** (`focus`), δεν τον γεννά.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { TourViewerGraph, ViewerNeighbour, ViewerStop } from '@/lib/spatial-tour/viewer/tour-viewer-graph';
import type { TourManifestStop } from '@/lib/spatial-tour/tour-manifest-stop';

import type { TourCameraStore } from './tour-camera-store';
import type { TourPanoramaEngine } from './tour-panorama-engine';
import type { TourPanoramaSource } from './tour-panorama-source';
import { createTourTileStreamer, type TourTileStreamer } from './tour-tile-streamer';
import { arrivalFrameOf } from './useTourNavigation';

/** Ό,τι χρειάζεται η πλοήγηση — έτοιμο μόνο όταν υπάρχουν ΚΑΙ η μηχανή ΚΑΙ ο streamer. */
export interface TourStreamingContext {
  readonly engine: TourPanoramaEngine;
  readonly camera: TourCameraStore;
  readonly source: TourPanoramaSource;
  readonly streamer: TourTileStreamer;
}

export function useTourTileStreamer(
  engine: TourPanoramaEngine | null,
  camera: TourCameraStore,
  source: TourPanoramaSource,
): { readonly streamer: TourTileStreamer | null; readonly ctx: TourStreamingContext | null } {
  const [streamer, setStreamer] = useState<TourTileStreamer | null>(null);
  useEffect(() => {
    if (engine === null) return;
    const created = createTourTileStreamer({ engine, camera, source });
    setStreamer(created);
    return () => {
      created.dispose();
      setStreamer(null);
    };
  }, [engine, camera, source]);
  const ctx = useMemo(
    () => (engine === null || streamer === null ? null : { engine, camera, source, streamer }),
    [engine, camera, source, streamer],
  );
  return { streamer, ctx };
}

/**
 * Φτάνοντας σε σημείο: η **βάση** κάθε γείτονα (ένα αίτημα η καθεμία) μπαίνει στην κρυφή μνήμη — η επόμενη μετάβαση
 * ξεκινά με εικόνα, χωρίς να περιμένει δίκτυο.
 */
export function usePrefetchNeighbourBases(
  streamer: TourTileStreamer | null,
  graph: TourViewerGraph,
  neighbours: readonly ViewerNeighbour[],
  arrived: boolean,
): void {
  useEffect(() => {
    if (streamer === null || !arrived) return;
    const stops = neighbours
      .map((n) => graph.stops.get(n.nodeId)?.stop)
      .filter((stop): stop is TourManifestStop => stop !== undefined);
    streamer.prefetchBase(stops);
  }, [streamer, graph, neighbours, arrived]);
}

/**
 * **Πρόθεση ⇒ προφόρτωση**: για κάθε βελάκι, ένας χειριστής που ζητά τα πλακίδια της **θέασης άφιξης** στον γείτονα —
 * ίδιο σχέδιο με τη μετάβαση (`arrivalFrameOf`), άρα ακριβώς ό,τι θα φανεί.
 */
export function useArrivalPrefetch(
  streamer: TourTileStreamer | null,
  graph: TourViewerGraph,
  current: ViewerStop | undefined,
  camera: TourCameraStore,
): (nodeId: string) => () => void {
  return useCallback((nodeId: string) => () => {
    const to = graph.stops.get(nodeId);
    if (streamer !== null && current !== undefined && to !== undefined) streamer.prefetch(to.stop, arrivalFrameOf(camera, current, to));
  }, [streamer, graph, current, camera]);
}
