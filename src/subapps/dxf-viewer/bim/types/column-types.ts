/**
 * BIM Column — Type Schema (ADR-363 §5.6, Phase 4 / Phase 8 extension).
 *
 * Concrete `ColumnParams` + `ColumnGeometry` + `ColumnEntity` αντικαθιστούν το
 * Phase 0 stub στο `types/entities.ts`.
 *
 * 7 kinds — single-click placement με 9-position anchor + free rotation:
 *   - rectangular / circular / L-shape / T-shape  (Phase 4)
 *   - polygon / shear-wall / I-shape              (Phase 8 extension)
 *
 * Footprint cached στο `geometry` (SSoT = params), area σε m², volume σε m³.
 *
 * SSoT:
 *   - `ColumnParams.position` + `anchor` (+ rotation/kind/width/depth) ορίζουν
 *     το footprint του πολυγώνου.
 *   - `ColumnGeometry` cache από `computeColumnGeometry()` — re-derivable από
 *     params.
 *
 * Phase 8 design notes:
 *   - shear-wall reuses `width` (length) + `depth` (thickness) — απλό
 *     rectangle με διαφορετικά defaults + relaxed min dimension. Code rules
 *     ζουν στον validator (Eurocode 8 §5.4.2.4 — thickness ≥ 150mm).
 *   - polygon = regular N-gon (3–12 sides). `width` = circumscribed Ø. Sides
 *     από `ColumnPolygonParams.sides`. `depth` ignored.
 *   - I-shape = steel double-T (IPE/HEA family). `width` = flange width (b),
 *     `depth` = section depth (h). Flange + web thickness από
 *     `ColumnIShapeParams`. Defaults match IPE-300 (b=200, h=300).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6
 */

import type {
  BimEntity,
  BoundingBox3D,
  Point3D,
  Polygon3D,
} from './bim-base';
import type { Point2D } from '../../rendering/types/Types';
import type { SceneUnits } from '../../utils/scene-units';
import type { IfcEntityMixin } from './ifc-entity-mixin';
import type { ColumnBaseBinding, ColumnTopBinding } from './bim-binding';
import type { EnvelopeFunction, EnvelopeLayer } from './thermal-envelope-types';
import type { StructuralFinishSpec } from '../finishes/structural-finish-types';
import type { ConcreteGrade } from '../structural/concrete-grades';
import type { ColumnReinforcement } from '../structural/reinforcement/column-reinforcement-types';
import type { AppliedMemberLoad } from '../structural/loads/structural-loads-types';

// ─── Sub-type discriminator (ADR-363 §5.6) ───────────────────────────────────

/** Column kind discriminator. 9 industry-standard τύποι κολώνας. */
export type ColumnKind =
  | 'rectangular'
  | 'circular'
  | 'L-shape'
  | 'T-shape'
  | 'polygon'      // ADR-363 Phase 8 — regular N-gon (3–12 sides)
  | 'shear-wall'   // ADR-363 Phase 8 — μακρόστενη ορθογωνία (τοιχείο ΟΣ, Eurocode 8 §5.4.2.4)
  | 'I-shape'      // ADR-363 Phase 8 — steel double-T (IPE/HEA family)
  | 'U-shape'      // ADR-363 Phase 2 «από περίγραμμα» — Π/κανάλι τοιχείο ΟΣ (polygon-backed)
  | 'composite';   // ADR-363 Phase 2 «από περίγραμμα» — αυθαίρετη σύνθετη διατομή (πολύγωνο)

/**
 * 9-position anchor — ποιο σημείο της διατομής εδράζεται στο `position`.
 *   center | n | s | e | w | nw | ne | sw | se
 */
export type ColumnAnchor =
  | 'center'
  | 'n' | 's' | 'e' | 'w'
  | 'nw' | 'ne' | 'sw' | 'se';

// ─── Variant-specific param blocks ───────────────────────────────────────────

