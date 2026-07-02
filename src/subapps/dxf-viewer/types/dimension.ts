/**
 * ADR-362 Phase A1 — Enterprise Dimension System types.
 *
 * Discriminated union `DimensionEntity` covering all 10 DIMENSION variants
 * (Linear/Aligned/Angular2L/Angular3P/Radius/Diameter/ArcLength/JoggedRadius/Ordinate/Baseline/Continued)
 * plus the `DimStyle` table (~60 DIMSTYLE variables, ISO 129 / ASME Y14.5 superset).
 *
 * Common shape:
 *   - `type: 'dimension'` discriminates inside the global `Entity` union.
 *   - `dimensionType` discriminates between the 10 variants below.
 *   - `defPoints: readonly Point2D[]` — ordered definition points, semantic per variant
 *     (e.g. Linear: [extOrigin1, extOrigin2, dimLineRef]; Radial: [center, arcPoint]).
 *     `DimensionAssociation.defPointIndex` indexes into this array (D11 associativity).
 *   - `styleId` references a `DimStyle.id` from the active registry; per-entity overrides
 *     via `overrides: DimensionOverride` (Partial<DimStyle>, D7 ribbon contextual tab).
 *
 * Legacy back-compat (Phase A1 only): `startPoint`/`endPoint`/`textPosition`/`value`/`unit`/`precision`
 * carried over as optional fields so existing consumers (rendering/cache/PathCache.ts,
 * snapping/engines/InsertionSnapEngine.ts) still compile. To be removed in Phase B-C
 * when the new geometry builders + renderer come online.
 */

import type { Point2D } from '../rendering/types/Types';
import type { BaseEntity } from './entities';
// ADR-562 Φ1 — reuse the canonical lineweight SSoT (DXF g370, mm + special enums)
// so per-part dim lineweights feed the SAME lineweight→px resolver as lines/layers.
import type { LineweightMm } from './scene-types';

// ──────────────────────────────────────────────────────────────────────────────
// DimensionType — sub-discriminator inside `type: 'dimension'`
// ──────────────────────────────────────────────────────────────────────────────

export type DimensionType =
  | 'linear'        // Horizontal / vertical / rotated by `rotation`
  | 'aligned'       // Parallel to the measured segment
  | 'angular2L'     // Angle between 2 line segments
  | 'angular3P'     // Angle from vertex + 2 rays
  | 'radius'        // Radius of arc/circle
  | 'diameter'      // Diameter of circle
  | 'arcLength'     // Arc-length (radial sub-type)
  | 'joggedRadius'  // Zig-zag radius for large arcs
  | 'ordinate'      // X or Y distance from a datum
  | 'baseline'      // Chained from a common baseline
  | 'continued';    // Chained end-to-end

// ──────────────────────────────────────────────────────────────────────────────
// DimStyle — ~60 DIMSTYLE variables (ISO 129 + ASME Y14.5 superset)
// ──────────────────────────────────────────────────────────────────────────────

/** DIMLUNIT — linear unit format. AutoCAD codes 1-6. */
export type DimLinearUnitFormat =
  | 'scientific'
  | 'decimal'
  | 'engineering'
  | 'architectural'
  | 'fractional'
  | 'windowsDesktop';

/** DIMAUNIT — angular unit format. AutoCAD codes 0-4. */
export type DimAngularUnitFormat =
  | 'decimalDegrees'
  | 'degMinSec'
  | 'gradians'
  | 'radians'
  | 'surveyorUnits';

/** DIMTAD — text vertical placement relative to dim line. */
export type DimTextVerticalPlacement =
  | 'centered'   // 0 — ASME default
  | 'above'      // 1 — ISO default
  | 'outside'    // 2
  | 'jis'        // 3
  | 'below';     // 4

/** DIMTFILL — text background mask mode (D12). */
export type DimTextFillMode =
  | 'none'             // 0
  | 'backgroundColor'  // 1 — drawing background
  | 'customColor';     // 2 — explicit color from `dimtfillclr`

/** DIMTOLJ — tolerance text vertical justification. */
export type DimToleranceJustify = 'bottom' | 'middle' | 'top';

