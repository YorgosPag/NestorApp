/**
 * BIM Slab-Opening — Type Schema (ADR-363 §5.5 + §11.Q3, Phase 3.7).
 *
 * Ξεχωριστή οντότητα πλακο-διανοίξεων (elevator shaft, stair well, duct,
 * chimney). Διαφορετική από το ίδιο το slab: ζει σαν first-class entity με
 * δικό της Firestore collection, audit trail, και (Phase 3.7+) BOQ feed.
 *
 * Host relation: `params.slabId` foreign key προς υπάρχον `SlabEntity`. Slab
 * delete → orphan warning, όχι cascade (soft-orphan, mirror opening-on-wall).
 *
 * SSoT:
 *   - `SlabOpeningParams.outline` (Polygon3D, world coords mm, CCW) ορίζει
 *     το cutout footprint.
 *   - `SlabOpeningGeometry` cache από `computeSlabOpeningGeometry()` —
 *     re-derivable από params (πάντα).
 *   - Slab `geometry.netArea = area − Σ(slabOpenings[].area)` recomputed
 *     στο `computeSlabGeometry()` Phase 3.7.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5 §11.Q3
 */

import type {
  BimEntity,
  BoundingBox3D,
  Polygon3D,
} from './bim-base';
import type { SceneUnits } from '../../utils/scene-units';

// ─── Sub-type discriminator (ADR-363 §11.Q3) ────────────────────────────────

/**
 * Slab-opening kind discriminator. 4 industry-standard τύποι:
 *   - `shaft`    → φρέαρ ανελκυστήρα (lift)
 *   - `well`     → κλιμακοστάσιο (stair well — opening που στεγάζει σκάλα)
 *   - `duct`     → αεραγωγός / κανάλι Η/Μ
 *   - `chimney`  → καπνοδόχος
 */
export type SlabOpeningKind = 'shaft' | 'well' | 'duct' | 'chimney';

// ─── Parameters (user-editable, SSoT for geometry derivation) ──────────────

/**
 * Slab-opening parameters. Linear measurements σε mm (Nestor convention).
 *
 * Foreign key: `slabId` MUST reference υπάρχον slab στο ίδιο floorplan.
 * Constraint enforcement client-side (validator) + soft-orphan policy: slab
 * delete δεν διαγράφει τις διανοίξεις — orphan warning στο BOQ.
 *
 * `outline` σε world coords mm, CCW closed. Min 3 vertices.
 *
 * Optional fields:
 *   - `elevationOverride` — mm, override του host-slab levelElevation (multi-storey
 *     stack: shaft που τρυπάει 2 slabs μπορεί να καθίσει διαφορετικό z).
 *     Default undefined → χρησιμοποιεί `hostSlab.params.levelElevation` (ADR-369 §2.1).
 *   - `multiStoreyStackGroupId` — bulk-edit στοιβαγμένα openings (Phase 3.7+
 *     "Στοίβαξη σε όλους τους ορόφους" workflow).
 *   - `fireRating` — minutes (60/90/120) για shaft / chimney (Phase 6+ BOQ).
 *   - `material` — material library ID (Phase 6+).
 */
