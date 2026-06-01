/**
 * ADR-375 Phase B.2 — View tab: View Range + Object Styles panels.
 *
 * ViewRange: 4 mm-inputs for cut plane / top / bottom / view depth.
 * ObjectStyles: 12 categories × projection/cut pen dropdowns.
 */

import type { RibbonPanelDef } from '../types/ribbon-types';

export const VIEW_RANGE_PANEL: RibbonPanelDef = {
  id: 'viewRange',
  labelKey: 'ribbon.panels.viewRange',
  rows: [
    {
      isInFlyout: false,
      buttons: [
        {
          type: 'widget',
          size: 'small',
          widgetId: 'view-range',
          command: {
            id: 'view.viewRange',
            labelKey: 'ribbon.commands.viewRange.label',
            icon: '',
            commandKey: 'view-range',
          },
        },
      ],
    },
  ],
};

export const OBJECT_STYLES_PANEL: RibbonPanelDef = {
  id: 'objectStyles',
  labelKey: 'ribbon.panels.objectStyles',
  rows: [
    {
      isInFlyout: false,
      buttons: [
        {
          type: 'widget',
          size: 'small',
          widgetId: 'object-styles',
          command: {
            id: 'view.objectStyles',
            labelKey: 'ribbon.commands.objectStyles.label',
            icon: '',
            commandKey: 'object-styles',
          },
        },
      ],
    },
  ],
};

/** ADR-375 Phase C.1 — per-company editable 16×6 pen table. */
export const PEN_TABLE_PANEL: RibbonPanelDef = {
  id: 'penTable',
  labelKey: 'ribbon.panels.penTable',
  rows: [
    {
      isInFlyout: false,
      buttons: [
        {
          type: 'widget',
          size: 'small',
          widgetId: 'pen-table',
          command: {
            id: 'view.penTable',
            labelKey: 'ribbon.commands.penTable.label',
            icon: '',
            commandKey: 'pen-table',
          },
        },
      ],
    },
  ],
};

/** ADR-375 Phase C.4 — Visibility/Graphics per-view override dialog (Revit V/G equivalent). */
export const VISIBILITY_GRAPHICS_PANEL: RibbonPanelDef = {
  id: 'visibilityGraphics',
  labelKey: 'ribbon.panels.visibilityGraphics',
  rows: [
    {
      isInFlyout: false,
      buttons: [
        {
          type: 'widget',
          size: 'small',
          widgetId: 'visibility-graphics',
          command: {
            id: 'view.visibilityGraphics',
            labelKey: 'ribbon.commands.visibilityGraphics.label',
            icon: '',
            commandKey: 'visibility-graphics',
          },
        },
      ],
    },
  ],
};

/** ADR-375 Phase C.8 — one-click "Hide BIM / Show only DXF" isolate toggle. */
export const HIDE_BIM_PANEL: RibbonPanelDef = {
  id: 'hideBim',
  labelKey: 'ribbon.panels.hideBim',
  rows: [
    {
      isInFlyout: false,
      buttons: [
        {
          type: 'widget',
          size: 'small',
          widgetId: 'hide-bim',
          command: {
            id: 'view.hideBim',
            labelKey: 'ribbon.commands.hideBim.label',
            icon: '',
            commandKey: 'hide-bim',
          },
        },
      ],
    },
  ],
};

/** ADR-405 §4 — discipline visibility multi-toggle (Revit "View Discipline"). */
export const DISCIPLINE_PANEL: RibbonPanelDef = {
  id: 'discipline',
  labelKey: 'ribbon.panels.discipline',
  rows: [
    {
      isInFlyout: false,
      buttons: [
        {
          type: 'widget',
          size: 'small',
          widgetId: 'discipline-visibility',
          command: {
            id: 'view.disciplineVisibility',
            labelKey: 'ribbon.commands.discipline.label',
            icon: '',
            commandKey: 'discipline-visibility',
          },
        },
      ],
    },
  ],
};

/** ADR-375 Phase B.3 — reusable BIM render-settings presets (Revit Level 2). */
export const VIEW_TEMPLATES_PANEL: RibbonPanelDef = {
  id: 'viewTemplates',
  labelKey: 'ribbon.panels.viewTemplates',
  rows: [
    {
      isInFlyout: false,
      buttons: [
        {
          type: 'widget',
          size: 'small',
          widgetId: 'view-templates',
          command: {
            id: 'view.viewTemplates',
            labelKey: 'ribbon.commands.viewTemplates.label',
            icon: '',
            commandKey: 'view-templates',
          },
        },
      ],
    },
  ],
};
