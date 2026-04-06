/**
 * Rendering helper functions for BaseEntityRenderer
 * Extracted per ADR-065 (file size limit: max 500 lines)
 *
 * Contains implementation logic for distance text rendering
 * and arc/angle rendering, delegated from BaseEntityRenderer protected methods.
 */

import type { Point2D, ViewTransform, EntityModel, RenderOptions } from '../types/Types';
import type { Entity } from '../../types/entities';
import type { PhaseManager } from '../../systems/phase-manager/PhaseManager';
import { UI_COLORS } from '../../config/color-config';
import { RENDER_LINE_WIDTHS, RENDER_GEOMETRY, LINE_DASH_PATTERNS, ARC_LABEL_POSITIONING } from '../../config/text-rendering-config';
import { calculateDistance, vectorMagnitude, vectorAngle, getUnitVector, calculateAngle } from './shared/geometry-rendering-utils';
import { radToDeg, bisectorAngle, calculateMidpoint, normalizeTextAngle } from './shared/geometry-utils';
import { addArcPath, TAU } from '../primitives/canvasPaths';
import { formatDistance, formatAngle } from './shared/distance-label-utils';
import { renderStyledTextWithOverride, getTextPreviewStyleWithOverride } from '../../hooks/useTextPreviewStyle';
import { getLinePreviewStyleWithOverride } from '../../hooks/useLinePreviewStyle';
import {
  renderSplitLineWithGap as renderSplitLineWithGapUtil,
  renderContinuousLine as renderContinuousLineUtil
} from './shared/line-rendering-utils';

/** Shared rendering context passed from BaseEntityRenderer to helper functions */
export interface BaseRenderingContext {
  readonly ctx: CanvasRenderingContext2D;
  readonly transform: ViewTransform;
  readonly worldToScreen: (point: Point2D) => Point2D;
  readonly phaseManager: PhaseManager;
  readonly applyAngleMeasurementTextStyle: () => void;
  readonly applyDistanceTextStyle: () => void;
}

// ============================================================
// DISTANCE TEXT HELPERS
// ============================================================

/**
 * 🔺 ΚΕΝΤΡΙΚΟΠΟΙΗΜΈΝΗ ΤΟΠΟΘΈΤΗΣΗ ΚΕΙΜΈΝΩΝ ΑΠΟΣΤΆΣΕΩΝ
 * Υπολογίζει τη θέση του κειμένου ΕΣΩΤΕΡΙΚΑ της γραμμής
 * για να μη κρύβει το midpoint grip
 */
export function calculateDistanceTextPositionImpl(
  screenStart: Point2D,
  screenEnd: Point2D,
  offsetDistance: number = 15
): Point2D {
  // 🏢 ADR-065: Use centralized distance calculation
  const length = calculateDistance(screenStart, screenEnd);
  if (length === 0) {
    return { x: screenStart.x, y: screenStart.y };
  }
  // 🏢 ADR-065: Use centralized unit vector calculation
  const unit = getUnitVector(screenStart, screenEnd);
  // Perpendicular to the left (rotated 90° CCW)
  const perpX = -unit.y;
  const perpY = unit.x;
  // 🏢 ADR-073: Use centralized midpoint calculation
  const mid = calculateMidpoint(screenStart, screenEnd);
  // Offset the text position INSIDE the line (perpendicular offset)
  return {
    x: mid.x + perpX * offsetDistance,
    y: mid.y + perpY * offsetDistance
  };
}

/**
 * Common distance text rendering with rotation and styling
 */
