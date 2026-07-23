/**
 * Stair domain types — ADR-358 Phase 1, migrated to bim/ in Phase 0.5.
 *
 * Discriminated union over 11 `StairKind` variants. Storage canonical in mm
 * (ISO/Firestore/DXF); display user switchable cm/mm via formatter SSoT.
 *
 * StairEntity extends BimEntity<StairKind, StairParams, StairGeometry>
 * (ADR-363 Phase 0.5 migration).
 *
 * NOTE: Uses rendering/types/Types Point3D (z: required) — NOT bim-base Point3D (z?: optional).
 * Stair geometry requires z for 3D flight math (spiral centerPoint, multi-story z coords).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §Phase0.5
 */
import type { Timestamp } from 'firebase/firestore';
import type { Point2D, Point3D } from '../../rendering/types/Types';
export type { Point2D, Point3D };
import type { BimEntity, BimLock } from './bim-base';
import type { StairTopBinding, StairBaseBinding } from './bim-binding';
// ADR-539 Φ7 — per-sub-element full appearance (Polygon paint parity με τα solids).
import type { FaceAppearance } from './face-appearance-types';

// ============================================================================
// 3D GEOMETRY PRIMITIVES (stair-local; z required — uses rendering Point3D)
// ============================================================================

export type Polygon3D = readonly Point3D[];
export type Polyline3D = readonly Point3D[];

/**
 * Generic 3D segment (start → end).
 *
 * For `StairGeometry.risers` specifically, the convention is DIAGONAL
 * (ADR-370 Phase 5.3, 2026-05-25):
 *   - `start` = corner A on one width edge @ z = zLow (bottom of riser)
 *   - `end`   = OPPOSITE corner B on the other width edge @ z = zHigh (top)
 *
 * Diagonal encoding lets one segment carry midpoint, width axis, AND width
 * magnitude — no extra params context needed downstream. Replaces the legacy
 * "vertical line at one edge" convention (start.xy === end.xy) which silently
 * broke 3D rendering: BoxGeometry rotation was unknown and the mesh was
 * positioned at a corner instead of the midpoint.
 *
 * `Segment3D` for the `cutLine` field remains a plain 3D segment.
 */
export interface Segment3D {
  readonly start: Point3D;
  readonly end: Point3D;
}

export interface BoundingBox3D {
  readonly min: Point3D;
  readonly max: Point3D;
}

// ============================================================================
// KIND DISCRIMINATOR (§5.1)
// ============================================================================

export type StairKind =
  | 'straight'
  | 'l-shape'
  | 'u-shape'
  | 'gamma'
  | 'multi-flight'
  | 'spiral'
  | 'helical'
  | 'elliptical'
  | 'winder'
  | 'triangular-fan'
  | 'triangular-outline'
  | 'sketch'
  | 'v-shape';

// ============================================================================
// PARAMETRIC SUB-TYPES
// ============================================================================

export type StairStructureType =
  | 'monolithic'
  | 'stringer-1side'
  | 'stringer-2side'
  | 'central-stringer'
  | 'cantilever'
  | 'suspended'
  | 'glass-tread'
  | 'steel-grating';

export type StairRiserType = 'closed' | 'open';

export type StairNosingSide = 'front' | 'none' | 'front-and-sides';

export type StairCodeProfile =
  | 'nok'
  | 'ibc'
  | 'eurocode'
  | 'nbc'
  | 'nfpa'
  | 'as1657'
  | 'din'
  | 'ada'
  | 'none';

/**
 * ADR-358 Phase 3g — NOK stair scope.
 *
 * Maps to PD 3046/304/89 Άρθρο 13 παρ. 2-4 (Κτιριοδομικός Κανονισμός):
 *   - `'main'` (1.20 m): central staircase of multi-storey building (παρ. 2 base rule)
 *   - `'low-rise'` (0.90 m): residential building ≤3 floors (παρ. 2 exception α)
 *   - `'internal'` (0.60 m): internal stair of single dwelling/μεζονέτα (παρ. 2 exception β)
 *   - `'auxiliary'` (0.60 m): auxiliary stair industrial/storage (παρ. 4.5)
 *
 * Legacy `'secondary'` is retained for back-compat with Phase 6 docs;
 * `useStairPersistence.hydrateLegacyParams` rewrites it to `'low-rise'`.
 */
