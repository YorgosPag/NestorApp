/**
 * stair-tread-nosing-3d — swept nosing solid for a single tread (ADR-358 Q19 Φ4b).
 *
 * The plan pass (ADR-611 Φ4a, `stair-tread-overrides.ts`) already extended the
 * tread FOOTPRINT by the nosing overhang, so the 3D flat extrude shows a SQUARE
 * nose today. When a tread carries a `customProfile` (Revit "Nosing Profile" —
 * a section, not a plan outline) this module builds the SHAPED nose instead:
 * a side-section swept along the tread width (mirror of `beam-ishape-geometry`).
 *
 * customProfile convention (documented SSoT — consumed only here + Φ4a resolver):
 *   • `x` = forward depth from the RISER line (front of the structural going),
 *           `0 ≤ x ≤ overhang`; `max x` = overhang (how far the nose projects).
 *   • `y` = height, `y = 0` at the walkable top face, negative downward.
 *   • Points trace the nose front→down (e.g. bullnose = quarter arc from the
 *     front-top corner down to the underside).
 *
 * Coordinate convention (identical to the beam swept path):
 *   world X = plan x · world Z = −plan y · world Y = height.
 *
 * Units: the tread footprint is in scene units (×`sceneToM` → metres); the body
 * thickness is absolute (40 mm → metres). `customProfile` is authored in the
 * same scene unit as the tread (mm for the canonical mm-scene stair), so its
 * `y` lines up with the 40 mm thickness. Falls back to `null` (caller uses the
 * flat slab) for a lone tread, a degenerate frame, or a profile with no overhang.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-611-stair-geometry-generators-ssot.md
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §Q19
 */

import * as THREE from 'three';
import type { Point2D, Polygon3D } from '../../bim/types/stair-types';
import { treadForwardDir, type Vec2 } from '../../bim/geometry/stairs/stair-tread-overrides';
import { ensureWorldUvs } from './bim-uv-helpers';

const EPS = 1e-9;

/** Tread local frame recovered winding-agnostically from the footprint + travel dir. */
interface TreadFrame {
  readonly u: Vec2; // unit forward (travel / going direction), plan
  readonly w: Vec2; // unit width direction, plan (u × up handedness)
  readonly depth: number; // full footprint depth along u (going + overhang), scene units
  readonly width: number; // extent along w, scene units
  readonly originX: number; // plan x of the (dMin, wMin) corner
  readonly originY: number; // plan y of the (dMin, wMin) corner
  readonly z: number; // top-face elevation, scene units
}

/** Recover the tread frame; null when the tread is a lone/degenerate quad. */
function treadFrame(treads: readonly Polygon3D[], index: number): TreadFrame | null {
  const poly = treads[index]!;
  if (poly.length < 3) return null;
  const u = treadForwardDir(treads, index);
  if (!u) return null;
  const w: Vec2 = { x: u.y, y: -u.x };
  let dMin = Infinity, dMax = -Infinity, wMin = Infinity, wMax = -Infinity;
  for (const p of poly) {
    const du = p.x * u.x + p.y * u.y;
    const dw = p.x * w.x + p.y * w.y;
    if (du < dMin) dMin = du;
    if (du > dMax) dMax = du;
    if (dw < wMin) wMin = dw;
    if (dw > wMax) wMax = dw;
  }
  const depth = dMax - dMin;
  const width = wMax - wMin;
  if (depth < EPS || width < EPS) return null;
  return {
    u,
    w,
    depth,
    width,
    originX: u.x * dMin + w.x * wMin,
    originY: u.y * dMin + w.y * wMin,
    z: poly[0]!.z,
  };
}

/**
 * Build the closed side-section (local `s`=depth, `h`=height, in METRES): the
 * rectangular body plus the `customProfile` nose trace on the front.
 */
function buildNoseSection(
  section: readonly Point2D[],
  frame: TreadFrame,
  sceneToM: number,
  thicknessM: number,
): THREE.Shape | null {
  let overhang = 0;
  for (const p of section) if (p.x > overhang) overhang = p.x;
  if (overhang < EPS) return null;
  const going = Math.max(0, frame.depth - overhang);
  const shape = new THREE.Shape();
  shape.moveTo(0, 0); // back-top
  shape.lineTo(frame.depth * sceneToM, 0); // front-top
  for (const p of section) {
    shape.lineTo((going + p.x) * sceneToM, p.y * sceneToM); // nose trace (front → down)
  }
  shape.lineTo(0, -thicknessM); // back-bottom
  shape.closePath();
  return shape;
}

/**
 * Build one swept-nose tread mesh, or `null` to fall back to the flat slab.
 * `treads` is the global build-order tread list (neighbours orient the frame).
 */
export function buildTreadNosingMesh(
  treads: readonly Polygon3D[],
  index: number,
  section: readonly Point2D[],
  sceneToM: number,
  thicknessM: number,
  mat: THREE.MeshStandardMaterial,
  baseY: number,
): THREE.Mesh | null {
  if (section.length < 2) return null;
  const frame = treadFrame(treads, index);
  if (!frame) return null;
  const shape = buildNoseSection(section, frame, sceneToM, thicknessM);
  if (!shape) return null;

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: frame.width * sceneToM,
    bevelEnabled: false,
  });
  ensureWorldUvs(geo); // ADR-413 — aoMap uv2.

  // Basis: local X → forward (u), local Y → up, local Z (extrude) → width (w).
  const dirU = new THREE.Vector3(frame.u.x, 0, -frame.u.y);
  const up = new THREE.Vector3(0, 1, 0);
  const dirW = new THREE.Vector3(frame.w.x, 0, -frame.w.y); // = dirU × up (right-handed)
  const m = new THREE.Matrix4().makeBasis(dirU, up, dirW);
  m.setPosition(
    frame.originX * sceneToM,
    baseY + frame.z * sceneToM,
    -frame.originY * sceneToM,
  );
  geo.applyMatrix4(m);

  return new THREE.Mesh(geo, mat);
}
