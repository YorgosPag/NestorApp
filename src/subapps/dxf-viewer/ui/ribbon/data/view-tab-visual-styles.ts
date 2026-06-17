/**
 * ADR-446 — View tab «Στυλ Προβολής» panel (Revit «Visual Style»).
 *
 * Was an ADR-345 STUB of `comingSoon` buttons (2D Wireframe / Hidden / Realistic /
 * Shaded / Conceptual) with no renderer support. Now a single `widget` rendering
 * {@link VisualStyleSelect} — a Radix dropdown over the 8 Revit presets, backed by
 * the per-view `visualStyle` SSoT (`bim-render-settings-store`). The 3D faces +
 * edges pipelines read the resolved axes; the legacy standalone «Ρεαλιστικά Υλικά»
 * toggle (ADR-413) is subsumed by this control.
 */

import type { RibbonPanelDef } from '../types/ribbon-types';

export const VIEW_VISUAL_STYLES_PANEL: RibbonPanelDef = {
  id: 'visual-styles',
  labelKey: 'ribbon.panels.visualStyles',
  rows: [
    {
      isInFlyout: false,
      buttons: [
        {
          type: 'widget',
          size: 'small',
          widgetId: 'visual-style-select',
          command: {
            id: 'view.visualStyle',
            labelKey: 'ribbon.commands.visualStyle.label',
            icon: '',
            commandKey: 'visual-style-select',
          },
        },
        // ADR-469 — per-component visibility (σώμα/σοβάς/οπλισμός) + per-element override,
        // δίπλα στο «Στυλ Προβολής» (Revit-grade «Parts» control). Subsumes τα παλιά
        // standalone «Σοβατισμένη όψη» / «Οπλισμός» κουμπιά από το «Ορατότητα/Γραφικά».
        {
          type: 'widget',
          size: 'small',
          widgetId: 'structural-component-visibility',
          command: {
            id: 'view.componentVisibility',
            labelKey: 'ribbon.commands.componentVisibility.label',
            icon: '',
            commandKey: 'structural-component-visibility',
          },
        },
      ],
    },
  ],
};
