'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL — READ ADR-040 + ADR-726 + ADR-732 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 * docs/centralized-systems/reference/adrs/ADR-726-frame-budget-instrumentation-and-attribution.md
 * docs/centralized-systems/reference/adrs/ADR-732-2d-canvas-layer-consolidation.md
 *
 * useOverlayZoneDispatch — ο ΕΝΑΣ μηχανισμός «zone canvas» (SSoT, N.18).
 *
 * Κοινός κύκλος ζωής των zone dispatch canvases του ADR-732 (ζώνη Α `UnderlayDispatchCanvas`,
 * ζώνη Β `Overlay2DDispatchCanvas` — και όποιας επόμενης ζώνης): refs που διαβάζονται στο
 * frame time (ο scheduler callback δεν ξανα-εγγράφεται σε αλλαγή data/resize), repaint μέσω
 * του primitive `paintOverlayDispatchFrame` (πύλη ADR-726 Φ2), content-change effect με
 * ΑΚΙΝΗΤΟ transform, και ΕΝΑ `subscribeImmediateTransformFrame` ανά ζώνη (zero-lag pan/zoom,
 * ADR-040 XXII.B — το transform διαβάζεται `getImmediateTransform()` στο draw time, ποτέ prop).
 *
 * Εξήχθη όταν το CHECK 3.28 (jscpd) έπιασε τα δύο zone canvases ως sibling clones —
 * το ακριβώς λάθος που ο N.18 υπάρχει για να προλαβαίνει.
 */

import { useCallback, useEffect, useRef } from 'react';
import {
  paintOverlayDispatchFrame,
  type OverlayDispatchPainter,
} from './overlay-dispatch-frame';
import { getImmediateTransform } from '../../../systems/cursor/ImmediateTransformStore';
import { subscribeImmediateTransformFrame } from '../../../rendering/core/immediate-transform-frame';
import type { Viewport } from '../../../rendering/types/Types';

/**
 * @param painters Flat λίστα της ζώνης σε σειρά z-συμβολαίου (reference-stable — το
 *   content-change effect πυροδοτεί πάνω στην ταυτότητά της).
 * @param id Scheduler subsystem id της ζώνης (ένα ανά ζώνη — attribution στο __dxfPerf).
 * @returns Το ref που δένεται στο `<canvas>` της ζώνης.
 */
export function useOverlayZoneDispatch(
  painters: ReadonlyArray<OverlayDispatchPainter | null>,
  viewport: Viewport,
  id: string,
  name: string,
): React.RefObject<HTMLCanvasElement | null> {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Refs read at frame time so the scheduler callback never re-registers on data/resize change.
  const paintersRef = useRef(painters);
  paintersRef.current = painters;
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  const repaint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const vp = viewportRef.current;
    // Perf guard (ADR-408 Φ7): τίποτα — ούτε DPR sizing — σε 0×0 viewport / collapsed shell.
    if (vp.width <= 0 || vp.height <= 0) return;
    paintOverlayDispatchFrame(canvas, paintersRef.current, getImmediateTransform(), vp);
  }, []);

  // (α) Repaint σε content change (painter identities / resize) με ΑΚΙΝΗΤΟ transform.
  useEffect(() => {
    repaint();
  }, [painters, viewport, repaint]);

  // (β) Zero-lag pan/zoom — ΕΝΑ scheduler frame subscription για ΟΛΗ τη ζώνη.
  useEffect(
    () => subscribeImmediateTransformFrame(id, name, repaint),
    [id, name, repaint],
  );

  return canvasRef;
}
