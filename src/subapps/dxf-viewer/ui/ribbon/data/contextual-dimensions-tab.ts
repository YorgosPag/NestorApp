/**
 * ADR-362 Phase E3 / ADR-442 sibling — Contextual «Διαστάσεις» tab (CREATION).
 *
 * Trigger: `dim-tool-active` — dispatched by `useActiveContextualTrigger`
 * (app/ribbon-contextual-config.ts) whenever `activeTool` starts with `dim-`
 * (every dimension ToolType: dim-smart/linear/aligned/…/center-mark/centerline).
 * Mirrors the guides contextual tab (ADR-442): the moment you pick a dimension
 * tool — from the compact Home launcher or anywhere — this tab auto-opens with
 * the full toolset as LARGE grouped buttons, and auto-closes when you leave.
 *
 * This is the CREATION surface. Dimension EDITING (a placed dimension selected)
 * has its OWN contextual tab — `DIMENSION_CONTEXTUAL_TAB` / `dim-selected`
 * (`contextual-dimension-tab.ts`). Per Giorgio (2026-07-04) the two now CO-EXIST:
 * selecting a placed dimension surfaces a COMPOSITE trigger (`dim-selected` +
 * `dim-tool-active`, in `ribbon-contextual-config.ts`) so the «Ιδιότητες
 * Διάστασης» tab opens active AND this creation tab stays beside it.
 *
 * LAYOUT: every command is a LARGE icon-button — nothing hidden in a dropdown.
 * Four Revit-style groups: Linear / Radial & Angular / Centers / Αυτόματη
 * (auto-dimension + cut-line, moved here from the Home launcher 2026-07-04).
 * Ribbon body scrolls horizontally (`overflow-x: auto`) on overflow.
 *
 * SSoT: reuses the EXACT commandKeys / icons / i18n labels also used by the Home
 * launcher (`home-tab-dimensions.ts`). Every `commandKey` is a `ToolType` routed
 * via `useDimToolRouting` → `DimensionCreateStore`. Zero new command labels; only
 * the tab label (`ribbon.tabs.dimensions`) + 3 panel labels are container i18n.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-362-enterprise-dimension-system.md
 */

import type { RibbonButton, RibbonTab } from '../types/ribbon-types';
import { DIM_RIBBON_KEYS } from '../hooks/bridge/dim-command-keys';

export const DIMENSIONS_CONTEXTUAL_TRIGGER = 'dim-tool-active';

/** Helper: a LARGE dimension-tool button (commandKey → ToolType → onToolChange). */
function dimBtn(id: string, labelKey: string, icon: string, commandKey: string, shortcut?: string): RibbonButton {
  return { type: 'simple', size: 'large', command: { id, labelKey, icon, commandKey, shortcut } };
}

