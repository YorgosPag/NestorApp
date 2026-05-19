/**
 * @module drawing-preview-generator
 * @description Pure functions for generating real-time drawing preview entities.
 * Extracted from useUnifiedDrawing.tsx for separation of concerns and testability.
 *
 * Functions:
 * - generatePreviewEntity(): Creates a preview entity based on tool, existing points, and cursor position
 * - applyPreviewStyling(): Decorates a preview entity with flags, grip points, and measurement info
 */
import type { Point2D } from '../../rendering/types/Types';
import type { PolylineEntity } from '../../types/scene';
import type {
  DrawingTool,
  ExtendedSceneEntity,
  ExtendedPolylineEntity,
  ExtendedCircleEntity,
  ExtendedLineEntity,
  ExtendedArcEntity,
  PreviewPoint,
} from './drawing-types';
import type { XLineEntity, RayEntity } from '../../types/entities';
import { getXLineModeState } from '../../systems/tools/xline-mode-store';
// ADR-358 Phase 5a — stair preview via SSoT `computeStairGeometry`.
import { buildDefaultStairParams } from './stair-completion';
import { computeStairGeometry } from '../../bim/geometry/stairs/StairGeometryService';
import type { SceneUnits, StairParamOverrides } from './stair-completion';
// ADR-363 Phase 1C — wall preview extracted to wall-preview-helpers.ts.
import { generateWallPreview } from './wall-preview-helpers';
import { LINEWEIGHT_SPECIAL } from '../../config/lineweight-iso-catalog';
import {
  arcFrom3Points,
  arcFromCenterStartEnd,
  arcFromStartCenterEnd,
  circleFrom3Points,
  circleFromChordAndSagitta,
  circleFrom2PointsAndRadius,
  circleBestFit,
  calculateDistance,
  calculateAngle,
  pointOnCircle,
} from '../../rendering/entities/shared';
import { GEOMETRY_PRECISION } from '../../config/tolerance-config';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { UI_COLORS } from '../../config/color-config';
import { DXF_DEFAULT_LAYER } from '../../config/layer-config';
import { getLayer } from '../../stores/LayerStore';
// ADR-358 Phase 9D-5a: id-only WRITE — legacy `layer` field dropped (schema flip deferred to 9D-5b).
const defaultLayerId = (): string => getLayer(DXF_DEFAULT_LAYER)?.id ?? '';
// ─── Callback types for dependency injection ───────────────────────────────
/** Creates an entity from tool + points. Injected to avoid circular dependency. */
export type CreateEntityFn = (tool: DrawingTool, points: Point2D[]) => ExtendedSceneEntity | null;
/** Applies ColorPalettePanel preview settings to an entity. Injected because it depends on hook state. */
export type ApplySettingsFn = (entity: Record<string, unknown>) => void;
// ─── Helper: create a rubber-band polyline preview ─────────────────────────
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
/**
 * Generates a preview entity based on the active tool, existing clicked points, and cursor position.
 *
 * This is a pure function — it produces a new entity object without side effects.
 *
 * @param tool - The active drawing tool
 * @param tempPoints - Points already clicked by the user (from state machine)
 * @param cursorPoint - Current cursor position in world space
 * @param arcFlipped - Whether the arc direction is flipped
 * @param createEntity - Callback to create standard entities (injected from hook)
 * @returns A preview entity, or null if no preview should be shown
 */
