/**
 * =============================================================================
 * SSoT: DXF scene → world-space bounding box
 * =============================================================================
 *
 * ONE owner of «walk the entities, derive the true extents». Before this, the
 * gallery renderer (`computeActualBounds`) and the upload thumbnail generator
 * (`calculateBounds`) each carried a hand-rolled copy that had already drifted:
 * the gallery covered `lwpolyline` / `rectangle` and expanded the text descender,
 * the thumbnail did not — so the same drawing framed differently depending on
 * which surface rendered it.
 *
 * This module is the UNION of both: every entity type either copy understood is
 * measured here. Converging upward is deliberate — a bounds walk that ignores an
 * entity type silently clips that entity out of the viewport.
 *
 * WHY not `scene.bounds`: the persisted `bounds` come from the original DXF parse
 * and are never updated when the user adds entities outside the source extents in
 * the DXF Viewer. Deriving from live entity data is the only correct viewport.
 *
 * @module lib/dxf-scene/scene-bounds
 * @enterprise ADR-033 (Floorplan Processing), ADR-370 (Read-only render)
 */

import type { SceneBounds, Vec2 } from './scene-fit-transform';

/** Minimal entity contract — structural, satisfied by DxfSceneEntity and SceneModel entities. */
export interface BoundsEntityLike {
  readonly type: string;
}

/**
 * Extents used when the scene carries no measurable geometry. A unit box would
 * make `scale` explode; 100×100 keeps an empty canvas visually sane.
 */
const FALLBACK_BOUNDS: SceneBounds = { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } };

/** Mutable accumulator — kept local so the public API stays immutable. */
interface Extent {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function expand(acc: Extent, x: number, y: number): void {
  if (x < acc.minX) acc.minX = x;
  if (x > acc.maxX) acc.maxX = x;
  if (y < acc.minY) acc.minY = y;
  if (y > acc.maxY) acc.maxY = y;
}

function expandPoint(acc: Extent, p: Vec2 | undefined): void {
  if (p) expand(acc, p.x, p.y);
}

/** Circle / arc: conservative full-circle AABB (avoids angle-sweep math). */
function expandRadial(acc: Extent, e: Record<string, unknown>): void {
  const center = e.center as Vec2 | undefined;
  const radius = e.radius as number | undefined;
  if (!center || radius == null) return;
  expand(acc, center.x - radius, center.y - radius);
  expand(acc, center.x + radius, center.y + radius);
}

/**
 * Text / mtext. T-tool entities (`textNode`) use TL attachment: the body extends
 * DOWNWARD in DXF space, so the glyph box reaches below `position.y`. Measuring
 * only the anchor clips descenders at the canvas edge.
 */
function expandText(acc: Extent, e: Record<string, unknown>): void {
  const position = e.position as Vec2 | undefined;
  if (!position) return;
  expand(acc, position.x, position.y);

  const textNode = e.textNode as { paragraphs?: unknown[] } | undefined;
  if (!textNode?.paragraphs) return;
  const height = e.height as number | undefined;
  expand(acc, position.x, position.y - (height || 10));
}

function expandEntity(acc: Extent, entity: BoundsEntityLike): void {
  const e = entity as unknown as Record<string, unknown>;
  switch (entity.type) {
    case 'line':
      expandPoint(acc, e.start as Vec2 | undefined);
      expandPoint(acc, e.end as Vec2 | undefined);
      return;
    case 'polyline':
    case 'lwpolyline': {
      const vertices = e.vertices as Vec2[] | undefined;
      if (vertices) for (const v of vertices) expand(acc, v.x, v.y);
      return;
    }
    case 'rectangle':
      expandPoint(acc, e.corner1 as Vec2 | undefined);
      expandPoint(acc, e.corner2 as Vec2 | undefined);
      return;
    case 'circle':
    case 'arc':
      expandRadial(acc, e);
      return;
    case 'text':
    case 'mtext':
      expandText(acc, e);
      return;
    default:
      return;
  }
}

/**
 * Compute the true bounding box of a scene from its live entities.
 * Returns {@link FALLBACK_BOUNDS} when the list is empty or carries no
 * measurable coordinate.
 */
export function computeSceneBounds(
  entities: ReadonlyArray<BoundsEntityLike> | undefined,
): SceneBounds {
  if (!entities || entities.length === 0) return FALLBACK_BOUNDS;

  const acc: Extent = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const entity of entities) expandEntity(acc, entity);

  if (!Number.isFinite(acc.minX)) return FALLBACK_BOUNDS;

  return {
    min: { x: acc.minX, y: acc.minY },
    max: { x: acc.maxX, y: acc.maxY },
  };
}
