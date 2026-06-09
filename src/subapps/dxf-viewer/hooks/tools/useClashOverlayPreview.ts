/**
 * ⚠️  ADR-040 preview-performance contract — READ BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-435 Slice 1 — clash-detection **overlay** preview hook.
 *
 * Micro-leaf consumer (ADR-040) that subscribes to the LOW-FREQUENCY
 * `useClashReport()` store and paints a severity-coloured marker at every clash
 * point (plan projection) plus a count badge, while a report is under review
 * (Revit/Navisworks "Run → review"). Like `useWaterProposalGhostPreview` it does
 * NOT subscribe to the 60 fps cursor — the report changes only on Detect / Clear,
 * so a repaint is scheduled solely on report change + pan/zoom (`transform`).
 *
 * Clash points are produced by the engine in metres; they are converted back to
 * canvas units (÷ sceneUnitsToMeters) then projected with the shared
 * `CoordinateTransforms.worldToScreen` — same path the entity renderers use.
 *
 * @see ../../systems/coordination/clash-report-store.ts — low-freq source
 * @see ../../rendering/core/CoordinateTransforms.ts — shared world→screen SSoT
 */

import { useCallback, useEffect, useRef } from 'react';
import type { ViewTransform } from '../../rendering/types/Types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { useClashReport } from '../../systems/coordination/clash-report-store';
import { sceneUnitsToMeters } from '../../utils/scene-units';
import { CLASH_SEVERITY_COLOR } from '../../systems/coordination/clash-severity-color';

const MARKER_RADIUS_PX = 7;
const BADGE_FONT = '600 13px system-ui, sans-serif';

export interface UseClashOverlayPreviewProps {
  readonly transform: ViewTransform;
  getCanvas(): HTMLCanvasElement | null;
  getViewportElement?(): HTMLElement | null;
}

export function useClashOverlayPreview(props: Readonly<UseClashOverlayPreviewProps>): void {
  const { transform, getCanvas, getViewportElement } = props;
  const review = useClashReport();
  const rafRef = useRef<number>(0);
  const prevActiveRef = useRef<boolean>(false);
  const active = review !== null;

  const clearCanvas = useCallback(() => {
    const canvas = getCanvas();
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, [getCanvas]);

  const drawFrame = useCallback(() => {
    const canvas = getCanvas();
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!review) return;

    const viewportElement = getViewportElement?.() ?? canvas;
    const rect = viewportElement.getBoundingClientRect();
    const viewport = { width: rect.width, height: rect.height };
    const toCanvas = 1 / sceneUnitsToMeters(review.sceneUnits);

    for (const clash of review.report.clashes) {
      const world = { x: clash.point.x * toCanvas, y: clash.point.y * toCanvas };
      const screen = CoordinateTransforms.worldToScreen(world, transform, viewport);
      drawMarker(ctx, screen.x, screen.y, CLASH_SEVERITY_COLOR[clash.severity], clash.type === 'clearance');
    }
    drawBadge(ctx, review.report.clashes.length);
  }, [review, transform, getCanvas, getViewportElement]);

  // Clear once when the review ends (Clear).
  useEffect(() => {
    const wasActive = prevActiveRef.current;
    if (wasActive && !active) clearCanvas();
    prevActiveRef.current = active;
  }, [active, clearCanvas]);

  // Repaint on report change + pan/zoom while a review is active.
  useEffect(() => {
    if (!active) return;
    rafRef.current = requestAnimationFrame(drawFrame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, drawFrame]);
}

/** A ring + crosshair at a clash point; dashed ring marks a soft (clearance) clash. */
function drawMarker(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, soft: boolean): void {
  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.fillStyle = `${color}33`;
  if (soft) ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.arc(x, y, MARKER_RADIUS_PX, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x - MARKER_RADIUS_PX, y);
  ctx.lineTo(x + MARKER_RADIUS_PX, y);
  ctx.moveTo(x, y - MARKER_RADIUS_PX);
  ctx.lineTo(x, y + MARKER_RADIUS_PX);
  ctx.stroke();
  ctx.restore();
}

/** Top-left count badge so the result is legible without a side panel (v1). */
function drawBadge(ctx: CanvasRenderingContext2D, count: number): void {
  ctx.save();
  ctx.font = BADGE_FONT;
  const label = String(count);
  const padX = 8;
  const w = ctx.measureText(label).width + padX * 2 + 18;
  ctx.fillStyle = count > 0 ? 'rgba(220, 38, 38, 0.92)' : 'rgba(22, 163, 74, 0.92)';
  roundRectPath(ctx, 12, 12, w, 26, 6);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`⚠ ${label}`, 20, 30);
  ctx.restore();
}

/** Rounded-rect subpath via arcTo (avoids the newer `ctx.roundRect` DOM API). */
function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
