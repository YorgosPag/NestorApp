/**
 * stair-waist-slabs — the μηρός (waist slab) 3D geometry: the structural concrete
 * body UNDER the steps that makes a monolithic stair read as one solid (Revit /
 * ArchiCAD "Monolithic Stair"), instead of steps floating with nothing below
 * (Giorgio 2026-07-21). Pure geometry + material; the caller tags/edges the meshes.
 *
 * WHY a STEPPED prism, not a flat slab (Giorgio 2026-07-21, C4D inspection): the
 * treads/risers are thin FINISH shells (40 mm tread, 20 mm riser — `StairToThreeConverter`),
 * NOT solid wedges. A flat sloped slab whose top passes through the re-entrant corners
 * rises `rise/tread` while the tread surfaces stay flat, so it pokes ~half-a-rise ABOVE
 * every tread between corners and cuts through the risers (the "μπερδεύεται" report). The
 * big players build the monolithic run as ONE solid whose TOP is the actual step profile
 * (tread tops + riser faces) and whose BOTTOM is the sloped soffit — the thin finishes
 * then sit flush on top with zero intersection. We mirror that.
 *
 * Source of truth = the TREADS' re-entrant corners (each tread's BACK edge `[0]→[3]`,
 * at `along = tread·i, z = rise·i`). Per flight we emit one extruded section prism:
 *   • TOP  = the staircase polyline through the corners (horizontal tread + vertical
 *            riser per step) → the finishes seat flush, never pierced.
 *   • SOFFIT = a straight line parallel to the pitch, `waist` PERPENDICULAR below the
 *            NOSING line (the step tips = the LOWEST step envelope). Measuring from the
 *            nosings (not the re-entrant corners) keeps the soffit below EVERY step even
 *            for a thin waist (`waist < rise·cosθ`) — otherwise it would cut up through
 *            the steps and self-intersect (the wedge/garbage Giorgio saw in C4D).
 *   • ENDS = vertical (plumb) cuts, extended one step toward each adjacent LANDING so
 *            the run reaches the support edges without overhanging the floors.
 * The section is extruded across the flight `width`.
 *
 * Treads group into flights by z-gap: consecutive treads rise exactly one `rise`; a
 * landing makes a `2·rise` jump → a flight boundary (kind-agnostic, no flightSplit).
 *
 * Gated to `monolithic`/`cantilever` — timber-stringer/glass/grating stairs are open
 * underneath. One prism per flight is exact for rectilinear kinds (the monolithic use
 * case: straight/L/U/Γ/winder); curved monolithic (rare) would chord the flight.
 *
 * @see ./StairToThreeConverter.ts (wires + tags these into the stair mesh set)
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md
 */

import * as THREE from 'three';
import type { StairEntity, Point3D, Polygon3D } from '../../bim/types/stair-types';
import { resolveStairMaterial } from '../materials/stair-material-resolver';
import { ensureWorldUvs } from './bim-uv-helpers';
import { DEFAULT_WAIST_SLAB_THICKNESS_MM } from '../../bim/stairs/stair-boq-quantities';

const MM_TO_M = 0.001;
const EPS = 1e-6;

/** Structures rendered as one solid concrete body (a waist slab under the steps). */
const SOLID_BODY_STRUCTURES: ReadonlySet<string> = new Set(['monolithic', 'cantilever']);

/** DXF scene point (x East, y North, z up-in-plan) → Three world (x, y=up, z=-North). */
function toWorldPoint(p: Point3D, sceneToM: number, baseY: number): THREE.Vector3 {
  return new THREE.Vector3(p.x * sceneToM, baseY + p.z * sceneToM, -p.y * sceneToM);
}

/** Same axis mapping as {@link toWorldPoint} for a DIRECTION (no `baseY` translation). */
function toWorldDir(a: Point3D, b: Point3D, sceneToM: number): THREE.Vector3 {
  return new THREE.Vector3((b.x - a.x) * sceneToM, (b.z - a.z) * sceneToM, -(b.y - a.y) * sceneToM);
}

