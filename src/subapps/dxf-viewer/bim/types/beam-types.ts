/**
 * BIM Beam — Type Schema (ADR-363 §5.7 + ADR-369 §2.2 + §9 Q5 + Q8, Phase A4).
 *
 * Concrete `BeamParams` + `BeamGeometry` + `BeamEntity`. 3 kinds (straight /
 * curved / cantilever). Straight + cantilever: 2-click. Curved: 3-click με
 * quadratic Bezier control. Cross-section width × depth.
 *
 * ADR-369 §2.2 canonical convention (Post-ADR-369):
 *   - `topElevation` = **top face** (top-of-beam) σε mm από project origin.
 *     Default = `floor.elevation` (Hybrid A FFL). Beam hangs DOWN by `depth`.
 *   - `zOffset?` = mm (default 0) — drop-from-ceiling για ψευδοροφές, exposed
 *     beams κάτω από slab, κλπ.
 *   - Geometry: top = topElevation + zOffset
 *              bottom = top - depth
 *
 * ADR-369 §9 Q5 §854: Beams `topElevation` = floor.elevation by default.
 * `zOffset` (mm) για drop-from-ceiling cases. Δεν χρειάζονται baseBinding/
 * topBinding enums όπως walls/columns (beam έχει ενιαία top reference).
 *
 * ADR-369 §9 Q8 IFC4 readiness:
 *   - BeamEntity extends IfcEntityMixin. ifcType='IfcBeam' πάντα.
 *
 * SSoT:
 *   - `BeamParams.startPoint` + `endPoint` (+ optional `curveControl`) ορίζουν
 *     τον άξονα. `width` / `depth` ορίζουν τη διατομή.
 *   - `BeamGeometry` cache από `computeBeamGeometry()` — re-derivable από params.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.7
 * @see docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md §2.2, §9 Q5, §9 Q8
 */

import type {
  BimEntity,
  BoundingBox3D,
  Point3D,
  Polygon3D,
  Polyline3D,
} from './bim-base';
import type { SceneUnits } from '../../utils/scene-units';
import type { IfcEntityMixin } from './ifc-entity-mixin';
import type { EnvelopeFunction, EnvelopeLayer } from './thermal-envelope-types';
import type { StructuralFinishSpec } from '../finishes/structural-finish-types';
import type { BeamReinforcement } from '../structural/reinforcement/beam-reinforcement-types';
import type { AppliedMemberLoad } from '../structural/loads/structural-loads-types';

// ─── Sub-type discriminators (ADR-363 §5.7) ─────────────────────────────────

/**
 * Beam kind discriminator. 3 industry-standard τύποι δοκαριού:
 *   - `straight`     → ευθύγραμμη δοκός (2-click)
 *   - `curved`       → καμπυλωτή δοκός με quadratic Bezier control (3-click)
 *   - `cantilever`   → πρόβολος (2-click, χωρίς υποστήριξη στο 2ο άκρο)
 */
export type BeamKind = 'straight' | 'curved' | 'cantilever';

/**
 * Structural support type. Cantilever beams MUST have `supportType: 'cantilever'`
 * (validator-enforced σε αυτή τη φάση). Straight / curved beams default σε
 * `'simple'` (simply supported — pin/roller). `'fixed'` = αμφίπακτη.
 *
 * ADR-504 Φ2 — `'continuous'`: συνεχής δοκός πάνω από ≥1 ενδιάμεσες στηρίξεις. **DERIVED**
 * τύπος (όπως το `'cantilever'`): παράγεται από τη ζωντανή τοπολογία (`deriveBeamSpanModel`)
 * όταν υπάρχουν mid-span στηρίξεις — ΔΕΝ είναι user-selectable. Μοντέλο ροπών envelope
 * `wL²/10` (hogging 1ης εσωτερικής στήριξης κυβερνά) + l/d K=1.5 (εσωτερικό φάτνωμα).
 */
export type BeamSupportType = 'simple' | 'fixed' | 'cantilever' | 'continuous';

