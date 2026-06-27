/**
 * proposal-ghost-3d-builders — SSoT pure builders for the 3D MEP auto-design proposal ghost.
 *
 * Turn a discipline's proposal under review into transient translucent `THREE.Object3D`s the
 * {@link ProposalGhost3DOverlay} adds to the scene (and disposes on Accept/Reject). Two shapes,
 * mirroring the 2D ghost:
 *   - electrical → swept conduit per circuit (reuses the committed-wire `wirePathToMesh` polyline
 *     math, but with a translucent ghost material so it reads as a proposal);
 *   - pipe/duct/fuel → one swept tube per proposed segment, at the network's flat source
 *     elevation, tinted by the SSoT classification colour.
 *
 * Single-floor convention (matches `bim3d-preview-rebuild`): the storey datum + building base are
 * 0, so an mm elevation maps straight to world metres. Plan X/Y (scene units) → world via
 * `sceneToM`; world axis convention `x = East, y = Up, z = -North` (see BimToThreeConverter).
 *
 * @see ../converters/mep-wire-to-three.ts — committed-wire conduit converter (polyline source)
 * @see ../../bim/mep-systems/mep-system-color.ts — classification colour SSoT
 */

import * as THREE from 'three';
import type { Point2D } from '../../rendering/types/Types';
import {
  buildWirePolyline,
  type CircuitWirePath,
} from '../../bim/mep-systems/mep-wire-routing';
import {
  hexToThreeInt,
  resolveSegmentClassificationColor,
} from '../../bim/mep-systems/mep-system-color';
import type {
  PlumbingSystemClassification,
  DuctSystemClassification,
  FuelSystemClassification,
} from '../../bim/types/mep-connector-types';
import { sceneUnitsToMeters, type SceneUnits } from '../../utils/scene-units';

const MM_TO_M = 0.001;
/** Translucent so the proposal reads as "not yet committed" (mirror of the 2D ghost fill). */
const GHOST_OPACITY = 0.5;
const TUBE_RADIAL_SEGMENTS = 6;
/** Conduit tube radius (mm) — same readable gauge the committed wire converter uses. */
const CONDUIT_RADIUS_MM = 8;
/** Neutral tint when a segment carries no resolvable classification colour. */
const DEFAULT_GHOST_HEX = '#9ca3af';
/** Neutral tint as a THREE colour int — fallback when a hex fails to parse. */
const DEFAULT_GHOST_INT = hexToThreeInt(DEFAULT_GHOST_HEX) ?? 0x9ca3af;

/** A normalized proposed run (one pipe/duct/fuel segment) the 3D ghost sweeps to a tube. */
export interface ProposalGhostTube {
  readonly start: Readonly<Point2D>;
  readonly end: Readonly<Point2D>;
  readonly diameterMm: number;
  /** Flat world elevation (mm) the run sits at — the network's source-outlet datum. */
  readonly elevationMm: number;
  /** SSoT classification colour, or `undefined` ⇒ neutral default. */
  readonly colorHex?: string;
}

/** Any pipe/duct/fuel system classification — what {@link resolveSegmentClassificationColor} colours. */
type GhostClassification =
  | PlumbingSystemClassification
  | DuctSystemClassification
  | FuelSystemClassification;

/** The minimal proposed-segment shape the 3D ghost needs (every discipline's segment satisfies it). */
interface GhostPipeSegment {
  readonly start: Readonly<Point2D>;
  readonly end: Readonly<Point2D>;
  readonly diameterMm: number;
}

/**
 * The minimal proposed-network shape shared by all six pipe/duct/fuel disciplines (water,
 * drainage, heating, HVAC, fire, gas). Each owns a flat source elevation + a classification +
 * a list of runs — structurally a superset of this, so their reviews flatten with no per-
 * discipline branch (the 2D mounts resolve colour the same way via the SAME SSoT).
 */
export interface GhostPipeNetwork {
  /** Flat world elevation (mm) the whole network sits at — the source-outlet datum. */
  readonly sourceElevationMm: number;
  /** Network classification → the SSoT ghost tint (heating splits supply/return per network). */
  readonly classification: GhostClassification;
  readonly segments: readonly GhostPipeSegment[];
}

/**
 * Flatten a discipline's proposed networks into the discipline-agnostic {@link ProposalGhostTube}
 * list the 3D ghost sweeps — one tube per segment, at its network's source elevation, tinted by
 * the SSoT classification colour (mirror of the 2D ghost's per-segment stroke). Pure + testable.
 */
