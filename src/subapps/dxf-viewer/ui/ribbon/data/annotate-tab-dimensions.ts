/**
 * ADR-362 Phase E3 / ADR-442 follow-on — Annotate tab DIMENSION CREATION panels.
 *
 * Revit-grade Information Architecture (Giorgio 2026-06-12): dimension CREATION
 * is a primary annotation activity, so — exactly like Revit's "Annotate → Dimension"
 * and AutoCAD's "Annotate" tab — it lives on the PERSISTENT «Επισημείωση» tab, not
 * hidden behind a tool-active contextual tab (that pattern fits transient guides,
 * not always-needed dimensioning). Dimension EDITING stays in the existing
 * `dim-selected` contextual tab (`contextual-dimension-tab.ts`, "Modify | Dimensions").
 *
 * LAYOUT: every command is a LARGE icon-button — NOTHING hidden in a dropdown
 * (the legacy Home «Smart DIM» 10-variant mega-dropdown is removed). Grouped into
 * three Revit-style panels: Linear / Radial & Angular / Centers. The ribbon body
 * scrolls horizontally (`overflow-x: auto`) if the full set exceeds the viewport.
 *
 * SSoT: reuses the EXACT commandKeys / icons / i18n labels already wired by the
 * legacy `home-tab-dimensions.ts` (every `commandKey` is a `ToolType` routed via
 * `useDimToolRouting` → `DimensionCreateStore`). Zero new command labels / dispatch
 * paths. Only 3 new panel container labels (ribbon.panels.dim{Linear,RadialAngular,Centers}).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-362-enterprise-dimension-system.md
 */

import type { RibbonButton, RibbonPanelDef } from '../types/ribbon-types';

/** Helper: a LARGE dimension-tool button (commandKey → ToolType → onToolChange). */
function dimBtn(id: string, labelKey: string, icon: string, commandKey: string, shortcut?: string): RibbonButton {
  return { type: 'simple', size: 'large', command: { id, labelKey, icon, commandKey, shortcut } };
}

// ── Γραμμικές & Παράλληλες ───────────────────────────────────────────────────
export const ANNOTATE_DIM_LINEAR_PANEL: RibbonPanelDef = {
  id: 'dim-create-linear',
  labelKey: 'ribbon.panels.dimLinear',
  rows: [
    {
      isInFlyout: false,
      buttons: [
        dimBtn('dim.smart', 'ribbon.commands.dimVariants.smart', 'dim-smart', 'dim-smart', 'DIM'),
        dimBtn('dim.linear', 'ribbon.commands.dimVariants.linear', 'dim-linear', 'dim-linear'),
        dimBtn('dim.aligned', 'ribbon.commands.dimVariants.aligned', 'dim-aligned', 'dim-aligned'),
        dimBtn('dim.baseline', 'ribbon.commands.dimBaseline', 'dim-baseline', 'dim-baseline'),
        dimBtn('dim.continued', 'ribbon.commands.dimContinued', 'dim-continued', 'dim-continued'),
        dimBtn('dim.ordinate', 'ribbon.commands.dimVariants.ordinate', 'dim-ordinate', 'dim-ordinate'),
      ],
    },
  ],
};

// ── Ακτινικές & Γωνιακές ─────────────────────────────────────────────────────
export const ANNOTATE_DIM_RADIAL_PANEL: RibbonPanelDef = {
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
};

// ── Κέντρα ───────────────────────────────────────────────────────────────────
export const ANNOTATE_DIM_CENTERS_PANEL: RibbonPanelDef = {
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
};

/** All three dimension-creation panels, in Annotate-tab order. */
export const ANNOTATE_DIMENSION_PANELS: readonly RibbonPanelDef[] = [
  ANNOTATE_DIM_LINEAR_PANEL,
  ANNOTATE_DIM_RADIAL_PANEL,
  ANNOTATE_DIM_CENTERS_PANEL,
] as const;