export interface SlabOpeningParams {
  readonly kind: SlabOpeningKind;
  /** Foreign key — host slab id (required). */
  readonly slabId: string;
  /** Closed polygon (CCW). World coords σε mm. Min MIN_SLAB_OPENING_VERTICES (3). */
  readonly outline: Polygon3D;
  /** mm. z override; default = hostSlab.params.levelElevation όταν undefined. ADR-369 §2.1. */
  readonly elevationOverride?: number;
  /** Bulk-edit group id για multi-storey stacked openings. */
  readonly multiStoreyStackGroupId?: string;
  /**
   * ADR-632 — όταν το opening παρήχθη ΑΥΤΟΜΑΤΑ από τον `StairwellOpeningEngine`
   * (τρύπα κλιμακοστασίου πάνω από σκάλα, βάσει ελάχιστου ελεύθερου ύψους),
   * κρατά το FK id της σκάλας-πηγής. Παρόν → derived/managed entity: ο engine
   * το ξαναϋπολογίζει / σβήνει, δεν το πειράζει χειροκίνητα ο χρήστης. Absent →
   * κανονικό χειροκίνητο opening (ως σήμερα). Soft link: delete σκάλας → ο
   * engine καθαρίζει το orphan auto-opening (Phase 4).
   */
  readonly autoStairId?: string;
  /** Minutes fire rating (60 / 90 / 120). */
  readonly fireRating?: 60 | 90 | 120;
  /** Material library ID (Phase 6+). */
  readonly material?: string;
  /**
   * Coordinate units του `outline.vertices` (mirror του `SlabParams.sceneUnits`).
   * Default `'mm'` για back-compat. Όταν host scene δηλώνει m/cm/in/ft, ο
   * builder converts τα mm-baked defaults (width/depth) στις scene units και
   * propagates το πεδίο εδώ ώστε geometry/validator να επιστρέψουν σωστά
   * area/perimeter/min-dim σε mm. Mirror του slab-types §sceneUnits.
   */
  readonly sceneUnits?: SceneUnits;
}

// ─── Geometry cache (derivable from params; SSoT = params) ─────────────────

/**
 * Computed slab-opening geometry. Returned by `computeSlabOpeningGeometry()`
 * — ΠΟΤΕ mutated by consumers. `area` σε m², `perimeter` σε m (BOQ-ready),
 * `polygon` / `bbox` σε mm.
 */
export interface SlabOpeningGeometry {
  /** Polygon3D — re-export του outline (closed, CCW). */
  readonly polygon: Polygon3D;
  readonly bbox: BoundingBox3D;
  /** m². Εμβαδό cutout (αφαιρείται από slab.netArea). */
  readonly area: number;
  /** m. Περίμετρος cutout. */
  readonly perimeter: number;
}

// ─── Entity (BIM generic instantiation) ────────────────────────────────────

/**
 * Slab-opening BIM entity. Extends `BimEntity` (ADR-363 §5.1) με
 * `kind: SlabOpeningKind` discriminator. `params.slabId` ορίζει host-slab
 * σχέση. Bidirectional consistency μέσω `Slab.params.slabOpeningIds` mirror
 * (persistence layer optimistic update — mirror opening-on-wall).
 */
export interface SlabOpeningEntity
  extends BimEntity<SlabOpeningKind, SlabOpeningParams, SlabOpeningGeometry> {
  readonly type: 'slab-opening';
}

// ─── Defaults & constants ──────────────────────────────────────────────────

/** Ελάχιστος αριθμός κορυφών έγκυρου cutout. */
export const MIN_SLAB_OPENING_VERTICES = 3;

/** Ελάχιστο εμβαδό σε mm² (≈ 100 × 100 mm). Phase 3.7 hard error threshold. */
export const MIN_SLAB_OPENING_AREA_MM2 = 10_000;

/** Default rectangular size (mm) per kind. Source: ADR-363 §11.Q3 presets. */
export interface SlabOpeningKindDefaults {
  /** mm — width across X. */
  readonly width: number;
  /** mm — depth across Y. */
  readonly depth: number;
}

export const SLAB_OPENING_DEFAULT_SIZES: Readonly<Record<SlabOpeningKind, SlabOpeningKindDefaults>> = {
  'shaft':   { width: 1500, depth: 1500 },
  'well':    { width: 1200, depth: 3000 },
  'duct':    { width: 400,  depth: 400  },
  'chimney': { width: 600,  depth: 600  },
};

/** Per-kind minimum size (mm) για code-violation warning. */
export const SLAB_OPENING_MIN_DIMENSION_MM: Readonly<Record<SlabOpeningKind, number>> = {
  'shaft':   1100,
  'well':    900,
  'duct':    200,
  'chimney': 300,
};