/**
 * Steel section profile type.
 *   - `'I'` → standard I-beam (IPE series, flangeT/h ≈ 0.15)
 *   - `'H'` → broad-flange H-beam (HEA/HEB series, flangeT/h ≈ 0.33)
 * Only relevant when `material === 'steel'`. Ignored for rc/glulam.
 * ADR-363 Φ2: hint μόνο για το 2D glyph· ΔΕΝ οδηγεί γεωμετρία (αυτό κάνει το
 * `sectionKind` + `ishape`).
 */
export type BeamSectionType = 'I' | 'H';

/**
 * ADR-363 Φ2 — διαχωριστής **σχήματος διατομής** δοκαριού, ΟΡΘΟΓΩΝΙΟΣ στο
 * `BeamKind` (δομική μορφή). Έτσι ένα δοκάρι μπορεί να είναι π.χ. straight +
 * I-shape ή cantilever + I-shape.
 *   - `'rectangular'` → ορθογωνική RC διατομή (default / absent — back-compat).
 *   - `'I-shape'`     → πραγματική μεταλλική διατομή Ι/H (EN 10365 catalog),
 *     swept κατά τον άξονα σε 3D, BOQ σε kg (OIK-12.10).
 */
export type BeamSectionKind = 'rectangular' | 'I-shape';

/**
 * ADR-363 Φ2 — I-shape override παραμέτρων διατομής δοκαριού (mirror
 * `ColumnIShapeParams`). Όλα optional· τα `flangeThickness`/`webThickness`
 * default σε `DEFAULT_I_FLANGE_THICKNESS_MM`/`DEFAULT_I_WEB_THICKNESS_MM` όταν
 * απουσιάζουν (SSoT defaults στο `shared/i-shape-profile`).
 */
export interface BeamIShapeParams {
  /** mm. Πάχος πέλματος (tf). */
  readonly flangeThickness?: number;
  /** mm. Πάχος κορμού (tw). */
  readonly webThickness?: number;
  /** Mirror Y handedness (transform-pipeline parity· no-op visually για symmetric I). */
  readonly flipY?: boolean;
}

// ─── Parameters (user-editable, SSoT for geometry derivation) ────────────────

/**
 * Beam parameters. All linear measurements σε mm (Nestor convention).
 *
 *   - `startPoint` / `endPoint` — άξονας σε world coords (mm).
 *   - `curveControl` — quadratic Bezier control point (μόνο αν `kind === 'curved'`).
 *   - `width` — mm. Cross-section X (πλάτος διατομής).
 *   - `depth` — mm. Cross-section Y (structural depth — δομικό βάθος).
 *   - `topElevation` — mm. **Top face** (top-of-beam) από project origin.
 *     ADR-369 §2.2 canonical (renamed από legacy `elevation`).
 *   - `zOffset?` — mm (default 0). Drop-from-ceiling offset. ADR-369 §854.
 *   - `material` — material library ID (Phase 6+).
 *   - `supportType` — pin/roller / fixed / cantilever (default per kind).
 */
