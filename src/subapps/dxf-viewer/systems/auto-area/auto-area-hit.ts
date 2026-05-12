/**
 * Auto-area hit-test: finds the innermost closed polygon at a world point.
 * Shared by the click handler (result panel) and the hover preview.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity, RectangleEntity, RectEntity } from '../../types/entities';
import type { Overlay } from '../../overlays/types';
import {
  isLineEntity, isPolylineEntity, isLWPolylineEntity,
  isRectangleEntity, isRectEntity, isCircleEntity,
  isArcEntity, isEllipseEntity,
} from '../../types/entities';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
import {
  calculatePolygonArea,
  calculatePolygonPerimeter,
} from '../../rendering/entities/shared/geometry-polyline-utils';
import { findClosedPolygonsFromLines } from './auto-area-geometry';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';

// ============================================================================
// TYPES
// ============================================================================

export interface AreaCandidate {
  area: number;
  perimeter: number;
  source: 'dxf-polyline' | 'overlay';
  layerName?: string;
  polygon: Point2D[];
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Returns polygon vertices of the smallest closed region containing worldPoint,
 * or null if no polygon contains the point.
 */
export function getAutoAreaHitPolygon(
  worldPoint: Point2D,
  entities: ReadonlyArray<Entity>,
  overlays: ReadonlyArray<Overlay>,
  scale: number,
): Point2D[] | null {
  const result = getAutoAreaHitResult(worldPoint, entities, overlays, scale);
  return result?.polygon ?? null;
}

/**
 * Returns the hit polygon AND its direct holes (for preview rendering).
 * Holes are closed polygons entirely inside the hit polygon — same logic as click.
 */
export function getAutoAreaHitResult(
  worldPoint: Point2D,
  entities: ReadonlyArray<Entity>,
  overlays: ReadonlyArray<Overlay>,
  scale: number,
): { polygon: Point2D[]; holes: Point2D[][] } | null {
  const candidates = collectAreaCandidates(worldPoint, entities, overlays, scale);
  if (candidates.length === 0) return null;
  const best = candidates.reduce((a, b) => a.area < b.area ? a : b);
  const holes = collectHoleAreas(best.polygon, best.area, entities, overlays, scale);
  return { polygon: best.polygon, holes: holes.map(h => h.polygon) };
}

/**
 * Collects all closed regions containing worldPoint from entities + overlays.
 */
export function collectAreaCandidates(
  worldPoint: Point2D,
  entities: ReadonlyArray<Entity>,
  overlays: ReadonlyArray<Overlay>,
  scale: number,
): AreaCandidate[] {
  const out: AreaCandidate[] = [];
  collectEntityCandidates(worldPoint, entities, scale, out);

  for (const overlay of overlays) {
    if (!overlay.polygon || overlay.polygon.length < 3) continue;
    const verts = overlay.polygon.map(([x, y]) => ({ x, y }));
    if (isPointInPolygon(worldPoint, verts)) {
      out.push({
        area: calculatePolygonArea(verts),
        perimeter: calculatePolygonPerimeter(verts),
        source: 'overlay',
        layerName: overlay.label ?? undefined,
        polygon: verts,
      });
    }
  }

  return out;
}

// ============================================================================
// CACHE — closed faces depend only on entities ref + scale, not mouse position
// ============================================================================

// WeakMap: entities array ref → (rounded scale → faces)
// WeakMap ensures GC collects entries when the entities array is replaced.
const _closedFacesCache = new WeakMap<ReadonlyArray<Entity>, Map<number, Point2D[][]>>();

function getCachedClosedFaces(entities: ReadonlyArray<Entity>, scale: number): Point2D[][] {
  // Round to 3 decimal places — avoids cache misses on sub-pixel float drift
  const roundedScale = Math.round(scale * 1000) / 1000;

  let scaleMap = _closedFacesCache.get(entities);
  if (!scaleMap) {
    scaleMap = new Map();
    _closedFacesCache.set(entities, scaleMap);
  }

  const cached = scaleMap.get(roundedScale);
  if (cached) return cached;

  const linePairs: [Point2D, Point2D][] = [];
  for (const entity of entities) {
    if (isLineEntity(entity)) linePairs.push([entity.start, entity.end]);
  }

  const snapTol = TOLERANCE_CONFIG.SNAP_DEFAULT / scale;
  const faces = findClosedPolygonsFromLines(linePairs, snapTol);
  scaleMap.set(roundedScale, faces);
  return faces;
}

// ============================================================================
// INTERNAL — ENTITY ITERATION
// ============================================================================

