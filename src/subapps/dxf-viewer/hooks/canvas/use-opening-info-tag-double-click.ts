'use client';

/**
 * ADR-612 — Opening Info Tag inline-cell double-click opener.
 *
 * The numeric-cell counterpart of `useTextDoubleClickEditor` (ADR-344 Phase 6.E):
 * a double-click on an `OpeningInfoTagEntity` opens a lightweight numeric `<input>`
 * over the specific cell that was clicked (top = Μήκος, bottom-left = Ποδιά,
 * bottom-right = Ύψος). Instead of holding React state (the text editor's model),
 * this hook is a THIN opener that pushes into the canvas-anchored
 * `opening-info-tag-editor-store` — the overlay owns the commit.
 *
 * Selection-driven trigger (mirrors the text editor): fires only when exactly one
 * entity is selected AND it is an opening-info-tag. The clicked cell is resolved
 * from the WORLD point of the double-click via `openingInfoTagCellAtWorld`.
 *
 * Coordinate SSoT: the cell's screen rect is derived from the SAME margin-aware
 * `CoordinateTransforms.worldToScreen` the renderer uses (`BaseEntityRenderer`),
 * so the `<input>` lands exactly over the rendered cell (not the text editor's
 * no-margin inline formula).
 *
 * ADR-040 note: local, event-time only — no `useSyncExternalStore`, no
 * high-frequency subscription. Safe to consume in the orchestrator path.
 */

import { useCallback, useMemo } from 'react';
import type React from 'react';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { useCurrentLevelScene } from '../../systems/levels';
import { isOpeningInfoTagEntity } from '../../types/opening-info-tag';
import {
  openingInfoTagCellAtWorld,
  openingInfoTagCellText,
  openingInfoTagFrameToWorld,
} from '../../bim/opening-info-tag/opening-info-tag-geometry';
import { openOpeningInfoTagCellEditor } from '../../state/opening-info-tag-editor-store';
import type { OpeningInfoTagCellRect, OpeningInfoTagEntity } from '../../types/opening-info-tag';
import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';

interface UseOpeningInfoTagDoubleClickParams {
  readonly transformRef: React.RefObject<ViewTransform>;
  readonly containerRef: React.RefObject<HTMLDivElement | null>;
  readonly getSelectedEntityIds: () => readonly string[];
}

interface OpeningInfoTagDoubleClickApi {
  /** Returns `true` when it opened a cell editor (caller should stop the chain). */
  readonly handleDoubleClick: (event: React.MouseEvent<HTMLDivElement>) => boolean;
}

/** Screen rect (viewport `position:fixed` pixels) of a cell — centred on the cell. */
function cellAnchorRect(
  entity: OpeningInfoTagEntity,
  rect: OpeningInfoTagCellRect,
  transform: ViewTransform,
  container: HTMLDivElement,
): { x: number; y: number; width: number; height: number } {
  const containerRect = container.getBoundingClientRect();
  const viewport: Viewport = { width: containerRect.width, height: containerRect.height };
  const world = openingInfoTagFrameToWorld(entity, rect.center.u, rect.center.v);
  // Margin-aware world→screen (SAME transform as BaseEntityRenderer) → canvas-local px.
  const local = CoordinateTransforms.worldToScreen(world, transform, viewport);
  const width = rect.halfWidth * 2 * transform.scale;
  const height = rect.halfHeight * 2 * transform.scale;
  return {
    x: containerRect.left + local.x - width / 2,
    y: containerRect.top + local.y - height / 2,
    width,
    height,
  };
}

export function useOpeningInfoTagDoubleClick(
  params: UseOpeningInfoTagDoubleClickParams,
): OpeningInfoTagDoubleClickApi {
  const { transformRef, containerRef, getSelectedEntityIds } = params;
  const scene = useCurrentLevelScene();

  const handleDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>): boolean => {
      const ids = getSelectedEntityIds();
      if (ids.length !== 1) return false;
      const entity = scene?.entities.find((e) => e.id === ids[0]) ?? null;
      if (!entity || !isOpeningInfoTagEntity(entity)) return false;

      const container = containerRef.current;
      const transform = transformRef.current;
      if (!container || !transform) return false;

      // World point of the double-click (margin-aware inverse of the renderer).
      const containerRect = container.getBoundingClientRect();
      const viewport: Viewport = { width: containerRect.width, height: containerRect.height };
      const worldPoint: Point2D = CoordinateTransforms.screenToWorld(
        { x: event.clientX - containerRect.left, y: event.clientY - containerRect.top },
        transform,
        viewport,
      );

      const cellRect = openingInfoTagCellAtWorld(entity, worldPoint);
      if (!cellRect) return false;

      const anchorRect = cellAnchorRect(entity, cellRect, transform, container);
      openOpeningInfoTagCellEditor(
        entity.id,
        cellRect.cell,
        anchorRect,
        openingInfoTagCellText(entity, cellRect.cell),
      );
      return true;
    },
    [scene, getSelectedEntityIds, transformRef, containerRef],
  );

  return useMemo(() => ({ handleDoubleClick }), [handleDoubleClick]);
}
