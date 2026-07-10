/**
 * USE CHAMFER PREVIEW — ADR-510 Φ4f (ADR-040 micro-leaf)
 *
 * Live overlay during a CHAMFER session. Thin binding over the shared
 * {@link useCornerToolPreview} paint primitive (Cluster #16 SSoT, ADR-625): the RAF
 * lifecycle, dashed-green ghost stroke, value label, pickbox AND the identical
 * polyline-mode / same-polyline-corner branches all live in the primitive. Here we
 * bind only the CHAMFER geometry — the polyline compute callbacks + the bespoke
 * two-line dispatch (bevel + trimmed edges). Mirrors `useFilletPreview` (bevel line
 * instead of a tangent arc). Ghost path reuses the SSoT `buildEntityPreviewPath`.
 *
 * @module hooks/tools/useChamferPreview
 * @see hooks/tools/use-corner-tool-preview — shared CHAMFER/FILLET paint skeleton (ADR-625)
 */

import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import { ChamferToolStore } from '../../systems/corner/ChamferToolStore';
import type { ChamferToolState } from '../../systems/corner/chamfer-types';
import { computeChamferTwoLines, computeChamferPolyline, computeChamferPolylineCorner } from '../../systems/corner/chamfer-geometry';
import { buildEntityPreviewPath } from '../../systems/trim/trim-fence-hit-detector';
import { distanceToEntity } from '../../utils/entity-distance';
import {
  isLineEntity,
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

export interface UseChamferPreviewProps {
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement?: () => HTMLElement | null;
  getScene: () => SceneModel | null;
}

const isPolyline = (e: Entity): e is PolylineEntity | LWPolylineEntity =>
  isPolylineEntity(e) || isLWPolylineEntity(e);

// Two-line dispatch (bevel + trimmed edges) — bespoke to CHAMFER.
function chamferTwoLines(
  s: ChamferToolState,
  first: Entity,
  scene: SceneModel,
  cursor: Point2D,
  tol: number,
): ReadonlyArray<CornerGhostStroke> {
  const hovered = nearestEntityMatching(scene, cursor, tol, isLineEntity, distanceToEntity, first.id);
  if (!hovered || !isLineEntity(first)) return [];
  const res = computeChamferTwoLines(
    first, s.firstPick ?? cursor, hovered, cursor, s.d1, s.d2, s.angle, s.mode, s.trim, 'chamfer-ghost',
  );
  if (!res) return [];
  return [{ entity: res.bevel, close: false }, ...res.trims.map((tr) => ({ entity: tr.newGeom, close: false }))];
}

const chamferStrokes = (
  s: ChamferToolState,
  scene: SceneModel,
  cursor: Point2D,
  tol: number,
): ReadonlyArray<CornerGhostStroke> =>
  resolveCornerStrokes(s, scene, cursor, tol, {
    isPolyline,
    wholePolyline: (poly) => computeChamferPolyline(poly, s.d1, s.d2),
    polylineCorner: (poly, cornerIndex) => computeChamferPolylineCorner(poly, cornerIndex, s.d1, s.d2),
    twoLines: chamferTwoLines,
  });

const chamferLabel = (s: ChamferToolState): string =>
  s.mode === 'angle' ? `${s.d1.toFixed(1)} ∠${s.angle.toFixed(0)}°` : `${s.d1.toFixed(1)}×${s.d2.toFixed(1)}`;

export function useChamferPreview(props: UseChamferPreviewProps): void {
  useCornerToolPreview<ChamferToolState>({
    store: ChamferToolStore,
    activeToolId: 'chamfer',
    transform: props.transform,
    getCanvas: props.getCanvas,
    getViewportElement: props.getViewportElement,
    getScene: props.getScene,
    computeStrokes: chamferStrokes,
    buildLabel: chamferLabel,
    pathFn: buildEntityPreviewPath,
  });
}