function collectEntityCandidates(
  worldPoint: Point2D,
  entities: ReadonlyArray<Entity>,
  scale: number,
  out: AreaCandidate[],
): void {
  for (const entity of entities) {
    if ((isPolylineEntity(entity) || isLWPolylineEntity(entity)) && entity.closed && entity.vertices.length >= 3) {
      const verts = entity.vertices.map(v => ({ x: v.x, y: v.y }));
      if (isPointInPolygon(worldPoint, verts)) {
        out.push({ area: calculatePolygonArea(verts), perimeter: calculatePolygonPerimeter(verts), source: 'dxf-polyline', layerName: entity.layer, polygon: verts });
      }
    } else if (isRectangleEntity(entity) || isRectEntity(entity)) {
      const verts = getRectVertices(entity);
      if (verts && isPointInPolygon(worldPoint, verts)) {
        const w = Math.abs(verts[1].x - verts[0].x);
        const h = Math.abs(verts[2].y - verts[0].y);
        out.push({ area: w * h, perimeter: 2 * (w + h), source: 'dxf-polyline', layerName: entity.layer, polygon: verts });
      }
    } else if (isCircleEntity(entity)) {
      const dx = worldPoint.x - entity.center.x;
      const dy = worldPoint.y - entity.center.y;
      if (Math.sqrt(dx * dx + dy * dy) < entity.radius) {
        const r = entity.radius;
        const verts = buildCirclePolygon(entity.center, r, 64);
        out.push({ area: Math.PI * r * r, perimeter: 2 * Math.PI * r, source: 'dxf-polyline', layerName: entity.layer, polygon: verts });
      }
    } else if (isArcEntity(entity) && isFullCircleArc(entity.startAngle, entity.endAngle)) {
      const dx = worldPoint.x - entity.center.x;
      const dy = worldPoint.y - entity.center.y;
      if (Math.sqrt(dx * dx + dy * dy) < entity.radius) {
        const r = entity.radius;
        const verts = buildCirclePolygon(entity.center, r, 64);
        out.push({ area: Math.PI * r * r, perimeter: 2 * Math.PI * r, source: 'dxf-polyline', layerName: entity.layer, polygon: verts });
      }
    } else if (isEllipseEntity(entity) && isFullEllipse(entity.startParam, entity.endParam)) {
      const verts = buildEllipsePolygon(entity.center, entity.majorAxis, entity.minorAxis, entity.rotation ?? 0, 64);
      if (isPointInPolygon(worldPoint, verts)) {
        const area = Math.PI * entity.majorAxis * entity.minorAxis;
        const perim = ellipsePerimeter(entity.majorAxis, entity.minorAxis);
        out.push({ area, perimeter: perim, source: 'dxf-polyline', layerName: entity.layer, polygon: verts });
      }
    }
  }

  for (const face of getCachedClosedFaces(entities, scale)) {
    if (isPointInPolygon(worldPoint, face)) {
      out.push({ area: calculatePolygonArea(face), perimeter: calculatePolygonPerimeter(face), source: 'dxf-polyline', polygon: face });
    }
  }
}

// ============================================================================
// INTERNAL — POLYGON BUILDERS
// ============================================================================

function buildCirclePolygon(center: Point2D, radius: number, segments: number): Point2D[] {
  const pts: Point2D[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * 2 * Math.PI;
    pts.push({ x: center.x + radius * Math.cos(a), y: center.y + radius * Math.sin(a) });
  }
  return pts;
}

function buildEllipsePolygon(
  center: Point2D, a: number, b: number, rotationDeg: number, segments: number,
): Point2D[] {
  const rot = (rotationDeg * Math.PI) / 180;
  const cosR = Math.cos(rot);
  const sinR = Math.sin(rot);
  const pts: Point2D[] = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * 2 * Math.PI;
    const lx = a * Math.cos(t);
    const ly = b * Math.sin(t);
    pts.push({ x: center.x + lx * cosR - ly * sinR, y: center.y + lx * sinR + ly * cosR });
  }
  return pts;
}

/** Ramanujan first approximation for ellipse perimeter. */
function ellipsePerimeter(a: number, b: number): number {
  const h = ((a - b) / (a + b)) ** 2;
  return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
}

/**
 * Extracts rectangle vertices from corner1/corner2 (drawn) or x/y/width/height (imported).
 * Returns null if the entity has neither valid format.
 */
function getRectVertices(entity: RectangleEntity | RectEntity): Point2D[] | null {
  let x1: number, y1: number, x2: number, y2: number;

  if (entity.corner1 && entity.corner2) {
    x1 = Math.min(entity.corner1.x, entity.corner2.x);
    y1 = Math.min(entity.corner1.y, entity.corner2.y);
    x2 = Math.max(entity.corner1.x, entity.corner2.x);
    y2 = Math.max(entity.corner1.y, entity.corner2.y);
  } else if (entity.x !== undefined && entity.width !== undefined) {
    x1 = entity.x; y1 = entity.y;
    x2 = entity.x + entity.width; y2 = entity.y + entity.height;
  } else {
    return null;
  }

  if (Math.abs(x2 - x1) < 1e-9 || Math.abs(y2 - y1) < 1e-9) return null;
  return [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }];
}

/** Arc is a full circle when its angular span is ≥ 359.9 degrees. */
function isFullCircleArc(startAngle: number, endAngle: number): boolean {
  return Math.abs(endAngle - startAngle) >= 359.9;
}

/** Ellipse is closed when startParam/endParam are absent or span the full parametric range. */
function isFullEllipse(startParam?: number, endParam?: number): boolean {
  if (startParam === undefined || endParam === undefined) return true;
  return Math.abs(endParam - startParam) >= Math.PI * 2 - 0.01;
}

