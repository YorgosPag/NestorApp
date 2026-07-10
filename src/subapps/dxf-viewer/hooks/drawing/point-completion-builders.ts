/**
 * ADR-629 — Shared building blocks for point-placement completion modules.
 *
 * Every `*-completion.ts` for a single-click BIM entity (boiler, radiator,
 * manifold, water-heater, electrical-panel, fixture, furniture, floorplan-symbol)
 * repeated two byte-identical skeletons:
 *
 *   1. `build{X}Entity(params, layerId)` — validate → compute geometry → create,
 *      short-circuiting on hard errors. IDENTICAL across all of them except for
 *      the three injected functions (`validate` / `computeGeometry` / `create`).
 *   2. `buildDefault{X}Params` — the footprint/pose default-resolution prologue
 *      (`overrides.width ?? DEFAULT`, …, `position = {x,y,z:0}`, `rotation ?? 0`)
 *      for the rectangular body-placement family (boiler/radiator/water-heater/
 *      manifold/electrical-panel).
 *
 * This module owns both once. The result contract is the pre-existing
 * {@link PlacementBuildResult} from `create-single-click-placement-tool.ts`
 * (its jsdoc already declared it "shared by every completion module") — adopted
 * here rather than re-declared, so every `Build{X}EntityResult` is a thin alias.
 *
 * Divergent prologues stay bespoke (N.1): fixture uses per-kind
 * `resolveFixtureKindDefaults`, furniture/floorplan resolve footprint from a
 * catalog preset (widthMm/depthMm naming) — those keep their own `buildDefault`
 * bodies and adopt ONLY {@link buildBimPointEntity}.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-629-point-completion-builders-ssot.md
 * @see hooks/drawing/create-single-click-placement-tool.ts — PlacementBuildResult SSoT
 */

import type { Point2D } from '../../rendering/types/Types';
import type { BimValidation, Point3D } from '../../bim/types/bim-base';
import type { SceneUnits } from '../../utils/scene-units';
import type { PlacementBuildResult } from './create-single-click-placement-tool';

// ─── Entity-build skeleton ─────────────────────────────────────────────────────

/** Minimal validation contract every `validate*Params` already satisfies. */
export interface BimParamValidation {
  /** When non-empty → creation is refused, surfaced as `hardErrors`. */
  readonly hardErrors: readonly string[];
  /** `BimValidation` payload assigned straight onto the created entity. */
  readonly bimValidation: BimValidation;
}

/**
 * The create-factory input surface (subset of `CreateBimEntityInputBase`) the
 * skeleton fills in. Every `create{X}` factory accepts a superset of this, so a
 * factory reference can be passed directly as {@link BimPointEntityBuildSpec.createEntity}.
 */
export interface PointEntityCreateInput<TParams, TGeometry> {
  readonly params: TParams;
  readonly geometry: TGeometry;
  readonly layerId: string;
  readonly visible: boolean;
  readonly validation: BimValidation;
}

/** The three functions that genuinely vary between point-entity completion modules. */
export interface BimPointEntityBuildSpec<TParams, TGeometry, TEntity> {
  /** Param validation — hard errors block creation. */
  readonly validate: (params: TParams) => BimParamValidation;
  /** Pure geometry recompute for the resolved params. */
  readonly computeGeometry: (params: TParams) => TGeometry;
  /** Entity factory (N.6 enterprise-id). Typically the `create{X}` factory itself. */
  readonly createEntity: (input: PointEntityCreateInput<TParams, TGeometry>) => TEntity;
}

/**
 * Validate → compute geometry → create, short-circuiting on hard errors. The
 * single implementation of the `build{X}Entity` skeleton that ~8 completion
 * modules repeated verbatim.
 */
export function buildBimPointEntity<TParams, TGeometry, TEntity>(
  params: Readonly<TParams>,
  layerId: string,
  spec: BimPointEntityBuildSpec<TParams, TGeometry, TEntity>,
): PlacementBuildResult<TEntity> {
  const validation = spec.validate(params);
  if (validation.hardErrors.length > 0) {
    return { ok: false, hardErrors: validation.hardErrors };
  }
  const geometry = spec.computeGeometry(params);
  const entity = spec.createEntity({
    params,
    geometry,
    layerId,
    visible: true,
    validation: validation.bimValidation,
  });
  return { ok: true, entity };
}

// ─── Body-placement default resolution ─────────────────────────────────────────

/**
 * Per-call overrides shared by every rectangular body-placement completion
 * (boiler/radiator/water-heater/manifold/electrical-panel). Each module's
 * `*ParamOverrides` extends this and adds its own `kind`/`shape`/extra fields.
 */
