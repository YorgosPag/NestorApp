/**
 * @module xline-ray-preview-helpers
 * @description ADR-359 Phase 3 — XLine / Ray preview helpers extracted from
 * `drawing-preview-generator.ts` for file-size compliance (Google 500-line rule).
 */
import type { Point2D } from '../../rendering/types/Types';
import type { XLineEntity, RayEntity } from '../../types/entities';
import type { ExtendedSceneEntity, ExtendedPolylineEntity } from './drawing-types';
import type { PolylineEntity } from '../../types/scene';
import { getXLineModeState } from '../../systems/tools/xline-mode-store';
import { LINEWEIGHT_SPECIAL } from '../../config/lineweight-iso-catalog';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { DXF_DEFAULT_LAYER } from '../../config/layer-config';
import { getLayer } from '../../stores/LayerStore';

const defaultLayerId = (): string => getLayer(DXF_DEFAULT_LAYER)?.id ?? '';

function makeRubberBandPolyline(id: string, vertices: Point2D[]): ExtendedPolylineEntity {
  const base: PolylineEntity = {
    id,
    type: 'polyline',
    vertices,
    closed: false,
    visible: true,
    layerId: defaultLayerId(),
    color: PANEL_LAYOUT.CAD_COLORS.DRAWING_WHITE,
    lineweight: LINEWEIGHT_SPECIAL.BYLAYER,
    opacity: 1.0,
    lineType: 'solid' as const,
  };
  return {
    ...base,
    preview: true,
    showEdgeDistances: true,
    showPreviewGrips: true,
  } as ExtendedPolylineEntity;
}

function normDir(dx: number, dy: number): { x: number; y: number } {
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-10) return { x: 1, y: 0 };
  return { x: dx / len, y: dy / len };
}

export function generateXLinePreview(
  tempPoints: readonly Point2D[],
  cursorPoint: Point2D,
): ExtendedSceneEntity | null {
  const xlineState = getXLineModeState();
  const mode = xlineState.mode;
  if (mode === 'offset') return null;
  if (mode === 'bisect') {
    if (tempPoints.length === 0) return null;
    if (tempPoints.length === 1) {
      return makeRubberBandPolyline('preview_bisect_arm1', [tempPoints[0], cursorPoint]);
    }
    const p1 = tempPoints[0];
    const p2 = tempPoints[1];
    const d2x = p2.x - p1.x, d2y = p2.y - p1.y;
    const dcx = cursorPoint.x - p1.x, dcy = cursorPoint.y - p1.y;
    const len2 = Math.sqrt(d2x * d2x + d2y * d2y);
    const lenc = Math.sqrt(dcx * dcx + dcy * dcy);
    if (len2 < 1e-10 || lenc < 1e-10) return null;
    return {
      id: 'preview_xline',
      type: 'xline',
      basePoint: p1,
      direction: normDir(d2x / len2 + dcx / lenc, d2y / len2 + dcy / lenc),
      visible: true,
      layerId: defaultLayerId(),
      preview: true,
    } as XLineEntity & { preview: true };
  }
  if (mode === 'angle') {
    if (xlineState.angleValue === null) return null;
    const angleRad = xlineState.angleValue * Math.PI / 180;
    const dir = { x: Math.cos(angleRad), y: Math.sin(angleRad) };
    const basePoint = tempPoints.length >= 1 ? tempPoints[0] : cursorPoint;
    return {
      id: 'preview_xline',
      type: 'xline',
      basePoint,
      direction: dir,
      visible: true,
      layerId: defaultLayerId(),
      preview: true,
    } as XLineEntity & { preview: true };
  }
  if (tempPoints.length === 0) {
    if (mode === 'horizontal') {
      return {
        id: 'preview_xline',
        type: 'xline',
        basePoint: cursorPoint,
        direction: { x: 1, y: 0 },
        visible: true,
        layerId: defaultLayerId(),
        preview: true,
      } as XLineEntity & { preview: true };
    }
    if (mode === 'vertical') {
      return {
        id: 'preview_xline',
        type: 'xline',
        basePoint: cursorPoint,
        direction: { x: 0, y: 1 },
        visible: true,
        layerId: defaultLayerId(),
        preview: true,
      } as XLineEntity & { preview: true };
    }
    return null;
  }
  const firstPoint = tempPoints[0];
  const dir = mode === 'horizontal'
    ? { x: 1, y: 0 }
    : mode === 'vertical'
      ? { x: 0, y: 1 }
      : normDir(cursorPoint.x - firstPoint.x, cursorPoint.y - firstPoint.y);
  return {
    id: 'preview_xline',
    type: 'xline',
    basePoint: firstPoint,
    direction: dir,
    visible: true,
    layerId: defaultLayerId(),
    preview: true,
  } as XLineEntity & { preview: true };
}

export function generateRayPreview(
  tempPoints: readonly Point2D[],
  cursorPoint: Point2D,
): ExtendedSceneEntity | null {
  if (tempPoints.length === 0) return null;
  const firstPoint = tempPoints[0];
  const dir = normDir(cursorPoint.x - firstPoint.x, cursorPoint.y - firstPoint.y);
  return {
    id: 'preview_ray',
    type: 'ray',
    basePoint: firstPoint,
    direction: dir,
    visible: true,
    layerId: defaultLayerId(),
    preview: true,
  } as RayEntity & { preview: true };
}
