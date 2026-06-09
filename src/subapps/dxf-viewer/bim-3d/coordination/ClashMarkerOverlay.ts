'use client';

/**
 * ADR-435 Slice 1b — ClashMarkerOverlay: the 3D scene markers for clash results
 * (Navisworks "Clash Detective" points). Scene-side leaf (the TempOpening/Wall
 * overlay pattern): a Three.js Group added to the live scene in the constructor,
 * (re)populated on Detect, emptied on Clear, fully disposed on teardown. Pure
 * Three.js — no React, no store; the `use-bim3d-clash-markers` hook drives it.
 *
 * Each clash is a **camera-facing ring + crosshair (Revit ⊙)** — the SAME glyph the
 * 2D overlay draws (a ring with a crosshair), so the marker reads identically in 2D
 * and 3D (mirror of the gizmo `createBasePointMarker`). Coloured by severity (the
 * SSoT palette), drawn with `depthTest:false` + a high `renderOrder` so it stays
 * visible THROUGH walls and pipes (buried clashes must still be seen). Sized
 * **screen-constant** every frame (`updateScale`) so it keeps a fixed pixel size at
 * any zoom/orbit — like Revit/Navisworks.
 *
 * SSoT reuse:
 *  - plan-metres → world (x, z, −y): `clashPointToWorld` (pure, tested)
 *  - severity → colour int: `clashSeverityColorInt` (shared with 2D + panel)
 *  - screen-constant scale + billboard: same maths as the gizmo base-point marker
 *
 * @see ./clash-marker-math.ts
 * @see ../gizmo/bim-gizmo-overlay-markers.ts (createBasePointMarker — same ⊙ glyph)
 * @see ../../systems/coordination/clash-severity-color.ts
 */

import * as THREE from 'three';
import type { ClashReportReview } from '../../systems/coordination/clash-report-store';
import type { ClashSeverity } from '../../systems/coordination/clash-types';
import { clashSeverityColorInt } from '../../systems/coordination/clash-severity-color';
import { clashPointToWorld } from './clash-marker-math';

/**
 * Pixel-size factor for the screen-constant scale (`dist·tan(fov/2)·scale`, same
 * formula as the gizmo). Calibrated against the gizmo snap marker (0.045–0.13) so a
 * clash pin reads at a comparable, clearly-visible size at any zoom.
 */
const CLASH_MARKER_SCREEN_SCALE = 0.03;
/** Render after geometry + above the POI (998) so buried clashes stay visible. */
const CLASH_MARKER_RENDER_ORDER = 1000;
/** Ring tessellation (segments around the unit circle). */
const RING_SEGMENTS = 40;
/** Crosshair arm length as a fraction of the unit ring radius. */
const CROSS_FACTOR = 0.55;

interface ClashMarker {
  /** Camera-facing group (ring + crosshair) — billboarded + scaled per frame. */
  readonly group: THREE.Group;
  readonly world: THREE.Vector3;
}

export class ClashMarkerOverlay {
  private readonly scene: THREE.Scene;
  private readonly root: THREE.Group;
  /** Shared unit geometries (a ring outline + a crosshair), scaled per-instance. */
  private readonly ringGeometry: THREE.BufferGeometry;
  private readonly crossGeometry: THREE.BufferGeometry;
  /** One material per severity, created lazily + reused across Detect/Clear cycles. */
  private readonly materials = new Map<ClashSeverity, THREE.LineBasicMaterial>();
  private markers: ClashMarker[] = [];
  private disposed = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.ringGeometry = buildRingGeometry();
    this.crossGeometry = buildCrossGeometry();
    this.root = new THREE.Group();
    this.root.name = 'clash-markers';
    scene.add(this.root);
  }

  /** Replace the markers with one ⊙ per clash in `review`. */
  setClashes(review: ClashReportReview): void {
    if (this.disposed) return;
    this.clear();
    for (const clash of review.report.clashes) {
      const w = clashPointToWorld(clash.point);
      const material = this.materialFor(clash.severity);
      const group = new THREE.Group();
      const ring = new THREE.LineLoop(this.ringGeometry, material);
      const cross = new THREE.LineSegments(this.crossGeometry, material);
      ring.renderOrder = CLASH_MARKER_RENDER_ORDER;
      cross.renderOrder = CLASH_MARKER_RENDER_ORDER;
      group.add(ring, cross);
      group.position.set(w.x, w.y, w.z);
      this.root.add(group);
      this.markers.push({ group, world: group.position.clone() });
    }
  }

  /** Are any markers currently shown? (lets the driver skip idle per-frame work). */
  hasMarkers(): boolean {
    return this.markers.length > 0;
  }

  /**
   * Screen-constant resize + billboard — call once per rendered frame while markers
   * exist, so each ⊙ holds a fixed pixel size AND faces the camera (the ring stays a
   * circle from any orbit, mirror of the gizmo base-point marker).
   */
  updateScale(camera: THREE.Camera): void {
    if (this.disposed || this.markers.length === 0) return;
    const persp = camera instanceof THREE.PerspectiveCamera;
    const halfFovTan = persp ? Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) : 0;
    for (const { group, world } of this.markers) {
      const s = persp
        ? camera.position.distanceTo(world) * halfFovTan * CLASH_MARKER_SCREEN_SCALE
        : CLASH_MARKER_SCREEN_SCALE;
      group.scale.setScalar(Math.max(s, 1e-3));
      group.quaternion.copy(camera.quaternion); // face the camera (billboard)
    }
  }

  /** Remove all marker groups (materials + shared geometry are kept for reuse). */
  clear(): void {
    for (const { group } of this.markers) this.root.remove(group);
    this.markers = [];
  }

  /** Tear down: marker groups, the shared geometries and every cached material. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
    this.ringGeometry.dispose();
    this.crossGeometry.dispose();
    for (const m of this.materials.values()) m.dispose();
    this.materials.clear();
    this.scene.remove(this.root);
  }

  // ── internals ────────────────────────────────────────────────────────────

  /** Lazily build + cache the severity material (depth-test off so it shows through). */
  private materialFor(severity: ClashSeverity): THREE.LineBasicMaterial {
    let material = this.materials.get(severity);
    if (!material) {
      material = new THREE.LineBasicMaterial({
        color: clashSeverityColorInt(severity),
        depthTest: false,
        transparent: true,
      });
      this.materials.set(severity, material);
    }
    return material;
  }
}

/** Unit-radius ring outline in the XY plane (billboarded to face the camera). */
function buildRingGeometry(): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < RING_SEGMENTS; i++) {
    const a = (i / RING_SEGMENTS) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0));
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
}

/** Crosshair (two segments through the centre) in the XY plane. */
function buildCrossGeometry(): THREE.BufferGeometry {
  const c = CROSS_FACTOR;
  return new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-c, 0, 0), new THREE.Vector3(c, 0, 0),
    new THREE.Vector3(0, -c, 0), new THREE.Vector3(0, c, 0),
  ]);
}
