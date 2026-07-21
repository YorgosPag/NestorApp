/**
 * USE COPY PREVIEW — Ghost entity rendering during the 2-click COPY operation
 *
 * ADR-577 / ADR-363 R1: Unified interactive COPY tool
 * ADR-040: Preview Canvas Performance (imperative API, RAF, no React re-renders)
 *
 * Twin of {@link useMovePreview}, built on the shared `useTranslationGhostPreview`
 * harness so the two cannot diverge on scaffolding (N.18). Draws, while the ribbon
 * «Αντιγραφή» tool collects its base + target picks:
 *   - Base point crosshair marker (red)     — harness (shared SSoT painter)
 *   - Rubber band line: base point → cursor (dashed gold) — shared SSoT painter
 *   - Solid WYSIWYG copies of the selection at the target delta
 *
 * DIFFERENCE FROM MOVE: a COPY keeps the ORIGINAL in place (it is duplicated, not
 * relocated), so the source is NEVER dimmed — only the moving CLONE ghost is drawn
 * at the destination. The renderer paints the source solid because the copy path
 * never sets `movePreviewActive` (unlike the Move tool). The delta is the RAW
 * `cursor − base` (no ORTHO/AutoAlign), byte-identical to the commit in
 * `useCopyTool.handleCopyClick` → guaranteed WYSIWYG (preview ≡ committed clone).
 *
 * @see hooks/tools/useMovePreview.ts — the preview twin this mirrors
 * @see hooks/tools/useCopyTool.ts — the FSM that feeds phase/basePoint
 * @module hooks/tools/useCopyPreview
 */

import { useCallback } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import { drawRubberBandWorld } from '../../canvas-v2/preview-canvas/rubber-band-paint';
import type { CopyPhase } from './useCopyTool';
import type { LevelSceneReader } from '../../systems/levels/level-scene-accessor';
// SSoT translated-selection ghost loop (deep import — pulls in the full EntityRendererComposite).
import { drawTranslatedEntitiesPreview } from '../../rendering/ghost/draw-real-entity-preview';
import {
  useTranslationGhostPreview,
  type TranslationGhostDrawFrame,
} from './use-translation-ghost-preview';

export interface UseCopyPreviewProps {
  phase: CopyPhase;
  basePoint: Point2D | null;
  selectedEntityIds: string[];
  levelManager: LevelSceneReader;
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement?: () => HTMLElement | null;
}

const PREVIEW_PHASES: ReadonlySet<CopyPhase> = new Set([
  'awaiting-base-point',
  'awaiting-target-point',
]);

export function useCopyPreview(props: UseCopyPreviewProps): void {
  const { phase, basePoint, selectedEntityIds, levelManager, transform, getCanvas, getViewportElement } = props;

  const drawFrame = useCallback(({ ctx, basePoint: base, effectiveCursor, viewport, transform: t, deps }: TranslationGhostDrawFrame) => {
    // RAW destination (no ORTHO/AutoAlign) — the exact delta useCopyTool commits, so the
    // rubber band, ghost and committed clone all land on the same point (WYSIWYG).
    const destination = effectiveCursor;

    // Rubber band (dashed gold) — shared SSoT paint (CHECK 3.28 de-dup with Move/Rotation).
    drawRubberBandWorld(ctx, base, destination, t, viewport);

    // Solid clone ghost only once we are collecting the target point. The ORIGINAL stays
    // SOLID at its source (a copy duplicates, it does not relocate → no `movePreviewActive`
    // dimming); only the clone ghost lands at the destination (ADR-550 WYSIWYG fidelity).
    if (phase !== 'awaiting-target-point') return;

    const delta: Point2D = { x: destination.x - base.x, y: destination.y - base.y };
    drawTranslatedEntitiesPreview({
      ctx,
      bimPreview: deps.getBimPreview(ctx),
      selectedEntityIds,
      delta,
      getEntity: deps.getEntity,
      layersById: deps.getLayersById(),
      transform: t,
      viewport,
    });
  }, [phase, selectedEntityIds]);

  useTranslationGhostPreview({
    isActive: PREVIEW_PHASES.has(phase),
    basePoint,
    levelManager,
    transform,
    getCanvas,
    getViewportElement,
    drawFrame,
  });
}
