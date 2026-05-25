/**
 * ADR-366 §C.1.b — Waypoint drag-handle renderer (3D viewport sprites).
 *
 * Pure Three.js. Mirror του Dim3DGripsRenderer pattern (sprites + canvas
 * texture + userData for raycaster hit-test). Shows two billboard squares
 * (position + target) plus a connecting line for the currently selected
 * waypoint. Visibility gated by AnimationStore.toolActive + activeWaypoint.
 *
 * Drag interaction (raycaster + mouse handler) lives in
 * `use-waypoint-drag-interaction.ts` + `waypoint-drag-controller.ts`.
 * This renderer exposes `getHandlesGroup()` for raycast access and
 * `setHoverState(role)` for hover-color feedback (cold/hot textures).
 */

import {
  BufferGeometry,
  Camera,
  CanvasTexture,
  ConeGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  Sprite,
  SpriteMaterial,
  Vector2,
  type Scene,
} from 'three';
import { CAD_UI_COLORS } from '../../config/color-config';
import { AXIS_COLORS, AXIS_COLORS_DIM, type AxisLock } from './axis-constraint-projector';
import {
  selectActiveWaypoint,
  selectAnimationToolActive,
  useAnimationStore,
} from './AnimationStore';
import type { Waypoint } from './animation-types';

export type WaypointHandleRole = 'position' | 'target';

const HANDLE_SIZE_WORLD = 0.08;
const TEXTURE_PX = 32;

const GIZMO_SHAFT_RADIUS = 0.004;
const GIZMO_SHAFT_LENGTH = 0.05;
const GIZMO_CONE_RADIUS = 0.012;
const GIZMO_CONE_HEIGHT = 0.02;
const GIZMO_OPACITY_ACTIVE = 1.0;
const GIZMO_OPACITY_INACTIVE = 0.35;
const GIZMO_OPACITY_DEFAULT = 0.6;

interface WaypointHandleHandles {
  readonly root: Group;
  readonly positionSprite: Sprite;
  readonly targetSprite: Sprite;
  readonly line: Line;
}

export class WaypointDragHandleRenderer {
  private readonly scene: Scene;
  private readonly handles: WaypointHandleHandles;
  private readonly gizmoGroup: Group;
  private readonly gizmoRaycaster = new Raycaster();
  private readonly gizmoNdc = new Vector2();
  private readonly unsubWaypoint: () => void;
  private readonly unsubToolActive: () => void;
  private readonly unsubAxisLock: () => void;
  private hoverRole: WaypointHandleRole | null = null;
  private disposed = false;

  constructor(scene: Scene) {
    this.scene = scene;
    this.handles = createHandlesGroup();
    this.handles.root.visible = false;
    this.scene.add(this.handles.root);

    this.gizmoGroup = createGizmoGroup();
    this.gizmoGroup.visible = false;
    this.scene.add(this.gizmoGroup);

    this.applyState(
      useAnimationStore.getState().toolActive
        ? selectActiveWaypoint(useAnimationStore.getState())
        : null,
    );

    this.unsubWaypoint = useAnimationStore.subscribe(
      selectActiveWaypoint,
      (waypoint) => {
        if (this.disposed) return;
        if (!useAnimationStore.getState().toolActive) return;
        this.applyState(waypoint);
      },
    );

    this.unsubToolActive = useAnimationStore.subscribe(
      selectAnimationToolActive,
      (active) => {
        if (this.disposed) return;
        const waypoint = active ? selectActiveWaypoint(useAnimationStore.getState()) : null;
        this.applyState(waypoint);
      },
    );

    this.unsubAxisLock = useAnimationStore.subscribe(
      (s) => s.dragAxisLock,
      (axis) => {
        if (this.disposed) return;
        this.setAxisLockVisual(axis);
      },
    );
  }

  /**
   * Exposed for raycast pickup by `waypoint-drag-controller`. Returns null
   * when handles are hidden (no active waypoint or tool inactive) so the
   * controller can short-circuit before allocating a Raycaster.
   */
  getHandlesGroup(): Group | null {
    if (this.disposed) return null;
    if (!this.handles.root.visible) return null;
    return this.handles.root;
  }