/** DIMASSOC — associativity level (D11). */
export type DimAssociativity = 0 | 1 | 2;

/** Inspection dimension mode (D8 ASME). */
export type DimInspectionMode =
  | 'off'
  | 'rate0'
  | 'rate100'
  | 'rateCustom';

/**
 * Full DIMSTYLE — single source of truth for visual styling of dimensions.
 * Resolved at render time via chain: per-entity override → entity styleId → active style → built-in default.
 */
export interface DimStyle {
  /** Stable enterprise ID `dimstyle_<UUID-v4>`. */
  readonly id: string;
  /** Display name (e.g. "ISO 129", "ASME Y14.5", or user custom). */
  name: string;
  /** True for the 3 built-in templates (ISO/ASME/Arch) — cannot be deleted. */
  readonly isBuiltIn: boolean;

  // ── Lines & extensions ─────────────────────────────────────────────────────
  /** DIMCLRD — dim line color (ACI 1-255 or 0=ByBlock / 256=ByLayer). */
  dimclrd: number;
  /**
   * DIMLWD — dim line lineweight. ADR-562 Φ1. Reuses the canonical `LineweightMm`
   * SSoT (mm value, or `-3`=Default / `-2`=ByLayer / `-1`=ByBlock) so the 2D
   * renderer (Φ2) resolves it through the SAME lineweight→px path as lines.
   */
  dimlwd: LineweightMm;
  /**
   * DIMLTYPE — dim line linetype name (ADR-510 `linetypeName` convention:
   * `'ByLayer'` / `'Continuous'` / `'DASHED'` …). ADR-562 Φ1. Resolved to a dash
   * array at render via the Unified Linetype SSoT (`resolveAnyLinetype`).
   */
  dimltype: string;
  /** DIMCLRE — extension line color. */
  dimclre: number;
  /** DIMLWE — extension line lineweight (`LineweightMm` SSoT). ADR-562 Φ1. */
  dimlwe: LineweightMm;
  /**
   * DIMLTEX1 / DIMLTEX2 — linetype names for the first / second extension line.
   * ADR-562 Φ1. Unified UI sets both together for now; kept as 2 fields for the
   * future per-side phase + DXF (346/347) round-trip parity.
   */
  dimltex1: string;
  dimltex2: string;
  /** DIMEXE — extension beyond dim line (mm paper). */
  dimexe: number;
  /** DIMEXO — extension line offset from object (mm paper). */
  dimexo: number;
  /** DIMDLI — baseline-dim chain spacing (mm paper). */
  dimdli: number;
  /** Suppress first/second dim line (boolean flags). */
  suppressDimLine1: boolean;
  suppressDimLine2: boolean;
  /** Suppress first/second extension line. */
  suppressExtLine1: boolean;
  suppressExtLine2: boolean;

  // ── Symbols & arrows ───────────────────────────────────────────────────────
  /** DIMASZ — arrow size (mm paper). */
  dimasz: number;
  /** DIMBLK — arrowhead block name (used when both heads identical). */
  dimblk: string;
  /** DIMBLK1 — arrowhead block name for first arrow. */
  dimblk1: string;
  /** DIMBLK2 — arrowhead block name for second arrow. */
  dimblk2: string;
  /**
   * ADR-562 Φ1 — arrowhead color (ACI), a SEPARATE channel that exceeds AutoCAD
   * (which binds arrowheads to DIMCLRD). Optional override: when **absent**, the
   * arrows inherit `dimclrd` at render time (`arrowColor ?? dimclrd`). Non-standard
   * for DXF export → falls back to `dimclrd`.
   */
  arrowColor?: number;
  /** DIMCEN — center mark size (D13). Positive=mark+line, Negative=mark+extensions, 0=none. */
  dimcen: number;
  /** DIMBREAK gap when DIMBREAK applied (mm paper, D12). */
  breakGap: number;

