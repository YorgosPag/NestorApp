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

import type { RibbonButton, RibbonCommand, RibbonTab } from '../types/ribbon-types';

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

/** Helper: ONE split-button variant that fires `onAction(action)` (no tool). */
function actionVariant(id: string, labelKey: string, icon: string, action: string): RibbonCommand {
  return { id, labelKey, icon, commandKey: action, action };
}

/**
 * Helper: a LARGE split-action button — main click fires `mainAction`, the dropdown
 * lists `variants` (ADR-441 «Εσχάρα από κάναβο» + 3 περιμετρικά modes).
 */
function splitActionBtn(
  id: string, labelKey: string, icon: string, mainAction: string, variants: RibbonCommand[],
): RibbonButton {
  return {
    type: 'split', size: 'large',
    command: { id, labelKey, icon, commandKey: mainAction, action: mainAction },
    variants,
  };
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
            toolBtn('structuralTab.wall', 'ribbon.commands.bim.wall.label', 'struct-wall-single', 'wall', 'W'),
            toolBtn('structuralTab.wallOnEntity', 'ribbon.commands.bim.wallOnEntity.label', 'struct-wall-on-entity', 'wall-on-entity'),
            toolBtn('structuralTab.wallRegionLines', 'ribbon.commands.bim.wallRegionLines.label', 'struct-wall-region-lines', 'wall-region-lines'),
            toolBtn('structuralTab.wallRegionInside', 'ribbon.commands.bim.wallRegionInside.label', 'struct-wall-region-inside', 'wall-region-inside'),
            toolBtn('structuralTab.wallRegionBox', 'ribbon.commands.bim.wallRegionBox.label', 'struct-wall-region-box', 'wall-region-box'),
            toolBtn('structuralTab.wallFromPerimeter', 'ribbon.commands.bim.wallFromPerimeter.label', 'struct-wall-from-perimeter', 'wall-from-perimeter'),
            // ADR-441 Slice GEN-WALL — «Τοίχοι από κάναβο»: one-shot action (στα segments).
            actionBtn('structuralTab.wallsFromGrid', 'ribbon.commands.bim.wallsFromGrid.label', 'struct-wall-from-grid', 'wall.actions.fromGrid', 'wall.actions.fromGrid'),
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
            toolBtn('structuralTab.column', 'ribbon.commands.bim.column.label', 'struct-col-single', 'column', 'CL'),
            toolBtn('structuralTab.columnRegionLines', 'ribbon.commands.bim.columnRegionLines.label', 'struct-col-region-lines', 'column-region-lines'),
            toolBtn('structuralTab.columnRegionInside', 'ribbon.commands.bim.columnRegionInside.label', 'struct-col-region-inside', 'column-region-inside'),
            toolBtn('structuralTab.columnRegionBox', 'ribbon.commands.bim.columnRegionBox.label', 'struct-col-region-box', 'column-region-box'),
            toolBtn('structuralTab.columnDiscreteFromPerimeter', 'ribbon.commands.bim.columnDiscreteFromPerimeter.label', 'struct-col-discrete-from-perimeter', 'column-discrete-from-perimeter'),
            toolBtn('structuralTab.columnFromPerimeter', 'ribbon.commands.bim.columnFromPerimeter.label', 'struct-col-from-perimeter', 'column-from-perimeter'),
            toolBtn('structuralTab.columnDiscreteFromPerimeterWalls', 'ribbon.commands.bim.columnDiscreteFromPerimeterWalls.label', 'struct-col-discrete-from-perimeter-walls', 'column-discrete-from-perimeter-walls'),
            // ADR-441 Slice GEN-COL — «Κολώνες από κάναβο»: one-shot action (στις τομές).
            actionBtn('structuralTab.columnsFromGrid', 'ribbon.commands.bim.columnsFromGrid.label', 'struct-col-from-grid', 'column.actions.fromGrid', 'column.actions.fromGrid'),
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
            toolBtn('structuralTab.beam', 'ribbon.commands.bim.beam.label', 'struct-beam-single', 'beam', 'BM'),
            toolBtn('structuralTab.beamFromWall', 'ribbon.commands.bim.beamFromWall.label', 'struct-beam-on-entity', 'beam-from-wall'),
            // ADR-441 Slice GEN-BEAM — «Δοκάρια από κάναβο»: one-shot action (στα segments).
            actionBtn('structuralTab.beamsFromGrid', 'ribbon.commands.bim.beamsFromGrid.label', 'struct-beam-from-grid', 'beam.actions.fromGrid', 'beam.actions.fromGrid'),
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
            // ADR-441 Slice GEN-SLAB — «Πλάκες από κάναβο»: one-shot actions. Εδαφόπλακα =
            // ΕΝΑ ενιαίο σε όλο το αποτύπωμα· δάπεδα/οροφές = ΠΟΛΛΑ (ένα ανά φάτνωμα).
            actionBtn('structuralTab.slabMatFromGrid', 'ribbon.commands.bim.slabMatFromGrid.label', 'bim-slab-mat-from-grid', 'slab.actions.fromGridMat', 'slab.actions.fromGridMat'),
            actionBtn('structuralTab.slabFloorFromGrid', 'ribbon.commands.bim.slabFloorFromGrid.label', 'bim-slab-floor-from-grid', 'slab.actions.fromGridFloor', 'slab.actions.fromGridFloor'),
            actionBtn('structuralTab.slabRoofFromGrid', 'ribbon.commands.bim.slabRoofFromGrid.label', 'bim-slab-roof-from-grid', 'slab.actions.fromGridRoof', 'slab.actions.fromGridRoof'),
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
            toolBtn('structuralTab.foundationPad', 'ribbon.commands.bim.foundationPad.label', 'struct-found-pad-single', 'foundation-pad', 'FP'),
            toolBtn('structuralTab.foundationStrip', 'ribbon.commands.bim.foundationStrip.label', 'struct-found-strip-single', 'foundation-strip', 'FS'),
            toolBtn('structuralTab.foundationTieBeam', 'ribbon.commands.bim.foundationTieBeam.label', 'struct-found-strip-tie', 'foundation-tie-beam'),
            toolBtn('structuralTab.foundationStripFromWall', 'ribbon.commands.bim.foundationStripFromWall.label', 'struct-found-strip-on-entity', 'foundation-strip-from-wall'),
            // ADR-441 — «Εσχάρα πεδιλοδοκών από κάναβο»: split-button· main = inner
            // (default), dropdown = περιμετρική έδραση (Εσωτερικά/Κεντρικά/Εξωτερικά).
            splitActionBtn(
              'structuralTab.foundationFromGrid',
              'ribbon.commands.bim.foundationFromGrid.label',
              'struct-found-strip-from-grid',
              'foundation.actions.fromGrid',
              [
                actionVariant('structuralTab.foundationFromGridInner', 'ribbon.commands.bim.foundationFromGridInner.label', 'struct-found-strip-from-grid', 'foundation.actions.fromGrid'),
                actionVariant('structuralTab.foundationFromGridCenter', 'ribbon.commands.bim.foundationFromGridCenter.label', 'struct-found-strip-from-grid', 'foundation.actions.fromGridCenter'),
                actionVariant('structuralTab.foundationFromGridOuter', 'ribbon.commands.bim.foundationFromGridOuter.label', 'struct-found-strip-from-grid', 'foundation.actions.fromGridOuter'),
              ],
            ),
            // ADR-441 Slice GEN-TIE — «Συνδετήριες δοκοί από κάναβο»: one-shot action
            // (κεντραρισμένες στα segments· ανεξάρτητο overlay από την εσχάρα).
            actionBtn('structuralTab.tieBeamsFromGrid', 'ribbon.commands.bim.tieBeamsFromGrid.label', 'struct-found-tie-from-grid', 'foundation.actions.tieBeamsFromGrid', 'foundation.actions.tieBeamsFromGrid'),
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
