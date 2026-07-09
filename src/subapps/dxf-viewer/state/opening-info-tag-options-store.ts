/**
 * ADR-612 — Opening Info Tag tool options store (ribbon ⇄ placement).
 *
 * Holds the single construction option the active `'opening-info-tag'`
 * placement tool passes to `buildOpeningInfoTagEntity` on click: `widthMm`
 * (height is DERIVED from the locked 3:2 aspect, never stored here). The
 * ribbon contextual tab (future follow-up) writes it; `createEntityFromTool`
 * reads the live snapshot at completion time (`getState()` — no subscription,
 * ADR-040 event-time read pattern), exactly like `scale-bar-options-store`.
 *
 * @see bim/opening-info-tag/build-opening-info-tag-entity.ts — the consumer (`BuildOpeningInfoTagOptions`)
 * @see state/scale-bar-options-store.ts — the sibling pattern this mirrors
 * @see docs/centralized-systems/reference/adrs/ADR-612-opening-info-tag.md
 */

import { create } from 'zustand';
import type { Point2D } from '../rendering/types/Types';
import type { OpeningInfoTagEntity } from '../types/opening-info-tag';
import { DEFAULT_OPENING_INFO_TAG_WIDTH_MM } from '../types/opening-info-tag';
import { buildOpeningInfoTagEntity } from '../bim/opening-info-tag/build-opening-info-tag-entity';

interface OpeningInfoTagOptionsState {
  readonly widthMm: number;
  setWidthMm(widthMm: number): void;
}

export const useOpeningInfoTagOptionsStore = create<OpeningInfoTagOptionsState>((set) => ({
  widthMm: DEFAULT_OPENING_INFO_TAG_WIDTH_MM,
  setWidthMm: (widthMm) => set({ widthMm }),
}));

/**
 * ADR-612 — SSoT for "live options store → `BuildOpeningInfoTagOptions`" mapping.
 * Builds an `OpeningInfoTagEntity` centred at `position` from the LIVE store
 * snapshot (event-time `getState()` read, ADR-040 pattern — zero React
 * subscription). Consumed by BOTH the commit-time builder
 * (`drawing-entity-builders.ts`, case `'opening-info-tag'`) AND the WYSIWYG
 * ghost (`drawing-preview-generator.ts`) so the two paths can never drift
 * apart (N.18 — one mapping, not two clones).
 */
export function buildOpeningInfoTagEntityFromLiveOptions(
  position: Point2D,
  id: string,
  layerId: string,
): OpeningInfoTagEntity {
  const opts = useOpeningInfoTagOptionsStore.getState();
  return buildOpeningInfoTagEntity(position, { widthMm: opts.widthMm }, id, layerId);
}
