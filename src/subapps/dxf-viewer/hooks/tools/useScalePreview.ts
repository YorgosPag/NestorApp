/**
 * USE SCALE PREVIEW — ADR-348
 *
 * Renders semi-transparent ghost entities scaled around the base point. Thin
 * binding over the shared {@link useTransformGhostPreview} draw-skeleton (Cluster
 * #16 SSoT, ADR-625): the base-point crosshair, rubber-band and tooltip chrome
 * live in the primitive. Here we bind only the SCALE specifics — the live scale
 * factor (from cursor distance) and the per-entity `scaleEntity` copies rendered
 * through the REAL entity renderer (ADR-550, incl. circle → ellipse).
 *
 * @module hooks/tools/useScalePreview
 * @see hooks/tools/use-transform-ghost-preview — shared transform draw-skeleton (ADR-625)
 */

import { useCallback, useRef } from 'react';
import type { ViewTransform } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import { ScaleToolStore, type ScaleToolState } from '../../systems/scale/ScaleToolStore';
// ADR-348 SSoT — the SAME per-entity scale the commit (`ScaleEntityCommand`) applies, so the
// WYSIWYG preview cannot diverge from the committed result (incl. circle → ellipse).
import { scaleEntity } from '../../systems/scale/scale-entity-transform';
// ADR-646 #1 SSoT — the live drag factor shared verbatim with the tooltip + click-commit.
import { computeLiveScale } from '../../systems/scale/scale-reference-calc';
// ADR-646 Φάση 5 — drag-preview LOD: bound the O(N)-per-frame real-render on huge selections.
import {
  resolveScalePreviewLod, sampleIds, computeUnionBBox, scaleBBoxAboutBase, buildExtentBoxEntity,
  SCALE_PREVIEW_SAMPLE_COUNT, type PreviewBBox,
} from '../../systems/scale/scale-preview-lod';
// ADR-550 (WYSIWYG) — moving copies render through the REAL entity renderer (full fidelity).
import { drawRealEntityPreview } from '../../rendering/ghost/draw-real-entity-preview';
import type { LevelSceneReader } from '../../systems/levels/level-scene-accessor';
import { useTransformGhostPreview, type TransformGhostFrame } from './use-transform-ghost-preview';
// ADR-646 Φ6 — scale-about-base is a pure affine → the O(1)/frame matrix-ghost world affine.
import { scaleAboutBaseWorldAffine, type MatrixGhostConfig } from './transform-ghost-matrix-cache';

export interface UseScalePreviewProps {
  levelManager: LevelSceneReader;
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement?: () => HTMLElement | null;
}

/**
 * ADR-646 #1 — capture the drag reference on the first real move sample (factor 1 at start), so the
 * live ratio is shared verbatim with the tooltip + click-commit. One guarded write per drag. Shared by
 * BOTH the matrix-ghost path (`getWorldAffine`) and the `renderCopies` fallback so they cannot diverge.
 */
function captureDragRef(s: ScaleToolState, cursor: { x: number; y: number }, basePoint: { x: number; y: number }): void {
  if (s.subPhase !== 'direct' || s.dragRefPoint) return;
  if (Math.hypot(cursor.x - basePoint.x, cursor.y - basePoint.y) > 1e-6) {
    ScaleToolStore.setDragRefPoint({ x: cursor.x, y: cursor.y });
  }
}

/**
 * ADR-646 Φ6 — the O(1)/frame matrix path. `getWorldAffine` shares the SAME `computeLiveScale` factor as
 * the tooltip/commit, applied uniformly about the base (non-uniform axes would flow through here too →
 * circle→ellipse). Fully static (args + module-level deps only) → hoisted, zero per-render allocation.
 * The primitive captures the ghost once and blits it; the `renderCopies` fallback still runs for oversize
 * selections (Φ.5 LOD).
 */
const SCALE_MATRIX_GHOST: MatrixGhostConfig<ScaleToolState> = {
  getIds: (s) => s.selectedEntityIds,
  getWorldAffine: (s, cursor, basePoint) => {
    captureDragRef(s, cursor, basePoint);
    const live = computeLiveScale(s, cursor, basePoint);
    return scaleAboutBaseWorldAffine(basePoint, live, live);
  },
};

export function useScalePreview(props: UseScalePreviewProps): void {
  const { levelManager, transform, getCanvas, getViewportElement } = props;

  // ADR-646 Φάση 5 — the selection's UNSCALED union bbox is constant for a whole drag, so cache it
  // (keyed by the selection array identity, stable per scale op) → only the O(1) per-frame scaling
  // runs, never an O(N) bbox rescan. Recomputed lazily when the selection reference changes.
  const unionRef = useRef<{ ids: readonly string[]; bbox: PreviewBBox | null } | null>(null);

  // ADR-641 — `getEntity` (BEDIT-aware, VIEW-space members) is supplied by the harness frame.
  const renderCopies = useCallback(
    ({ state: s, cursor, basePoint, transform: t, viewport, bimPreview, layers, getEntity }: TransformGhostFrame<ScaleToolState>) => {
      captureDragRef(s, cursor, basePoint);
      const live = computeLiveScale(s, cursor, basePoint);
      const ids = s.selectedEntityIds;

      // One entity → its scaled WYSIWYG copy (the SSoT scale, so preview ≡ commit; ADR-348/550).
      const drawGhost = (entityId: string): void => {
        const entity = getEntity(entityId);
        if (!entity) return;
        const scaled = {
          ...(entity as object),
          ...scaleEntity(entity as Entity, basePoint, live, live),
        } as unknown as DxfEntityUnion;
        drawRealEntityPreview(bimPreview, scaled, layers, t, viewport);
      };

      // ADR-646 Φάση 5 — full WYSIWYG under the cap; above it, a stride-sampled subset + the overall
      // transformed extent box (AutoCAD «simplified drag preview»), so the per-frame cost is bounded
      // and the browser stays responsive on thousand-entity selections. Commit still bakes them all.
      if (resolveScalePreviewLod(ids.length) === 'full') {
        for (const entityId of ids) drawGhost(entityId);
        return;
      }
      for (const entityId of sampleIds(ids, SCALE_PREVIEW_SAMPLE_COUNT)) drawGhost(entityId);
      if (!unionRef.current || unionRef.current.ids !== ids) {
        unionRef.current = { ids, bbox: computeUnionBBox(ids, getEntity as (id: string) => DxfEntityUnion | null) };
      }
      const union = unionRef.current.bbox;
      if (union) {
        const box = scaleBBoxAboutBase(union, basePoint, live, live);
        drawRealEntityPreview(bimPreview, buildExtentBoxEntity(box), layers, t, viewport);
      }
    },
    [],
  );

  useTransformGhostPreview<ScaleToolState>({
    store: ScaleToolStore,
    levelManager,
    transform,
    getCanvas,
    getViewportElement,
    isActivePhase: (phase) => phase !== 'idle',
    isDrawPhase: (s) => s.phase === 'scale_input',
    getBasePoint: (s) => s.basePoint,
    buildTooltip: (s, cursor, basePoint) => `×${computeLiveScale(s, cursor, basePoint).toFixed(3)}`,
    renderCopies,
    matrixGhost: SCALE_MATRIX_GHOST,
  });
}