/**
 * L-shape geometry override. Optional — defaults derived ως `width/3` /
 * `depth/3` αν λείπουν (computeColumnGeometry).
 */
export interface ColumnLshapeParams {
  /** mm. Μήκος δευτερεύοντος βραχίονα (Y-axis). */
  readonly armLength?: number;
  /** mm. Πάχος δευτερεύοντος βραχίονα. */
  readonly armWidth?: number;
  /**
   * Arm at top instead of bottom. Set by mirror operations (ADR-363 Phase 7.2).
   * Proof: local mirror transform T[1][1] = -1 for all axisAngle+rotation.
   */
  readonly flipY?: boolean;
  /**
   * ADR-529 Φ5 — id του δοκαριού που **ΠΡΟΗΓΑΓΕ** αυτή την κολόνα σε Γ/L boundary element
   * (`promoteColumnToBoundaryL`). Καθιστά το foot **associative**: όταν ο οργανισμός ξανα-
   * διαστασιολογεί το δοκάρι (`bim:beam-params-updated`), το `armLength` (πάχος ποδιού = πλάτος
   * δοκαριού, EC2/EC8 έδραση ≥ δοκάρι) ξανα-υπολογίζεται αυτόματα ώστε να μη μένει stale snapshot.
   * Ασφαλής εντοπισμός (ΜΟΝΟ προαχθείσες κολόνες· user-drawn L δεν φέρει το πεδίο → δεν αγγίζεται).
   */
  readonly promotedFromBeamId?: string;
}

/**
 * T-shape geometry override. Optional — defaults derived ως `depth/3` αν
 * λείπουν.
 */
export interface ColumnTshapeParams {
  /** mm. Μήκος πέλματος (X-axis flange). */
  readonly flangeLength?: number;
  /** mm. Πάχος κορμού (Y-axis web). */
  readonly webThickness?: number;
  /**
   * mm. Πάχος πέλματος (Y-axis flange depth). ADR-496 Phase 2: ΠΡΙΝ ήταν hard-coded
   * `depth/3` μέσα στο `buildTshapeLocal` — τώρα override-able ώστε το smart-fit
   * (`alignTShapeColumnToFramingBeams`) να το θέτει ίσο με το **πλάτος του συνεχόμενου
   * δοκαριού** (flange = δομική συνέχεια). Absent → fallback `depth/3` (back-compat).
   */
  readonly flangeThickness?: number;
  /**
   * Flange at bottom instead of top. Set by mirror operations (ADR-363 Phase 7.2).
   * Proof: local mirror transform T[1][1] = -1 for all axisAngle+rotation.
   */
  readonly flipY?: boolean;
}

/**
 * Polygon (regular N-gon) geometry override. ADR-363 Phase 8.
 * `width` σε `ColumnParams` παίζει role circumscribed-circle diameter (Ø_circ).
 * `depth` αγνοείται (mirrors circular).
 */
export interface ColumnPolygonParams {
  /** Number of sides. Clamped to [MIN_POLYGON_SIDES, MAX_POLYGON_SIDES]. Default DEFAULT_POLYGON_SIDES (6 = hexagon). */
  readonly sides?: number;
}

/**
 * I-shape (steel double-T) geometry override. ADR-363 Phase 8.
 * `width` σε `ColumnParams` = flange width (b). `depth` = section depth (h).
 * Defaults track IPE-300 typical proportions. Mirror via `flipY` reverses
 * vertex winding (same convention as L/T).
 */
export interface ColumnIShapeParams {
  /** mm. Πάχος πέλματος (tf). Default DEFAULT_I_FLANGE_THICKNESS_MM. */
  readonly flangeThickness?: number;
  /** mm. Πάχος κορμού (tw). Default DEFAULT_I_WEB_THICKNESS_MM. */
  readonly webThickness?: number;
  /**
   * Mirror Y handedness. Set by mirror operations (ADR-363 Phase 7.2).
   * No-op visually για symmetric I (provided for transform-pipeline parity).
   */
  readonly flipY?: boolean;
}