// ============================================================================
// HOLE DETECTION
// ============================================================================

function computeCentroid(polygon: Point2D[]): Point2D {
  const n = polygon.length;
  return {
    x: polygon.reduce((s, v) => s + v.x, 0) / n,
    y: polygon.reduce((s, v) => s + v.y, 0) / n,
  };
}

/**
 * True if the inner polygon is entirely inside the outer polygon.
 * Uses centroid check (robust for concave/precision issues) + sampled vertices.
 */
function isPolygonInsideOuter(inner: Point2D[], outer: Point2D[]): boolean {
  if (inner.length === 0) return false;
  if (!isPointInPolygon(computeCentroid(inner), outer)) return false;
  const step = Math.max(1, Math.floor(inner.length / 8));
  for (let i = 0; i < inner.length; i += step) {
    if (!isPointInPolygon(inner[i], outer)) return false;
  }
  return true;
}

/**
 * Collects every closed polygon from entities + overlays without any
 * worldPoint containment filter. Used as input for hole detection.
 */
function collectAllClosedPolygons(
  entities: ReadonlyArray<Entity>,
  overlays: ReadonlyArray<Overlay>,
  scale: number,
  out: AreaCandidate[],
): void {
  for (const entity of entities) {
    if ((isPolylineEntity(entity) || isLWPolylineEntity(entity)) && entity.closed && entity.vertices.length >= 3) {
      const verts = entity.vertices.map(v => ({ x: v.x, y: v.y }));
      out.push({ area: calculatePolygonArea(verts), perimeter: calculatePolygonPerimeter(verts), source: 'dxf-polyline', layerName: entity.layer, polygon: verts });
    } else if (isRectangleEntity(entity) || isRectEntity(entity)) {
      const verts = getRectVertices(entity);
      if (verts) {
        const w = Math.abs(verts[1].x - verts[0].x);
        const h = Math.abs(verts[2].y - verts[0].y);
        out.push({ area: w * h, perimeter: 2 * (w + h), source: 'dxf-polyline', layerName: entity.layer, polygon: verts });
      }
    } else if (isCircleEntity(entity)) {
      const r = entity.radius;
      const verts = buildCirclePolygon(entity.center, r, 64);
      out.push({ area: Math.PI * r * r, perimeter: 2 * Math.PI * r, source: 'dxf-polyline', layerName: entity.layer, polygon: verts });
    } else if (isArcEntity(entity) && isFullCircleArc(entity.startAngle, entity.endAngle)) {
      const r = entity.radius;
      const verts = buildCirclePolygon(entity.center, r, 64);
      out.push({ area: Math.PI * r * r, perimeter: 2 * Math.PI * r, source: 'dxf-polyline', layerName: entity.layer, polygon: verts });
    } else if (isEllipseEntity(entity) && isFullEllipse(entity.startParam, entity.endParam)) {
      const verts = buildEllipsePolygon(entity.center, entity.majorAxis, entity.minorAxis, entity.rotation ?? 0, 64);
      out.push({ area: Math.PI * entity.majorAxis * entity.minorAxis, perimeter: ellipsePerimeter(entity.majorAxis, entity.minorAxis), source: 'dxf-polyline', layerName: entity.layer, polygon: verts });
    }
  }

  for (const overlay of overlays) {
    if (!overlay.polygon || overlay.polygon.length < 3) continue;
    const verts = overlay.polygon.map(([x, y]) => ({ x, y }));
    out.push({ area: calculatePolygonArea(verts), perimeter: calculatePolygonPerimeter(verts), source: 'overlay', layerName: overlay.label ?? undefined, polygon: verts });
  }

  for (const face of getCachedClosedFaces(entities, scale)) {
    out.push({ area: calculatePolygonArea(face), perimeter: calculatePolygonPerimeter(face), source: 'dxf-polyline', polygon: face });
  }
}

/**
 * Returns the DIRECT holes inside `outerPolygon` — closed polygons entirely
 * contained in the outer shape but not nested inside another hole.
 * Subtract their total area to get the net (usable) area.
 */
export function collectHoleAreas(
  outerPolygon: Point2D[],
  outerArea: number,
  entities: ReadonlyArray<Entity>,
  overlays: ReadonlyArray<Overlay>,
  scale: number,
): AreaCandidate[] {
  const all: AreaCandidate[] = [];
  collectAllClosedPolygons(entities, overlays, scale, all);

  // Relative threshold: excludes the outer polygon itself (same area → same float)
  // and avoids the absolute-0.001 bug for small-scale drawings
  const maxHoleArea = outerArea * (1 - 1e-9);
  const inside = all.filter(c => c.area < maxHoleArea && isPolygonInsideOuter(c.polygon, outerPolygon));

  // Exclude polygons nested inside another hole (direct children only)
  return inside.filter(
    candidate => !inside.some(
      other => other !== candidate && other.area > candidate.area && isPolygonInsideOuter(candidate.polygon, other.polygon),
    ),
  );
}