export interface BeamParams {
  readonly kind: BeamKind;
  readonly startPoint: Point3D;
  readonly endPoint: Point3D;
  /** Defined when `kind === 'curved'`. mm. Quadratic Bezier control point. */
  readonly curveControl?: Point3D;
  /** mm. Cross-section X (Eurocode min 150mm — code violation αν μικρότερο). */
  readonly width: number;
  /** mm. Cross-section Y / structural depth. */
  readonly depth: number;
  /** mm. Top face (top-of-beam) από project origin. ADR-369 §2.2. */
  readonly topElevation: number;
  /**
   * mm. **Top face στο `endPoint`** (ADR-401 Phase E/(β) — κεκλιμένη δοκός).
   * Όταν δοθεί ΚΑΙ διαφέρει από το `topElevation`, η πάνω παρειά γέρνει
   * **γραμμικά κατά μήκος του άξονα** (`topElevation` στο `startPoint` →
   * `topElevationEnd` στο `endPoint`), σταθερό βάθος (Revit sloped beam).
   * Απών / ίσο με `topElevation` → οριζόντια δοκός (flat fast-path, byte-for-byte
   * back-compat). Η κλίση οδηγείται από **αδιάστατο axis fraction** × Δmm →
   * unit-safe σε mm-scene ΚΑΙ meter-scene (σε αντίθεση με το slab slope).
   * SSoT υπολογισμός: `bim/geometry/beam-slope.ts`.
   */
  readonly topElevationEnd?: number;
  /** mm. Drop-from-ceiling offset (default 0). ADR-369 §854. */
  readonly zOffset?: number;
  readonly material?: string;
  readonly supportType?: BeamSupportType;
  /** Steel section profile type ('I' or 'H'). Ignored for rc/glulam. Default: 'I'. */
  readonly sectionType?: BeamSectionType;
  /**
   * ADR-363 Φ2 — σχήμα διατομής. Default/absent = `'rectangular'` (RC, back-compat).
   * `'I-shape'` → πραγματική μεταλλική διατομή (γεωμετρία + BOQ kg).
   */
  readonly sectionKind?: BeamSectionKind;
  /** ADR-363 Φ2 — I-shape override (meaningful μόνο αν `sectionKind==='I-shape'`). */
  readonly ishape?: BeamIShapeParams;
  /**
   * ADR-363 Φ2 — Catalog profile ID (π.χ. 'IPE-300', 'HEA-200'). Persisted ώστε
   * BOQ + re-opened drawings να δείχνουν το πρότυπο όνομα διατομής. Absent /
   * `CATALOG_CUSTOM_SENTINEL` = user-defined ("Custom"). Revit-style.
   */
  readonly catalogProfile?: string;
  /** Free-text profile designation shown on canvas (e.g. "IPE 300", "HEA 200"). */
  readonly profileDesignation?: string;
  /**
   * DXF canvas coordinate unit. Always stored so `computeBeamGeometry` can
   * convert mm scalars (width/depth) → canvas units for 2D outline offset.
   * Defaults to 'mm' when absent (legacy Firestore docs).
   */
  readonly sceneUnits?: SceneUnits;
  // ─── ADR-369 Phase 0.4 + A.1 — Storey linkage ────────────────────────────
  /** FK → Floor.id (storey reference). Semantic alias for entity-level floorId. */
  readonly storeyId?: string;
  /** mm. Top face offset από storey reference elevation. Default 0 = top-of-beam at FFL. */
  readonly offsetFromStorey?: number;
  /**
   * ADR-396 Phase P2 — External thermal envelope (ETICS) exterior layer.
   * Zone Z1 (κατακόρυφη όψη). Optional/non-breaking. Set by the P6
   * auto-apply command. `thickness_m` σε ΜΕΤΡΑ (SSoT unit), όχι mm.
   */
  readonly envelopeLayer?: EnvelopeLayer;
  /**
   * ADR-396 v2 Φάση 4 — Χειροκίνητη παράκαμψη (Revit-style) της αυτόματης ETICS
   * ταξινόμησης (Στρ.3). `undefined` = auto· 'exterior'/'interior' = override.
   * Set χειροκίνητα (UI Φάση 6).
   */
  readonly envelopeFunction?: EnvelopeFunction;
  /**
   * ADR-449 — Structural Finish Skin (σοβάς). Per-element πρόθεση σοβατίσματος.
   * Absent / `enabled:false` = κανένας σοβάς (back-compat). Ο σοβάς είναι additive
   * «δέρμα» — ΠΟΤΕ δεν αλλάζει το `width/depth` (στατικός πυρήνας = immutable SSoT).
   * Για το δοκάρι σοβατίζονται οι **2 πλάγιες όψεις** (μήκος×depth)· τα άκρα είναι
   * δομική σύνδεση (frame-into) → ποτέ σοβατισμένα, η πάνω όψη πατά στην πλάκα. Οι
   * εκτεθειμένες παρειές + ποσότητες είναι DERIVED μέσω `structural-finish-resolver`.
   * Συνυπάρχει με `envelopeLayer` (ETICS). Mirror του `ColumnParams.finish`.
   */
  readonly finish?: StructuralFinishSpec;
  /**
   * ADR-459 Phase 4a — Οπλισμός δοκού (κάτω/άνω διαμήκης + συνδετήρες + cover).
   * Optional/non-breaking: absent → δεν έχει διαστασιολογηθεί οπλισμός (μόνο
   * ποσότητες σκυροδέματος). Οι παράγωγες ποσότητες υπολογίζονται on-demand από
   * `beam-reinforcement-compute.ts` — ΠΟΤΕ αποθηκεύονται (mirror κολόνας).
   */
  readonly reinforcement?: BeamReinforcement;
  /**
   * ADR-467 — Φορτίο βαρύτητας δοκαριού από τη διαδρομή φορτίων (tributary strip
   * πλάκας πάνω στο δοκάρι + ίδιο βάρος). source='takedown' → αυτόματο από οργανισμό·
   * source='manual' → χειροκίνητο (προστατευμένο, `isTakedownWritable`). Optional/
   * non-breaking. ΠΟΤΕ derived state — input για beam gravity design.
   */
  readonly appliedLoad?: AppliedMemberLoad;
  /**
   * ADR-475 — Αυτόματη διαστασιολόγηση διατομής (Revit-grade, serviceability-driven).
   *   - `undefined` / `true` → **AUTO**: το `depth` ξανα-υπολογίζεται από span+φορτίο
   *     (EC2 §7.4.2 βέλος + ULS κάμψη/διάτμηση) όποτε αλλάζει ο οργανισμός.
   *   - `false` → **LOCKED**: ο μηχανικός όρισε χειροκίνητα τη διατομή (override) →
   *     η auto-size σταματά για αυτό το μέλος (ανεπαρκές ⇒ code-violation, validator).
   * Default = AUTO (πλήρης αυτοματοποίηση· lock μόνο σε χειροκίνητη αλλαγή depth/width).
   * Mirror του `FoundationParams.autoDesigned` (auto-sized πέδιλο).
   */
  readonly autoSized?: boolean;
}

