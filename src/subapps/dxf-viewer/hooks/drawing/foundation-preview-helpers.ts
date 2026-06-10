/**
 * @module foundation-preview-helpers
 * @description Pure helper for foundation line-tool (strip / tie-beam) real-time
 * preview rendering. Mirror of `beam-preview-helpers.ts` (ADR-363 Phase 5.5P) —
 * line-based 2-click placement (no 3-click curve branch).
 *
 * Exported: generateFoundationPreview()
 *
 * @see docs/centralized-systems/reference/adrs/ADR-436-bim-foundation-discipline.md §4
 */

import type { Point2D } from '../../rendering/types/Types';
import type { PolylineEntity } from '../../types/scene';
import type { ExtendedSceneEntity, ExtendedPolylineEntity, PreviewPoint } from './drawing-types';
import type { Point3D } from '../../bim/types/bim-base';
import { foundationPreviewStore } from '../../bim/foundations/foundation-preview-store';
import { buildDefaultFoundationParams, type FoundationParamOverrides, type SceneUnits } from './foundation-completion';
import { computeFoundationGeometry } from '../../bim/geometry/foundation-geometry';
import type { FoundationKind } from '../../bim/types/foundation-types';
import { LINEWEIGHT_SPECIAL } from '../../config/lineweight-iso-catalog';
import { UI_COLORS } from '../../config/color-config';
import { DXF_DEFAULT_LAYER } from '../../config/layer-config';
import { getLayer } from '../../stores/LayerStore';

const defaultLayerId = (): string => getLayer(DXF_DEFAULT_LAYER)?.id ?? '';

/**
 * Build a foundation line preview entity from `tempPoints` + cursor. State map:
 *   - [] (awaitingStart) → cursor start marker
 *   - [start] → band footprint ghost start→cursor (WYSIWYG outline rectangle)
 *
 * Returns a green translucent polyline tracing the band outline. WYSIWYG: uses
 * `computeFoundationGeometry` so the ghost matches the committed entity.
 */
export function generateFoundationPreview(
  tempPoints: readonly Point2D[],
  cursorPoint: Point2D,
  sceneUnits: SceneUnits = 'mm',
): ExtendedSceneEntity | null {
  if (tempPoints.length === 0) {
    return {
      id: 'preview_foundation_startmarker',
      type: 'point',
      position: cursorPoint,
      size: 6,
      visible: true,
      layerId: defaultLayerId(),
      preview: true,
      showPreviewGrips: true,
    } as PreviewPoint;
  }

  const preview = foundationPreviewStore.get();
  const startPt = tempPoints[0];
  return makeFoundationBandGhost('preview_foundation_band', startPt, cursorPoint, preview.kind, preview.overrides, sceneUnits);
}

function makeFoundationBandGhost(
  id: string,
  startPt: Readonly<Point2D>,
  endPt: Readonly<Point2D>,
  kind: FoundationKind,
  overrides: FoundationParamOverrides,
  sceneUnits: SceneUnits,
): ExtendedPolylineEntity {
  const axisEnd: Point3D = { x: endPt.x, y: endPt.y, z: 0 };
  const params = buildDefaultFoundationParams(startPt, kind, { ...overrides, kind, axisEnd }, sceneUnits);
  const geometry = computeFoundationGeometry(params);
  const vertices: Point2D[] = geometry.footprint.vertices.map((p) => ({ x: p.x, y: p.y }));
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
