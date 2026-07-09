/**
 * ADR-612 — Opening Info Tag entity factory (single-click construction).
 *
 * Derives an `OpeningInfoTagEntity` from the single placement point (the box
 * CENTRE): `angleRad` is always 0 (upright) at creation time — rotation is a
 * later grip-drag operation, never a construction-time DOF. `widthMm` comes
 * from `opts` (ribbon options) with the `DEFAULT_OPENING_INFO_TAG_WIDTH_MM`
 * fallback; height is DERIVED (`OPENING_INFO_TAG_ASPECT`), never stored. The 3
 * cells start at `DEFAULT_OPENING_INFO_TAG_TEXT` (`'0.00'` — centred, editable).
 *
 * MIRRORS `bim/scale-bar/build-scale-bar-entity.ts` — same split (pure builder
 * here + the "live options store → build options" mapping living in the STORE
 * module, `state/opening-info-tag-options-store.ts` — same one-way import
 * direction as scale-bar, zero circular import). This is a 1-point placement
 * (mirror `annotation-symbol`'s single-click tool), not a 2-point drag axis.
 *
 * @see types/opening-info-tag.ts — `OpeningInfoTagEntity` + defaults
 * @see state/opening-info-tag-options-store.ts — `buildOpeningInfoTagEntityFromLiveOptions`
 * @see docs/centralized-systems/reference/adrs/ADR-612-opening-info-tag.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { OpeningInfoTagEntity } from '../../types/opening-info-tag';
import {
  DEFAULT_OPENING_INFO_TAG_WIDTH_MM,
  DEFAULT_OPENING_INFO_TAG_TEXT,
} from '../../types/opening-info-tag';

/** Construction options for {@link buildOpeningInfoTagEntity} — everything optional (widthMm defaults). */
export interface BuildOpeningInfoTagOptions {
  /** Box width, world canonical-mm (default `DEFAULT_OPENING_INFO_TAG_WIDTH_MM`). */
  readonly widthMm?: number;
  /** Optional display name. */
  readonly name?: string;
}

/**
 * Build an `OpeningInfoTagEntity` centred at `position` (canonical-mm) + options.
 * `id` / `layerId` are explicit (every caller has both on hand at single-click
 * time — mirror the other 1-click placement builders, e.g. annotation-symbol).
 * Pure — no side effects beyond the caller-supplied `id`.
 */
export function buildOpeningInfoTagEntity(
  position: Point2D,
  opts: BuildOpeningInfoTagOptions,
  id: string,
  layerId: string,
): OpeningInfoTagEntity {
  return {
    id,
    type: 'opening-info-tag',
    layerId,
    name: opts.name,
    position: { x: position.x, y: position.y },
    angleRad: 0,
    widthMm: opts.widthMm ?? DEFAULT_OPENING_INFO_TAG_WIDTH_MM,
    topText: DEFAULT_OPENING_INFO_TAG_TEXT,
    bottomLeftText: DEFAULT_OPENING_INFO_TAG_TEXT,
    bottomRightText: DEFAULT_OPENING_INFO_TAG_TEXT,
  };
}
