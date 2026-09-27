'use client';

/**
 * @fileoverview **Η ΠΛΟΗΓΗΣΗ** — πρώτη εικόνα, και κάθε μετάβαση: στροφή → φόρτωση (ήδη ξεκινημένη) → σβήσιμο → άφιξη
 * (ADR-884 Φ1 · §4.8).
 * @related `lib/spatial-tour/viewer/{tour-viewer-state,tour-viewer-transition}.ts` · `lib/motion/animate-frames.ts` ·
 *   `lib/a11y/reduced-motion.ts` (ρωτιέται **τη στιγμή της πράξης**)
 * @module components/spatial-tour/viewer/useTourNavigation
 *
 * 🔑 **Η φόρτωση ξεκινά ΜΑΖΙ με τη στροφή**, όχι μετά: η στροφή κρύβει τον χρόνο του δικτύου (το ίδιο κάνει το PSV).
 * 🔑 **Προεπισκόπηση πρώτα** (ADR-884 Φ2γ, πρότυπο Marzipano/Pannellum): ό,τι φτάσει πρώτο δείχνεται, και τα καθαρά
 *   πλακίδια αντικαθιστούν την προεπισκόπηση όταν έρθουν — ο επισκέπτης δεν περιμένει ποτέ σε μαύρο.
 * 🔑 **Καμία κούρσα**: μία μετάβαση τη φορά (ο reducer βάζει τα υπόλοιπα σε ουρά)· αποπροσάρτηση ⇒ `abort` — κανένα
 *   καρέ σε μηχανή που έχει απελευθερωθεί. Αποτυχία φόρτωσης ⇒ `abandoned`: ο επισκέπτης **μένει** στο σημείο του, με
 *   μήνυμα — ποτέ μαύρη οθόνη.
 * 🔴 **Η πρώτη εικόνα ΑΚΥΡΩΝΕΤΑΙ μόλις ξεκινήσει μετάβαση** (ζωντανή επαλήθευση ADR-884 Φ2δ, 2026-09-27): η πρώτη φόρτωση δεν
 *   την ακύρωνε κανείς — με αργά πλακίδια, οι όψεις της ΠΡΩΤΗΣ στάσης έφταναν **μετά** την άφιξη στη δεύτερη και
 *   ζωγραφίζονταν από πάνω της (σημείο Α με την εικόνα του Β). Ίδια κλάση με τον δημόσιο θεατή — γι' αυτό λύνεται εδώ.
 *   Κλείνει δομικά: **μία** φόρτωση «που μπορεί ακόμη να παραδώσει» (`lateLoad`), και κάθε νέα μετάβαση την ακυρώνει.
 * 🔴 **Η άφιξη ΔΕΝ περιμένει τα καθαρά πλακίδια** (ίδια ζωντανή επαλήθευση): η μετάβαση έκανε `await` τις καθαρές όψεις πριν
 *   δηλώσει άφιξη — σε αργό δίκτυο ο επισκέπτης **έβλεπε** το νέο δωμάτιο ενώ «Βρίσκεστε στο…», τα «Επόμενα σημεία» και τα
 *   βελάκια έμεναν του **παλιού** (λάθος κατευθύνσεις). Άφιξη = μόλις φανεί η εικόνα· το καθάρισμα έρχεται μετά.
 */

import { type Dispatch, type MutableRefObject, useEffect, useRef, useState } from 'react';

import { prefersReducedMotion } from '@/lib/a11y/reduced-motion';
import { animateFrames } from '@/lib/motion/animate-frames';
import { linkBearing, type TourViewerGraph, type ViewerStop } from '@/lib/spatial-tour/viewer/tour-viewer-graph';
import type { TourViewerAction, TourViewerState } from '@/lib/spatial-tour/viewer/tour-viewer-state';
import { crossfadeOpacityAt, planTransition, rotationYawAt } from '@/lib/spatial-tour/viewer/tour-viewer-transition';

import { setCameraView, type TourCameraStore } from './tour-camera-store';
import type { TourPanoramaEngine } from './tour-panorama-engine';
import type { TourCubeFaceImages, TourPanoramaSource } from './tour-panorama-source';

export type TourPanoramaStatus = 'loading' | 'ready' | 'failed';

interface NavigationContext {
  readonly engine: TourPanoramaEngine;
  readonly camera: TourCameraStore;
  readonly source: TourPanoramaSource;
}

/**
 * Φόρτωση με προεπισκόπηση: `preview` λύνεται με την προεπισκόπηση — ή `null` αν οι καθαρές όψεις ήρθαν πρώτες (η πηγή
 * δεν υποβαθμίζει ποτέ, `tour-panorama-source.ts`).
 */
function loadProgressive(source: TourPanoramaSource, stop: ViewerStop['stop'], signal: AbortSignal, maxFaceSize: number) {
  let resolvePreview: (faces: TourCubeFaceImages | null) => void = () => undefined;
  const preview = new Promise<TourCubeFaceImages | null>((resolve) => { resolvePreview = resolve; });
  const full = source.load(stop, { signal, maxFaceSize, onPreview: (faces) => resolvePreview(faces) });
  full.then(() => resolvePreview(null), () => resolvePreview(null));
  return { preview, full };
}

/** Ό,τι δείχνεται στην άφιξη, και οι καθαρές όψεις που **ίσως** έρθουν αργότερα. */
interface Arrival {
  readonly shown: TourCubeFaceImages;
  readonly full: Promise<TourCubeFaceImages | null>;
}

