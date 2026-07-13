/**
 * SSoT — leading «Επιλογή» (Select) panel for contextual ribbon tabs.
 *
 * Revit-grade: every contextual tab («Modify | …») opens with a Select panel whose
 * LARGE button re-activates the base Select tool (ESC). Extracted here (N.12 SSoT /
 * N.0.2 boy-scout) so each contextual tab prepends the SAME panel instead of cloning
 * the button config — one place owns the leading select affordance. Byte-identical
 * semantics with the Home «Τροποποίηση» panel's first button (`home-tab-modify.ts`):
 * `commandKey:'select'` → `onToolChange('select')`, shortcut ESC. Zero new wiring —
 * the generic `select` tool route already exists.
 *
 * @see ./home-tab-modify.ts (source of the canonical select button)
 * @see ./contextual-line-tool-tab.ts (first consumer — polyline / line-style edit)
 */

import type { RibbonPanelDef } from '../types/ribbon-types';
import { toolBtn } from './ribbon-large-button-helpers';

/**
 * The leading «Επιλογή» panel for a contextual tab.
 * @param idPrefix keeps the button `id` unique per tab (button ids are global).
 */
export function buildSelectPanel(idPrefix: string): RibbonPanelDef {
  return {
    id: `${idPrefix}-select`,
    labelKey: 'ribbon.panels.select',
    rows: [
      {
        isInFlyout: false,
        buttons: [
          toolBtn(`${idPrefix}.select`, 'ribbon.commands.select', 'select', 'select', 'ESC'),
        ],
      },
    ],
  };
}
