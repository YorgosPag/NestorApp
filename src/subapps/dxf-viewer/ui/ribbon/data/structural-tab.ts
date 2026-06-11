/**
 * ADR-443 — Permanent «Δομικά» (Structural) ribbon tab (Revit-grade).
 *
 * Mirrors Revit's PERMANENT "Structure" tab: large, flat, grouped buttons for
 * every load-bearing tool (walls / columns / piers / beams / floors / openings /
 * foundation / circulation). Clicking a tool activates it; the EXISTING per-entity
 * property contextual tab (wall/column/beam/slab/foundation/stair…) then surfaces
 * on top for parameters (type/height/…). The two NEVER collide because a permanent
 * tab does not occupy the single contextual slot returned by
 * `useActiveContextualTrigger` — exactly the Revit "Structure tab + Modify | Place
 * Wall" model.
 *
 * Why permanent (NOT contextual, unlike guides/dimensions): every structural tool
 * ALREADY opens its own property contextual tab on tool-active
 * (`ribbon-contextual-config.ts`). A contextual «Δομικά» picker keyed on the same
 * `activeTool` would fight those ~10 property tabs for the one contextual slot.
 * A permanent tab sidesteps the conflict entirely (Giorgio 2026-06-12).
 *
 * This REPLACES the legacy nested cascading dropdown `draw.bim.group` in
 * `home-tab-draw.ts` (the «Δομικά Στοιχεία» split-launcher) — its leaves are now
 * LARGE buttons here. The «Αρχιτεκτονικά» (`draw.arch.group`) and «ΗΛΜ»
 * (`draw.mep.group`) launchers are unchanged and become sibling permanent tabs in
 * a later pass (same pattern, Revit "Architecture" / "Systems").
 *
 * SSoT: every button reuses the EXACT `commandKey` / `action` / `icon` / `labelKey`
 * already wired by `home-tab-draw.ts` — zero new command labels, zero new dispatch
 * paths, byte-identical behaviour. Only 7 new container i18n keys are introduced
 * (`ribbon.tabs.structural` + 6 `ribbon.panels.structural*`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-443-structural-permanent-ribbon-tab.md
 */

import type { RibbonButton, RibbonTab } from '../types/ribbon-types';

/** Helper: a LARGE tool button (commandKey → onToolChange, optional shortcut). */
function toolBtn(
  id: string, labelKey: string, icon: string, commandKey: string, shortcut?: string,
): RibbonButton {
  return { type: 'simple', size: 'large', command: { id, labelKey, icon, commandKey, ...(shortcut ? { shortcut } : {}) } };
}

/** Helper: a LARGE action button (action → onAction, e.g. «Εσχάρα από κάναβο»). */
function actionBtn(
  id: string, labelKey: string, icon: string, commandKey: string, action: string,
): RibbonButton {
  return { type: 'simple', size: 'large', command: { id, labelKey, icon, commandKey, action } };
}

