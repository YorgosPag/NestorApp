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
import type { ColumnKind } from '../../../bim/types/column-types';
import { columnDrawKindAction } from '../hooks/bridge/column-command-keys';
import { COLUMN_KIND_OPTIONS } from './contextual-column-tab';
// SSoT — LARGE ribbon-button factories (πρώην local· εξήχθησαν αφού τα wall tools
// μοιράζονται τους ίδιους helpers με το contextual-wall-tab, ADR-443 §wall-entry-split).
import { toolBtn, actionBtn, actionVariant, splitActionBtn } from './ribbon-large-button-helpers';

/**
 * ADR-521 — ONE «Τύποι» dropdown variant: επιλογή τύπου → `onAction('column.drawKind:<kind>')`
 * → setKind + activate column tool. Reuse του υπάρχοντος kind-label (`COLUMN_KIND_OPTIONS`).
 */
function columnKindVariant(value: string, labelKey: string): RibbonCommand {
  const action = columnDrawKindAction(value as ColumnKind);
  return { id: `structuralTab.columnType.${value}`, labelKey, icon: 'struct-col-single', commandKey: action, action };
}

/**
 * ADR-521 — «Τύποι» column-type dropdown (αντικαθιστά το «Στήλη» toolBtn). Καθαρό dropdown:
 * κλικ → λίστα 8 σχεδιάσιμων τύπων· επιλογή → ενεργοποιεί τη σχεδίαση μ' αυτόν τον τύπο. Το
 * `commandKey:'column'` διατηρείται για storey-gating/recommendation parity με το παλιό button.
 */
function columnTypeDropdownBtn(): RibbonButton {
  return {
    type: 'dropdown', size: 'large',
    command: {
      id: 'structuralTab.columnType',
      labelKey: 'ribbon.commands.bim.columnType.label',
      tooltipKey: 'ribbon.commands.bim.columnType.tooltip',
      icon: 'struct-col-single',
      commandKey: 'column',
      shortcut: 'CL',
    },
    variants: COLUMN_KIND_OPTIONS.map((o) => columnKindVariant(o.value, o.labelKey)),
  };
}

