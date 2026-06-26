'use client';

/**
 * grip-mesh-factory-3d.ts — `GripInfo[]` → camera-facing square visuals + hitboxes
 * for the 3D reshape-grip overlay (ADR-535 Φ1).
 *
 * Each grip is a small filled square (white outline) at the slab footprint vertex /
 * edge-midpoint, placed in world via the `dxfPlanToWorld` SSoT at the slab-top
 * elevation. A fat invisible box hitbox makes it easy to grab. The squares are
 * billboarded + screen-constant-scaled by the overlay (`updateScale`), mirroring the
 * gizmo's snap marker, so they keep a fixed pixel size and read as squares from any
 * orbit angle. `depthTest: false` keeps them visible above the slab surface.
 *
 * Pure Three.js — no React, no store, no scene mutation.
 */

import * as THREE from 'three';
import type { GripInfo } from '../../hooks/grip-types';
import { dxfPlanToWorld } from '../viewport/coordinate-transforms';

/** Idle grip square colour (Revit/AutoCAD blue, distinct from the gizmo axes). */
export const GRIP_3D_COLOR = 0x2d8cf0;
/** Hover colour — shared gold with the gizmo hover highlight. */
export const GRIP_3D_HOVER_COLOR = 0xc8a020;
/** Render order — above geometry + snap marker, alongside the gizmo handles. */
export const GRIP_3D_RENDER_ORDER = 2000;
/** Base square side (world m) before the overlay's screen-constant scaling. */
const GRIP_BASE_SIDE = 1;
/** Invisible hitbox side as a multiple of the square (easier clicking). */
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

/** Build the visual + outline + hitbox holder for one grip at `world`. */
function buildGripPart(grip: GripInfo, world: THREE.Vector3): Grip3DPart {
  const group = new THREE.Group();
  group.position.copy(world);
  const square = new THREE.PlaneGeometry(GRIP_BASE_SIDE, GRIP_BASE_SIDE);
  const visual = new THREE.Mesh(square, new THREE.MeshBasicMaterial({
    color: GRIP_3D_COLOR, transparent: true, opacity: 0.85,
    depthTest: false, side: THREE.DoubleSide,
  }));
  visual.renderOrder = GRIP_3D_RENDER_ORDER;
  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(square),
    new THREE.LineBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true }),
  );
  outline.renderOrder = GRIP_3D_RENDER_ORDER + 1;
  const hbSide = GRIP_BASE_SIDE * GRIP_HITBOX_FACTOR;
  const hitbox = new THREE.Mesh(
    new THREE.BoxGeometry(hbSide, hbSide, hbSide),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  group.add(visual, outline, hitbox);
  return { gripIndex: grip.gripIndex, grip, group, visual, hitbox, world };
}

/**
 * Build the full reshape-grip mesh set at `planeWorldY` (the slab-top world Y). The
 * caller adds `root` to the scene and disposes via `dispose()` when the grips change.
 */
export function createGrip3DMeshes(grips: readonly GripInfo[], planeWorldY: number): Grip3DMeshSet {
  const root = new THREE.Group();
  root.name = 'bim-grip-overlay-3d';
  const parts: Grip3DPart[] = [];
  const hitboxToIndex = new Map<THREE.Mesh, number>();
  const elevMm = planeWorldY * 1000; // dxfPlanToWorld takes mm; world.y = elev_mm·0.001.
  for (const grip of grips) {
    const world = dxfPlanToWorld(grip.position.x, grip.position.y, elevMm);
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
