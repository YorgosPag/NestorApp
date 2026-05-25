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
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  Sprite,
  SpriteMaterial,
  type Scene,
} from 'three';
import { CAD_UI_COLORS } from '../../config/color-config';
import {
  selectActiveWaypoint,
  selectAnimationToolActive,
  useAnimationStore,
} from './AnimationStore';
import type { Waypoint } from './animation-types';

export type WaypointHandleRole = 'position' | 'target';

const HANDLE_SIZE_WORLD = 0.08;
const TEXTURE_PX = 32;

interface WaypointHandleHandles {
  readonly root: Group;
  readonly positionSprite: Sprite;
  readonly targetSprite: Sprite;
  readonly line: Line;
}

export class WaypointDragHandleRenderer {
  private readonly scene: Scene;
  private readonly handles: WaypointHandleHandles;
  private readonly unsubWaypoint: () => void;
  private readonly unsubToolActive: () => void;
  private hoverRole: WaypointHandleRole | null = null;
  private disposed = false;

  constructor(scene: Scene) {
    this.scene = scene;
    this.handles = createHandlesGroup();
    this.handles.root.visible = false;
    this.scene.add(this.handles.root);

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
  }

  private applyState(waypoint: Waypoint | null): void {
    if (waypoint === null) {
      this.handles.root.visible = false;
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
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubWaypoint();
    this.unsubToolActive();
    this.scene.remove(this.handles.root);
    disposeHandle(this.handles.positionSprite);
    disposeHandle(this.handles.targetSprite);
    this.handles.line.geometry.dispose();
    (this.handles.line.material as LineBasicMaterial).dispose();
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
