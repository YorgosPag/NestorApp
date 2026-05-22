/**
 * ADR-366 Phase 9 / C.3 — 3D Manual Dimensions: TYPE DEFINITIONS.
 *
 * Schema mirrors ADR-362 2D dimension where 1:1 applicable, but diverges
 * for 3D-specific data (Vector3 anchors, 4-mode discriminator superset,
 * host entity binding, text plane orientation).
 *
 * Persistence: `bim_dimensions_3d/{dimensionId}` (Firestore, company-scoped).
 */

import type { Vector3 as ThreeVector3 } from 'three';

// ──────────────────────────────────────────────────────────────────────────────
// Vector primitives (Firestore-serializable — Vector3 cannot be stored directly)
// ──────────────────────────────────────────────────────────────────────────────

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Placement discriminator — 4 modes mirroring ADR-362 Group A
// ──────────────────────────────────────────────────────────────────────────────

export type Dim3DMode = 'aligned' | 'linear' | 'radial' | 'angular';

export type LinearAxis = 'X' | 'Y' | 'Z' | 'entityLocal';

export interface LinearPlacement {
  readonly axis: LinearAxis;
  readonly entityRefId?: string;
}

export interface RadialPlacement {
  readonly center: Vec3;
  readonly radius: number;
}

export interface AngularPlacement {
  readonly vertex: Vec3;
  readonly rayA: Vec3;
  readonly rayB: Vec3;
}

export interface Dim3DPlacement {
  readonly aligned?: Record<string, never>;
  readonly linear?: LinearPlacement;
  readonly radial?: RadialPlacement;
  readonly angular?: AngularPlacement;
}

// ──────────────────────────────────────────────────────────────────────────────
// Anchor — endpoint pair + optional host entity bindings
// ──────────────────────────────────────────────────────────────────────────────

export interface Dim3DAnchor {
  readonly endpointA: Vec3;
  readonly endpointB: Vec3;
  readonly additionalPoints?: readonly Vec3[];
  readonly hostEntityIds?: readonly string[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Visual styling
// ──────────────────────────────────────────────────────────────────────────────

export type Dim3DTextPlane = 'billboard' | 'world';
export type Dim3DUnit = 'mm' | 'm';
export type Dim3DLeaderShape = 'L' | 'straight';

export interface Dim3DLeaderStyle {
  readonly shape: Dim3DLeaderShape;
  readonly arrowSize: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Top-level entity (Firestore document shape)
// ──────────────────────────────────────────────────────────────────────────────

export interface BimDimension3D {
  readonly id: string;
  readonly projectId: string;
  readonly companyId: string;

  readonly mode: Dim3DMode;
  readonly placement: Dim3DPlacement;
  readonly anchor: Dim3DAnchor;

  readonly textOffset: Vec2;
  readonly textPlane: Dim3DTextPlane;

  /** Computed measurement (m for aligned/linear/radial, degrees for angular). */
  readonly value: number;
  readonly unit: Dim3DUnit;
  readonly precision: number;

  readonly leaderStyle: Dim3DLeaderStyle;

  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;

  /** Set after host entity delete → orphan auto-convert (C.3.Q6). */
  readonly orphanedFromEntityIds?: readonly string[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers — Vec3 ⇄ THREE.Vector3 (no @ts-ignore, no `any`)
// ──────────────────────────────────────────────────────────────────────────────

export function toVec3(v: ThreeVector3): Vec3 {
  return { x: v.x, y: v.y, z: v.z };
}

export function fromVec3(v: Vec3, target: ThreeVector3): ThreeVector3 {
  return target.set(v.x, v.y, v.z);
}

export function toVec2(v: { x: number; y: number }): Vec2 {
  return { x: v.x, y: v.y };
}