export function renderDistanceTextCommonImpl(
  rc: BaseRenderingContext,
  worldStart: Point2D,
  worldEnd: Point2D,
  screenStart: Point2D,
  screenEnd: Point2D,
  textPosition: Point2D
): void {
  // 🏢 ADR-109: Use centralized distance calculation
  const worldDistance = calculateDistance(worldStart, worldEnd);
  // 🏢 ADR-078: Use centralized calculateAngle
  const angle = calculateAngle(screenStart, screenEnd);
  // 🏢 ADR-090: Centralized number formatting
  const text = formatDistance(worldDistance);

  rc.ctx.save();
  rc.ctx.translate(textPosition.x, textPosition.y);
  // 🏢 ADR-110: Use centralized text rotation normalization (keeps text readable)
  rc.ctx.rotate(normalizeTextAngle(angle));
  // Apply distance text styling with full decoration support
  rc.applyDistanceTextStyle();
  renderStyledTextWithOverride(rc.ctx, text, 0, 0);
  rc.ctx.restore();
}

/**
 * 🔺 Inline distance text (on the line itself) — used in preview phase
 */
export function renderInlineDistanceTextImpl(
  rc: BaseRenderingContext,
  worldStart: Point2D, worldEnd: Point2D,
  screenStart: Point2D, screenEnd: Point2D
): void {
  // 🏢 ADR-073: Use centralized midpoint calculation
  const textPosition = calculateMidpoint(screenStart, screenEnd);
  renderDistanceTextCommonImpl(rc, worldStart, worldEnd, screenStart, screenEnd, textPosition);
}

/**
 * 🔺 Offset distance text (perpendicular to line) — used in measurement phase
 */
export function renderDistanceTextCentralizedImpl(
  rc: BaseRenderingContext,
  worldStart: Point2D, worldEnd: Point2D,
  screenStart: Point2D, screenEnd: Point2D,
  offsetDistance: number = 15
): void {
  const textPos = calculateDistanceTextPositionImpl(screenStart, screenEnd, offsetDistance);
  renderDistanceTextCommonImpl(rc, worldStart, worldEnd, screenStart, screenEnd, textPos);
}

/**
 * 🔺 Phase-aware distance text: inline for preview, offset for measurements
 */
export function renderDistanceTextPhaseAwareImpl(
  rc: BaseRenderingContext,
  worldStart: Point2D, worldEnd: Point2D,
  screenStart: Point2D, screenEnd: Point2D,
  entity: EntityModel, options: RenderOptions
): void {
  const phaseState = rc.phaseManager.determinePhase(entity as Entity, options);
  if (phaseState.phase === 'preview') {
    renderInlineDistanceTextImpl(rc, worldStart, worldEnd, screenStart, screenEnd);
  } else {
    renderDistanceTextCentralizedImpl(rc, worldStart, worldEnd, screenStart, screenEnd);
  }
}

/**
 * 🔺 Check if entity needs split line with distance text gap
 */
export function shouldRenderSplitLineImpl(
  rc: BaseRenderingContext,
  entity: EntityModel, options: RenderOptions = {}
): boolean {
  const phaseState = rc.phaseManager.determinePhase(entity as Entity, options);
  const hasDistanceFlag = ('showEdgeDistances' in entity && entity.showEdgeDistances === true);
  return phaseState.phase === 'preview' && hasDistanceFlag;
}

/**
 * 🔺 Check if lines should be rendered (with override support)
 */
export function shouldRenderLinesImpl(): boolean {
  // ✅ ΔΙΟΡΘΩΣΗ: Χρήση WithOverride και για NORMAL phase
  return getLinePreviewStyleWithOverride().enabled;
}

/**
 * 🔺 Split line with gap for distance text
 * 🏢 ADR-085: Centralized Split Line Rendering
 */
export function renderSplitLineWithGapImpl(
  rc: BaseRenderingContext,
  screenStart: Point2D, screenEnd: Point2D,
  entity: EntityModel, options: RenderOptions = {},
  gapSize: number = RENDER_GEOMETRY.SPLIT_LINE_GAP
): void {
  const phaseState = rc.phaseManager.determinePhase(entity as Entity, options);
  // ✅ PHASE AWARE: Χρήση WithOverride
  const textStyle = phaseState.phase === 'preview'
    ? getTextPreviewStyleWithOverride()
    : getTextPreviewStyleWithOverride(); // ✅ ΔΙΟΡΘΩΣΗ: Χρήση WithOverride και για NORMAL phase

  if (textStyle.enabled) {
    // 🏢 ADR-085: Delegate to centralized utility
    renderSplitLineWithGapUtil(rc.ctx, screenStart, screenEnd, gapSize);
  } else {
    // 🏢 ADR-085: Delegate to centralized utility
    renderContinuousLineUtil(rc.ctx, screenStart, screenEnd);
  }
}