/**
 * U-shape (Π/κανάλι) geometry override. ADR-363 Phase 2 «από περίγραμμα».
 * Polygon-backed (industry-standard, ETABS Section Designer / Revit / Tekla):
 * αν `polygon` υπάρχει, ΕΙΝΑΙ το ακριβές SSoT της διατομής (από-περίγραμμα →
 * διατηρεί πάχη ανά σκέλος, ώστε αργότερα να υπολογίζονται σωστά οι ιδιότητες
 * διατομής — κεντροειδές / ροπές αδράνειας / κέντρο διάτμησης — για τη στατική
 * μελέτη). Αν λείπει, παράγεται παραμετρικό Π σταθερού πάχους από το bbox
 * (`width`×`depth`) — χειροκίνητη δημιουργία.
 */
export interface ColumnUshapeParams {
  /** mm. Πάχος των δύο ποδιών (default `width/4`). Αγνοείται αν `polygon` υπάρχει. */
  readonly legThickness?: number;
  /** mm. Πάχος βάσης (default `depth/3`). Αγνοείται αν `polygon` υπάρχει. */
  readonly baseThickness?: number;
  /**
   * Άνοιγμα προς τα κάτω αντί για πάνω. Set by mirror operations (ADR-363
   * Phase 7.2). y-flip reverses CCW winding (mirror του L/T). Αγνοείται αν
   * `polygon` υπάρχει.
   */
  readonly flipY?: boolean;
  /**
   * Ακριβές πολύγωνο διατομής σε LOCAL συντεταγμένες mm (κεντραρισμένο στο
   * bbox-center, CCW). Αν υπάρχει υπερισχύει του παραμετρικού generator.
   * Συμπληρώνεται από το εργαλείο «Τοιχίο από περίγραμμα» (Φάση 3).
   */
  readonly polygon?: readonly Point2D[];
}

/**
 * Composite (αυθαίρετη σύνθετη διατομή) geometry. ADR-363 Phase 2 «από
 * περίγραμμα». ΠΑΝΤΑ polygon-backed — το `polygon` είναι το ακριβές SSoT
 * (σταυρός / ακανόνιστο τοιχείο ΟΣ). ΠΟΤΕ αυτόματη αποσύνθεση σε κομμάτια
 * (Eurocode 8: σύνθετη στατική λειτουργία + boundary elements στις συμβολές).
 */
export interface ColumnCompositeParams {
  /**
   * Ακριβές πολύγωνο διατομής σε LOCAL συντεταγμένες mm (κεντραρισμένο στο
   * bbox-center, CCW). Υποχρεωτικό — ≥3 κορυφές.
   */
  readonly polygon: readonly Point2D[];
}

// ─── Parameters (user-editable, SSoT for geometry derivation) ────────────────

/**
 * Column parameters. All linear measurements σε mm (Nestor convention).
 *
 *   - `position` — clicked point σε world coords (mm). Anchor offset
 *     εφαρμόζεται στο geometry pipeline.
 *   - `anchor` — 9-position selector (default 'center').
 *   - `width` — mm. Semantic per kind:
 *       rectangular  → πλάτος X-axis
 *       circular     → διάμετρος
 *       L-shape      → bbox width
 *       T-shape      → bbox width
 *       polygon      → circumscribed-circle diameter
 *       shear-wall   → μήκος τοιχείου (length)
 *       I-shape      → flange width (b)
 *       U-shape      → bbox width
 *       composite    → bbox width
 *   - `depth` — mm. Semantic per kind:
 *       rectangular  → ύψος Y-axis
 *       circular     → αγνοείται
 *       L-shape      → bbox depth
 *       T-shape      → bbox depth
 *       polygon      → αγνοείται
 *       shear-wall   → πάχος τοιχείου (thickness)
 *       I-shape      → section depth (h)
 *       U-shape      → bbox depth
 *       composite    → bbox depth
 *   - `height` — mm. Storey height (default 3000).
 *   - `rotation` — μοίρες CCW γύρω από το anchor. Αγνοείται αν circular.
 *   - `material` — material library ID (Phase 6+).
 *   - `lshape` / `tshape` / `polygon` / `ishape` / `ushape` / `composite` —
 *     variant-specific dims.
 */