// ─── Geometry cache (derivable from params; SSoT = params) ──────────────────

/**
 * Computed beam geometry. Returned by `computeBeamGeometry(params)` —
 * ΠΟΤΕ mutated by consumers.
 *
 *   - `axisPolyline` — centerline (start → end για straight/cantilever,
 *     CURVED_BEAM_SUBDIVISIONS-subdivided Bezier για curved).
 *   - `outline` — plan-view rectangle (width × length) — closed CCW polygon.
 *   - `length` — m. Σύνολο μήκους κατά μήκος του άξονα.
 *   - `area` — m². Top surface (length × width / 1e6) — feeds BOQ formwork.
 *   - `volume` — m³. length × width × depth / 1e9.
 *   - `bbox` — folds outline + axis vertices, z extends σε topElevation.
 */
export interface BeamGeometry {
  readonly axisPolyline: Polyline3D;
  readonly outline: Polygon3D;
  readonly bbox: BoundingBox3D;
  /** m — geometric axis length (sum-of-edges). */
  readonly length: number;
  /** m² — top surface (length × width). */
  readonly area: number;
  /** m³ — length × width × depth / 1e9. */
  readonly volume: number;
  /**
   * m. Free span = geometric axis length (polyline chord start→end). For
   * straight/cantilever beams this equals `length`. Phase 3.8.
   */
  readonly maxFreeSpanM: number;
  /**
   * ADR-458 — DERIVED (ΠΟΤΕ persisted) trimmed plan outline (beam-to-column cutback,
   * «η κολόνα νικάει»). Πολλαπλά rings = το δοκάρι χωρίστηκε σε κομμάτια· `[]` = εξ
   * ολοκλήρου μέσα σε κολόνα (δεν σχεδιάζεται). **Απών** → κανένα cut → render/hit-test
   * διαβάζει το `outline` (byte-for-byte). Υπολογίζεται στο scene-conversion post-pass
   * (`applyBeamColumnCutback2D`) από τα live column footprints — μηδέν stale persisted γεωμετρία.
   */
  readonly displayOutline?: readonly (readonly Point3D[])[];
  /**
   * ADR-458 — DERIVED (ΠΟΤΕ persisted) άξονας (centerline) προσαρμοσμένος ώστε κάθε άκρο
   * που πλαισιώνεται από κολόνα να καταλήγει ΑΚΡΙΒΩΣ στην παρειά της (σημείο επαφής —
   * Revit location-line σύμβαση): pull-back όταν ο άξονας μπαίνει μέσα, extend όταν
   * σταματά πριν. **Απών** → κανένα cut → render διαβάζει το `axisPolyline` (αυτούσιο).
   * Υπολογίζεται στο ίδιο scene-conversion post-pass με το `displayOutline`
   * (`applyBeamColumnCutback2D`) από τα live column footprints — μηδέν stale persisted.
   */
  readonly displayAxisPolyline?: Polyline3D;
}

