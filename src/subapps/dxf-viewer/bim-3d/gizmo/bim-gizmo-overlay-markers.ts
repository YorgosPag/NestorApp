'use client';

/**
 * bim-gizmo-overlay-markers.ts — non-class helpers for `BimGizmoOverlay`.
 *
 * Extracted from `bim-gizmo-overlay` (Google N.7.1 — the overlay file crossed 500
 * lines). Pure Three.js marker factories (snap square, relocatable base-point ⊙) +
 * the idle handle-colour map. No React, no store, no scene mutation.
 */

import * as THREE from 'three';
import type { GizmoHandleId } from './gizmo-types';
import {
  AXIS_COLORS, PLANE_COLORS, RESIZE_IDLE_COLORS, GIZMO_COLOR_CENTER,
  GIZMO_ENDPOINT_COLOR,
  SNAP_MARKER_COLOR, SNAP_MARKER_RENDER_ORDER,
  BASE_POINT_MARKER_COLOR, BASE_POINT_MARKER_RENDER_ORDER,
  BASE_POINT_MARKER_SEGMENTS, BASE_POINT_MARKER_CROSS_FACTOR,
} from './gizmo-constants';

/**
 * Build the drag snap marker — a small cube wireframe (reads as a square frame
 * from any orbit angle, mirroring the 2D endpoint square). Depth-test off + high
 * render order so it stays visible through geometry. Unit half-extent (box side 2)
 * so `scale.setScalar(s)` gives a half-extent of `s` metres.
 */
export function createSnapMarker(): THREE.LineSegments {
  const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(2, 2, 2));
  const material = new THREE.LineBasicMaterial({
    color: SNAP_MARKER_COLOR,
    depthTest: false,
    transparent: true,
  });
  const marker = new THREE.LineSegments(edges, material);
  marker.renderOrder = SNAP_MARKER_RENDER_ORDER;
  marker.visible = false;
  return marker;
}

/**
 * ADR-408 — build the relocatable base-point / rotation-centre marker: a unit-radius
 * camera-facing circle outline + a crosshair (Revit ⊙). Unit geometry so
 * `scale.setScalar(s)` yields a ring of radius `s` metres. Depth-test off + high
 * render order so the moved origin stays visible through geometry. Ring + crosshair
 * share ONE material (disposed once in `disposeBasePointMarker`).
 */
export function createBasePointMarker(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'gizmo-base-point-marker';
  const material = new THREE.LineBasicMaterial({
    color: BASE_POINT_MARKER_COLOR,
    depthTest: false,
    transparent: true,
  });
  const ringPts: THREE.Vector3[] = [];
  for (let i = 0; i <= BASE_POINT_MARKER_SEGMENTS; i++) {
    const a = (i / BASE_POINT_MARKER_SEGMENTS) * Math.PI * 2;
    ringPts.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0));
  }
  const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPts), material);
  const c = BASE_POINT_MARKER_CROSS_FACTOR;
  const cross = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-c, 0, 0), new THREE.Vector3(c, 0, 0),
      new THREE.Vector3(0, -c, 0), new THREE.Vector3(0, c, 0),
    ]),
    material,
  );
  group.add(ring, cross);
  group.renderOrder = BASE_POINT_MARKER_RENDER_ORDER;
  group.visible = false;
  return group;
}

/** Dispose the base-point marker's two geometries + its shared material. */
export function disposeBasePointMarker(group: THREE.Group): void {
  let material: THREE.Material | null = null;
  for (const child of group.children) {
    const line = child as THREE.Line;
    line.geometry.dispose();
    material = line.material as THREE.Material;
  }
  material?.dispose();
}

/** Idle colour for a handle id (restored when hover leaves). */
export function defaultColorOf(id: GizmoHandleId): number {
  if (id === 'center') return GIZMO_COLOR_CENTER;
  // ADR-408 Φ-D — endpoint grab dot: clear teal (distinct from axes/centre).
  if (id.startsWith('endpoint-')) return GIZMO_ENDPOINT_COLOR;
  if (id.startsWith('resize-m-')) return RESIZE_IDLE_COLORS[id.slice(9)] ?? GIZMO_COLOR_CENTER;
  if (id.startsWith('resize-')) return RESIZE_IDLE_COLORS[id.slice(7)] ?? GIZMO_COLOR_CENTER;
  if (id.startsWith('rotate-')) return AXIS_COLORS[id.slice(7)] ?? GIZMO_COLOR_CENTER;
  if (id.startsWith('axis-')) return AXIS_COLORS[id.slice(5)] ?? GIZMO_COLOR_CENTER;
  if (id.startsWith('plane-')) return PLANE_COLORS[id.slice(6)] ?? GIZMO_COLOR_CENTER;
  return GIZMO_COLOR_CENTER;
}