export function generatePreviewEntity(
  tool: DrawingTool,
  tempPoints: readonly Point2D[],
  cursorPoint: Point2D,
  arcFlipped: boolean,
  createEntity: CreateEntityFn,
  sceneUnits: SceneUnits = 'mm',
): ExtendedSceneEntity | null {
  // ── ADR-358 Phase 5a — Stair tool preview branch ─────────────────────────
  if (tool === 'stair') {
    return generateStairPreview(tempPoints, cursorPoint, {}, sceneUnits);
  }
  // ── ADR-363 Phase 1C — Wall tool preview branch ──────────────────────────
  if (tool === 'wall') {
    return generateWallPreview(tempPoints, cursorPoint, sceneUnits);
  }
  // ── ADR-359 Phase 3 — XLine preview ──────────────────────────────────────
  if (tool === 'xline') {
    return generateXLinePreview(tempPoints, cursorPoint);
  }
  // ── ADR-359 Phase 3 — Ray preview ────────────────────────────────────────
  if (tool === 'ray') {
    return generateRayPreview(tempPoints, cursorPoint);
  }
  // ── Zero-point preview: show start indicator ─────────────────────────────
  if (tempPoints.length === 0) {
    const isMeasurementTool =
      tool === 'measure-distance' ||
      tool === 'measure-distance-continuous' ||
      tool === 'measure-area' ||
      tool === 'measure-angle' ||
      tool === 'measure-angle-measuregeom';
    // All tools that need a starting dot
    const needsStartDot =
      tool === 'line' || tool === 'measure-distance' || tool === 'measure-distance-continuous' ||
      tool === 'rectangle' || tool === 'circle' || tool === 'circle-diameter' ||
      tool === 'circle-2p-diameter' || tool === 'circle-3p' || tool === 'circle-chord-sagitta' ||
      tool === 'circle-2p-radius' || tool === 'polygon' || tool === 'polyline' ||
      tool === 'measure-area' || tool === 'measure-angle' ||
      tool === 'measure-angle-measuregeom' ||
      tool === 'arc-3p' || tool === 'arc-cse' || tool === 'arc-sce';
    if (needsStartDot) {
      return {
        id: 'preview_start',
        type: 'point',
        position: cursorPoint,
        size: 4,
        visible: true,
        layerId: defaultLayerId(),
        preview: true,
        showPreviewGrips: true,
        ...(isMeasurementTool && { measurement: true }),
      } as PreviewPoint;
    }
    return null;
  }
  // ── Multi-point preview: show shape being drawn ──────────────────────────
  const worldPoints = [...tempPoints, cursorPoint];
  // ── Circle-3p ────────────────────────────────────────────────────────────
  if (tool === 'circle-3p') {
    if (tempPoints.length === 1) {
      return makeRubberBandPolyline('preview_circle3p_rubberband', worldPoints);
    }
    if (tempPoints.length >= 2) {
      const circleResult = circleFrom3Points(worldPoints[0], worldPoints[1], worldPoints[2]);
      if (circleResult) {
        return {
          id: 'preview_circle3p',
          type: 'circle',
          center: circleResult.center,
          radius: circleResult.radius,
          visible: true,
          layerId: defaultLayerId(),
          preview: true,
          showPreviewGrips: true,
        } as ExtendedCircleEntity;
      }
      // Collinear fallback
      return makeRubberBandPolyline('preview_circle3p_rubberband', worldPoints);
    }
  }
  // ── Circle-chord-sagitta ─────────────────────────────────────────────────
  if (tool === 'circle-chord-sagitta') {
    if (tempPoints.length === 1) {
      return makeRubberBandPolyline('preview_chord_sagitta_rubberband', worldPoints);
    }
    if (tempPoints.length >= 2) {
      const circleResult = circleFromChordAndSagitta(worldPoints[0], worldPoints[1], worldPoints[2]);
      if (circleResult) {
        return {
          id: 'preview_chord_sagitta',
          type: 'circle',
          center: circleResult.center,
          radius: circleResult.radius,
          visible: true,
          layerId: defaultLayerId(),
          preview: true,
          showPreviewGrips: true,
        } as ExtendedCircleEntity;
      }
      return makeRubberBandPolyline('preview_chord_sagitta_rubberband', worldPoints);
    }
  }
  // ── Circle-2p-radius ─────────────────────────────────────────────────────
  if (tool === 'circle-2p-radius') {
    if (tempPoints.length === 1) {
      return makeRubberBandPolyline('preview_2p_radius_rubberband', worldPoints);
    }
    if (tempPoints.length >= 2) {
      const circleResult = circleFrom2PointsAndRadius(worldPoints[0], worldPoints[1], worldPoints[2]);
      if (circleResult) {
        return {
          id: 'preview_2p_radius',
          type: 'circle',
          center: circleResult.center,
          radius: circleResult.radius,
          visible: true,
          layerId: defaultLayerId(),
          preview: true,
          showPreviewGrips: true,
        } as ExtendedCircleEntity;
      }
      return makeRubberBandPolyline('preview_2p_radius_rubberband', worldPoints);
    }
  }
  // ── Circle-best-fit ──────────────────────────────────────────────────────
  if (tool === 'circle-best-fit') {
    if (tempPoints.length === 1 || tempPoints.length === 2) {
      return makeRubberBandPolyline('preview_bestfit_rubberband', worldPoints);
    }
    // 3+ clicked points + cursor
    const circleResult = circleBestFit(worldPoints);
    if (circleResult) {
      return {
        id: 'preview_bestfit',
        type: 'circle',
        center: circleResult.center,
        radius: circleResult.radius,
        visible: true,
        layerId: defaultLayerId(),
        preview: true,
        showPreviewGrips: true,
      } as ExtendedCircleEntity;
    }
    return makeRubberBandPolyline('preview_bestfit_rubberband', worldPoints);
  }
  // ── Arc tools (arc-3p, arc-cse, arc-sce) ─────────────────────────────────
  if (tool === 'arc-3p' || tool === 'arc-cse' || tool === 'arc-sce') {
    if (tempPoints.length === 1) {
      return makeRubberBandPolyline('preview_arc_rubberband', worldPoints);
    }
    if (tempPoints.length >= 2) {
      // Calculate arc based on tool type
      let arcResult: {
        center: Point2D;
        radius: number;
        startAngle: number;
        endAngle: number;
        counterclockwise?: boolean;
      } | null = null;
      if (tool === 'arc-3p') {
        arcResult = arcFrom3Points(worldPoints[0], worldPoints[1], worldPoints[2]);
      } else if (tool === 'arc-cse') {
        arcResult = arcFromCenterStartEnd(worldPoints[0], worldPoints[1], worldPoints[2]);
      } else if (tool === 'arc-sce') {
        arcResult = arcFromStartCenterEnd(worldPoints[0], worldPoints[1], worldPoints[2]);
      }
      if (arcResult) {
        // Calculate construction vertices based on tool type
        let constructionVerts: Point2D[];
        if (tool === 'arc-cse') {
          const center = worldPoints[0];
          const start = worldPoints[1];
          const cursor = worldPoints[2];
          const dist = calculateDistance(center, cursor);
          const projectedEnd = dist > GEOMETRY_PRECISION.POINT_MATCH
            ? pointOnCircle(center, arcResult.radius, calculateAngle(center, cursor))
            : start;
          constructionVerts = [center, start, projectedEnd];
        } else if (tool === 'arc-sce') {
          const start = worldPoints[0];
          const center = worldPoints[1];
          const cursor = worldPoints[2];
          const dist = calculateDistance(center, cursor);
          const projectedEnd = dist > GEOMETRY_PRECISION.POINT_MATCH
            ? pointOnCircle(center, arcResult.radius, calculateAngle(center, cursor))
            : start;
          constructionVerts = [start, center, projectedEnd];
        } else {
          // arc-3p: all points define the circumference
          constructionVerts = worldPoints;
        }
        const finalCounterclockwise = arcFlipped
          ? !arcResult.counterclockwise
          : arcResult.counterclockwise;
        const arcPreview: ExtendedArcEntity = {
          id: 'preview_arc',
          type: 'arc',
          center: arcResult.center,
          radius: arcResult.radius,
          startAngle: arcResult.startAngle,
          endAngle: arcResult.endAngle,
          visible: true,
          layerId: defaultLayerId(),
          preview: true,
          showPreviewGrips: true,
          constructionVertices: constructionVerts,
          showConstructionLines: true,
          showEdgeDistances: true,
          counterclockwise: finalCounterclockwise,
          constructionLineMode: tool === 'arc-3p' ? 'polyline' : 'radial',
        };
        return arcPreview;
      }
      // Arc calculation failed (collinear) — show polyline fallback
      return makeRubberBandPolyline('preview_arc_rubberband', worldPoints);
    }
  }
  // ── All other tools: delegate to createEntity ────────────────────────────
  return createEntity(tool, worldPoints);
}
// Re-export from extracted module for backward compatibility
export { applyPreviewStyling, createPartialPreview } from './drawing-preview-partial';
// ─── ADR-358 Phase 5a — Stair preview helpers ───────────────────────────────
/**
 * Build a stair preview entity from `tempPoints` + cursor. State machine map:
 *   - [] → cursor marker (basePoint indicator)
 *   - [base] → ghost polyline base→cursor (direction indicator)
 *   - [base, dirPoint] → walkline polyline from StairGeometry SSoT
 *
 * Phase 5a returns a single polyline preview (walkline). The full multi-entity
 * preview (treads + walkline + arrow) lands a dedicated stair preview overlay
 * leaf in Phase 5b; this single-entity shape preserves the existing
 * `ExtendedSceneEntity` contract used by PreviewCanvas (ADR-040 §6.2).
 */
