/**
 * SSoT — the leading «Κλείσιμο» (Close) panel injected into EVERY contextual ribbon
 * tab (ADR-363 / ADR-510 Φ4j). Revit-grade: every contextual tab («Modify | …») opens
 * with a Close affordance at the FAR LEFT that dismisses the tab and returns to the
 * Home («Αρχική») tab.
 *
 * The button fires the generic `contextual.actions.close` action, which
 * `routeRibbonAction` catches via `isContextualTabCloseAction` (matches
 * `/\.actions?\.close$/`) → `closeContextualTab()` → clear selection + reset to the
 * `select` tool → the contextual trigger empties → `RibbonRoot` reverts the active tab
 * to `home`. ZERO new wiring — the ADR-363 close pipeline already exists.
 *
 * @see ../hooks/bridge/contextual-tab-close.ts (the close predicate SSoT)
 * @see ../../../app/useDxfViewerRibbon.ts (closeContextualTab primitive)
 * @see ../../../app/ribbon-contextual-config.ts (central injection into RIBBON_CONTEXTUAL_TABS)
 */

import type { RibbonButton, RibbonPanelDef, RibbonTab } from '../types/ribbon-types';
import { isContextualTabCloseAction } from '../hooks/bridge/contextual-tab-close';

/** The single generic close action — matches the ADR-363 `/\.actions?\.close$/` route. */
export const CONTEXTUAL_CLOSE_ACTION = 'contextual.actions.close';

/**
 * The leading «Κλείσιμο» panel for a contextual tab.
 * @param tabId keeps the button `id` unique (button ids are global).
 */
export function buildClosePanel(tabId: string): RibbonPanelDef {
  return {
    id: `${tabId}-close`,
    labelKey: 'ribbon.panels.close',
    rows: [
      {
        isInFlyout: false,
        buttons: [
          {
            type: 'simple',
            size: 'large',
            command: {
              id: `${tabId}.close`,
              labelKey: 'ribbon.commands.close',
              icon: 'select',
              commandKey: CONTEXTUAL_CLOSE_ACTION,
              action: CONTEXTUAL_CLOSE_ACTION,
            },
          },
        ],
      },
    ],
  };
}

/** True if a button is any contextual-tab close button (legacy per-tab or the SSoT one). */
function isCloseButton(button: RibbonButton): boolean {
  return isContextualTabCloseAction(button.command.action ?? button.command.commandKey ?? '');
}

/**
 * Normalise a contextual tab so it opens with the single SSoT «Κλείσιμο» button:
 * strip any legacy per-tab close button (avoids a duplicate), drop rows/panels emptied
 * by that removal, then prepend the leading Close panel. Idempotent.
 */
export function withStandardClose(tab: RibbonTab): RibbonTab {
  const panels = tab.panels
    .map((panel) => ({
      ...panel,
      rows: panel.rows
        .map((row) => ({ ...row, buttons: row.buttons.filter((button) => !isCloseButton(button)) }))
        .filter((row) => row.buttons.length > 0),
    }))
    .filter((panel) => panel.rows.length > 0);
  return { ...tab, panels: [buildClosePanel(tab.id), ...panels] };
}
