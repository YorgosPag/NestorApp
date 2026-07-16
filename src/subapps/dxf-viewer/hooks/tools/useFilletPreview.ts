/**
 * USE FILLET PREVIEW — ADR-510 Φ4e (ADR-040 micro-leaf)
 *
 * Live overlay during a FILLET session. Thin binding over the shared
 * {@link useCornerToolPreview} paint primitive (Cluster #16 SSoT, ADR-625): the RAF
 * lifecycle, dashed-green ghost stroke, radius label, pickbox AND the identical
 * polyline-mode / same-polyline-corner branches all live in the primitive. Here we
 * bind only the FILLET geometry — the polyline compute callbacks + the bespoke
 * two-line / curve dispatch (tangent arc + trimmed edges). Mirrors `useChamferPreview`.
 *
 * Ghost tessellation is DEGREES-correct for arcs (matches the committed render),
 * otherwise the SSoT `buildEntityPreviewPath` (systems/trim).
 *
 * @module hooks/tools/useFilletPreview
 * @see hooks/tools/use-corner-tool-preview — shared CHAMFER/FILLET paint skeleton (ADR-625)
 */

import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import { FilletToolStore } from '../../systems/corner/FilletToolStore';
import type { FilletToolState } from '../../systems/corner/fillet-types';
import {
  computeFilletTwoLines,
  computeFilletPolyline,
  computeFilletPolylineCorner,
} from '../../systems/corner/fillet-geometry';
import { computeFilletCurve, isFilletCurveEntity } from '../../systems/corner/fillet-curve-geometry';
import { buildEntityPreviewPath } from '../../systems/trim/trim-fence-hit-detector';
import { tessellateArcDegrees } from '../../rendering/entities/shared/geometry-arc-utils';
import { distanceToEntity } from '../../utils/entity-distance';
import {
  isLineEntity,
  isArcEntity,
  isPolylineEntity,
  isLWPolylineEntity,
  type Entity,
  type PolylineEntity,
  type LWPolylineEntity,
} from '../../types/entities';
import type { SceneModel } from '../../types/scene';
import {
  useCornerToolPreview,
  nearestEntityMatching,
  resolveCornerStrokes,
  type CornerGhostStroke,
} from './use-corner-tool-preview';

export interface UseFilletPreviewProps {
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement?: () => HTMLElement | null;
  /** Live scene getter (event-time read, not captured) for the hover hit-test. */
  getScene: () => SceneModel | null;
}

const GHOST_ARC_SEGMENTS = 48;

const isPolyline = (e: Entity): e is PolylineEntity | LWPolylineEntity =>
  isPolylineEntity(e) || isLWPolylineEntity(e);

/** Ghost tessellation: DEGREES-correct for arcs (matches the committed render), SSoT path otherwise. */
function ghostPath(entity: Entity): ReadonlyArray<Point2D> {
  return isArcEntity(entity) ? tessellateArcDegrees(entity, GHOST_ARC_SEGMENTS) : buildEntityPreviewPath(entity);
}

// Two-line / curve dispatch (tangent arc + trimmed edges) — bespoke to FILLET.
function filletTwoLines(
  s: FilletToolState,
  first: Entity,
  scene: SceneModel,
  cursor: Point2D,
  tol: number,
): ReadonlyArray<CornerGhostStroke> {
  const hovered = nearestEntityMatching(scene, cursor, tol, isFilletCurveEntity, distanceToEntity, first.id);
  if (!hovered) return [];

  if (isLineEntity(first) && isLineEntity(hovered)) {
    const res = computeFilletTwoLines(first, s.firstPick ?? cursor, hovered, cursor, s.radius, s.trim, 'fillet-ghost');
    if (!res) return [];
    const out: CornerGhostStroke[] = [];
    if (res.arc) out.push({ entity: res.arc, close: false });
    for (const tr of res.trims) out.push({ entity: tr.newGeom, close: false });
    return out;
  }

  if (!isFilletCurveEntity(first)) return []; // the tool only picks fillet-curve entities; narrows Entity → FilletCurveEntity
  const res = computeFilletCurve(first, s.firstPick ?? cursor, hovered, cursor, s.radius, s.trim, 'fillet-ghost');
  if (!res) return [];
  return [{ entity: res.arc, close: false }, ...res.trims.map((tr) => ({ entity: tr.newGeom, close: false }))];
}

const filletStrokes = (
  s: FilletToolState,
  scene: SceneModel,
  cursor: Point2D,
  tol: number,
): ReadonlyArray<CornerGhostStroke> =>
  resolveCornerStrokes(s, scene, cursor, tol, {
    isPolyline,
    wholePolyline: (poly) => computeFilletPolyline(poly, s.radius),
    polylineCorner: (poly, cornerIndex) => computeFilletPolylineCorner(poly, cornerIndex, s.radius),
    twoLines: filletTwoLines,
  });

const filletLabel = (s: FilletToolState): string => `R ${s.radius.toFixed(2)}`;

export function useFilletPreview(props: UseFilletPreviewProps): void {
  useCornerToolPreview<FilletToolState>({
    store: FilletToolStore,
    activeToolId: 'fillet',
    transform: props.transform,
    getCanvas: props.getCanvas,
    getViewportElement: props.getViewportElement,
    getScene: props.getScene,
    computeStrokes: filletStrokes,
    buildLabel: filletLabel,
    pathFn: ghostPath,
  });
}
