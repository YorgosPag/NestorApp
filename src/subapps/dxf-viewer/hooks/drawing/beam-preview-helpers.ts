/**
 * @module beam-preview-helpers
 * @description Pure helper for beam tool real-time preview rendering.
 * Mirror of `wall-preview-helpers.ts` (ADR-363 Phase 1C).
 *
 * Exported: generateBeamPreview()
 */

import type { Point2D } from '../../rendering/types/Types';
import type { PolylineEntity } from '../../types/scene';
import type { ExtendedSceneEntity, ExtendedPolylineEntity, PreviewPoint } from './drawing-types';
import { beamPreviewStore } from '../../bim/beams/beam-preview-store';
import { buildDefaultBeamParams, type BeamParamOverrides, type SceneUnits } from './beam-completion';
import { computeBeamGeometry } from '../../bim/geometry/beam-geometry';
import { LINEWEIGHT_SPECIAL } from '../../config/lineweight-iso-catalog';
import { UI_COLORS } from '../../config/color-config';
import { DXF_DEFAULT_LAYER } from '../../config/layer-config';
import { getLayer } from '../../stores/LayerStore';

const defaultLayerId = (): string => getLayer(DXF_DEFAULT_LAYER)?.id ?? '';

/**
 * Build a beam preview entity from `tempPoints` + cursor. State machine map:
 *   - [] (awaitingStart) → cursor start marker
 *   - [start] → beam footprint ghost start→cursor (WYSIWYG outline rectangle)
 *   - [start, end] → footprint ghost + construction arm end→cursor (curved control)
 *
 * Returns a green translucent polyline tracing the beam outline.
 * WYSIWYG: uses `computeBeamGeometry` so the ghost matches the committed entity.
 */
export function generateBeamPreview(
  tempPoints: readonly Point2D[],
  cursorPoint: Point2D,
  sceneUnits: SceneUnits = 'mm',
): ExtendedSceneEntity | null {
  if (tempPoints.length === 0) {
    return {
      id: 'preview_beam_startmarker',
      type: 'point',
      position: cursorPoint,
      size: 6,
      visible: true,
      layerId: defaultLayerId(),
      preview: true,
      showPreviewGrips: true,
    } as PreviewPoint;
  }

  const preview = beamPreviewStore.get();
  const startPt = tempPoints[0];

  if (tempPoints.length === 1) {
    return makeBeamFootprintGhost('preview_beam_footprint', startPt, cursorPoint, preview.kind, preview.overrides, sceneUnits);
  }

  const endPt = tempPoints[1];
  return makeBeamCurveConstructionGhost('preview_beam_curve', startPt, endPt, cursorPoint, preview.overrides, sceneUnits);
}

function makeBeamFootprintGhost(
  id: string,
  startPt: Readonly<Point2D>,
  endPt: Readonly<Point2D>,
  kind: 'straight' | 'curved' | 'cantilever',
  overrides: BeamParamOverrides,
  sceneUnits: SceneUnits,
): ExtendedPolylineEntity {
  const params = buildDefaultBeamParams(startPt, endPt, kind, overrides, sceneUnits);
  const geometry = computeBeamGeometry(params);
  const vertices: Point2D[] = geometry.outline.vertices.map((p) => ({ x: p.x, y: p.y }));
  const polyline: PolylineEntity = {
    id,
    type: 'polyline',
    vertices,
    closed: true,
    visible: true,
    layerId: defaultLayerId(),
    color: UI_COLORS.BRIGHT_GREEN,
    lineweight: LINEWEIGHT_SPECIAL.BYLAYER,
    opacity: 0.6,
    lineType: 'solid' as const,
  };
  return { ...polyline, preview: true, showEdgeDistances: true, showPreviewGrips: false } as ExtendedPolylineEntity;
}

function makeBeamCurveConstructionGhost(
  id: string,
  startPt: Readonly<Point2D>,
  endPt: Readonly<Point2D>,
  cursorPoint: Point2D,
  overrides: BeamParamOverrides,
  sceneUnits: SceneUnits,
): ExtendedPolylineEntity {
  const params = buildDefaultBeamParams(startPt, endPt, 'curved', overrides, sceneUnits);
  const geometry = computeBeamGeometry(params);
  const outline: Point2D[] = geometry.outline.vertices.map((p) => ({ x: p.x, y: p.y }));
  // Append cursor as extra construction vertex — shows the control handle direction
  const vertices: Point2D[] = [...outline, cursorPoint];
  const polyline: PolylineEntity = {
    id,
    type: 'polyline',
    vertices,
    closed: false,
    visible: true,
    layerId: defaultLayerId(),
    color: UI_COLORS.BRIGHT_GREEN,
    lineweight: LINEWEIGHT_SPECIAL.BYLAYER,
    opacity: 0.5,
    lineType: 'dashed' as const,
  };
  return { ...polyline, preview: true, showPreviewGrips: true } as ExtendedPolylineEntity;
}
