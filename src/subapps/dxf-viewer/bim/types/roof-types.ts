/**
 * BIM Roof — Type Schema (ADR-417, Φ1 vertical slice).
 *
 * Νέο **παραμετρικό** δομικό στοιχείο «Στέγη» (πραγματική κεκλιμένη στέγη), πέρα
 * από την υπάρχουσα επίπεδη `slab kind='roof'` (δώμα). Μοντέλο Revit «Roof by
 * Footprint»: ΕΝΑ περίγραμμα (footprint) + **κλίση ανά ακμή** (`definesSlope`
 * flag + γωνία + overhang). Από το ίδιο footprint προκύπτουν flat / mono-pitch /
 * gable ανάλογα ποιες ακμές είναι slope-defining (Φ2: hip).
 *
 * Architecture (ADR-417 Q1): **FOOTPRINT ⊥ TYPE** — όπως ο railing (PATH ⊥ TYPE).
 * Το footprint+edges λένε *πού/πώς κλίνει*, ο `RoofType` (family type, ADR-412)
 * λέει *από τι αποτελείται* (στρώσεις/DNA). Η γεωμετρία είναι **derived** από
 * την pure SSoT μηχανή `computeRoofGeometry(params)` — persist-άρουμε τη συνταγή
 * (`RoofParams`), ΠΟΤΕ το solid. Πρότυπο μηχανής: `computeRailingGeometry`.
 *
 * Συντεταγμένες (mirror slab/railing): το `outline` xy ζει σε **canvas units**
 * (ίδιος χώρος με το user click)· κλίσεις/υψόμετρα/πάχη σε **mm**. Η μετατροπή σε
 * m² για BOQ γίνεται μέσα στη μηχανή (`sceneUnits`).
 *
 * IFC: εξάγεται ως `IfcRoof` container (Φ-export) — η γεωμετρία = κεκλιμένα
 * `IfcSlab` planes. PredefinedType (FLAT/SHED/GABLE/HIP) = derived `shape`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md
 * @see bim/types/slab-types.ts        — το πλησιέστερο πρότυπο (footprint+DNA+slope)
 * @see bim/geometry/railing-geometry.ts — το πρότυπο pure SSoT μηχανής
 */

import type {
  BimEntity,
  BoundingBox3D,
  Point3D,
  Polygon3D,
} from './bim-base';
import type { SceneUnits } from '../../utils/scene-units';
import type { IfcEntityMixin } from './ifc-entity-mixin';
import type { SlabDna } from './slab-dna-types';
import type { RoofTypeParams } from './bim-family-type';

// ─── Sub-type discriminator (ADR-417) ────────────────────────────────────────

/**
 * Roof kind discriminator (= `BimCategory` 'roof'). Φ1 ships το ενιαίο
 * `'roof'`· η μορφή (flat/mono/gable/hip) ΔΕΝ είναι kind — είναι **derived**
 * από τη διάταξη των slope-defining ακμών (Revit: ένα footprint → πολλές
 * μορφές). Το IFC `PredefinedType` ζει στο derived `shape`, όχι εδώ.
 */
export type RoofKind = 'roof';

/**
 * Μονάδα κλίσης που ερμηνεύει τα `RoofEdgeSlope.slope` (ADR-417 Q5). Εναλλάξιμη
 * στο UI (όπως ArchiCAD): 'deg' = μοίρες (0–90), 'percent' = ποσοστό ανύψωσης
 * (rise/run × 100). Η μηχανή τα ανάγει σε εσωτερικό λόγο `rise/run`.
 */
export type RoofSlopeUnit = 'deg' | 'percent';

/**
 * Παραγόμενη ταξινόμηση μορφής στέγης (Revit / `IfcRoofTypeEnum`). Φ1 παράγει
 * flat / mono-pitch / gable· hip + complex είναι Φ2 (straight-skeleton) — η
 * μηχανή τα γυρίζει graceful flat fallback μέχρι τότε.
 */
export type RoofShape = 'flat' | 'mono-pitch' | 'gable' | 'hip' | 'complex';

// ─── Per-edge slope (Revit «Defines Roof Slope») ─────────────────────────────