/**
 * ADR-404 — Κλίση (tilt) κολώνας, slope-based (Revit/Tekla «Slanted Column»).
 *   - `direction` — μοίρες CCW from +X (plan): η φορά προς την οποία γέρνει η
 *     κορυφή.
 *   - `angle` — μοίρες από την κατακόρυφο (0 = όρθια).
 * Tilt-as-shear: η κορυφή μετατοπίζεται στην κάτοψη κατά `height·tan(angle)` στη
 * `direction`, η βάση μένει σταθερή, το ύψος/elevation αμετάβλητο (ADR-369). ΟΧΙ
 * quaternion — διατηρεί κάτοψη/τομές/BOQ.
 */
export interface ColumnTilt {
  readonly direction: number;
  readonly angle: number;
}

export interface ColumnParams {
  readonly kind: ColumnKind;
  readonly position: Point3D;
  readonly anchor: ColumnAnchor;
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  readonly rotation: number;
  /**
   * ADR-404 — 3Δ κλίση (raking column). Absent / `angle===0` = κατακόρυφη
   * (no-tilt fast-path, mirror `isBeamTilted`). Revit «Slanted Column».
   */
  readonly tilt?: ColumnTilt;
  readonly material?: string;
  readonly lshape?: ColumnLshapeParams;
  readonly tshape?: ColumnTshapeParams;
  /** ADR-363 Phase 8 — regular N-gon override (only meaningful αν kind='polygon'). */
  readonly polygon?: ColumnPolygonParams;
  /** ADR-363 Phase 8 — I-shape override (only meaningful αν kind='I-shape'). */
  readonly ishape?: ColumnIShapeParams;
  /** ADR-363 Phase 2 — U-shape (Π) override (only meaningful αν kind='U-shape'). */
  readonly ushape?: ColumnUshapeParams;
  /** ADR-363 Phase 2 — composite διατομή (only meaningful αν kind='composite'). */
  readonly composite?: ColumnCompositeParams;
  /**
   * ADR-396 Phase P2 — External thermal envelope (ETICS) exterior layer.
   * Zone Z1 (κατακόρυφη όψη). Optional/non-breaking: στήλες χωρίς
   * θερμοπρόσοψη δουλεύουν ως έχουν. Set by the P6 auto-apply command.
   * `thickness_m` σε ΜΕΤΡΑ (SSoT unit), όχι mm.
   */
  readonly envelopeLayer?: EnvelopeLayer;
  /**
   * ADR-396 v2 Φάση 4 — Χειροκίνητη παράκαμψη (Revit-style) της αυτόματης ETICS
   * ταξινόμησης (Στρ.3). `undefined` = auto· 'exterior'/'interior' = override.
   * Set χειροκίνητα (UI Φάση 6).
   */
  readonly envelopeFunction?: EnvelopeFunction;
  /**
   * ADR-449 — Finish skin (σοβάς) πρόθεση. Optional/non-breaking: absent /
   * `enabled:false` = κανένας σοβάς (back-compat). Ο σοβάς είναι additive
   * «δέρμα» — ΠΟΤΕ δεν αλλάζει το `width/depth` (στατικός πυρήνας = immutable
   * SSoT). Οι εκτεθειμένες παρειές + ποσότητες είναι DERIVED μέσω του
   * `structural-finish-resolver`. Συνυπάρχει με `envelopeLayer` (ETICS).
   */
  readonly finish?: StructuralFinishSpec;
  /**
   * DXF canvas coordinate unit. Always stored so `computeColumnGeometry` can
   * convert mm scalars (width/depth) → canvas units for 2D footprint offsets.
   * Defaults to 'mm' when absent (legacy Firestore docs).
   */
  readonly sceneUnits?: SceneUnits;
  // ─── ADR-369 Phase 0.4 + A.1 — Storey linkage ────────────────────────────
  /** FK → Floor.id (storey reference). Semantic alias for entity-level floorId. */
  readonly storeyId?: string;
  /** mm. Base face offset από storey reference elevation. Default 0 = base at FFL. */
  readonly offsetFromStorey?: number;
  // ─── ADR-369 §9 Q5 — Revit-style vertical extent binding ───────────────────
  /** How column base couples to storey FFL. Default 'storey-floor'. */
  readonly baseBinding: ColumnBaseBinding;
  /** How column top couples to next storey reference. Default 'storey-ceiling'. */
  readonly topBinding: ColumnTopBinding;
  /**
   * mm. Base offset semantic depends on `baseBinding`:
   *   - 'storey-floor' → offset από FFL (positive=up)
   *   - 'absolute'     → absolute world z
   */
  readonly baseOffset: number;
  /**
   * mm. Top offset semantic depends on `topBinding`:
   *   - 'storey-ceiling' → offset από επόμενο storey reference
   *   - 'absolute'       → absolute world z
   *   - 'unconnected'    → ignored (see `unconnectedHeight`)
   */
  readonly topOffset: number;
  /** mm. Required ΟΤΑΝ topBinding='unconnected'. Free-standing height. */
  readonly unconnectedHeight?: number;
  // ─── ADR-401 Phase F — Attach-to-structural (mirror WallParams) ─────────────
  /**
   * Host FKs (beam/slab/roof/wall ids) στα οποία «κολλάει» η ΚΟΡΥΦΗ της κολώνας
   * όταν `topBinding='attached'`. Η κορυφή πέφτει στην κάτω-παρειά (lower-
   * envelope) πάνω από το footprint — βλ. `column-vertical-profile.ts`. Required
   * (≥1) όταν attached, αλλιώς undefined (Zod refinement, mirror wall).
   */
  readonly attachTopToIds?: readonly string[];
  /**
   * Host FKs στα οποία «κολλάει» η ΒΑΣΗ της κολώνας όταν `baseBinding='attached'`.
   * Η βάση ανεβαίνει/κατεβαίνει στην άνω-παρειά (upper-envelope) — bidirectional,
   * Revit «Attach Base». Required (≥1) όταν attached, αλλιώς undefined.
   */
  readonly attachBaseToIds?: readonly string[];
  /**
   * ADR-459 Phase 2 — Αναλυτικό FK προς το πέδιλο που στηρίζει τη ΒΑΣΗ της κολόνας
   * (Revit Structural Connectivity). Δείχνει σε `FoundationEntity.id` (pad/strip)
   * **ή** σε εδαφόπλακα-θεμελίωσης (`SlabEntity` kind foundation/ground) — ό,τι
   * αποτελεί «footing node» στον στατικό οργανισμό. **Αμιγώς αναλυτικό**: ΔΕΝ
   * μετακινεί τη βάση της κολόνας (το φυσικό base-attach είναι ξεχωριστό —
   * `attachBaseToIds`/ADR-401). Optional/non-breaking: absent = καμία ρητή έδραση
   * (ο οργανισμός πέφτει σε spatial-coincidence fallback). Set από τον
   * `AttachColumnFootingCommand` (auto/manual). Το reverse (πέδιλο→κολόνες) μένει
   * DERIVED στον graph (αποφυγή drift).
   */
  readonly footingId?: string;
  /**
   * ADR-363 Phase 8E — Catalog profile ID (e.g. 'IPE-300', 'C25/30').
   * Persisted so BOQ and re-opened drawings show the standard section name.
   * Undefined / absent = user-defined ("Custom"). Revit-style pattern.
   */
  readonly catalogProfile?: string;
  /**
   * ADR-456 — Κατηγορία σκυροδέματος (EN 1992-1-1 Table 3.1, π.χ. 'C25/30').
   * Optional/non-breaking: absent → χρησιμοποιείται `DEFAULT_CONCRETE_GRADE` για
   * το βάρος σκυροδέματος στο BOQ/schedule. Typed πεδίο (όχι string FK υλικού)
   * ώστε ο στατικός υπολογισμός να διαβάζει fck/Ecm απευθείας.
   */
  readonly concreteGrade?: ConcreteGrade;
  /**
   * ADR-456 — Οπλισμός κολώνας (διαμήκης + συνδετήρες + επικάλυψη). Optional:
   * absent → δεν έχει διαστασιολογηθεί οπλισμός (μόνο ποσότητες σκυροδέματος).
   * Οι παράγωγες ποσότητες (μήκη/τεμάχια/βάρος χάλυβα) υπολογίζονται on-demand
   * από `column-reinforcement-compute.ts` — ΠΟΤΕ αποθηκεύονται.
   */
  readonly reinforcement?: ColumnReinforcement;
  /**
   * ADR-467 — Φορτίο σχεδιασμού κολώνας από τη διαδρομή φορτίων (tributary load
   * takedown: tributary area × όροφοι × επιφανειακά φορτία + ίδιο βάρος). source=
   * 'takedown' → παράγεται αυτόματα από τον οργανισμό· source='manual' → χειροκίνητο
   * (ο takedown ΔΕΝ το αντικαθιστά, `isTakedownWritable`). Optional/non-breaking:
   * absent → δεν έχει υπολογιστεί. ΠΟΤΕ derived state — μόνο input για checks.
   */
  readonly appliedLoad?: AppliedMemberLoad;
  /**
   * ADR-499 Slice B2 — Auto-διαστασιολόγηση διατομής. default = AUTO (absent/true):
   * η χαρακτηριστική διάσταση αυτο-μεγαλώνει ώστε `As,req ≤ ρ_max·A_c` + λυγηρότητα
   * (`suggestColumnSection`, μόνο `kind==='rectangular'`). `false` = κλειδωμένη (ο
   * μηχανικός όρισε χειροκίνητα width/depth → user wins). Optional/non-breaking.
   */
  readonly autoSized?: boolean;
}