// ============================================================
// ARC / ANGLE HELPERS
// ============================================================

/** Apply orange dashed arc style to canvas context */
export function applyArcStyleToCtx(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = UI_COLORS.DRAWING_TEMP; // Πορτοκαλί χρώμα
  ctx.setLineDash([...LINE_DASH_PATTERNS.ARC]); // 🏢 ADR-083
  ctx.lineWidth = RENDER_LINE_WIDTHS.THIN; // 🏢 ADR-044
}

/**
 * 🔺 Draw arc between two angles at a center point
 * For circles/arcs without angle vertices
 */
export function drawCentralizedArcImpl(
  rc: BaseRenderingContext,
  centerX: number, centerY: number,
  radius: number,
  startAngle: number, endAngle: number
): void {
  rc.ctx.save();
  applyArcStyleToCtx(rc.ctx);
  const screenCenter = rc.worldToScreen({ x: centerX, y: centerY });
  const screenRadius = radius * rc.transform.scale;
  // 🏢 ADR-058: Use centralized canvas primitives
  rc.ctx.beginPath();
  addArcPath(rc.ctx, screenCenter, screenRadius, startAngle, endAngle);
  rc.ctx.stroke();
  rc.ctx.restore();
}

/**
 * 🎯 Draw internal angle arc between vertex and two points
 * Uses dot product logic for correct quadrant selection
 */
export function drawInternalAngleArcImpl(
  rc: BaseRenderingContext,
  vertex: Point2D, point1: Point2D, point2: Point2D,
  radiusWorld: number
): void {
  const toPoint1 = { x: point1.x - vertex.x, y: point1.y - vertex.y };
  const toPoint2 = { x: point2.x - vertex.x, y: point2.y - vertex.y };
  // 🏢 ADR-070: Use centralized vector magnitude
  const len1 = vectorMagnitude(toPoint1);
  const len2 = vectorMagnitude(toPoint2);
  if (len1 === 0 || len2 === 0) return;
  const prevUnit = { x: toPoint1.x / len1, y: toPoint1.y / len1 };
  const nextUnit = { x: toPoint2.x / len2, y: toPoint2.y / len2 };
  const rPx = radiusWorld * rc.transform.scale;
  drawInternalArcOnCanvas(rc, vertex, prevUnit, nextUnit, rPx);
}

/**
 * 🔺 Render angle arc + degree label at a vertex
 * Used by Rectangle, Polyline, AngleMeasurement renderers
 * Uses exact logic from TODO.md with dot product for correct quadrant
 */
