/**
 * Annotation hit-tests (text / MTEXT, angle measurement, dimension) — extracted
 * from `hit-test-entity-tests.ts` (SRP / Google file-size standard N.7.1). These
 * are the non-geometric annotation entities; the BIM + primitive geometry hit
 * tests stay in the parent module. The dispatcher (`performDetailedHitTest`)
 * imports the three exported entry points back.
 */
import type { Point2D } from '../types/Types';
import type { Entity, DimensionEntity } from '../../types/entities';
import type { DxfText } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { HitTestResult } from './hit-tester-types';
import { pointToLineDistance } from '../entities/shared/geometry-utils';
import { calculateDistance } from '../entities/shared/geometry-rendering-utils';
// ADR-557 Φ-attachment — the attachment-aware text-box SSoT (the SAME box the 2D hover
// frame / grips / 3D mesh draw), so the hover HIT zone coincides with the drawn rectangle.
import { resolveTextBox } from '../../bim/text/text-box';
import { projectToLocalFrame } from '../../bim/grips/grip-math';
import {
  computeDimHitGeometry,
  buildVariantHitGeometry,
  hitTestDimGeometry,
} from '../../systems/dimensions/dim-hit-geometry';
import { closestPointOnLine } from './hit-test-entity-tests';

// ===== TEXT / MTEXT =====

export function hitTestText(entity: Entity, point: Point2D, tolerance: number): Partial<HitTestResult> | null {
  if (!('position' in entity) || !(entity.position as Point2D)) return null;

  // Support flat `text` field (DXF-imported) and `textNode` AST (CreateTextCommand).
  let text = ('text' in entity ? entity.text : undefined) as string | undefined;
  if (!text) {
    type TextNodeShape = { paragraphs?: Array<{ runs?: Array<{ text?: string }> }> };
    const textNode = ('textNode' in entity ? entity.textNode : undefined) as TextNodeShape | undefined;
    if (textNode?.paragraphs) {
      text = textNode.paragraphs
        .map(p => (p.runs ?? []).map(r => r.text ?? '').join(''))
        .join('') || undefined;
    }
  }
  if (!text) return null;

  const height = ('height' in entity && typeof entity.height === 'number' && entity.height > 0)
    ? entity.height as number
    : ('fontSize' in entity && typeof entity.fontSize === 'number' && entity.fontSize > 0)
      ? entity.fontSize as number
      : 2.5;

  // ADR-557 Φ-attachment (Giorgio 2026-07-07) — test against the attachment-aware text-box
  // SSoT (`resolveTextBox`), the SAME rotation-aware box the 2D hover frame + grips + 3D mesh
  // draw. Was: a hardcoded monospace, baseline-bottom-left box that ignored the attachment
  // point / widthFactor / real glyph advance / cap-height ink → the glowing frame lit up
  // BEFORE the cursor reached the glyphs on some sides and stayed dark though the cursor was
  // already inside on others. Mirrors `TextRenderer.hitTest`; `tolerance` here is already in
  // world units (HitTester passes `pixelTolerance / scale`), so it adds directly to the box.
  const dxfText = { ...(entity as unknown as DxfText), text, height };
  const box = resolveTextBox(dxfText);
  const local = projectToLocalFrame({ x: point.x - box.center.x, y: point.y - box.center.y }, box.rotationDeg);
  if (Math.abs(local.x) <= box.halfWidth + tolerance && Math.abs(local.y) <= box.halfLength + tolerance) {
    return { hitType: 'entity', hitPoint: point };
  }
  return null;
}

// ===== ANGLE MEASUREMENT =====

export function hitTestAngleMeasurement(entity: Entity, point: Point2D, tolerance: number): Partial<HitTestResult> | null {
  if (!('vertex' in entity) || !('point1' in entity) || !('point2' in entity)) return null;
  const angleMeasurement = entity as { vertex: Point2D; point1: Point2D; point2: Point2D };

  const distArm1 = pointToLineDistance(point, angleMeasurement.vertex, angleMeasurement.point1);
  if (distArm1 <= tolerance) {
    return { hitType: 'entity', hitPoint: closestPointOnLine(point, angleMeasurement.vertex, angleMeasurement.point1) };
  }

  const distArm2 = pointToLineDistance(point, angleMeasurement.vertex, angleMeasurement.point2);
  if (distArm2 <= tolerance) {
    return { hitType: 'entity', hitPoint: closestPointOnLine(point, angleMeasurement.vertex, angleMeasurement.point2) };
  }
  return null;
}

// ===== DIMENSION =====

