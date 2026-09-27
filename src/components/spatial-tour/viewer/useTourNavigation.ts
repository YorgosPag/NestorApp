'use client';

/**
 * @fileoverview **Η ΠΛΟΗΓΗΣΗ** — πρώτη εικόνα, και κάθε μετάβαση: στροφή → βάση (ήδη ξεκινημένη) → σβήσιμο → άφιξη
 * (ADR-884 Φ1 · Φ2ε · §4.8 · §4.11).
 * @related `lib/spatial-tour/viewer/{tour-viewer-state,tour-viewer-transition}.ts` · `lib/motion/animate-frames.ts` ·
 *   `lib/a11y/reduced-motion.ts` (ρωτιέται **τη στιγμή της πράξης**) · `tour-tile-streamer.ts` (το καθάρισμα)
 * @module components/spatial-tour/viewer/useTourNavigation
 *
 * 🔑 **Η φόρτωση ξεκινά ΜΑΖΙ με τη στροφή**, όχι μετά: η στροφή κρύβει τον χρόνο του δικτύου (το ίδιο κάνει το PSV). Μαζί
 *   ξεκινά και η **προφόρτωση των πλακιδίων της θέασης άφιξης** (γνωστή από το σχέδιο της μετάβασης).
 * 🔑 **Η άφιξη περιμένει ΜΟΝΟ τη βάση** (Marzipano `pinFirstLevel`): το καθάρισμα δεν είναι πια υπόσχεση της πλοήγησης —
 *   μόλις φτάσει ο επισκέπτης, ο streamer φέρνει τα πλακίδια **που βλέπει** (Φ2ε).
 * 🔑 **Καμία κούρσα**: μία μετάβαση τη φορά (ο reducer βάζει τα υπόλοιπα σε ουρά)· αποπροσάρτηση ⇒ `abort`. Αποτυχία
 *   βάσης ⇒ `abandoned`: ο επισκέπτης **μένει** στο σημείο του, με μήνυμα — ποτέ μαύρη οθόνη.
 * 🔴 **Η πρώτη εικόνα ΑΚΥΡΩΝΕΤΑΙ μόλις ξεκινήσει μετάβαση** (ζωντανή επαλήθευση Φ2δ): **μία** φόρτωση «που μπορεί ακόμη να
 *   παραδώσει» (`lateLoad`), και κάθε νέα μετάβαση την ακυρώνει. Για τα πλακίδια το ίδιο κλείνει **δομικά**: η μηχανή
 *   αγνοεί πλακίδιο στάσης που δεν δείχνει (`putTile`, M11).
 * 🔴 **Η άφιξη ΔΕΝ περιμένει τα καθαρά πλακίδια** (ίδια ζωντανή επαλήθευση, M12): αλλιώς «Βρίσκεστε στο…» και τα βελάκια
 *   έμεναν του **παλιού** σημείου ενώ φαινόταν το νέο.
 * 🔴 **Στη μετάβαση ο streamer δεν ακολουθεί ΚΑΝΕΝΑ σημείο** (`focus(null)`, ζωντανά 2026-09-27, M15): αλλιώς η στροφή
 *   ζητά πλακίδια της αφετηρίας που σβήνει, **μπροστά** από την προφόρτωση του προορισμού. Εγκατάλειψη ⇒ ξανά η αφετηρία.
 * 🧭 **Άφιξη = συνέχεια του περπατήματος** (M16): αντίθετα από τη διόπτευση επιστροφής (`linkBearing(to, from)`).
 */

import { type Dispatch, type MutableRefObject, useEffect, useRef, useState } from 'react';

import { prefersReducedMotion } from '@/lib/a11y/reduced-motion';
import { animateFrames } from '@/lib/motion/animate-frames';
import { linkBearing, type TourViewerGraph, type ViewerStop } from '@/lib/spatial-tour/viewer/tour-viewer-graph';
import type { TourViewerAction, TourViewerState } from '@/lib/spatial-tour/viewer/tour-viewer-state';
import type { TourTileFrame } from '@/lib/spatial-tour/viewer/tour-tile-visibility';
import {
  crossfadeOpacityAt, planTransition, rotationYawAt, type TourTransitionPlan,
} from '@/lib/spatial-tour/viewer/tour-viewer-transition';

import { setCameraView, type TourCameraStore } from './tour-camera-store';
import type { TourPanoramaEngine } from './tour-panorama-engine';
import { tourStopKey } from './tour-tile-streamer';
import type { TourStreamingContext } from './useTourTileStreamer';

export type TourPanoramaStatus = 'loading' | 'ready' | 'failed';

/** Το σχέδιο μιας μετάβασης από την τρέχουσα θέαση — ο ΕΝΑΣ υπολογισμός για μετάβαση και προφόρτωση. */
function transitionPlanOf(camera: TourCameraStore, from: ViewerStop, to: ViewerStop): TourTransitionPlan {
  return planTransition({
    yaw: camera.get().view.yaw,
    fromHeading: from.stop.headingRad,
    toHeading: to.stop.headingRad,
    linkBearing: linkBearing(from, to),
    returnBearing: linkBearing(to, from),
    reducedMotion: prefersReducedMotion(),
  });
}

/**
 * **Τι θα δει ο επισκέπτης φτάνοντας στο `to`** — γνωστό ΠΡΙΝ το κλικ (ίδιο σχέδιο με τη μετάβαση). Το χρησιμοποιεί η
 * προφόρτωση: στο hover/focus του βελακιού και στην αρχή της μετάβασης.
 */
