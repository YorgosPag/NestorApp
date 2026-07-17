/**
 * candidate-label — SSoT label builder for the selection-cycling popover
 * (ADR-357 Φ15 / G13 → ADR-659 → this fix).
 *
 * BUG FIXED: two stacked slabs (e.g. floor + ceiling of the same bay) produced
 * IDENTICAL popover rows — `Slab  lvl_<levelId>  …<id-suffix>` — because the row
 * only showed the raw entity-type + the internal level id (mistaken for a DXF
 * layer) + a 5-char id tail. The user had no way to tell the rows apart.
 *
 * FIX: when the candidate resolves to a `SlabEntity`, the row shows the
 * Revit-grade triple `[role] [thickness] [top elevation]` (Giorgio-approved
 * 2026-07-17), e.g. "Πλάκα δαπέδου   150 mm   +3,00". Non-slab / unresolved
 * candidates fall back to the existing generic `entityTypeLabel()` SSoT
 * (`bim-3d/accessibility/status-bar-text-generator.ts`) — NEVER the raw
 * internal `lvl_…` id again.
 *
 * EXTENSION (2026-07-17, Giorgio-approved): the same rich-row treatment now
 * covers wall / column / beam / foundation — the other structural disciplines
 * that overlap in a bay (e.g. a column sitting inside a wall run). Each keeps
 * the 3-column `[type] [dimensions] [elevation]` shape:
 *   - Wall:       "Τοίχος   20 cm · ύψος 3,00   +6,00"     (thickness · height, base elevation)
 *   - Column:     "Στύλος   40×40 cm · ύψος 3,00   +6,00"  (section · height, base elevation;
 *                 circular → "Ø40 cm")
 *   - Beam:       "Δοκός    20×40 cm   +9,00"               (section, top elevation)
 *   - Foundation: "Θεμέλιο  150×150 cm   -1,20"              (pad: width×length footprint;
 *                 strip/tie-beam: width×thickness cross-section; top elevation)
 *
 * ABSOLUTE ELEVATION (2026-07-17 — Revit-grade consistency, Giorgio-approved): every
 * row's elevation is the **absolute** (building-datum) height, so a wall/slab/beam on
 * the 3rd storey reads its real elevation (e.g. "+6,00"), never a per-storey "+0,00".
 * The code truth (SSoT, N.0.1) is that slab `levelElevation`, wall/column `baseOffset`
 * and beam `topElevation` are all **FLOOR-RELATIVE**: their converters add the active
 * storey FFL at render time (`bim-three-slab-converter.ts` §ADR-448 §4.1 / column §165 /
 * beam §412 «top είναι FLOOR-RELATIVE»). Only foundation `topElevationMm` is already
 * absolute (`foundation-to-three.ts` deliberately ignores the storey FFL). So the same
 * `storeyFloorElevationMm` those converters receive (the active storey's datum-relative
 * FFL, `ActiveStoreyContext.floorElevationMm`, read ONCE at candidate-build time in
 * `buildCandidatesFromHits`) is added here to slab/wall/column/beam, and the SSoT
 * `resolveWallBaseZmm` owns the wall/column math (it also honours `baseBinding:'absolute'`,
 * where `baseOffset` is already world z and no FFL is added). Foundation is passed through
 * unchanged. `storeyFloorElevationMm` defaults to 0 (no active storey / unit tests) → the
 * legacy floor-relative value, i.e. zero behavioural change on the ground storey.
 *
 * Two-stage design (ADR-040 perf):
 *   1. `buildCandidateSemantics(entity)` — pure, RAW mm fields only, called
 *      ONCE per candidate at build time (`buildCandidatesFromHits`), where the
 *      scene/entity lookup actually happens. No entity lookup at render time.
 *   2. `buildCandidateLabel(candidate, t, tEntityType)` — pure, formatting only
 *      (i18n + unit label), called at popover render time. Cheap — no lookups.
 *
 * Pure module — zero React/DOM deps (mirrors `status-bar-text-generator.ts`).
 *
 * @see SelectionCyclingStore.ts — `CyclingCandidate.semantics` + `buildCandidatesFromHits(hits, resolveEntity)`
 * @see SelectionCyclingPopover.tsx — the sole renderer of `buildCandidateLabel()`
 * @see docs/centralized-systems/reference/adrs/ADR-659-overlap-selection-disambiguation.md
 */

