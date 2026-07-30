/**
 * 🏢 SSoT — Canvas backing-store lifecycle για τα layers του canvas stack (ADR-040).
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ (2026-07-30): το `DxfCanvas` και το `LayerCanvas` κουβαλούσαν **ταυτόσημα
 * δίδυμα** ~20 γραμμών (setupCanvasRef indirection → useCanvasResize → resolvedViewportRef →
 * setupCanvas → mount effect → viewport-change effect). Το jscpd (CHECK 3.28) τα πιάνει ως
 * clone. Χειρότερα: το ΙΔΙΟ λάθος ζούσε και στα δύο αντίγραφα — ένα `if (prev.width === 0)
 * return` που παρέκαμπτε το sizing ΑΚΡΙΒΩΣ στη μετάβαση 0 → πραγματικό μέγεθος, δηλαδή στη
 * μοναδική στιγμή που το backing store είναι ακόμα στο default 300×150 του `<canvas>`.
 * Με CSS `width/height:100%` αυτό εμφανίζεται ως τεντωμένο καρέ ×5 (ο «γιγάντιος χάρακας»
 * μετά από σκληρή ανανέωση). Ένα module = ένα σημείο διόρθωσης.
 *
 * ΤΙ ΔΕΝ ΚΑΝΕΙ: δεν σημαίνει dirty. Το dirty-on-viewport ανήκει στον renderer του κάθε layer
 * (`useDxfCanvasRenderer` / `useLayerCanvasRenderer` — έχουν ήδη `viewport` στα deps τους).
 *
 * ΣΥΜΠΛΗΡΩΜΑΤΙΚΟ, ΟΧΙ ΥΠΟΚΑΤΑΣΤΑΤΟ: το οριστικό δίχτυ είναι το size-at-paint-time μέσα στον
 * render tick (`CanvasUtils.sizeCanvasToViewport` στην αρχή του frame). Τα effects εδώ
 * προλαβαίνουν το sizing πριν τον επόμενο tick· ο tick εγγυάται ότι **κανένα** καρέ δεν
 * ζωγραφίζεται με ασύμφωνο buffer, ό,τι κι αν κάνει το timing των passive effects.
 *
 * @module hooks/canvas/useCanvasBackingStore
 */

'use client';

import { useCallback, useEffect, useRef, type MutableRefObject, type RefObject } from 'react';
import { createModuleLogger } from '@/lib/telemetry';
import { CanvasUtils } from '../../rendering/canvas/utils/CanvasUtils';
import type { Viewport } from '../../rendering/types/Types';
import { useCanvasResize } from './useCanvasResize';

const logger = createModuleLogger('CanvasBackingStore');

export interface UseCanvasBackingStoreOptions {
  /** The canvas element ref. */
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** Authoritative viewport from the container (SSoT via useViewportManager). */
  viewportProp?: Viewport;
  /** Label used in error logs (e.g. 'DXF', 'Layer'). */
  label: string;
}

export interface UseCanvasBackingStoreResult {
  /** Resolved viewport (container prop wins; local ResizeObserver as fallback). */
  viewport: Viewport;
  /** Synchronous viewport for the RAF render tick — updated in the render body. */
  resolvedViewportRef: MutableRefObject<Viewport>;
}

/**
 * Sizes a stack-layer canvas's backing store from the authoritative viewport.
 *
 * SSoT sizing (ADR-040): the buffer comes from the shared `viewport`, NEVER from this
 * canvas's own `getBoundingClientRect()` (the per-canvas race behind the intermittent
 * right-side «dead zone»).
 */
export function useCanvasBackingStore({
  canvasRef,
  viewportProp,
  label,
}: UseCanvasBackingStoreOptions): UseCanvasBackingStoreResult {
  // Stable indirection: lets useCanvasResize's observer / DPR-change handler call the latest
  // `setupCanvas` (defined below) instead of a parallel subscription. The optional viewport is
  // forwarded verbatim — see `setupCanvas` for why the caller-supplied size wins.
  const setupCanvasRef = useRef<(vp?: Viewport) => void>(() => {});
  const runSetupCanvas = useCallback((vp?: Viewport) => setupCanvasRef.current(vp), []);

  const { viewport } = useCanvasResize({ canvasRef, viewportProp, onSetupCanvas: runSetupCanvas });

  // Synchronous viewport for the RAF callback — prevents stale closures.
  const resolvedViewportRef = useRef(viewport);
  resolvedViewportRef.current = viewport;

  // `explicitViewport` wins when given: the local ResizeObserver knows the fresh size BEFORE the
  // render body writes `resolvedViewportRef`, so reading the ref there would size to the stale
  // (usually 0×0) value and silently no-op — the buffer would stay at the 300×150 default.
  const setupCanvas = useCallback((explicitViewport?: Viewport) => {
    const canvas = canvasRef.current;
    if (!canvas || !(canvas instanceof HTMLCanvasElement)) return;
    const vp = explicitViewport ?? resolvedViewportRef.current;
    if (!vp.width || !vp.height) return;
    try {
      CanvasUtils.sizeCanvasToViewport(canvas, vp);
    } catch (error) {
      logger.error('Failed to size canvas backing store', { label, error });
    }
  }, [canvasRef, label]);
  setupCanvasRef.current = setupCanvas;

  // Mount — no-op while the viewport is still 0×0 (the container has not been measured yet).
  useEffect(() => {
    setupCanvas();
  }, [setupCanvas]);

  // Every viewport change re-sizes the buffer — INCLUDING the first 0 → real transition, which
  // the two former copies deliberately skipped (see module header). `sizeCanvasToViewport` is
  // idempotent, so a redundant call costs nothing and never wipes the canvas.
  const prevViewportRef = useRef<Viewport>({ width: 0, height: 0 });
  useEffect(() => {
    if (!viewport.width || !viewport.height) return;
    const prev = prevViewportRef.current;
    if (prev.width === viewport.width && prev.height === viewport.height) return;
    prevViewportRef.current = { width: viewport.width, height: viewport.height };
    setupCanvas();
  }, [viewport.width, viewport.height, setupCanvas]);

  return { viewport, resolvedViewportRef };
}