export const CONTEXTUAL_DIMENSIONS_TAB: RibbonTab = {
  id: 'dimensions-create',
  labelKey: 'ribbon.tabs.dimensions',
  isContextual: true,
  contextualTrigger: DIMENSIONS_CONTEXTUAL_TRIGGER,
  panels: [
    // ── Γραμμικές & Παράλληλες ───────────────────────────────────────────────
    {
      id: 'dim-create-linear',
      labelKey: 'ribbon.panels.dimLinear',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            dimBtn('dim.smart', 'ribbon.commands.dimVariants.smart', 'dim-smart', 'dim-smart', 'DIM'),
            dimBtn('dim.entity', 'ribbon.commands.dimVariants.entity', 'dim-entity', 'dim-entity'),
            dimBtn('dim.linear', 'ribbon.commands.dimVariants.linear', 'dim-linear', 'dim-linear'),
            dimBtn('dim.aligned', 'ribbon.commands.dimVariants.aligned', 'dim-aligned', 'dim-aligned'),
            dimBtn('dim.baseline', 'ribbon.commands.dimBaseline', 'dim-baseline', 'dim-baseline'),
            dimBtn('dim.continued', 'ribbon.commands.dimContinued', 'dim-continued', 'dim-continued'),
            dimBtn('dim.ordinate', 'ribbon.commands.dimVariants.ordinate', 'dim-ordinate', 'dim-ordinate'),
          ],
        },
      ],
    },
    // ── Ακτινικές & Γωνιακές ─────────────────────────────────────────────────
    {
      id: 'dim-create-radial',
      labelKey: 'ribbon.panels.dimRadialAngular',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            dimBtn('dim.radius', 'ribbon.commands.dimVariants.radius', 'dim-radius', 'dim-radius'),
            dimBtn('dim.diameter', 'ribbon.commands.dimVariants.diameter', 'dim-diameter', 'dim-diameter'),
            dimBtn('dim.jogged-radius', 'ribbon.commands.dimVariants.joggedRadius', 'dim-jogged-radius', 'dim-jogged-radius'),
            dimBtn('dim.arc-length', 'ribbon.commands.dimVariants.arcLength', 'dim-arc-length', 'dim-arc-length'),
            dimBtn('dim.angular2L', 'ribbon.commands.dimVariants.angular2L', 'dim-angular2L', 'dim-angular2L'),
            dimBtn('dim.angular3P', 'ribbon.commands.dimVariants.angular3P', 'dim-angular3P', 'dim-angular3P'),
          ],
        },
      ],
    },
    // ── Κέντρα ───────────────────────────────────────────────────────────────
    {
      id: 'dim-create-centers',
      labelKey: 'ribbon.panels.dimCenters',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            dimBtn('dim.centerMark', 'ribbon.commands.dimCenterMark', 'dim-center-mark', 'dim-center-mark'),
            dimBtn('dim.centerLine', 'ribbon.commands.dimCenterLine', 'dim-centerline', 'dim-centerline'),
          ],
        },
      ],
    },
    // ── Αυτόματη ─────────────────────────────────────────────────────────────
    // Moved here from the Home launcher (2026-07-04) so Home keeps ONE «Διάσταση»
    // button. NOT `dimBtn` tools: «Αυτόματη Διαστασιολόγηση» is a one-shot ACTION
    // (ADR-563, opens the options dialog then auto-places perimeter dims); «Γραμμή
    // Τομής» is the `auto-dim-cutline` ToolType (interactive 3-click cut-line).
    {
      id: 'dim-create-auto',
      labelKey: 'ribbon.panels.dimAuto',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'large',
              command: {
                id: 'dim.auto',
                labelKey: 'ribbon.commands.autoDimension',
                icon: 'dim-auto',
                commandKey: 'auto-dimension',
                action: 'auto-dimension',
              },
            },
            {
              type: 'simple',
              size: 'large',
              command: {
                id: 'dim.cutline',
                labelKey: 'ribbon.commands.autoDimensionCutline',
                icon: 'dim-aligned',
                commandKey: 'auto-dim-cutline',
              },
            },
          ],
        },
      ],
    },
    // ── Ενέργειες ────────────────────────────────────────────────────────────
    // «Κλείσιμο» (2026-07-04) — mirror of the «Ιδιότητες Κολώνας» close. Routes to
    // the central `isContextualTabCloseAction` → `closeContextualTab` (clearAll +
    // tool→select), which exits the active dim tool AND drops any selection, so it
    // dismisses this creation tab in BOTH the pure-tool and the selection-composite
    // cases. No «Διαγραφή» here — there is no placed dimension to delete while
    // creating (that lives on the «Διάσταση» edit tab).
    {
      id: 'dim-create-actions',
      labelKey: 'ribbon.panels.dimActions',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'large',
              command: {
                id: 'dim.actions.close',
                labelKey: 'ribbon.commands.dimContextual.close',
                icon: 'select',
                commandKey: DIM_RIBBON_KEYS.actions.close,
                action: DIM_RIBBON_KEYS.actions.close,
              },
            },
          ],
        },
      ],
    },
  ],
};
