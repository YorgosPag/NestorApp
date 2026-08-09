'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL — ΔΙΑΒΑΣΕ ADR-040 ΠΡΙΝ ΑΛΛΑΞΕΙΣ
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * `useBasemapPainter` — ο painter του υποβάθρου χάρτη για τη **ζώνη Α** (ADR-732), αδερφός των
 * `useGridUnderlayPainter` / `useFloorplanBackgroundPainter`.
 *
 * ## Τι εγγράφεται και τι όχι
 * Εδώ ζουν **μόνο** εγγραφές χαμηλής συχνότητας: ο διακόπτης/αδιαφάνεια/πάροχος, η
 * διαθεσιμότητα γεωαναφοράς, και η άφιξη πλακιδίων. Το `transform` **δεν** είναι εξάρτηση: το
 * διαβάζει ο μηχανισμός της ζώνης τη στιγμή του καρέ (ADR-040 XXII.B), οπότε το pan/zoom δεν
 * περνά ποτέ από React.
 *
 * ## Γιατί η άφιξη πλακιδίου αλλάζει **ταυτότητα**
 * Ο μηχανισμός της ζώνης ξαναζωγραφίζει όταν αλλάξει η ταυτότητα της λίστας painters, το
 * viewport, ή το transform. Ένα πλακίδιο που φτάνει από το δίκτυο δεν είναι κανένα από τα τρία —
 * χωρίς τον μετρητή, ο χάρτης θα εμφανιζόταν μόνο την **επόμενη φορά που ο χρήστης θα κουνούσε
 * την οθόνη**: βλάβη που μοιάζει με «αργεί ο χάρτης» και θα κυνηγιόταν στο δίκτυο.
 */

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { OverlayDispatchPainter } from './overlay-dispatch/overlay-dispatch-frame';
import { visibleDisplayRect } from '../../rendering/core/visible-display-rect';
import { unprojectDisplayPoint } from '../../systems/topography/topo-display-frame';
import {
  getBasemapAvailability,
  subscribeBasemapAvailability,
} from '../../systems/basemap/basemap-availability';
import { getBasemapState, subscribeBasemap } from '../../systems/basemap/basemap-store';
import { getBasemapDisplayProjector, worldMmToGeographic } from '../../systems/basemap/basemap-projection';
import { resolveBasemapSource } from '../../systems/basemap/basemap-source';
import { chooseZoomLevel, tilesForDisplayRect } from '../../systems/basemap/basemap-tile-model';
import { paintBasemap } from '../../systems/basemap/basemap-painter';
import { subscribeTileReady } from '../../systems/basemap/basemap-tile-cache';

/** Πυκνότητα οθόνης, με ασφαλή τιμή εκτός browser (δοκιμές σε jsdom/node). */
function devicePixelRatio(): number {
  return typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
}

/**
 * Ο painter, ή `null` όταν δεν υπάρχει τίποτα να ζωγραφιστεί.
 *
 * Το `null` είναι **ολόκληρη** η δήλωση περιεχομένου που χρειάζεται η πύλη του ADR-726 Φ2: με
 * σβηστό υπόβαθρο ο κοινός καμβάς της ζώνης δεν πληρώνει ούτε καθαρισμό.
 */
export function useBasemapPainter(): OverlayDispatchPainter | null {
  const state = useSyncExternalStore(subscribeBasemap, getBasemapState, getBasemapState);
  const availability = useSyncExternalStore(
    subscribeBasemapAvailability,
    getBasemapAvailability,
    getBasemapAvailability,
  );

  const [tileTick, setTileTick] = useState(0);
  useEffect(() => subscribeTileReady(() => setTileTick((tick) => tick + 1)), []);

  return useMemo<OverlayDispatchPainter | null>(() => {
    // «Δεν ξέρω πού είσαι» ⇒ κανένας χάρτης. Δες `basemap-availability` για το γιατί μια
    // ζωγραφική εδώ θα έδειχνε Ατλαντικό κάτω από το κτίριο.
    if (!state.enabled || availability === 'unknown' || state.opacity <= 0) return null;
    const source = resolveBasemapSource(state.sourceId);

    return (ctx, transform, viewport) => {
      const projector = getBasemapDisplayProjector();
      const rect = visibleDisplayRect(transform, viewport);
      const centreDisplay = { x: (rect.minX + rect.maxX) / 2, y: (rect.minY + rect.maxY) / 2 };
      const centreWorld = unprojectDisplayPoint(centreDisplay, projector);
      const { lat } = worldMmToGeographic(centreWorld.x, centreWorld.y);

      const zoom = chooseZoomLevel({
        pixelsPerMm: transform.scale,
        devicePixelRatio: devicePixelRatio(),
        latitude: lat,
        source,
      });
      const selection = tilesForDisplayRect(rect, zoom, projector);
      paintBasemap(ctx, transform, viewport, {
        source,
        tiles: selection.tiles,
        projector,
        opacity: state.opacity,
      });
    };
    // `tileTick` είναι εξάρτηση **σκοπίμως**: αλλάζει την ταυτότητα του painter ώστε η ζώνη να
    // ξαναζωγραφίσει μόλις φτάσει πλακίδιο. Δες την επικεφαλίδα.
  }, [state.enabled, state.opacity, state.sourceId, availability, tileTick]);
}
