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
import { unwrapDxfSubEntity } from '../../canvas-v2/dxf-canvas/dxf-types';
import { entityTypeLabel, type TFn } from '../../bim-3d/accessibility/status-bar-text-generator';
import { formatLengthForDisplay, formatCoordinateForDisplay } from '../../config/display-length-format';

// ─── Stage 1 — raw semantics (built once, at candidate build time) ────────────

/** Raw (canonical-mm) semantic fields extracted from the resolved entity, if any. */
export interface CandidateSemantics {
  readonly slabKind?: SlabKind;
  /** mm — `SlabParams.thickness`. */
  readonly thicknessMm?: number;
  /** mm — `levelElevation + heightOffsetFromLevel` (top face, FFL). ADR-369 §2.1. */
  readonly topElevationMm?: number;
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
 * Extracts the semantic fields the label builder needs from a resolved entity.
 * `undefined` ⇒ no known semantics (generic fallback at render time). Pure —
 * the caller resolves `entity` from the scene ONCE (`resolveEntity` in
 * `buildCandidatesFromHits`); this function never touches scene/store state.
 */
export function buildCandidateSemantics(entity: Entity | null | undefined): CandidateSemantics | undefined {
  const params = entity ? extractSlabParams(entity) : undefined;
  if (!params) return undefined;
  const { kind, thickness, levelElevation, heightOffsetFromLevel } = params;
  return {
    slabKind: kind,
    thicknessMm: thickness,
    topElevationMm: levelElevation + (heightOffsetFromLevel ?? 0),
  };
}

// ─── Stage 2 — formatted label parts (render time, cheap) ─────────────────────

export interface CandidateLabelParts {
  /** Role/type label — e.g. "Πλάκα δαπέδου" or the generic entity-type name. */
  readonly primary: string;
  /** Thickness (slabs) or the DXF layer name (generic fallback). May be ''. */
  readonly secondary: string;
  /** Top elevation, signed metres, no unit (slabs only). '' when not applicable. */
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
 * Builds the popover row label. `t` = 'dxf-viewer' namespace (`selectionCycling.*`
 * keys, slab roles); `tEntityType` = 'bim3d' namespace (`entityTypes.*`, generic
 * fallback) — mirrors the existing two-namespace pattern in `AriaLiveRegion.tsx`.
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

  return {
    primary: entityTypeLabel(candidate.entityType, tEntityType) || candidate.entityType,
    secondary: isInternalLevelId(candidate.layer) ? '' : candidate.layer,
    tertiary: '',
  };
}
