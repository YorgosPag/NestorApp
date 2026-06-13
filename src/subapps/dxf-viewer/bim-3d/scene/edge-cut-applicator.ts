/**
 * ADR-452 — apply the horizontal cut to the fat-line edge overlays (ADR-375).
 *
 * The solid faces clip on the GPU; the fat-line edge overlay (`LineMaterial`)
 * can't be clipped on this Three build (shader compile error), so the wireframe
 * above the cut would float as a phantom "cage". This module trims the edge line
 * geometry on the CPU so the edges hide GRADUALLY — shrinking exactly at the cut
 * plane as the slider moves, in lock-step with the faces.
 *
 * Performance: only overlays that CROSS the plane are re-trimmed + re-uploaded
 * (cached `appliedCutY` skips redundant work); fully-below overlays keep their
 * original geometry, fully-above overlays are hidden. Driven from
 * `SectionSceneController.applyState()` — i.e. once per cut change, not per frame.
 */

import * as THREE from 'three';
import type { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { clipLineSegmentsToCutY, worldYRange } from './edge-cut-trim';

const EPS = 1e-4;

interface EdgeCutUserData {
  bimEdgeOverlay?: boolean;
  /** Pristine local line positions, cached once before any trim. */
  bimEdgeOrig?: Float32Array;
  /** World-Y extent of the pristine geometry (for fully-below / above classification). */
  bimEdgeYRange?: { minY: number; maxY: number };
  /** The cut-Y currently applied to the geometry (null/undefined = pristine). */
  bimEdgeAppliedCutY?: number | null;
}

/** Reconstruct (and cache) the pristine flat local positions from the fat-line geometry. */
function getOriginalPositions(overlay: LineSegments2): Float32Array | null {
  const ud = overlay.userData as EdgeCutUserData;
  if (ud.bimEdgeOrig) return ud.bimEdgeOrig;
  const geo = overlay.geometry;
  const start = geo.attributes['instanceStart'] as THREE.InterleavedBufferAttribute | undefined;
  const end = geo.attributes['instanceEnd'] as THREE.InterleavedBufferAttribute | undefined;
  if (!start || !end) return null;
  const count = start.count;
  const arr = new Float32Array(count * 6);
  for (let i = 0; i < count; i++) {
    arr[i * 6] = start.getX(i);
    arr[i * 6 + 1] = start.getY(i);
    arr[i * 6 + 2] = start.getZ(i);
    arr[i * 6 + 3] = end.getX(i);
    arr[i * 6 + 4] = end.getY(i);
    arr[i * 6 + 5] = end.getZ(i);
  }
  ud.bimEdgeOrig = arr;
  return arr;
}

function getYRange(overlay: LineSegments2, orig: Float32Array): { minY: number; maxY: number } {
  const ud = overlay.userData as EdgeCutUserData;
  if (!ud.bimEdgeYRange) ud.bimEdgeYRange = worldYRange(orig, overlay.matrixWorld);
  return ud.bimEdgeYRange;
}

function setOverlayPositions(overlay: LineSegments2, positions: Float32Array): void {
  overlay.geometry.setPositions(positions);
  // Dashed edges read along-edge distance; harmless for solid lines.
  overlay.computeLineDistances();
}

/** Restore one overlay to its pristine, unclipped geometry + visibility. */
function restoreOne(overlay: LineSegments2): void {
  const ud = overlay.userData as EdgeCutUserData;
  if (ud.bimEdgeAppliedCutY != null && ud.bimEdgeOrig) {
    setOverlayPositions(overlay, ud.bimEdgeOrig);
    ud.bimEdgeAppliedCutY = null;
  }
  overlay.visible = true;
}

/**
 * Trim every fat-line edge overlay in `group` to the cut plane at world-Y
 * `cutWorldY`: fully-below kept, fully-above hidden, crossing trimmed to the plane.
 */
export function applyEdgeCutTrim(group: THREE.Object3D, cutWorldY: number): void {
  group.updateMatrixWorld(true);
  group.traverse((obj) => {
    if ((obj.userData as EdgeCutUserData).bimEdgeOverlay !== true) return;
    const overlay = obj as LineSegments2;
    const orig = getOriginalPositions(overlay);
    if (!orig) return;
    const { minY, maxY } = getYRange(overlay, orig);
    const ud = overlay.userData as EdgeCutUserData;

    if (maxY <= cutWorldY + EPS) {
      // fully below the cut — show pristine edges (restore if previously trimmed)
      restoreOne(overlay);
    } else if (minY >= cutWorldY - EPS) {
      // fully above the cut — nothing should show
      overlay.visible = false;
    } else {
      // crossing — trim to the plane; re-upload only when the cut actually moved
      overlay.visible = true;
      if (ud.bimEdgeAppliedCutY !== cutWorldY) {
        setOverlayPositions(overlay, clipLineSegmentsToCutY(orig, overlay.matrixWorld, cutWorldY));
        ud.bimEdgeAppliedCutY = cutWorldY;
      }
    }
  });
}

/** Restore every fat-line edge overlay in `group` to pristine geometry + visible. */
export function restoreEdgeCut(group: THREE.Object3D): void {
  group.traverse((obj) => {
    if ((obj.userData as EdgeCutUserData).bimEdgeOverlay !== true) return;
    restoreOne(obj as LineSegments2);
  });
}
