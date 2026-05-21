// ============================================================================
// ♿ FOCUS ORDER 2D — pure helpers (ADR-366 Phase 4.6 / A.7.Q1)
// ============================================================================
//
// Mirror of `bim-3d/accessibility/focus-order.ts` for the 2D DXF viewer.
// Produces a deterministic Tab traversal order over visible DXF entities,
// sorted by screen-distance from the viewport center (2D analogue of 3D's
// camera-distance ascending sort).
//
// Pure functions — no React, no canvas, no DOM. Trivially unit-testable.
// ============================================================================

import type { DxfScene, DxfEntityUnion } from '../canvas-v2/dxf-canvas/dxf-types';
import type { ViewTransform, Viewport, Point2D } from '../rendering/types/Types';
import {
  getEntityBBox,
  viewportToWorldBBox,
  bboxIntersects,
} from '../canvas-v2/dxf-canvas/dxf-viewport-culling';
import { CoordinateTransforms } from '../rendering/core/CoordinateTransforms';

/** Compute the bbox center (world coords) of a 2D entity. */
export function getEntityWorldCenter(entity: DxfEntityUnion): Point2D {
  const bb = getEntityBBox(entity);
  return { x: (bb.minX + bb.maxX) * 0.5, y: (bb.minY + bb.maxY) * 0.5 };
}

/**
 * Frustum-culled, screen-distance-sorted, deduped focus order over a DxfScene.
 * Hidden entities (`visible === false`) are skipped. Mirror of 3D
 * `computeFocusOrder` with screen-distance instead of camera-distance.
 */
export function computeFocusOrder2D(
  scene: DxfScene | null,
  transform: ViewTransform,
  viewport: Viewport,
): string[] {
  if (!scene || scene.entities.length === 0) return [];
  const worldViewport = viewportToWorldBBox(transform, viewport);
  const centerScreen: Point2D = {
    x: viewport.width * 0.5,
    y: viewport.height * 0.5,
  };
  const visible: { id: string; distSq: number }[] = [];
  for (const entity of scene.entities) {
    if (!entity.visible) continue;
    const bb = getEntityBBox(entity);
    if (!bboxIntersects(bb, worldViewport)) continue;
    const worldCenter = { x: (bb.minX + bb.maxX) * 0.5, y: (bb.minY + bb.maxY) * 0.5 };
    const screen = CoordinateTransforms.worldToScreen(worldCenter, transform, viewport);
    const dx = screen.x - centerScreen.x;
    const dy = screen.y - centerScreen.y;
    visible.push({ id: entity.id, distSq: dx * dx + dy * dy });
  }
  visible.sort((a, b) => a.distSq - b.distSq);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const { id } of visible) {
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

/** Resolve the bbox + entity-type label data for a focused 2D entity. */
export interface FocusEntity2DLabelData {
  readonly bimType: string;
  readonly entityName: string;
  readonly worldCenter: Point2D;
  readonly bbox: { minX: number; minY: number; maxX: number; maxY: number };
}

export function findFocusedEntityData2D(
  scene: DxfScene | null,
  entityId: string,
): FocusEntity2DLabelData | null {
  if (!scene) return null;
  const entity = scene.entities.find((e) => e.id === entityId);
  if (!entity) return null;
  const bbox = getEntityBBox(entity);
  return {
    bimType: entity.type,
    entityName: entityId,
    worldCenter: { x: (bbox.minX + bbox.maxX) * 0.5, y: (bbox.minY + bbox.maxY) * 0.5 },
    bbox,
  };
}