// ─── Geometry cache (derivable from params; SSoT = params) ──────────────────

/**
 * Computed column geometry. Returned by `computeColumnGeometry(params)` —
 * ΠΟΤΕ mutated by consumers. `area` σε m², `volume` σε m³, `height` σε mm
 * (BOQ-ready για volume calc).
 */
export interface ColumnGeometry {
  /** Polygon3D — οριζόντια τομή σε z = elevation (currently 0). Closed CCW. */
  readonly footprint: Polygon3D;
  readonly bbox: BoundingBox3D;
  /** m². Εμβαδό τομής. */
  readonly area: number;
  /** m³. area × height / 1000. */
  readonly volume: number;
  /** mm. Mirror of `params.height` για ευκολία downstream. */
  readonly height: number;
}

// ─── Entity (BIM generic instantiation) ─────────────────────────────────────

/**
 * Column BIM entity. Extends `BimEntity` με `kind: ColumnKind` discriminator.
 */
export interface ColumnEntity
  extends BimEntity<ColumnKind, ColumnParams, ColumnGeometry>,
    IfcEntityMixin {
  readonly type: 'column';
  /** ADR-369 §9 Q8 — IFC4 class. Always 'IfcColumn' για κολώνες. */
  readonly ifcType: 'IfcColumn';
}