  // ── Text ───────────────────────────────────────────────────────────────────
  /** DIMTXT — model-space text height. Computed = paperTextHeight × dimscale. */
  dimtxt: number;
  /** DIMCLRT — text color (ACI). */
  dimclrt: number;
  /** DIMGAP — gap text ↔ dim line (mm paper). */
  dimgap: number;
  /** DIMTAD — text vertical placement. */
  dimtad: DimTextVerticalPlacement;
  /** DIMTIH — text inside horizontal vs aligned (false = aligned with dim line). */
  dimtih: boolean;
  /** DIMTOH — text outside horizontal vs aligned. */
  dimtoh: boolean;
  /** DIMTFILL — background mask mode (D12). */
  dimtfill: DimTextFillMode;
  /** DIMTFILLCLR — explicit background color when `dimtfill='customColor'` (ACI). */
  dimtfillclr: number;
  /** Font family for dim text (resolves through ADR-344 text engine). */
  textFontFamily: string;

  // ── Fit / placement ────────────────────────────────────────────────────────
  /** DIMTIX — force text inside extension lines. */
  dimtix: boolean;
  /** DIMTOFL — force dim line inside even if text outside. */
  dimtofl: boolean;
  /** DIMATFIT — arrowhead/text placement when space is insufficient (0=both outside, 1=arrows first, 2=text first, 3=best fit). */
  dimatfit: number;
  /** DIMTMOVE — text move rule when manually relocated (0=with dim line, 1=add leader, 2=free move). */
  dimtmove: number;
  /**
   * DIMSCALE — global scale factor for all paper-mm values.
   * D3 (Revit-style baked annotative): set to `currentScale` per session at render time.
   */
  dimscale: number;
  /**
   * D3 — paper-space text height (mm). Resolves to `dimtxt = paperTextHeight × dimscale` at render.
   * Mirrors Revit's view-driven annotation scaling, future-proof for AutoCAD entity-driven mode.
   */
  paperTextHeight: number;

  // ── Primary units ──────────────────────────────────────────────────────────
  /** DIMLUNIT — linear unit format. */
  dimlunit: DimLinearUnitFormat;
  /** DIMAUNIT — angular unit format. */
  dimaunit: DimAngularUnitFormat;
  /** DIMDEC — linear decimal precision. */
  dimdec: number;
  /** DIMADEC — angular decimal precision. */
  dimadec: number;
  /** DIMDSEP — decimal separator character ('.' or ','). */
  dimdsep: '.' | ',';
  /** DIMPOST — prefix/suffix string for measured value ("[]" = use placeholder). */
  dimpost: string;
  /** DIMRND — rounding factor (0 = no round). */
  dimrnd: number;
  /** DIMLFAC — linear measurement scale factor. */
  dimlfac: number;
  /** DIMZIN — zero suppression bitmask (0=none, 1=leading, 2=trailing, 4=alt-leading, 8=alt-trailing). */
  dimzin: number;

  // ── Alternate units (D8) ───────────────────────────────────────────────────
  /** DIMALT — display alternate units. */
  dimalt: boolean;
  /** DIMALTU — alternate unit format. */
  dimaltu: DimLinearUnitFormat;
  /** DIMALTF — alternate scale factor (default 25.4 = mm→in). */
  dimaltf: number;
  /** DIMALTD — alternate decimal precision. */
  dimaltd: number;
  /** DIMALTRND — alternate rounding. */
  dimaltrnd: number;
  /** DIMAPOST — alternate prefix/suffix. */
  dimapost: string;

  // ── Tolerances / limits (D8) ───────────────────────────────────────────────
  /** DIMTOL — show tolerance. */
  dimtol: boolean;
  /** DIMLIM — show limits (mutually exclusive with dimtol). */
  dimlim: boolean;
  /** DIMTM — minus tolerance (negative number). */
  dimtm: number;
  /** DIMTP — plus tolerance. */
  dimtp: number;
  /** DIMTDEC — tolerance decimal precision. */
  dimtdec: number;
  /** DIMTFAC — tolerance text scale relative to dim text. */
  dimtfac: number;
  /** DIMTOLJ — tolerance vertical justify. */
  dimtolj: DimToleranceJustify;

