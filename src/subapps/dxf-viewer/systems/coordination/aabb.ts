/**
 * ADR-435 — 3D axis-aligned bounding-box helpers (Slice 0).
 *
 * The codebase only had a 2D `bboxIntersects` (dxf-viewport-culling.ts) — clash
 * detection needs the Z axis too. Pure, allocation-light, deterministic.
 */

import type { Aabb3, Vec3 } from './clash-types';

/**
 * Separating-axis test on all 3 axes, optionally inflated by `marginM` on every
 * side (used to widen one box by the clearance distance so soft-clash candidates
 * survive broad-phase). Touching faces count as overlap (`>`/`<`, not `>=`).
 */
export function aabbOverlap(a: Aabb3, b: Aabb3, marginM = 0): boolean {
  return (
    a.min.x - marginM <= b.max.x && a.max.x + marginM >= b.min.x &&
    a.min.y - marginM <= b.max.y && a.max.y + marginM >= b.min.y &&
    a.min.z - marginM <= b.max.z && a.max.z + marginM >= b.min.z
  );
}

/** Overlap volume (m³) of two AABBs, or 0 when disjoint. */
export function aabbOverlapVolumeM3(a: Aabb3, b: Aabb3): number {
  const dx = Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x);
  const dy = Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y);
  const dz = Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z);
  if (dx <= 0 || dy <= 0 || dz <= 0) return 0;
  return dx * dy * dz;
}

/** Geometric centre of an AABB (metres). */
export function aabbCenter(box: Aabb3): Vec3 {
  return {
    x: (box.min.x + box.max.x) / 2,
    y: (box.min.y + box.max.y) / 2,
    z: (box.min.z + box.max.z) / 2,
  };
}

/** Largest edge length of an AABB (metres) — used to size the broad-phase grid. */
export function aabbMaxExtent(box: Aabb3): number {
  return Math.max(
    box.max.x - box.min.x,
    box.max.y - box.min.y,
    box.max.z - box.min.z,
  );
}

/** Build an AABB from two corner points, normalising min/max per axis. */
export function aabbFromPoints(p: Vec3, q: Vec3): Aabb3 {
  return {
    min: { x: Math.min(p.x, q.x), y: Math.min(p.y, q.y), z: Math.min(p.z, q.z) },
    max: { x: Math.max(p.x, q.x), y: Math.max(p.y, q.y), z: Math.max(p.z, q.z) },
  };
}
