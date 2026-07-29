/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * GridUnderlayCanvas — the adaptive grid as the BOTTOM-MOST layer.
 *
 * Why a dedicated canvas: the visible κάτοψη is rendered by the
 * `FloorplanBackgroundCanvas` (z=0, DOM-first — the lowest content layer), so a
 * grid drawn on ANY higher canvas (DxfCanvas z=10 entities, LayerCanvas z=0
 * color layers) always sat ON TOP of the κάτοψη. To put the grid BENEATH the
 * κάτοψη it must live on its own canvas mounted BEFORE the floorplan background.
 * (Giorgio 2026-06-05 — see ADR-040 changelog.)
 *
 * ADR-040 Phase XXII.B — zero-lag: το transform ΔΕΝ είναι πια React prop. Η ζωγραφική
 * διαβάζει `getImmediateTransform()` και τρέχει (α) σε content change (settings/viewport
 * effect) και (β) σε transform change μέσω `subscribeImmediateTransformFrame` (ΜΗΔΕΝ React
 * ανά καρέ — ιδίωμα HomeRunWiresOverlay). Παράπλευρο όφελος: ο κάναβος είναι world-locked
 * στο ΙΔΙΟ tick με τον main canvas αντί ένα React commit πίσω.
 */

'use client';

import { useCallback, useEffect, useRef } from 'react';
import { GridRenderer } from '../../rendering/ui/grid/GridRenderer';
// ADR-726 Φ2 — sizing + πύλη + clear ζουν στο ΕΝΑ primitive· εδώ δηλώνεται μόνο «painter ή null».
import {
  paintOverlayDispatchFrame,
  type OverlayDispatchPainter,
} from './overlay-dispatch/overlay-dispatch-frame';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { subscribeImmediateTransformFrame } from '../../rendering/core/immediate-transform-frame';
import type { GridSettings as GridRendererSettings } from '../../rendering/ui/grid/GridTypes';
// Same GridSettings type the rest of the canvas stack passes around (layer-types).
// The runtime object carries the full GridTypes shape (built by useCanvasSettings),
// hence the cast to GridRendererSettings at the renderDirect boundary — mirrors DxfCanvas.
import type { GridSettings } from '../../canvas-v2';

export interface GridUnderlayCanvasProps {
  gridSettings: GridSettings;
  viewport: { width: number; height: number };
  /** Consumer sets z-index appropriate for the stacking context (ADR-002). */
  className?: string;
}

export function GridUnderlayCanvas({
  gridSettings,
  viewport,
  className,
}: GridUnderlayCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // One GridRenderer instance for this canvas' lifetime (lazy init).
  const rendererRef = useRef<GridRenderer | null>(null);
  if (!rendererRef.current) rendererRef.current = new GridRenderer();

  // Volatile low-freq inputs μέσω ref (unconditional assign) — το scheduler callback
  // διαβάζει ΠΑΝΤΑ τα φρέσκα (ιδίωμα HomeRunWires: ref bundle + 2 effects → ΙΔΙΟ repaint).
  const drawStateRef = useRef({ gridSettings, viewport });
  drawStateRef.current = { gridSettings, viewport };

  // 🏢 SSoT sizing (ADR-040) — το DPR-aware backing store από το authoritative viewport το κάνει
  // το ΕΝΑ primitive (paintOverlayDispatchFrame), idempotent, πριν την πύλη.
  // ADR-726 Φ2 — με τον κάναβο σβηστό ο καμβάς δεν αγγίζεται καθόλου.
  const repaint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { gridSettings: gs, viewport: vp } = drawStateRef.current;

    const painter: OverlayDispatchPainter | null = gs.enabled
      ? (ctx, t, pvp) => {
          rendererRef.current?.renderDirect(
            ctx,
            pvp,
            gs as unknown as GridRendererSettings,
            { scale: t.scale, offsetX: t.offsetX, offsetY: t.offsetY },
          );
        }
      : null;

    paintOverlayDispatchFrame(canvas, [painter], getImmediateTransform(), vp);
  }, []);

  // (α) Repaint σε content change — settings/viewport, με ΑΚΙΝΗΤΟ transform.
  useEffect(() => {
    repaint();
  }, [gridSettings, viewport, repaint]);

  // (β) Zero-lag pan/zoom — reproject στο LOW-priority scheduler frame, gated στο
  // immediate transform signature. Unregister στο cleanup (StrictMode-safe).
  useEffect(() => {
    return subscribeImmediateTransformFrame('grid-underlay', 'Grid Underlay', repaint);
  }, [repaint]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden
    />
  );
}
