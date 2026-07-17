/**
 * BIM Opening — Per-Part Material Resolution (SSoT).
 *
 * Resolves the *effective* material id of each surface of a placed opening —
 * frame (κάσα), leaf (φύλλο), glazing (υαλοστάσιο), hardware (χειρολαβή) — the
 * Revit/ArchiCAD «family surfaces» model. Pure and side-effect free — mirrors
 * `resolve-opening-frame-profile.ts` / `resolve-effective-params.ts` («type wins,
 * instance wins last») but produces a resolved per-part material id map rather
 * than a cross-section or a merged param object.
 *
 * Each resolved id is consumed by `getMaterial3D` (3D build + export naming) and,
 * in future, BOQ — ONE id per part drives every downstream consumer.
 *
 * ─── RESOLUTION ORDER, PER PART (LAST wins) ──────────────────────────────────
 *   1. Part default              — frame/leaf = wood, glass = glass, hardware = metal.
 *   2. typeParams.material       — LEGACY single id → applies to frame + leaf.
 *   3. typeParams.materials.<p>  — the family Type's per-part surface.
 *   4. params.material           — LEGACY single id → applies to frame + leaf.
 *   5. params.materials.<p>      — the instance's per-part override.
 *
 * ─── ZERO REGRESSION ─────────────────────────────────────────────────────────
 * A legacy opening (no `material`, no `materials`) resolves to the part defaults
 * — frame/leaf = `mat-wood`, glass = `mat-glass` — identical to the pre-ADR
 * hardcoded `OPENING_FRAME_MATERIAL_ID`/`OPENING_GLASS_MATERIAL_ID` pipeline.
 * The legacy single `material` field applies only to the solid surfaces
 * (frame + leaf); glazing stays glass unless `materials.glass` is set explicitly.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-611-opening-frame-profile.md
 * @see bim/family-types/resolve-opening-frame-profile.ts — sibling resolver idiom
 */

import type { OpeningMaterials, OpeningParams } from '../types/opening-types';
import type { OpeningTypeParams } from '../types/bim-family-type';

/** Default material id of each opening part — the pipeline SSoT (was hardcoded). */
export const DEFAULT_OPENING_FRAME_MATERIAL_ID = 'mat-wood';
export const DEFAULT_OPENING_LEAF_MATERIAL_ID = 'mat-wood';
export const DEFAULT_OPENING_GLASS_MATERIAL_ID = 'mat-glass';
export const DEFAULT_OPENING_HARDWARE_MATERIAL_ID = 'mat-metal';

/** Resolved, ready-to-consume per-part material ids (never undefined). */
export interface ResolvedOpeningMaterials {
  /** Frame (κάσα) surface material id. */
  readonly frame: string;
  /** Leaf (φύλλο) surface material id. */
  readonly leaf: string;
  /** Glazing (υαλοστάσιο) surface material id. */
  readonly glass: string;
  /** Hardware (χειρολαβή/μηχανισμός) surface material id. */
  readonly hardware: string;
}

/** Mutable accumulator used while folding the resolution layers. */
interface MaterialAccumulator {
  frame: string;
  leaf: string;
  glass: string;
  hardware: string;
}

/** Fold a LEGACY single-id layer: applies to the solid surfaces (frame + leaf). */
function applyLegacySingleLayer(acc: MaterialAccumulator, material: string | undefined): void {
  if (!material) return;
  acc.frame = material;
  acc.leaf = material;
}

/** Fold a per-part layer: each defined part overwrites the accumulator. */
function applyPerPartLayer(acc: MaterialAccumulator, materials: OpeningMaterials | undefined): void {
  if (!materials) return;
  if (materials.frame !== undefined) acc.frame = materials.frame;
  if (materials.leaf !== undefined) acc.leaf = materials.leaf;
  if (materials.glass !== undefined) acc.glass = materials.glass;
  if (materials.hardware !== undefined) acc.hardware = materials.hardware;
}

/**
 * Resolve the effective per-part materials for an opening instance.
 *
 * @param params      Instance opening params (per-placement SSoT).
 * @param typeParams  Optional family-type params (its materials are the type
 *                    default, superseded by the instance's own).
 * @returns The resolved, always-populated per-part material id map.
 */
export function resolveOpeningMaterial(
  params: OpeningParams,
  typeParams?: OpeningTypeParams | null,
): ResolvedOpeningMaterials {
  const acc: MaterialAccumulator = {
    frame: DEFAULT_OPENING_FRAME_MATERIAL_ID,
    leaf: DEFAULT_OPENING_LEAF_MATERIAL_ID,
    glass: DEFAULT_OPENING_GLASS_MATERIAL_ID,
    hardware: DEFAULT_OPENING_HARDWARE_MATERIAL_ID,
  };

  // Layers 2 + 3 — the family Type: legacy single, then per-part (per-part wins).
  applyLegacySingleLayer(acc, typeParams?.material);
  applyPerPartLayer(acc, typeParams?.materials);

  // Layers 4 + 5 — the instance override: legacy single, then per-part (wins last).
  applyLegacySingleLayer(acc, params.material);
  applyPerPartLayer(acc, params.materials);

  return {
    frame: acc.frame,
    leaf: acc.leaf,
    glass: acc.glass,
    hardware: acc.hardware,
  };
}
