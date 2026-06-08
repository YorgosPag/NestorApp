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
import type { BimCategory } from '../../config/bim-object-styles';
import { isSanitaryKind, type SanitaryKind } from '../sanitary/sanitary-symbol-spec';

// ─── Sub-type discriminator (ADR-406) ────────────────────────────────────────

/**
 * MEP fixture kind discriminator. The opening slice ships `'light-fixture'`;
 * future MEP families append here without a new EntityType. ADR-408 Φ14 adds
 * `'floor-drain'` (σιφώνι/στόμιο δαπέδου αποχέτευσης) PLUS the five sanitary
 * terminals (`wc`/`washbasin`/`shower`/`bathtub`/`bidet`, the {@link SanitaryKind}
 * SSoT) — all Revit "Plumbing Fixtures" (IFC `IfcSanitaryTerminal`) that drain into
 * the sanitary-drainage network via a single drain connector. Each kind maps to a
 * `BimCategory` via {@link resolveFixtureBimCategory} (light → `'light-fixture'`,
 * floor-drain → `'drain-pipe'`, sanitary terminal → `'sanitary'`).
 */
export type MepFixtureKind = 'light-fixture' | 'floor-drain' | SanitaryKind;

/**
 * IFC4 class of a fixture, derived from {@link MepFixtureKind} via the SSoT
 * {@link resolveFixtureIfcType}: a light fixture is `IfcLightFixture`; a floor
 * drain is `IfcSanitaryTerminal` (Revit Plumbing Fixture).
 */
export type MepFixtureIfcType = 'IfcLightFixture' | 'IfcSanitaryTerminal';

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
   * ADR-411 — optional CC0 mesh asset id (FK → `light-fixture-catalog.ts`).
   * When set, the fixture renders as a real glTF mesh in 3D + an automatic
   * top-view silhouette in 2D; when ABSENT it keeps the parametric family-symbol
   * (2D) + extruded solid (3D). Full back-compat for existing fixtures.
   */
  readonly assetId?: string;
  /** ADR-411 — uniform scale multiplier applied to the loaded mesh (default 1). */
  readonly scaleOverride?: number;
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
  /** IFC4 class — derived from `kind` (light → IfcLightFixture, drain → IfcSanitaryTerminal). */
  readonly ifcType: MepFixtureIfcType;
}

// ─── Kind-derived SSoT resolvers (ADR-408 Φ14) ───────────────────────────────

/**
 * SSoT — resolve the IFC4 class for a fixture kind. A light fixture is an
 * `IfcLightFixture`; a floor drain is an `IfcSanitaryTerminal` (Revit Plumbing
 * Fixture). Used by the factory + 3D/IFC serializers so the IFC class is never
 * hard-coded per call-site.
 */
export function resolveFixtureIfcType(kind: MepFixtureKind): MepFixtureIfcType {
  // Every plumbing terminal (floor drain + WC/basin/shower/tub/bidet) is an
  // IfcSanitaryTerminal (differentiated by IFC PredefinedType, not a new class);
  // a light fixture is an IfcLightFixture.
  return kind === 'floor-drain' || isSanitaryKind(kind) ? 'IfcSanitaryTerminal' : 'IfcLightFixture';
}

/**
 * SSoT for a fixture's `BimCategory` — the Visibility/Graphics bucket (ADR-408
 * Φ14). Mirror of `resolveSegmentBimCategory`/`resolveFittingBimCategory`: a
 * `'floor-drain'` shares the `'drain-pipe'` category, so it toggles + hides
 * together with the sanitary-drainage pipes it feeds (Revit "drainage" V/G) and
 * paints brown. A sanitary terminal (WC/basin/…) maps to its OWN `'sanitary'`
 * category — Revit groups Plumbing Fixtures separately from Pipes, so they do NOT
 * vanish with the «Αποχέτευση» pipe toggle (their drain colour still reads as
 * drainage). Every other kind maps to `'light-fixture'`. Consumed by BOTH the 2D
 * renderer and the 3D scene sync.
 */
export function resolveFixtureBimCategory(params: MepFixtureParams): BimCategory {
  if (params.kind === 'floor-drain') return 'drain-pipe';
  if (isSanitaryKind(params.kind)) return 'sanitary';
  return 'light-fixture';
}

/**
 * SSoT for a fixture's mesh-library Storage category (`bim-mesh-library/<category>/`).
 * Sanitary terminals → `'sanitary'`, every other kind → `'light-fixture'`. Consumed
 * by BOTH the 3D converter (mesh load) and the 2D renderer (silhouette lookup), so
 * they never disagree on where an asset's glTF + derived silhouette live.
 */
export function resolveFixtureMeshCategory(kind: MepFixtureKind): string {
  return isSanitaryKind(kind) ? 'sanitary' : 'light-fixture';
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

// ─── Floor-drain defaults (ADR-408 Φ14) ──────────────────────────────────────

/** Default square floor-drain footprint side (mm) — typical 150×150 grating. */
export const DEFAULT_FLOOR_DRAIN_SIZE_MM = 150;

/** Default floor-drain body thickness (mm) — the recessed basin depth. */
export const DEFAULT_FLOOR_DRAIN_BODY_HEIGHT_MM = 100;

/** Floor-drain mounting elevation above FFL (mm) — flush with the floor (0). */
export const FLOOR_DRAIN_MOUNTING_ELEVATION_MM = 0;

/** Default sanitary-drainage outlet connector diameter (mm) for a floor drain. */
export const DEFAULT_FLOOR_DRAIN_CONNECTOR_DIAMETER_MM = 50;

// ─── Sanitary terminal defaults (ADR-408 Φ14) ────────────────────────────────

/** Default body height (mm) of a sanitary terminal solid — a representative WC/basin height. */
export const DEFAULT_SANITARY_BODY_HEIGHT_MM = 400;

/** Sanitary terminal mounting elevation above FFL (mm) — floor-standing (0). */
export const SANITARY_MOUNTING_ELEVATION_MM = 0;