/** A step's re-entrant (inner) corner: the tread's back-edge midpoint, in world space. */
interface ReentrantCorner {
  readonly centre: THREE.Vector3;   // on the re-entrant line (tread back-edge midpoint)
  readonly widthVec: THREE.Vector3; // across the flight (back-left → back-right)
  readonly z: number;               // scene-space elevation (for flight grouping)
}

/**
 * Re-entrant corner of each tread — its BACK edge (`[0]`→`[3]`) at the tread-top z.
 * The back edge is the inner corner where the riser meets the next tread (the nosing
 * underside); its midpoint sits on the red re-entrant line. Degenerate polygons skipped.
 */
function collectReentrantCorners(
  treads: readonly Polygon3D[], sceneToM: number, baseY: number,
): ReentrantCorner[] {
  const corners: ReentrantCorner[] = [];
  for (const t of treads) {
    if (t.length < 4) continue;
    const backLeft = t[0]!, backRight = t[3]!;
    const centre = toWorldPoint(backLeft, sceneToM, baseY)
      .add(toWorldPoint(backRight, sceneToM, baseY)).multiplyScalar(0.5);
    corners.push({ centre, widthVec: toWorldDir(backLeft, backRight, sceneToM), z: backLeft.z });
  }
  return corners;
}

/** Split z-sorted corners into flights: a landing makes a `~2·rise` jump (boundary). */
function groupIntoFlights(sorted: readonly ReentrantCorner[], riseScene: number): ReentrantCorner[][] {
  const flights: ReentrantCorner[][] = [];
  let current: ReentrantCorner[] = [];
  const boundary = Math.abs(riseScene) * 1.5;
  for (const c of sorted) {
    const prev = current[current.length - 1];
    if (prev && Math.abs(c.z - prev.z) > boundary) { flights.push(current); current = []; }
    current.push(c);
  }
  if (current.length > 0) flights.push(current);
  return flights;
}

/**
 * Section outline (in the flight's own vertical plane, `a` = horizontal along the run,
 * `y` = height) of a monolithic flight of `M` steps: the stepped TOP (tread + riser per
 * step, tops on the re-entrant line) closed by a parallel SOFFIT `soffitDrop` vertically
 * below the re-entrant corners, with vertical end faces. `soffitDrop = rise + waist/cosθ`
 * so the soffit clears the NOSING line (lowest step envelope) → the section never
 * self-intersects. Traced CCW: soffit L→R, up the top end, staircase R→L. Exported for
 * the geometry regression (the seat / no-poke / soffit-clearance invariants live here).
 */
export function flightSectionPoints(
  M: number, tStep: number, rStep: number, soffitDrop: number,
): THREE.Vector2[] {
  const stair: THREE.Vector2[] = [new THREE.Vector2(0, 0)];
  for (let k = 0; k < M; k++) {
    stair.push(new THREE.Vector2((k + 1) * tStep, k * rStep));       // tread top → riser foot
    stair.push(new THREE.Vector2((k + 1) * tStep, (k + 1) * rStep)); // riser → next corner
  }
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0, -soffitDrop), new THREE.Vector2(M * tStep, M * rStep - soffitDrop),
  ];
  for (let i = stair.length - 1; i >= 0; i--) pts.push(stair[i]!);
  return pts;
}

/**
 * One monolithic flight solid: extrude the stepped section (top = steps, bottom =
 * soffit `waistM` perpendicular below the re-entrant corners) across the flight width.
 * The section is built in a local (uh, up) frame then placed on the world centreline,
 * so the thin tread/riser finishes seat flush on the steps. Null for a degenerate flight.
 */