  /**
   * Highlight the handle currently under the pointer (or being dragged).
   * `null` clears the hover state. Idempotent — only rebuilds the sprite
   * texture when the role transitions.
   */
  setHoverState(role: WaypointHandleRole | null): void {
    if (this.disposed) return;
    if (this.hoverRole === role) return;
    this.hoverRole = role;
    paintSprite(this.handles.positionSprite, 'position', role);
    paintSprite(this.handles.targetSprite, 'target', role);
    const waypoint = selectActiveWaypoint(useAnimationStore.getState());
    if (waypoint) positionGizmo(this.gizmoGroup, waypoint, role);
  }

  /** ADR-366 §C.1.b — update gizmo arrow opacity to reflect active axis lock. */
  setAxisLockVisual(axis: AxisLock | null): void {
    if (this.disposed) return;
    for (const child of this.gizmoGroup.children) {
      const childAxis = child.userData['axis'] as AxisLock | undefined;
      if (!childAxis) continue;
      const opacity = axis === null
        ? GIZMO_OPACITY_DEFAULT
        : childAxis === axis ? GIZMO_OPACITY_ACTIVE : GIZMO_OPACITY_INACTIVE;
      setGizmoArrowOpacity(child as Group, opacity);
    }
  }

  /**
   * ADR-366 §C.1.b — raycast gizmo arrows to detect axis clicks.
   * Returns the clicked axis or null. Must be called BEFORE handle pick.
   */
  pickAxisArrow(
    domElement: HTMLElement,
    camera: Camera,
    clientX: number,
    clientY: number,
  ): AxisLock | null {
    if (this.disposed || !this.gizmoGroup.visible) return null;
    const rect = domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    this.gizmoNdc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.gizmoRaycaster.setFromCamera(this.gizmoNdc, camera);
    const hits = this.gizmoRaycaster.intersectObjects(this.gizmoGroup.children, true);
    for (const hit of hits) {
      const axis = readGizmoAxis(hit.object);
      if (axis !== null) return axis;
    }
    return null;
  }

  private applyState(waypoint: Waypoint | null): void {
    if (waypoint === null) {
      this.handles.root.visible = false;
      this.gizmoGroup.visible = false;
      return;
    }
    this.handles.positionSprite.position.set(
      waypoint.position.x,
      waypoint.position.y,
      waypoint.position.z,
    );
    this.handles.targetSprite.position.set(
      waypoint.target.x,
      waypoint.target.y,
      waypoint.target.z,
    );
    updateLineGeometry(this.handles.line, waypoint);
    this.handles.root.visible = true;
    positionGizmo(this.gizmoGroup, waypoint, this.hoverRole);
    this.gizmoGroup.visible = true;
    this.setAxisLockVisual(useAnimationStore.getState().dragAxisLock);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubWaypoint();
    this.unsubToolActive();
    this.unsubAxisLock();
    this.scene.remove(this.handles.root);
    this.scene.remove(this.gizmoGroup);
    disposeHandle(this.handles.positionSprite);
    disposeHandle(this.handles.targetSprite);
    this.handles.line.geometry.dispose();
    (this.handles.line.material as LineBasicMaterial).dispose();
    disposeGizmoGroup(this.gizmoGroup);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Internals
// ──────────────────────────────────────────────────────────────────────────────

function createHandlesGroup(): WaypointHandleHandles {
  const root = new Group();
  root.name = 'waypoint_drag_handles';
  root.renderOrder = 999;

  const positionSprite = createHandleSprite('position');
  const targetSprite = createHandleSprite('target');
  const line = createConnectingLine();

  root.add(positionSprite, targetSprite, line);
  return { root, positionSprite, targetSprite, line };
}

function createHandleSprite(role: WaypointHandleRole): Sprite {
  const material = new SpriteMaterial({
    map: buildHandleTexture(resolveHandleColor(role, null)),
    transparent: true,
    depthTest: false,
  });
  const sprite = new Sprite(material);
  sprite.scale.set(HANDLE_SIZE_WORLD, HANDLE_SIZE_WORLD, 1);
  sprite.userData['kind'] = 'waypoint-handle';
  sprite.userData['role'] = role;
  return sprite;
}

function resolveHandleColor(role: WaypointHandleRole, hoverRole: WaypointHandleRole | null): string {
  if (hoverRole === role) return CAD_UI_COLORS.grips.hot;
  return role === 'position' ? CAD_UI_COLORS.grips.warm : CAD_UI_COLORS.grips.cold;
}

function paintSprite(
  sprite: Sprite,
  role: WaypointHandleRole,
  hoverRole: WaypointHandleRole | null,
): void {
  const mat = sprite.material as SpriteMaterial;
  mat.map?.dispose();
  mat.map = buildHandleTexture(resolveHandleColor(role, hoverRole));
  mat.needsUpdate = true;
}

function createConnectingLine(): Line {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
  const material = new LineBasicMaterial({
    color: new Color(CAD_UI_COLORS.grips.warm),
    transparent: true,
    opacity: 0.5,
    depthTest: false,
  });
  const line = new Line(geometry, material);
  line.userData['kind'] = 'waypoint-handle-line';
  return line;
}

function updateLineGeometry(line: Line, waypoint: Waypoint): void {
  const attr = line.geometry.getAttribute('position') as Float32BufferAttribute;
  attr.setXYZ(0, waypoint.position.x, waypoint.position.y, waypoint.position.z);
  attr.setXYZ(1, waypoint.target.x, waypoint.target.y, waypoint.target.z);
  attr.needsUpdate = true;
  line.geometry.computeBoundingSphere();
}

function buildHandleTexture(fillColor: string): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_PX;
  canvas.height = TEXTURE_PX;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = fillColor;
    ctx.fillRect(0, 0, TEXTURE_PX, TEXTURE_PX);
    ctx.strokeStyle = CAD_UI_COLORS.grips.outline_color;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, TEXTURE_PX - 2, TEXTURE_PX - 2);
  }
  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function disposeHandle(sprite: Sprite): void {
  const mat = sprite.material as SpriteMaterial;
  mat.map?.dispose();
  mat.dispose();
}

