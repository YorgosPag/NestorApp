/**
 * BIM Wall — Type Schema (ADR-363 §5.3, Phase 1).
 *
 * Concrete `WallParams` + `WallGeometry` + `WallEntity` αντικαθιστούν τα Phase 0
 * stubs (`BimParamsStub`/`BimGeometryStub`) στο `types/entities.ts`.
 *
 * Port από `C:/genarc/src/types/wall.types.ts` με:
 *   - μετατροπή μονάδων m → mm (Nestor convention, ADR-358 §5.0 ίδιο με stair)
 *   - επέκταση `WallCategory` σε 5 τιμές (genarc: 3 → Nestor: +parapet +fence)
 *   - 3D-readiness: `Point3D` με optional z (G11)
 *   - WallDna σε ξεχωριστό module (`wall-dna-types.ts`) per N.7.1 SRP
 *
 * SSoT:
 *   - `WallParams.thickness` derived από `WallDna.totalThickness` όταν dna set,
 *     αλλιώς manual override (legacy/structural walls χωρίς DNA composition).
 *   - `WallGeometry` cache από `computeWallGeometry()` — re-derivable από
 *     `params` σε corruption (Phase 8 stair pattern).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.3
 */

import type {
  BimEntity,
  Point3D,
  Polyline3D,
  BoundingBox3D,
} from './bim-base';
import type { WallDna } from './wall-dna-types';
import type { SceneUnits } from '../../utils/scene-units';
import type { IfcEntityMixin } from './ifc-entity-mixin';
import type { WallBaseBinding, WallTopBinding } from './bim-binding';
import type { EnvelopeFunction } from './thermal-envelope-types';
import type { WallTypeParams } from './bim-family-type';

// ─── Sub-type & category enums (ADR-363 §5.3) ────────────────────────────────

/** Wall sub-type discriminator. Phase 1 implements `'straight'`; curved/polyline land Phase 1.5. */
export type WallKind = 'straight' | 'curved' | 'polyline';

/**
 * Nestor extends genarc's 3 categories with `parapet` + `fence` για ΟΙΚ-3.05/3.06
 * BOQ mapping (ADR-363 §10 wall presets).
 */
export type WallCategory = 'exterior' | 'interior' | 'partition' | 'parapet' | 'fence';

// ─── Parameters (user-editable, SSoT for geometry derivation) ────────────────

/**
 * Wall parameters. All linear measurements in mm (Nestor convention).
 * `thickness` is the SSoT for cross-section depth — when `dna` is set the
 * caller MUST ensure `thickness === dna.totalThickness` (validator-enforced
 * Phase 1.5; Phase 1 trusts the builder).
 *
 * Optional fields:
 *   - `measurementLength` — override BOM length (e.g. billable length differs
 *     from geometric axis length για διαπραγματευμένες θέσεις)
 *   - `dna` — layered composition (defaults from `getDefaultDnaForCategory()`)
 *   - `startBevel`/`endBevel` — join-cleanup trim mm at endpoints
 *   - `polylineVertices` — present when `kind === 'polyline'`
 *   - `curveControl` — present when `kind === 'curved'` (quadratic Bezier ctrl pt)
 */
/**
 * ADR-404 — Κλίση (tilt) τοίχου, slope-based (Revit «Slanted wall / Angle From
 * Vertical»). Lean **κάθετα στη φορά** `start → end` (battered wall, ένας DOF).
 *   - `angle` — μοίρες από την κατακόρυφο, **signed**: το πρόσημο επιλέγει σε ποια
 *     πλευρά (αριστερή/δεξιά κάθετη) γέρνει η κορυφή.
 * Tilt-as-shear: η κορυφή μετατοπίζεται ⟂ στη run κατά `height·tan(angle)`, η βάση
 * μένει σταθερή, το ύψος αμετάβλητο (ADR-369). Absent / `angle===0` = κατακόρυφος.
 */
export interface WallTilt {
  readonly angle: number;
}