export type StairNokSubType =
  | 'main'
  | 'low-rise'
  | 'internal'
  | 'auxiliary'
  | 'secondary';

export type StairTreadLabelDisplay = 'all' | 'nth' | 'none';

export type StairUpDirection = 'forward' | 'backward';

export type StairTurnDirectionLR = 'left' | 'right';
export type StairTurnDirectionCW = 'cw' | 'ccw';

export type StairLandingCornerStyle = 'square' | 'chamfer' | 'fillet';

export type StairWinderMethod = 'equal-going' | 'kite' | 'balanced' | 'pie';

export interface StairMultiStoryConfig {
  readonly topLevel: string;
  readonly storyHeight: number; // mm
  readonly storyCount: number;
  /**
   * ADR-358 Phase 9 — Q17 floor-link state. `true` when `storyHeight`
   * tracks the building floor's height (auto-set on stair creation when
   * a `floorId` is in scope, and via "Reset to floor" in the ribbon).
   * Set to `false` whenever the user overrides `storyHeight` manually
   * (ribbon edit, grip drag, or programmatic patch).
   */
  readonly linkedToFloor?: boolean;
}

export interface StairStringerParams {
  readonly width: number; // mm
  readonly height: number; // mm
  readonly sides: 'left' | 'right' | 'both' | 'center';
}

export interface StairMaterials {
  readonly tread?: string;
  readonly riser?: string;
  readonly stringer?: string;
  readonly landing?: string;
}

export interface StairPerTreadOverride {
  readonly material?: string;
  readonly nosing?: number; // mm
  readonly customProfile?: readonly Point2D[];
  /**
   * ADR-539 Φ7 — full per-face appearance (materialId textured/catalog Ή colorHex), βαμμένο από
   * την παλέτα «ΠΟΛΥΓΩΝΑ» ΑΚΡΙΒΩΣ όπως τα solids (Revit «Paint» / Cinema 4D material tag). Κερδίζει
   * του legacy `material` preset string στο `resolveStairMaterial`. Απών → πέφτει στο `material`
   * → structure default. Κοινό `FaceAppearance` SSoT με τα δομικά solids (μηδέν δεύτερο μοντέλο).
   */
  readonly appearance?: FaceAppearance;
}

/**
 * ADR-358 Q19 Φ7 — per-riser override. A riser carries ONLY a material override
 * (unlike a tread it has no nosing / nosing-profile — those are tread-face finish
 * concepts). Keyed by the 0-based GLOBAL build-order riser index — the same key
 * the 3D `stairComponentIndex` tag and `resolveStairMaterial`'s `subIndex` use.
 */
export interface StairPerRiserOverride {
  readonly material?: string;
  /** ADR-539 Φ7 — full per-face appearance (βλ. {@link StairPerTreadOverride.appearance}). */
  readonly appearance?: FaceAppearance;
}

/**
 * ADR-539 Φ7 — per-landing / per-waist appearance override («πλατύσκαλο» / «πλάκα σκάλας»),
 * pickable & paintable per-index υπό «ΠΟΛΥΓΩΝΑ». Keyed by the 0-based `stairComponentIndex`
 * tag (== waist-slab / landing build order). Μόνο appearance (καμία geometry/nosing έννοια).
 */
export interface StairPerComponentAppearanceOverride {
  readonly appearance?: FaceAppearance;
}

/**
 * ADR-637 — a single intermediate "πλατύσκαλο" (rest landing) placed anywhere
 * along a stair run, INDEPENDENT of the stair kind. Consumed by every kind via
 * `planStairRunSegments` (bim/geometry/stairs/stair-run-landings.ts): rectilinear
 * kinds emit a `buildCornerLanding` quad, walkline kinds emit a flat-z stretch.
 *
 *   - `id`     — stable identity (survives edits) so a grip/selection can target
 *                one landing when a run carries several. Not a Firestore doc id.
 *   - `at`     — position along the developed run, `0..1`. Mapped to a discrete
 *                level `round(at·(stepCount−1))`, clamped to `[1, stepCount−2]`.
 *                Dragging the landing changes `at` → treads re-flow either side.
 *   - `length` — plan length along travel (scene units). `'auto'` → `width`
 *                (square landing). Grip-editable.
 *   - `depth`  — cross-width extent (scene units). `'auto'`/absent → `width`.
 *
 * A rest landing consumes exactly one rise level (like L-shape's `n1+1+n2`),
 * so total rise / riser count stay invariant; only the plan footprint grows.
 */