/**
 * Ιδιότητες ΜΙΑΣ ακμής του footprint (ακμή i = κορυφή i → i+1, CCW). Revit
 * «Roof by Footprint»: κάθε ακμή μπορεί να ορίζει κλίση ή όχι.
 *
 *   - `definesSlope` — flag «Defines Roof Slope». Όταν `false`, η ακμή είναι
 *     αέτωμα/κατακόρυφο άκρο (gable end) — δεν παράγει κεκλιμένο επίπεδο.
 *   - `slope` — τιμή κλίσης στη μονάδα `RoofParams.slopeUnit` (αγνοείται όταν
 *     `definesSlope === false`). Η ακμή είναι το **γείσο** (eave, χαμηλό σημείο)
 *     και το επίπεδο ανηφορίζει προς το εσωτερικό.
 *   - `overhangMm` — οριζόντια προεξοχή γείσου πέρα από το footprint (mm). Φ1:
 *     αποθηκεύεται (default 0)· η γεωμετρική προεξοχή υλοποιείται Φ3.
 */
export interface RoofEdgeSlope {
  readonly definesSlope: boolean;
  readonly slope: number;
  readonly overhangMm: number;
}

// ─── Parameters (user-editable, SSoT for geometry derivation) ────────────────

/**
 * Roof parameters. Όλες οι γραμμικές μετρήσεις σε mm (Nestor convention) εκτός
 * του `outline` xy (canvas units, ίδιο με slab).
 *
 *   - `outline` — closed polygon (CCW), canvas-unit xy. Min 3 κορυφές.
 *   - `edges` — μία `RoofEdgeSlope` ανά ακμή του `outline` (length == κορυφές).
 *     Καθορίζει ποιες ακμές κλίνουν → άρα τη μορφή.
 *   - `slopeUnit` — 'deg' | 'percent', ερμηνεύει τα `edges[].slope` (Q5).
 *   - `basePivotZ` — mm. Στάθμη γείσου (eaves datum / pivot line, ArchiCAD).
 *     Όλα τα κεκλιμένα επίπεδα ξεκινούν από εδώ και ανηφορίζουν προς τον κορφιά.
 *   - `thickness` — mm. Πάχος στέγης· παράγεται από `dna.totalThickness` όταν
 *     υπάρχει `dna` (SSoT, μηδέν διπλο-καταχώρηση — όπως slab/wall).
 *   - `dna?` — στρωματική σύνθεση (reuse `SlabDna` SSoT). Συνήθως από το RoofType.
 */
export interface RoofParams {
  readonly outline: Polygon3D;
  readonly edges: readonly RoofEdgeSlope[];
  readonly slopeUnit: RoofSlopeUnit;
  /** mm. Στάθμη γείσου (eaves datum). */
  readonly basePivotZ: number;
  /** mm. Πάχος στέγης (== dna.totalThickness όταν υπάρχει dna). */
  readonly thickness: number;
  /** Στρωματική σύνθεση (top→bottom). Undefined = μονολιθική (bare). */
  readonly dna?: SlabDna;
  /** Material library ID (όταν δεν υπάρχει dna). */
  readonly material?: string;
  /**
   * DXF canvas coordinate unit. Πάντα αποθηκευμένο ώστε η μηχανή να μετατρέπει
   * canvas-unit² → m² για BOQ. Default 'mm' (legacy docs).
   */
  readonly sceneUnits?: SceneUnits;
  /** FK → Floor.id (storey reference). Semantic alias του entity-level floorId. */
  readonly storeyId?: string;
  /** mm. Offset της στάθμης γείσου από τη storey reference. Default 0. */
  readonly offsetFromStorey?: number;
}

// ─── Geometry cache (derived; SSoT = params + engine) ────────────────────────

/**
 * Ένα κεκλιμένο επίπεδο στέγης (ένα «νερό»). Planar πολύγωνο με per-vertex z
 * (canvas-unit xy, mm z). Ολόκληρη η όψη ζει σε ΕΝΑ επίπεδο → `slopeRatio` =
 * μέγεθος gradient (rise/run) και `grossAreaM2` = projected / cos(θ).
 */
