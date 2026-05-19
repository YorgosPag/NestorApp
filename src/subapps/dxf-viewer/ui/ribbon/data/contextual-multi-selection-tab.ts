/**
 * ADR-363 Phase 7.1 — Contextual ribbon tab για Multi-Selection bulk-edit.
 *
 * Trigger: `multi-selection-bim` (dispatched από `useActiveContextualTrigger`
 * όταν το universalSelection έχει 2+ BIM entities — overrides οποιοδήποτε
 * per-kind tab γιατί το per-kind editor καλύπτει μόνο single primary).
 *
 * Panels:
 *   Common Properties → bulk-edit κοινών numeric props (intersection)
 *   Filter            → narrow-to-kind buttons (κρύβεται όταν homogeneous)
 *
 * Widgets self-gate: επιστρέφουν `null` εκτός mode='multi', οπότε panels
 * collapse-άρουν gracefully χωρίς extra logic στο tab.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §7.1
 * @see useMultiSelectionRibbonBridge — bridge hook που τροφοδοτεί widgets
 */

import type { RibbonTab } from '../types/ribbon-types';

export const MULTI_SELECTION_CONTEXTUAL_TRIGGER = 'multi-selection-bim';

export const CONTEXTUAL_MULTI_SELECTION_TAB: RibbonTab = {
  id: 'multi-selection',
  labelKey: 'ribbon.tabs.multiSelection',
  isContextual: true,
  contextualTrigger: MULTI_SELECTION_CONTEXTUAL_TRIGGER,
  panels: [
    {
      id: 'multi-selection-common',
      labelKey: 'ribbon.panels.multiSelectionCommon',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'large',
              widgetId: 'multi-selection-common-properties',
              command: {
                id: 'multi-selection.commonProperties',
                labelKey: 'ribbon.panels.multiSelectionCommon',
                commandKey: 'multi-selection.commonProperties',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'multi-selection-filter',
      labelKey: 'ribbon.panels.multiSelectionFilter',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'large',
              widgetId: 'multi-selection-filter',
              command: {
                id: 'multi-selection.filter',
                labelKey: 'ribbon.panels.multiSelectionFilter',
                commandKey: 'multi-selection.filter',
              },
            },
          ],
        },
      ],
    },
  ],
};