/**
 * Μία μετάβαση: στροφή → ό,τι φτάσει πρώτο → σβήσιμο. Επιστρέφει **μόλις φανεί η εικόνα** — τα καθαρά πλακίδια δεν
 * κρατούν την άφιξη (βλ. 🔴 στην κεφαλίδα). `motion` = οι κινήσεις (ακυρώνονται με το effect)· `load` = η φόρτωση, που
 * επιβιώνει την άφιξη ώστε να καθαρίσει την εικόνα.
 */
async function runTransition(
  ctx: NavigationContext,
  from: ViewerStop,
  to: ViewerStop,
  signals: { readonly motion: AbortSignal; readonly load: AbortSignal },
): Promise<Arrival> {
  const { engine, camera, source } = ctx;
  const plan = planTransition({
    yaw: camera.get().view.yaw,
    fromHeading: from.stop.headingRad,
    toHeading: to.stop.headingRad,
    linkBearing: linkBearing(from, to),
    reducedMotion: prefersReducedMotion(),
  });
  const { preview, full } = loadProgressive(source, to.stop, signals.load, engine.maxFaceSize);
  const { rotate } = plan;
  if (rotate !== null) {
    await animateFrames(rotate.durationMs, (ms) => setCameraView(camera, { ...camera.get().view, yaw: rotationYawAt(rotate, ms) }), signals.motion);
  }
  // Ό,τι έφτασε πρώτο: καθαρές όψεις ή προεπισκόπηση (Marzipano `pinFirstLevel`) — ποτέ αναμονή σε μαύρο.
  const images = await Promise.race([full, preview.then((faces) => faces ?? full)]);
  if (plan.fadeMs > 0) {
    engine.setIncoming(images, to.stop.headingRad);
    await animateFrames(plan.fadeMs, (ms) => engine.setIncomingOpacity(crossfadeOpacityAt(plan.fadeMs, ms)), signals.motion);
    engine.commitIncoming();
  } else {
    engine.showNow(images, to.stop.headingRad);
  }
  setCameraView(camera, { ...camera.get().view, yaw: plan.arrivalYaw });
  return { shown: images, full: full.catch(() => null) };
}

/**
 * Καθάρισμα μετά την άφιξη: τα πλακίδια αντικαθιστούν την προεπισκόπηση **αν** ο επισκέπτης είναι ακόμη εκεί (καμία
 * νέα μετάβαση — `load` δεν ακυρώθηκε). Αποτυχία τους δεν μας γυρίζει πίσω: θολή αλλά σωστή εικόνα.
 */
function sharpenAfterArrival(engine: TourPanoramaEngine, arrival: Arrival, headingRad: number, load: AbortSignal): void {
  void arrival.full.then((sharp) => {
    if (sharp !== null && sharp !== arrival.shown && !load.aborted) engine.showNow(sharp, headingRad);
  });
}

/**
 * Η πρώτη εικόνα — μία φορά ανά μηχανή· η προεπισκόπηση αμέσως, οι καθαρές όψεις από πάνω της. Η φόρτωσή της γράφεται
 * στο `lateLoad`, ώστε η **πρώτη μετάβαση** να την ακυρώσει (καμία παράδοση μετά).
 */
function useFirstPanorama(
  ctx: NavigationContext | null,
  first: ViewerStop | null,
  onStatus: (s: TourPanoramaStatus) => void,
  lateLoad: MutableRefObject<AbortController | null>,
): void {
  const shownOn = useRef<TourPanoramaEngine | null>(null);
  useEffect(() => {
    if (ctx === null || first === null || shownOn.current === ctx.engine) return;
    const controller = new AbortController();
    lateLoad.current = controller;
    const { engine } = ctx;
    let previewShown = false;
    onStatus('loading');
    const { preview, full } = loadProgressive(ctx.source, first.stop, controller.signal, engine.maxFaceSize);
    preview.then((faces) => {
      if (faces === null || controller.signal.aborted || shownOn.current === engine) return;
      previewShown = true;
      engine.showNow(faces, first.stop.headingRad);
      onStatus('ready');
    });
    full.then(
      (faces) => {
        if (controller.signal.aborted) return;
        shownOn.current = engine;
        engine.showNow(faces, first.stop.headingRad);
        onStatus('ready');
      },
      () => { if (!controller.signal.aborted && !previewShown) onStatus('failed'); },
    );
    return () => controller.abort();
  }, [ctx, first, onStatus, lateLoad]);
}

export function useTourNavigation(
  ctx: NavigationContext | null,
  graph: TourViewerGraph,
  state: TourViewerState,
  dispatch: Dispatch<TourViewerAction>,
): TourPanoramaStatus {
  const [status, setStatus] = useState<TourPanoramaStatus>('loading');
  const first = useRef(state.nodeId === null ? null : graph.stops.get(state.nodeId) ?? null).current;
  /** Η ΜΙΑ φόρτωση που μπορεί ακόμη να παραδώσει όψεις — της πρώτης εικόνας ή της τελευταίας μετάβασης. */
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
      (arrival) => {
        if (motion.signal.aborted) return; // το effect ξανάτρεξε (νέος γράφος/στόχος) — αποφασίζει η νέα εκτέλεση
        setStatus('ready');
        dispatch({ kind: 'arrived' });
        sharpenAfterArrival(ctx.engine, arrival, to.stop.headingRad, load.signal);
      },
      () => { if (!motion.signal.aborted && !load.signal.aborted) { setStatus('failed'); dispatch({ kind: 'abandoned' }); } },
    );
    return () => motion.abort();
  }, [ctx, graph, state.nodeId, state.targetNodeId, dispatch]);

  return status;
}
