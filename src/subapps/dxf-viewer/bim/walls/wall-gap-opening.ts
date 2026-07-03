/**
 * Wall-gap auto-opening — pure params builder for ADR-568.
 *
 * Sibling of the wall-merge geometry (`wall-merge.ts`): when the «Γεφύρωση με
 * Κούφωμα» tool joins two collinear walls that have a GAP between them, the gap is
 * filled with a real BIM `OpeningEntity` (Revit «Wall + hosted door»). This module
 * turns a computed `WallGap` (from `computeWallGap`) into the `OpeningParams` that
 * exactly fill it — width = gap, positioned on the MERGED wall — then the tool feeds
 * those to the SSoT `buildOpeningEntity` (validate + geometry + id + type).
 *
 * ΝΟΚ height/sill are REUSED from `OPENING_KIND_DEFAULTS` (door 2100/0) — no new
 * building-regulation config. In a 3000mm wall this leaves a 900mm lintel above the
 * door (the single wall covers the top of the former gap), per the ΝΟΚ requirement.
 *
 * @see bim/walls/wall-merge.ts — `computeWallGap` (the empty-span geometry)
 * @see hooks/drawing/opening-completion.ts — `buildOpeningEntity` (the SSoT consumer)
 * @see docs/centralized-systems/reference/adrs/ADR-568-wall-gap-auto-opening.md
 */

import {
  DEFAULT_FRAME_WIDTH_MM,
  OPENING_KIND_DEFAULTS,
  isHingedKind,
  type OpeningKind,
  type OpeningParams,
} from '../types/opening-types';
import type { WallGap } from './wall-merge';

/** Default kind for an auto-placed gap opening — a doorway (the meaning of a gap in a wall run). */
export const GAP_OPENING_KIND: OpeningKind = 'door';

/**
 * Builds the `OpeningParams` for an opening that exactly fills `gap` on the merged
 * wall `mergedWallId`. Width = the gap; height/sill from `OPENING_KIND_DEFAULTS`
 * (ΝΟΚ SSoT); hinged kinds get default handing/open-direction (mirror
 * `buildDefaultOpeningParams`). Pure — no scene / no side effects.
 */
export function buildGapOpeningParams(
  mergedWallId: string,
  gap: WallGap,
  kind: OpeningKind = GAP_OPENING_KIND,
): OpeningParams {
  const defaults = OPENING_KIND_DEFAULTS[kind];
  const params: OpeningParams = {
    kind,
    wallId: mergedWallId,
    offsetFromStart: gap.openingOffsetFromMergedStart,
    width: gap.gapMm, // πλάτος = η απόσταση (κενό) των δύο τοίχων — ακριβώς
    height: defaults.height, // ΝΟΚ ύψος (reuse OPENING_KIND_DEFAULTS, όχι νέο config)
    sillHeight: defaults.sillHeight,
    frameWidth: DEFAULT_FRAME_WIDTH_MM,
    ...(isHingedKind(kind) ? { handing: 'left' as const, openDirection: 'inward' as const } : {}),
  };
  return params;
}
