/**
 * ADR-375 — View tab BIM graphics/style settings.
 *
 * Compaction (View tab redesign, 2026-06-02): the original 7 single-widget
 * panels (viewRange, objectStyles, penTable, visibilityGraphics, hideBim,
 * discipline, viewTemplates) wasted ribbon width — each panel rendered one
 * `widget` button plus its own label + divider. Following Revit/AutoCAD, the
 * seven widgets are regrouped into TWO dense multi-row panels using the
 * existing `RibbonPanelDef.rows` / multi-button system (no render/types
 * change — pure data reorg, FULL SSoT):
 *
 *   BIM_GRAPHICS_PANEL  «Ορατότητα/Γραφικά»  — per-view visibility controls.
 *   BIM_STYLES_PANEL    «Στυλ & Πρότυπα»     — appearance/style/preset settings.
 *
 * Each widget keeps its own visible label (rendered by the widget component
 * via `ribbon.commands.X.label`); the panel `labelKey` is only the header.
 */

import type { RibbonButton, RibbonPanelDef } from '../types/ribbon-types';

/** ADR-375 Phase B.2 — 4 ViewRange plane inputs (cut plane / top / bottom / depth). */
const VIEW_RANGE_BUTTON: RibbonButton = {
  type: 'widget',
  size: 'small',
  widgetId: 'view-range',
  command: {
    id: 'view.viewRange',
    labelKey: 'ribbon.commands.viewRange.label',
    icon: '',
    commandKey: 'view-range',
  },
};

/** ADR-375 Phase B.2 — per-category projection/cut pen assignments. */
const OBJECT_STYLES_BUTTON: RibbonButton = {
  type: 'widget',
  size: 'small',
  widgetId: 'object-styles',
  command: {
    id: 'view.objectStyles',
    labelKey: 'ribbon.commands.objectStyles.label',
    icon: '',
    commandKey: 'object-styles',
  },
};

/** ADR-377 Phase D — per-subcategory line styles (Revit Object Styles subcategories). */
const SUBCATEGORIES_BUTTON: RibbonButton = {
  type: 'widget',
  size: 'small',
  widgetId: 'subcategories',
  command: {
    id: 'view.subcategories',
    labelKey: 'ribbon.commands.subcategories.label',
    icon: '',
    commandKey: 'subcategories',
  },
};

/** ADR-375 Phase C.1 — per-company editable 16×6 pen table. */
const PEN_TABLE_BUTTON: RibbonButton = {
  type: 'widget',
  size: 'small',
  widgetId: 'pen-table',
  command: {
    id: 'view.penTable',
    labelKey: 'ribbon.commands.penTable.label',
    icon: '',
    commandKey: 'pen-table',
  },
};

/** ADR-375 Phase C.4 — Visibility/Graphics per-view override dialog (Revit V/G equivalent). */
const VISIBILITY_GRAPHICS_BUTTON: RibbonButton = {
  type: 'widget',
  size: 'small',
  widgetId: 'visibility-graphics',
  command: {
    id: 'view.visibilityGraphics',
    labelKey: 'ribbon.commands.visibilityGraphics.label',
    icon: '',
    commandKey: 'visibility-graphics',
  },
};

/** ADR-375 Phase C.8 — one-click "Hide BIM / Show only DXF" isolate toggle. */
const HIDE_BIM_BUTTON: RibbonButton = {
  type: 'widget',
  size: 'small',
  widgetId: 'hide-bim',
  command: {
    id: 'view.hideBim',
    labelKey: 'ribbon.commands.hideBim.label',
    icon: '',
    commandKey: 'hide-bim',
  },
};

/** ADR-408 Φ7 — show/hide derived home-run circuit wires (Revit "Wires" sub-cat). */
const MEP_WIRE_BUTTON: RibbonButton = {
  type: 'widget',
  size: 'small',
  widgetId: 'mep-wire-toggle',
  command: {
    id: 'view.mepWire',
    labelKey: 'ribbon.commands.mepWire.label',
    icon: '',
    commandKey: 'mep-wire-toggle',
  },
};

