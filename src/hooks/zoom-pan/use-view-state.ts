/**
 * @fileoverview **Η όψη ως κατάσταση** — state για το render, ref για τις αναγνώσεις τη στιγμή του γεγονότος, και ο
 *   ΕΝΑΣ `commit` που περνά κάθε νέα όψη από τον περιορισμό (ADR-899 §9 θέμα 3).
 * @module hooks/zoom-pan/use-view-state
 */

'use client';

import { useCallback, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';

import { useElementSize } from '@/hooks/media/useElementSize';
import { viewTransformOf, type Extent } from '@/lib/geometry/zoom-pan-math';

import {
  settleView, viewScaleOf, ZERO_PAN, type ViewCommit, type ViewFit, type ViewFrame, type ViewGetter, type ZoomPanView,
} from './zoom-pan-view';

/** Ρύθμιση του «ξαναχωρά μετά τη στροφή» (ADR-899 §9 θέμα 5β)· `null` = σβηστό. */
export interface RefitConfig {
  readonly dimensions: Extent | null;
}

/** Σκαλοπάτι μέτρησης του κουτιού για το «ξαναχωρά» — ακέραια css px: μισό pixel δεν αλλάζει την όψη. */
const FIT_BOX_STEP_PX = 1;

/**
 * Το πλαίσιο του «ξαναχωρά»: το **content-box** του κουτιού (εκεί τοποθετείται το περιεχόμενο) + οι δηλωμένες διαστάσεις.
 * 🔑 Το ref ξαναφτιάχνεται **όταν αλλάζει ο κόμβος**: το κουτί ενός modal δένεται μετά το πρώτο render, και ένας
 * παρατηρητής στημένο σε σταθερό ref θα είχε δει `null` και δεν θα μετρούσε ποτέ. Σβηστό ⇒ κενό ref ⇒ κανένας παρατηρητής.
 */
function useViewFit(container: HTMLElement | null, refit: RefitConfig | null): ViewFit | null {
  const enabled = refit !== null;
  const measured = useMemo(() => ({ current: enabled ? container : null }), [enabled, container]);
  const box = useElementSize(measured, FIT_BOX_STEP_PX, 'content-box');
  const width = refit?.dimensions?.width ?? null;
  const height = refit?.dimensions?.height ?? null;
  // Ταυτότητα από τις τιμές: ο καλών μπορεί να ξαναφτιάχνει το αντικείμενο διαστάσεων σε κάθε render.
  return useMemo(() => {
    if (!enabled) return null;
    return { box, intrinsic: width !== null && height !== null ? { width, height } : null };
  }, [enabled, box, width, height]);
}

export interface ViewState {
  readonly view: ZoomPanView;
  /** Κουτί · περιεχόμενο · «ξαναχωρά» — ό,τι χρειάζεται ο περιορισμός. */
  readonly frame: ViewFrame;
  /** Η κλίμακα που ζωγραφίζεται: `zoom × fit` (ADR-899 §9 θέμα 5β). */
  readonly scale: number;
  readonly getView: ViewGetter;
  readonly commit: ViewCommit;
  readonly container: HTMLElement | null;
  readonly content: HTMLElement | null;
  /** Το κουτί ως `RefObject` — για όποιον το μετρά (π.χ. `useElementSize` / `useZoomResolution`). */
  readonly containerBox: RefObject<HTMLElement | null>;
  readonly containerRef: (node: HTMLElement | null) => void;
  readonly contentRef: (node: HTMLElement | null) => void;
}

export function useViewState(defaultZoom: number, confine: boolean, refit: RefitConfig | null = null): ViewState {
  const [view, setView] = useState<ZoomPanView>({ zoom: defaultZoom, pan: ZERO_PAN, rotation: 0 });
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [content, setContent] = useState<HTMLElement | null>(null);
  const viewRef = useRef(view);
  const fit = useViewFit(container, refit);
  const frame: ViewFrame = { container, content, fit };
  const frameRef = useRef(frame);
  const containerBox = useRef<HTMLElement | null>(null);
  frameRef.current = frame;

  const getView = useCallback(() => viewRef.current, []);
  const commit = useCallback((next: ZoomPanView) => {
    const settled = settleView(next, frameRef.current, confine);
    viewRef.current = settled;
    setView(settled);
  }, [confine]);

  const containerRef = useCallback((node: HTMLElement | null) => {
    containerBox.current = node;
    setContainer(node);
  }, []);

  return { view, frame, scale: viewScaleOf(view, frame), getView, commit, container, content, containerBox, containerRef, contentRef: setContent };
}

/**
 * **Εφαρμογή του μετασχηματισμού στο περιεχόμενο — imperative** (κανένα `style=` στο JSX, N.3). Η μετάβαση σβήνει όσο
 * κρατιέται η σύρση (άμεση απόκριση), αλλιώς ομαλή — η στροφή και η επαναπροσαρμογή της (`scale = zoom × fit`) κινούνται μαζί.
 */
export function useApplyViewTransform(content: HTMLElement | null, view: ZoomPanView, scale: number, isPanning: boolean): void {
  useLayoutEffect(() => {
    if (!content) return;
    content.style.transform = viewTransformOf({ pan: view.pan, scale, rotation: view.rotation });
    content.style.transformOrigin = 'center center';
    content.style.transition = isPanning ? 'none' : 'transform 0.15s ease-out';
  }, [content, view, scale, isPanning]);
}
