/**
 * BIM MEP Fitting — Type Schema (ADR-408 Φ11, auto pipe fittings).
 *
 * A **MEP Fitting** is the connection element materialised at a junction of two
 * or more MEP segments (Revit "Pipe Fitting" / "Duct Fitting"; IFC
 * `IfcPipeFitting` / `IfcDuctFitting`). Unlike the linear `mep-segment`
 * (ADR-408 Φ8), a fitting is point-based: it sits at a node where pipe
 * centrelines meet and bridges them (elbow / tee / cross / coupling / reducer /
 * cap).
 *
 * AUTO-DERIVED (Revit-style): fittings are NOT drawn by hand. They are resolved
 * deterministically from the segment network (`resolveDesiredFittings`) and
 * persisted as first-class elements — re-derivable from the same scene, same
 * `junctionKey` set every time (idempotent).
 *
 * Discriminators:
 *   - `domain` → `'pipe'` (plumbing) | `'duct'` (mechanical, reserved). Drives the
 *               BimCategory + discipline (ADR-405) + IFC class. Φ11 ships `'pipe'`.
 *   - `kind`   → topology of the junction (elbow / coupling / reducer / tee /
 *               cross / cap), classified from the incident count + geometry.
 *
 * SSoT:
 *   - `position` = node centre (world coords, canvas units).
 *   - `incidents` = the pipe ends meeting at the node, each with its direction
 *     unit vector and diameter — the geometry input.
 *   - `junctionKey` = quantized node position, the idempotency anchor.
 *   - `MepFittingGeometry` is a cache from `computeMepFittingGeometry()` —
 *     re-derivable from params, NEVER mutated by consumers.
 *
 * Connectivity: `MepFittingParams` composes {@link MepConnectorHostParams} as a
 * forward hook (the fitting can itself carry typed connectors for downstream
 * system routing); empty in the foundation slice.
 *
 * @see ./mep-segment-types.ts (the linear-element template)
 * @see ./mep-connector-types.ts
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ11
 */

import type {
  BimEntity,
  BimValidation,
  BoundingBox3D,
  Point3D,
  Polygon3D,
} from './bim-base';
import type { SceneUnits } from '../../utils/scene-units';
import type { IfcEntityMixin } from './ifc-entity-mixin';
import type { MepConnectorHostParams } from './mep-component-types';

// ─── Discriminators ────────────────────────────────────────────────────────────

/**
 * Junction topology, classified from the incident count + geometry:
 *   - `'cap'`      → 1 incident (dead end).
 *   - `'coupling'` → 2 collinear, same Ø (straight inline join).
 *   - `'reducer'`  → 2 collinear, different Ø.
 *   - `'elbow'`    → 2 angled.
 *   - `'tee'`      → 3 incidents.
 *   - `'cross'`    → 4 incidents.
 */
export type MepFittingKind = 'elbow' | 'coupling' | 'reducer' | 'tee' | 'cross' | 'cap';

/**
 * Elbow bend style (elbow only):
 *   - `'radiused'` → swept-radius bend (default, Revit "Elbow").
 *   - `'mitered'`  → angular mitre cut.
 */
export type ElbowStyle = 'radiused' | 'mitered';

/**
 * MEP fitting domain. `'pipe'` = plumbing/hydronic; `'duct'` = mechanical/HVAC
 * (reserved). Drives discipline, BimCategory and IFC class. Φ11 ships `'pipe'`.
 */
export type MepFittingDomain = 'pipe' | 'duct';

/** IFC4 class for a MEP fitting, derived from domain. */
export type MepFittingIfcType = 'IfcPipeFitting' | 'IfcDuctFitting';

// ─── Incident (one pipe end meeting at the node) ─────────────────────────────────

/**
 * A single pipe end incident on the junction node. The geometry input from which
 * `kind` is classified and the fitting solid is built.
 */
export interface MepFittingIncident {
  /** FK → the incident `mep-segment` entity id. */
  readonly segmentId: string;
  /** Which connector of the incident pipe meets here (`'seg-start'` | `'seg-end'`). */
  readonly connectorId: string;
  /** Unit vector pointing AWAY from the node, along the pipe centreline. */
  readonly directionUnit: Point3D;
  /** mm. Nominal diameter of the incident pipe. */
  readonly diameterMm: number;
}