export const STRUCTURAL_TAB: RibbonTab = {
  id: 'structural',
  labelKey: 'ribbon.tabs.structural',
  panels: [
    // ── Τοίχοι (Revit "Wall") ────────────────────────────────────────────────
    {
      id: 'structural-walls',
      labelKey: 'ribbon.panels.structuralWalls',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            toolBtn('structuralTab.wall', 'ribbon.commands.bim.wall.label', 'bim-wall', 'wall', 'W'),
            toolBtn('structuralTab.wallOnEntity', 'ribbon.commands.bim.wallOnEntity.label', 'bim-wall', 'wall-on-entity'),
            toolBtn('structuralTab.wallRegionLines', 'ribbon.commands.bim.wallRegionLines.label', 'bim-wall', 'wall-region-lines'),
            toolBtn('structuralTab.wallRegionInside', 'ribbon.commands.bim.wallRegionInside.label', 'bim-wall', 'wall-region-inside'),
            toolBtn('structuralTab.wallRegionBox', 'ribbon.commands.bim.wallRegionBox.label', 'bim-wall', 'wall-region-box'),
            toolBtn('structuralTab.wallFromPerimeter', 'ribbon.commands.bim.wallFromPerimeter.label', 'bim-wall', 'wall-from-perimeter'),
          ],
        },
      ],
    },
    // ── Κατακόρυφα Στοιχεία: Κολώνες & Τοιχία (Revit "Column" structural) ─────
    {
      id: 'structural-columns',
      labelKey: 'ribbon.panels.structuralColumns',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            toolBtn('structuralTab.column', 'ribbon.commands.bim.column.label', 'bim-column', 'column', 'CL'),
            toolBtn('structuralTab.columnRegionLines', 'ribbon.commands.bim.columnRegionLines.label', 'bim-column', 'column-region-lines'),
            toolBtn('structuralTab.columnRegionInside', 'ribbon.commands.bim.columnRegionInside.label', 'bim-column', 'column-region-inside'),
            toolBtn('structuralTab.columnRegionBox', 'ribbon.commands.bim.columnRegionBox.label', 'bim-column', 'column-region-box'),
            toolBtn('structuralTab.columnDiscreteFromPerimeter', 'ribbon.commands.bim.columnDiscreteFromPerimeter.label', 'bim-column', 'column-discrete-from-perimeter'),
            toolBtn('structuralTab.columnFromPerimeter', 'ribbon.commands.bim.columnFromPerimeter.label', 'bim-column', 'column-from-perimeter'),
            toolBtn('structuralTab.columnDiscreteFromPerimeterWalls', 'ribbon.commands.bim.columnDiscreteFromPerimeterWalls.label', 'bim-column', 'column-discrete-from-perimeter-walls'),
          ],
        },
      ],
    },
    // ── Δοκοί (Revit "Beam") ─────────────────────────────────────────────────
    {
      id: 'structural-beams',
      labelKey: 'ribbon.panels.structuralBeams',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            toolBtn('structuralTab.beam', 'ribbon.commands.bim.beam.label', 'bim-beam', 'beam', 'BM'),
            toolBtn('structuralTab.beamFromWall', 'ribbon.commands.bim.beamFromWall.label', 'bim-beam', 'beam-from-wall'),
          ],
        },
      ],
    },
    // ── Πλάκες & Ανοίγματα (Revit "Floor" + "Opening") ───────────────────────
    {
      id: 'structural-floors',
      labelKey: 'ribbon.panels.structuralFloors',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            toolBtn('structuralTab.slab', 'ribbon.commands.bim.slab.label', 'bim-slab', 'slab', 'SL'),
            toolBtn('structuralTab.slabOpening', 'ribbon.commands.bim.slabOpening.label', 'bim-slab-opening', 'slab-opening', 'SO'),
            toolBtn('structuralTab.opening', 'ribbon.commands.bim.opening.label', 'bim-opening', 'opening', 'OP'),
          ],
        },
      ],
    },
    // ── Θεμελίωση (Revit "Foundation": Isolated / Wall / Slab) ───────────────
    {
      id: 'structural-foundation',
      labelKey: 'ribbon.panels.structuralFoundation',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            toolBtn('structuralTab.foundationPad', 'ribbon.commands.bim.foundationPad.label', 'bim-column', 'foundation-pad', 'FP'),
            toolBtn('structuralTab.foundationStrip', 'ribbon.commands.bim.foundationStrip.label', 'bim-beam', 'foundation-strip', 'FS'),
            toolBtn('structuralTab.foundationTieBeam', 'ribbon.commands.bim.foundationTieBeam.label', 'bim-beam', 'foundation-tie-beam'),
            toolBtn('structuralTab.foundationStripFromWall', 'ribbon.commands.bim.foundationStripFromWall.label', 'bim-beam', 'foundation-strip-from-wall'),
            // ADR-441 — «Εσχάρα πεδιλοδοκών από κάναβο»: one-shot action (fires
            // onAction, NOT a draw tool), reused verbatim from home-tab-draw.ts.
            actionBtn('structuralTab.foundationFromGrid', 'ribbon.commands.bim.foundationFromGrid.label', 'bim-beam', 'foundation.actions.fromGrid', 'foundation.actions.fromGrid'),
          ],
        },
      ],
    },
    // ── Κυκλοφορία: Σκάλες & Κιγκλιδώματα (Revit "Circulation") ───────────────
    {
      id: 'structural-circulation',
      labelKey: 'ribbon.panels.structuralCirculation',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            toolBtn('structuralTab.stair', 'ribbon.commands.stair', 'stair', 'stair', 'ST'),
            toolBtn('structuralTab.railing', 'ribbon.commands.bim.railing.label', 'bim-railing', 'railing', 'RL'),
          ],
        },
      ],
    },
  ],
};
