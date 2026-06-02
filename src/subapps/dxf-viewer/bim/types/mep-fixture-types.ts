/**
 * BIM MEP Fixture — Type Schema (ADR-406, Step 3 vertical slice).
 *
 * First MEP element built on the ADR-405 discipline foundation: a **point-based
 * fixture** (Revit/ArchiCAD "family placement"). The opening slice ships the
 * **light fixture** (`kind: 'light-fixture'`, discipline `electrical`), but the
 * type is intentionally generic (`type: 'mep-fixture'` + `kind` discriminator)
 * so air terminals / sprinklers / sockets extend it without a new EntityType.
 *
 * Pattern mirrors `column-types.ts`: kind + params + geometry cache + validation.
 * All scalar geometry stored in mm (same convention as column/wall §5.0).
 *
 * SSoT:
 *   - `MepFixtureParams.position` + `rotation` + `shape`/`width`/`length` define
 *     the 2D footprint polygon (computed by `computeMepFixtureGeometry`).
 *   - `MepFixtureGeometry` cache is re-derivable from params (corruption-safe).
 *
 * Placement (ADR-406): **free-point with ceiling-relative elevation** — the
 * fixture sits at `mountingElevationMm` above the storey FFL (not on the floor).
 * Host-attach cascade (follow/detach a ceiling/slab) is a deferred sub-step; the
 * `hostId` hook below reserves the field for it (non-breaking).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-406-point-based-mep-fixture.md
 */

import type {
  BimEntity,
  BoundingBox3D,
  Point3D,
  Polygon3D,
} from './bim-base';
import type { SceneUnits } from '../../utils/scene-units';
import type { IfcEntityMixin } from './ifc-entity-mixin';
import type { MepConnectorHostParams } from './mep-component-types';

// ─── Sub-type discriminator (ADR-406) ────────────────────────────────────────

/**
 * MEP fixture kind discriminator. The opening slice ships `'light-fixture'`;
 * future MEP families append here (e.g. `'air-terminal'`, `'sprinkler'`). Each
 * kind maps 1:1 to a `BimCategory` of the same string (see `fixtureCategory`).
 */
export type MepFixtureKind = 'light-fixture';

/**
 * 2D/3D footprint shape of the fixture body.
 *   - `rectangular` → uses `width` × `length` (e.g. 600×600 recessed panel).
 *   - `circular`    → uses `width` as diameter (`length` & `rotation` ignored;
 *     e.g. round downlight).
 */
export type MepFixtureShape = 'rectangular' | 'circular';

// ─── Parameters (user-editable SSoT) ─────────────────────────────────────────

export interface MepFixtureParams extends MepConnectorHostParams {
  readonly kind: MepFixtureKind;
  readonly shape: MepFixtureShape;
  /** Insertion point (plan). `z` is derived from `mountingElevationMm`. */
  readonly position: Point3D;
  /** Degrees CCW about `position` (plan). Ignored when `shape === 'circular'`. */
  readonly rotation: number;
  /** mm. Rectangular → footprint width; circular → diameter. */
  readonly width: number;
  /** mm. Rectangular → footprint length. Ignored when circular. */
  readonly length: number;
  /** mm. Thickness of the fixture body (thin solid in 3D). */
  readonly bodyHeightMm: number;
  /**
   * mm. Mounting elevation above the storey FFL (ceiling-relative). The 3D solid
   * is placed with its top face at this elevation (Revit work-plane placement).
   */
  readonly mountingElevationMm: number;
  /**
   * DXF canvas coordinate unit. Stored so `computeMepFixtureGeometry` can convert
   * mm scalars → canvas units for the 2D footprint. Defaults to `'mm'` when absent.
   */
  readonly sceneUnits?: SceneUnits;
  /** FK → Floor.id (storey reference). Semantic alias for entity-level floorId. */
  readonly storeyId?: string;
  /** Optional fixture catalog / lamp-type id (Phase 6+). */
  readonly material?: string;
  /**
   * ADR-406 deferred hook — host element FK (ceiling/slab) for future hosted
   * placement (Revit "Host"). Unused in the free-point slice; reserved so the
   * hosted-cascade sub-step is non-breaking.
   */
  readonly hostId?: string;
}

// ─── Geometry cache (derivable from params; SSoT = params) ──────────────────

/**
 * Computed fixture geometry. Returned by `computeMepFixtureGeometry(params)` —
 * NEVER mutated by consumers. `area` in m², `height` (= body thickness) in mm.
 */
export interface MepFixtureGeometry {
  /** Polygon3D — horizontal footprint at the mounting plane. Closed CCW. */
  readonly footprint: Polygon3D;
  readonly bbox: BoundingBox3D;
  /** m². Footprint area. */
  readonly area: number;
  /** mm. Mirror of `params.bodyHeightMm` for downstream convenience. */
  readonly height: number;
}

// ─── Entity (BIM generic instantiation) ─────────────────────────────────────

/**
 * MEP fixture BIM entity. Extends `BimEntity` with a `MepFixtureKind`
 * discriminator. `type` is the generic `'mep-fixture'` (render-dispatch key);
 * the V/G category is derived from `kind` via `fixtureCategory`.
 */
export interface MepFixtureEntity
  extends BimEntity<MepFixtureKind, MepFixtureParams, MepFixtureGeometry>,
    IfcEntityMixin {
  readonly type: 'mep-fixture';
  /** IFC4 class — `IfcLightFixture` for the light-fixture kind. */
  readonly ifcType: 'IfcLightFixture';
}

// ─── Defaults & constants ────────────────────────────────────────────────────

/** Default rectangular fixture footprint (mm). 600×600 recessed panel — industry standard. */
export const DEFAULT_FIXTURE_WIDTH_MM = 600;
export const DEFAULT_FIXTURE_LENGTH_MM = 600;

/** Default circular fixture diameter (mm) — typical downlight. */
export const DEFAULT_FIXTURE_DIAMETER_MM = 200;

/** Default fixture body thickness (mm). */
export const DEFAULT_FIXTURE_BODY_HEIGHT_MM = 80;

/** Default mounting elevation above FFL (mm) — typical suspended-ceiling height. */
export const DEFAULT_FIXTURE_MOUNTING_ELEVATION_MM = 2700;

/** Minimum fixture footprint dimension (mm) — below this is a placement error. */
export const MIN_FIXTURE_DIMENSION_MM = 20;