import type { Entity } from '../../types/entities';
import type { SlabEntity, SlabKind, SlabParams } from '../../bim/types/slab-types';
import type { WallEntity, WallParams } from '../../bim/types/wall-types';
import type { ColumnEntity, ColumnParams, ColumnKind } from '../../bim/types/column-types';
import type { BeamEntity, BeamParams } from '../../bim/types/beam-types';
import type { FoundationEntity, FoundationParams, FoundationKind } from '../../bim/types/foundation-types';
import { unwrapDxfSubEntity } from '../../canvas-v2/dxf-canvas/dxf-types';
import { entityTypeLabel, type TFn } from '../../bim-3d/accessibility/status-bar-text-generator';
import { formatLengthForDisplay, formatCoordinateForDisplay } from '../../config/display-length-format';
import { resolveWallBaseZmm } from '../../bim/geometry/wall-top-profile';

// ─── Stage 1 — raw semantics (built once, at candidate build time) ────────────

/** Discriminator selecting which non-slab structural branch `buildCandidateLabel` formats. */
export type CandidateStructuralKind = 'wall' | 'column' | 'beam' | 'foundation';

/** Raw (canonical-mm) semantic fields extracted from the resolved entity, if any. */
export interface CandidateSemantics {
  // ─── Slab (2026-07-17 bug fix) ───────────────────────────────────────────
  readonly slabKind?: SlabKind;
  /** mm — `SlabParams.thickness`. */
  readonly thicknessMm?: number;
  /** mm — ABSOLUTE top face: `storeyFloorElevationMm + levelElevation + heightOffsetFromLevel`
   *  (ADR-369 §2.1; `levelElevation` is FLOOR-RELATIVE per ADR-448 §4.1, so the storey FFL is added). */
  readonly topElevationMm?: number;

  /** Set for wall/column/beam/foundation candidates — selects the format branch below. */
  readonly structuralKind?: CandidateStructuralKind;

  // ─── Wall ─────────────────────────────────────────────────────────────────
  /** mm — `WallParams.thickness`. */
  readonly wallThicknessMm?: number;
  /** mm — `WallParams.height`. */
  readonly wallHeightMm?: number;
  /** mm — ABSOLUTE base elevation via the `resolveWallBaseZmm` SSoT:
   *  `baseBinding==='absolute' ? baseOffset : storeyFloorElevationMm + baseOffset`. */
  readonly wallBaseElevationMm?: number;

  // ─── Column ───────────────────────────────────────────────────────────────
  readonly columnShapeKind?: ColumnKind;
  /** mm — `ColumnParams.width`. */
  readonly columnWidthMm?: number;
  /** mm — `ColumnParams.depth`. */
  readonly columnDepthMm?: number;
  /** mm — `ColumnParams.height`. */
  readonly columnHeightMm?: number;
  /** mm — ABSOLUTE base elevation via `resolveWallBaseZmm` (mirror of `wallBaseElevationMm`). */
  readonly columnBaseElevationMm?: number;

  // ─── Beam ─────────────────────────────────────────────────────────────────
  /** mm — `BeamParams.width`. */
  readonly beamWidthMm?: number;
  /** mm — `BeamParams.depth`. */
  readonly beamDepthMm?: number;
  /** mm — ABSOLUTE top elevation: `storeyFloorElevationMm + topElevation + (zOffset ?? 0)`
   *  (`topElevation` is FLOOR-RELATIVE per the converter, `bim-three-structural-converters.ts` §412). */
  readonly beamTopElevationMm?: number;

