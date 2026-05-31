/**
 * gizmo-geometry.ts — factory assembling the gizmo visual elements + hitboxes.
 *
 * PORTED from GenArc ADR-022 (Gizmo System). Arrows, plane handles, resize
 * handles, center tetrahedron, origin reticle, rotation rings. Builder
 * functions live in gizmo-builders.ts / gizmo-handle-builders.ts.
 * @related ADR-402 (3D Viewport BIM Element Editing) — GenArc gizmo port.
 */

import * as THREE from 'three';
import type { GizmoHandleId } from './gizmo-types';
import {
  PLANE_OFFSET,
  GIZMO_COLOR_CENTER, AXIS_COLORS, PLANE_COLORS,
  RESIZE_IDLE_COLORS, RESIZE_HANDLE_OFFSET,
  PYRAMID_OFFSET,
  NEG_AXIS_LENGTH, NEG_AXIS_OPACITY,
  GIZMO_RENDER_ORDER,
} from './gizmo-constants';
import {
  makeMaterial, applyRenderOrder,
  buildArrowAlongY,
  buildPlaneHandle,
} from './gizmo-builders';
import {
  buildResizeHandle,
  buildCenterHandle,
  buildOriginReticle,
} from './gizmo-handle-builders';

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface GizmoMeshSet {
  /** Root group — add to scene */
  readonly root: THREE.Group;
  /** Visible meshes keyed by handle id (for highlighting) */
  readonly visuals: ReadonlyMap<GizmoHandleId, THREE.Mesh | THREE.Group>;
  /** Invisible hitbox meshes for raycasting */
  readonly hitboxes: readonly THREE.Mesh[];
  /** Look up which GizmoHandleId a hitbox mesh belongs to */
  readonly hitboxToId: ReadonlyMap<THREE.Mesh, GizmoHandleId>;
  /** Dispose all geometry and materials */
  readonly dispose: () => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

const AXIS_KEYS = ['x', 'y', 'z'] as const;
const PLANE_KEYS = ['xy', 'xz', 'yz'] as const;

export function createGizmoMeshes(): GizmoMeshSet {
  const root = new THREE.Group();
  root.name = 'gizmo-root';

  const visuals = new Map<GizmoHandleId, THREE.Mesh | THREE.Group>();
  const hitboxes: THREE.Mesh[] = [];
  const hitboxToId = new Map<THREE.Mesh, GizmoHandleId>();

  // --- Arrows (axis handles) -----------------------------------------------

  for (const axis of AXIS_KEYS) {
    const color = AXIS_COLORS[axis];
    const { group, hitbox, tipMesh } = buildArrowAlongY(color);
    const wrapper = new THREE.Group();
    wrapper.name = `gizmo-arrow-${axis}`;
    wrapper.add(group);

    // Rotate from +Y to target axis
    if (axis === 'x') {
      wrapper.rotation.z = -Math.PI / 2;
      hitbox.rotation.z = -Math.PI / 2;
    } else if (axis === 'z') {
      wrapper.rotation.x = Math.PI / 2;
      hitbox.rotation.x = Math.PI / 2;
    }

    const id: GizmoHandleId = `axis-${axis}`;
    tipMesh.userData['axisTip'] = true;
    tipMesh.userData['handleId'] = id;
    visuals.set(id, wrapper);
    hitboxToId.set(hitbox, id);
    hitboxes.push(hitbox);

    root.add(wrapper, hitbox);
  }

  // --- Negative axis indicators (subtle directional hints) -----------------

  for (const axis of AXIS_KEYS) {
    const color = AXIS_COLORS[axis];
    const pts = new Float32Array(6); // [0,0,0, nx,ny,nz]
    if (axis === 'x') pts[3] = -NEG_AXIS_LENGTH;
    if (axis === 'y') pts[4] = -NEG_AXIS_LENGTH;
    if (axis === 'z') pts[5] = -NEG_AXIS_LENGTH;
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color, depthTest: false, depthWrite: false,
      transparent: true, opacity: NEG_AXIS_OPACITY,
    });
    const line = new THREE.Line(lineGeo, lineMat);
    line.renderOrder = GIZMO_RENDER_ORDER;
    root.add(line);
  }

  // --- Plane handles (L-bracket + diagonal + arm extensions) ---------------

  for (const plane of PLANE_KEYS) {
    const color = PLANE_COLORS[plane];
    const { visual, hitbox } = buildPlaneHandle(color);
    visual.name = `gizmo-plane-${plane}`;

    if (plane === 'xy') {
      visual.position.set(PLANE_OFFSET, PLANE_OFFSET, 0);
      hitbox.position.set(PLANE_OFFSET, PLANE_OFFSET, 0);
    } else if (plane === 'xz') {
      visual.position.set(PLANE_OFFSET, 0, PLANE_OFFSET);
      visual.rotation.x = Math.PI / 2;
      hitbox.position.set(PLANE_OFFSET, 0, PLANE_OFFSET);
      hitbox.rotation.x = Math.PI / 2;
    } else {
      visual.position.set(0, PLANE_OFFSET, PLANE_OFFSET);
      visual.rotation.y = -Math.PI / 2;
      hitbox.position.set(0, PLANE_OFFSET, PLANE_OFFSET);
      hitbox.rotation.y = -Math.PI / 2;
    }

    const id: GizmoHandleId = `plane-${plane}`;
    visuals.set(id, visual);
    hitboxToId.set(hitbox, id);
    hitboxes.push(hitbox);

    root.add(visual, hitbox);
  }

  // --- Resize handles (wireframe octahedrons at midpoint of each axis) -----

  const RESIZE_OFFSETS: Record<string, [number, number, number]> = {
    x: [RESIZE_HANDLE_OFFSET, 0, 0],
    y: [0, RESIZE_HANDLE_OFFSET, 0],
    z: [0, 0, RESIZE_HANDLE_OFFSET],
  };

  for (const axis of AXIS_KEYS) {
    const color = RESIZE_IDLE_COLORS[axis];
    const { visual, hitbox, cornerHitboxes } = buildResizeHandle(color);
    const [px, py, pz] = RESIZE_OFFSETS[axis];

    visual.name = `gizmo-resize-${axis}`;

    // Keep resize local +Y aligned to the target gizmo axis (same convention as arrows).
    if (axis === 'x') {
      visual.rotation.z = -Math.PI / 2;
      hitbox.rotation.z = -Math.PI / 2;
    } else if (axis === 'z') {
      visual.rotation.x = Math.PI / 2;
      hitbox.rotation.x = Math.PI / 2;
    }

    visual.position.set(px, py, pz);
    hitbox.position.set(px, py, pz);

    const id: GizmoHandleId = `resize-${axis}`;
    const idMirror: GizmoHandleId = `resize-m-${axis}`;
    visuals.set(id, visual);
    visuals.set(idMirror, visual);
    hitboxToId.set(hitbox, id);
    hitboxes.push(hitbox);

    const placeCornerHitbox = (hb: THREE.Mesh): void => {
      // Corner hitboxes are authored in resize-local coordinates around origin.
      const p = hb.position.clone();
      if (axis === 'x') {
        p.applyAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2);
        hb.rotation.z = -Math.PI / 2;
      } else if (axis === 'z') {
        p.applyAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
        hb.rotation.x = Math.PI / 2;
      }
      hb.position.set(px + p.x, py + p.y, pz + p.z);
    };

    for (const hb of cornerHitboxes.normal) {
      placeCornerHitbox(hb);
      hitboxToId.set(hb, id);
      hitboxes.push(hb);
      root.add(hb);
    }
    for (const hb of cornerHitboxes.mirror) {
      placeCornerHitbox(hb);
      hitboxToId.set(hb, idMirror);
      hitboxes.push(hb);
      root.add(hb);
    }

    root.add(visual, hitbox);
  }

  // --- Center pyramid (orange, on diagonal between axes) --------------------

  const centerGroup = buildCenterHandle(GIZMO_COLOR_CENTER);
  centerGroup.name = 'gizmo-center';
  const po = PYRAMID_OFFSET;
  centerGroup.position.set(po, po, po);

  const hitPad = 0.08;
  const centerHitGeo = new THREE.BoxGeometry(hitPad, hitPad, hitPad);
  const centerHitbox = new THREE.Mesh(
    centerHitGeo, makeMaterial(0x000000, { visible: false }),
  );
  centerHitbox.position.set(po, po, po);
  applyRenderOrder(centerHitbox);

  visuals.set('center', centerGroup);
  hitboxToId.set(centerHitbox, 'center');
  hitboxes.push(centerHitbox);

  root.add(centerGroup, centerHitbox);

  // --- Origin reticle (circle + crosshair) ---------------------------------

  const reticle = buildOriginReticle();
  root.add(reticle);

  // Make reticle area pickable as center-handle (hover + drag activation).
  const centerOriginHit = new THREE.Mesh(
    new THREE.CircleGeometry(0.17, 24),
    makeMaterial(0x000000, { visible: false, side: THREE.DoubleSide }),
  );
  centerOriginHit.rotation.x = -Math.PI / 2;
  applyRenderOrder(centerOriginHit);
  hitboxToId.set(centerOriginHit, 'center');
  hitboxes.push(centerOriginHit);
  root.add(centerOriginHit);

  // Rotation handles (X/Y/Z rings).
  const makeRotateRing = (axis: 'x' | 'y' | 'z'): void => {
    // Ribbon-style rings with width on the opposite direction (normal to ring plane).
    const baseR = axis === 'x' ? 0.34 : axis === 'y' ? 0.352 : 0.364;

    const visual = new THREE.Mesh(
      new THREE.TorusGeometry(baseR, 0.0055, 12, 160),
      new THREE.MeshBasicMaterial({
        color: AXIS_COLORS[axis],
        transparent: false,
        opacity: 1.0,
        side: THREE.DoubleSide,
        depthTest: true,
        depthWrite: true,
      }),
    );
    // Opposite width direction vs flat ring band: stretch along local normal axis.
    visual.scale.set(1, 1, 2.4);

    const hit = new THREE.Mesh(
      new THREE.TorusGeometry(baseR, 0.05, 16, 128),
      makeMaterial(0x000000, { visible: false }),
    );

    // TorusGeometry default normal is +Z. Rotate to desired ring normal.
    if (axis === 'x') {
      visual.rotation.y = Math.PI / 2;
      hit.rotation.y = Math.PI / 2;
    } else if (axis === 'y') {
      visual.rotation.x = Math.PI / 2;
      hit.rotation.x = Math.PI / 2;
    }

    applyRenderOrder(visual);
    applyRenderOrder(hit);

    visuals.set(`rotate-${axis}` as GizmoHandleId, visual);
    hitboxToId.set(hit, `rotate-${axis}` as GizmoHandleId);
    hitboxes.push(hit);
    root.add(visual, hit);
  };

  makeRotateRing('x');
  makeRotateRing('y');
  makeRotateRing('z');

  // --- Dispose -------------------------------------------------------------

  function dispose(): void {
    root.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Line || child instanceof THREE.LineSegments) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    });
  }

  return { root, visuals, hitboxes, hitboxToId, dispose };
}