export interface WallParams {
  readonly category: WallCategory;
  /** Canvas world coordinates (DXF scene units). */
  readonly start: Point3D;
  /** Canvas world coordinates (DXF scene units). */
  readonly end: Point3D;
  /** mm. Physical height — always mm regardless of sceneUnits. Default 3000. */
  readonly height: number;
  /** mm. Cross-section depth — always mm. Equals dna.totalThickness when dna present. */
  readonly thickness: number;
  /** When true, the "exterior face" is swapped (offsets the centerline-derived edges). */
  readonly flip: boolean;
  /** mm. Optional BOM override for billable length (defaults to axis length). */
  readonly measurementLength?: number;
  /** Layered composition. Undefined = bare structural wall (no plaster). */
  readonly dna?: WallDna;
  /** mm. Start endpoint trim for SDF/perpendicular join cleanup. */
  readonly startBevel?: number;
  /** mm. End endpoint trim. */
  readonly endBevel?: number;
  /**
   * ADR-363 Phase 1D-C — Geometric miter join at the **start** endpoint.
   * When present, the outerEdge[0] and innerEdge[0] are replaced with these
   * exact canvas-world-unit points (computed by `computeWallTrims` for corner
   * junctions). Supersedes `startBevel` when both are set.
   */
  readonly startMiter?: { readonly outer: { readonly x: number; readonly y: number }; readonly inner: { readonly x: number; readonly y: number } };
  /**
   * ADR-363 Phase 1D-C — Geometric miter join at the **end** endpoint.
   * Same semantics as `startMiter` but for `outerEdge[last]`/`innerEdge[last]`.
   */
  readonly endMiter?: { readonly outer: { readonly x: number; readonly y: number }; readonly inner: { readonly x: number; readonly y: number } };
  /** Defined when `kind === 'polyline'`. mm. */
  readonly polylineVertices?: readonly Point3D[];
  /** Defined when `kind === 'curved'`. mm. Quadratic Bezier control point. */
  readonly curveControl?: Point3D;
  /** Material key for wall-level hatch (rc/masonry/aerated-concrete/gypsum).
   *  Ignored when `dna` is present — DNA layers govern per-layer materials. */
  readonly material?: string;
  /**
   * ADR-404 — 3Δ κλίση (battered wall). Absent / `angle===0` = κατακόρυφος
   * (no-tilt fast-path). Lean ⟂ στη φορά `start → end`.
   */
  readonly tilt?: WallTilt;
  /**
   * DXF canvas coordinate unit. Always 'mm' for walls created after ADR-363 SSOT fix.
   * Used by computeWallGeometry to convert mm scalars (height/thickness) → canvas units
   * for 2D edge-offset geometry. Absent on legacy entities → defaults to 'mm'.
   */
  readonly sceneUnits?: SceneUnits;
  // ─── ADR-369 Phase 0.4 + A.1 — Storey linkage ────────────────────────────
  /** FK → Floor.id (storey reference). Semantic alias for entity-level floorId. */
  readonly storeyId?: string;
  /** mm. Base face offset από storey reference elevation. Default 0 = base at FFL. */
  readonly offsetFromStorey?: number;
  // ─── ADR-369 §9 Q5 — Revit-style vertical extent binding ───────────────────
  /** How wall base couples to storey FFL. Default 'storey-floor'. */
  readonly baseBinding: WallBaseBinding;
  /** How wall top couples to next storey reference. Default 'storey-ceiling'. */
  readonly topBinding: WallTopBinding;
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
  /**
   * ADR-401 — Συσχετιστικό «Attach Top to Structural». FK list προς δομικά
   * στοιχεία (beam / slab / roof / wall) στων οποίων την κάτω παρειά «κολλάει»
   * η κορυφή. Required (≥1) ΟΤΑΝ `topBinding='attached'`. Πολλαπλά → σκαλωτή
   * κορυφή (lower-envelope, `resolveWallTopProfile`). Το πραγματικό ύψος
   * υπολογίζεται ζωντανά — ΔΕΝ αποθηκεύεται.
   */
  readonly attachTopToIds?: readonly string[];
  /**
   * ADR-401 (γ) — Συσχετιστικό «Attach Base to Structural» (Revit bidirectional).
   * FK list προς δομικά στοιχεία (beam / slab / foundation) στων οποίων την **άνω
   * παρειά** «κάθεται» η βάση. Required (≥1) ΟΤΑΝ `baseBinding='attached'`.
   * Πολλαπλά → upper-envelope (πατάει στο ψηλότερο στήριγμα, `resolveWallBaseProfile`).
   * Το πραγματικό ύψος υπολογίζεται ζωντανά — ΔΕΝ αποθηκεύεται.
   */
  readonly attachBaseToIds?: readonly string[];
  /**
   * ADR-396 v2 Φάση 4 — Χειροκίνητη παράκαμψη (Revit-style) της αυτόματης ETICS
   * ταξινόμησης ορίων (Στρ.3). `undefined` = auto· 'exterior'/'interior' = override.
   * Αποσυνδεδεμένο από το δομικό `category`. Set χειροκίνητα (UI Φάση 6).
   */
  readonly envelopeFunction?: EnvelopeFunction;
}

