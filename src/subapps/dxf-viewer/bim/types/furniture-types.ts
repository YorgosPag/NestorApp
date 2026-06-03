/**
 * BIM Furniture — Type Schema (ADR-410, vertical slice).
 *
 * First **mesh-based** BIM element: a fixed-shape CC0 model (Poly Haven, §D.1 of
 * ADR-409) enriched with our own BIM metadata. The opening slice ships the
 * **chair** (`kind: 'chair'`, discipline `interior`), but the type is generic
 * (`type: 'furniture'` + `kind` discriminator) so sofas/tables/cabinets/beds
 * extend it without a new EntityType.
 *
 * Unlike the parametric elements (wall/column/beam — ADR-409 §D.2), a furniture
 * item does NOT stretch: its 3D form comes from an external glTF mesh
 * (`assetId` → `furniture-library/<assetId>.glb` in Firebase Storage), loaded
 * via `FurnitureGltfCache` (ADR-410 decision 1, Option A). The 2D footprint is
 * authored (`widthMm × depthMm` from the catalog) — it does NOT require the glTF
 * to be loaded.
 *
 * Pattern mirrors `mep-fixture-types.ts`: kind + params + geometry cache. All
 * scalar geometry stored in mm.
 *
 * SSoT:
 *   - `FurnitureParams.position` + `rotationDeg` + `widthMm`/`depthMm` define the
 *     2D footprint polygon (computed by `computeFurnitureGeometry`).
 *   - `FurnitureParams.assetId` resolves the 3D mesh (catalog → Storage URL).
 *   - `FurnitureGeometry` cache is re-derivable from params (corruption-safe).
 *
 * Placement (ADR-410): **free-point on the floor** — the item sits at
 * `mountingElevationMm` above the storey FFL (0 = on the floor).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-410-cc0-mesh-furniture-import.md
 */

import type {
  BimEntity,
  BoundingBox3D,
  Point3D,
  Polygon3D,
} from './bim-base';
import type { SceneUnits } from '../../utils/scene-units';
import type { IfcEntityMixin } from './ifc-entity-mixin';

// ─── Sub-type discriminator (ADR-410) ─────────────────────────────────────────

/**
 * Furniture kind discriminator. The opening slice ships `'chair'`; future
 * families append here (e.g. `'sofa'`, `'table'`, `'cabinet'`, `'bed'`). Each
 * kind maps to the `'furniture'` BimCategory (granular V/G can split later).
 */
export type FurnitureKind = 'chair';

// ─── Parameters (user-editable SSoT) ──────────────────────────────────────────

export interface FurnitureParams {
  readonly kind: FurnitureKind;
  /**
   * Catalog asset id (FK → `furniture-catalog.ts`). Resolves the 3D mesh
   * (`furniture-library/<assetId>.glb`) and the authored footprint defaults.
   */
  readonly assetId: string;
  /** Insertion point (plan). `z` is derived from `mountingElevationMm`. */
  readonly position: Point3D;
  /** Degrees CCW about `position` (plan, about the vertical axis). */
  readonly rotationDeg: number;
  /** mm. Footprint width (X before rotation). Authored catalog default. */
  readonly widthMm: number;
  /** mm. Footprint depth (Y before rotation). Authored catalog default. */
  readonly depthMm: number;
  /** mm. Overall height of the item (bbox Z). Authored catalog default. */
  readonly heightMm: number;
  /**
   * mm. Mounting elevation above the storey FFL. `0` → sits on the floor
   * (default for free-standing furniture). Non-zero → wall/ceiling mounted.
   */
  readonly mountingElevationMm: number;
  /**
   * Uniform scale multiplier applied to the loaded glTF mesh. Default `1`.
   * Lets the user tune a CC0 mesh whose authored size differs from the spec.
   */
  readonly scaleOverride?: number;
  /**
   * DXF canvas coordinate unit. Stored so `computeFurnitureGeometry` can convert
   * mm scalars → canvas units for the 2D footprint. Defaults to `'mm'` when absent.
   */
  readonly sceneUnits?: SceneUnits;
  /** FK → Floor.id (storey reference). Semantic alias for entity-level floorId. */
  readonly storeyId?: string;
  /** Optional material / finish override id (deferred — Phase 2+). */
  readonly material?: string;
  /**
   * ADR-410 deferred hook — host element FK (wall/slab) for future hosted
   * placement (Revit "Host"). Unused in the free-point slice; reserved so the
   * hosted-cascade sub-step is non-breaking.
   */
  readonly hostId?: string;
}

// ─── Geometry cache (derivable from params; SSoT = params) ───────────────────

/**
 * Computed furniture geometry. Returned by `computeFurnitureGeometry(params)` —
 * NEVER mutated by consumers. `area` in m², `height` (= overall height) in mm.
 */
export interface FurnitureGeometry {
  /** Polygon3D — horizontal footprint at the mounting plane. Closed CCW. */
  readonly footprint: Polygon3D;
  readonly bbox: BoundingBox3D;
  /** m². Footprint area. */
  readonly area: number;
  /** mm. Mirror of `params.heightMm` for downstream convenience. */
  readonly height: number;
}

// ─── Entity (BIM generic instantiation) ──────────────────────────────────────

/**
 * Furniture BIM entity. Extends `BimEntity` with a `FurnitureKind` discriminator.
 * `type` is the generic `'furniture'` (render-dispatch key); the V/G category is
 * `'furniture'` (discipline `interior` via `DISCIPLINE_BY_CATEGORY`).
 */
export interface FurnitureEntity
  extends BimEntity<FurnitureKind, FurnitureParams, FurnitureGeometry>,
    IfcEntityMixin {
  readonly type: 'furniture';
  /** IFC4 class — `IfcFurniture` (subtype of IfcFurnishingElement, IFC4 ADD2). */
  readonly ifcType: 'IfcFurniture';
}

// ─── Defaults & constants ──────────────────────────────────────────────────────

/** Default chair footprint (mm) — fallback when the catalog entry omits dims. */
export const DEFAULT_FURNITURE_WIDTH_MM = 500;
export const DEFAULT_FURNITURE_DEPTH_MM = 500;
export const DEFAULT_FURNITURE_HEIGHT_MM = 900;

/** Default mounting elevation above FFL (mm) — free-standing → on the floor. */
export const DEFAULT_FURNITURE_MOUNTING_ELEVATION_MM = 0;

/** Default uniform scale multiplier for a loaded glTF mesh. */
export const DEFAULT_FURNITURE_SCALE = 1;

/** Minimum furniture footprint dimension (mm) — below this is a placement error. */
export const MIN_FURNITURE_DIMENSION_MM = 20;
