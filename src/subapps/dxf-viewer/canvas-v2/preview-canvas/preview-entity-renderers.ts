/**
 * Preview Entity Renderers — ADR-065 SRP split
 * Per-entity-type canvas rendering functions for drawing previews.
 * Extracted from PreviewRenderer.ts.
 */

import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { ExtendedLineEntity, ExtendedCircleEntity, ExtendedPolylineEntity, PreviewPoint } from '../../hooks/drawing/useUnifiedDrawing';
import type { AngleMeasurementEntity } from '../../types/scene';
import type { PreviewRenderOptions, ArcPreviewEntity, PreviewRenderHelpers } from './preview-renderer-types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { calculateWorldDistance, formatAngleLocale } from '../../rendering/entities/shared/distance-label-utils';
import { RENDER_LINE_WIDTHS, UI_FONTS, LINE_DASH_PATTERNS, RENDER_GEOMETRY } from '../../config/text-rendering-config';
import { calculateAngle } from '../../rendering/entities/shared/geometry-rendering-utils';
// ADR-510 Φ1 (Q7): reuse the SSoT angle pipeline (no duplicate atan2/normalise).
import { radToDeg, normalizeAngleDeg } from '../../rendering/entities/shared/geometry-angle-utils';
import { bisectorAngle, TAU, degToRad, createRectangleVertices } from '../../rendering/entities/shared/geometry-utils';
import { UI_COLORS, OPACITY } from '../../config/color-config';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
// 🏢 ADR-557 follow-up: closed-polygon area+perimeter label SSoT (committed/preview/hover parity)
import {
  computePolygonAreaMetrics,
  paintPolygonAreaLabel,
  buildAreaPerimeterLabelLines,
  buildAreaLabel,
  buildArcLengthLabel,
} from '../../rendering/entities/shared/measurement-label';
// 🌐 Καθολικό status-bar toggle «ΜΗΚΟΣ/ΓΩΝΙΑ» (SSoT predicate): gate ΣΤΑ CALL SITES των
// length/angle preview draws — ΠΟΤΕ μέσα στους shared painters (κοινοί με committed).
// ΔΕΝ αφορά εμβαδόν/περίμετρο/circumference (μένουν πάντα ορατά).
import { isLengthAngleHudVisible } from '../../systems/constraints/length-angle-hud-gate';

// ===== LINE =====

// ADR-510 Φ1 (Q7): vertical screen-px gap so the live angle label sits just below
// the length label on the rubber-band ghost (no overlap with the distance text).
const GHOST_ANGLE_LABEL_OFFSET_Y = 16;

export function renderLine(
  ctx: CanvasRenderingContext2D, entity: ExtendedLineEntity,
  transform: ViewTransform, opts: Required<PreviewRenderOptions>, h: PreviewRenderHelpers,
): void {
  const start = CoordinateTransforms.worldToScreen(entity.start, transform, h.viewport);
  const end = CoordinateTransforms.worldToScreen(entity.end, transform, h.viewport);

  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();

  if (opts.showGrips) {
    h.renderGrip(ctx, start, opts);
    h.renderGrip(ctx, end, opts);
  }

  // ADR-508 §line-hud — όταν το line tool έχει το live aligned HUD (μήκος+γωνία ως ISO-129
  // διάσταση, ίδιο με τον τοίχο), ο handler το ζωγραφίζει μέσω `paintWallHudCore`· εδώ ΠΑΡΑΛΕΙΠΟΥΜΕ
  // τα παλιά inline text labels ώστε να μην εμφανίζεται διπλό μήκος/γωνία. measure-distance (χωρίς
  // `liveDimHud`) κρατά τα inline labels του.
  // 🌐 toggle «ΜΗΚΟΣ/ΓΩΝΙΑ»: κρύψε μήκος+γωνία της γραμμής όταν OFF (call-site gate).
  if ((entity.measurement || entity.showEdgeDistances) && !entity.liveDimHud && isLengthAngleHudVisible()) {
    h.renderDistanceLabelFromWorld(ctx, entity.start, entity.end, start, end);
    // ADR-510 Φ1 (Q7): show the live heading alongside the length, so the ghost
    // reports BOTH μήκος + γωνία directly on the canvas (locale-aware via SSoT).
    // Angle pipeline = SSoT chain: calculateAngle (rad) → radToDeg → normalizeAngleDeg (0..360).
    const angleDeg = normalizeAngleDeg(radToDeg(calculateAngle(entity.start, entity.end)));
    const mid: Point2D = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    h.renderInfoLabel(ctx, { x: mid.x, y: mid.y + GHOST_ANGLE_LABEL_OFFSET_Y }, [formatAngleLocale(angleDeg, 1)]);
  }
}