export interface RoofFace {
  /** Closed outline (canvas-unit xy· z = κεκλιμένο mm απόλυτο). */
  readonly outline: readonly Point3D[];
  /** rise/run μέγεθος (0 = επίπεδο). */
  readonly slopeRatio: number;
  /** m². Προβολή στο έδαφος (footprint share). */
  readonly projectedAreaM2: number;
  /** m². Πραγματικό κεκλιμένο εμβαδό = projected × √(1+slopeRatio²). */
  readonly grossAreaM2: number;
}

/** Γραμμή κορφιά / λουκιού / hip / γείσου (canvas-unit xy, mm z). */
export interface RoofRidgeLine {
  readonly a: Point3D;
  readonly b: Point3D;
  readonly kind: 'ridge' | 'hip' | 'valley' | 'eave';
}

/**
 * Computed roof geometry. Returned by `computeRoofGeometry(params)` — ΠΟΤΕ
 * mutated by consumers. `projectedAreaM2` (κάτοψη) + `grossAreaM2` (κεκλιμένο)
 * τροφοδοτούν το BOQ (ADR-417 Q7: επικάλυψη = GrossArea).
 */
export interface RoofGeometry {
  /** Footprint (closed, CCW) — re-export του outline. */
  readonly footprint: Polygon3D;
  /** Τα κεκλιμένα «νερά» της στέγης (≥1). */
  readonly faces: readonly RoofFace[];
  /** Κορφιάδες / λούκια / hip ακμές (Φ1: ridge για gable). */
  readonly ridges: readonly RoofRidgeLine[];
  readonly bbox: BoundingBox3D;
  /** m². Προβολή στο έδαφος (Qto ProjectedArea). */
  readonly projectedAreaM2: number;
  /** m². Κεκλιμένο/πραγματικό εμβαδό επιφάνειας (Qto GrossArea). */
  readonly grossAreaM2: number;
  /** m. Περίμετρος footprint. */
  readonly perimeterM: number;
  /** m³. grossArea × thickness (κεκλιμένη πλάκα σταθερού πάχους). */
  readonly volumeM3: number;
  /** Παραγόμενη ταξινόμηση μορφής. */
  readonly shape: RoofShape;
  /** mm. Ύψος κορφιά πάνω από `basePivotZ` (0 = flat). */
  readonly ridgeHeightMm: number;
}

// ─── Entity (BIM generic instantiation) ──────────────────────────────────────

/**
 * Roof BIM entity. `type` = dispatch key `'roof'`· η V/G category είναι το ίδιο
 * string `'roof'` → discipline `'architectural'`. IFC4 class = `IfcRoof`
 * (PredefinedType = derived `geometry.shape`).
 */
export interface RoofEntity
  extends BimEntity<RoofKind, RoofParams, RoofGeometry>,
    IfcEntityMixin {
  readonly type: 'roof';
  readonly ifcType: 'IfcRoof';
  /** ADR-412 — FK → BimFamilyType.id (RoofType). Absent on untyped roofs. */
  readonly typeId?: string;
  /** ADR-412 — per-instance overrides of type-level params. */
  readonly typeOverrides?: Partial<RoofTypeParams>;
}

// ─── Defaults & constants ────────────────────────────────────────────────────

/** Ελάχιστος αριθμός κορυφών για έγκυρο footprint. */
export const MIN_ROOF_POLYGON_VERTICES = 3;

/** Default κλίση νέας κεκλιμένης στέγης (μοίρες) — τυπική κεραμοσκεπή ~30°. */
export const DEFAULT_ROOF_SLOPE_DEG = 30;

/** Default στάθμη γείσου (mm) — κορυφή τοίχου ορόφου 3.00m. */
export const DEFAULT_ROOF_BASE_PIVOT_Z_MM = 3000;

/** Default μονάδα κλίσης στο UI. */
export const DEFAULT_ROOF_SLOPE_UNIT: RoofSlopeUnit = 'deg';

/** Ελάχιστο πάχος στέγης (mm) — μονολιθικό fallback χωρίς dna. */
export const DEFAULT_ROOF_THICKNESS_MM = 200;
