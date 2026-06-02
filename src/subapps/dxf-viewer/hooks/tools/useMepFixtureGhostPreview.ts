/**
 * ADR-406 — MEP fixture 2D placement ghost preview hook (RAF-driven).
 *
 * Mirror of `useColumnGhostPreview`: a micro-leaf consumer that subscribes to
 * `useCursorWorldPosition` and paints the translucent fixture footprint directly
 * onto the preview canvas (CSS pixels with DPR transform), animated via RAF — no
 * React re-renders above this leaf (ADR-040 cardinal rule).
 *
 * The footprint comes from `useMepFixtureTool().getGhostFootprint`, so the
 * preview is byte-for-byte what a click commits (WYSIWYG). The snapped cursor is
 * used when OSNAP hits, matching the committed point (mirror column).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-406-point-based-mep-fixture.md
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import { useCallback, useEffect, useRef } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import { useCursorWorldPosition } from '../../systems/cursor/useCursor';
import { getImmediateSnap } from '../../systems/cursor/ImmediateSnapStore';
import { MepFixtureGhostRenderer } from '../../bim/mep-fixtures/MepFixtureGhostRenderer';

export interface UseMepFixtureGhostPreviewProps {
  readonly isAwaitingPosition: boolean;
  readonly transform: ViewTransform;
  /** Footprint projection getter — from `useMepFixtureTool().getGhostFootprint`. */
  getGhostFootprint(cursorPos: Readonly<Point2D> | null): readonly Point3D[] | null;
  getCanvas(): HTMLCanvasElement | null;
  /** Viewport element for size; falls back to `getCanvas` (mirror column). */
  getViewportElement?(): HTMLElement | null;
}

export function useMepFixtureGhostPreview(props: Readonly<UseMepFixtureGhostPreviewProps>): void {
  const { isAwaitingPosition, transform, getGhostFootprint, getCanvas, getViewportElement } = props;
  const cursorWorld = useCursorWorldPosition();
  const rafRef = useRef<number>(0);
  const prevActiveRef = useRef<boolean>(false);

  const clearCanvas = useCallback(() => {
    const canvas = getCanvas();
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, [getCanvas]);

  const drawFrame = useCallback(() => {
    const canvas = getCanvas();
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (!isAwaitingPosition || !cursorWorld) return;
    // Use the snapped position when OSNAP hit, so the ghost locks to the same
    // point the commit will use (mirror column Phase 4.5c.4). Read imperatively
    // inside RAF — the synchronous mouse-move handler has already written it.
    const snapState = getImmediateSnap();
    const effectiveCursor: Point2D =
      snapState?.found === true && snapState.point != null ? snapState.point : cursorWorld;
    const footprint = getGhostFootprint(effectiveCursor);
    if (!footprint || footprint.length < 3) return;

    const viewportElement = getViewportElement?.() ?? canvas;
    const rect = viewportElement.getBoundingClientRect();
    const viewport = { width: rect.width, height: rect.height };

    const renderer = new MepFixtureGhostRenderer(ctx);
    renderer.render({
      footprint: footprint.map((v) => ({ x: v.x, y: v.y })),
      cursor: effectiveCursor,
      transform,
      viewport,
    });
  }, [isAwaitingPosition, transform, getGhostFootprint, getCanvas, getViewportElement, cursorWorld]);

  // Clear stale ghost on transition out of awaitingPosition.
  useEffect(() => {
    const wasActive = prevActiveRef.current;
    if (wasActive && !isAwaitingPosition) clearCanvas();
    prevActiveRef.current = isAwaitingPosition;
  }, [isAwaitingPosition, clearCanvas]);

  // Schedule one draw per cursor / state change while active.
  useEffect(() => {
    if (!isAwaitingPosition) return;
    rafRef.current = requestAnimationFrame(drawFrame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isAwaitingPosition, drawFrame]);
}
