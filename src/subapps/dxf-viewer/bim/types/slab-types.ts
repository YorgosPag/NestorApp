/**
 * BIM Slab — Type Schema (ADR-363 §5.5 + ADR-369 §9 Q7 + Q8, Phase A4).
 *
 * Concrete `SlabParams` + `SlabGeometry` + `SlabEntity`. 5 kinds (floor /
 * ceiling / roof / ground / foundation), πολυγωνικό outline (closed CCW).
 *
 * ADR-369 §2.1 canonical convention (Post-ADR-369):
 *   - `levelElevation` = **top face** (FFL) σε mm από project origin.
 *     Slab hangs DOWN by `thickness`. (Revit-compatible.)
 *   - `heightOffsetFromLevel?` = mm (default 0) — raise/drop top-face από FFL.
 *   - Geometry: top = levelElevation + heightOffsetFromLevel
 *              bottom = top - thickness
 *
 * ADR-369 §9 Q7 geometry types (Phase 1 subset shipped — mesh deferred):
 *   - `geometryType: 'box'`    → επίπεδη πλάκα (default, BoxGeometry path)
 *   - `geometryType: 'tilted'` → κεκλιμένη με `slope` (drainage 2%, ράμπες)
 *   - `mesh` (Phase 2) → reserved field, not implemented in A4.
 *
 * ADR-369 §9 Q8 IFC4 readiness:
 *   - SlabEntity extends IfcEntityMixin. ifcType='IfcSlab' πάντα.
 *   - PredefinedType inference: FLOOR / ROOF / LANDING / BASESLAB
 *     (ifcPredefinedType σε pset, Phase B writer).
 *
 * Storey linkage: `floorId` (BaseEntity) είναι το FK προς όροφο.
 * Slabs δεν χρειάζονται baseBinding/topBinding enums (ADR-369 §828 — top-face
 * semantic σε FFL αρκεί). Sloped slabs καλύπτονται με `geometryType='tilted'`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5
 * @see docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md §2.1, §9 Q7, §9 Q8
 */

import type {
  BimEntity,
  BoundingBox3D,
  Polygon3D,
} from './bim-base';
import type { SceneUnits } from '../../utils/scene-units';
import type { IfcEntityMixin } from './ifc-entity-mixin';
import type { EnvelopeLayer } from './thermal-envelope-types';
import type { SlabDna } from './slab-dna-types';

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

// ─── ADR-369 §9 Q7 — Geometry type discriminator (Phase 1 subset) ────────────

/**
 * Slab geometry rendering path (ADR-369 §9 Q7). Phase 1 ships `box` + `tilted`;
 * `mesh` reserved για Phase 2 (full sub-element editor).
 */
export type SlabGeometryType = 'box' | 'tilted';

/**
 * Slope descriptor — present όταν `geometryType === 'tilted'`. Single-plane
 * inclination γύρω από `pivotEdge` (default 'center').
 *
 *   - `direction` σε μοίρες CCW from +X (0=East, 90=North).
 *   - `angle` σε ποσοστό (%) — 2% drainage standard για roofs.
 *   - `pivotEdge` — άκρη γύρω από την οποία γέρνει η πλάκα.
 */
export interface SlabSlope {
  readonly direction: number;
  readonly angle: number;
  readonly pivotEdge?: 'N' | 'S' | 'E' | 'W' | 'center';
}

// ─── Parameters (user-editable, SSoT for geometry derivation) ────────────────

/**
 * Slab parameters. All linear measurements σε mm (Nestor convention).
 *
 *   - `outline` — closed polygon (CCW), world coords mm. Min 3 vertices.
 *   - `levelElevation` — mm, **top face** z από project origin (FFL). Slab
 *     hangs DOWN by `thickness`. ADR-369 §2.1 canonical convention.
 *   - `heightOffsetFromLevel?` — mm (default 0) — raise/drop top-face από FFL.
 *   - `thickness` — mm, default 200 (DEFAULT_SLAB_THICKNESS_MM).
 *   - `geometryType` — 'box' (default) | 'tilted'. ADR-369 §9 Q7 Phase 1.
 *   - `slope?` — required όταν geometryType='tilted', forbidden αλλιώς
 *     (validator/Zod-enforced).
 *   - `slabOpeningIds` — Phase 3.5 (lift shaft, stair well, duct, chimney).
 *   - `reinforcement` — structural hint (Phase 6 BOQ + Phase 3.5 hatch).
 *   - `material` — material library ID (Phase 6+).
 */
