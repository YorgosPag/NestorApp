/**
 * BIM Opening — Frame Profile Resolution (SSoT) — ADR-611 Foundation.
 *
 * Resolves the *effective* frame profile (διατομή κάσας) a placed opening's
 * geometry / render / 3D-mesh pipeline actually consumes. Pure and side-effect
 * free — mirrors `resolve-effective-params.ts` («type wins, overrides win last»)
 * but produces a resolved cross-section (faceWidth × depth in mm) rather than a
 * merged param object.
 *
 * ─── RESOLUTION ORDER (LAST wins) ────────────────────────────────────────────
 *   1. catalog(DEFAULT_FRAME_PROFILE_ID)          — always-present base.
 *   2. catalog(typeParams?.frameProfileId)        — the family type's profile.
 *   3. catalog(params.frameProfileId)             — the instance's profile.
 *   4. params.frameProfileOverrides fields        — per-instance hand edits.
 *   5. LEGACY fallback — ONLY when NO frameProfileId exists anywhere AND the
 *      legacy `params.frameWidth` is set: faceWidth = depth = frameWidth.
 *
 * ─── ZERO REGRESSION ─────────────────────────────────────────────────────────
 * A legacy opening (no `frameProfileId`, no overrides) with a legacy `frameWidth`
 * resolves to faceWidth = depth = frameWidth — identical to the pre-ADR-611
 * single-`frameW` behaviour. A legacy opening with neither resolves to the
 * catalog default (70×70), which supersedes the old hardcoded 50mm fallback ONLY
 * for openings that never stored a `frameWidth`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-611-opening-frame-profile.md
 * @see bim/family-types/resolve-effective-params.ts — sibling resolver idiom
 */

import type { OpeningParams } from '../types/opening-types';
import type { OpeningTypeParams } from '../types/bim-family-type';
import type { OpeningFrameProfile, FrameSectionPoint } from '../types/opening-frame-profile';
import {
  DEFAULT_FRAME_PROFILE_FACE_MM,
  DEFAULT_FRAME_PROFILE_DEPTH_MM,
} from '../types/opening-frame-profile';
import { DEFAULT_FRAME_PROFILE_ID } from './opening-frame-profile-catalog';
import { resolveFrameProfileById } from './opening-frame-profile-lookup';

/** Resolved, ready-to-consume frame cross-section (mm). */
export interface ResolvedFrameProfile {
  /** Effective profile ID (catalog ID, custom sentinel, or the default). */
  readonly id: string;
  readonly manufacturer: string;
  readonly series: string;
  /** mm across the opening FACE (visible κάσα width). CONSTANT vs opening size. */
  readonly faceWidth: number;
  /** mm through the wall thickness. INDEPENDENT of wall.thickness. CONSTANT. */
  readonly depth: number;
  /**
   * ADR-676 ΒΗΜΑ 2 — optional swept cross-section outline (mm). Absent → the 3D
   * mesh builds the default `faceWidth × depth` box (zero regression). Present →
   * the outline is extruded along each frame member. @see FrameSectionPoint
   */
  readonly section?: readonly FrameSectionPoint[];
}

/** Mutable accumulator used while folding the resolution layers. */
interface FrameAccumulator {
  id: string;
  manufacturer: string;
  series: string;
  faceWidth: number;
  depth: number;
  section?: readonly FrameSectionPoint[];
}

/** Overwrite the accumulator from a resolved catalog profile (a layer «wins»). */
function applyCatalogProfile(acc: FrameAccumulator, profile: OpeningFrameProfile): void {
  acc.id = profile.id;
  acc.manufacturer = profile.manufacturer;
  acc.series = profile.series;
  acc.faceWidth = profile.faceWidth;
  acc.depth = profile.depth;
  // ADR-676 ΒΗΜΑ 2 — a profile's own section wins; a section-less profile layer
  // does NOT clear a section set by a previous layer (only an explicit override does).
  if (profile.section !== undefined) acc.section = profile.section;
}

/**
 * Fold a `frameProfileId` layer: echo the ID (even the custom sentinel, so the
 * resolved id reflects what is stored) and, when it matches a catalog entry,
 * overwrite manufacturer/series/dims from that entry.
 */
function applyProfileIdLayer(acc: FrameAccumulator, frameProfileId: string | undefined): void {
  if (!frameProfileId) return;
  acc.id = frameProfileId;
  const catalog = resolveFrameProfileById(frameProfileId);
  if (catalog) applyCatalogProfile(acc, catalog);
}

/**
 * Resolve the effective frame profile for an opening instance.
 *
 * @param params      Instance opening params (per-placement SSoT).
 * @param typeParams  Optional family-type params (its `frameProfileId` is the
 *                    type default, superseded by the instance's own).
 * @returns The resolved, constant cross-section consumed by geometry/render/mesh.
 */
export function resolveOpeningFrameProfile(
  params: OpeningParams,
  typeParams?: OpeningTypeParams | null,
): ResolvedFrameProfile {
  const base = resolveFrameProfileById(DEFAULT_FRAME_PROFILE_ID);
  const acc: FrameAccumulator = {
    id: base?.id ?? DEFAULT_FRAME_PROFILE_ID,
    manufacturer: base?.manufacturer ?? 'Generic',
    series: base?.series ?? '',
    faceWidth: base?.faceWidth ?? DEFAULT_FRAME_PROFILE_FACE_MM,
    depth: base?.depth ?? DEFAULT_FRAME_PROFILE_DEPTH_MM,
  };

  // Layers 2 + 3 — type profile, then instance profile (instance wins).
  applyProfileIdLayer(acc, typeParams?.frameProfileId);
  applyProfileIdLayer(acc, params.frameProfileId);

  // Layer 4 — per-instance hand edits win over any catalog dims.
  const ov = params.frameProfileOverrides;
  if (ov) {
    if (ov.faceWidth !== undefined) acc.faceWidth = ov.faceWidth;
    if (ov.depth !== undefined) acc.depth = ov.depth;
    if (ov.manufacturer !== undefined) acc.manufacturer = ov.manufacturer;
    if (ov.series !== undefined) acc.series = ov.series;
    // ADR-676 ΒΗΜΑ 2 — per-instance hand-edited section outline wins LAST.
    if (ov.section !== undefined) acc.section = ov.section;
  }

  // Layer 5 — LEGACY fallback: no profile chosen anywhere but a legacy
  // `frameWidth` exists → square cross-section = frameWidth (zero regression).
  const hasAnyProfileId = Boolean(typeParams?.frameProfileId) || Boolean(params.frameProfileId);
  if (!hasAnyProfileId && params.frameWidth !== undefined) {
    acc.faceWidth = params.frameWidth;
    acc.depth = params.frameWidth;
  }

  const resolved: ResolvedFrameProfile = {
    id: acc.id,
    manufacturer: acc.manufacturer,
    series: acc.series,
    faceWidth: acc.faceWidth,
    depth: acc.depth,
  };
  // Keep `section` ABSENT when undefined (zero regression — no explicit undefined key).
  return acc.section === undefined ? resolved : { ...resolved, section: acc.section };
}