// ─── Defaults & constants ────────────────────────────────────────────────────

/** Ελάχιστη διατομή (mm) — Eurocode 25×25cm. Phase 4 code violation threshold (WARNING). */
export const MIN_COLUMN_DIMENSION_MM = 250;

/**
 * ADR-398 §3.17 — απόλυτο κατώφλι **κατασκευασιμότητας** κολόνας (mm): κάτω από αυτό η διατομή ΔΕΝ
 * χωρά επικάλυψη (2×~25mm) + διαμήκεις ράβδους + συνδετήρες + μέγιστο αδρανές → **HARD BLOCK** (δεν
 * είναι πραγματικό φέρον μέλος Ο/Σ — π.χ. «κολόνα» 2/3/…/11 cm). Πιο αυστηρό από το EC8 warning (250mm):
 * 120mm = block (αδύνατο), 120–249mm = warning (υπάρχοντα/δευτερεύοντα/DCL), ≥250mm = OK.
 */
export const MIN_CONSTRUCTIBLE_COLUMN_MM = 120;

/** Default πλάτος κολώνας (mm). 40×40cm RC typical. */
export const DEFAULT_COLUMN_WIDTH_MM = 400;

/** Default βάθος κολώνας (mm). */
export const DEFAULT_COLUMN_DEPTH_MM = 400;