export function pipeNetworksToGhostTubes(
  networks: readonly GhostPipeNetwork[],
): ProposalGhostTube[] {
  const out: ProposalGhostTube[] = [];
  for (const network of networks) {
    const colorHex = resolveSegmentClassificationColor(network.classification) ?? undefined;
    for (const seg of network.segments) {
      out.push({
        start: seg.start,
        end: seg.end,
        diameterMm: seg.diameterMm,
        elevationMm: network.sourceElevationMm,
        colorHex,
      });
    }
  }
  return out;
}

/**
 * Build a fresh UNLIT translucent ghost material (caller/overlay owns disposal). ADR-537 — the
 * proposal ghost is drawn in the post-FX overlay pass (see {@link ProposalGhost3DOverlay}) which
 * renders each root standalone with no lights, so a lit material would render black; a flat
 * `MeshBasicMaterial` is the correct preview look AND removes the idle SSAO "mustard" tint.
 */
function ghostMaterial(colorInt: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: colorInt,
    transparent: true,
    opacity: GHOST_OPACITY,
    depthWrite: false,
  });
}

/** Sweep a polyline of ≥2 world points to a non-pickable tube, or `null` if degenerate. */
function tubeFromPoints(pts: readonly THREE.Vector3[], radiusM: number, mat: THREE.Material): THREE.Mesh | null {
  if (pts.length < 2) return null;
  const curve = new THREE.CurvePath<THREE.Vector3>();
  for (let i = 1; i < pts.length; i++) curve.add(new THREE.LineCurve3(pts[i - 1]!, pts[i]!));
  const geo = new THREE.TubeGeometry(curve, Math.max(1, pts.length - 1), Math.max(0.001, radiusM), TUBE_RADIAL_SEGMENTS, false);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.raycast = () => {};
  return mesh;
}

/**
 * Electrical (strong + weak): one translucent conduit per circuit. Reuses the SSoT
 * `buildWirePolyline` (so the 3D run is geometrically identical to the committed wire / 2D
 * overlay), tinted with each circuit's own colour.
 */
export function buildElectricalGhost3D(
  wirePaths: readonly CircuitWirePath[],
  sceneUnits: SceneUnits,
): THREE.Object3D[] {
  const sceneToM = sceneUnitsToMeters(sceneUnits);
  const radiusM = Math.max(0.001, CONDUIT_RADIUS_MM * MM_TO_M);
  const out: THREE.Object3D[] = [];
  for (const path of wirePaths) {
    const pts = buildWirePolyline(path).map(
      (p) => new THREE.Vector3(p.x * sceneToM, p.zMm * MM_TO_M, -p.y * sceneToM),
    );
    const mesh = tubeFromPoints(pts, radiusM, ghostMaterial(hexToThreeInt(path.colorHex) ?? DEFAULT_GHOST_INT));
    if (mesh) out.push(mesh);
  }
  return out;
}

/**
 * Pipe / duct / fuel disciplines: one translucent tube per proposed segment, at the segment's
 * flat network elevation, tinted by its (pre-resolved) classification colour. The caller
 * flattens its discipline-specific networks into `ProposalGhostTube[]`.
 */
export function buildSegmentGhost3D(
  tubes: readonly ProposalGhostTube[],
  sceneUnits: SceneUnits,
): THREE.Object3D[] {
  const sceneToM = sceneUnitsToMeters(sceneUnits);
  // One material per colour within this build (disposed together by the overlay).
  const matByColour = new Map<number, THREE.MeshBasicMaterial>();
  const out: THREE.Object3D[] = [];
  for (const tube of tubes) {
    const colorInt = hexToThreeInt(tube.colorHex ?? DEFAULT_GHOST_HEX) ?? DEFAULT_GHOST_INT;
    let mat = matByColour.get(colorInt);
    if (!mat) {
      mat = ghostMaterial(colorInt);
      matByColour.set(colorInt, mat);
    }
    const yM = tube.elevationMm * MM_TO_M;
    const pts = [
      new THREE.Vector3(tube.start.x * sceneToM, yM, -tube.start.y * sceneToM),
      new THREE.Vector3(tube.end.x * sceneToM, yM, -tube.end.y * sceneToM),
    ];
    const radiusM = Math.max(0.001, (tube.diameterMm / 2) * MM_TO_M);
    const mesh = tubeFromPoints(pts, radiusM, mat);
    if (mesh) out.push(mesh);
  }
  return out;
}