// ===== CIRCLE =====

function renderCircleMeasurementLine(
  ctx: CanvasRenderingContext2D, entity: ExtendedCircleEntity,
  transform: ViewTransform, center: Point2D, h: PreviewRenderHelpers,
): void {
  const radius = entity.radius;
  const cursorWorld: Point2D = entity.previewCursorPoint ?? { x: entity.center.x + radius, y: entity.center.y };
  const cursorScreen = CoordinateTransforms.worldToScreen(cursorWorld, transform, h.viewport);

  if (entity.diameterMode && entity.previewCursorPoint) {
    const oppositeWorld: Point2D = {
      x: 2 * entity.center.x - cursorWorld.x,
      y: 2 * entity.center.y - cursorWorld.y,
    };
    const oppositeScreen = CoordinateTransforms.worldToScreen(oppositeWorld, transform, h.viewport);
    ctx.beginPath();
    ctx.moveTo(oppositeScreen.x, oppositeScreen.y);
    ctx.lineTo(cursorScreen.x, cursorScreen.y);
    ctx.stroke();
    h.renderDistanceLabelFromWorld(ctx, oppositeWorld, cursorWorld, oppositeScreen, cursorScreen);
  } else {
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.lineTo(cursorScreen.x, cursorScreen.y);
    ctx.stroke();
    h.renderDistanceLabelFromWorld(ctx, entity.center, cursorWorld, center, cursorScreen);
  }
}

export function renderCircle(
  ctx: CanvasRenderingContext2D, entity: ExtendedCircleEntity,
  transform: ViewTransform, opts: Required<PreviewRenderOptions>, h: PreviewRenderHelpers,
): void {
  const center = CoordinateTransforms.worldToScreen(entity.center, transform, h.viewport);
  const radiusScreen = entity.radius * transform.scale;

  ctx.beginPath();
  ctx.ellipse(center.x, center.y, radiusScreen, radiusScreen, 0, 0, TAU);
  ctx.stroke();

  if (opts.showGrips) h.renderGrip(ctx, center, opts);

  if (entity.showPreviewMeasurements && entity.radius > 0) {
    // 🌐 toggle «ΜΗΚΟΣ/ΓΩΝΙΑ»: κρύψε ΜΟΝΟ την ένδειξη ακτίνας/διαμέτρου (μήκος)· το
    // εμβαδόν+περίμετρος (renderInfoLabel παρακάτω) ΜΕΝΕΙ πάντα ορατό.
    if (isLengthAngleHudVisible()) {
      renderCircleMeasurementLine(ctx, entity, transform, center, h);
    }
    const circumference = TAU * entity.radius;
    const area = Math.PI * entity.radius * entity.radius;
    // ADR-160 (δ): κοινή σειρά εμβαδόν→περίμετρος παντού (area line πρώτα).
    // 🏢 ADR-557 follow-up (N.11): content via the SSoT builder (kills the `Ε:`/`Περ:`
    // hardcoded Greek literals) — same prefixes/order as the rectangle preview below.
    h.renderInfoLabel(ctx, center, buildAreaPerimeterLabelLines({ area, perimeter: circumference }));
  }
}

// ===== POLYLINE =====

export function renderPolyline(
  ctx: CanvasRenderingContext2D, entity: ExtendedPolylineEntity,
  transform: ViewTransform, opts: Required<PreviewRenderOptions>, h: PreviewRenderHelpers,
): void {
  if (!entity.vertices || entity.vertices.length < 2) return;

  const screenPoints = entity.vertices.map(v => CoordinateTransforms.worldToScreen(v, transform, h.viewport));

  ctx.beginPath();
  ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
  for (let i = 1; i < screenPoints.length; i++) {
    ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
  }
  if (entity.closed) ctx.closePath();
  ctx.stroke();

  if (opts.showGrips) {
    for (const pt of screenPoints) h.renderGrip(ctx, pt, opts);
  }

  if (entity.showEdgeDistances) {
    // 🌐 toggle «ΜΗΚΟΣ/ΓΩΝΙΑ»: κρύψε ΜΟΝΟ τα edge lengths (μήκη ακμών) όταν OFF·
    // το εμβαδόν/περίμετρος (paintPolygonAreaLabel παρακάτω) ΜΕΝΕΙ πάντα ορατό.
    if (isLengthAngleHudVisible()) {
      for (let i = 1; i < screenPoints.length; i++) {
        h.renderDistanceLabelFromWorld(ctx, entity.vertices[i - 1], entity.vertices[i], screenPoints[i - 1], screenPoints[i]);
      }
    }

    if (entity.vertices.length >= 3) {
      const metrics = computePolygonAreaMetrics(entity.vertices, !!entity.closed);
      const centroidScreen = CoordinateTransforms.worldToScreen(metrics.centroid, transform, h.viewport);
      paintPolygonAreaLabel(ctx, centroidScreen, metrics);
    }
  }
}

