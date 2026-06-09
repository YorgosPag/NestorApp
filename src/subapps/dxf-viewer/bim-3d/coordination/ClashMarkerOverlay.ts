'use client';

/**
 * ADR-435 Slice 1b — ClashMarkerOverlay: the 3D scene markers for clash results
 * (Navisworks "Clash Detective" red points). Scene-side leaf (the TempOpening/Wall
 * overlay pattern): a Three.js Group added to the live scene in the constructor,
 * (re)populated on Detect, emptied on Clear, fully disposed on teardown. Pure
 * Three.js — no React, no store; the `use-bim3d-clash-markers` hook drives it.
 *
 * One octahedron per clash, coloured by severity (the SSoT palette), drawn with
 * `depthTest:false` + a high `renderOrder` so it stays visible THROUGH walls and
 * pipes (you must see clashes that are buried inside geometry). Markers are sized
 * **screen-constant** every frame (`updateScale`, mirroring the gizmo overlay), so
 * they keep a fixed pixel size at any zoom/orbit — like Revit/Navisworks.
 *
 * SSoT reuse:
 *  - plan-metres → world (x, z, −y): `clashPointToWorld` (pure, tested)
 *  - severity → colour int: `clashSeverityColorInt` (shared with 2D + panel)
 *  - screen-constant scale: `dist · tan(fov/2) · scale` (same maths as the gizmo)
 *
 * @see ./clash-marker-math.ts
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
const CLASH_MARKER_SCREEN_SCALE = 0.06;
/** Render after geometry + above the POI (998) so buried clashes stay visible. */
const CLASH_MARKER_RENDER_ORDER = 1000;
/** Unit octahedron shared by every marker (scaled per-instance, disposed once). */
const MARKER_RADIUS_UNIT = 1;

interface ClashMarker {
  readonly mesh: THREE.Mesh;
  readonly world: THREE.Vector3;
}

export class ClashMarkerOverlay {
  private readonly scene: THREE.Scene;
  private readonly group: THREE.Group;
  private readonly geometry: THREE.OctahedronGeometry;
  /** One material per severity, created lazily + reused across Detect/Clear cycles. */
  private readonly materials = new Map<ClashSeverity, THREE.MeshBasicMaterial>();
  private markers: ClashMarker[] = [];
  private disposed = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.geometry = new THREE.OctahedronGeometry(MARKER_RADIUS_UNIT);
    this.group = new THREE.Group();
    this.group.name = 'clash-markers';
    scene.add(this.group);
  }

  /** Replace the markers with one per clash in `review`. */
  setClashes(review: ClashReportReview): void {
    if (this.disposed) return;
    this.clear();
    for (const clash of review.report.clashes) {
      const w = clashPointToWorld(clash.point);
      const mesh = new THREE.Mesh(this.geometry, this.materialFor(clash.severity));
      mesh.position.set(w.x, w.y, w.z);
      mesh.renderOrder = CLASH_MARKER_RENDER_ORDER;
      this.group.add(mesh);
      this.markers.push({ mesh, world: mesh.position.clone() });
    }
  }

  /** Are any markers currently shown? (lets the driver skip idle per-frame work). */
  hasMarkers(): boolean {
    return this.markers.length > 0;
  }

  /**
   * Screen-constant resize — call once per rendered frame while markers exist, so
   * each pin holds a fixed pixel size during zoom/orbit (mirror of the gizmo).
   */
  updateScale(camera: THREE.Camera): void {
    if (this.disposed || this.markers.length === 0) return;
    const persp = camera instanceof THREE.PerspectiveCamera;
    const halfFovTan = persp ? Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) : 0;
    for (const { mesh, world } of this.markers) {
      const s = persp
        ? camera.position.distanceTo(world) * halfFovTan * CLASH_MARKER_SCREEN_SCALE
        : CLASH_MARKER_SCREEN_SCALE;
      mesh.scale.setScalar(Math.max(s, 1e-3));
    }
  }

  /** Remove all marker meshes (materials + shared geometry are kept for reuse). */
  clear(): void {
    for (const { mesh } of this.markers) this.group.remove(mesh);
    this.markers = [];
  }

  /** Tear down: meshes, the shared geometry and every cached material. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
    this.geometry.dispose();
    for (const m of this.materials.values()) m.dispose();
    this.materials.clear();
    this.scene.remove(this.group);
  }

  // ── internals ────────────────────────────────────────────────────────────

  /** Lazily build + cache the severity material (depth-test off so it shows through). */
  private materialFor(severity: ClashSeverity): THREE.MeshBasicMaterial {
    let material = this.materials.get(severity);
    if (!material) {
      material = new THREE.MeshBasicMaterial({
        color: clashSeverityColorInt(severity),
        depthTest: false,
        transparent: true,
        opacity: 0.9,
      });
      this.materials.set(severity, material);
    }
    return material;
  }
}
