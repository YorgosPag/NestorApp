/**
 * @module wall-preview-helpers
 * @description Pure helper functions for wall tool real-time preview rendering.
 * Extracted from drawing-preview-generator.ts (ADR-363 Phase 1C).
 *
 * Exported: generateWallPreview()
 */

import type { Point2D } from '../../rendering/types/Types';
import type { PolylineEntity } from '../../types/scene';
import type {
  ExtendedSceneEntity,
  ExtendedPolylineEntity,
  PreviewPoint,
} from './drawing-types';
import { buildDefaultWallParams, type WallParamOverrides } from './wall-completion';
import { computeWallGeometry } from '../../bim/geometry/wall-geometry';
import { wallPreviewStore } from '../../bim/walls/wall-preview-store';
import type { WallKind } from '../../bim/types/wall-types';
import type { Point3D } from '../../bim/types/bim-base';
import { LINEWEIGHT_SPECIAL } from '../../config/lineweight-iso-catalog';
import { UI_COLORS } from '../../config/color-config';
import { DXF_DEFAULT_LAYER } from '../../config/layer-config';
import { getLayer } from '../../stores/LayerStore';
import type { SceneUnits } from './stair-completion';

// ADR-358 Phase 9D-5a: id-only WRITE — legacy `layer` field dropped.
const defaultLayerId = (): string => getLayer(DXF_DEFAULT_LAYER)?.id ?? '';

// ─── ADR-363 Phase 1C — Wall preview helpers ────────────────────────────────

/**
 * Build a wall preview entity from `tempPoints` + cursor. State machine map:
 *   - [] (idle) → null
 *   - [start] → outer/inner edge ghost polygon from start→cursor (straight kind)
 *   - [start, end] → curve-control ghost (curved kind) or polyline-spine extension
 *   - [v1, v2, …] → polyline footprint preview with cursor as next vertex
 *
 * The wall kind + overrides are read from `wallPreviewStore` (single-writer
 * pattern, mirrors stair). Returns a translucent closed polyline tracing the
 * outer + inner edges (the footprint preview matches the committed
 * `WallRenderer.drawFootprint` shape so the rubber-band ghost is WYSIWYG).
 *
 * Falls back to a 1-point start marker before the first click resolves.
 */
export function generateWallPreview(
  tempPoints: readonly Point2D[],
  cursorPoint: Point2D,
  sceneUnits: SceneUnits = 'mm',
): ExtendedSceneEntity | null {
  if (tempPoints.length === 0) {
    return {
      id: 'preview_wall_startmarker',
      type: 'point',
      position: cursorPoint,
      size: 6,
      visible: true,
      layerId: defaultLayerId(),
      preview: true,
      showPreviewGrips: true,
    } as PreviewPoint;
  }

  const preview = wallPreviewStore.get();
  const overrides: WallParamOverrides = preview.overrides;

  if (tempPoints.length >= 2) {
    const allVerts = [...tempPoints, cursorPoint];
    return makeWallPolylineGhost('preview_wall_polyline', allVerts, overrides, 'polyline', sceneUnits);
  }

  const startPt = tempPoints[0];
  const endPt = cursorPoint;
  const kind: WallKind = preview.curveControl ? 'curved' : 'straight';
  return makeWallFootprintGhost('preview_wall_footprint', startPt, endPt, overrides, kind, sceneUnits, preview.curveControl);
}

/**
 * Render the outer + inner edge polygon for a single straight/curved wall
 * segment. Built from `computeWallGeometry()` so the ghost is byte-identical
 * to what `WallRenderer.drawFootprint` will commit.
 */
function makeWallFootprintGhost(
  id: string,
  startPt: Readonly<Point2D>,
  endPt: Readonly<Point2D>,
  overrides: WallParamOverrides,
  kind: WallKind,
  sceneUnits: SceneUnits,
  curveControl: Point2D | null,
): ExtendedPolylineEntity {
  const params = buildDefaultWallParams(startPt, endPt, overrides, sceneUnits);
  const finalParams = curveControl
    ? { ...params, curveControl: { x: curveControl.x, y: curveControl.y, z: 0 } as Point3D }
    : params;
  const geometry = computeWallGeometry(finalParams, kind);
  const outer = geometry.outerEdge.points;
  const inner = geometry.innerEdge.points;
  const ring: Point2D[] = [
    ...outer.map((p) => ({ x: p.x, y: p.y })),
    ...[...inner].reverse().map((p) => ({ x: p.x, y: p.y })),
  ];
  const polyline: PolylineEntity = {
    id,
    type: 'polyline',
    vertices: ring,
    closed: true,
    visible: true,
    layerId: defaultLayerId(),
    color: UI_COLORS.BRIGHT_GREEN,
    lineweight: LINEWEIGHT_SPECIAL.BYLAYER,
    opacity: 0.55,
    lineType: 'solid' as const,
  };
  return { ...polyline, preview: true, showPreviewGrips: false } as ExtendedPolylineEntity;
}

/**
 * Render a polyline-kind wall preview. The N-vertex spine is offset by
 * thickness via `computeWallGeometry()`.
 */
function makeWallPolylineGhost(
  id: string,
  vertices: readonly Point2D[],
  overrides: WallParamOverrides,
  kind: WallKind,
  sceneUnits: SceneUnits,
): ExtendedPolylineEntity {
  const startPt = vertices[0];
  const endPt = vertices[vertices.length - 1];
  const base = buildDefaultWallParams(startPt, endPt, overrides, sceneUnits);
  const polylineVertices: Point3D[] = vertices.map((v) => ({ x: v.x, y: v.y, z: 0 }));
  const params = { ...base, polylineVertices };
  const geometry = computeWallGeometry(params, kind);
  const outer = geometry.outerEdge.points;
  const inner = geometry.innerEdge.points;
  const ring: Point2D[] = [
    ...outer.map((p) => ({ x: p.x, y: p.y })),
    ...[...inner].reverse().map((p) => ({ x: p.x, y: p.y })),
  ];
  const polyline: PolylineEntity = {
    id,
    type: 'polyline',
    vertices: ring,
    closed: true,
    visible: true,
    layerId: defaultLayerId(),
    color: UI_COLORS.BRIGHT_GREEN,
    lineweight: LINEWEIGHT_SPECIAL.BYLAYER,
    opacity: 0.55,
    lineType: 'solid' as const,
  };
  return { ...polyline, preview: true, showPreviewGrips: false } as ExtendedPolylineEntity;
}
