/**
 * ADR-362 Phase E3 / Φ-Ε4 (2026-07-04) — Home → Dimensions SINGLE launcher.
 *
 * The full dimension-creation toolset lives in the CONTEXTUAL «Διαστάσεις» tab
 * (`contextual-dimensions-tab.ts`, `dim-tool-active`), which auto-opens the
 * moment a dim tool is picked — mirroring the guides contextual tab (ADR-442).
 * Per Giorgio (2026-07-04): Home keeps EXACTLY ONE «Διάσταση» button — the whole
 * type gallery (the old split dropdown) AND the auto-dimension + cut-line actions
 * now live as LARGE icons in the «Διαστάσεις» tab, not on Home. This mirrors
 * AutoCAD "Home → Annotation" collapsed to its single most-frequent action.
 *
 * A single large SIMPLE button:
 *   • click → `dim-smart` (Smart DIM) → starts dimensioning → the contextual
 *     «Διαστάσεις» tab auto-opens with the full toolset (incl. auto / cut-line).
 *
 * SSoT: reuses the exact commandKey / icon / i18n label also used by
 * `contextual-dimensions-tab.ts`. Zero new keys. `dim-smart` is a `ToolType`
 * routed via `useDimToolRouting` → `DimensionCreateStore`.
 */

import type { RibbonPanelDef } from '../types/ribbon-types';

export const HOME_DIMENSIONS_PANEL: RibbonPanelDef = {
  id: 'dimensions',
  labelKey: 'ribbon.panels.dimensions',
  rows: [
    {
      isInFlyout: false,
      buttons: [
        {
          type: 'simple',
          size: 'large',
          command: {
            id: 'dim.smart',
            labelKey: 'ribbon.commands.dim',
            icon: 'dim-smart',
            commandKey: 'dim-smart',
            shortcut: 'DIM',
          },
        },
      ],
    },
  ],
};
