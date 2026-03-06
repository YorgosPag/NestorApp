/**
 * @module systems/guides/guide-analysis
 * @description Anomaly detection + grid analytics (ADR-189 B58 + B89)
 *
 * B58: Scans guides for uneven spacing, clashes, orphans, inconsistencies.
 * B89: Computes grid statistics (density, coverage, complexity).
 *
 * Pure functions, zero side effects. Pattern: cost-engine.ts
 *
 * @see ADR-189 (Construction Grid & Guide System)
 * @since 2026-03-06
 */

import type { Guide, GridAxis } from './guide-types';
import { GUIDE_LIMITS } from './guide-types';

// ============================================================================
// TYPES
// ============================================================================

/** Classification of guide anomaly */
export type GuideAnomalyType = 'uneven-spacing' | 'too-close' | 'orphan' | 'clash';

/** A detected anomaly in the guide configuration */
export interface GuideAnomaly {
  /** Type of anomaly */
  readonly type: GuideAnomalyType;
  /** IDs of affected guides */
  readonly guideIds: readonly string[];
  /** Severity level */
  readonly severity: 'warning' | 'error';
  /** Human-readable description */
  readonly message: string;
  /** Suggested fix action */
  readonly suggestion: string;
}

/** Grid analytics — computed statistics about the current guide layout */
export interface GuideAnalytics {
  /** Total number of visible guides */
  readonly totalGuides: number;
  /** Count by axis type */
  readonly byAxis: { readonly X: number; readonly Y: number; readonly XZ: number };
  /** Count by group (groupId → count) */
  readonly byGroup: Readonly<Record<string, number>>;
  /** Average spacing between consecutive guides on each axis */
  readonly averageSpacing: { readonly X: number; readonly Y: number };
  /** Bounding box of all guide positions */
  readonly boundingBox: {
    readonly minX: number;
    readonly maxX: number;
    readonly minY: number;
    readonly maxY: number;
  };
  /** Density score: ratio of guides to bounding area (0 = sparse, 1 = dense) */
  readonly densityScore: number;
  /** Complexity score: based on axis variety + group count (0 = simple, 1 = complex) */
  readonly complexityScore: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Minimum spacing before guides are considered "too close" (world units / meters) */
const TOO_CLOSE_THRESHOLD = 0.5;

/** Maximum coefficient of variation before spacing is flagged as "uneven" */
const UNEVEN_CV_THRESHOLD = 0.15;

/** Reference density: guides per 100 sq meters (used for score normalization) */
const DENSITY_REFERENCE = 50;

// ============================================================================
// ANOMALY DETECTION (B58)
// ============================================================================

/**
 * Detect anomalies in the guide configuration.
 *
 * Checks:
 * 1. **Too close**: Two guides on the same axis within TOO_CLOSE_THRESHOLD
 * 2. **Uneven spacing**: Inconsistent spacing pattern on an axis (CV > 15%)
 * 3. **Orphan**: A guide on an axis with no peers (single X or single Y)
 * 4. **Clash**: Overlapping diagonal guides (XZ guides crossing within segment)
 */
export function detectAnomalies(guides: readonly Guide[]): readonly GuideAnomaly[] {
  const visible = guides.filter(g => g.visible);
  const anomalies: GuideAnomaly[] = [];

  // Group by axis
  const xGuides = visible.filter(g => g.axis === 'X').sort((a, b) => a.offset - b.offset);
  const yGuides = visible.filter(g => g.axis === 'Y').sort((a, b) => a.offset - b.offset);
  const xzGuides = visible.filter(g => g.axis === 'XZ');

  // Check too-close on each axis
  detectTooClose(xGuides, 'X', anomalies);
  detectTooClose(yGuides, 'Y', anomalies);

  // Check uneven spacing on each axis
  detectUnevenSpacing(xGuides, 'X', anomalies);
  detectUnevenSpacing(yGuides, 'Y', anomalies);

  // Check orphans (single guide on axis with no group)
  detectOrphans(xGuides, 'X', anomalies);
  detectOrphans(yGuides, 'Y', anomalies);

  // Check diagonal clashes
  detectDiagonalClashes(xzGuides, anomalies);

  return anomalies;
}

function detectTooClose(
  sortedGuides: readonly Guide[],
  axis: GridAxis,
  anomalies: GuideAnomaly[],
): void {
  for (let i = 0; i < sortedGuides.length - 1; i++) {
    const gap = sortedGuides[i + 1].offset - sortedGuides[i].offset;
    if (gap < TOO_CLOSE_THRESHOLD && gap > GUIDE_LIMITS.MIN_OFFSET_DELTA) {
      anomalies.push({
        type: 'too-close',
        guideIds: [sortedGuides[i].id, sortedGuides[i + 1].id],
        severity: 'warning',
        message: `${axis} guides "${sortedGuides[i].label ?? sortedGuides[i].id}" and "${sortedGuides[i + 1].label ?? sortedGuides[i + 1].id}" are only ${gap.toFixed(3)}m apart`,
        suggestion: `Merge or increase spacing to ≥ ${TOO_CLOSE_THRESHOLD}m`,
      });
    }
  }
}

function detectUnevenSpacing(
  sortedGuides: readonly Guide[],
  axis: GridAxis,
  anomalies: GuideAnomaly[],
): void {
  if (sortedGuides.length < 3) return;

  const spacings: number[] = [];
  for (let i = 0; i < sortedGuides.length - 1; i++) {
    spacings.push(sortedGuides[i + 1].offset - sortedGuides[i].offset);
  }

  const mean = spacings.reduce((s, v) => s + v, 0) / spacings.length;
  if (mean === 0) return;

  const variance = spacings.reduce((s, v) => s + (v - mean) ** 2, 0) / spacings.length;
  const stddev = Math.sqrt(variance);
  const cv = stddev / mean; // Coefficient of variation

  if (cv > UNEVEN_CV_THRESHOLD) {
    anomalies.push({
      type: 'uneven-spacing',
      guideIds: sortedGuides.map(g => g.id),
      severity: 'warning',
      message: `${axis} guides have inconsistent spacing (CV=${(cv * 100).toFixed(1)}%, mean=${mean.toFixed(2)}m)`,
      suggestion: `Equalize spacing to ${mean.toFixed(2)}m using the Equalize tool`,
    });
  }
}

function detectOrphans(
  axisGuides: readonly Guide[],
  axis: GridAxis,
  anomalies: GuideAnomaly[],
): void {
  if (axisGuides.length === 1 && axisGuides[0].groupId === null) {
    anomalies.push({
      type: 'orphan',
      guideIds: [axisGuides[0].id],
      severity: 'warning',
      message: `Single ${axis} guide "${axisGuides[0].label ?? axisGuides[0].id}" has no peers — grid requires ≥ 2`,
      suggestion: `Add more ${axis} guides or delete this orphan`,
    });
  }
}

function detectDiagonalClashes(
  xzGuides: readonly Guide[],
  anomalies: GuideAnomaly[],
): void {
  for (let i = 0; i < xzGuides.length; i++) {
    for (let j = i + 1; j < xzGuides.length; j++) {
      const a = xzGuides[i];
      const b = xzGuides[j];

      if (!a.startPoint || !a.endPoint || !b.startPoint || !b.endPoint) continue;

      // Check if segments intersect (within their bounds)
      if (segmentsIntersect(a.startPoint, a.endPoint, b.startPoint, b.endPoint)) {
        anomalies.push({
          type: 'clash',
          guideIds: [a.id, b.id],
          severity: 'error',
          message: `Diagonal guides "${a.label ?? a.id}" and "${b.label ?? b.id}" intersect`,
          suggestion: 'Adjust endpoints or remove one of the clashing diagonals',
        });
      }
    }
  }
}

/**
 * Check if two line segments intersect (2D cross-product method).
 */
function segmentsIntersect(
  p1: { readonly x: number; readonly y: number },
  p2: { readonly x: number; readonly y: number },
  p3: { readonly x: number; readonly y: number },
  p4: { readonly x: number; readonly y: number },
): boolean {
  const d1 = direction(p3, p4, p1);
  const d2 = direction(p3, p4, p2);
  const d3 = direction(p1, p2, p3);
  const d4 = direction(p1, p2, p4);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }

