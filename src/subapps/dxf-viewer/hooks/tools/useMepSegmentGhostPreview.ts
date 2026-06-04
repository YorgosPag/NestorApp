/**
 * ADR-408 Φ8 — MEP segment 2D placement ghost preview hook (RAF-driven).
 *
 * Micro-leaf consumer (ADR-040 pattern) that subscribes to
 * `useCursorWorldPosition` and paints the translucent segment rubber-band
 * outline directly onto the preview canvas, animated via RAF — no React
 * re-renders above this leaf on mousemove.
 *
 * This is a 2-click placement tool (like a wall or beam, NOT a point element
 * like the fixture). The hook is active only during `isAwaitingEnd` (the first
 * click has been made and we are waiting for the second). `getGhostSegment`
 * provides the start point + current section width; the cursor provides the
 * end point live.
 *
 * OSNAP support: when a snap hit is present the effective cursor locks to the
 * snapped point — matches the committed second-click point (WYSIWYG).
 *
 * @see bim/mep-segments/MepSegmentGhostRenderer.ts — pure canvas renderer
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ8
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import { useCallback, useEffect, useRef } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import { useCursorWorldPosition } from '../../systems/cursor/useCursor';
import { getImmediateSnap } from '../../systems/cursor/ImmediateSnapStore';
import { MepSegmentGhostRenderer } from '../../bim/mep-segments/MepSegmentGhostRenderer';
import type { MepSegmentDomain } from '../../bim/types/mep-segment-types';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface GhostSegmentSpec {
  /** Fixed start point (world canvas units) — the first-click position. */
  readonly startPoint: Point2D;
  /**
   * Section width in canvas units (derived from the current tool params:
   * `resolveSegmentSection(params).widthMm * mmToSceneUnits(sceneUnits)`).
   */
  readonly sectionWidthCanvas: number;
  /** Domain — drives the palette colour. */
  readonly domain: MepSegmentDomain;
}

export interface UseMepSegmentGhostPreviewProps {
  /**
   * True when the first click has been made and the tool is waiting for the
   * second click (end point). Ghost is drawn only in this phase.
   */
  readonly isAwaitingEnd: boolean;
  readonly transform: ViewTransform;
  /**
   * Getter called each RAF frame with the current cursor position (may be null
   * when the cursor is outside the canvas). Returns the fixed start spec or
   * null when no preview should be drawn (e.g. no start point committed yet).
   */
  getGhostSegment(cursorPos: Readonly<Point2D> | null): GhostSegmentSpec | null;
  getCanvas(): HTMLCanvasElement | null;
  /** Viewport element for size measurement; falls back to `getCanvas`. */
  getViewportElement?(): HTMLElement | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMepSegmentGhostPreview(
  props: Readonly<UseMepSegmentGhostPreviewProps>,
): void {
  const { isAwaitingEnd, transform, getGhostSegment, getCanvas, getViewportElement } = props;
  // SSoT gate (ADR-040): subscribe to the 60fps cursor stream only while awaiting the end point.
  const cursorWorld = useCursorWorldPosition(isAwaitingEnd);
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

    if (!isAwaitingEnd || !cursorWorld) return;

    // Prefer snapped cursor position when OSNAP hit (WYSIWYG with commit).
    const snapState = getImmediateSnap();
    const effectiveCursor: Point2D =
      snapState?.found === true && snapState.point != null
        ? snapState.point
        : cursorWorld;

    const spec = getGhostSegment(effectiveCursor);
    if (!spec) return;

    const viewportElement = getViewportElement?.() ?? canvas;
    const rect = viewportElement.getBoundingClientRect();
    const viewport = { width: rect.width, height: rect.height };

    const renderer = new MepSegmentGhostRenderer(ctx);
    renderer.render({
      startPoint: spec.startPoint,
      cursor: effectiveCursor,
      sectionWidthCanvas: spec.sectionWidthCanvas,
      domain: spec.domain,
      transform,
      viewport,
    });
  }, [isAwaitingEnd, transform, getGhostSegment, getCanvas, getViewportElement, cursorWorld]);

  // Clear stale ghost on transition out of awaitingEnd.
  useEffect(() => {
    const wasActive = prevActiveRef.current;
    if (wasActive && !isAwaitingEnd) clearCanvas();
    prevActiveRef.current = isAwaitingEnd;
  }, [isAwaitingEnd, clearCanvas]);

  // Schedule one draw per cursor / state change while active.
  useEffect(() => {
    if (!isAwaitingEnd) return;
    rafRef.current = requestAnimationFrame(drawFrame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isAwaitingEnd, drawFrame]);
}
