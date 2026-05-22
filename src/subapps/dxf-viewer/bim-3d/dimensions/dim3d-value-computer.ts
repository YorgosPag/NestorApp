/**
 * ADR-366 Phase 9 / C.3 — Dim3D Value Computer.
 *
 * Pure functions: anchors + mode → numeric measurement value.
 *  - aligned  → Euclidean distance in world units (m).
 *  - linear   → distance projected onto axis (X/Y/Z world or entity-local).
 *  - radial   → radius (m).
 *  - angular  → angle in degrees between two rays sharing a vertex.
 *
 * Stateless, deterministic. No Three.js imports — works on Vec3 primitives so
 * Firestore-serializable shapes feed it directly.
 */

import type {
  Dim3DAnchor,
  Dim3DMode,
  Dim3DPlacement,
  Dim3DUnit,
  LinearAxis,
  Vec3,
} from './dim3d-types';

// ──────────────────────────────────────────────────────────────────────────────
// Vector primitives (inlined — no THREE dep)
// ──────────────────────────────────────────────────────────────────────────────

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function len(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function normalize(v: Vec3): Vec3 {
  const l = len(v);
  if (l === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

// ──────────────────────────────────────────────────────────────────────────────
// Per-mode value functions
// ──────────────────────────────────────────────────────────────────────────────

export function computeAlignedValue(anchor: Dim3DAnchor): number {
  return len(sub(anchor.endpointB, anchor.endpointA));
}

const AXIS_VECTORS: Record<Exclude<LinearAxis, 'entityLocal'>, Vec3> = {
  X: { x: 1, y: 0, z: 0 },
  Y: { x: 0, y: 1, z: 0 },
  Z: { x: 0, y: 0, z: 1 },
};

export function computeLinearValue(
  anchor: Dim3DAnchor,
  axis: LinearAxis,
  entityLocalAxis?: Vec3,
): number {
  const delta = sub(anchor.endpointB, anchor.endpointA);
  if (axis === 'entityLocal') {
    if (!entityLocalAxis) {
      throw new Error('computeLinearValue: entityLocal axis requires entityLocalAxis vector');
    }
    return Math.abs(dot(delta, normalize(entityLocalAxis)));
  }
  return Math.abs(dot(delta, AXIS_VECTORS[axis]));
}

export function computeRadialValue(anchor: Dim3DAnchor, center: Vec3): number {
  return len(sub(anchor.endpointA, center));
}

const RAD_TO_DEG = 180 / Math.PI;

export function computeAngularValue(vertex: Vec3, rayA: Vec3, rayB: Vec3): number {
  const a = normalize(sub(rayA, vertex));
  const b = normalize(sub(rayB, vertex));
  const cosTheta = Math.min(1, Math.max(-1, dot(a, b)));
  return Math.acos(cosTheta) * RAD_TO_DEG;
}

// ──────────────────────────────────────────────────────────────────────────────
// Dispatcher — mode + placement + anchor → value
// ──────────────────────────────────────────────────────────────────────────────

export function computeDim3DValue(
  mode: Dim3DMode,
  placement: Dim3DPlacement,
  anchor: Dim3DAnchor,
  entityLocalAxis?: Vec3,
): number {
  switch (mode) {
    case 'aligned':
      return computeAlignedValue(anchor);
    case 'linear': {
      const axis = placement.linear?.axis ?? 'X';
      return computeLinearValue(anchor, axis, entityLocalAxis);
    }
    case 'radial': {
      const center = placement.radial?.center ?? anchor.endpointA;
      return computeRadialValue(anchor, center);
    }
    case 'angular': {
      const ang = placement.angular;
      if (!ang) {
        throw new Error('computeDim3DValue: angular mode requires placement.angular');
      }
      return computeAngularValue(ang.vertex, ang.rayA, ang.rayB);
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Unit formatting
// ──────────────────────────────────────────────────────────────────────────────

export function formatDim3DValue(
  value: number,
  unit: Dim3DUnit,
  precision: number,
  mode: Dim3DMode,
): string {
  if (mode === 'angular') {
    return `${value.toFixed(precision)}°`;
  }
  const scaled = unit === 'mm' ? value * 1000 : value;
  return `${scaled.toFixed(precision)} ${unit}`;
}