export interface StairRestLanding {
  readonly id: string;
  readonly at: number;
  readonly length: 'auto' | number;
  readonly depth?: 'auto' | number;
}

export interface StairHandrails {
  readonly inner: boolean;
  readonly outer: boolean;
  readonly height: number; // mm (default 900)
  readonly topExtension?: number; // mm (G19, ADA default 305)
  readonly bottomExtension?: 'one-tread' | number;
}

// ============================================================================
// VARIANT DISCRIMINATED UNION (§5.1 — geometry inputs per kind)
// ============================================================================

export type StairVariantParams =
  | StairVariantStraight
  | StairVariantLShape
  | StairVariantUShape
  | StairVariantGamma
  | StairVariantMultiFlight
  | StairVariantSpiral
  | StairVariantHelical
  | StairVariantElliptical
  | StairVariantWinder
  | StairVariantTriangularFan
  | StairVariantTriangularOutline
  | StairVariantSketch
  | StairVariantVShape;

export interface StairVariantStraight {
  readonly kind: 'straight';
}

/**
 * ADR-358 Phase 3f — L-shape stair discriminated on `cornerStyle`. Industry
 * pattern (Revit/ArchiCAD/AutoCAD Architecture/Vectorworks/BricsCAD BIMSTAIR):
 * L-shape is a single kind; the corner detail is a sub-option.
 *
 *   - `'landing'` — current behavior (πλατύσκαλο); `n1 + 1 + n2 = stepCount`.
 *   - `'winders'` — NOK-compliant winder treads (σκαλοπάτια κουρμπαριστά) at
 *     the corner, preserving going on the walkline; `n1 + winderCount + n2 = stepCount`.
 */
export type StairVariantLShape = StairVariantLShapeLanding | StairVariantLShapeWinders;

export interface StairVariantLShapeLanding {
  readonly kind: 'l-shape';
  readonly cornerStyle: 'landing';
  readonly turnDirection: StairTurnDirectionLR;
  readonly landingDepth: 'auto' | number;
  readonly landingCornerStyle?: StairLandingCornerStyle;
  readonly landingCornerRadius?: number;
  readonly flightSplit: readonly [number, number]; // n1 + n2 = stepCount - 1
}

export interface StairVariantLShapeWinders {
  readonly kind: 'l-shape';
  readonly cornerStyle: 'winders';
  readonly turnDirection: StairTurnDirectionLR;
  readonly winderCount: number;             // default 3 (NOK quarter-turn)
  readonly winderMethod: StairWinderMethod; // 'equal-going' default (walkline-preserving)
  readonly flightSplit: readonly [number, number]; // n1 + n2 = stepCount - winderCount
}

export function isLShapeLandingVariant(v: StairVariantParams): v is StairVariantLShapeLanding {
  return v.kind === 'l-shape' && v.cornerStyle === 'landing';
}

export function isLShapeWindersVariant(v: StairVariantParams): v is StairVariantLShapeWinders {
  return v.kind === 'l-shape' && v.cornerStyle === 'winders';
}

export interface StairVariantUShape {
  readonly kind: 'u-shape';
  readonly turnDirection: StairTurnDirectionLR;
  readonly landingDepth: 'auto' | number;
  readonly landingCornerStyle?: StairLandingCornerStyle;
  readonly landingCornerRadius?: number;
  readonly flightSplit: readonly [number, number];
}

export interface StairVariantGamma {
  readonly kind: 'gamma';
  readonly turnSequence: readonly [StairTurnDirectionLR, StairTurnDirectionLR];
  readonly landings: readonly ['auto' | number, 'auto' | number];
  readonly landingCornerStyle?: StairLandingCornerStyle;
  readonly flightSplit: readonly [number, number, number];
}