export interface BodyPlacementParamOverrides {
  /** mm. Footprint width (run along the wall). */
  readonly width?: number;
  /** mm. Footprint depth. */
  readonly length?: number;
  /** mm. Body vertical height. */
  readonly bodyHeightMm?: number;
  /** mm. Mounting elevation (vertical centre) above FFL. */
  readonly mountingElevationMm?: number;
  /** Degrees CCW. */
  readonly rotation?: number;
  readonly material?: string;
}

/** The mm defaults a body-placement completion supplies for its entity kind. */
export interface BodyPlacementDefaults {
  readonly width: number;
  readonly length: number;
  readonly bodyHeightMm: number;
  readonly mountingElevationMm: number;
}

/** Resolved footprint + pose for a clicked body-placement entity. */
export interface ResolvedBodyPlacement {
  readonly position: Point3D;
  readonly rotation: number;
  readonly width: number;
  readonly length: number;
  readonly bodyHeightMm: number;
  readonly mountingElevationMm: number;
}

/**
 * Resolve the shared footprint/pose prologue for a body-placement completion:
 * `overrides.X ?? default` for each dimension, `rotation ?? 0`, and the clicked
 * `position` at floor level (`z = 0`). Callers layer their `kind`/`shape`/extra
 * fields + derived connectors on top.
 */
export function resolveBodyPlacement(
  clickPoint: Readonly<Point2D>,
  overrides: BodyPlacementParamOverrides,
  defaults: BodyPlacementDefaults,
): ResolvedBodyPlacement {
  return {
    position: { x: clickPoint.x, y: clickPoint.y, z: 0 },
    rotation: overrides.rotation ?? 0,
    width: overrides.width ?? defaults.width,
    length: overrides.length ?? defaults.length,
    bodyHeightMm: overrides.bodyHeightMm ?? defaults.bodyHeightMm,
    mountingElevationMm: overrides.mountingElevationMm ?? defaults.mountingElevationMm,
  };
}

// ─── Appliance-body param assembly ─────────────────────────────────────────────

/**
 * The single connector-diameter + optional catalogue extras carried by every
 * wall/floor-mounted MEP appliance with one supply/return diameter (boiler /
 * radiator / water-heater). Undefined optional fields are omitted so the params
 * stay Firestore-clean (no `undefined` keys).
 */
export interface MepApplianceBodyExtras {
  /** mm. Supply/return connector diameter. */
  readonly connectorDiameterMm: number;
  /** W. Catalogue thermal output / heating-element power. */
  readonly thermalOutputW?: number;
  /** L. Catalogue storage tank capacity (water heater only). */
  readonly tankCapacityL?: number;
  readonly material?: string;
}

/**
 * Assemble the shared params object for a connector-diameter MEP appliance
 * (boiler / radiator / water-heater) from its resolved placement + kind/shape +
 * catalogue extras. The caller layers its derived `connectors` on top:
 *
 *   const base = assembleMepApplianceBodyParams(kind, shape, placement, units, extras);
 *   return { ...base, connectors: buildBoilerConnectors(base) };
 */
export function assembleMepApplianceBodyParams<TKind extends string, TShape extends string>(
  kind: TKind,
  shape: TShape,
  placement: ResolvedBodyPlacement,
  sceneUnits: SceneUnits,
  extras: MepApplianceBodyExtras,
): {
  readonly kind: TKind;
  readonly shape: TShape;
  readonly position: Point3D;
  readonly rotation: number;
  readonly width: number;
  readonly length: number;
  readonly bodyHeightMm: number;
  readonly mountingElevationMm: number;
  readonly connectorDiameterMm: number;
  readonly sceneUnits: SceneUnits;
  readonly thermalOutputW?: number;
  readonly tankCapacityL?: number;
  readonly material?: string;
} {
  return {
    kind,
    shape,
    position: placement.position,
    rotation: placement.rotation,
    width: placement.width,
    length: placement.length,
    bodyHeightMm: placement.bodyHeightMm,
    mountingElevationMm: placement.mountingElevationMm,
    connectorDiameterMm: extras.connectorDiameterMm,
    sceneUnits,
    ...(extras.thermalOutputW !== undefined ? { thermalOutputW: extras.thermalOutputW } : {}),
    ...(extras.tankCapacityL !== undefined ? { tankCapacityL: extras.tankCapacityL } : {}),
    ...(extras.material !== undefined ? { material: extras.material } : {}),
  };
}
