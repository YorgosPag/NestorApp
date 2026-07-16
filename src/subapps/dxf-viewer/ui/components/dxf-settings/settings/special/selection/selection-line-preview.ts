/**
 * Selection border-style preview — pure CSS background builder.
 *
 * Renders the little line swatch inside each border-style button of the
 * selection settings panel.
 *
 * ⚠️ These pixel values are SELECTION-SPECIFIC and intentionally NOT shared
 * with the other line-preview builders in the codebase — they disagree on
 * purpose:
 *   - `ui/dxf-cursor.styles.ts` (dotted 1/8, dash-dot 8/12/14/22) — cursor
 *   - `styles/design-tokens/modules/layout-utilities-constants.ts` — width-parametrized
 * Unifying them would silently change how each panel looks. Kept apart until
 * someone decides what the single visual language should be.
 *
 * @module ui/components/dxf-settings/settings/special/selection/selection-line-preview
 */

import type { SelectionBoxSettings } from '../../../../../../systems/cursor/config';

export type SelectionBorderStyle = SelectionBoxSettings['borderStyle'];

/** The four styles offered by the picker, in display order. */
export const SELECTION_BORDER_STYLES: readonly SelectionBorderStyle[] = [
  'solid',
  'dashed',
  'dotted',
  'dash-dot',
];

/**
 * CSS `background` value previewing `style` drawn in `color`.
 * `solid` returns the bare colour (no gradient needed).
 */
export function getSelectionLinePreview(
  style: SelectionBorderStyle,
  color: string,
): string {
  switch (style) {
    case 'dashed':
      return `repeating-linear-gradient(to right, ${color} 0, ${color} 4px, transparent 4px, transparent 8px)`;
    case 'dotted':
      return `repeating-linear-gradient(to right, ${color} 0, ${color} 2px, transparent 2px, transparent 4px)`;
    case 'dash-dot':
      return `repeating-linear-gradient(to right, ${color} 0, ${color} 6px, transparent 6px, transparent 8px, ${color} 8px, ${color} 10px, transparent 10px, transparent 12px)`;
    default:
      return color;
  }
}