  // ─── Foundation ───────────────────────────────────────────────────────────
  readonly foundationShapeKind?: FoundationKind;
  /** mm — `width` (all kinds). */
  readonly foundationWidthMm?: number;
  /** mm — `PadFootingParams.length`. `undefined` for strip/tie-beam (line-based). */
  readonly foundationLengthMm?: number;
  /** mm — `FoundationCommonParams.thicknessMm`. */
  readonly foundationThicknessMm?: number;
  /** mm — `FoundationCommonParams.topElevationMm` (absolute, project origin; typically negative). */
  readonly foundationTopElevationMm?: number;
}

/**
 * Reads `SlabParams` from a slab entity in EITHER of the two shapes that share the
 * `type:'slab'` discriminator: the raw BIM `SlabEntity` (params on `.params`, fed by
 * the Shift+Space path) and the `DxfSlab` render wrapper (params on `.slabEntity.params`,
 * fed by the repeated-click path whose scene is the render-shape `DxfEntityUnion`).
 * `isSlabEntity()` only checks `type` → it narrows BOTH to `SlabEntity`, so a blind
 * `entity.params` destructure crashes on the wrapper. `unwrapDxfSubEntity()` is the
 * SSoT reader for exactly this (ADR-363 `DXF_WRAPPED_SUBENTITY_FIELD`): it returns the
 * nested `.slabEntity` for a wrapper, or the entity itself for the flat shape. Returns
 * `undefined` for non-slab or param-less entities (imported/legacy) → generic fallback.
 */
function extractSlabParams(entity: Entity): SlabParams | undefined {
  if (entity.type !== 'slab') return undefined;
  return unwrapDxfSubEntity<SlabEntity>(entity).params;
}

/**
 * Wall/column/beam/foundation are "direct" shapes (ADR-671) — `.params` sits flat on
 * the entity in BOTH the BIM and render-wrapper shapes, unlike the 5 "wrapped" types
 * (slab/slab-opening/opening/stair/dimension). `unwrapDxfSubEntity()` is still used for
 * safety/consistency (it is a no-op passthrough for direct types) rather than a
 * bespoke `entity.params` read per type.
 */
function extractWallParams(entity: Entity): WallParams | undefined {
  if (entity.type !== 'wall') return undefined;
  return unwrapDxfSubEntity<WallEntity>(entity).params;
}

function extractColumnParams(entity: Entity): ColumnParams | undefined {
  if (entity.type !== 'column') return undefined;
  return unwrapDxfSubEntity<ColumnEntity>(entity).params;
}

function extractBeamParams(entity: Entity): BeamParams | undefined {
  if (entity.type !== 'beam') return undefined;
  return unwrapDxfSubEntity<BeamEntity>(entity).params;
}

function extractFoundationParams(entity: Entity): FoundationParams | undefined {
  if (entity.type !== 'foundation') return undefined;
  return unwrapDxfSubEntity<FoundationEntity>(entity).params;
}

function buildSlabSemantics(entity: Entity, storeyFloorElevationMm: number): CandidateSemantics | undefined {
  const params = extractSlabParams(entity);
  if (!params) return undefined;
  const { kind, thickness, levelElevation, heightOffsetFromLevel } = params;
  return {
    slabKind: kind,
    thicknessMm: thickness,
    // `levelElevation` is FLOOR-RELATIVE (ADR-448 §4.1); add the storey FFL for the absolute top.
    topElevationMm: storeyFloorElevationMm + levelElevation + (heightOffsetFromLevel ?? 0),
  };
}

function buildWallSemantics(entity: Entity, storeyFloorElevationMm: number): CandidateSemantics | undefined {
  const params = extractWallParams(entity);
  if (!params) return undefined;
  return {
    structuralKind: 'wall',
    wallThicknessMm: params.thickness,
    wallHeightMm: params.height,
    // SSoT — same resolver the 3D converter uses; honours `baseBinding:'absolute'` (already world z).
    wallBaseElevationMm: resolveWallBaseZmm(params, { floorElevationMm: storeyFloorElevationMm }),
  };
}