function generateStairPreview(
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
      layerId: defaultLayerId(),
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
    layerId: defaultLayerId(),
    color: PANEL_LAYOUT.CAD_COLORS.DRAWING_WHITE,
    lineweight: LINEWEIGHT_SPECIAL.BYLAYER,
    opacity: 0.6,
    lineType: 'dashed' as const,
  };
  return { ...base, preview: true, showEdgeDistances: true, showPreviewGrips: true } as ExtendedPolylineEntity;
}
// ─── ADR-359 Phase 3 — XLine / Ray preview helpers ──────────────────────────
function normDir(dx: number, dy: number): { x: number; y: number } {
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-10) return { x: 1, y: 0 };
  return { x: dx / len, y: dy / len };
}
function generateXLinePreview(
  tempPoints: readonly Point2D[],
  cursorPoint: Point2D,
): ExtendedSceneEntity | null {
  const xlineState = getXLineModeState();
  const mode = xlineState.mode;
  if (mode === 'offset') return null; // Phase 4+ — entity pick not yet implemented
  if (mode === 'bisect') {
    if (tempPoints.length === 0) return null;
    if (tempPoints.length === 1) {
      return makeRubberBandPolyline('preview_bisect_arm1', [tempPoints[0], cursorPoint]);
    }
    // tempPoints.length >= 2: p1=vertex, p2=angleStart, cursor=angleEnd direction
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
  // horizontal / vertical / through
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
    return null; // through — no preview without 2 points
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
function generateRayPreview(
  tempPoints: readonly Point2D[],
  cursorPoint: Point2D,
): ExtendedSceneEntity | null {
  if (tempPoints.length === 0) {
    // No preview without first point
    return null;
  }
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
function makeStairWalklinePreview(
  basePoint: Readonly<Point2D>,
  dirPoint: Readonly<Point2D>,
  overrides: StairParamOverrides,
  sceneUnits: SceneUnits = 'mm',
): ExtendedSceneEntity {
  const direction = Math.atan2(dirPoint.y - basePoint.y, dirPoint.x - basePoint.x) * (180 / Math.PI);
  const params = buildDefaultStairParams(basePoint, direction, overrides, sceneUnits);
  const geometry = computeStairGeometry(params);
  const vertices: Point2D[] = geometry.walkline.map(p => ({ x: p.x, y: p.y }));
  const polyline: PolylineEntity = {
    id: 'preview_stair_walkline',
    type: 'polyline',
    vertices,
    closed: false,
    visible: true,
    layerId: defaultLayerId(),
    color: UI_COLORS.BRIGHT_GREEN,
    lineweight: LINEWEIGHT_SPECIAL.BYLAYER,
    opacity: 0.8,
    lineType: 'solid' as const,
  };
  return { ...polyline, preview: true, showPreviewGrips: true } as ExtendedPolylineEntity;
}
