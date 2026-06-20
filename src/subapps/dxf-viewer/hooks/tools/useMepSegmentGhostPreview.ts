/**
 * ADR-408 Φ8 — MEP segment 2D placement ghost preview hook.
 *
 * Migrated to the shared `useCanvasGhostPreview` harness (ADR-398 §4): το RAF
 * lifecycle + DPR-clear + canonical viewport/transform + snapped-cursor ζουν πλέον
 * ΜΙΑ φορά στο harness· εδώ μένει ΜΟΝΟ η draw logic (rubber-band segment outline).
 *
 * This is a 2-click placement tool (like a wall or beam, NOT a point element like
 * the fixture). The hook is active only during `isAwaitingEnd` (the first click has
 * been made and we are waiting for the second). `getGhostSegment` provides the start
 * point + current section width; the cursor provides the end point live.
 *
 * OSNAP support: when a snap hit is present the effective cursor locks to the
 * snapped point — matches the committed second-click point (WYSIWYG).
 *
 * @see bim/mep-segments/MepSegmentGhostRenderer.ts — pure canvas renderer
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ8
 * @see hooks/tools/useCanvasGhostPreview — shared RAF/clear/viewport harness (ADR-398 §4)
 */

import { useCallback } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import { MepSegmentGhostRenderer } from '../../bim/mep-segments/MepSegmentGhostRenderer';
import type { MepSegmentDomain } from '../../bim/types/mep-segment-types';
import { useCanvasGhostPreview } from './useCanvasGhostPreview';
import type { GhostDrawFrame } from '../../systems/preview/ghost-preview-frame';

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
  /** Viewport element for size measurement; falls back to `getCanvas` (handled by harness). */
  getViewportElement?(): HTMLElement | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMepSegmentGhostPreview(
  props: Readonly<UseMepSegmentGhostPreviewProps>,
): void {
  const { isAwaitingEnd, transform, getGhostSegment, getCanvas, getViewportElement } = props;

  const draw = useCallback(({ ctx, effectiveCursor, viewport, transform: t }: GhostDrawFrame) => {
    if (!effectiveCursor) return;
    const spec = getGhostSegment(effectiveCursor);
    if (!spec) return;
    new MepSegmentGhostRenderer(ctx).render({
      startPoint: spec.startPoint,
      cursor: effectiveCursor,
      sectionWidthCanvas: spec.sectionWidthCanvas,
      domain: spec.domain,
      transform: t,
      viewport,
    });
  }, [getGhostSegment]);

  useCanvasGhostPreview({
    isActive: isAwaitingEnd,
    getCanvas,
    getViewportElement,
    transform,
    useImmediateSnap: true,
    draw,
  });
}