function buildColumnSemantics(entity: Entity, storeyFloorElevationMm: number): CandidateSemantics | undefined {
  const params = extractColumnParams(entity);
  if (!params) return undefined;
  return {
    structuralKind: 'column',
    columnShapeKind: params.kind,
    columnWidthMm: params.width,
    columnDepthMm: params.depth,
    columnHeightMm: params.height,
    // Mirror of wall — `ColumnParams` satisfies `WallVerticalParams` (shared binding union).
    columnBaseElevationMm: resolveWallBaseZmm(params, { floorElevationMm: storeyFloorElevationMm }),
  };
}

function buildBeamSemantics(entity: Entity, storeyFloorElevationMm: number): CandidateSemantics | undefined {
  const params = extractBeamParams(entity);
  if (!params) return undefined;
  return {
    structuralKind: 'beam',
    beamWidthMm: params.width,
    beamDepthMm: params.depth,
    // `topElevation` is FLOOR-RELATIVE (converter §412); add storey FFL + drop-from-ceiling `zOffset`.
    beamTopElevationMm: storeyFloorElevationMm + params.topElevation + (params.zOffset ?? 0),
  };
}

/**
 * `FoundationParams` is a discriminated union (ADR-436 §3.6): only `pad` (point-based)
 * carries `length` (footprint); `strip`/`tie-beam` (line-based) don't — the format stage
 * substitutes `thicknessMm` as the second dimension for those (cross-section, not footprint).
 */
function buildFoundationSemantics(entity: Entity): CandidateSemantics | undefined {
  const params = extractFoundationParams(entity);
  if (!params) return undefined;
  return {
    structuralKind: 'foundation',
    foundationShapeKind: params.kind,
    foundationWidthMm: params.width,
    foundationLengthMm: params.kind === 'pad' ? params.length : undefined,
    foundationThicknessMm: params.thicknessMm,
    foundationTopElevationMm: params.topElevationMm,
  };
}

/**
 * Extracts the semantic fields the label builder needs from a resolved entity.
 * `undefined` ⇒ no known semantics (generic fallback at render time). Pure —
 * the caller resolves `entity` from the scene ONCE (`resolveEntity` in
 * `buildCandidatesFromHits`) and passes the active storey's datum-relative FFL
 * (`storeyFloorElevationMm`, default 0); this function never touches scene/store
 * state itself. `storeyFloorElevationMm` turns the FLOOR-RELATIVE stored elevations
 * (slab/wall/column/beam) into ABSOLUTE building-datum elevations — see the module
 * header. Entity `type` is exclusive, so at most one of the branches below matches.
 */
export function buildCandidateSemantics(
  entity: Entity | null | undefined,
  storeyFloorElevationMm = 0,
): CandidateSemantics | undefined {
  if (!entity) return undefined;
  return (
    buildSlabSemantics(entity, storeyFloorElevationMm) ??
    buildWallSemantics(entity, storeyFloorElevationMm) ??
    buildColumnSemantics(entity, storeyFloorElevationMm) ??
    buildBeamSemantics(entity, storeyFloorElevationMm) ??
    buildFoundationSemantics(entity)
  );
}

// ─── Stage 2 — formatted label parts (render time, cheap) ─────────────────────

export interface CandidateLabelParts {
  /** Role/type label — e.g. "Πλάκα δαπέδου" or the generic entity-type name. */
  readonly primary: string;
  /** Thickness/dimensions (structural types) or the DXF layer name (generic fallback). May be ''. */
  readonly secondary: string;
  /** Elevation, signed metres, no unit (structural types only). '' when not applicable. */
  readonly tertiary: string;
}

/** Minimal shape `buildCandidateLabel` needs — structurally satisfied by `CyclingCandidate`. */
export interface CandidateLabelInput {
  readonly entityType: string;
  readonly layer: string;
  readonly semantics?: CandidateSemantics;
}