  // ── Inspection dimension (D8 ASME) ─────────────────────────────────────────
  /** GD&T inspection rate marker mode. */
  dimInspect: DimInspectionMode;
  /** Custom rate value (0-100) when `dimInspect='rateCustom'`. */
  dimInspectRate: number;

  // ── Associativity (D11) ────────────────────────────────────────────────────
  /** DIMASSOC — 0=exploded, 1=non-assoc, 2=fully associative. Default 2. */
  dimassoc: DimAssociativity;

  // ── Layer (D5) ─────────────────────────────────────────────────────────────
  /** Target layer name auto-applied on dim creation (ΔΙΑΣΤΑΣΕΙΣ / A-ANNO-DIMS / user). */
  targetLayer: string;

  // ── Annotation scaling (D3 future-proof) ───────────────────────────────────
  /** DIMANNO — annotative flag. Phase 1 fixed false; toggle reserved for future multi-viewport. */
  annotative: boolean;
}

/**
 * Per-entity DIMSTYLE override — every field optional, layered on top of the
 * referenced `DimStyle` at render time. Mirrors AutoCAD's `OVR` style state.
 */
export type DimensionOverride = Partial<DimStyle>;

// ──────────────────────────────────────────────────────────────────────────────
// Associativity (D11) — DIMASSOC=2 equivalent
// ──────────────────────────────────────────────────────────────────────────────

/** How a def point is anchored to the host geometry. */
export type DimensionAssociationType =
  | 'endpoint'
  | 'midpoint'
  | 'center'
  | 'intersection'
  | 'nearest'
  // ADR-563 Φ2 — auto-dimension anchor to a BIM host's 2D bbox extent, locked to
  // the parent dimension's measured axis (perpendicular component preserved).
  | 'bimExtent';

