/**
 * @module wall-preview-helpers
 * @description Pure helper functions for wall tool real-time preview rendering.
 * Extracted from drawing-preview-generator.ts (ADR-363 Phase 1C).
 *
 * Exported: generateWallPreview()
 *
 * WYSIWYG placement (2026-06-11): the rubber-band returns a FULL `WallEntity`
 * (via the SSoT `buildWallEntity` — same builder as commit) flagged
 * `wysiwygPreview`, so PreviewCanvas renders it through the real `WallRenderer`
 * (category fill / material hatch / lineweight / axis) instead of a green
 * outline. The ghost IS the final wall.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ExtendedSceneEntity, PreviewPoint } from './drawing-types';
import { buildDefaultWallParams, buildWallEntity, defaultEdgeAlignmentPoint, type WallParamOverrides } from './wall-completion';
import { wallPreviewStore } from '../../bim/walls/wall-preview-store';
import type { WallKind } from '../../bim/types/wall-types';
import type { Point3D } from '../../bim/types/bim-base';
import { DXF_DEFAULT_LAYER } from '../../config/layer-config';
import { getLayer } from '../../stores/LayerStore';
import type { SceneUnits } from './stair-completion';

// ADR-358 Phase 9D-5a: id-only WRITE — legacy `layer` field dropped.
const defaultLayerId = (): string => getLayer(DXF_DEFAULT_LAYER)?.id ?? '';

// ─── ADR-363 Phase 1C — Wall preview helpers ────────────────────────────────

/**
 * Build a wall preview entity from `tempPoints` + cursor. State machine map:
 *   - [] (idle) → start marker point
 *   - [start] → straight/curved wall ghost from start→cursor
 *   - [start, end] → curve-control ghost or awaitingAlignment-side ghost
 *   - [v1, v2, …] → polyline wall ghost with cursor as next vertex
 *
 * The wall kind + overrides are read from `wallPreviewStore` (single-writer
 * pattern, mirrors stair). Returns a full `WallEntity` (WYSIWYG) so the
 * placement preview is identical to the committed wall.
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

  // ADR-363 Phase 1F — `awaitingAlignment` phase: endPoint is fixed (click 2),
  // cursor is the live alignment-side pick. Render the wall along start→endPoint
  // SHIFTED toward the cursor so the user sees the final wall position before
  // committing with click 3. `preview.endPoint` is only set by `useWallTool`
  // during the straight-kind awaitingAlignment phase (see Phase 1F effect).
  if (preview.endPoint) {
    return makeWallFootprintGhost(
      'preview_wall_footprint',
      startPt,
      preview.endPoint,
      overrides,
      'straight',
      sceneUnits,
      null,
      cursorPoint,
    );
  }

  const endPt = cursorPoint;
  const kind: WallKind = preview.curveControl ? 'curved' : 'straight';
  // ADR-363 "Location Line = Finish Face": the straight rubber-band (awaitingEnd,
  // before the side is picked) places the drawn start→cursor line on one wall
  // FACE (edge) with the body to a default side, NOT the centerline. The actual
  // side is re-picked at the 3rd alignment click. Curved keeps its centered axis.
  const alignment = kind === 'straight' ? defaultEdgeAlignmentPoint(startPt, endPt) : null;
  return makeWallFootprintGhost('preview_wall_footprint', startPt, endPt, overrides, kind, sceneUnits, preview.curveControl, alignment);
}

/**
 * Build a full `WallEntity` for a single straight/curved wall segment via the
 * SSoT `buildWallEntity` (same builder as commit). Returns `null` on a
 * degenerate/invalid frame (e.g. zero-length at the first pixel) so the preview
 * simply clears that frame.
 */
function makeWallFootprintGhost(
  id: string,
  startPt: Readonly<Point2D>,
  endPt: Readonly<Point2D>,
  overrides: WallParamOverrides,
  kind: WallKind,
  sceneUnits: SceneUnits,
  curveControl: Point2D | null,
  alignmentPoint: Point2D | null = null,
): ExtendedSceneEntity | null {
  const params = buildDefaultWallParams(startPt, endPt, overrides, sceneUnits, alignmentPoint);
  const finalParams = curveControl
    ? { ...params, curveControl: { x: curveControl.x, y: curveControl.y, z: 0 } as Point3D }
    : params;
  const built = buildWallEntity(finalParams, defaultLayerId(), kind, sceneUnits);
  if (!built.ok) return null;
  return { ...built.entity, id, preview: true, wysiwygPreview: true } as unknown as ExtendedSceneEntity;
}

/**
 * Build a full polyline-kind `WallEntity` preview. The N-vertex spine is offset
 * by thickness inside `computeWallGeometry()` (via `buildWallEntity`).
 */
function makeWallPolylineGhost(
  id: string,
  vertices: readonly Point2D[],
  overrides: WallParamOverrides,
  kind: WallKind,
  sceneUnits: SceneUnits,
): ExtendedSceneEntity | null {
  const startPt = vertices[0];
  const endPt = vertices[vertices.length - 1];
  const base = buildDefaultWallParams(startPt, endPt, overrides, sceneUnits);
  const polylineVertices: Point3D[] = vertices.map((v) => ({ x: v.x, y: v.y, z: 0 }));
  const params = { ...base, polylineVertices };
  const built = buildWallEntity(params, defaultLayerId(), kind, sceneUnits);
  if (!built.ok) return null;
  return { ...built.entity, id, preview: true, wysiwygPreview: true } as unknown as ExtendedSceneEntity;
}