/**
 * ADR-362 Phase I3 — Geometry-aware hit test for DimensionEntity.
 *
 * defPoints semantic (linear/aligned):
 *   [0] = ext-line origin 1  [1] = ext-line origin 2  [2] = dim-line ref
 *
 * Hotfix 2026-05-19: previously approximated the dim line as pts[0]→pts[1]
 * (the *feature* segment) and the text anchor as midpt(pts[0], pts[1]). For
 * any dim whose dim line is offset from the feature segment (the normal case)
 * the dim line and text were hit-untestable from where they were rendered.
 *
 * New path for linear+aligned: use `computeDimHitGeometry()` to derive the
 * actual foot points (projections of pts[0], pts[1] onto the dim line through
 * pts[2]) and use those for the dim-line + text-anchor tests. Extension lines
 * test pts[0]→foot1 and pts[1]→foot2 (the rendered extension paths).
 *
 * ADR-362 Phase I (2026-06-24): radial / angular / ordinate now hit-test against
 * their actual rendered arc / leader / dim-line via `buildVariantHitGeometry` +
 * `hitTestDimGeometry` (shared SSoT) instead of the legacy defPoints
 * approximation. baseline / continued (lookup-dependent) keep the legacy path.
 *
 * Tests (priority order):
 *   1. Text label — circle around textAnchor (tolerance × 1.5)
 *   2. Dim line — foot1→foot2 segment (rendered position)
 *   3. Extension lines — pts[0]→foot1 and pts[1]→foot2
 *   4. defPoint proximity fallback (catch arrowhead-origin clicks)
 */
export function hitTestDimension(entity: DimensionEntity, point: Point2D, tolerance: number): Partial<HitTestResult> | null {
  const pts = entity.defPoints;
  if (!pts || pts.length === 0) return null;

  const hitGeom = computeDimHitGeometry(entity);
  if (hitGeom) {
    return hitTestStraightDim(entity, point, tolerance, hitGeom);
  }
  const variantGeom = buildVariantHitGeometry(entity);
  if (variantGeom) {
    const hitPoint = hitTestDimGeometry(variantGeom, point, tolerance);
    if (hitPoint) return { hitType: 'entity', hitPoint };
    return hitTestDefPoints(entity, point, tolerance);
  }
  return hitTestLegacyDim(entity, point, tolerance);
}

/** defPoint proximity — last-resort hit on raw definition points (vertices,
 *  arrowhead origins). Shared by the per-variant path and the legacy fallback. */
function hitTestDefPoints(entity: DimensionEntity, point: Point2D, tolerance: number): Partial<HitTestResult> | null {
  for (const pt of entity.defPoints) {
    if (calculateDistance(point, pt) <= tolerance) {
      return { hitType: 'entity', hitPoint: pt };
    }
  }
  return null;
}

/** Linear/aligned — uses computed foot points for accurate dim line + text. */
function hitTestStraightDim(
  entity: DimensionEntity,
  point: Point2D,
  tolerance: number,
  hitGeom: { footStart: Point2D; footEnd: Point2D; textAnchor: Point2D },
): Partial<HitTestResult> | null {
  const { footStart, footEnd, textAnchor } = hitGeom;
  const pts = entity.defPoints;

  if (calculateDistance(point, textAnchor) <= tolerance * 1.5) {
    return { hitType: 'entity', hitPoint: textAnchor };
  }
  if (pointToLineDistance(point, footStart, footEnd) <= tolerance) {
    return { hitType: 'entity', hitPoint: closestPointOnLine(point, footStart, footEnd) };
  }
  if (pointToLineDistance(point, pts[0], footStart) <= tolerance) {
    return { hitType: 'entity', hitPoint: closestPointOnLine(point, pts[0], footStart) };
  }
  if (pointToLineDistance(point, pts[1], footEnd) <= tolerance) {
    return { hitType: 'entity', hitPoint: closestPointOnLine(point, pts[1], footEnd) };
  }
  for (const pt of pts) {
    if (calculateDistance(point, pt) <= tolerance) {
      return { hitType: 'entity', hitPoint: pt };
    }
  }
  return null;
}

/** baseline/continued fallback — legacy defPoints-based approximation (these
 *  need a parent lookup the hit path does not carry, so no rendered geometry). */
function hitTestLegacyDim(entity: DimensionEntity, point: Point2D, tolerance: number): Partial<HitTestResult> | null {
  const pts = entity.defPoints;
  const textPt = entity.textMidpoint ?? (pts.length >= 2 ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } : pts[0]);
  if (calculateDistance(point, textPt) <= tolerance * 1.5) {
    return { hitType: 'entity', hitPoint: textPt };
  }
  if (pts.length >= 3) {
    if (pointToLineDistance(point, pts[0], pts[2]) <= tolerance) {
      return { hitType: 'entity', hitPoint: closestPointOnLine(point, pts[0], pts[2]) };
    }
    if (pointToLineDistance(point, pts[1], pts[2]) <= tolerance) {
      return { hitType: 'entity', hitPoint: closestPointOnLine(point, pts[1], pts[2]) };
    }
  }
  if (pts.length >= 2 && pointToLineDistance(point, pts[0], pts[1]) <= tolerance) {
    return { hitType: 'entity', hitPoint: closestPointOnLine(point, pts[0], pts[1]) };
  }
  return hitTestDefPoints(entity, point, tolerance);
}
