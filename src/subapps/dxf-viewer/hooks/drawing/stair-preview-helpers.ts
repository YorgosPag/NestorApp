/**
 * @module stair-preview-helpers
 * @description ADR-358 Phase 5a — Stair tool preview (base-point → direction ghost → walkline).
 * Extracted from `drawing-preview-generator.ts` (N.7.1 file-size SRP split) — ο τελευταίος inline
 * tool-preview που απέμενε· πλέον ευθυγραμμίζεται με τους αδελφούς του (`wall-/slab-/beam-/column-/
 * foundation-/xline-ray-preview-helpers.ts`). Καθαρή μεταφορά — μηδέν αλλαγή συμπεριφοράς.
 *
 * State machine map:
 *   - `[]`              → cursor marker (basePoint indicator)
 *   - `[base]`          → ghost polyline base→cursor (direction indicator)
 *   - `[base, dirPoint]`→ walkline polyline from the StairGeometry SSoT
 *
 * Phase 5a returns a single polyline preview (walkline). The full multi-entity preview (treads +
 * walkline + arrow) lands a dedicated stair preview overlay leaf in Phase 5b; this single-entity shape
 * preserves the existing `ExtendedSceneEntity` contract used by PreviewCanvas (ADR-040 §6.2).
 */

import type { Point2D } from '../../rendering/types/Types';
import type { PolylineEntity } from '../../types/scene';
import type { ExtendedPolylineEntity, ExtendedSceneEntity, PreviewPoint } from './drawing-types';
import { projectVerticesTo2D } from '../../bim/geometry/shared/polygon-utils';
import { buildDefaultStairParams } from './stair-completion';
import { computeStairGeometry } from '../../bim/geometry/stairs/StairGeometryService';
import type { SceneUnits, StairParamOverrides } from './stair-completion';
import { getDefaultLayerId } from '../../stores/LayerStore';
import { LINEWEIGHT_SPECIAL } from '../../config/lineweight-iso-catalog';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { UI_COLORS } from '../../config/color-config';

/** Build a stair preview entity from `tempPoints` + cursor (see module state-machine map). */
export function generateStairPreview(
  tempPoints: readonly Point2D[],
  cursorPoint: Point2D,
  overrides: StairParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
): ExtendedSceneEntity | null {
  if (tempPoints.length === 0) {
    return {
      id: 'preview_stair_basepoint',
      type: 'point',
      position: cursorPoint,
      size: 6,
      visible: true,
      layerId: getDefaultLayerId(),
      preview: true,
      showPreviewGrips: true,
    } as PreviewPoint;
  }
  if (tempPoints.length === 1) {
    return makeStairGhost('preview_stair_direction', [tempPoints[0], cursorPoint]);
  }
  return makeStairWalklinePreview(tempPoints[0], tempPoints[1], overrides, sceneUnits);
}

function makeStairGhost(id: string, vertices: readonly Point2D[]): ExtendedPolylineEntity {
  const base: PolylineEntity = {
    id,
    type: 'polyline',
    vertices: [...vertices],
    closed: false,
    visible: true,
    layerId: getDefaultLayerId(),
    color: PANEL_LAYOUT.CAD_COLORS.DRAWING_WHITE,
    lineweight: LINEWEIGHT_SPECIAL.BYLAYER,
    opacity: 0.6,
    lineType: 'dashed' as const,
  };
  return { ...base, preview: true, showEdgeDistances: true, showPreviewGrips: true } as ExtendedPolylineEntity;
}

function makeStairWalklinePreview(
  basePoint: Readonly<Point2D>,
  dirPoint: Readonly<Point2D>,
  overrides: StairParamOverrides,
  sceneUnits: SceneUnits = 'mm',
): ExtendedSceneEntity {
  const direction = Math.atan2(dirPoint.y - basePoint.y, dirPoint.x - basePoint.x) * (180 / Math.PI);
  const params = buildDefaultStairParams(basePoint, direction, overrides, sceneUnits);
  const geometry = computeStairGeometry(params);
  const vertices: Point2D[] = projectVerticesTo2D(geometry.walkline);
  const polyline: PolylineEntity = {
    id: 'preview_stair_walkline',
    type: 'polyline',
    vertices,
    closed: false,
    visible: true,
    layerId: getDefaultLayerId(),
    color: UI_COLORS.BRIGHT_GREEN,
    lineweight: LINEWEIGHT_SPECIAL.BYLAYER,
    opacity: 0.8,
    lineType: 'solid' as const,
  };
  return { ...polyline, preview: true, showPreviewGrips: true } as ExtendedPolylineEntity;
}