/** Single anchor: which defPoint follows which geometry. */
export interface DimensionAssociation {
  /** Index into `DimensionEntity.defPoints`. */
  readonly defPointIndex: number;
  /** Host entity `id` whose geometry drives this def point. */
  readonly geometryId: string;
  /** Snap semantic at creation time. */
  readonly associationType: DimensionAssociationType;
  /** For `intersection` / polyline `endpoint` / `nearest`: sub-element index (vertex / segment). */
  readonly subIndex?: number;
  /**
   * ADR-362 Phase J3 (gap #2) — parametric anchor for `nearest` re-projection:
   *   - line / polyline edge → line parameter `t` (0 = segment start, 1 = end;
   *     may fall outside [0,1] when the click projected past an endpoint).
   *   - circle / arc → angle in radians (`pointOnCircle` convention, 0 = +x CCW).
   * Absent (`undefined`) → legacy capture: recompute preserves the current
   * defPoint (2026-05-19 hotfix back-compat).
   */
  readonly param?: number;
  /**
   * ADR-362 Phase J3 (gap #2) — second host entity `id` for `intersection`
   * anchors. The def point rides the *intersection* of `geometryId` ×
   * `geometryId2`; recompute re-solves that intersection on geometry change.
   * Absent → recompute preserves the current defPoint.
   */
  readonly geometryId2?: string;
  /** Sub-element index of the `geometryId2` host (vertex / segment), if any. */
  readonly subIndex2?: number;
  /**
   * ADR-563 Φ2 — for `bimExtent` associations only: which axis the parent dim
   * measures (`x` for N/S horizontal chains, `y` for E/W vertical chains) and
   * which extent of the host's current 2D bbox this def point rides. On host
   * geometry change the recompute reads the host's `calculateBimEntity2DBounds`,
   * takes `edge` on `axis`, and preserves the perpendicular component of the
   * current def point (so the extension baseline stays put while the measured
   * coordinate follows the wall/column/foundation).
   */
  readonly bimAnchor?: {
    readonly axis: 'x' | 'y';
    readonly edge: 'min' | 'max' | 'center';
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// DIMBREAK persisted state (ADR-362 Phase K) — world-space break points per
// rendered segment. The renderer applies the DIMSTYLE `breakGap` around each
// point via `computeManualBreaks`, so breaks are computed ONCE by the DIMBREAK
// command (not per-frame) and survive as entity data (AutoCAD-faithful).
// ──────────────────────────────────────────────────────────────────────────────

/** World-space break points, one set per rendered segment of a dimension. */
export interface DimensionManualBreaks {
  readonly dimLinePoints?: readonly Point2D[];
  readonly extLine1Points?: readonly Point2D[];
  readonly extLine2Points?: readonly Point2D[];
  readonly leaderPoints?: readonly Point2D[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Common shape of every DimensionEntity variant
// ──────────────────────────────────────────────────────────────────────────────

/** Fields shared by all 10 dim variants — extends `BaseEntity` for `Entity` union compatibility. */
interface DimensionEntityCommon extends BaseEntity {
  /** Discriminates inside global `Entity` union. */
  type: 'dimension';
  /** Sub-discriminator across the 10 variants. */
  dimensionType: DimensionType;
  /** Reference to `DimStyle.id` from the active registry. */
  styleId: string;
  /** Per-entity DIMSTYLE override (Partial<DimStyle>, D7). */
  overrides?: DimensionOverride;
  /** Ordered definition points — semantic per variant. */
  defPoints: readonly Point2D[];
  /** Text midpoint (computed if absent). */
  textMidpoint?: Point2D;
  /** Text rotation override (deg, overrides DIMTIH/DIMTOH resolution). */
  textRotation?: number;
  /** User-text token: '' = none, '<>' = measured (default), anything else = override (D8/D15). */
  userText?: string;
  /** Cached computed measurement (recomputed on geometry change). */
  measurementValue?: number;
  /** D11 — geometry references (one per anchored defPoint). */
  associations?: readonly DimensionAssociation[];
  /** DIMBREAK (Phase K) — persisted world-space break points; absent = no breaks. */
  manualBreaks?: DimensionManualBreaks;
  /** D3 future-proof — per-entity annotative scales. Phase 1: `[currentScale]`. */
  annotativeScales?: readonly number[];

  // ── Legacy back-compat (Phase A1 only) — to be removed in Phase B-C ──
  /** @deprecated Use `defPoints[0]` instead. */
  startPoint?: Point2D;
  /** @deprecated Use `defPoints[1]` instead. */
  endPoint?: Point2D;
  /** @deprecated Use `textMidpoint` instead. */
  textPosition?: Point2D;
  /** @deprecated Use `measurementValue` instead. */
  value?: number;
  /** @deprecated Use `DimStyle.dimpost` + `dimlunit` instead. */
  unit?: string;
  /** @deprecated Use `DimStyle.dimdec` instead. */
  precision?: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// 10 variants
// ──────────────────────────────────────────────────────────────────────────────

/** Linear — horizontal/vertical/rotated (`rotation` controls orientation, 0 = world X axis). */
export interface LinearDimensionEntity extends DimensionEntityCommon {
  dimensionType: 'linear';
  /** Rotation angle of the dim line in degrees (0 = horizontal). */
  rotation: number;
  /** Oblique angle of extension lines in degrees (0 = perpendicular to dim line). */
  obliqueAngle?: number;
}

/** Aligned — parallel to the measured segment. */
export interface AlignedDimensionEntity extends DimensionEntityCommon {
  dimensionType: 'aligned';
}

/** Angular 2-line — angle between two line segments; defPoints = [line1.a, line1.b, line2.a, line2.b, arcPoint]. */
export interface Angular2LDimensionEntity extends DimensionEntityCommon {
  dimensionType: 'angular2L';
}

/** Angular 3-point — vertex + 2 rays; defPoints = [vertex, ray1End, ray2End, arcPoint]. */
export interface Angular3PDimensionEntity extends DimensionEntityCommon {
  dimensionType: 'angular3P';
}

/** Radius — defPoints = [center, arcPoint]. */
export interface RadiusDimensionEntity extends DimensionEntityCommon {
  dimensionType: 'radius';
  /** Leader length (mm world). */
  leaderLength?: number;
}

/** Diameter — defPoints = [side1Point, side2Point]. */
export interface DiameterDimensionEntity extends DimensionEntityCommon {
  dimensionType: 'diameter';
  leaderLength?: number;
}

/** Arc length — defPoints = [center, arcStart, arcEnd]. */
export interface ArcLengthDimensionEntity extends DimensionEntityCommon {
  dimensionType: 'arcLength';
  /** Whether to display the arc-length symbol ⌒ prefix. */
  hasArcSymbol?: boolean;
}

/** Jogged radius — defPoints = [center, arcPoint, jogPoint, jogVertex]. */
export interface JoggedRadiusDimensionEntity extends DimensionEntityCommon {
  dimensionType: 'joggedRadius';
  /** Jog angle in degrees (default 45). */
  jogAngle?: number;
}

/** Ordinate — perpendicular distance from datum (X or Y). */
export interface OrdinateDimensionEntity extends DimensionEntityCommon {
  dimensionType: 'ordinate';
  /** Which axis is being measured (X = horizontal distance, Y = vertical). */
  axis: 'x' | 'y';
  /** Datum point (origin) — single Point2D since defPoints[0] is the measured feature. */
  datum: Point2D;
}

/** Baseline — chained from a shared baseline; `parentDimensionId` references the first dim. */
export interface BaselineDimensionEntity extends DimensionEntityCommon {
  dimensionType: 'baseline';
  /** ID of the dim sharing the baseline (typically the original linear/aligned dim). */
  parentDimensionId: string;
}

/** Continued — chained end-to-end; `parentDimensionId` references the previous dim. */
export interface ContinuedDimensionEntity extends DimensionEntityCommon {
  dimensionType: 'continued';
  /** ID of the previous dim in the chain. */
  parentDimensionId: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Public union + variant map
// ──────────────────────────────────────────────────────────────────────────────

export type DimensionEntity =
  | LinearDimensionEntity
  | AlignedDimensionEntity
  | Angular2LDimensionEntity
  | Angular3PDimensionEntity
  | RadiusDimensionEntity
  | DiameterDimensionEntity
  | ArcLengthDimensionEntity
  | JoggedRadiusDimensionEntity
  | OrdinateDimensionEntity
  | BaselineDimensionEntity
  | ContinuedDimensionEntity;

/** Variant lookup by `dimensionType`. */
export type DimensionVariantByType<K extends DimensionType> = Extract<
  DimensionEntity,
  { dimensionType: K }
>;

// ──────────────────────────────────────────────────────────────────────────────
// Type guards
// ──────────────────────────────────────────────────────────────────────────────

export const isLinearDimension = (d: DimensionEntity): d is LinearDimensionEntity =>
  d.dimensionType === 'linear';
export const isAlignedDimension = (d: DimensionEntity): d is AlignedDimensionEntity =>
  d.dimensionType === 'aligned';
export const isAngular2LDimension = (d: DimensionEntity): d is Angular2LDimensionEntity =>
  d.dimensionType === 'angular2L';
export const isAngular3PDimension = (d: DimensionEntity): d is Angular3PDimensionEntity =>
  d.dimensionType === 'angular3P';
export const isRadiusDimension = (d: DimensionEntity): d is RadiusDimensionEntity =>
  d.dimensionType === 'radius';
export const isDiameterDimension = (d: DimensionEntity): d is DiameterDimensionEntity =>
  d.dimensionType === 'diameter';
export const isArcLengthDimension = (d: DimensionEntity): d is ArcLengthDimensionEntity =>
  d.dimensionType === 'arcLength';
export const isJoggedRadiusDimension = (d: DimensionEntity): d is JoggedRadiusDimensionEntity =>
  d.dimensionType === 'joggedRadius';
export const isOrdinateDimension = (d: DimensionEntity): d is OrdinateDimensionEntity =>
  d.dimensionType === 'ordinate';
export const isBaselineDimension = (d: DimensionEntity): d is BaselineDimensionEntity =>
  d.dimensionType === 'baseline';
export const isContinuedDimension = (d: DimensionEntity): d is ContinuedDimensionEntity =>
  d.dimensionType === 'continued';