  return false;
}

function direction(
  pi: { readonly x: number; readonly y: number },
  pj: { readonly x: number; readonly y: number },
  pk: { readonly x: number; readonly y: number },
): number {
  return (pk.x - pi.x) * (pj.y - pi.y) - (pj.x - pi.x) * (pk.y - pi.y);
}

// ============================================================================
// ANALYTICS (B89)
// ============================================================================

/**
 * Compute analytics for the current guide layout.
 * Returns density score, complexity score, bounding box, and per-axis statistics.
 */
export function computeAnalytics(guides: readonly Guide[]): GuideAnalytics {
  const visible = guides.filter(g => g.visible);

  const xGuides = visible.filter(g => g.axis === 'X').sort((a, b) => a.offset - b.offset);
  const yGuides = visible.filter(g => g.axis === 'Y').sort((a, b) => a.offset - b.offset);
  const xzGuides = visible.filter(g => g.axis === 'XZ');

  // By group
  const byGroup: Record<string, number> = {};
  for (const g of visible) {
    const key = g.groupId ?? '__ungrouped__';
    byGroup[key] = (byGroup[key] ?? 0) + 1;
  }

  // Average spacing
  const avgX = computeAverageSpacing(xGuides);
  const avgY = computeAverageSpacing(yGuides);

  // Bounding box
  const allXOffsets = xGuides.map(g => g.offset);
  const allYOffsets = yGuides.map(g => g.offset);
  // Include XZ endpoints
  for (const g of xzGuides) {
    if (g.startPoint && g.endPoint) {
      allXOffsets.push(g.startPoint.x, g.endPoint.x);
      allYOffsets.push(g.startPoint.y, g.endPoint.y);
    }
  }

  const minX = allXOffsets.length > 0 ? Math.min(...allXOffsets) : 0;
  const maxX = allXOffsets.length > 0 ? Math.max(...allXOffsets) : 0;
  const minY = allYOffsets.length > 0 ? Math.min(...allYOffsets) : 0;
  const maxY = allYOffsets.length > 0 ? Math.max(...allYOffsets) : 0;

  // Density score
  const area = Math.max((maxX - minX) * (maxY - minY), 1);
  const rawDensity = visible.length / area * 100; // per 100 sq units
  const densityScore = Math.min(rawDensity / DENSITY_REFERENCE, 1);

  // Complexity score (based on: axis diversity, group count, diagonal presence)
  const axisTypes = new Set(visible.map(g => g.axis)).size;
  const groupCount = Object.keys(byGroup).length;
  const hasDiagonals = xzGuides.length > 0 ? 0.2 : 0;
  const complexityScore = Math.min(
    (axisTypes / 3) * 0.3 + (Math.min(groupCount, 5) / 5) * 0.3 + (Math.min(visible.length, 50) / 50) * 0.2 + hasDiagonals,
    1,
  );

  return {
    totalGuides: visible.length,
    byAxis: { X: xGuides.length, Y: yGuides.length, XZ: xzGuides.length },
    byGroup,
    averageSpacing: { X: avgX, Y: avgY },
    boundingBox: { minX, maxX, minY, maxY },
    densityScore,
    complexityScore,
  };
}

function computeAverageSpacing(sortedGuides: readonly Guide[]): number {
  if (sortedGuides.length < 2) return 0;

  let total = 0;
  for (let i = 0; i < sortedGuides.length - 1; i++) {
    total += sortedGuides[i + 1].offset - sortedGuides[i].offset;
  }
  return total / (sortedGuides.length - 1);
}

// ============================================================================
// SUGGESTIONS (B58)
// ============================================================================

/**
 * Generate human-readable fix suggestions for a list of anomalies.
 */
export function suggestFixes(anomalies: readonly GuideAnomaly[]): readonly string[] {
  const suggestions: string[] = [];
  const seen = new Set<string>();

  for (const anomaly of anomalies) {
    if (!seen.has(anomaly.suggestion)) {
      seen.add(anomaly.suggestion);
      suggestions.push(anomaly.suggestion);
    }
  }

  return suggestions;
}