// ─── Geometry cache (derivable from params; SSoT = params) ──────────────────

/**
 * Computed geometry. Returned by `computeWallGeometry(params)` — never mutated
 * by consumers. Lengths/areas in metres (BOQ-ready); cached on the entity so
 * rendering & hit-testing avoid recomputation. Re-derive on corruption.
 */
export interface WallGeometry {
  /** Centerline (start → end, or polyline vertices when polyline kind). */
  readonly axisPolyline: Polyline3D;
  /** Outer face (offset +thickness/2 along normal, accounting for `flip`). */
  readonly outerEdge: Polyline3D;
  /** Inner face (offset -thickness/2). */
  readonly innerEdge: Polyline3D;
  readonly bbox: BoundingBox3D;
  /** m — geometric axis length. */
  readonly length: number;
  /** m² — `length × height`, net of openings when computed with the opening
   *  list (ADR-395 G6); gross otherwise (render/grips/3D path). */
  readonly area: number;
  /** m³ — `area × thickness/1000` (follows net area when openings subtracted). */
  readonly volume: number;
}

// ─── Entity (BIM generic instantiation) ─────────────────────────────────────

/**
 * Wall BIM entity. Extends `BimEntity` (ADR-363 §5.1) με:
 *   - `kind: WallKind` (discriminator για variant-specific rendering)
 *   - `hostedOpeningIds` — back-reference για render + QTO subtraction (Phase 2).
 *     ReadOnly array για immutability — mutations through service layer.
 */
export interface WallEntity
  extends BimEntity<WallKind, WallParams, WallGeometry>,
    IfcEntityMixin {
  readonly type: 'wall';
  readonly hostedOpeningIds?: readonly string[];
  /** ADR-369 §9 Q8 — IFC4 class. 'IfcWallStandardCase' για straight, 'IfcWall' για curved/polyline. */
  readonly ifcType: 'IfcWall' | 'IfcWallStandardCase';
  /** ADR-412 — FK → BimFamilyType.id. Absent on legacy/untyped walls. */
  readonly typeId?: string;
  /**
   * ADR-412 — Per-instance overrides of type-level params. Present only when
   * the instance deviates from its type. Merged over type params at resolution
   * time (type params first, overrides win). Absent = use type as-is.
   */
  readonly typeOverrides?: Partial<WallTypeParams>;
}

// ─── Defaults & constants ────────────────────────────────────────────────────

/** Default wall height (mm). Greek residential standard. */
export const DEFAULT_WALL_HEIGHT_MM = 3000;

/** Minimum allowable wall length (mm). Below this the wall is invalid. */
export const MIN_WALL_LENGTH_MM = 100;

/** Minimum allowable wall thickness (mm). ΝΟΚ ελάχιστο για δομικό στοιχείο. */
export const MIN_WALL_THICKNESS_MM = 50;

/** Maximum thickness for sanity-check (mm). Walls >2m are unphysical. */
export const MAX_WALL_THICKNESS_MM = 2000;
