/**
 * stair-part-seating-3d — pure geometry/seating math for 3D stair parts.
 *
 * Extracted from StairToThreeConverter (ADR-358 / N.7.1 file-size split): the
 * direction/seating primitives that turn stair geometry into oriented meshes,
 * with NO dependency on the converter's identity-stamping (`tagStairMesh`) or
 * edge/material helpers. Coordinate convention matches StairToThreeConverter:
 *   DXF plan (mm): X = East, Y = North → Three.js world (m): x = East, z = -North.
 */

import * as THREE from 'three';
import type { Segment3D } from '../../bim/types/stair-types';
import { ensureWorldUvs } from './bim-uv-helpers';
import { directionToUnitVector } from '../../bim/geometry/stairs/stair-geometry-shared';

export interface Vec2Scene { readonly x: number; readonly y: number; }

export function unitVec(x: number, y: number): Vec2Scene | null {
  const m = Math.hypot(x, y);
  return m < 1e-9 ? null : { x: x / m, y: y / m };
}

/** Nearest tread centroid (xy) among treads whose z is within `zTol` of `targetZ`. */
export function nearestTreadCentroid(
  treadInfo: readonly { z: number; c: Vec2Scene }[],
  targetZ: number,
  zTol: number,
  midX: number,
  midY: number,
): Vec2Scene | null {
  let best: Vec2Scene | null = null;
  let bestD = Infinity;
  for (const t of treadInfo) {
    if (Math.abs(t.z - targetZ) > zTol) continue;
    const dx = t.c.x - midX;
    const dy = t.c.y - midY;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = t.c; }
  }
  return best;
}

/**
 * Unit forward (ascent) direction for tread `i`: toward the neighbouring tread one
 * rise ABOVE (nose direction), falling back to the one below, then to the stair's
 * global `direction`. Mirrors `riserAscentDir` (centroid + z-proximity) so turns /
 * winders stay correct; landings are naturally excluded (z off by ≠ one rise).
 */
export function treadForwardDir(
  i: number,
  info: readonly { z: number; c: Vec2Scene }[],
  riseScene: number,
  fallbackDeg: number,
): Vec2Scene | null {
  const here = info[i];
  if (!here) return null;
  const zTol = Math.abs(riseScene) * 0.5 + 1e-6;
  const up = nearestTreadCentroid(info, here.z + riseScene, zTol, here.c.x, here.c.y);
  if (up) return unitVec(up.x - here.c.x, up.y - here.c.y);
  const down = nearestTreadCentroid(info, here.z - riseScene, zTol, here.c.x, here.c.y);
  if (down) return unitVec(here.c.x - down.x, here.c.y - down.y);
  const g = directionToUnitVector(fallbackDeg);
  return { x: g.x, y: g.y };
}

/**
 * Unit ascent (travel) direction at a riser, derived from the adjacent TREAD:
 * the upper tread (dir = treadCentroid − riserMid) when present, else the lower
 * (dir = riserMid − treadCentroid). Landings are deliberately skipped — a
 * landing's centroid sits off the travel axis (e.g. a 2·width switchback landing)
 * and would skew the direction. Used to seat the riser panel flush BEHIND the
 * tread edge (Giorgio 2026-07-21) instead of centred on it.
 */
export function riserAscentDir(
  seg: Segment3D,
  treadInfo: readonly { z: number; c: Vec2Scene }[],
): Vec2Scene | null {
  const midX = (seg.start.x + seg.end.x) * 0.5;
  const midY = (seg.start.y + seg.end.y) * 0.5;
  const zLow = Math.min(seg.start.z, seg.end.z);
  const zHigh = Math.max(seg.start.z, seg.end.z);
  const zTol = (zHigh - zLow) * 0.5 + 1e-6;
  const upper = nearestTreadCentroid(treadInfo, zHigh, zTol, midX, midY);
  if (upper) return unitVec(upper.x - midX, upper.y - midY);
  const lower = nearestTreadCentroid(treadInfo, zLow, zTol, midX, midY);
  if (lower) return unitVec(midX - lower.x, midY - lower.y);
  return null;
}

export function buildRiserBox(
  seg: Segment3D,
  sceneToM: number,
  riseM: number,
  thicknessM: number,
  mat: THREE.MeshStandardMaterial,
  baseY: number,
  ascentDir: Vec2Scene | null,
  treadDropM: number,
  nosingBackM: number,
): THREE.Mesh | null {
  // ADR-370 Phase 5.3 (2026-05-25) — riser Segment3D uses DIAGONAL encoding:
  // start = corner A @zLow on one width edge, end = OPPOSITE corner B @zHigh
  // on the other width edge. The xy diagonal yields midpoint, width axis, and
  // width magnitude — no need to consult `stair.params.direction/width`.
  const dxScene = seg.end.x - seg.start.x;
  const dyScene = seg.end.y - seg.start.y;
  const widthScene = Math.hypot(dxScene, dyScene);
  if (widthScene < 1e-9) return null; // degenerate (zero-width riser)
  const widthM = widthScene * sceneToM;
  const midXScene = (seg.start.x + seg.end.x) * 0.5;
  const midYScene = (seg.start.y + seg.end.y) * 0.5;
  const geo = new THREE.BoxGeometry(thicknessM, riseM, widthM);
  ensureWorldUvs(geo); // ADR-413 — aoMap uv2 (BoxGeometry auto-UVs).
  const mesh = new THREE.Mesh(geo, mat);
  // Along-ascent seating: start from flush-behind-the-tread-edge (half thickness,
  // Giorgio 2026-07-21), then pull further BACK by the nosing overhang so the riser
  // tucks UNDER the tread behind the nose rather than facing the front edge
  // (Giorgio 2026-07-22). `ascentDir` is a scene-frame unit vector; magnitudes in
  // meters. Positive = forward (up-slope), so the nosing pull-back subtracts.
  const alongM = thicknessM * 0.5 - nosingBackM;
  const offXM = ascentDir ? ascentDir.x * alongM : 0;
  const offZM = ascentDir ? -ascentDir.y * alongM : 0; // DXF Y → world -Z
  // Drop the panel by one tread thickness so its TOP face meets the tread's BOTTOM
  // face (the tread rests ON the riser) instead of sitting level with the walking
  // surface (Giorgio 2026-07-22).
  mesh.position.set(
    midXScene * sceneToM + offXM,
    baseY + (seg.start.z + seg.end.z) * 0.5 * sceneToM - treadDropM,
    -midYScene * sceneToM + offZM, // DXF Y → world -Z
  );
  // BoxGeometry width axis = local +Z. Three.js Y-rotation by θ maps (0,0,1) →
  // (sin θ, 0, cos θ). Target world XZ direction = (dxScene, -dyScene)/widthScene
  // (DXF Y → world -Z). Solve: sin θ = dxScene/W, cos θ = -dyScene/W
  // ⇒ θ = atan2(dxScene, -dyScene).
  mesh.rotation.y = Math.atan2(dxScene, -dyScene);
  return mesh;
}
