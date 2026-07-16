/**
 * Presentation table for the two marquee selection modes.
 *
 * SSoT for "what does `window` / `crossing` look like" — consumed by both the
 * tab strip (`SelectionSettings`) and the panel heading
 * (`SelectionModeSettings`), so the icon can never drift between them.
 *
 * @module ui/components/dxf-settings/settings/special/selection/selection-modes
 */

import { Square, SquareDashed, type LucideIcon } from 'lucide-react';

import type { SelectionMode } from '../../../../../../systems/cursor/config';

interface SelectionModePresentation {
  readonly icon: LucideIcon;
  /** Accent tone — a key of `useSemanticColors().text`. */
  readonly tone: 'info' | 'success';
}

/** Display order of the tabs. */
export const SELECTION_MODES: readonly SelectionMode[] = ['window', 'crossing'];

export const SELECTION_MODE_PRESENTATION: Record<
  SelectionMode,
  SelectionModePresentation
> = {
  window: { icon: Square, tone: 'info' },
  crossing: { icon: SquareDashed, tone: 'success' },
};