/**
 * ADR-633 — Multi-flight stair with user-authored turn points on the parieta.
 *
 * Generalizes l-shape (1 turn, 90°) / gamma (2 turns, 90°) to an ARBITRARY
 * number of turns, each at an arbitrary plan-view angle and side. The user
 * clicks a side (parieta) of a straight run in plan view; the clicked side
 * decides the turn direction (right parieta → `'right'`, left → `'left'`) and
 * the click position splits the run into consecutive `flights`. Each junction
 * carries a `StairTurnNode` (angle + landing/winders corner style).
 *
 * z-model (matches gamma): each turn's landing consumes one rise — flight `k`
 * top tread at `z = zStart_k + rise·(n_k−1)`, landing at `zStart_k + rise·n_k`,
 * flight `k+1` first tread at `zStart_k + rise·(n_k+1)`.
 *
 * The turn tool always authors this variant (single SSoT); l-shape/gamma remain
 * as ribbon presets. Geometry: `stair-geometry-multiflight.ts` (ADR-611 reuse).
 */
export interface StairTurnNode {
  /** Side clicked → turn direction. `'left'` = ccw (+angle), `'right'` = cw (−angle). */
  readonly turnDirection: StairTurnDirectionLR;
  /** Plan-view direction change in degrees (default 90). The pitch is unchanged. */
  readonly turnAngleDeg: number;
  /** Corner detail — Phase 1 supports `'landing'`; Phase 2 adds `'winders'`. */
  readonly cornerStyle: 'landing' | 'winders';
  /** Landing depth for `cornerStyle: 'landing'`. `'auto'` → `params.width`. */
  readonly landingDepth?: 'auto' | number;
  /** Winder tread count for `cornerStyle: 'winders'` (Phase 2). */
  readonly winderCount?: number;
  /** Winder distribution method for `cornerStyle: 'winders'` (Phase 2). */
  readonly winderMethod?: StairWinderMethod;
}

export interface StairVariantMultiFlight {
  readonly kind: 'multi-flight';
  /** Per-flight tread counts. `length = turns.length + 1`, each `≥ 1`. */
  readonly flights: readonly number[];
  /** One turn node between consecutive flights `k` and `k+1`. */
  readonly turns: readonly StairTurnNode[];
}

export function isMultiFlightVariant(
  v: StairVariantParams,
): v is StairVariantMultiFlight {
  return v.kind === 'multi-flight';
}

export interface StairVariantSpiral {
  readonly kind: 'spiral';
  readonly centerPoint: Point3D;
  readonly innerRadius: 0;
  readonly sweepAngle: number; // deg
  readonly turnDirection: StairTurnDirectionCW;
}

export interface StairVariantHelical {
  readonly kind: 'helical';
  readonly centerPoint: Point3D;
  readonly innerRadius: number; // mm
  readonly outerRadius: number; // mm — constraint: outerRadius = innerRadius + width
  readonly sweepAngle: number; // deg
  readonly turnDirection: StairTurnDirectionCW;
}

export interface StairVariantElliptical {
  readonly kind: 'elliptical';
  readonly centerPoint: Point3D;
  readonly semiMajor: number; // mm
  readonly semiMinor: number; // mm
  readonly sweepAngle: number; // deg
  readonly turnDirection: StairTurnDirectionCW;
  readonly rotation: number; // deg
}

export interface StairVariantWinder {
  readonly kind: 'winder';
  readonly turnAngle: number; // deg
  readonly winderCount: number;
  readonly winderMethod: StairWinderMethod;
}

export interface StairVariantTriangularFan {
  readonly kind: 'triangular-fan';
  readonly apexPoint: Point3D;
  readonly openingAngle: number; // deg
  readonly stepCountPerArc: number;
  readonly turnDirection: StairTurnDirectionCW;
}

export interface StairVariantTriangularOutline {
  readonly kind: 'triangular-outline';
  readonly triangleVertices: readonly [Point3D, Point3D, Point3D];
  readonly entrySide: 0 | 1 | 2;
  readonly orientation: StairTurnDirectionCW;
}

export interface StairVariantSketch {
  readonly kind: 'sketch';
  readonly walklinePath: readonly Point3D[];
  /**
   * ADR-619 — όταν `true`, το `walklinePath` φέρει ΗΔΗ το σωστό z ανά σημείο (μεικτά
   * z: ανοδικά πατήματα + επίπεδα πλατύσκαλα multi-flight) και το `computeSketch`
   * ΔΕΝ επιβάλλει uniform rise. Απόν/false = κλασικό ενιαίο riser (z_i = i·rise).
   */
  readonly preserveZ?: boolean;
}

