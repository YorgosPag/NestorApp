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
  | 'sketch';

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

export type StairNokSubType = 'main' | 'secondary';

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
  | StairVariantSketch;

export interface StairVariantStraight {
  readonly kind: 'straight';
}

export interface StairVariantLShape {
  readonly kind: 'l-shape';
  readonly turnDirection: StairTurnDirectionLR;
  readonly landingDepth: 'auto' | number;
  readonly landingCornerStyle?: StairLandingCornerStyle;
  readonly landingCornerRadius?: number;
  readonly flightSplit: readonly [number, number];
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
  readonly headroomViolations?: readonly string[];
  readonly egressViolations?: readonly string[];
  readonly adaViolations?: readonly string[];
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
    ] as const
  ).includes(value as StairKind);
