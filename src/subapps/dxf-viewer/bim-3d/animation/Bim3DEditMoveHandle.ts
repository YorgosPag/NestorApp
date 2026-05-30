/**
 * ADR-402 Phase 1 §Sub-Phase 2 — BIM 3D move-gizmo renderer (pure Three.js).
 *
 * Mirror of the WaypointDragHandle pattern (group + userData tags for raycast
 * hit-test + axis-lock visual feedback). Renders, on the element's floor plane:
 *   - a translucent disc  → free floor-plane move      (kind='bim-edit-move-plane')
 *   - an X arrow (red)     → lock movement to world X    (kind='bim-edit-axis', axis='X')
 *   - a Z arrow (blue)     → lock movement to world Z    (kind='bim-edit-axis', axis='Z')
 *
 * No Y arrow: the floor-plane move never changes elevation (height edits use the
 * dedicated grip in Sub-Phase 4). Drag math lives in `bim3d-edit-drag-controller`;
 * this class is visualization + pick surface only.
 */

import {
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  type Scene,
  type Vector3,
} from 'three';
import { CAD_UI_COLORS } from '../../config/color-config';
import { AXIS_COLORS, type AxisLock } from './axis-constraint-projector';

const DISC_RADIUS_WORLD = 0.5;
const ARROW_SHAFT_RADIUS = 0.03;
const ARROW_SHAFT_LENGTH = 0.9;
const ARROW_CONE_RADIUS = 0.09;
const ARROW_CONE_HEIGHT = 0.22;
const GIZMO_RENDER_ORDER = 998;

const OPACITY_ACTIVE = 1.0;
const OPACITY_INACTIVE = 0.3;
const OPACITY_DEFAULT = 0.75;

export class Bim3DEditMoveHandle {
  private readonly scene: Scene;
  private readonly root: Group;
  private readonly disc: Mesh;
  private disposed = false;

  constructor(scene: Scene) {
    this.scene = scene;
    this.root = new Group();
    this.root.name = 'bim_edit_move_gizmo';
    this.root.renderOrder = GIZMO_RENDER_ORDER;
    this.root.visible = false;

    this.disc = createDisc();
    this.root.add(this.disc);
    this.root.add(createAxisArrow('X'));
    this.root.add(createAxisArrow('Z'));

    this.scene.add(this.root);
  }

  /** Position the gizmo at the element's world-space anchor (its bbox centre). */
  setAnchor(worldPos: Vector3): void {
    if (this.disposed) return;
    this.root.position.copy(worldPos);
    this.root.updateMatrixWorld(true);
  }

  setVisible(visible: boolean): void {
    if (this.disposed) return;
    this.root.visible = visible;
  }

  /**
   * Raycast surface for the drag controller. Returns null while hidden so the
   * caller can short-circuit before allocating a Raycaster.
   */
  getRoot(): Group | null {
    if (this.disposed || !this.root.visible) return null;
    return this.root;
  }

  /** Dim the non-locked axis arrow; `null` restores the default look. */
  setAxisLockVisual(axis: AxisLock | null): void {
    if (this.disposed) return;
    for (const child of this.root.children) {
      const childAxis = child.userData['axis'] as AxisLock | undefined;
      if (!childAxis) continue;
      const opacity = axis === null
        ? OPACITY_DEFAULT
        : childAxis === axis ? OPACITY_ACTIVE : OPACITY_INACTIVE;
      setArrowOpacity(child as Group, opacity);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.remove(this.root);
    this.root.traverse((obj) => {
      if (obj instanceof Mesh) {
        obj.geometry.dispose();
        (obj.material as MeshBasicMaterial).dispose();
      }
    });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Internals
// ──────────────────────────────────────────────────────────────────────────────

function createDisc(): Mesh {
  const geo = new CircleGeometry(DISC_RADIUS_WORLD, 32);
  const mat = new MeshBasicMaterial({
    color: CAD_UI_COLORS.grips.warm,
    transparent: true,
    opacity: 0.35,
    side: DoubleSide,
    depthTest: false,
  });
  const disc = new Mesh(geo, mat);
  // CircleGeometry lies in XY; rotate flat onto the horizontal XZ floor plane.
  disc.rotation.x = -Math.PI / 2;
  disc.renderOrder = GIZMO_RENDER_ORDER;
  disc.userData['kind'] = 'bim-edit-move-plane';
  return disc;
}

function createAxisArrow(axis: 'X' | 'Z'): Group {
  const color = AXIS_COLORS[axis];
  const mat = new MeshBasicMaterial({ color, transparent: true, opacity: OPACITY_DEFAULT, depthTest: false });

  const shaft = new Mesh(new CylinderGeometry(ARROW_SHAFT_RADIUS, ARROW_SHAFT_RADIUS, ARROW_SHAFT_LENGTH, 8), mat);
  shaft.position.y = ARROW_SHAFT_LENGTH / 2;
  shaft.renderOrder = GIZMO_RENDER_ORDER;

  const tip = new Mesh(new ConeGeometry(ARROW_CONE_RADIUS, ARROW_CONE_HEIGHT, 8), mat.clone());
  tip.position.y = ARROW_SHAFT_LENGTH + ARROW_CONE_HEIGHT / 2;
  tip.renderOrder = GIZMO_RENDER_ORDER;

  const arrow = new Group();
  arrow.add(shaft, tip);
  arrow.userData['kind'] = 'bim-edit-axis';
  arrow.userData['axis'] = axis;
  // Cylinder/cone default along +Y. Re-aim onto the requested world axis.
  if (axis === 'X') arrow.rotation.z = -Math.PI / 2; // +Y → +X
  else arrow.rotation.x = Math.PI / 2;               // +Y → +Z
  return arrow;
}

function setArrowOpacity(arrow: Group, opacity: number): void {
  for (const child of arrow.children) {
    const mesh = child as Mesh;
    (mesh.material as MeshBasicMaterial).opacity = opacity;
  }
}