/**
 * ADR-358 Phase 3c — V-shape: two straight arms diverging from a shared
 * basePoint at the apex (z=0). No landing; arms ascend independently in
 * directions `d` and `d + armAngleDeg` (math frame, CCW positive). Arm i
 * yields `armSplit[i]` treads at z = j·rise for j=0..armSplit[i]−1.
 *
 * `stepCount = armSplit[0] + armSplit[1]`. Industry analogue: Revit
 * "Multi-Story / Custom Sketched Run" without a connecting landing.
 *
 * Constraints (validated in `computeVShape`):
 *   - `armAngleDeg ∈ [15, 170]` (excludes near-overlap and near-180°
 *     degenerate "two straights back-to-back" which is just `straight`).
 *   - `armSplit[i] ≥ 1`.
 */
export interface StairVariantVShape {
  readonly kind: 'v-shape';
  readonly armAngleDeg: number;
  readonly armSplit: readonly [number, number];
}

// ============================================================================
// STAIR PARAMS (§5.1)
// ============================================================================

/**
 * Shared stair parameters — the type-level subset carried by BOTH a placed
 * `StairParams` and a `StairTypeParams` family type (ADR-412). Holds every field
 * EXCEPT the per-placement geometry (`basePoint`, `direction`) and the
 * instance-only overrides (`perRiserOverrides`, `restLandings`). Extracted as the
 * SSoT base so the two interfaces never drift into parallel twins (ADR-583 / N.18).
 */
export interface StairSharedParams {
  readonly rise: number; // mm
  readonly tread: number; // mm (excl. nosing)
  readonly nosing: number; // mm
  readonly nosingSide: StairNosingSide;
  readonly width: number; // mm
  readonly stepCount: number;

  readonly totalRise: number; // mm — raw OR computed da multiStoryConfig (G11)
  readonly totalRun: number; // mm
  readonly pitch: number; // deg

  readonly multiStoryConfig?: StairMultiStoryConfig;

  readonly structureType: StairStructureType;
  readonly stringerParams?: StairStringerParams;

  /**
   * ADR-395 G1 — equivalent RC waist-slab thickness (mm) for the concrete
   * volume BOQ row. Per-stair editable override; when `undefined` the BOQ
   * calculator falls back to `DEFAULT_WAIST_SLAB_THICKNESS_MM` (150 mm,
   * industry typical residential RC). NOT consumed by `computeStairGeometry`
   * (BOQ-only input, stored in plain mm — no scene-unit scaling).
   */
  readonly waistThickness?: number; // mm

  /**
   * ADR-358 (2026-07-21) — 3D landing structural depth (mm), Revit "Monolithic
   * Landing → Total Depth". `undefined` ⇒ "Same as Run": the landing inherits
   * `waistThickness` (the μηρός), then the 150 mm SSoT default. Editable 20–400 mm
   * via the ribbon — a BROADER floor than the RC `waistThickness` [80,400] so a
   * thin/timber landing (e.g. 40 mm) renders, DECOUPLED from the reinforced-concrete
   * waist minimum (a wooden landing has no RC waist). 3D-only: consumed by
   * `StairToThreeConverter.resolveLandingThicknessMm`, NOT `computeStairGeometry`.
   */
  readonly landingThickness?: number; // mm

  readonly riserType: StairRiserType;
  readonly materials?: StairMaterials;
  readonly perTreadOverrides?: Readonly<Record<number, StairPerTreadOverride>>;
  readonly antiskidNosing: boolean;
  readonly adaContrastStrip: boolean;

  /** Project default 1200mm; per-stair override optional (Q21). */
  readonly cutPlaneHeight?: number;

  readonly variant: StairVariantParams;

  readonly walklineOffset: number; // mm (default 300)
  readonly handrails: StairHandrails;
  readonly upDirection: StairUpDirection;

  readonly treadNumberStart: number; // G21 default 1
  readonly treadLabelDisplay: StairTreadLabelDisplay;
  readonly treadLabelEveryN?: number;
  readonly treadLabelRestartPerFlight: boolean;
  /**
   * ADR-358 G21 — tread label text height in scene-units (world-scaled).
   * Default 80 mm scaled to scene units (≈ 0.08 m / 8 cm / 80 mm).
   * Override per-stair via the floating panel. Industry-aligned with AutoCAD
   * MTEXT (world-units text), Revit annotative scale.
   */
  readonly treadLabelHeight?: number;