// ─── Parameters (derived, SSoT for geometry derivation) ──────────────────────────

/**
 * MEP fitting parameters. All linear measurements in mm (Nestor convention),
 * except where a metre BOQ rollup is documented.
 */
export interface MepFittingParams extends MepConnectorHostParams {
  readonly domain: MepFittingDomain;
  readonly kind: MepFittingKind;
  /** Idempotency anchor — quantized node position. Same node ⇒ same key. */
  readonly junctionKey: string;
  /** Node centre, world coords (canvas units). */
  readonly position: Point3D;
  /** mm. Elevation of the centreline node from project origin. */
  readonly centerlineElevationMm: number;
  /** The pipe ends meeting at the node — geometry + classification input. */
  readonly incidents: readonly MepFittingIncident[];
  /** mm. Nominal Ø — the largest incident diameter. */
  readonly primaryDiameterMm: number;
  /** mm. Reducer only — the smaller Ø. */
  readonly secondaryDiameterMm?: number;
  /** Elbow only — bend style. Defaults to `'radiused'`. */
  readonly elbowStyle?: ElbowStyle;
  /**
   * DXF canvas coordinate unit. Stored so `computeMepFittingGeometry` can convert
   * mm scalars (diameters) → canvas units for the 2D plan outline. Defaults to
   * 'mm' when absent (legacy Firestore docs).
   */
  readonly sceneUnits?: SceneUnits;
  /** FK → Floor.id (storey reference), parallel to segment/wall. */
  readonly storeyId?: string;
}

// ─── Geometry cache (derivable from params; SSoT = params) ───────────────────────

/**
 * Computed fitting geometry. Returned by `computeMepFittingGeometry(params)` —
 * NEVER mutated by consumers.
 *
 *   - `footprint` — 2D plan outline (canvas units), CCW.
 *   - `bbox` — bounding box, z range centred on `centerlineElevationMm`.
 *   - `volumeM3` — m³, BOQ rollup of the fitting solid.
 *   - `length` — m, along-axis extent for coupling/reducer (optional).
 */
export interface MepFittingGeometry {
  readonly footprint: Polygon3D;
  readonly bbox: BoundingBox3D;
  /** m³ — BOQ rollup. */
  readonly volumeM3: number;
  /** m — along-axis length (coupling/reducer). */
  readonly length?: number;
}

// ─── Entity (BIM generic instantiation) ──────────────────────────────────────────

/**
 * MEP fitting BIM entity. Extends `BimEntity` with `kind: MepFittingKind`
 * discriminator + IFC mixin. `type` is the unified `'mep-fitting'`.
 */
export interface MepFittingEntity
  extends BimEntity<MepFittingKind, MepFittingParams, MepFittingGeometry>,
    IfcEntityMixin {
  readonly type: 'mep-fitting';
  /** IFC4 class — `IfcPipeFitting` (pipe) | `IfcDuctFitting` (duct). */
  readonly ifcType: MepFittingIfcType;
}

// ─── Draft (resolve output, pre-persistence) ─────────────────────────────────────

/**
 * A resolved fitting draft, produced by `resolveDesiredFittings`. Carries no
 * `id` — the enterprise id (`generateMepFittingId`) is assigned by the host
 * persistence layer, since id generation is not pure.
 */
export interface MepFittingDraft {
  readonly params: MepFittingParams;
  readonly geometry: MepFittingGeometry;
  readonly validation: BimValidation;
  readonly ifcType: MepFittingIfcType;
  readonly kind: MepFittingKind;
}

// ─── Defaults & constants ────────────────────────────────────────────────────────

/** Default elbow bend style. */
export const DEFAULT_ELBOW_STYLE: ElbowStyle = 'radiused';

/**
 * Resolve the IFC class for a domain. Pure SSoT used by the factory + converters.
 */
export function mepFittingIfcType(domain: MepFittingDomain): MepFittingIfcType {
  return domain === 'pipe' ? 'IfcPipeFitting' : 'IfcDuctFitting';
}
