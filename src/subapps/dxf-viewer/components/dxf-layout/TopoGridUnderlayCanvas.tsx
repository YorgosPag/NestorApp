/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-656 M11 — TopoGridUnderlayCanvas: the LIVE ΕΓΣΑ87 coordinate graticule (screen consumer).
 *
 * Clones the `GridUnderlayCanvas` shell (effect-based repaint, no RAF, DPR-aware backing store)
 * but draws the SURVEY coordinate grid, not the F7 drawing-aid grid: crosses at the ROUND ΕΓΣΑ87
 * values (from the ONE pure `topo-grid-model`) plus Easting/Northing numbering pinned to the frame
 * edges (top for Eastings, right for Northings — clear of the bottom/left rulers). Everything
 * reflows on pan/zoom because the effect re-runs on `transform`.
 *
 * ADR-040: this component takes `transform`/`viewport` as PROPS and does NOT subscribe to any
 * high-freq store — the parent micro-leaf owns the (low-freq) grid-visibility subscription.
 */

'use client';

import { useEffect, useRef } from 'react';
import { CoordinateTransforms as CT } from '../../rendering/core/CoordinateTransforms';
import { CanvasUtils } from '../../rendering/canvas/utils/CanvasUtils';
import { buildTopoGrid, pickSurveyGridStepMm, type WorldRectMm } from '../../systems/topography/topo-grid-model';
import { formatGridCoordinate } from '../../systems/topography/topo-grid-entities';
import {
  TOPO_GRID_COLOR, TOPO_GRID_LABEL_COLOR, TOPO_GRID_CROSS_SCREEN_PX, TOPO_GRID_LABEL_FONT,
} from '../../systems/topography/topo-grid-config';
import type { ViewTransform } from '../../rendering/types/Types';

export interface TopoGridUnderlayCanvasProps {
  /** Live view transform (prop, not a store subscription — ADR-040). */
  transform: ViewTransform;
  viewport: { width: number; height: number };
  /** Whether the graticule is shown (owned by the micro-leaf's low-freq store subscription). */
  visible: boolean;
  className?: string;
}

/** Padding (px) from the frame edge to the coordinate numbering. */
const LABEL_EDGE_PAD = 4;

/** The world rectangle currently visible, derived from the two opposite screen corners. */
function visibleWorldRect(transform: ViewTransform, viewport: { width: number; height: number }): WorldRectMm {
  const a = CT.screenToWorld({ x: 0, y: 0 }, transform, viewport);
  const b = CT.screenToWorld({ x: viewport.width, y: viewport.height }, transform, viewport);
  return {
    minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x),
    minY: Math.min(a.y, b.y), maxY: Math.max(a.y, b.y),
  };
}

/** Draw a small «+» at every round grid intersection. */
function drawCrosses(
  ctx: CanvasRenderingContext2D, crosses: readonly { x: number; y: number }[],
  transform: ViewTransform, viewport: { width: number; height: number },
): void {
  const a = TOPO_GRID_CROSS_SCREEN_PX;
  ctx.strokeStyle = TOPO_GRID_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const c of crosses) {
    const s = CT.worldToScreen(c, transform, viewport);
    ctx.moveTo(s.x - a, s.y); ctx.lineTo(s.x + a, s.y);
    ctx.moveTo(s.x, s.y - a); ctx.lineTo(s.x, s.y + a);
  }
  ctx.stroke();
}

/** Easting numbering along the top edge; Northing numbering along the right edge. */
function drawEdgeLabels(
  ctx: CanvasRenderingContext2D, eastings: readonly number[], northings: readonly number[],
  transform: ViewTransform, viewport: { width: number; height: number },
): void {
  ctx.fillStyle = TOPO_GRID_LABEL_COLOR;
  ctx.font = TOPO_GRID_LABEL_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const e of eastings) {
    const s = CT.worldToScreen({ x: e, y: 0 }, transform, viewport);
    ctx.fillText(formatGridCoordinate(e), s.x, LABEL_EDGE_PAD);
  }
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const n of northings) {
    const s = CT.worldToScreen({ x: 0, y: n }, transform, viewport);
    ctx.fillText(formatGridCoordinate(n), viewport.width - LABEL_EDGE_PAD, s.y);
  }
}

export function TopoGridUnderlayCanvas({
  transform, viewport, visible, className,
}: TopoGridUnderlayCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // DPR-aware backing store via the SAME primitive as the sibling canvases (ADR-040).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    CanvasUtils.sizeCanvasToViewport(canvas, viewport);
  }, [viewport.width, viewport.height]);

  // Repaint only when the transform / viewport / visibility change (no continuous RAF).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, viewport.width, viewport.height);
    if (!visible || viewport.width === 0 || viewport.height === 0) return;

    const rect = visibleWorldRect(transform, viewport);
    const stepMm = pickSurveyGridStepMm(transform.scale);
    const grid = buildTopoGrid(rect, stepMm);
    drawCrosses(ctx, grid.crosses, transform, viewport);
    drawEdgeLabels(ctx, grid.eastings, grid.northings, transform, viewport);
  }, [transform, viewport, visible]);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
}