  /** Project default (Q27, can inherit); per-stair override optional. */
  readonly occupancyLoad?: number;

  readonly codeProfile: StairCodeProfile;
  readonly nokSubType?: StairNokSubType;

  /** ADR-369 — Storey FK (alias for floorId). */
  readonly storeyId?: string;
  /** ADR-369 — Elevation offset from storey reference (mm). Default 0. */
  readonly offsetFromStorey?: number;

  // ─── ADR-401 Phase G — Attach-to-structural (top/base → πλάκα/δοκάρι/landing) ──
  //
  // Optional για back-compat (υπάρχουσες σκάλες χωρίς τα πεδία). Όταν λείπουν, η
  // σκάλα συμπεριφέρεται όπως πριν: top = `unconnected` (ύψος από `totalRise` /
  // `stepCount`), base = `storey-floor` (FFL + `offsetFromStorey`). Βλ.
  // `DEFAULT_STAIR_TOP_BINDING` / `DEFAULT_STAIR_BASE_BINDING` (bim-binding.ts).
  /**
   * Πώς δένεται η ΚΟΡΥΦΗ της σκάλας. `'attached'` → η άφιξη ακολουθεί τη δομική
   * κάτω-παρειά των `attachTopToIds` (lower-envelope) με **ακέραια σκαλοπάτια**
   * (Revit risers): `totalRise = hostUnderside − base`, `stepCount =
   * round(totalRise / rise)`. Resolved live από `resolveStairVerticalProfile`,
   * ΔΕΝ αποθηκεύεται ως scalar. Default (undefined) = `'unconnected'`.
   */
  readonly topBinding?: StairTopBinding;
  /**
   * Πώς δένεται η ΒΑΣΗ της σκάλας. `'attached'` → η βάση «κάθεται» πάνω στην άνω
   * παρειά των `attachBaseToIds` (upper-envelope: πλάκα/πεδιλοδοκός/landing από
   * κάτω). Default (undefined) = `'storey-floor'`.
   */
  readonly baseBinding?: StairBaseBinding;
  /** Host FK ids όταν `topBinding === 'attached'` (≥1, validated). */
  readonly attachTopToIds?: readonly string[];
  /** Host FK ids όταν `baseBinding === 'attached'` (≥1, validated). */
  readonly attachBaseToIds?: readonly string[];
}

/**
 * Full placed-stair params: the shared type-level subset ({@link StairSharedParams})
 * plus the per-placement geometry (`basePoint`, `direction`) and the instance-only
 * overrides (`perRiserOverrides`, `restLandings`).
 */
export interface StairParams extends StairSharedParams {
  readonly basePoint: Point3D;
  readonly direction: number; // deg, 0 = +X

  /** ADR-358 Q19 Φ7 — per-riser material overrides (0-based global build-order key). */
  readonly perRiserOverrides?: Readonly<Record<number, StairPerRiserOverride>>;

  /**
   * ADR-539 Φ7 — per-landing («πλατύσκαλο») appearance overrides, keyed by the 0-based
   * landing build order (== `stairComponentIndex` του landing mesh). Painted υπό «ΠΟΛΥΓΩΝΑ».
   */
  readonly perLandingOverrides?: Readonly<Record<number, StairPerComponentAppearanceOverride>>;
  /**
   * ADR-539 Φ7 — per-waist («πλάκα σκάλας», ο κεκλιμένος μηρός) appearance overrides, keyed by
   * the 0-based waist-slab build order (1 ανά σκέλος). Painted υπό «ΠΟΛΥΓΩΝΑ».
   */
  readonly perWaistOverrides?: Readonly<Record<number, StairPerComponentAppearanceOverride>>;

  /**
   * ADR-637 — kind-independent intermediate rest landings (πλατύσκαλα). Optional
   * for back-compat: absent/empty → the run is a single uninterrupted flight and
   * geometry stays byte-identical to the pre-ADR-637 path. Planned + consumed via
   * `planStairRunSegments`. Distinct from turn landings (which live in the variant
   * and imply a direction change) — a rest landing keeps the travel direction.
   */
  readonly restLandings?: readonly StairRestLanding[];
}