const SLAB_KIND_I18N_KEY: Record<SlabKind, string> = {
  floor: 'selectionCycling.slabKind.floor',
  ceiling: 'selectionCycling.slabKind.ceiling',
  roof: 'selectionCycling.slabKind.roof',
  ground: 'selectionCycling.slabKind.ground',
  foundation: 'selectionCycling.slabKind.foundation',
};

/**
 * True when a raw `layer` string is actually the internal level id
 * (`hit.layer` for BIM entities — separate, unrelated bug tracked elsewhere).
 * Never surface it — it means nothing to the user.
 */
function isInternalLevelId(layer: string): boolean {
  return layer.startsWith('lvl_');
}

/**
 * Signed level-elevation label, e.g. "+3,00" / "−1,20" (architectural
 * convention — always metres, explicit '+' for zero/positive, no unit
 * suffix). Reuses the `formatCoordinateForDisplay` SSoT for the locale
 * number + mm→m conversion; only adds the '+' prefix on top (a BIM-specific
 * convention the generic coordinate formatter intentionally doesn't own).
 */
function formatSignedElevationMeters(topElevationMm: number): string {
  const formatted = formatCoordinateForDisplay(topElevationMm, { unit: 'm', precision: 2, withUnit: false });
  return topElevationMm >= 0 ? `+${formatted}` : formatted;
}

/**
 * "40×40 cm" / "20×40 cm" — Revit-grade cross-section, cm display unit (structural
 * elements are conventionally dimensioned in cm, not mm, in Greek engineering practice —
 * Giorgio's own wall example uses cm). Unit suffix appears once, on the last number.
 */
function formatSectionCm(aMm: number, bMm: number): string {
  const a = formatLengthForDisplay(aMm, { unit: 'cm', precision: 0, withUnit: false });
  const b = formatLengthForDisplay(bMm, { unit: 'cm', precision: 0 });
  return `${a}×${b}`;
}

/**
 * "ύψος 3,00" — bare-metres number (mirrors the elevation formatting style: no unit
 * suffix), prefixed with the localized word via `selectionCycling.heightLabel`.
 */
function formatHeightLabel(heightMm: number, t: TFn): string {
  const value = formatLengthForDisplay(heightMm, { unit: 'm', precision: 2, withUnit: false });
  return t('selectionCycling.heightLabel', { value });
}

function buildWallLabelParts(
  candidate: CandidateLabelInput, s: CandidateSemantics, t: TFn, tEntityType: TFn,
): CandidateLabelParts | undefined {
  const { wallThicknessMm, wallHeightMm, wallBaseElevationMm } = s;
  if (wallThicknessMm === undefined || wallHeightMm === undefined || wallBaseElevationMm === undefined) return undefined;
  return {
    primary: entityTypeLabel(candidate.entityType, tEntityType) || candidate.entityType,
    secondary: `${formatLengthForDisplay(wallThicknessMm, { unit: 'cm', precision: 0 })} · ${formatHeightLabel(wallHeightMm, t)}`,
    tertiary: formatSignedElevationMeters(wallBaseElevationMm),
  };
}

function buildColumnLabelParts(
  candidate: CandidateLabelInput, s: CandidateSemantics, t: TFn, tEntityType: TFn,
): CandidateLabelParts | undefined {
  const { columnShapeKind, columnWidthMm, columnDepthMm, columnHeightMm, columnBaseElevationMm } = s;
  if (columnWidthMm === undefined || columnDepthMm === undefined
    || columnHeightMm === undefined || columnBaseElevationMm === undefined) return undefined;
  const section = columnShapeKind === 'circular'
    ? `Ø${formatLengthForDisplay(columnWidthMm, { unit: 'cm', precision: 0 })}`
    : formatSectionCm(columnWidthMm, columnDepthMm);
  return {
    primary: entityTypeLabel(candidate.entityType, tEntityType) || candidate.entityType,
    secondary: `${section} · ${formatHeightLabel(columnHeightMm, t)}`,
    tertiary: formatSignedElevationMeters(columnBaseElevationMm),
  };
}

