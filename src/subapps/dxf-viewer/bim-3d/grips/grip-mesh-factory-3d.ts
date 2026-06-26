'use client';

/**
 * grip-mesh-factory-3d.ts — `GripInfo[]` → 3D cube visuals + hitboxes for the 3D
 * reshape-grip overlay (ADR-535 Φ1).
 *
 * Each grip is a small AXIS-ALIGNED SOLID CUBE (Giorgio: «λαβές 3Δ») at the slab
 * footprint vertex / edge-midpoint, placed in world via the `dxfPlanToWorld` SSoT at the
 * slab-top elevation, with a THIN BLACK contour. The cube is opaque + depth-tested so its
 * own front faces occlude its back edges (only the visible edges show); it rests ON the
 * slab top (children lifted half a side). A fat invisible box hitbox makes it easy to
 * grab. The overlay (`updateScale`) keeps each cube screen-constant (fixed pixel size
 * during zoom/orbit) while reading as a true 3D handle from any angle.
 *
 * Pure Three.js — no React, no store, no scene mutation.
 */

import * as THREE from 'three';
import type { GripInfo } from '../../hooks/grip-types';
import { dxfPlanToWorld } from '../viewport/coordinate-transforms';

/** Idle grip cube colour (Revit/AutoCAD blue, distinct from the gizmo axes). */
export const GRIP_3D_COLOR = 0x2d8cf0;
/** Hover colour — shared gold with the gizmo hover highlight. */
export const GRIP_3D_HOVER_COLOR = 0xc8a020;
/** Cube contour colour — thin black (Giorgio: όχι άσπρες χοντρές γραμμές). */
export const GRIP_3D_OUTLINE_COLOR = 0x000000;
/** Render order — above geometry + snap marker, alongside the gizmo handles. */
export const GRIP_3D_RENDER_ORDER = 2000;
/** Base cube side (world m) before the overlay's screen-constant scaling. */
const GRIP_BASE_SIDE = 1;
/** Invisible hitbox side as a multiple of the cube (easier clicking). */
const GRIP_HITBOX_FACTOR = 1.8;

export interface Grip3DPart {
  readonly gripIndex: number;
  readonly grip: GripInfo;
  /** Billboarded + scaled holder (visual + outline + hitbox). */
  readonly group: THREE.Group;
  readonly visual: THREE.Mesh;
  readonly hitbox: THREE.Mesh;
  /** Current world position (mutated during a live drag follow). */
  readonly world: THREE.Vector3;
}

export interface Grip3DMeshSet {
  readonly root: THREE.Group;
  readonly parts: readonly Grip3DPart[];
  readonly hitboxToIndex: ReadonlyMap<THREE.Mesh, number>;
  dispose(): void;
}

/** Build the cube visual + thin black contour + hitbox holder for one grip at `world`. */
function buildGripPart(grip: GripInfo, world: THREE.Vector3): Grip3DPart {
  const group = new THREE.Group();
  group.position.copy(world);
  // ADR-535 — a genuine SOLID 3D handle: a small opaque cube whose own front faces
  // occlude its back edges (Giorgio: μόνο οι ορατές ακμές, όχι οι πίσω). depthTest +
  // depthWrite ON → the cube self-occludes; `polygonOffset` pushes the fill slightly
  // back so the black contour wins the depth test on the silhouette without z-fighting.
  const box = new THREE.BoxGeometry(GRIP_BASE_SIDE, GRIP_BASE_SIDE, GRIP_BASE_SIDE);
  const visual = new THREE.Mesh(box, new THREE.MeshBasicMaterial({
    color: GRIP_3D_COLOR, depthTest: true, depthWrite: true,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  }));
  visual.renderOrder = GRIP_3D_RENDER_ORDER;
  // Thin black contour; depthTest ON so the back edges are hidden by the cube body.
  // WebGL caps line width at 1px → already the thinnest possible.
  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(box),
    new THREE.LineBasicMaterial({ color: GRIP_3D_OUTLINE_COLOR, depthTest: true }),
  );
  outline.renderOrder = GRIP_3D_RENDER_ORDER + 1;
  const hbSide = GRIP_BASE_SIDE * GRIP_HITBOX_FACTOR;
  const hitbox = new THREE.Mesh(
    new THREE.BoxGeometry(hbSide, hbSide, hbSide),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  // Rest the cube ON the slab top (lift the children by half a side) so it floats on the
  // surface — not half-sunk — and stays fully visible from the working (above) angle.
  const lift = GRIP_BASE_SIDE * 0.5;
  visual.position.y = lift;
  outline.position.y = lift;
  hitbox.position.y = lift;
  group.add(visual, outline, hitbox);
  return { gripIndex: grip.gripIndex, grip, group, visual, hitbox, world };
}

/**
 * Per-grip top-surface elevation (mm) resolver. ADR-535 Φ2 — a TILTED slab has a
 * DIFFERENT top-face Z per vertex (slope plane), so each grip rides its own elevation
 * (`slabTopZmmAt`) instead of one shared plane — otherwise the grips fly off the surface.
 */
export type GripElevationMmFor = (grip: GripInfo) => number;

/**
 * Build the full reshape-grip mesh set. Each grip sits at its plan (x,y) and its OWN
 * top-surface elevation (`elevationMmFor`, mm) so the cubes hug a tilted slab's sloped
 * top — not one flat plane (ADR-535 Φ2). The caller adds `root` to the scene and disposes
 * via `dispose()` when the grips change.
 */
export function createGrip3DMeshes(grips: readonly GripInfo[], elevationMmFor: GripElevationMmFor): Grip3DMeshSet {
  const root = new THREE.Group();
  root.name = 'bim-grip-overlay-3d';
  const parts: Grip3DPart[] = [];
  const hitboxToIndex = new Map<THREE.Mesh, number>();
  for (const grip of grips) {
    const world = dxfPlanToWorld(grip.position.x, grip.position.y, elevationMmFor(grip));
    const part = buildGripPart(grip, world);
    parts.push(part);
    hitboxToIndex.set(part.hitbox, grip.gripIndex);
    root.add(part.group);
  }
  const dispose = (): void => {
    root.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
        o.geometry.dispose();
        if (o.material instanceof THREE.Material) o.material.dispose();
      }
    });
  };
  return { root, parts, hitboxToIndex, dispose };
}
