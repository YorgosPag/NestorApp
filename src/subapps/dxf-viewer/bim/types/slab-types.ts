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
import type { StructuralFinishSpec } from '../finishes/structural-finish-types';
import type { WallCoveringMaterialId } from './wall-covering-types';
import type { SlabTypeParams } from './bim-family-type';
import type { SlabFoundationReinforcement } from '../structural/reinforcement/slab-foundation-reinforcement-types';
import type { AppliedMemberLoad } from '../structural/loads/structural-loads-types';
import type { ConcreteGrade } from '../structural/concrete-grades';

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

/**
 * ADR-534 Φ4 — **Φινίρισμα παρειάς οροφής** (soffit finish), Revit «Paint on face» / RCP.
 * Non-structural βαφή/επίχρισμα στην ΚΑΤΩ παρειά μιας `kind='ceiling'` πλάκας (ανά φάτνωμα).
 * Αποσυνδεδεμένο από το δομικό `dna`/`thickness` (το soffit finish ΔΕΝ είναι φέρουσα στρώση).
 * `materialId` → **shared paint/plaster catalog SSoT** (`wall-covering-material-catalog`, ΙΔΙΟ
 * με τους τοίχους). Absent ⇒ raw σκυρόδεμα (μηδέν finish).
 */
export interface SoffitFinish {
  readonly materialId: WallCoveringMaterialId;
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
  /**
   * ADR-499 — Είναι η πλάκα σε AUTO διαστασιολόγηση πάχους; default = AUTO
   * (absent/true)· `false` = κλειδωμένη (ο μηχανικός όρισε χειροκίνητα το πάχος →
   * user wins). Mirror του `BeamParams.autoSized`. Πρόβολος-πλάκα: το πάχος αυτο-
   * μεγαλώνει ώστε `M_Ed ≤ M_Rd,lim` + `L/d ≤ όριο` (αντί ψεύτικου Ø25/75 σε 200mm).
   */
  readonly autoSized?: boolean;
  /** ADR-369 §9 Q7. 'box' (default) | 'tilted'. */
  readonly geometryType: SlabGeometryType;
  /** Required ΟΤΑΝ geometryType='tilted'. Forbidden αλλιώς. */
  readonly slope?: SlabSlope;
  /** Phase 3.5 — foreign keys προς `slab-opening` entities. */
  readonly slabOpeningIds?: readonly string[];
  /** Structural reinforcement hint (BOQ/hatch — one-way/two-way/…). */
  readonly reinforcement?: SlabReinforcement;
  /**
   * ADR-459 Φ4e/E3 + ADR-476 — ΠΡΑΓΜΑΤΙΚΟ μοντέλο οπλισμού πλάκας (δι-διευθυντική
   * σχάρα top+bottom). Code-suggested μέσω του οργανισμού (`buildReinforcePatch`),
   * kind-aware: εδαφόπλακα (EC2 §9.8.2) ή αναρτημένη floor/ceiling/roof (EC2 §9.3.1).
   * Διακριτό από το `reinforcement` hint — μηδέν regression στο υπάρχον BOQ.
   */
  readonly structuralReinforcement?: SlabFoundationReinforcement;
  /**
   * ADR-476 — κατηγορία σκυροδέματος πλάκας (π.χ. 'C25/30'), mirror κολόνας. Absent ⇒
   * default code grade. Τροφοδοτεί τα στατικά (f_cd) + το Properties panel.
   */
  readonly concreteGrade?: ConcreteGrade;
  /**
   * ADR-467 — Φορτίο βαρύτητας πλάκας από τη διαδρομή φορτίων (panel area ×
   * επιφανειακά φορτία G/Q). source='takedown' → αυτόματο από οργανισμό· source=
   * 'manual' → χειροκίνητο (προστατευμένο, `isTakedownWritable`). Optional/
   * non-breaking. ΠΟΤΕ derived state — πληροφοριακό / slab design input.
   */
  readonly appliedLoad?: AppliedMemberLoad;
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
  /**
   * ADR-534 Φ4 — Φινίρισμα κάτω παρειάς (soffit) για `kind='ceiling'` πλάκες (ανά φάτνωμα).
   * Non-structural· δείχνει στο shared paint/plaster catalog. Absent ⇒ raw σκυρόδεμα.
   *
   * ⚠️ ADR-534 Φ5 — **ΣΥΝΥΠΑΡΧΕΙ** με το {@link SlabParams.finish}, δεν αντικαθίσταται. Όταν
   * το `finish` είναι ενεργό, το `soffitFinish` **καταστέλλεται** στο render (αλλιώς διπλό
   * δέρμα στην κάτω παρειά) — το πεδίο όμως μένει στο Firestore (μηδέν data loss, μηδέν
   * migration). Άλλο catalog: `soffitFinish` → paint· `finish` → plaster.
   */
  readonly soffitFinish?: SoffitFinish;
  /**
   * ADR-534 Φ5 / ADR-449 — additive σοβάς ως **finish skin** (mirror `WallParams.finish`).
   * Ο σοβάς **ΔΕΝ** μπαίνει στο `thickness` (που ανήκει στον δομικό πυρήνα / `dna`): προεξέχει
   * από τον πυρήνα μέσω της ενιαίας structural-finish σιλουέτας, με δικό υλικό + (ασύμμετρο)
   * πάχος, BOQ-tracked. Absent = legacy πλάκα → δεν γίνεται finish-member (μηδέν migration).
   *
   * ⚠️ **Δεν είναι το `dna`.** Το `dna` = υγρομόνωση/θερμομόνωση/κονία/πλακάκι = *είναι* το
   * πάχος. Ο σοβάς = δέρμα 15/25mm από πάνω του. Βλ. `bim/finishes/slab-finish-source.ts`.
   */
  readonly finish?: StructuralFinishSpec;
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
  /** ADR-412 — FK → BimFamilyType.id. Absent on legacy/untyped slabs. */
  readonly typeId?: string;
  /**
   * ADR-412 — Per-instance overrides of type-level params. Present only when
   * the instance deviates from its type. Merged over type params at resolution
   * time (type params first, overrides win). Absent = use type as-is.
   */
  readonly typeOverrides?: Partial<SlabTypeParams>;
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