// ===== RECTANGLE =====

export function renderRectangle(
  ctx: CanvasRenderingContext2D,
  entity: { corner1?: Point2D; corner2?: Point2D; rotation?: number; showPreviewMeasurements?: boolean },
  transform: ViewTransform, opts: Required<PreviewRenderOptions>, h: PreviewRenderHelpers,
): void {
  if (!entity.corner1 || !entity.corner2) return;

  // rotated-rectangle (ADR-620): σχεδίασε τις 4 ΠΕΡΙΣΤΡΑΜΜΕΝΕΣ κορυφές (pivot=corner1) μέσω του SSoT ως
  // path — το ghost preview στρίβει όπως το committed. (`ctx.strokeRect` ΔΕΝ μπορεί να σχεδιάσει
  // περιστραμμένο ορθογώνιο· rotation=0 → identity verts → πανομοιότυπο με πριν.)
  const worldVerts = createRectangleVertices(entity.corner1, entity.corner2, entity.rotation);
  const sv = worldVerts.map(v => CoordinateTransforms.worldToScreen(v, transform, h.viewport));

  ctx.beginPath();
  ctx.moveTo(sv[0].x, sv[0].y);
  for (let i = 1; i < sv.length; i += 1) ctx.lineTo(sv[i].x, sv[i].y);
  ctx.closePath();
  ctx.stroke();

  if (opts.showGrips) {
    for (const p of sv) h.renderGrip(ctx, p, opts);
  }

  if (entity.showPreviewMeasurements) {
    // Τοπικές πλευρές μετά την περιστροφή: πλάτος = κορυφή0→1, ύψος = κορυφή0→3.
    const [v0, v1, , v3] = worldVerts;

    // 🌐 toggle «ΜΗΚΟΣ/ΓΩΝΙΑ»: κρύψε ΜΟΝΟ πλάτος/ύψος (γεωμετρικές διαστάσεις) όταν OFF·
    // το εμβαδόν+περίμετρος (renderInfoLabel παρακάτω) ΜΕΝΕΙ πάντα ορατό.
    if (isLengthAngleHudVisible()) {
      h.renderDistanceLabelFromWorld(ctx, v0, v1, sv[0], sv[1]);
      h.renderDistanceLabelFromWorld(ctx, v0, v3, sv[0], sv[3]);
    }

    const worldWidth = calculateWorldDistance(v0, v1);
    const worldHeight = calculateWorldDistance(v0, v3);
    const perimeter = 2 * (worldWidth + worldHeight);
    const area = worldWidth * worldHeight;
    // Κέντρο = μέσο της διαγωνίου (κορυφή0↔κορυφή2) — σωστό ΚΑΙ για περιστραμμένο.
    const centerScreen: Point2D = { x: (sv[0].x + sv[2].x) / 2, y: (sv[0].y + sv[2].y) / 2 };
    // ADR-160 (δ): rectangle preview περνά από τον ΚΟΙΝΟ content builder (area→perimeter,
    // i18n prefixes) — ίδια σειρά & περιεχόμενο με το committed rectangle/polygon.
    h.renderInfoLabel(ctx, centerScreen, buildAreaPerimeterLabelLines({ area, perimeter }));
  }
}

// ===== ANGLE MEASUREMENT =====

