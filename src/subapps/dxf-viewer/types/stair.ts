/**
 * Stair domain types — ADR-358 Phase 1.
 *
 * Discriminated union over 11 `StairKind` variants. Storage canonico in mm
 * (ISO/Firestore/DXF); display utente switchable cm/mm via formatter SSoT
 * (`systems/stairs/stair-units.ts`, Phase 5+).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md
 */
import type { Timestamp } from 'firebase/firestore';
import type { Point2D, Point3D } from '../rendering/types/Types';
import type { BaseEntity } from './entities';

// ============================================================================
// 3D GEOMETRY PRIMITIVES (stair-local; promote to shared module on Phase 9)
// ============================================================================

export type Polygon3D = readonly Point3D[];
export type Polyline3D = readonly Point3D[];

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

export interface StairParams {
  readonly basePoint: Point3D;
  readonly direction: number; // deg, 0 = +X

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
// QTO — IFC4 Qto_StairBaseQuantities (G23, §6.5)
// ============================================================================

export interface StairQTO {
  readonly grossVolume: number; // m³
  readonly netVolume: number; // m³
  readonly grossFootprintArea: number; // m²
  readonly netSideArea: number; // m²
  readonly height: number; // mm
  readonly length: number; // mm
  readonly handrailLinearMeters: number; // m
  readonly treadCladdingArea: number; // m²
}

// ============================================================================
// STAIR ENTITY (scene-level, extends BaseEntity)
// ============================================================================

export interface StairEditingLock {
  readonly userId: string;
  readonly since: Timestamp;
}

export interface StairEntity extends BaseEntity {
  readonly type: 'stair';
  readonly kind: StairKind;
  readonly params: StairParams;
  /** Computed cache — populated by StairGeometryService (Phase 3+). */
  readonly geometry: StairGeometry;
  readonly validation: StairValidationState;
  /** G24 — display-only soft-lock (does not block other users). */
  readonly editingBy?: StairEditingLock;
  readonly qto?: StairQTO;
  /** ADR-358 Phase 9D-5c — dedicated level ID (replaces layer-field abuse). */
  readonly levelId?: string;
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
  readonly qto?: StairQTO;

  readonly editingBy?: StairEditingLock;

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
      'spiral',
      'helical',
      'elliptical',
      'winder',
      'triangular-fan',
      'triangular-outline',
      'sketch',
      'v-shape',
    ] as const
  ).includes(value as StairKind);
