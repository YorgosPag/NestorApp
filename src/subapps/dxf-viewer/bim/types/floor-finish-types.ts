/**
 * BIM Floor Finish — Type Schema (ADR-419).
 *
 * `FloorFinishEntity` — λεπτό covering (10–50mm) πάνω στην πλάκα, ένα ανά
 * δωμάτιο. Revit: `IfcCovering FLOORING` (ξεχωριστό από structural slab).
 *
 * Αρχιτεκτονική απόφαση: `SlabEntity` αναλλοίωτο — floor-finish είναι
 * ξεχωριστό entity με δικό του polygon footprint, υλικό, hatch, BOQ, θερμική
 * συμβολή. «Ένα ανά δωμάτιο» = ένα polygon per room (Revit pattern).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-419-floor-finish-per-room.md
 */

import type { BimEntity, BoundingBox3D, Polygon3D } from './bim-base';
import type { SceneUnits } from '../../utils/scene-units';
import type { IfcEntityMixin } from './ifc-entity-mixin';
import { polygonArea, polygonPerimeter, polygonBbox } from '../geometry/shared/polygon-utils';

// ─── Material ID ──────────────────────────────────────────────────────────────

/** Stable IDs for built-in floor finish materials (catalog SSoT). */
export type FloorFinishMaterialId =
  | 'floor-wood-oak'
  | 'floor-wood-pine'
  | 'floor-tile-ceramic'
  | 'floor-tile-marble'
  | 'floor-laminate'
  | 'floor-parquet'
  | 'floor-epoxy'
  | 'floor-carpet';

export const FLOOR_FINISH_MATERIAL_IDS: readonly FloorFinishMaterialId[] = [
  'floor-wood-oak',
  'floor-wood-pine',
  'floor-tile-ceramic',
  'floor-tile-marble',
  'floor-laminate',
  'floor-parquet',
  'floor-epoxy',
  'floor-carpet',
] as const;

// ─── Hatch type ───────────────────────────────────────────────────────────────

/** 2D plan hatch style per material family. */
export type FloorFinishHatchType = 'wood' | 'tile' | 'dot' | 'solid';

// ─── Parameters ───────────────────────────────────────────────────────────────

/**
 * Floor finish parameters. All linear measurements σε mm.
 *
 *   - `footprint` — closed polygon (CCW), world coords mm. Min 3 vertices.
 *   - `materialId` — built-in catalog ID (π.χ. 'floor-wood-oak').
 *   - `thicknessMm` — mm, default DEFAULT_FLOOR_FINISH_LAYER_THICKNESS_MM.
 *   - `finishLevel` — mm offset above slab top surface (default 0 = on slab FFL).
 *   - `name?` — user label (π.χ. «Υπνοδωμάτιο - Δρυς»).
 *   - `sceneUnits` — canvas coordinate unit. Defaults to 'mm' (legacy compat).
 *   - `floorId?` — FK → Floor.id (storey reference).
 */
export interface FloorFinishParams {
  readonly footprint: Polygon3D;
  readonly materialId: FloorFinishMaterialId;
  readonly thicknessMm: number;
  readonly finishLevel: number;
  readonly name?: string;
  readonly sceneUnits?: SceneUnits;
  readonly floorId?: string;
  // ─── Εμφάνιση υφής (ADR-419 §texture-appearance) ────────────────────────────
  // Φυσικές διαστάσεις ενός πλακιδίου/σανίδας σε mm (Revit Material Appearance).
  // Undefined → φυσικό μέγεθος υλικού (tileSizeMForMaterialId SSoT).
  /** mm. Φυσικό μήκος πλακιδίου κατά τον άξονα U (world X). */
  readonly tileLengthMm?: number;
  /** mm. Φυσικό πλάτος πλακιδίου κατά τον άξονα V (world −Z). */
  readonly tileWidthMm?: number;
  /** Περιστροφή υφής 90° (swap U↔V) — κατεύθυνση σανίδας ξύλου / αύλακα πλακιδίου. */
  readonly tileRotate90?: boolean;
}

// ─── Geometry cache ───────────────────────────────────────────────────────────

/**
 * Computed floor finish geometry. Returned by `computeFloorFinishGeometry()` —
 * ΠΟΤΕ mutated by consumers. SSoT = params.
 */
export interface FloorFinishGeometry {
  readonly bbox: BoundingBox3D;
  /** m². Εμβαδό polygon (Shoelace). */
  readonly area: number;
  /** m. Περίμετρος polygon. */
  readonly perimeter: number;
}

// ─── Entity ───────────────────────────────────────────────────────────────────

/**
 * Floor finish BIM entity. Thin covering over a structural slab (Revit pattern).
 * IFC: `IfcCovering` `PredefinedType=FLOORING`.
 */
export interface FloorFinishEntity
  extends BimEntity<FloorFinishMaterialId, FloorFinishParams, FloorFinishGeometry>,
    IfcEntityMixin {
  readonly type: 'floor-finish';
  readonly ifcType: 'IfcCovering';
}

// ─── Defaults & constants ─────────────────────────────────────────────────────

/** Default finish thickness (mm). Typical hardwood / laminate. */
export const DEFAULT_FLOOR_FINISH_LAYER_THICKNESS_MM = 15;

/** Default finish level offset above slab (mm). 0 = flush with FFL. */
export const DEFAULT_FLOOR_FINISH_LEVEL_MM = 0;

/** Default material for newly placed floor finishes. */
export const DEFAULT_FLOOR_FINISH_MATERIAL_ID: FloorFinishMaterialId = 'floor-tile-ceramic';

/** Min polygon vertices for a valid floor finish footprint. */
export const MIN_FLOOR_FINISH_VERTICES = 3;

// ─── Geometry derivation ──────────────────────────────────────────────────────

const MM_TO_M = 0.001;

/**
 * Pure geometry derivation. Called by `UpdateFloorFinishParamsCommand` —
 * consumers never call this directly (SSoT = params).
 */
export function computeFloorFinishGeometry(
  params: Pick<FloorFinishParams, 'footprint'>,
): FloorFinishGeometry {
  const verts = params.footprint.vertices;
  if (verts.length < MIN_FLOOR_FINISH_VERTICES) {
    return {
      bbox: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } },
      area: 0,
      perimeter: 0,
    };
  }

  const bbox = polygonBbox(verts);
  const areaMm2 = polygonArea(verts);
  const perimeterMm = polygonPerimeter(verts);

  return {
    bbox,
    area: areaMm2 * MM_TO_M * MM_TO_M,
    perimeter: perimeterMm * MM_TO_M,
  };
}
