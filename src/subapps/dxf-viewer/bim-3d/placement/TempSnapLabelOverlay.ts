'use client';

/**
 * TempSnapLabelOverlay — Revit-style snap-type label shown next to the snap marker while a
 * wall is dragged with the 3D gizmo (ADR-363 Φ1G.5 Slice 2i).
 *
 * Sibling of `TempAlignmentLineOverlay` / `TempWallMoveDimOverlay`: a scene-side leaf sprite
 * added in the constructor, driven each move frame with the resolved label text ("Παρειά
 * τοίχου", "Γωνία τοίχου", …), hidden on commit/cancel, removed on `dispose`. Pure Three.js.
 *
 * The text is already localised by the caller (the React hook resolves the i18n key via the
 * `snap-description-keys` SSoT); this overlay only renders it, reusing the dimension label
 * texture factory `createLabelTexture` (one text-rendering path = SSoT). The sprite holds a
 * CONSTANT on-screen pixel height regardless of zoom (Revit annotation), sitting just above
 * the snap marker.
 */

import * as THREE from 'three';
import { createLabelTexture } from '../dimensions/Dimension3DRenderer';
import { getPixelWorldSize } from '../viewport/coordinate-transforms';

/** On-screen height (px) of the snap label, held constant across zoom. */
const SNAP_LABEL_TEXT_PX = 30;
/** Label texture aspect (512×128 → 4:1) — keeps the sprite undistorted. */
const SNAP_LABEL_ASPECT = 4;
/** Vertical clearance above the marker, in label-heights (so the text never covers it). */
const SNAP_LABEL_LIFT = 1.1;

export class TempSnapLabelOverlay {
  private readonly scene: THREE.Scene;
  private readonly sprite: THREE.Sprite;
  private readonly material: THREE.SpriteMaterial;
  private currentText = '';
  private disposed = false;
  private readonly tmp = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.material = new THREE.SpriteMaterial({ transparent: true, opacity: 1, depthTest: false, depthWrite: false });
    this.sprite = new THREE.Sprite(this.material);
    this.sprite.name = 'temp-snap-label';
    this.sprite.renderOrder = 2000; // above the marker + alignment line
    this.sprite.visible = false;
    scene.add(this.sprite);
  }

  /** Show `text` just above `world` (the snap marker), at a constant on-screen size. */
  update(text: string, world: THREE.Vector3, camera: THREE.Camera, canvas: HTMLElement): void {
    if (this.disposed || !text) {
      this.hide();
      return;
    }
    if (text !== this.currentText) {
      this.material.map?.dispose();
      this.material.map = createLabelTexture(text);
      this.material.needsUpdate = true;
      this.currentText = text;
    }
    const dist = camera.position.distanceTo(world);
    const worldH = getPixelWorldSize(dist, camera, canvas) * SNAP_LABEL_TEXT_PX;
    if (worldH > 0) {
      this.sprite.scale.set(worldH * SNAP_LABEL_ASPECT, worldH, 1);
      this.tmp.copy(world);
      this.tmp.y += worldH * SNAP_LABEL_LIFT; // sit above the marker
      this.sprite.position.copy(this.tmp);
      this.sprite.visible = true;
    }
  }

  hide(): void {
    if (!this.disposed) this.sprite.visible = false;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.remove(this.sprite);
    this.material.map?.dispose();
    this.material.dispose();
  }
}
