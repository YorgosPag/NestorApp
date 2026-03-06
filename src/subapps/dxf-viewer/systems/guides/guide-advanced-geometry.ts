/**
 * @module systems/guides/guide-advanced-geometry
 * @description Advanced geometry utilities for guide placement (ADR-189 B77 + B78 + B80)
 *
 * B77: Adaptive spacing — denser near supports, wider in span center.
 * B78: Constraint solver — total span + count → auto-spacing.
 * B80: Fractal subdivision — recursive midpoint generation.
 *
 * Pure functions, zero side effects. Pattern: cost-engine.ts
 *
 * @see ADR-189 (Construction Grid & Guide System)
 * @since 2026-03-06
 */

// ============================================================================
// TYPES
// ============================================================================

/** Density profile for adaptive spacing generation */
export type DensityProfile = 'uniform' | 'denser-edges' | 'denser-center';

/** Constraints for the grid constraint solver */
export interface GridConstraints {
  /** Total span to cover (meters) */
  readonly totalSpan: number;
  /** Desired number of divisions (optional) */
  readonly count?: number;
  /** Desired spacing between guides (optional — overridden by count) */
  readonly spacing?: number;
  /** Minimum allowed spacing (meters) */
  readonly minSpacing?: number;
  /** Maximum allowed spacing (meters) */
  readonly maxSpacing?: number;
}

// ============================================================================
// B77: ADAPTIVE SPACING
// ============================================================================

/**
 * Generate non-uniform spacing distribution across a total span.
 *
 * Profiles:
 * - `uniform`: Equal spacing (standard)
 * - `denser-edges`: Closer spacing near supports (start/end), wider in center
 *   Structural logic: columns near supports carry more load → need closer bays
 * - `denser-center`: Closer spacing in center, wider at edges
 *   Use case: Exhibition halls, open-plan offices with central loading
 *
 * @param totalSpan - Total distance to span (meters)
 * @param count - Number of divisions (≥ 1)
 * @param densityProfile - Distribution profile
 * @returns Array of absolute positions (always starts at 0, ends at totalSpan)
 */
export function generateAdaptiveSpacing(
  totalSpan: number,
  count: number,
  densityProfile: DensityProfile,
): readonly number[] {
  if (count < 1 || totalSpan <= 0) return [0];

  const positions: number[] = [0];

  if (densityProfile === 'uniform') {
    const step = totalSpan / count;
    for (let i = 1; i <= count; i++) {
      positions.push(roundTo4(step * i));
    }
    return positions;
  }

  // Generate weights using a cosine distribution
  const weights: number[] = [];
  for (let i = 0; i < count; i++) {
    // Normalized position of division center (0 to 1)
    const t = (i + 0.5) / count;

    if (densityProfile === 'denser-edges') {
      // Cosine: higher weight near edges (t=0, t=1), lower in center (t=0.5)
      // w(t) = 1 + A * cos(2πt) where A controls density contrast
      weights.push(1 + 0.6 * Math.cos(2 * Math.PI * t));
    } else {
      // denser-center: inverse — higher weight in center
      weights.push(1 - 0.5 * Math.cos(2 * Math.PI * t));
    }
  }

  // Normalize weights to sum = totalSpan
  const weightSum = weights.reduce((s, w) => s + w, 0);
  const scale = totalSpan / weightSum;

  let cumulative = 0;
  for (let i = 0; i < count; i++) {
    cumulative += weights[i] * scale;
    positions.push(roundTo4(cumulative));
  }

  // Ensure last position is exactly totalSpan (avoid floating-point drift)
  positions[positions.length - 1] = totalSpan;

  return positions;
}

// ============================================================================
// B78: CONSTRAINT SOLVER
// ============================================================================

/**
 * Solve for guide positions given constraints.
 *
 * Priority:
 * 1. If `count` is given → compute spacing = totalSpan / count
 * 2. If `spacing` is given → compute count = floor(totalSpan / spacing)
 * 3. Apply minSpacing / maxSpacing bounds
 *
 * @returns Array of absolute positions, or null if constraints are unsatisfiable
 */
export function solveGridConstraints(constraints: GridConstraints): readonly number[] | null {
  const { totalSpan, minSpacing, maxSpacing } = constraints;

  if (totalSpan <= 0) return null;

  let effectiveSpacing: number;

  if (constraints.count !== undefined && constraints.count >= 1) {
    effectiveSpacing = totalSpan / constraints.count;
  } else if (constraints.spacing !== undefined && constraints.spacing > 0) {
    effectiveSpacing = constraints.spacing;
  } else {
    return null; // Must specify count or spacing
  }

  // Apply bounds
  if (minSpacing !== undefined && effectiveSpacing < minSpacing) {
    effectiveSpacing = minSpacing;
  }
  if (maxSpacing !== undefined && effectiveSpacing > maxSpacing) {
    effectiveSpacing = maxSpacing;
  }

  // Validate: at least one division must fit
  if (effectiveSpacing > totalSpan) {
    return [0, totalSpan]; // Degenerate case: single bay
  }

  const count = Math.floor(totalSpan / effectiveSpacing);
  if (count < 1) return null;

  // Recalculate spacing to fit exactly
  const finalSpacing = totalSpan / count;
  const positions: number[] = [];
  for (let i = 0; i <= count; i++) {
    positions.push(roundTo4(finalSpacing * i));
  }

  // Fix last position
  positions[positions.length - 1] = totalSpan;

  return positions;
}

// ============================================================================
// B80: FRACTAL SUBDIVISION
// ============================================================================

/**
 * Generate fractal subdivision positions between two bounds.
 *
 * At depth 1: midpoint only → [mid]
 * At depth 2: midpoints of halves → [1/4, 1/2, 3/4]
 * At depth 3: → [1/8, 1/4, 3/8, 1/2, 5/8, 3/4, 7/8]
 *
 * Useful for progressive refinement of grids and for snap candidates.
 *
 * @param start - Start position (meters)
 * @param end - End position (meters)
 * @param depth - Recursion depth (1-6, clamped to prevent explosion)
 * @returns Sorted array of subdivision positions (excludes start/end themselves)
 */
export function generateFractalSubdivisions(
  start: number,
  end: number,
  depth: number,
): readonly number[] {
  const clampedDepth = Math.max(1, Math.min(depth, 6)); // Max 63 points at depth 6
  const positions = new Set<number>();

  fractalRecurse(start, end, clampedDepth, positions);

  return Array.from(positions).sort((a, b) => a - b);
}

function fractalRecurse(start: number, end: number, depth: number, positions: Set<number>): void {
  if (depth <= 0) return;

  const mid = roundTo4((start + end) / 2);
  positions.add(mid);

  fractalRecurse(start, mid, depth - 1, positions);
  fractalRecurse(mid, end, depth - 1, positions);
}

// ============================================================================
// UTILITIES
// ============================================================================

/** Round to 4 decimal places — sufficient for structural precision (0.1mm) */
function roundTo4(value: number): number {
  return Math.round(value * 10000) / 10000;
}
