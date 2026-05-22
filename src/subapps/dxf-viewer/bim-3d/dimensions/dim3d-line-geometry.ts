/**
 * ADR-366 Phase 9 / C.3 — Dim3D Line Geometry builder.
 *
 * Pure: anchor pair + placement → dim line vertices + leader lines + text anchor
 * + arrow transforms. No Three.js render state, no allocation outside returned
 * shape, no side effects. Renderer (Dimension3DRenderer) consumes the layout
 * spec to build Line2 segments and Sprite transforms.
 *
 * Visual model (mirror ADR-362):
 *  - Aligned/Linear: dim line parallel to measured vector at offset distance.
 *  - Radial: leader from center → arc tangent point + radius callout.
 *  - Angular: arc segment between two rays from vertex.
 *  - Leader: L-shape default (single dogleg) OR straight (per leaderStyle.shape).
 */

import type {
  Dim3DAnchor,
  Dim3DLeaderShape,
  Dim3DMode,
  Dim3DPlacement,
  Vec3,
} from './dim3d-types';

export interface ArrowTransform {
  /** World position of arrow tip. */
  readonly tip: Vec3;
  /** Direction the arrow points (unit vector). */
  readonly direction: Vec3;
}

export interface Dim3DLineLayout {
  /** Main dim line segment(s) (pairs of endpoints). */
  readonly dimLine: readonly Vec3[];
  /** Leader segments connecting dim line to text anchor (0-2 segments for L-shape). */
  readonly leaderLines: readonly Vec3[];
  /** World-space anchor for text sprite. */
  readonly textAnchor: Vec3;
  /** Arrow head transforms (0 for radial center, 2 for aligned/linear endpoints). */
  readonly arrows: readonly ArrowTransform[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Vector helpers (inlined — same SSoT as value-computer for testability)
// ──────────────────────────────────────────────────────────────────────────────

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function scale(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

function len(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function normalize(v: Vec3): Vec3 {
  const l = len(v);
  if (l === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

function midpoint(a: Vec3, b: Vec3): Vec3 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

function perpendicularInPlane(direction: Vec3, planeNormal: Vec3): Vec3 {
  // Cross product direction × planeNormal → perpendicular in plane.
  return normalize({
    x: direction.y * planeNormal.z - direction.z * planeNormal.y,
    y: direction.z * planeNormal.x - direction.x * planeNormal.z,
    z: direction.x * planeNormal.y - direction.y * planeNormal.x,
  });
}

// Default plane normal: world up (Y axis). Used when caller doesn't pass one.
const WORLD_UP: Vec3 = { x: 0, y: 1, z: 0 };

// ──────────────────────────────────────────────────────────────────────────────
// Per-mode layout builders
// ──────────────────────────────────────────────────────────────────────────────

interface LayoutOptions {
  /** Distance from measured segment to dim line (m world). */
  readonly dimLineOffset: number;
  /** Distance from dim line to text anchor (m world). */
  readonly textOffset: number;
  /** L-shape leader vs straight (default L). */
  readonly leaderShape: Dim3DLeaderShape;
  /** Plane normal — controls which side the dim line is offset toward. */
  readonly planeNormal?: Vec3;
}

function buildAlignedLayout(anchor: Dim3DAnchor, opts: LayoutOptions): Dim3DLineLayout {
  const a = anchor.endpointA;
  const b = anchor.endpointB;
  const normal = opts.planeNormal ?? WORLD_UP;

  const direction = normalize(sub(b, a));
  const perp = perpendicularInPlane(direction, normal);

  const offsetVec = scale(perp, opts.dimLineOffset);
  const dimA = add(a, offsetVec);
  const dimB = add(b, offsetVec);
  const dimMid = midpoint(dimA, dimB);
  const textAnchor = add(dimMid, scale(perp, opts.textOffset));

  const leaderLines: Vec3[] = [];
  if (opts.leaderShape === 'L') {
    // Dogleg: dim line midpoint → text-aligned vertical → text anchor.
    const dogleg = add(dimMid, scale(perp, opts.textOffset * 0.6));
    leaderLines.push(dimMid, dogleg, dogleg, textAnchor);
  } else {
    leaderLines.push(dimMid, textAnchor);
  }

  return {
    dimLine: [dimA, dimB],
    leaderLines,
    textAnchor,
    arrows: [
      { tip: dimA, direction: scale(direction, -1) },
      { tip: dimB, direction },
    ],
  };
}

function buildRadialLayout(
  anchor: Dim3DAnchor,
  center: Vec3,
  opts: LayoutOptions,
): Dim3DLineLayout {
  const direction = normalize(sub(anchor.endpointA, center));
  const textAnchor = add(anchor.endpointA, scale(direction, opts.textOffset));
  return {
    dimLine: [center, anchor.endpointA],
    leaderLines: [anchor.endpointA, textAnchor],
    textAnchor,
    arrows: [{ tip: anchor.endpointA, direction }],
  };
}

function buildAngularLayout(
  vertex: Vec3,
  rayA: Vec3,
  rayB: Vec3,
  opts: LayoutOptions,
): Dim3DLineLayout {
  const dirA = normalize(sub(rayA, vertex));
  const dirB = normalize(sub(rayB, vertex));
  const radius = opts.dimLineOffset;
  const arcStart = add(vertex, scale(dirA, radius));
  const arcEnd = add(vertex, scale(dirB, radius));
  const bisector = normalize(add(dirA, dirB));
  const textAnchor = add(vertex, scale(bisector, radius + opts.textOffset));

  return {
    dimLine: [arcStart, arcEnd],
    leaderLines: [vertex, textAnchor],
    textAnchor,
    arrows: [
      { tip: arcStart, direction: dirA },
      { tip: arcEnd, direction: dirB },
    ],
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Public dispatcher
// ──────────────────────────────────────────────────────────────────────────────

export function buildDim3DLineLayout(
  mode: Dim3DMode,
  placement: Dim3DPlacement,
  anchor: Dim3DAnchor,
  opts: LayoutOptions,
): Dim3DLineLayout {
  switch (mode) {
    case 'aligned':
    case 'linear':
      return buildAlignedLayout(anchor, opts);
    case 'radial': {
      const center = placement.radial?.center ?? anchor.endpointA;
      return buildRadialLayout(anchor, center, opts);
    }
    case 'angular': {
      const ang = placement.angular;
      if (!ang) {
        throw new Error('buildDim3DLineLayout: angular requires placement.angular');
      }
      return buildAngularLayout(ang.vertex, ang.rayA, ang.rayB, opts);
    }
  }
}

export const DIM3D_DEFAULT_LAYOUT_OPTIONS: LayoutOptions = {
  dimLineOffset: 0.3,
  textOffset: 0.15,
  leaderShape: 'L',
};