// ─── Entity (BIM generic instantiation) ─────────────────────────────────────

/**
 * Beam BIM entity. Extends `BimEntity` με `kind: BeamKind` discriminator + IFC mixin.
 */
export interface BeamEntity
  extends BimEntity<BeamKind, BeamParams, BeamGeometry>,
    IfcEntityMixin {
  readonly type: 'beam';
  /** ADR-369 §9 Q8 — IFC4 class. Always 'IfcBeam'. */
  readonly ifcType: 'IfcBeam';
}

// ─── Defaults & constants ────────────────────────────────────────────────────

/** Ελάχιστο πλάτος διατομής (mm) — Eurocode minimum για RC beam. */
export const MIN_BEAM_WIDTH_MM = 150;

/** Default πλάτος δοκαριού (mm). 25cm RC typical. */
export const DEFAULT_BEAM_WIDTH_MM = 250;

/** Default structural depth (mm). 50cm RC beam typical (Greek residential). */
export const DEFAULT_BEAM_DEPTH_MM = 500;

/**
 * Ελάχιστο structural depth (mm) — Eurocode floor για RC beam. Out-of-plane
 * dimension (gravity axis): δεν φαίνεται σε plan view, αλλά clampάρει το
 * `beam-depth` grip drag (ADR-363 Phase 5.5c).
 */
export const MIN_BEAM_DEPTH_MM = 200;

/** Ελάχιστο μήκος δοκαριού (mm) — degenerate guard. */
export const MIN_BEAM_LENGTH_MM = 200;

/**
 * ADR-475 — EC2 §7.4.2 βασικό όριο λόγου ανοίγματος/**ενεργού** βάθους L/d_eff για
 * έλεγχο βέλους (serviceability). Ο validator το πολλαπλασιάζει με τον structural-
 * system factor K ανά συνθήκη στήριξης (αμφιέρειστη 1.0 / αμφίπακτη 1.5 / πρόβολος
 * 0.4) και συγκρίνει με `span/d_eff` (d_eff = 0.9·h). Conservative, code-agnostic
 * belt-and-suspenders — αντικατέστησε το παλιό flat `span/h > 20` (που σιωπούσε σε
 * οριακά ανεπαρκείς διατομές). Η auto-διαστασιολόγηση (member-sizing) χρησιμοποιεί τα
 * code-specific `provider.beamSpanDepthLimit`.
 */
export const BASIC_SPAN_EFFECTIVE_DEPTH_LIMIT = 14;

/**
 * Default top elevation (mm) — top-of-slab για typical Greek residential
 * storey (3m). ADR-369 §2.2 renamed από `DEFAULT_BEAM_ELEVATION_MM`.
 */
export const DEFAULT_BEAM_TOP_ELEVATION_MM = 3000;

/** ADR-369 §854 — default drop-from-ceiling zOffset (mm). */
export const DEFAULT_BEAM_Z_OFFSET_MM = 0;

/**
 * Quadratic Bezier subdivision count για `curved` kind. 16 segments mirror
 * the wall-geometry pattern (smooth curve + accurate offset normals).
 */
export const CURVED_BEAM_SUBDIVISIONS = 16;