function buildBeamLabelParts(
  candidate: CandidateLabelInput, s: CandidateSemantics, tEntityType: TFn,
): CandidateLabelParts | undefined {
  const { beamWidthMm, beamDepthMm, beamTopElevationMm } = s;
  if (beamWidthMm === undefined || beamDepthMm === undefined || beamTopElevationMm === undefined) return undefined;
  return {
    primary: entityTypeLabel(candidate.entityType, tEntityType) || candidate.entityType,
    secondary: formatSectionCm(beamWidthMm, beamDepthMm),
    tertiary: formatSignedElevationMeters(beamTopElevationMm),
  };
}

/**
 * `normalizeEntityType()` (`status-bar-text-generator.ts`) doesn't recognise
 * `'foundation'` yet (pre-existing gap in that shared SSoT — out of scope for this
 * file's touch-list) even though the `bim3d.entityTypes.foundation` key already
 * exists. Read it directly so the foundation row still shows "Θεμέλιο" instead of
 * falling through to the raw `'foundation'` type string.
 */
function buildFoundationLabelParts(
  candidate: CandidateLabelInput, s: CandidateSemantics, tEntityType: TFn,
): CandidateLabelParts | undefined {
  const { foundationShapeKind, foundationWidthMm, foundationLengthMm, foundationThicknessMm, foundationTopElevationMm } = s;
  if (foundationWidthMm === undefined || foundationThicknessMm === undefined || foundationTopElevationMm === undefined) {
    return undefined;
  }
  // pad → plan footprint (width×length); strip/tie-beam → cross-section (width×thickness).
  const secondDimMm = foundationShapeKind === 'pad' ? foundationLengthMm : foundationThicknessMm;
  if (secondDimMm === undefined) return undefined;
  return {
    primary: entityTypeLabel(candidate.entityType, tEntityType) || tEntityType('entityTypes.foundation'),
    secondary: formatSectionCm(foundationWidthMm, secondDimMm),
    tertiary: formatSignedElevationMeters(foundationTopElevationMm),
  };
}

function buildStructuralLabelParts(
  candidate: CandidateLabelInput, s: CandidateSemantics, t: TFn, tEntityType: TFn,
): CandidateLabelParts | undefined {
  switch (s.structuralKind) {
    case 'wall': return buildWallLabelParts(candidate, s, t, tEntityType);
    case 'column': return buildColumnLabelParts(candidate, s, t, tEntityType);
    case 'beam': return buildBeamLabelParts(candidate, s, tEntityType);
    case 'foundation': return buildFoundationLabelParts(candidate, s, tEntityType);
    default: return undefined;
  }
}

/**
 * Builds the popover row label. `t` = 'dxf-viewer' namespace (`selectionCycling.*`
 * keys, slab roles, height label); `tEntityType` = 'bim3d' namespace (`entityTypes.*`,
 * generic fallback) — mirrors the existing two-namespace pattern in `AriaLiveRegion.tsx`.
 */
export function buildCandidateLabel(
  candidate: CandidateLabelInput,
  t: TFn,
  tEntityType: TFn,
): CandidateLabelParts {
  const { semantics } = candidate;
  if (semantics?.slabKind && semantics.thicknessMm !== undefined && semantics.topElevationMm !== undefined) {
    return {
      primary: t(SLAB_KIND_I18N_KEY[semantics.slabKind]),
      secondary: formatLengthForDisplay(semantics.thicknessMm, { unit: 'mm', precision: 0 }),
      tertiary: formatSignedElevationMeters(semantics.topElevationMm),
    };
  }

  const structural = semantics?.structuralKind
    ? buildStructuralLabelParts(candidate, semantics, t, tEntityType)
    : undefined;
  if (structural) return structural;

  return {
    primary: entityTypeLabel(candidate.entityType, tEntityType) || candidate.entityType,
    secondary: isInternalLevelId(candidate.layer) ? '' : candidate.layer,
    tertiary: '',
  };
}