// ============================================================================
// COMPUTED GEOMETRY (§5.1 — output of StairGeometryService Phase 3+)
// ============================================================================

export interface StairTreadLabel {
  readonly treadIndex: number;
  readonly position: Point3D;
  readonly text: string;
  /** ADR-358 Phase 3e G21γ — `'landing'` for label centroid on a landing polygon. */
  readonly kind?: 'tread' | 'landing';
}

export interface StairArrowSymbol {
  readonly start: Point3D;
  readonly end: Point3D;
  readonly label: 'UP' | 'DOWN';
}

export interface StairStringerGeometry {
  readonly inner: Polyline3D;
  readonly outer: Polyline3D;
}

export interface StairHandrailGeometry {
  readonly inner?: Polyline3D;
  readonly outer?: Polyline3D;
}

/**
 * ADR-637 Phase 4-A — per-rest-landing handle metadata for interactive grips.
 * Emitted by `buildRectilinearRun` from the SAME cursor walk that builds the
 * landing quad (SSoT — center/along/length can never disagree with the geometry).
 * Surfaced on `StairGeometry.restLandingHandles` and consumed by
 * `pushRestLandingGrips` (slide + length grips) — see `bim/stairs/stair-grips.ts`.
 */
export interface RestLandingHandle {
  /** The `StairRestLanding.id` this handle targets (grip → landing identity). */
  readonly id: string;
  /** Landing quad centroid, world coords (slide grip anchor). */
  readonly center: Point3D;
  /** Unit travel direction of this landing's flight (slide + length axes). */
  readonly along: Point2D;
  /** Resolved plan length along travel (scene units). */
  readonly length: number;
  /** Resolved cross-width depth (scene units). */
  readonly depth: number;
}

export interface StairGeometry {
  /** Legacy alias = treadsBelowCut. Kept for backward-compat with §6.2 render pipeline. */
  readonly treads: readonly Polygon3D[];
  /** G14 — solid render (below cut plane). */
  readonly treadsBelowCut: readonly Polygon3D[];
  /** G14 — dashed render (above cut plane). */
  readonly treadsAboveCut: readonly Polygon3D[];
  readonly risers: readonly Segment3D[];
  readonly stringers: StairStringerGeometry;
  readonly walkline: Polyline3D;
  readonly handrails: StairHandrailGeometry;
  readonly landings: readonly Polygon3D[];
  readonly arrowSymbol: StairArrowSymbol;
  /** G14 — break-line zigzag 45° (ISO 128) when stair crosses cut plane. */
  readonly cutLine?: Segment3D;
  readonly treadLabels?: readonly StairTreadLabel[];
  /**
   * ADR-637 Phase 4-A — per-rest-landing grip handle metadata (SSoT for grip
   * placement). Absent when the stair carries no rest landings (back-compat).
   */
  readonly restLandingHandles?: readonly RestLandingHandle[];
  readonly bbox: BoundingBox3D;
}

// ============================================================================
// VALIDATION RESULT (engine = ADR-186 Phase 6)
// ============================================================================

export interface StairValidationState {
  readonly hasCodeViolations: boolean;
  /** i18n message keys (no hardcoded strings). */
  readonly violationKeys: readonly string[];
  /**
   * ADR-358 Phase 9 — hard errors (blocking) surfaced separately from
   * soft code violations so the UI can render them red (stop) while
   * the warnings stay orange. Subset of `violationKeys`. Hard errors
   * include zero/invalid geometry (`stepCount`, `width`, `rise`,
   * `tread`, `totalRise`).
   */
  readonly hardErrors?: readonly string[];
  readonly headroomViolations?: readonly string[];
  readonly egressViolations?: readonly string[];
  readonly adaViolations?: readonly string[];
  /**
   * ADR-358 Phase 3g — soft "comfort" warnings (yellow). NOT code violations.
   * Surfaced when width ≥ legal minimum but below industry comfort threshold
   * (e.g. internal stair 600 mm legal but <800 mm scomodo). Routes to the
   * orange/yellow band in the UI instead of red. Subset disjoint from
   * `violationKeys` (which carry legal violations only).
   */
  readonly comfortViolations?: readonly string[];
  readonly lastValidatedAt: Timestamp;
}

