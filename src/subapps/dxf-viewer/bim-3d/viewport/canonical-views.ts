/**
 * 12-direction canonical view definitions — SSoT.
 * ADR-366 Phase 4.1 — replaces partial CANONICAL_VIEWS from viewport-constants.ts.
 *
 * Coordinate system (Three.js Y-up):
 *   front = +Z  |  back = -Z  |  right = +X  |  left = -X  |  top = +Y  |  bottom = -Y
 */

import * as THREE from 'three';
import type { CanonicalViewDef, CanonicalViewId, OrthoCanonicalViewId } from './viewport-types';

const S  = 1 / Math.sqrt(3);   // unit-cube diagonal ≈ 0.5774 (for true isometric corners)
const S2 = 1 / Math.sqrt(2);   // unit-square diagonal ≈ 0.7071 (for upper-edge iso views)

/**
 * All 12 canonical views.
 * `lookDir` = camera-to-target direction (unit vector).
 * To get camera-from-target direction: negate lookDir.
 */
export const CANONICAL_VIEW_ENTRIES: readonly CanonicalViewDef[] = [
  // ── 6 orthographic face views ──────────────────────────────────────────────
  { id: 'top',    lookDir: [ 0, -1,  0],        type: 'ortho', projectionMode: 'top',    labelKey: 'canonicalView.top'    },
  { id: 'bottom', lookDir: [ 0,  1,  0],        type: 'ortho', projectionMode: 'bottom', labelKey: 'canonicalView.bottom' },
  { id: 'front',  lookDir: [ 0,  0, -1],        type: 'ortho', projectionMode: 'front',  labelKey: 'canonicalView.front'  },
  { id: 'back',   lookDir: [ 0,  0,  1],        type: 'ortho', projectionMode: 'back',   labelKey: 'canonicalView.back'   },
  { id: 'left',   lookDir: [ 1,  0,  0],        type: 'ortho', projectionMode: 'left',   labelKey: 'canonicalView.left'   },
  { id: 'right',  lookDir: [-1,  0,  0],        type: 'ortho', projectionMode: 'right',  labelKey: 'canonicalView.right'  },
  // ── 6 isometric perspective views (camera in upper hemisphere +Y) ──────────
  // NE = camera at front-right-top (+X+Y+Z)
  { id: 'iso-ne', lookDir: [-S,  -S, -S],       type: 'iso',   labelKey: 'canonicalView.isoNe' },
  // NW = camera at front-left-top (-X+Y+Z)
  { id: 'iso-nw', lookDir: [ S,  -S, -S],       type: 'iso',   labelKey: 'canonicalView.isoNw' },
  // SE = camera at back-right-top (+X+Y-Z)
  { id: 'iso-se', lookDir: [-S,  -S,  S],       type: 'iso',   labelKey: 'canonicalView.isoSe' },
  // SW = camera at back-left-top (-X+Y-Z)
  { id: 'iso-sw', lookDir: [ S,  -S,  S],       type: 'iso',   labelKey: 'canonicalView.isoSw' },
  // UE = upper-right edge (+X+Y, Z=0)
  { id: 'iso-ue', lookDir: [-S2, -S2, 0],       type: 'iso',   labelKey: 'canonicalView.isoUe' },
  // UW = upper-left edge (-X+Y, Z=0)
  { id: 'iso-uw', lookDir: [ S2, -S2, 0],       type: 'iso',   labelKey: 'canonicalView.isoUw' },
] as const;

/** Home view: NE isometric (A.5 decision — AutoCAD-style, industry convergence 4/4). */
export const HOME_CANONICAL_VIEW_ID: CanonicalViewId = 'iso-ne';

/** Ortho-only view IDs (useful for filtering in snap detection). */
export const ORTHO_VIEW_IDS: readonly OrthoCanonicalViewId[] = [
  'top', 'bottom', 'front', 'back', 'left', 'right',
];

/**
 * Tight threshold for exact geometric match between a ViewCube click direction
 * and a canonical iso view. 0.98 separates exact matches (dot=1.0) from
 * non-canonical edges (e.g. top+front edge scores ~0.816 against iso-ne).
 */
export const ISO_EXACT_MATCH_THRESHOLD = 0.98;

/**
 * Returns the canonical iso view ID whose camera-from-target direction best
 * matches `cameraDirFromTarget`, or null if below ISO_EXACT_MATCH_THRESHOLD.
 *
 * Used by ViewCube edge/corner click handler to map geometry to canonical IDs.
 */
export function matchIsoCanonicalView(cameraDirFromTarget: THREE.Vector3): CanonicalViewId | null {
  let best: CanonicalViewId | null = null;
  let bestDot = ISO_EXACT_MATCH_THRESHOLD;
  for (const v of CANONICAL_VIEW_ENTRIES) {
    if (v.type !== 'iso') continue;
    // camera-from-target = -lookDir, so dot(cameraDir, -lookDir) = -dot(cameraDir, lookDir)
    const dot = -(cameraDirFromTarget.x * v.lookDir[0]
                + cameraDirFromTarget.y * v.lookDir[1]
                + cameraDirFromTarget.z * v.lookDir[2]);
    if (dot > bestDot) { bestDot = dot; best = v.id; }
  }
  return best;
}

/** Resolve `CanonicalViewId` → entry. Returns undefined for unknown IDs. */
export function getCanonicalViewDef(id: CanonicalViewId): CanonicalViewDef | undefined {
  return CANONICAL_VIEW_ENTRIES.find(v => v.id === id);
}