// ──────────────────────────────────────────────────────────────────────────────
// Axis gizmo helpers (ADR-366 §C.1.b)
// ──────────────────────────────────────────────────────────────────────────────

function createGizmoGroup(): Group {
  const group = new Group();
  group.name = 'waypoint_axis_gizmo';
  group.renderOrder = 997;
  const axes: AxisLock[] = ['X', 'Y', 'Z'];
  for (const axis of axes) {
    group.add(createAxisArrow(axis));
  }
  return group;
}

function createAxisArrow(axis: AxisLock): Group {
  const color = AXIS_COLORS[axis];
  const mat = new MeshBasicMaterial({ color, transparent: true, opacity: GIZMO_OPACITY_DEFAULT, depthTest: false });
  const shaftGeo = new CylinderGeometry(GIZMO_SHAFT_RADIUS, GIZMO_SHAFT_RADIUS, GIZMO_SHAFT_LENGTH, 6);
  const shaft = new Mesh(shaftGeo, mat);
  shaft.position.y = GIZMO_SHAFT_LENGTH / 2;
  const tipGeo = new ConeGeometry(GIZMO_CONE_RADIUS, GIZMO_CONE_HEIGHT, 6);
  const tip = new Mesh(tipGeo, mat.clone());
  tip.position.y = GIZMO_SHAFT_LENGTH + GIZMO_CONE_HEIGHT / 2;
  const arrow = new Group();
  arrow.add(shaft, tip);
  arrow.userData['axis'] = axis;
  arrow.userData['kind'] = 'axis-gizmo';
  if (axis === 'X') arrow.rotation.z = -Math.PI / 2;
  else if (axis === 'Z') arrow.rotation.x = Math.PI / 2;
  return arrow;
}

function positionGizmo(gizmoGroup: Group, waypoint: Waypoint, hoverRole: WaypointHandleRole | null): void {
  const ref = hoverRole === 'target' ? waypoint.target : waypoint.position;
  gizmoGroup.position.set(ref.x, ref.y, ref.z);
}

function setGizmoArrowOpacity(arrow: Group, opacity: number): void {
  for (const child of arrow.children) {
    const mesh = child as Mesh;
    if (mesh.material) {
      (mesh.material as MeshBasicMaterial).opacity = opacity;
    }
  }
}

function readGizmoAxis(object: import('three').Object3D | null): AxisLock | null {
  let obj = object;
  while (obj) {
    if (obj.userData['kind'] === 'axis-gizmo') {
      const axis = obj.userData['axis'] as AxisLock | undefined;
      if (axis === 'X' || axis === 'Y' || axis === 'Z') return axis;
    }
    obj = obj.parent;
  }
  return null;
}

function disposeGizmoGroup(group: Group): void {
  for (const child of group.children) {
    const arrow = child as Group;
    for (const mesh of arrow.children) {
      (mesh as Mesh).geometry.dispose();
      ((mesh as Mesh).material as MeshBasicMaterial).dispose();
    }
  }
}
