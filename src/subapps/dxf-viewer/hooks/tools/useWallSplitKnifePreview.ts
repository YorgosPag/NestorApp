/**
 * USE WALL SPLIT KNIFE PREVIEW — ADR-363 Phase 5.6 (knife-line live preview)
 *
 * Draws, on the shared PreviewCanvas, the wall-split knife rubber-band:
 *   • a dashed segment from the first click point to the (snapped) live cursor,
 *   • a marker at the first point,
 *   • a bright perpendicular indicator across every wall the segment would cut,
 *     computed with the SAME geometry the second click commits (preview ≡ commit).
 *
 * Reuses the shared `useCanvasGhostPreview` harness (ADR-398 §4): RAF lifecycle,
 * DPR-clear, canonical viewport/transform and the live snapped cursor all live in
 * the harness — only the draw delegate lives here. Zero React state on the
 * mouse-move path (ADR-040).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §Phase 5.6
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import { useCallback } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { WallEntity } from '../../bim/types/wall-types';
import { isWallEntity } from '../../types/entities';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import {
  computeSplitOffset,
  computeSplitIndicatorLine,
  wallsCrossedBySegment,
} from '../../bim/walls/wall-split';
import { useCanvasGhostPreview } from './useCanvasGhostPreview';
import type { GhostDrawFrame } from '../../systems/preview/ghost-preview-frame';
// 🏢 ADR-571: tool-anchor/cut-indicator cyan SSoT
import { TOOL_ANCHOR_CYAN } from '../../config/color-config';
import type { LevelSceneReader } from '../../systems/levels/level-scene-accessor';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UseWallSplitKnifePreviewProps {
  /** First knife point (world coords), or null while awaiting the first click. */
  firstPoint: Point2D | null;
  levelManager: LevelSceneReader;
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement?: () => HTMLElement | null;
}

// Knife styling (canvas literals, consistent with useMirrorPreview siblings).
const KNIFE_LINE = '#FF4444';
const KNIFE_POINT = '#FFD700';
const CUT_INDICATOR = TOOL_ANCHOR_CYAN;

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useWallSplitKnifePreview(props: UseWallSplitKnifePreviewProps): void {
  const { firstPoint, levelManager, transform, getCanvas, getViewportElement } = props;

  const getWalls = useCallback((): WallEntity[] => {
    if (!levelManager.currentLevelId) return [];
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene?.entities) return [];
    return scene.entities.filter(isWallEntity) as WallEntity[];
  }, [levelManager]);

  const draw = useCallback(({ ctx, effectiveCursor, viewport, transform: t }: GhostDrawFrame) => {
    if (!firstPoint || !effectiveCursor) return;

    const toScreen = (p: Point2D) => CoordinateTransforms.worldToScreen(p, t, viewport);
    const p1 = toScreen(firstPoint);
    const p2 = toScreen(effectiveCursor);

    // Knife segment (dashed).
    ctx.save();
    ctx.strokeStyle = KNIFE_LINE;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // First-point marker (X).
    ctx.save();
    ctx.strokeStyle = KNIFE_POINT;
    ctx.lineWidth = 2;
    const mk = 7;
    ctx.beginPath();
    ctx.moveTo(p1.x - mk, p1.y - mk);
    ctx.lineTo(p1.x + mk, p1.y + mk);
    ctx.moveTo(p1.x - mk, p1.y + mk);
    ctx.lineTo(p1.x + mk, p1.y - mk);
    ctx.stroke();
    ctx.restore();

    // Per-crossing cut indicators (only walls that will actually split).
    const crossings = wallsCrossedBySegment(getWalls(), firstPoint, effectiveCursor);
    if (crossings.length === 0) return;

    ctx.save();
    ctx.strokeStyle = CUT_INDICATOR;
    ctx.lineWidth = 2.5;
    for (const { wall, intersectionPoint } of crossings) {
      if (computeSplitOffset(wall, intersectionPoint) === null) continue; // won't cut → no marker
      const [a, b] = computeSplitIndicatorLine(wall, intersectionPoint);
      const sa = toScreen(a);
      const sb = toScreen(b);
      ctx.beginPath();
      ctx.moveTo(sa.x, sa.y);
      ctx.lineTo(sb.x, sb.y);
      ctx.stroke();
    }
    ctx.restore();
  }, [firstPoint, getWalls]);

  useCanvasGhostPreview({
    isActive: firstPoint !== null,
    getCanvas,
    getViewportElement,
    transform,
    useImmediateSnap: true, // preview ≡ commit (the click point is centrally snapped)
    draw,
  });
}