/** Default ύψος ορόφου (mm). */
export const DEFAULT_COLUMN_HEIGHT_MM = 3000;

/**
 * Max slenderness ratio (height / min(width, depth)). Πάνω από 30 → code
 * violation (Eurocode-aligned crude check, Phase 4 sufficient).
 */
export const MAX_SLENDERNESS_RATIO = 30;

/** Default rotation (μοίρες). */
export const DEFAULT_COLUMN_ROTATION_DEG = 0;

/** Number of segments για circular footprint approximation. */
export const CIRCULAR_COLUMN_SEGMENTS = 32;

// ─── ADR-363 Phase 8 — polygon / shear-wall / I-shape defaults ─────────────

/** Default αριθμός πλευρών για polygon kind. 6 = hexagon (most common decorative). */
export const DEFAULT_POLYGON_SIDES = 6;

/** Min/max sides για regular N-gon. < 3 degenerate, > 12 visually indistinguishable από circular. */
export const MIN_POLYGON_SIDES = 3;
export const MAX_POLYGON_SIDES = 12;

/** Default μήκος τοιχείου διάτμησης (mm). 2m typical wall length. */
export const DEFAULT_SHEAR_WALL_LENGTH_MM = 2000;

/** Default πάχος τοιχείου διάτμησης (mm). 20cm typical RC shear wall. */
export const DEFAULT_SHEAR_WALL_THICKNESS_MM = 200;

/**
 * Min thickness τοιχείου διάτμησης (mm). Eurocode 8 §5.4.2.4 — 15cm για
 * RC shear walls (versus 25cm για κανονικές κολώνες, MIN_COLUMN_DIMENSION_MM).
 */
export const MIN_SHEAR_WALL_THICKNESS_MM = 150;

/**
 * Min aspect ratio (length / thickness) ώστε ένα rectangular kind να
 * χαρακτηριστεί shear wall. ≤ 4 = standard column. > 4 = wall behaviour
 * (Eurocode 8 §5.4.2.4 / Eurocode 2 §9.6.1: ratio STRICTLY > 4 → τοιχίο).
 */
export const SHEAR_WALL_MIN_ASPECT_RATIO = 4;

/**
 * Τυπικά ΑΝΩΤΕΡΑ όρια διαστάσεων τοιχίου (shear-wall) — **SOFT** (μόνο προειδοποίηση, ΠΟΤΕ block).
 * Οι Ευρωκώδικες (EC2/EC8) ΔΕΝ ορίζουν μέγιστο πάχος/μήκος τοιχίου — μόνο ΕΛΑΧΙΣΤΑ
 * (MIN_SHEAR_WALL_THICKNESS_MM) + απαιτήσεις οπλισμού. Οι μεγάλοι (Revit/ETABS/Tekla) δεν βάζουν
 * hard cap. Πάνω από αυτά προειδοποιούμε ότι το στοιχείο βγαίνει εκτός τυπικού εύρους:
 *   - πάχος > 1.5m → «μαζικό σκυρόδεμα», όχι λεπτό επίπεδο τοιχίο (χάνεται η έννοια του τοιχίου).
 *   - μήκος > 30m συνεχές → απαιτείται αρμός διαστολής/διακοπής (έλεγχος ρηγμάτωσης EC2 §7.3).
 * Καθαρά advisory κατώφλια (tunable).
 */