export interface SlabParams {
  readonly kind: SlabKind;
  /** Closed polygon (CCW). World coords σε mm. Min MIN_POLYGON_VERTICES (3). */
  readonly outline: Polygon3D;
  /** mm. Top face z από project origin (FFL). ADR-369 §2.1 canonical. */
  readonly levelElevation: number;
  /** mm. Optional offset από FFL (default 0). Raises/drops top-face. */
  readonly heightOffsetFromLevel?: number;
  /** mm. Πάχος πλάκας (default DEFAULT_SLAB_THICKNESS_MM = 200). */
  readonly thickness: number;
  /** ADR-369 §9 Q7. 'box' (default) | 'tilted'. */
  readonly geometryType: SlabGeometryType;
  /** Required ΟΤΑΝ geometryType='tilted'. Forbidden αλλιώς. */
  readonly slope?: SlabSlope;
  /** Phase 3.5 — foreign keys προς `slab-opening` entities. */
  readonly slabOpeningIds?: readonly string[];
  /** Structural reinforcement hint. */
  readonly reinforcement?: SlabReinforcement;
  /** Material library ID (Phase 6+). */
  readonly material?: string;
  /**
   * Composite layered build-up (top→bottom). Revit "Floor → Edit Type →
   * Structure", IFC `IfcMaterialLayerSet`. Optional/non-breaking — legacy
   * single-material slabs leave it absent. When present, `thickness` is
   * derived from `dna.totalThickness` (SSoT, no double-entry — mirrors
   * `WallParams.thickness`). Usually supplied by the slab family-type and
   * re-resolved into the instance ("type always wins").
   * @see bim/types/slab-dna-types.ts
   */
  readonly dna?: SlabDna;
  /**
   * DXF canvas coordinate unit. Always stored so `computeSlabGeometry` can
   * convert canvas-unit² polygon areas → m² for BOQ.
   * Defaults to 'mm' when absent (legacy Firestore docs).
   */
  readonly sceneUnits?: SceneUnits;
  // ─── ADR-369 Phase 0.4 + A.1 — Storey linkage ────────────────────────────
  /** FK → Floor.id (storey reference). Semantic alias for entity-level floorId. */
  readonly storeyId?: string;
  /** mm. Top face offset από storey reference elevation. Default 0 = FFL @ storey level. */
  readonly offsetFromStorey?: number;
  /**
   * ADR-396 Phase P2 — External thermal envelope (ETICS) flat layer.
   * Zone Z2 (οροφή πιλοτής / soffit, κάτω παρειά εκτεθειμένης πλάκας) ή
   * Z3 (δώμα / top, επάνω παρειά). Η ζώνη καθορίζεται στο `EnvelopeLayer.zone`.
   * Optional/non-breaking. Set by the P6 auto-apply command.
   * `thickness_m` σε ΜΕΤΡΑ (SSoT unit), όχι mm.
   */
  readonly envelopeLayer?: EnvelopeLayer;
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
 * Slab BIM entity. Extends `BimEntity` με `kind: SlabKind` discriminator + IFC mixin.
 * Phase 3 — δεν περιέχει slab-openings (ξεχωριστή οντότητα Phase 3.5).
 */
export interface SlabEntity
  extends BimEntity<SlabKind, SlabParams, SlabGeometry>,
    IfcEntityMixin {
  readonly type: 'slab';
  /** ADR-369 §9 Q8 — IFC4 class. Always 'IfcSlab'. */
  readonly ifcType: 'IfcSlab';
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

/** ADR-369 §9 Q7 — Default geometry type για νέες πλάκες. */
export const DEFAULT_SLAB_GEOMETRY_TYPE: SlabGeometryType = 'box';

/**
 * Default top-face elevation (mm) ανά kind. ADR-369 §2.1 canonical
 * convention: `levelElevation` = top face (FFL). Slab hangs DOWN by thickness.
 *
 *   - floor:      0    → top=0,    bottom=-200 (FFL @ 0, 200mm slab)
 *   - ground:     0    → top=0,    bottom=-200 (ground FFL)
 *   - foundation: 0    → top=0,    bottom=-500 (500mm thick under FFL)
 *   - ceiling:    3000 → top=3000, bottom=2800 (storey 3.00m, slab 200mm)
 *   - roof:       3000 → top=3000, bottom=2800
 */
export const SLAB_KIND_DEFAULT_LEVEL_ELEVATION_MM: Readonly<Record<SlabKind, number>> = {
  'floor':       0,
  'ground':      0,
  'foundation':  0,
  'ceiling':     3000,
  'roof':        3000,
};
