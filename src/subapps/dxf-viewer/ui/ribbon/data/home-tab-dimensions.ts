/**
 * ADR-362 Phase E3 — Home → Dimensions QUICK-ACCESS launcher.
 *
 * The full dimension-creation toolset lives in the CONTEXTUAL «Διαστάσεις» tab
 * (`contextual-dimensions-tab.ts`, `dim-tool-active`), which auto-opens the
 * moment a dim tool is picked — mirroring the guides contextual tab (ADR-442).
 * This panel is the compact Home entry point (AutoCAD "Home → Annotation"): a
 * single Dimension button so the most frequent action is one click away, and it
 * drives `dim-smart` → the contextual «Διαστάσεις» tab auto-opens.
 *
 * A single large split-button:
 *   • main click → `dim-smart` (Smart DIM) → starts dimensioning
 *   • dropdown   → the 6 most-common types (smart / linear / aligned / radius /
 *                  diameter / angular2L); the remaining types live on Annotate.
 *
 * SSoT: reuses the exact commandKeys / icons / i18n labels also used by
 * `contextual-dimensions-tab.ts`. Zero new keys. Every `commandKey` is a `ToolType`
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
          type: 'split',
          size: 'large',
          command: {
            id: 'dim.smart',
            labelKey: 'ribbon.commands.dim',
            icon: 'dim-smart',
            commandKey: 'dim-smart',
            shortcut: 'DIM',
          },
          variants: [
            { id: 'dim.smart', labelKey: 'ribbon.commands.dimVariants.smart', icon: 'dim-smart', commandKey: 'dim-smart' },
            { id: 'dim.linear', labelKey: 'ribbon.commands.dimVariants.linear', icon: 'dim-linear', commandKey: 'dim-linear' },
            { id: 'dim.aligned', labelKey: 'ribbon.commands.dimVariants.aligned', icon: 'dim-aligned', commandKey: 'dim-aligned' },
            { id: 'dim.radius', labelKey: 'ribbon.commands.dimVariants.radius', icon: 'dim-radius', commandKey: 'dim-radius' },
            { id: 'dim.diameter', labelKey: 'ribbon.commands.dimVariants.diameter', icon: 'dim-diameter', commandKey: 'dim-diameter' },
            { id: 'dim.angular2L', labelKey: 'ribbon.commands.dimVariants.angular2L', icon: 'dim-angular2L', commandKey: 'dim-angular2L' },
          ],
        },
      ],
    },
  ],
};