export function arrivalFrameOf(camera: TourCameraStore, from: ViewerStop, to: ViewerStop): TourTileFrame {
  const { view, aspect } = camera.get();
  return { view: { ...view, yaw: transitionPlanOf(camera, from, to).arrivalYaw }, aspect };
}

/** Μία μετάβαση: στροφή → βάση → σβήσιμο. Επιστρέφει **μόλις φανεί η εικόνα**. */
async function runTransition(
  ctx: TourStreamingContext,
  from: ViewerStop,
  to: ViewerStop,
  signals: { readonly motion: AbortSignal; readonly load: AbortSignal },
): Promise<void> {
  const { engine, camera, source, streamer } = ctx;
  const plan = transitionPlanOf(camera, from, to);
  // Η αφετηρία σβήνει σε < 1 s: τα πλακίδια της στροφής της θα έπαιρναν τις θέσεις της ουράς ΜΠΡΟΣΤΑ από την
  // προφόρτωση του προορισμού (ζωντανά 2026-09-27: 2+6 αιτήματα αφετηρίας στη στροφή, τα 6 × 503).
  streamer.focus(null);
  const base = source.base(to.stop, signals.load);
  streamer.prefetch(to.stop, arrivalFrameOf(camera, from, to));
  const { rotate } = plan;
  if (rotate !== null) {
    await animateFrames(rotate.durationMs, (ms) => setCameraView(camera, { ...camera.get().view, yaw: rotationYawAt(rotate, ms) }), signals.motion);
  }
  const images = await base;
  if (plan.fadeMs > 0) {
    engine.setIncoming(images, to.stop.headingRad, tourStopKey(to.stop));
    await animateFrames(plan.fadeMs, (ms) => engine.setIncomingOpacity(crossfadeOpacityAt(plan.fadeMs, ms)), signals.motion);
    engine.commitIncoming();
  } else {
    engine.showNow(images, to.stop.headingRad, tourStopKey(to.stop));
  }
  setCameraView(camera, { ...camera.get().view, yaw: plan.arrivalYaw });
}

/**
 * Η πρώτη εικόνα — μία φορά ανά μηχανή· η βάση, και μετά τα πλακίδια της θέασης. Η φόρτωσή της γράφεται στο
 * `lateLoad`, ώστε η **πρώτη μετάβαση** να την ακυρώσει (καμία παράδοση μετά).
 */
function useFirstPanorama(
  ctx: TourStreamingContext | null,
  first: ViewerStop | null,
  onStatus: (s: TourPanoramaStatus) => void,
  lateLoad: MutableRefObject<AbortController | null>,
): void {
  const shownOn = useRef<TourPanoramaEngine | null>(null);
  useEffect(() => {
    if (ctx === null || first === null || shownOn.current === ctx.engine) return;
    const controller = new AbortController();
    lateLoad.current = controller;
    const { engine, streamer } = ctx;
    onStatus('loading');
    ctx.source.base(first.stop, controller.signal).then(
      (faces) => {
        if (controller.signal.aborted) return;
        shownOn.current = engine;
        engine.showNow(faces, first.stop.headingRad, tourStopKey(first.stop));
        streamer.focus(first.stop);
        onStatus('ready');
      },
      () => { if (!controller.signal.aborted) onStatus('failed'); },
    );
    return () => controller.abort();
  }, [ctx, first, onStatus, lateLoad]);
}

export function useTourNavigation(
  ctx: TourStreamingContext | null,
  graph: TourViewerGraph,
  state: TourViewerState,
  dispatch: Dispatch<TourViewerAction>,
): TourPanoramaStatus {
  const [status, setStatus] = useState<TourPanoramaStatus>('loading');
  const first = useRef(state.nodeId === null ? null : graph.stops.get(state.nodeId) ?? null).current;
  /** Η ΜΙΑ φόρτωση βάσης που μπορεί ακόμη να παραδώσει — της πρώτης εικόνας ή της τελευταίας μετάβασης. */
  const lateLoad = useRef<AbortController | null>(null);
  useFirstPanorama(ctx, first, setStatus, lateLoad);
  useEffect(() => () => lateLoad.current?.abort(), []);

  useEffect(() => {
    const from = state.nodeId === null ? undefined : graph.stops.get(state.nodeId);
    const to = state.targetNodeId === null ? undefined : graph.stops.get(state.targetNodeId);
    if (ctx === null || from === undefined || to === undefined) return;
    // Ο επισκέπτης φεύγει ⇒ ό,τι φόρτωνε για το ΠΡΟΗΓΟΥΜΕΝΟ σημείο δεν έχει πια λόγο να έρθει.
    lateLoad.current?.abort();
    const load = new AbortController();
    lateLoad.current = load;
    const motion = new AbortController();
    runTransition(ctx, from, to, { motion: motion.signal, load: load.signal }).then(
      () => {
        if (motion.signal.aborted) return; // το effect ξανάτρεξε (νέος γράφος/στόχος) — αποφασίζει η νέα εκτέλεση
        ctx.streamer.focus(to.stop);
        setStatus('ready');
        dispatch({ kind: 'arrived' });
      },
      () => {
        if (motion.signal.aborted || load.signal.aborted) return;
        ctx.streamer.focus(from.stop); // ο επισκέπτης ΜΕΝΕΙ — τα πλακίδια του σημείου του ξαναρέουν
        setStatus('failed');
        dispatch({ kind: 'abandoned' });
      },
    );
    return () => motion.abort();
  }, [ctx, graph, state.nodeId, state.targetNodeId, dispatch]);

  return status;
}