function buildFlightWaist(
  flight: readonly ReentrantCorner[], bottomSteps: number, topSteps: number,
  waistM: number, mat: THREE.MeshStandardMaterial,
): THREE.Mesh | null {
  const n = flight.length;
  if (n < 2) return null;
  const c0 = flight[0]!.centre, c1 = flight[n - 1]!.centre;
  const step = c1.clone().sub(c0).divideScalar(n - 1);      // one (tread, rise) step, world
  const horiz = new THREE.Vector3(step.x, 0, step.z);
  const tStep = horiz.length(), rStep = step.y, len = step.length();
  const widthM = flight[0]!.widthVec.length();
  if (tStep < EPS || rStep < EPS || widthM < EPS) return null;

  const uh = horiz.divideScalar(tStep);                     // horizontal run direction
  const up = new THREE.Vector3(0, 1, 0);
  const zDir = new THREE.Vector3().crossVectors(uh, up);    // width axis (horizontal, ⟂ run)
  // Waist measured PERPENDICULAR below the nosing line → vertical drop below the
  // re-entrant corners = one rise (nosing sits a rise below them) + waist/cosθ.
  const soffitDrop = rStep + waistM * (len / tStep);
  const M = (n - 1) + bottomSteps + topSteps;
  const shape = new THREE.Shape(flightSectionPoints(M, tStep, rStep, soffitDrop));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: widthM, bevelEnabled: false });
  geo.applyMatrix4(new THREE.Matrix4().makeBasis(uh, up, zDir)); // local a/y/width → world
  const origin = c0.clone().addScaledVector(step, -bottomSteps).addScaledVector(zDir, -widthM * 0.5);
  geo.translate(origin.x, origin.y, origin.z);              // seat on the flight centreline
  ensureWorldUvs(geo); // ADR-413 — aoMap uv2.
  return new THREE.Mesh(geo, mat);
}

/** Clamp a step-extension to `[0, 1]` — a support is never more than one step away. */
function clampStep(steps: number): number {
  return steps < 0 ? 0 : steps > 1 ? 1 : steps;
}

/**
 * Untagged waist-slab meshes for a stair (empty for open/stringer structures or when
 * the tread geometry is absent). The caller stamps identity + edges. Thickness =
 * `params.waistThickness` (the μηρός SSoT, ADR-395), default 150 mm.
 */
export function buildWaistSlabMeshes(
  stair: StairEntity,
  baseY: number,
  sceneToM: number,
): THREE.Mesh[] {
  if (!SOLID_BODY_STRUCTURES.has(stair.params.structureType)) return [];
  // Full tread list (2D-cut splits it by section plane; the waist spans every step).
  const treads = [...stair.geometry.treadsBelowCut, ...stair.geometry.treadsAboveCut];
  const corners = collectReentrantCorners(treads, sceneToM, baseY);
  if (corners.length < 2) return [];
  corners.sort((a, b) => a.z - b.z);

  const rise = stair.params.rise;
  const flights = groupIntoFlights(corners, rise);
  const waistM = (stair.params.waistThickness ?? DEFAULT_WAIST_SLAB_THICKNESS_MM) * MM_TO_M;
  const baseZ = stair.params.basePoint.z;
  const topFloorZ = baseZ + stair.params.stepCount * rise; // where the last riser lands
  const mat = resolveStairMaterial(stair, 'stair-landing'); // structural concrete (monolithic default)

  const out: THREE.Mesh[] = [];
  flights.forEach((flight, gi) => {
    const firstZ = flight[0]!.z, lastZ = flight[flight.length - 1]!.z;
    // Extend toward a LANDING (interior boundary) by one step; at the real bottom /
    // top floor extend only the residual gap (0 for straight base, 1 for the top riser).
    const bottomSteps = gi === 0 ? clampStep(Math.round((firstZ - baseZ) / rise)) : 1;
    const topSteps = gi === flights.length - 1
      ? clampStep(Math.round((topFloorZ - lastZ) / rise)) : 1;
    const mesh = buildFlightWaist(flight, bottomSteps, topSteps, waistM, mat);
    if (mesh) out.push(mesh);
  });
  return out;
}