export function renderAngleMeasurement(
  ctx: CanvasRenderingContext2D,
  entity: { vertex: Point2D; point1: Point2D; point2: Point2D; angle: number },
  transform: ViewTransform, opts: Required<PreviewRenderOptions>, h: PreviewRenderHelpers,
): void {
  const screenVertex = CoordinateTransforms.worldToScreen(entity.vertex, transform, h.viewport);
  const screenPoint1 = CoordinateTransforms.worldToScreen(entity.point1, transform, h.viewport);
  const screenPoint2 = CoordinateTransforms.worldToScreen(entity.point2, transform, h.viewport);

  ctx.beginPath();
  ctx.moveTo(screenVertex.x, screenVertex.y);
  ctx.lineTo(screenPoint1.x, screenPoint1.y);
  ctx.moveTo(screenVertex.x, screenVertex.y);
  ctx.lineTo(screenPoint2.x, screenPoint2.y);
  ctx.stroke();

  const arcRadius = RENDER_GEOMETRY.ANGLE_ARC_RADIUS;
  const angle1 = calculateAngle(entity.vertex, entity.point1);
  const angle2 = calculateAngle(entity.vertex, entity.point2);

  ctx.save();
  ctx.strokeStyle = UI_COLORS.PREVIEW_ARC_ORANGE;
  ctx.setLineDash([...LINE_DASH_PATTERNS.DASHED]);
  ctx.beginPath();
  ctx.ellipse(screenVertex.x, screenVertex.y, arcRadius, arcRadius, 0, angle1, angle2, false);
  ctx.stroke();
  ctx.restore();

  if (opts.showGrips) {
    h.renderGrip(ctx, screenVertex, opts);
    h.renderGrip(ctx, screenPoint1, opts);
    h.renderGrip(ctx, screenPoint2, opts);
  }

  // 🌐 toggle «ΜΗΚΟΣ/ΓΩΝΙΑ»: κρύψε τα μήκη των σκελών μέτρησης όταν OFF (call-site gate).
  if (isLengthAngleHudVisible()) {
    if (entity.vertex && entity.point1) h.renderDistanceLabelFromWorld(ctx, entity.vertex, entity.point1, screenVertex, screenPoint1);
    if (entity.vertex && entity.point2) h.renderDistanceLabelFromWorld(ctx, entity.vertex, entity.point2, screenVertex, screenPoint2);
  }

  const bisectorAngleValue = bisectorAngle(angle1, angle2);
  const textDistance = RENDER_GEOMETRY.ANGLE_TEXT_DISTANCE;
  const textX = screenVertex.x + Math.cos(bisectorAngleValue) * textDistance;
  const textY = screenVertex.y + Math.sin(bisectorAngleValue) * textDistance;

  // 🌐 toggle «ΜΗΚΟΣ/ΓΩΝΙΑ»: κρύψε την ένδειξη γωνίας (∠θ) όταν OFF (call-site gate).
  if (isLengthAngleHudVisible()) {
    ctx.save();
    ctx.fillStyle = UI_COLORS.DIMENSION_TEXT;
    ctx.font = UI_FONTS.ARIAL.LARGE;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${entity.angle.toFixed(1)}°`, textX, textY);
    ctx.restore();
  }
}

// ===== POINT =====

export function renderPoint(
  ctx: CanvasRenderingContext2D, entity: PreviewPoint,
  transform: ViewTransform, opts: Required<PreviewRenderOptions>, h: PreviewRenderHelpers,
): void {
  if (!opts.showGrips) return;
  const pos = CoordinateTransforms.worldToScreen(entity.position, transform, h.viewport);
  h.renderGrip(ctx, pos, opts);
}

// ===== ARC =====

export function renderArc(
  ctx: CanvasRenderingContext2D, entity: ArcPreviewEntity,
  transform: ViewTransform, opts: Required<PreviewRenderOptions>, h: PreviewRenderHelpers,
): void {
  const center = CoordinateTransforms.worldToScreen(entity.center, transform, h.viewport);
  const radiusScreen = entity.radius * transform.scale;
  const startRad = degToRad(entity.startAngle);
  const endRad = degToRad(entity.endAngle);

  // Construction lines (rubber band)
  if (entity.showConstructionLines && entity.constructionVertices && entity.constructionVertices.length >= 2) {
    ctx.save();
    ctx.setLineDash([...LINE_DASH_PATTERNS.CONSTRUCTION]);
    ctx.strokeStyle = PANEL_LAYOUT.CAD_COLORS.CONSTRUCTION_LINE || opts.color;
    ctx.lineWidth = RENDER_LINE_WIDTHS.PREVIEW_CONSTRUCTION || 1;
    ctx.globalAlpha = OPACITY.MEDIUM;

    const screenVertices = entity.constructionVertices.map(v => CoordinateTransforms.worldToScreen(v, transform, h.viewport));
    const mode = entity.constructionLineMode || 'polyline';

    if (mode === 'radial') {
      renderArcRadialConstruction(ctx, entity, center, transform, opts, h);
    } else {
      renderArcPolylineConstruction(ctx, entity, screenVertices, opts, h);
    }
    ctx.restore();
  }

  // Arc shape (solid)
  const screenStartRad = -startRad;
  const screenEndRad = -endRad;
  const screenCounterclockwise = !(entity.counterclockwise ?? false);

  ctx.beginPath();
  ctx.ellipse(center.x, center.y, radiusScreen, radiusScreen, 0, screenStartRad, screenEndRad, screenCounterclockwise);
  ctx.stroke();

  if (opts.showGrips) h.renderGrip(ctx, center, opts);

  // Arc measurements
  if (entity.radius > 0) {
    let sweepRad = endRad - startRad;
    if (entity.counterclockwise) { if (sweepRad <= 0) sweepRad += TAU; }
    else { if (sweepRad >= 0) sweepRad -= TAU; }
    const absSweep = Math.abs(sweepRad);

    if (absSweep > 0.001) {
      const arcLength = entity.radius * absSweep;
      const sectorArea = 0.5 * entity.radius * entity.radius * absSweep;
      // ADR-160 (δ): κοινή σειρά εμβαδόν→(μήκος/περίμετρος) — area line πρώτα.
      // 🏢 ADR-557 follow-up (N.11): content via the SSoT builders (kills the `Ε:`/`L:`
      // hardcoded literals) — same prefixes as the committed ArcRenderer/circle-text-utils.
      h.renderInfoLabel(ctx, center, [
        buildAreaLabel(sectorArea),
        buildArcLengthLabel(arcLength),
      ]);
    }
  }
}

// ===== ARC CONSTRUCTION HELPERS =====

function renderArcRadialConstruction(
  ctx: CanvasRenderingContext2D, entity: ArcPreviewEntity,
  centerScreen: Point2D, transform: ViewTransform,
  opts: Required<PreviewRenderOptions>, h: PreviewRenderHelpers,
): void {
  const startAngleRad = degToRad(entity.startAngle);
  const endAngleRad = degToRad(entity.endAngle);

  const startPointWorld: Point2D = {
    x: entity.center.x + Math.cos(startAngleRad) * entity.radius,
    y: entity.center.y + Math.sin(startAngleRad) * entity.radius,
  };
  const endPointWorld: Point2D = {
    x: entity.center.x + Math.cos(endAngleRad) * entity.radius,
    y: entity.center.y + Math.sin(endAngleRad) * entity.radius,
  };

  const startPointScreen = CoordinateTransforms.worldToScreen(startPointWorld, transform, h.viewport);
  const endPointScreen = CoordinateTransforms.worldToScreen(endPointWorld, transform, h.viewport);

  ctx.beginPath();
  ctx.moveTo(centerScreen.x, centerScreen.y);
  ctx.lineTo(startPointScreen.x, startPointScreen.y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(centerScreen.x, centerScreen.y);
  ctx.lineTo(endPointScreen.x, endPointScreen.y);
  ctx.stroke();

  if (opts.showGrips) {
    h.renderGrip(ctx, centerScreen, opts);
    h.renderGrip(ctx, startPointScreen, opts);
    h.renderGrip(ctx, endPointScreen, opts);
  }

  if (entity.showEdgeDistances) {
    h.renderDistanceLabelFromWorld(ctx, entity.center, startPointWorld, centerScreen, startPointScreen);
  }
}

function renderArcPolylineConstruction(
  ctx: CanvasRenderingContext2D, entity: ArcPreviewEntity,
  screenVertices: Point2D[], opts: Required<PreviewRenderOptions>, h: PreviewRenderHelpers,
): void {
  ctx.beginPath();
  ctx.moveTo(screenVertices[0].x, screenVertices[0].y);
  for (let i = 1; i < screenVertices.length; i++) {
    ctx.lineTo(screenVertices[i].x, screenVertices[i].y);
  }
  ctx.stroke();

  if (opts.showGrips) {
    for (const sv of screenVertices) h.renderGrip(ctx, sv, opts);
  }

  if (entity.showEdgeDistances && entity.constructionVertices) {
    for (let i = 0; i < entity.constructionVertices.length - 1; i++) {
      h.renderDistanceLabelFromWorld(
        ctx, entity.constructionVertices[i], entity.constructionVertices[i + 1],
        screenVertices[i], screenVertices[i + 1]
      );
    }
  }
}
