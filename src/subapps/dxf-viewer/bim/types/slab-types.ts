/**
 * BIM Slab — Type Schema (ADR-363 §5.5, Phase 3).
 *
 * Concrete `SlabParams` + `SlabGeometry` + `SlabEntity` αντικαθιστούν το
 * Phase 0 stub στο `types/entities.ts`.
 *
 * 5 kinds (floor / ceiling / roof / ground / foundation), πολυγωνικό outline
 * (closed CCW), elevation σε mm από project origin, thickness mm.
 *
 * SSoT:
 *   - `SlabParams.outline` (Polygon3D, CCW closed) ορίζει το footprint.
 *   - `SlabGeometry` cache από `computeSlabGeometry()` — re-derivable από params.
 *   - `slabOpeningIds` Phase 3.5 (ξεχωριστή οντότητα slab-opening, §11.Q3).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5
 */

import type {
  BimEntity,
  BoundingBox3D,
  Polygon3D,
} from './bim-base';
import type { SceneUnits } from '../../utils/scene-units';

// ─── Sub-type discriminator (ADR-363 §5.5) ───────────────────────────────────

/** Slab kind discriminator. 5 industry-standard τύποι πλάκας. */
export type SlabKind =
  | 'floor'
  | 'ceiling'
  | 'roof'
  | 'ground'
  | 'foundation';

/** Structural reinforcement hint — drives BOQ + dashed-line rendering Phase 3.5. */
export type SlabReinforcement = 'one-way' | 'two-way' | 'waffle' | 'flat';

// ─── Parameters (user-editable, SSoT for geometry derivation) ────────────────

/**
 * Slab parameters. All linear measurements σε mm (Nestor convention).
 *
 *   - `outline` — closed polygon (CCW), world coords mm. Min 3 vertices.
  *   - `elevation` — mm, bottom surface z from project origin. 3D extrudes upward by thickness.
 *   - `thickness` — mm, default 200 (DEFAULT_SLAB_THICKNESS_MM).
 *   - `slabOpeningIds` — Phase 3.5 (lift shaft, stair well, duct, chimney).
 *   - `reinforcement` — structural hint (Phase 6 BOQ + Phase 3.5 hatch).
 *   - `material` — material library ID (Phase 6+).
 */
export interface SlabParams {
  readonly kind: SlabKind;
  /** Closed polygon (CCW). World coords σε mm. Min MIN_POLYGON_VERTICES (3). */
  readonly outline: Polygon3D;
  /** mm. Bottom surface z from project origin. floor:0, ceiling:2800, roof:3000. 3D extrudes upward. */
  readonly elevation: number;
  /** mm. Πάχος πλάκας (default DEFAULT_SLAB_THICKNESS_MM = 200). */
  readonly thickness: number;
  /** Phase 3.5 — foreign keys προς `slab-opening` entities (lift / stair / duct / chimney). */
  readonly slabOpeningIds?: readonly string[];
  /** Structural reinforcement hint. */
  readonly reinforcement?: SlabReinforcement;
  /** Material library ID (Phase 6+). */
  readonly material?: string;
  /**
   * DXF canvas coordinate unit. Always stored so `computeSlabGeometry` can
   * convert canvas-unit² polygon areas → m² for BOQ.
   * Defaults to 'mm' when absent (legacy Firestore docs).
   */
  readonly sceneUnits?: SceneUnits;
}

// ─── Geometry cache (derivable from params; SSoT = params) ──────────────────

/**
 * Computed slab geometry. Returned by `computeSlabGeometry(params)` —
 * ΠΟΤΕ mutated by consumers. `area` / `netArea` σε m², `volume` σε m³,
 * `perimeter` σε m (BOQ-ready).
 *
 * Phase 3: `netArea === area` (slab-openings subtraction lands Phase 3.5).
 */
export interface SlabGeometry {
  /** Polygon3D — re-export του outline (closed, CCW). */
  readonly polygon: Polygon3D;
  readonly bbox: BoundingBox3D;
  /** m². Ακαθάριστο εμβαδό περιγράμματος. */
  readonly area: number;
  /** m². area μείον slab-openings (Phase 3: == area). */
  readonly netArea: number;
  /** m³. netArea × thickness / 1000. */
  readonly volume: number;
  /** m. Περίμετρος πολυγώνου. */
  readonly perimeter: number;
  /**
   * m. Estimated structural free span (analytical when supporting elements
   * provided to `computeSlabGeometry`; fallback = min(bbox.w, bbox.h) when no
   * supports available). Phase 3.8.
   */
  readonly maxFreeSpanM: number;
}

// ─── Entity (BIM generic instantiation) ─────────────────────────────────────

/**
 * Slab BIM entity. Extends `BimEntity` με `kind: SlabKind` discriminator.
 * Phase 3 — δεν περιέχει slab-openings (ξεχωριστή οντότητα Phase 3.5).
 */
export interface SlabEntity
  extends BimEntity<SlabKind, SlabParams, SlabGeometry> {
  readonly type: 'slab';
}

// ─── Defaults & constants ────────────────────────────────────────────────────

/** Ελάχιστο πάχος πλάκας (mm). Phase 3 code violation threshold. */
export const MIN_SLAB_THICKNESS_MM = 100;

/** Default πάχος πλάκας (mm). Eurocode typical 200mm RC. */
export const DEFAULT_SLAB_THICKNESS_MM = 200;

/** Max free span warning threshold (m). Πλάκα bbox dimension > 5m → flag. */
export const MAX_FREE_SPAN_WARNING_M = 5;

/** Ελάχιστος αριθμός κορυφών για έγκυρο πολύγωνο. */
export const MIN_POLYGON_VERTICES = 3;

/** Default bottom-surface elevation (mm) ανά kind. 3D extrusion goes upward by thickness. */
export const SLAB_KIND_DEFAULT_ELEVATION_MM: Readonly<Record<SlabKind, number>> = {
  'floor':       0,
  'ground':      0,
  'foundation': -500,
  'ceiling':     2800,
  'roof':        3000,
};
