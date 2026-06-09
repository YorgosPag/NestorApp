'use client';

/**
 * TempAlignmentLineOverlay — Revit-style dashed alignment line shown while a wall is
 * dragged flush against another wall's face with the 3D gizmo (ADR-363 Φ1G.5 Slice 2i).
 *
 * Sibling of `TempWallMoveDimOverlay`: a scene-side leaf object added to the live scene
 * in the constructor, driven each move frame from the gizmo's active snap reference
 * (`BimGizmoController.getActiveAlignmentWorld()`), hidden on commit/cancel, removed on
 * `dispose`. Pure Three.js — no React, no store subscription.
 *
 * It draws ONE dashed blue line along the reference face line the snap projected onto,
 * so the user SEES the alignment (the "feel" of the magnetism). Transient read-model:
 * never persisted, vanishes on release. No black outline (Giorgio).
 *
 * SSoT note: the reference geometry comes from the ONE snap engine
 * (`WallFaceSnapEngine` → `SnapCandidate.referenceSegment` → bridge `alignmentRef`) —
 * this overlay only renders it; it computes no geometry of its own.
 */

import * as THREE from 'three';
import {
  ALIGNMENT_LINE_COLOR, ALIGNMENT_LINE_DASH, ALIGNMENT_LINE_GAP, ALIGNMENT_LINE_RENDER_ORDER,
} from '../gizmo/gizmo-constants';

export class TempAlignmentLineOverlay {
  private readonly scene: THREE.Scene;
  private readonly line: THREE.Line;
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.LineDashedMaterial;
  private disposed = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(), new THREE.Vector3(),
    ]);
    this.material = new THREE.LineDashedMaterial({
      color: ALIGNMENT_LINE_COLOR,
      dashSize: ALIGNMENT_LINE_DASH,
      gapSize: ALIGNMENT_LINE_GAP,
      depthTest: false,
      transparent: true,
    });
    this.line = new THREE.Line(this.geometry, this.material);
    this.line.name = 'temp-alignment-line';
    this.line.renderOrder = ALIGNMENT_LINE_RENDER_ORDER;
    this.line.visible = false;
    scene.add(this.line);
  }

  /** Show the dashed alignment line between the two reference-face world endpoints. */
  update(a: THREE.Vector3, b: THREE.Vector3): void {
    if (this.disposed) return;
    this.geometry.setFromPoints([a, b]);
    this.line.computeLineDistances(); // required for LineDashedMaterial
    this.line.visible = true;
  }

  hide(): void {
    if (!this.disposed) this.line.visible = false;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.remove(this.line);
    this.geometry.dispose();
    this.material.dispose();
  }
}
