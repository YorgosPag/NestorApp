/**
 * CONTROL POINT GEOMETRY HELPERS
 * Pure geometry + spatial-distribution analysis extracted from
 * ControlPointManager (SRP split, SSoT ratchet C.5.41).
 * Zero class state — stateless functions on GeoControlPoint/DxfCoordinate.
 */

import type { GeoControlPoint, DxfCoordinate } from '../../types';

// ============================================================================
// PURE GEOMETRY
// ============================================================================

export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function calculateDistance(p1: DxfCoordinate, p2: DxfCoordinate): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function calculateBoundingBox(points: DxfCoordinate[]): BoundingBox {
  if (points.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }

  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }

  return { minX, maxX, minY, maxY };
}

export function getCornerRegions(bbox: BoundingBox): BoundingBox[] {
  const width = bbox.maxX - bbox.minX;
  const height = bbox.maxY - bbox.minY;
  const margin = Math.min(width, height) * 0.2; // 20% margin

  return [
    // Top-left
    { minX: bbox.minX, maxX: bbox.minX + margin, minY: bbox.maxY - margin, maxY: bbox.maxY },
    // Top-right
    { minX: bbox.maxX - margin, maxX: bbox.maxX, minY: bbox.maxY - margin, maxY: bbox.maxY },
    // Bottom-right
    { minX: bbox.maxX - margin, maxX: bbox.maxX, minY: bbox.minY, maxY: bbox.minY + margin },
    // Bottom-left
    { minX: bbox.minX, maxX: bbox.minX + margin, minY: bbox.minY, maxY: bbox.minY + margin }
  ];
}

export function hasPointInRegion(points: DxfCoordinate[], region: BoundingBox): boolean {
  return points.some(p =>
    p.x >= region.minX && p.x <= region.maxX &&
    p.y >= region.minY && p.y <= region.maxY
  );
}

// ============================================================================
// SPATIAL-DISTRIBUTION ANALYSIS
// ============================================================================

export type SpatialDistribution = 'poor' | 'fair' | 'good' | 'excellent';

export function assessSpatialDistribution(points: GeoControlPoint[]): SpatialDistribution {
  if (points.length < 3) return 'poor';

  const dxfPoints = points.map(p => p.dxfPoint);
  const bbox = calculateBoundingBox(dxfPoints);

  const corners = getCornerRegions(bbox);
  const cornersWithPoints = corners.filter(corner =>
    hasPointInRegion(dxfPoints, corner)
  ).length;

  const hasCenterPoint = hasPointInRegion(dxfPoints, {
    minX: bbox.minX + (bbox.maxX - bbox.minX) * 0.25,
    maxX: bbox.minX + (bbox.maxX - bbox.minX) * 0.75,
    minY: bbox.minY + (bbox.maxY - bbox.minY) * 0.25,
    maxY: bbox.minY + (bbox.maxY - bbox.minY) * 0.75
  });

  if (cornersWithPoints >= 4 && hasCenterPoint) return 'excellent';
  if (cornersWithPoints >= 4) return 'good';
  if (cornersWithPoints >= 3) return 'fair';
  return 'poor';
}

/**
 * Geometric Dilution of Precision (GDOP). Lower is better.
 */
export function calculateGeometricDilution(points: GeoControlPoint[]): number {
  if (points.length < 3) return Infinity;

  const dxfPoints = points.map(p => p.dxfPoint);
  const bbox = calculateBoundingBox(dxfPoints);

  const area = (bbox.maxX - bbox.minX) * (bbox.maxY - bbox.minY);
  const perimeter = 2 * ((bbox.maxX - bbox.minX) + (bbox.maxY - bbox.minY));

  if (area === 0) return Infinity;

  return perimeter * perimeter / (4 * Math.PI * area);
}

export function detectClusters(
  points: GeoControlPoint[],
  threshold: number = 10
): GeoControlPoint[][] {
  const clusters: GeoControlPoint[][] = [];
  const processed = new Set<string>();

  for (const point of points) {
    if (processed.has(point.id)) continue;

    const cluster = [point];
    processed.add(point.id);

    for (const other of points) {
      if (processed.has(other.id)) continue;

      const distance = calculateDistance(point.dxfPoint, other.dxfPoint);
      if (distance <= threshold) {
        cluster.push(other);
        processed.add(other.id);
      }
    }

    if (cluster.length > 1) {
      clusters.push(cluster);
    }
  }

  return clusters;
}

export function assessCoverage(points: GeoControlPoint[]): number {
  if (points.length < 3) return 0;

  const dxfPoints = points.map(p => p.dxfPoint);
  const bbox = calculateBoundingBox(dxfPoints);

  const gridSize = 10;
  let coveredCells = 0;
  const totalCells = gridSize * gridSize;

  const cellWidth = (bbox.maxX - bbox.minX) / gridSize;
  const cellHeight = (bbox.maxY - bbox.minY) / gridSize;

  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const cellBounds = {
        minX: bbox.minX + i * cellWidth,
        maxX: bbox.minX + (i + 1) * cellWidth,
        minY: bbox.minY + j * cellHeight,
        maxY: bbox.minY + (j + 1) * cellHeight
      };

      if (hasPointInRegion(dxfPoints, cellBounds)) {
        coveredCells++;
      }
    }
  }

  return coveredCells / totalCells;
}
