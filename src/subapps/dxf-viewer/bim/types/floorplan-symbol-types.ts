/**
 * BIM Floorplan Symbol — Type Schema (ADR-415 Φ1, vertical slice).
 *
 * First **pure-vector 2D** BIM element: a parametric architectural plan symbol
 * (Revit/ArchiCAD "family symbol" or AutoCAD block) drawn from straight lines and
 * arcs — NOT a projected 3D mesh (cf. ADR-410/411 mesh furniture). The opening
 * slice ships the **WC** (`category: 'sanitary'`, `kind: 'wc'`), but the entity is
 * deliberately **category-driven** (Revit-faithful): ONE family engine
 * (`type: 'floorplan-symbol'`) + a `category` that drives discipline (ADR-405),
 * IFC class, BimCategory and the default symbol drawer.
 *
 * Unlike `furniture` (hard-wired `interior` + `IfcFurniture`), a floorplan symbol
 * resolves its discipline/IFC class from `category` via
 * `floorplan-symbol-categories.ts` — so a WC is a Plumbing Fixture
 * (`IfcSanitaryTerminal`), never a piece of furniture.
 *
 * Pattern mirrors `furniture-types.ts` / `mep-fixture-types.ts`: kind + params +
 * geometry cache. All scalar geometry stored in mm.
 *
 * SSoT:
 *   - `FloorplanSymbolParams.position` + `rotationDeg` + `widthMm`/`depthMm` define
 *     the 2D footprint polygon (computed by `computeFloorplanSymbolGeometry`).
 *   - `FloorplanSymbolParams.category` resolves discipline/IFC/BimCategory.
 *   - `FloorplanSymbolGeometry` cache is re-derivable from params (corruption-safe).
 *
 * Placement (ADR-415): **free-point on the floor plan** — pure annotation-grade
 * 2D symbol (no 3D extrusion in Φ1).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-415-2d-floorplan-symbol-library.md
 */

import type {
  BimEntity,
  BoundingBox3D,
  Polygon3D,
  Point3D,
} from './bim-base';
import type { SceneUnits } from '../../utils/scene-units';
import type { IfcEntityMixin, IfcEntityType } from './ifc-entity-mixin';

// ─── Category discriminator (Revit-faithful, ADR-415 Δ2) ──────────────────────

/**
 * Floorplan symbol category — the Revit "family category" that drives discipline,
 * IFC class, BimCategory and the symbol palette. Each category has a config in
 * `floorplan-symbol-categories.ts` (keep the category → config Record total).
 *   - `sanitary` → Plumbing Fixtures (IfcSanitaryTerminal)
 *   - `kitchen`  → Casework (IfcFurniture, architectural)
 *   - `furniture`→ Furniture (IfcFurniture, interior)
 */
export type FloorplanSymbolCategory = 'sanitary' | 'kitchen' | 'furniture';

// ─── Sub-type discriminator (kind within a category) ──────────────────────────

/**
 * Floorplan symbol kind. Each kind maps 1:1 to a pure-vector drawer in
 * `floorplan-symbol-symbol.ts` (the drawer registry is total over this union).
 */
export type FloorplanSymbolKind =
  // sanitary
  | 'wc'
  | 'washbasin'
  | 'shower'
  | 'bathtub'
  | 'bidet'
  // kitchen
  | 'kitchen-sink'
  | 'stove'
  | 'fridge'
  | 'counter'
  // furniture (pure 2D footprints)
  | 'bed-single'
  | 'bed-double'
  | 'sofa'
  | 'armchair'
  | 'dining-table'
  | 'chair'
  | 'desk';

// ─── Parameters (user-editable SSoT) ──────────────────────────────────────────

export interface FloorplanSymbolParams {
  /** Revit-faithful category — drives discipline/IFC/BimCategory/symbol. */
  readonly category: FloorplanSymbolCategory;
  readonly kind: FloorplanSymbolKind;
  /** Catalog preset id (FK → `floorplan-symbol-catalog.ts`). */
  readonly assetId: string;
  /** Insertion point (plan). `z` always 0 — pure 2D symbol. */
  readonly position: Point3D;
  /** Degrees CCW about `position` (plan, about the vertical axis). */
  readonly rotationDeg: number;
  /** mm. Footprint width (X before rotation). Authored catalog default. */
  readonly widthMm: number;
  /** mm. Footprint depth (Y before rotation). Authored catalog default. */
  readonly depthMm: number;
  /**
   * DXF canvas coordinate unit. Stored so `computeFloorplanSymbolGeometry` can
   * convert mm scalars → canvas units for the 2D footprint. Defaults to `'mm'`.
   */
  readonly sceneUnits?: SceneUnits;
  /** FK → Floor.id (storey reference). Semantic alias for entity-level floorId. */
  readonly storeyId?: string;
  /**
   * ADR-415 deferred hook — host element FK (wall/slab) for future hosted
   * placement (Revit "Host"). Unused in the free-point slice; reserved so the
   * hosted-cascade sub-step is non-breaking.
   */
  readonly hostId?: string;
}

// ─── Geometry cache (derivable from params; SSoT = params) ───────────────────

/**
 * Computed floorplan-symbol geometry. Returned by
 * `computeFloorplanSymbolGeometry(params)` — NEVER mutated by consumers.
 * `area` in m². No `height` — a floorplan symbol is a pure 2D plan annotation.
 */
export interface FloorplanSymbolGeometry {
  /** Polygon3D — horizontal footprint (closed CCW, plan). */
  readonly footprint: Polygon3D;
  readonly bbox: BoundingBox3D;
  /** m². Footprint area. */
  readonly area: number;
}

// ─── Entity (BIM generic instantiation) ──────────────────────────────────────

/**
 * Floorplan symbol BIM entity. Extends `BimEntity` with a `FloorplanSymbolKind`
 * discriminator. `type` is the generic `'floorplan-symbol'` (render-dispatch key);
 * the V/G category + discipline + IFC class are resolved from `params.category`
 * (see `floorplan-symbol-categories.ts`). `ifcType` is category-driven and stored
 * once at creation (Φ1 sanitary → `IfcSanitaryTerminal`).
 */
export interface FloorplanSymbolEntity
  extends BimEntity<FloorplanSymbolKind, FloorplanSymbolParams, FloorplanSymbolGeometry>,
    IfcEntityMixin {
  readonly type: 'floorplan-symbol';
  readonly ifcType: IfcEntityType;
}

// ─── Defaults & constants ──────────────────────────────────────────────────────

/** Default WC footprint (mm) — fallback when the catalog entry omits dims. */
export const DEFAULT_FLOORPLAN_SYMBOL_WIDTH_MM = 380;
export const DEFAULT_FLOORPLAN_SYMBOL_DEPTH_MM = 680;

/** Minimum footprint dimension (mm) — below this is a placement error. */
export const MIN_FLOORPLAN_SYMBOL_DIMENSION_MM = 20;
