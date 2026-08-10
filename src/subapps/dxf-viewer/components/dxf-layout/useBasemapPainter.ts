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
 * διαθεσιμότητα γεωαναφοράς, η επιφάνεια απόδοσης και η άφιξη πλακιδίων. Το `transform` **δεν**
 * είναι εξάρτηση: το διαβάζει ο μηχανισμός της ζώνης τη στιγμή του καρέ (ADR-040 XXII.B), οπότε
 * το pan/zoom δεν περνά ποτέ από React.
 *
 * 🔑 **Οι τέσσερις πηγές δεν απαριθμούνται ΕΔΩ** (ADR-782 §17). Ζουν μία φορά, στο
 * `basemap-invalidation.ts`, γιατί ο **ίδιος** κατάλογος χρειάζεται και στο 3Δ
 * (`BasemapGroundLayer`) — και όσο ήταν γραμμένος μόνο εδώ, το 3Δ άκουγε **μηδέν** από τις
 * τέσσερις. Δύο αντίγραφα του «τι αλλάζει την απόφαση» είναι το ίδιο σχήμα που έλυσε το
 * `basemap-paint-decision.ts` για το «ποια είναι η απόφαση».
 *
 * ## Γιατί μια αλλαγή εισόδου αλλάζει **ταυτότητα** του painter
 * Ο μηχανισμός της ζώνης ξαναζωγραφίζει όταν αλλάξει η ταυτότητα της λίστας painters, το
 * viewport, ή το transform. Ένα πλακίδιο που φτάνει από το δίκτυο δεν είναι κανένα από τα τρία —
 * χωρίς τον μετρητή, ο χάρτης θα εμφανιζόταν μόνο την **επόμενη φορά που ο χρήστης θα κουνούσε
 * την οθόνη**: βλάβη που μοιάζει με «αργεί ο χάρτης» και θα κυνηγιόταν στο δίκτυο.
 */

import { useMemo, useSyncExternalStore } from 'react';
import type { OverlayDispatchPainter } from './overlay-dispatch/overlay-dispatch-frame';
import { visibleDisplayRect } from '../../rendering/core/visible-display-rect';
import { unprojectDisplayPoint } from '../../systems/topography/topo-display-frame';
import {
  getBasemapPaintVersion,
  subscribeBasemapPaint,
} from '../../systems/basemap/basemap-invalidation';
import { resolveBasemapPaint } from '../../systems/basemap/basemap-paint-decision';
import { getBasemapDisplayProjector } from '../../systems/basemap/basemap-frame';
import { worldMmToGeographic } from '../../systems/basemap/basemap-projection';
import { chooseZoomLevel, tilesForDisplayRect } from '../../systems/basemap/basemap-tile-model';
import { paintBasemap } from '../../systems/basemap/basemap-painter';

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
  /**
   * Μία εγγραφή για **όλες** τις εισόδους. Οι επιμέρους τιμές δεν διαβάζονταν ποτέ εδώ — ήταν
   * σήματα ακύρωσης μεταμφιεσμένα σε κατάσταση· ο μετρητής το λέει ρητά.
   *
   * ⚠️ Παραμένει `useSyncExternalStore` και **όχι** `useEffect` + `useState`: η επιφάνεια απόδοσης
   * εγγράφεται σε `useEffect`, δηλαδή **μετά** το πρώτο render αυτού του hook, και μόνο το
   * `useSyncExternalStore` εγγυάται ότι μια αλλαγή ανάμεσα σε render και effect δεν χάνεται.
   * Χωρίς αυτό ο painter θα έμενε `null` μέχρι την επόμενη άσχετη αλλαγή — «ο χάρτης εμφανίζεται
   * μόνο αν κουνήσεις κάτι».
   */
  const paintVersion = useSyncExternalStore(
    subscribeBasemapPaint,
    getBasemapPaintVersion,
    getBasemapPaintVersion,
  );

  return useMemo<OverlayDispatchPainter | null>(() => {
    // Η ΜΙΑ απόφαση (`basemap-paint-decision`) — «σβηστό», «χωρίς θέση» και «χωρίς απόδοση»
    // καταλήγουν όλα εδώ ως `null`, δηλαδή μηδέν κόστος για τη ζώνη (πύλη ADR-726 Φ2).
    const decision = resolveBasemapPaint();
    if (!decision.show) return null;
    const { source, opacity } = decision.content;

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
        opacity,
      });
    };
    // `paintVersion` είναι η **μοναδική** εξάρτηση, σκοπίμως: αλλάζει ταυτότητα του painter όταν —
    // και μόνο όταν — άλλαξε κάτι που επηρεάζει το τι ζωγραφίζεται (διακόπτης · αδιαφάνεια ·
    // πάροχος · διαθεσιμότητα · επιφάνεια απόδοσης · άφιξη πλακιδίου). Δες την επικεφαλίδα.
  }, [paintVersion]);
}
