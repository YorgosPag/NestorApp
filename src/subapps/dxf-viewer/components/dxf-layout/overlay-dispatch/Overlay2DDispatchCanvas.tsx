'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 + ADR-726 + ADR-732 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 * docs/centralized-systems/reference/adrs/ADR-726-frame-budget-instrumentation-and-attribution.md
 * docs/centralized-systems/reference/adrs/ADR-732-2d-canvas-layer-consolidation.md
 *
 * ADR-732 Batch 1 — Ο ΕΝΑΣ καμβάς της ζώνης Β (4 → 1).
 *
 * Αντικαθιστά 4 ξεχωριστά full-viewport canvases που κάθονταν ΠΑΝΩ από το DxfCanvas (z10)
 * και ΚΑΤΩ από το PreviewCanvas (z15): analytical-dispatch (z10, ADR-552) → envelope (z11,
 * ADR-396 P4) → mep-wires (z11, ADR-408 Φ7) → proposal-dispatch (z14, ADR-554). Η σχετική
 * σειρά σύνθεσής τους γίνεται σειρά ζωγραφικής ΜΕΣΑ στον καμβά — το ορατό z-αποτέλεσμα
 * μένει pixel-ίδιο, το compositing πληρώνει ΕΝΑ στρώμα αντί για τέσσερα (ADR-726 §4.Γ:
 * software compositing σε PC χωρίς GPU — ο μετρημένος περιοριστής).
 *
 * Pull model (ADR-726 Φ2): κάθε μέλος δηλώνει «painter ή null»· το primitive
 * `paintOverlayDispatchFrame` κάνει size+πύλη+clear ΜΙΑ φορά και ζωγραφίζει τους ενεργούς
 * με σειρά. Όλα τα μέλη είναι `pointer-events: none` — κανένα input path δεν αλλάζει.
 *
 * ADR-040: leaf component — ο shell `CanvasLayerStack` ΔΕΝ αποκτά νέο `useSyncExternalStore`
 * (CHECK 6C safe). Αθροιστικά οι ΙΔΙΕΣ low-freq subscriptions με τα 4 πρώην components, σε
 * ΕΝΑ leaf (επιχείρημα ADR-552)· το transform διαβάζεται με `getImmediateTransform()` στο
 * draw time μέσα σε scheduler frame (XXII.B) — ποτέ ως React prop.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { paintOverlayDispatchFrame } from './overlay-dispatch-frame';
import { composeOverlay2DPainters } from './overlay-2d-zone';
import { getImmediateTransform } from '../../../systems/cursor/ImmediateTransformStore';
import { subscribeImmediateTransformFrame } from '../../../rendering/core/immediate-transform-frame';
import { useAnalyticalPainters } from '../analytical-overlays/use-analytical-painters';
import { useProposalPainters } from '../proposal-overlays/use-proposal-painters';
import { useEnvelopePainter } from '../EnvelopeOverlay';
import { useHomeRunWiresPainter } from '../HomeRunWiresOverlay';
import type { DxfScene } from '../../../canvas-v2/dxf-canvas/dxf-types';
import type { Viewport } from '../../../rendering/types/Types';
import type { DxfGripDragPreview } from '../../../hooks/grip-computation';

export interface Overlay2DDispatchCanvasProps {
  readonly scene: DxfScene | null;
  readonly viewport: Viewport;
  /** Τρέχων BIM όροφος — κλειδί του per-level envelope spec store. */
  readonly currentLevelId: string | null;
  /** ADR-408 Φ7 P2 — live grip drag snapshot· το καλώδιο ακολουθεί τον σερνόμενο host. */
  readonly gripDragPreview: DxfGripDragPreview | null;
}

export function Overlay2DDispatchCanvas({
  scene,
  viewport,
  currentLevelId,
  gripDragPreview,
}: Overlay2DDispatchCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const analytical = useAnalyticalPainters();
  const envelope = useEnvelopePainter(scene, currentLevelId);
  const wires = useHomeRunWiresPainter(scene, gripDragPreview);
  const proposals = useProposalPainters();

  const painters = useMemo(
    () => composeOverlay2DPainters(analytical, envelope, wires, proposals),
    [analytical, envelope, wires, proposals],
  );

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

  // (β) Zero-lag pan/zoom — ΕΝΑ scheduler frame subscription για ΟΛΗ τη ζώνη Β
  // (πρώην 4 ξεχωριστά ids: analytical-dispatch / envelope-overlay / home-run-wires /
  // proposal-dispatch — το per-stage attribution του __dxfPerf βλέπει πλέον ένα stage).
  useEffect(
    () => subscribeImmediateTransformFrame('overlay-dispatch-2d', '2D Overlay Dispatch', repaint),
    [repaint],
  );

  return (
    <canvas
      ref={canvasRef}
      data-dxf-overlay="overlay-dispatch-2d"
      className="pointer-events-none absolute inset-0 w-full h-full z-[11]"
      aria-hidden="true"
    />
  );
}