/** ADR-408 Φ14 — show/hide sanitary drainage pipe runs (own V/G category). */
const DRAIN_PIPE_BUTTON: RibbonButton = {
  type: 'widget',
  size: 'small',
  widgetId: 'drain-pipe-toggle',
  command: {
    id: 'view.drainPipe',
    labelKey: 'ribbon.commands.drainPipe.label',
    icon: '',
    commandKey: 'drain-pipe-toggle',
  },
};

/** ADR-408 Φ7 — colour-by-system master toggle (Revit "Color circuits by system"). */
const COLOR_BY_SYSTEM_BUTTON: RibbonButton = {
  type: 'widget',
  size: 'small',
  widgetId: 'color-by-system-toggle',
  command: {
    id: 'view.colorBySystem',
    labelKey: 'ribbon.commands.colorBySystem.label',
    icon: '',
    commandKey: 'color-by-system-toggle',
  },
};

/** ADR-413 — realistic-PBR-materials master toggle (Revit "Realistic" visual style). */
const REALISTIC_MATERIALS_BUTTON: RibbonButton = {
  type: 'widget',
  size: 'small',
  widgetId: 'realistic-materials-toggle',
  command: {
    id: 'view.realisticMaterials',
    labelKey: 'ribbon.commands.realisticMaterials.label',
    icon: '',
    commandKey: 'realistic-materials-toggle',
  },
};

/** ADR-405 §4 — discipline visibility multi-toggle (Revit "View Discipline"). */
const DISCIPLINE_BUTTON: RibbonButton = {
  type: 'widget',
  size: 'small',
  widgetId: 'discipline-visibility',
  command: {
    id: 'view.disciplineVisibility',
    labelKey: 'ribbon.commands.discipline.label',
    icon: '',
    commandKey: 'discipline-visibility',
  },
};

/** ADR-375 Phase B.3 — reusable BIM render-settings presets (Revit Level 2). */
const VIEW_TEMPLATES_BUTTON: RibbonButton = {
  type: 'widget',
  size: 'small',
  widgetId: 'view-templates',
  command: {
    id: 'view.viewTemplates',
    labelKey: 'ribbon.commands.viewTemplates.label',
    icon: '',
    commandKey: 'view-templates',
  },
};

/**
 * View tab — «Ορατότητα/Γραφικά»: per-view visibility controls grouped into
 * one dense panel (V/G overrides + discipline filter + DXF-only isolate).
 */
export const BIM_GRAPHICS_PANEL: RibbonPanelDef = {
  id: 'bimGraphics',
  labelKey: 'ribbon.panels.bimGraphics',
  rows: [
    // A `small` row renders as a single vertical column (ribbon-tokens.css
    // `.dxf-ribbon-panel-row[data-row-size="small"] { flex-direction: column }`).
    // All three visibility controls stack in one column, in order:
    // Visibility/Graphics → DXF only → Disciplines.
    {
      isInFlyout: false,
      buttons: [VISIBILITY_GRAPHICS_BUTTON, HIDE_BIM_BUTTON, MEP_WIRE_BUTTON, DRAIN_PIPE_BUTTON, COLOR_BY_SYSTEM_BUTTON, REALISTIC_MATERIALS_BUTTON, DISCIPLINE_BUTTON],
    },
  ],
};

/**
 * View tab — «Στυλ & Πρότυπα»: appearance/style/preset settings grouped into
 * one dense panel (object styles + pen table + view range + view templates).
 */
export const BIM_STYLES_PANEL: RibbonPanelDef = {
  id: 'bimStyles',
  labelKey: 'ribbon.panels.bimStyles',
  rows: [
    // Single vertical column (small row stacks its buttons), in order:
    // Object Styles → Subcategories → Pen Table → View Range → View Templates.
    {
      isInFlyout: false,
      buttons: [OBJECT_STYLES_BUTTON, SUBCATEGORIES_BUTTON, PEN_TABLE_BUTTON, VIEW_RANGE_BUTTON, VIEW_TEMPLATES_BUTTON],
    },
  ],
};
