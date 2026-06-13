'use client';

/**
 * TempMoveReadoutOverlay — Revit-style live move readout shown while a BIM entity is
 * dragged in the 3D viewport with the gizmo (ADR-363), and while a hosted opening is
 * Alt-dragged along its wall. The 3D mirror of the 2D move readout (`useMovePreview` /
 * `useGripGhostPreview`): a discreet neutral line from the base point to the current
 * point plus a small label with the distance moved.
 *
 * Sibling of `TempAlignmentLineOverlay` (the line) + `TempSnapLabelOverlay` (the label):
 * a scene-side leaf group added in the constructor, driven each move frame with the two
 * world-space endpoints, hidden on commit/cancel, removed on `dispose`. Pure Three.js —
 * no React, no store subscription.
 *
 * SSoT reuse:
 *  - distance text: `formatMoveDistance` (the SAME formatter the 2D readout uses).
 *  - label texture: `createLabelTexture` (one text-rendering path across all 3D overlays).
 *  - constant on-screen label size: `getPixelWorldSize` (Revit annotation scaling).
 *
 * The label distance is computed directly from the two WORLD endpoints (metres), so
 * callers only supply `a` (base) and `b` (current) in Three.js world space.
 */

import * as THREE from 'three';
import { createLabelTexture } from '../dimensions/Dimension3DRenderer';
import { getPixelWorldSize } from '../viewport/coordinate-transforms';
import { formatMoveDistance } from '../../bim/labels/move-readout';

/**
 * Discreet neutral leader line — semi-transparent WHITE, drawn over the model (Revit
 * annotation). White (not black) so it stays visible on the dark 3D scene (clear color
 * `0x1a1a1a`) while remaining subtle.
 */
const READOUT_LINE_COLOR = 0xffffff;
const READOUT_LINE_OPACITY = 0.5;
const READOUT_LINE_RENDER_ORDER = 1998;
/** On-screen height (px) of the label, held CONSTANT across zoom (Revit annotation). */
const READOUT_TEXT_PX = 40;
/** Label texture aspect (512×128 canvas → 4:1) — keeps the sprite undistorted. */
const READOUT_TEXT_ASPECT = 4;
const READOUT_LABEL_RENDER_ORDER = 1999;
/** Below this world-space length the readout is hidden (a zero-length move is noise). */
const READOUT_MIN_WORLD_LEN = 1e-4;

export class TempMoveReadoutOverlay {
  private readonly scene: THREE.Scene;
  private readonly group: THREE.Group;
  private readonly line: THREE.Line;
  private readonly geometry: THREE.BufferGeometry;
  private readonly lineMaterial: THREE.LineBasicMaterial;
  private readonly sprite: THREE.Sprite;
  private readonly spriteMaterial: THREE.SpriteMaterial;
  private currentText = '';
  private disposed = false;
  private readonly mid = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'temp-move-readout';
    this.group.visible = false;

    this.geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(), new THREE.Vector3(),
    ]);
    this.lineMaterial = new THREE.LineBasicMaterial({
      color: READOUT_LINE_COLOR,
      transparent: true,
      opacity: READOUT_LINE_OPACITY,
      depthTest: false,
      depthWrite: false,
    });
    this.line = new THREE.Line(this.geometry, this.lineMaterial);
    this.line.renderOrder = READOUT_LINE_RENDER_ORDER;
    this.group.add(this.line);

    this.spriteMaterial = new THREE.SpriteMaterial({
      transparent: true,
      opacity: 1,
      depthTest: false,
      depthWrite: false,
    });
    this.sprite = new THREE.Sprite(this.spriteMaterial);
    this.sprite.renderOrder = READOUT_LABEL_RENDER_ORDER;
    this.group.add(this.sprite);

    scene.add(this.group);
  }

  /**
   * Show the readout line `a` → `b` (both Three.js world space) with the distance label
   * (metres) at the midpoint, at a constant on-screen size. Hides on a (near-)zero move.
   */
  update(a: THREE.Vector3, b: THREE.Vector3, camera: THREE.Camera, canvas: HTMLElement): void {
    if (this.disposed) return;
    const meters = a.distanceTo(b);
    if (meters < READOUT_MIN_WORLD_LEN) {
      this.hide();
      return;
    }
    this.geometry.setFromPoints([a, b]);

    const text = formatMoveDistance(meters);
    if (text !== this.currentText) {
      this.spriteMaterial.map?.dispose();
      this.spriteMaterial.map = createLabelTexture(text);
      this.spriteMaterial.needsUpdate = true;
      this.currentText = text;
    }

    this.mid.copy(a).lerp(b, 0.5);
    this.sprite.position.copy(this.mid);
    const dist = camera.position.distanceTo(this.mid);
    const worldH = getPixelWorldSize(dist, camera, canvas) * READOUT_TEXT_PX;
    if (worldH > 0) this.sprite.scale.set(worldH * READOUT_TEXT_ASPECT, worldH, 1);

    this.group.visible = true;
  }

  hide(): void {
    if (!this.disposed) this.group.visible = false;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.remove(this.group);
    this.geometry.dispose();
    this.lineMaterial.dispose();
    this.spriteMaterial.map?.dispose();
    this.spriteMaterial.dispose();
  }
}