export const STRUCTURAL_TAB: RibbonTab = {
  id: 'structural',
  labelKey: 'ribbon.tabs.structural',
  panels: [
    // ── Τοίχοι (Revit "Wall") ────────────────────────────────────────────────
    // ADR-443 §wall-entry-split — Revit «Modify | Place Wall»: το permanent tab
    // κρατά ΜΟΝΟ το entry-point «Τοίχος». Με το κλικ ενεργοποιείται το εργαλείο
    // και ανοίγει το contextual «Ιδιότητες τοίχου» που φιλοξενεί ΟΛΑ τα υπόλοιπα
    // εργαλεία τοίχου (wall-on-entity / 3× region / from-perimeter / from-grid) ως
    // LARGE buttons (panel `wall-tools` στο `contextual-wall-tab.ts`).
    {
      id: 'structural-walls',
      labelKey: 'ribbon.panels.structuralWalls',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            toolBtn('structuralTab.wall', 'ribbon.commands.bim.wall.label', 'struct-wall-single', 'wall', 'W'),
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
            // ADR-521 — «Στήλη» → «Τύποι» dropdown (επιλογή τύπου κολώνας πριν τη σχεδίαση).
            columnTypeDropdownBtn(),
            toolBtn('structuralTab.columnRegionLines', 'ribbon.commands.bim.columnRegionLines.label', 'struct-col-region-lines', 'column-region-lines'),
            toolBtn('structuralTab.columnRegionInside', 'ribbon.commands.bim.columnRegionInside.label', 'struct-col-region-inside', 'column-region-inside'),
            toolBtn('structuralTab.columnRegionBox', 'ribbon.commands.bim.columnRegionBox.label', 'struct-col-region-box', 'column-region-box'),
            toolBtn('structuralTab.columnDiscreteFromPerimeter', 'ribbon.commands.bim.columnDiscreteFromPerimeter.label', 'struct-col-discrete-from-perimeter', 'column-discrete-from-perimeter'),
            toolBtn('structuralTab.columnFromPerimeter', 'ribbon.commands.bim.columnFromPerimeter.label', 'struct-col-from-perimeter', 'column-from-perimeter'),
            toolBtn('structuralTab.columnDiscreteFromPerimeterWalls', 'ribbon.commands.bim.columnDiscreteFromPerimeterWalls.label', 'struct-col-discrete-from-perimeter-walls', 'column-discrete-from-perimeter-walls'),
            // ADR-363 §column-polygon-sketch — «Κολώνα από πολύγωνο»: σχεδίαση ελεύθερου
            // κλειστού περιγράμματος με διαδοχικά κλικ (ΙΔΙΟ vertex-chain engine με slab).
            toolBtn('structuralTab.columnFromPolygon', 'ribbon.commands.bim.columnFromPolygon.label', 'struct-col-from-polygon', 'column-from-polygon'),
            // ADR-441 Slice GEN-COL / 3-mode — «Κολώνες από κάναβο»: split-button· main =
            // inner (default), dropdown = περιμετρική έδραση anchor (Εσωτερικά/Κεντρικά/Εξωτερικά).
            splitActionBtn(
              'structuralTab.columnsFromGrid',
              'ribbon.commands.bim.columnsFromGrid.label',
              'struct-col-from-grid',
              'column.actions.fromGrid',
              [
                actionVariant('structuralTab.columnsFromGridInner', 'ribbon.commands.bim.columnsFromGridInner.label', 'struct-col-from-grid', 'column.actions.fromGrid'),
                actionVariant('structuralTab.columnsFromGridCenter', 'ribbon.commands.bim.columnsFromGridCenter.label', 'struct-col-from-grid', 'column.actions.fromGridCenter'),
                actionVariant('structuralTab.columnsFromGridOuter', 'ribbon.commands.bim.columnsFromGridOuter.label', 'struct-col-from-grid', 'column.actions.fromGridOuter'),
              ],
            ),
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
            // ADR-569 — «Δοκάρι ανάμεσα σε μέλη»: σειριακά κλικ σε κολόνες/τοιχία → δοκάρι ανά ζεύγος.
            toolBtn('structuralTab.beamBetweenMembers', 'ribbon.commands.bim.beamBetweenMembers.label', 'struct-beam-between', 'beam-between-members'),
            // ADR-441 Slice GEN-BEAM / 3-mode — «Δοκάρια από κάναβο»: split-button· main =
            // inner (default), dropdown = περιμετρική έδραση (Εσωτερικά/Κεντρικά/Εξωτερικά).
            splitActionBtn(
              'structuralTab.beamsFromGrid',
              'ribbon.commands.bim.beamsFromGrid.label',
              'struct-beam-from-grid',
              'beam.actions.fromGrid',
              [
                actionVariant('structuralTab.beamsFromGridInner', 'ribbon.commands.bim.beamsFromGridInner.label', 'struct-beam-from-grid', 'beam.actions.fromGrid'),
                actionVariant('structuralTab.beamsFromGridCenter', 'ribbon.commands.bim.beamsFromGridCenter.label', 'struct-beam-from-grid', 'beam.actions.fromGridCenter'),
                actionVariant('structuralTab.beamsFromGridOuter', 'ribbon.commands.bim.beamsFromGridOuter.label', 'struct-beam-from-grid', 'beam.actions.fromGridOuter'),
              ],
            ),
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
            // ADR-534 — «Πλάκα οροφής (auto)»: ΠΟΛΛΑ ceiling slab (ένα ανά φάτνωμα) από δοκάρια+κολόνες
            // (member-based, ΟΧΙ κάναβο), flush στην κορυφή των δοκαριών.
            actionBtn('structuralTab.slabCeilingFromStructure', 'ribbon.commands.bim.slabCeilingFromStructure.label', 'bim-slab-ceiling-from-structure', 'slab.actions.fromStructureCeiling', 'slab.actions.fromStructureCeiling'),
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
    // ── Φινιρίσματα (Revit "Paint") ──────────────────────────────────────────
    // ADR-449 PART B Slice C — «Βαφή σοβά» 2D paintbrush: ενεργοποιεί το εργαλείο
    // `finish-paint` (κλικ σε όψη σοβά → per-face υλικό/χρώμα). Toggle-highlight +
    // Esc-disarm δωρεάν από το ToolStateStore (όπως κάθε εργαλείο).
    {
      id: 'structural-finishes',
      labelKey: 'ribbon.panels.structuralFinishes',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            toolBtn('structuralTab.finishPaint', 'ribbon.commands.bim.finishPaint.label', 'finish-paint', 'finish-paint'),
          ],
        },
      ],
    },
  ],
};