export const MAX_TYPICAL_SHEAR_WALL_THICKNESS_MM = 1500;
export const MAX_TYPICAL_SHEAR_WALL_LENGTH_MM = 30000;

/**
 * ADR-363/449 — ελάχιστη γωνία κορυφής (μοίρες) μιας σύνθετης (composite/freeform) διατομής
 * πριν θεωρηθεί αιχμηρή «σφήνα» (impractical sliver). Free per-corner reshape μπορεί να φτιάξει
 * οξείες γωνίες όπου ο οπλισμός/η συμπύκνωση σκυροδέματος δεν είναι εφικτή — κάτω από αυτό το
 * όριο → non-blocking code violation (red badge), όχι hard error (γεωμετρικά παραμένει έγκυρο).
 */
export const MIN_SECTION_CORNER_ANGLE_DEG = 20;

/** Default flange width (b) για I-shape (mm). IPE-300 = 150, HEA-300 = 300. Median = 200. */
export const DEFAULT_I_FLANGE_WIDTH_MM = 200;

/** Default section depth (h) για I-shape (mm). IPE-300 = 300. */
export const DEFAULT_I_SECTION_DEPTH_MM = 300;

/** Default flange thickness (tf) για I-shape (mm). IPE-300 ≈ 10.7, HEA-300 = 14. Generic = 20. */
export const DEFAULT_I_FLANGE_THICKNESS_MM = 20;

/** Default web thickness (tw) για I-shape (mm). IPE-300 ≈ 7.1, HEA-300 = 8.5. Generic = 15. */
export const DEFAULT_I_WEB_THICKNESS_MM = 15;

/**
 * Min flange/web thickness για I-shape (mm). Below this = degenerate (would
 * collapse to line). Validator hard-error.
 */
export const MIN_I_PLATE_THICKNESS_MM = 5;

/**
 * ADR-363 Phase 2b — Panel-display defaults για manual παραμετρικό Π (U-shape
 * χωρίς polygon). Match οι τιμές που παράγει το `buildUshapeLocal` / grips
 * `materializeUshape` σε default 400×400 διατομή (width/4, depth/3). Το
 * geometry default παραμένει adaptive (width/4, depth/3) ώστε μικρές διατομές
 * να μην εκφυλίζονται· αυτά τα static values είναι μόνο το initial ribbon label.
 */
export const DEFAULT_U_LEG_THICKNESS_MM = 100;
export const DEFAULT_U_BASE_THICKNESS_MM = 130;

/**
 * Anchor → unit-fraction offset within the (width × depth) bounding box,
 * BEFORE rotation. `dx`/`dy` ∈ {-0.5, 0, +0.5}. Geometry pipeline εφαρμόζει
 * `position - (dx × width, dy × depth)` ώστε το anchor σημείο να συμπίπτει
 * με το clicked `position`.
 *
 *   nw  n  ne
 *   w   c  e
 *   sw  s  se
 */
export const ANCHOR_OFFSETS: Readonly<Record<ColumnAnchor, { dx: number; dy: number }>> = {
  'center': { dx:  0,    dy:  0    },
  'n':      { dx:  0,    dy:  0.5  },
  's':      { dx:  0,    dy: -0.5  },
  'e':      { dx:  0.5,  dy:  0    },
  'w':      { dx: -0.5,  dy:  0    },
  'nw':     { dx: -0.5,  dy:  0.5  },
  'ne':     { dx:  0.5,  dy:  0.5  },
  'sw':     { dx: -0.5,  dy: -0.5  },
  'se':     { dx:  0.5,  dy: -0.5  },
};

/** Ring order για Tab cycling στο column-tool (9-state). */
export const ANCHOR_CYCLE_ORDER: readonly ColumnAnchor[] = [
  'center', 'n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw',
];