export function renderAngleAtVertexImpl(
  rc: BaseRenderingContext,
  prevVertex: Point2D, currentVertex: Point2D, nextVertex: Point2D,
  prevScreen: Point2D, currentScreen: Point2D, nextScreen: Point2D,
  arcRadius: number = 30,
  labelOffset: number = 15
): void {
  // Calculate unit vectors in world coordinates
  const toPrev = {
    x: prevVertex.x - currentVertex.x,
    y: prevVertex.y - currentVertex.y
  };
  const toNext = {
    x: nextVertex.x - currentVertex.x,
    y: nextVertex.y - currentVertex.y
  };

  // Normalize vectors
  // 🏢 ADR-070: Use centralized vector magnitude
  const prevLength = vectorMagnitude(toPrev);
  const nextLength = vectorMagnitude(toNext);
  if (prevLength === 0 || nextLength === 0) return;

  const prevUnit = { x: toPrev.x / prevLength, y: toPrev.y / prevLength };
  const nextUnit = { x: toNext.x / nextLength, y: toNext.y / nextLength };

  // Calculate angle in degrees for label
  // 🏢 ADR-078: Use centralized vectorAngle
  const angle1 = vectorAngle(prevUnit);
  const angle2 = vectorAngle(nextUnit);
  let angleDiff = angle2 - angle1;
  if (angleDiff < 0) angleDiff += TAU;
  if (angleDiff > Math.PI) angleDiff = TAU - angleDiff;
  // 🏢 ADR-067: Use centralized angle conversion
  const degrees = radToDeg(angleDiff);

  // 🔺 ΕΦΑΡΜΟΓΗ ΑΚΡΙΒΟΥΣ ΛΟΓΙΚΗΣ ΑΠΟ TODO.MD
  drawInternalArcOnCanvas(rc, currentVertex, prevUnit, nextUnit, arcRadius);

  // 🏢 ADR-073: Use centralized bisector angle calculation
  const bisectorAngleValue = bisectorAngle(angle1, angle2);
  // 🏢 ADR-141: Centralized arc label positioning constants
  const rTextPx = Math.max(
    arcRadius * ARC_LABEL_POSITIONING.OFFSET_RATIO,
    ARC_LABEL_POSITIONING.MIN_OFFSET_PX
  );
  const rWorld = rTextPx / rc.transform.scale;

  const worldLabelX = currentVertex.x + Math.cos(bisectorAngleValue) * rWorld;
  const worldLabelY = currentVertex.y + Math.sin(bisectorAngleValue) * rWorld;
  const screenLabel = rc.worldToScreen({ x: worldLabelX, y: worldLabelY });

  // Draw label
  rc.ctx.save();
  // 🏢 ENTERPRISE: Use centralized angle measurement text style (fuchsia color)
  // NOT renderStyledTextWithOverride which would override with white
  rc.applyAngleMeasurementTextStyle();
  // 🏢 ADR-090: Centralized number formatting
  const angleText = formatAngle(degrees, 1);
  rc.ctx.fillText(angleText, screenLabel.x, screenLabel.y);
  rc.ctx.restore();
}

/**
 * 🔺 Draw the SMALLER arc (internal angle) between two unit vectors
 * Always draws the shortest path (< 180°)
 * 🎯 FIX (2026-02-13): Correct quadrant selection with dot product
 */
export function drawInternalArcOnCanvas(
  rc: BaseRenderingContext,
  vertex: Point2D,
  prevUnit: Point2D,
  nextUnit: Point2D,
  rPx: number
): void {
  const v = rc.worldToScreen(vertex);

  // Convert to screen-space (flip Y for canvas coordinate system)
  const u1 = { x: prevUnit.x, y: -prevUnit.y };
  const u2 = { x: nextUnit.x, y: -nextUnit.y };

  // 🏢 ADR-078: Use centralized vectorAngle
  const a1 = vectorAngle(u1);
  const a2 = vectorAngle(u2);

  // Calculate angle differences (normalized 0 to 2π)
  const norm = (t: number) => (t % (TAU) + TAU) % (TAU);
  const dCCW = norm(a2 - a1);  // Counter-clockwise distance

  // 🎯 FIX (2026-02-13): Select direction for SMALLER arc (internal angle)
  // dCCW = CW angular distance (canvas Y-down: increasing angle = clockwise)
  // - dCCW < π → CW path is short → useCCW = false (draw CW = small arc)
  // - dCCW > π → CW path is long → useCCW = true (draw CCW = small arc)
  const useCCW = dCCW > Math.PI;

  rc.ctx.save();
  applyArcStyleToCtx(rc.ctx);
  rc.ctx.beginPath();
  // 🏢 ADR-058: Use centralized canvas primitives
  addArcPath(rc.ctx, v, rPx, a1, a2, useCCW);
  rc.ctx.stroke();
  rc.ctx.restore();
}
