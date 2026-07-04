'use client';

/**
 * WireWaypointHandles3D — ADR-408 Φ7 FU#3. 3D handles for editable wire waypoints.
 *
 * A small spheres layer added directly to the scene (NOT the BIM layer group, so
 * `BimSceneLayer.sync()` never clears it): one pickable sphere per existing
 * waypoint of the active circuit, plus a non-pickable "insert" ghost shown where a
 * new vertex would be born on a hovered segment. Mirrors `PlacementSnapMarker`:
 * pure Three.js leaf object, screen-constant scale, depth-test off + high render
 * order so it reads over geometry. Driven by `use-bim3d-wire-waypoint-interaction-3d`.
 *
 * @see ../placement/PlacementSnapMarker.ts (sibling pattern)
 * @see ../../bim/mep-systems/mep-wire-waypoints.ts
 */

import * as THREE from 'three';
// 🏢 ADR-571: tool-anchor cyan SSoT + hex→int SSoT (utils/dxf-true-color.ts)
import { TOOL_ANCHOR_CYAN } from '../../config/color-config';
import { hexToTrueColor } from '../../utils/dxf-true-color';

const NODE_COLOR = 0xffffff;
const NODE_HOVER_COLOR = hexToTrueColor(TOOL_ANCHOR_CYAN);
const INSERT_COLOR = 0x22c55e;
const RENDER_ORDER = 1998;
/** Screen-constant scale: world radius ≈ dist·tan(fov/2)·this. */
const SCREEN_SCALE = 0.018;
const FALLBACK_RADIUS = 0.02;

/** One waypoint node to draw, with its segment identity for picking. */
export interface WireHandleNode {
  readonly worldPos: THREE.Vector3;
  readonly systemId: string;
  readonly keyA: string;
  readonly keyB: string;
  readonly orientedIndex: number;
}

function screenRadius(world: THREE.Vector3, camera: THREE.Camera): number {
  if (camera instanceof THREE.PerspectiveCamera) {
    const dist = camera.position.distanceTo(world);
    return Math.max(dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * SCREEN_SCALE, 1e-3);
  }
  return FALLBACK_RADIUS;
}

export class WireWaypointHandles3D {
  private readonly scene: THREE.Scene;
  private readonly group: THREE.Group;
  private readonly insert: THREE.Mesh;
  private readonly geometry: THREE.SphereGeometry;
  private readonly nodeMat: THREE.MeshBasicMaterial;
  private readonly hoverMat: THREE.MeshBasicMaterial;
  private nodes: THREE.Mesh[] = [];
  private disposed = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.geometry = new THREE.SphereGeometry(1, 16, 12);
    this.nodeMat = new THREE.MeshBasicMaterial({ color: NODE_COLOR, depthTest: false, transparent: true });
    this.hoverMat = new THREE.MeshBasicMaterial({ color: NODE_HOVER_COLOR, depthTest: false, transparent: true });
    this.group = new THREE.Group();
    this.group.name = 'wire-waypoint-handles';
    this.group.renderOrder = RENDER_ORDER;
    this.scene.add(this.group);

    const insertMat = new THREE.MeshBasicMaterial({ color: INSERT_COLOR, depthTest: false, transparent: true, opacity: 0.85 });
    this.insert = new THREE.Mesh(this.geometry, insertMat);
    this.insert.renderOrder = RENDER_ORDER;
    this.insert.visible = false;
    this.insert.raycast = () => {}; // ghost never intercepts picks
    this.scene.add(this.insert);
  }

  /** Rebuild the node spheres for the active circuit, screen-constant sized. */
  updateNodes(nodes: readonly WireHandleNode[], camera: THREE.Camera): void {
    if (this.disposed) return;
    // Pool: reuse existing meshes, add/remove to match count.
    while (this.nodes.length < nodes.length) {
      const m = new THREE.Mesh(this.geometry, this.nodeMat);
      m.renderOrder = RENDER_ORDER;
      this.group.add(m);
      this.nodes.push(m);
    }
    while (this.nodes.length > nodes.length) {
      const m = this.nodes.pop()!;
      this.group.remove(m);
    }
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]!;
      const m = this.nodes[i]!;
      m.material = this.nodeMat;
      m.position.copy(n.worldPos);
      m.scale.setScalar(screenRadius(n.worldPos, camera));
      m.visible = true;
      m.userData['kind'] = 'wire-waypoint-handle-3d';
      m.userData['systemId'] = n.systemId;
      m.userData['keyA'] = n.keyA;
      m.userData['keyB'] = n.keyB;
      m.userData['orientedIndex'] = n.orientedIndex;
      m.updateMatrixWorld(true);
    }
  }

  /** Highlight the node at `index` (or clear when null). */
  setHoveredIndex(index: number | null): void {
    if (this.disposed) return;
    for (let i = 0; i < this.nodes.length; i++) {
      this.nodes[i]!.material = i === index ? this.hoverMat : this.nodeMat;
    }
  }

  /** Show the insert "+" ghost at a world point (sized screen-constant). */
  showInsert(world: THREE.Vector3, camera: THREE.Camera): void {
    if (this.disposed) return;
    this.insert.position.copy(world);
    this.insert.scale.setScalar(screenRadius(world, camera));
    this.insert.visible = true;
    this.insert.updateMatrixWorld(true);
  }

  hideInsert(): void {
    if (!this.disposed) this.insert.visible = false;
  }

  /** The pickable node meshes (for the interaction's raycast). */
  getPickables(): THREE.Object3D[] {
    return this.nodes;
  }

  /** Hide all handles (no active circuit / not editing). */
  hideAll(): void {
    if (this.disposed) return;
    for (const m of this.nodes) m.visible = false;
    this.insert.visible = false;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.remove(this.group);
    this.scene.remove(this.insert);
    this.geometry.dispose();
    this.nodeMat.dispose();
    this.hoverMat.dispose();
    (this.insert.material as THREE.Material).dispose();
  }
}