// ============================================================================
// STAIR ENTITY — extends BimEntity<> (ADR-363 Phase 0.5)
// ============================================================================

/**
 * ADR-358 G24 — display-only soft-lock. Extends BimLock (userId required by BimEntity).
 * `since` replaces `lockedAt` (stair-specific naming — legacy Firestore docs use `since`).
 */
export interface StairEditingLock extends BimLock {
  readonly since: Timestamp;
}

/**
 * StairEntity extends BimEntity<StairKind, StairParams, StairGeometry>.
 *
 * kind, params, geometry come from BimEntity<>.
 * validation overrides BimValidation with the richer StairValidationState (structural subtype).
 * editingBy uses StairEditingLock (extends BimLock — has userId).
 *
 * ADR-395 §4.6 (G5): no `qto` field — stair quantities are geometry-derived
 * via `computeStairBoqQuantities` (BOQ sync + Schedule combined preset).
 *
 * ADR-363 Phase 0.5: migrated from types/stair.ts. Barrel re-export preserved at old path.
 */
export interface StairEntity extends BimEntity<StairKind, StairParams, StairGeometry> {
  readonly type: 'stair';
  /** Overrides BimValidation with richer stair-specific validation state. */
  readonly validation: StairValidationState;
  /** G24 — display-only soft-lock (does not block other users). */
  readonly editingBy?: StairEditingLock;
  /** ADR-358 Phase 9D-5c — dedicated level ID (replaces layer-field abuse). */
  readonly levelId?: string;
  /**
   * ADR-526 Φ3 — αυθεντικό Tekton `<stair><record>` XML, όταν η σκάλα **εισήχθη από `.tek`**
   * (preserve-and-replay). Όταν υπάρχει κι η σκάλα δεν τροποποιήθηκε, ο tek exporter το εκπέμπει
   * **αυτούσιο** → byte-faithful round-trip (ΑΚΡΙΒΗΣ αναπαραγωγή των ιδιόκτητων Tekton συμβόλων).
   * `undefined` για σκάλες σχεδιασμένες στον Νέστορα (→ παραμετρικό export).
   */
  readonly sourceTekRecord?: string;
}

// ============================================================================
// FIRESTORE DOCUMENT (collection `floorplan_stairs`, ADR-358 §6.1)
// ============================================================================

export interface StairDoc {
  readonly id: string; // enterprise ID `stair_<ulid26>`
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layer?: string;
  /** ADR-358 Phase 9D-5c — dedicated level ID (replaces layer-field abuse). */
  readonly levelId?: string;

  readonly kind: StairKind;
  readonly params: StairParams;
  readonly geometry?: StairGeometry; // optional — re-derivable from params
  readonly validation: StairValidationState;

  readonly editingBy?: StairEditingLock;
  /** ADR-526 Φ3 — αυθεντικό Tekton `<record>` XML (preserve-and-replay· σκάλες εισαγμένες από .tek). */
  readonly sourceTekRecord?: string;

  readonly createdBy: string;
  readonly createdAt: Timestamp;
  readonly updatedBy: string;
  readonly updatedAt: Timestamp;
}

// ============================================================================
// STAIR PRESET (G26, §6.6 — collection `stair_presets`)
// ============================================================================

export type StairPresetScope = 'user' | 'company' | 'project';

export interface StairPresetDoc {
  readonly id: string; // enterprise ID `sprst_<ulid26>`
  readonly name: string;
  readonly scope: StairPresetScope;
  readonly ownerId: string;
  readonly companyId: string;
  readonly projectId?: string;

  readonly kind: StairKind;
  /** Frozen subset of `StairParams` (no basePoint/direction — those come from the active draw). */
  readonly params: Omit<StairParams, 'basePoint' | 'direction'>;

  readonly createdBy: string;
  readonly createdAt: Timestamp;
  readonly updatedBy: string;
  readonly updatedAt: Timestamp;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export const isStairKind = (value: unknown): value is StairKind =>
  typeof value === 'string' &&
  (
    [
      'straight',
      'l-shape',
      'u-shape',
      'gamma',
      'multi-flight',
      'spiral',
      'helical',
      'elliptical',
      'winder',
      'triangular-fan',
      'triangular-outline',
      'sketch',
      'v-shape',
    ] as const satisfies readonly StairKind[]
  ).includes(value as StairKind);
