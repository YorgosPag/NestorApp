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
 * Mirrors the FloorplanBackgroundCanvas pattern: effect-based render (no 60fps
 * RAF loop) that repaints only when grid settings / transform / viewport change.
 */

'use client';

import { useEffect, useRef } from 'react';
import { GridRenderer } from '../../rendering/ui/grid/GridRenderer';
import type { GridSettings as GridRendererSettings } from '../../rendering/ui/grid/GridTypes';
// Same GridSettings type the rest of the canvas stack passes around (layer-types).
// The runtime object carries the full GridTypes shape (built by useCanvasSettings),
// hence the cast to GridRendererSettings at the renderDirect boundary — mirrors DxfCanvas.
import type { GridSettings } from '../../canvas-v2';
import type { ViewTransform } from '../../rendering/types/Types';

export interface GridUnderlayCanvasProps {
  gridSettings: GridSettings;
  transform: ViewTransform;
  viewport: { width: number; height: number };
  /** Consumer sets z-index appropriate for the stacking context (ADR-002). */
  className?: string;
}

export function GridUnderlayCanvas({
  gridSettings,
  transform,
  viewport,
  className,
}: GridUnderlayCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // One GridRenderer instance for this canvas' lifetime (lazy init).
  const rendererRef = useRef<GridRenderer | null>(null);
  if (!rendererRef.current) rendererRef.current = new GridRenderer();

  // Resize backing store when the viewport changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
  }, [viewport.width, viewport.height]);

  // Repaint only when inputs change (no continuous RAF — same as FloorplanBackgroundCanvas).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, viewport.width, viewport.height);
    if (!gridSettings.enabled) return;

    rendererRef.current?.renderDirect(
      ctx,
      viewport,
      gridSettings as unknown as GridRendererSettings,
      {
        scale: transform.scale,
        offsetX: transform.offsetX,
        offsetY: transform.offsetY,
      },
    );
  }, [gridSettings, transform, viewport]);

  return (
    <canvas
      ref={canvasRef}
      width={viewport.width}
      height={viewport.height}
      className={className}
      aria-hidden
    />
  );
}
