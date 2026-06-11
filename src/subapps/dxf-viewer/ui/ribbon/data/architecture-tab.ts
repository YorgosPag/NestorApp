/**
 * ADR-444 — Permanent «Αρχιτεκτονικά» (Architecture) ribbon tab (Revit-grade).
 *
 * Sibling of ADR-443's «Δομικά» (Structural) tab — same permanent-tab pattern,
 * Revit's "Architecture" tab. Non-load-bearing envelope/space elements: pitched
 * roof, floor-finish covering, thermal space, space separator. Each tool's
 * existing per-entity property contextual tab (roof/floor-finish/thermal-space)
 * surfaces on top on activation; `space-separator` has none and simply activates.
 *
 * Replaces the legacy nested `draw.arch.group` cascading split-button in
 * `home-tab-draw.ts`. FULL SSoT: every button reuses the EXACT commandKey / icon /
 * labelKey / shortcut already wired there — only the tab + 2 panel container keys
 * are new (`ribbon.tabs.architecture` + `ribbon.panels.arch*`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-444-architecture-systems-permanent-ribbon-tabs.md
 */

import type { RibbonButton, RibbonTab } from '../types/ribbon-types';

/** Helper: a LARGE tool button (commandKey → onToolChange, optional shortcut). */
function toolBtn(
  id: string, labelKey: string, icon: string, commandKey: string, shortcut?: string,
): RibbonButton {
  return { type: 'simple', size: 'large', command: { id, labelKey, icon, commandKey, ...(shortcut ? { shortcut } : {}) } };
}

export const ARCHITECTURE_TAB: RibbonTab = {
  id: 'architecture',
  labelKey: 'ribbon.tabs.architecture',
  panels: [
    // ── Στέγη & Δάπεδο (Revit "Build": Roof / Floor) ─────────────────────────
    {
      id: 'arch-roof-floor',
      labelKey: 'ribbon.panels.archRoofFloor',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            toolBtn('architectureTab.roof', 'ribbon.commands.bim.roof.label', 'bim-roof', 'roof', 'RF'),
            toolBtn('architectureTab.floorFinish', 'ribbon.commands.bim.floorFinish.label', 'bim-slab', 'floor-finish', 'FF'),
          ],
        },
      ],
    },
    // ── Χώροι (Revit "Room & Area": Space / Space Separator) ─────────────────
    {
      id: 'arch-spaces',
      labelKey: 'ribbon.panels.archSpaces',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            toolBtn('architectureTab.thermalSpace', 'ribbon.commands.bim.thermalSpace.label', 'bim-slab', 'thermal-space', 'TS'),
            toolBtn('architectureTab.spaceSeparator', 'ribbon.commands.bim.spaceSeparator.label', 'bim-slab', 'space-separator', 'SS'),
          ],
        },
      ],
    },
  ],
};
