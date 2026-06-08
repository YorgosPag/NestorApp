/**
 * ADR-345 §3.1 Fase 3 — Home tab, DRAW panel buttons.
 *
 * Variants are wired only to existing `ToolType` entries
 * (src/subapps/dxf-viewer/ui/toolbar/types.ts). Variants listed in
 * ADR §3.1 but not yet mapped to a real ToolType (Tan-Tan-Radius,
 * Start+Center+Angle, Start+End+Angle, Ellipse Axis+End, Elliptical Arc)
 * are deferred to a later sub-phase.
 */

import type { RibbonPanelDef } from '../types/ribbon-types';

export const HOME_DRAW_PANEL: RibbonPanelDef = {
  id: 'draw',
  labelKey: 'ribbon.panels.draw',
  rows: [
    {
      isInFlyout: false,
      buttons: [
        {
          type: 'simple',
          size: 'large',
          command: {
            id: 'draw.layering',
            labelKey: 'ribbon.commands.layering',
            icon: 'layering',
            commandKey: 'layering',
          },
        },
        {
          type: 'split',
          size: 'large',
          command: {
            id: 'draw.line',
            labelKey: 'ribbon.commands.line',
            icon: 'line',
            commandKey: 'line',
            shortcut: 'L',
          },
          variants: [
            {
              id: 'line.line',
              labelKey: 'ribbon.commands.lineVariants.line',
              icon: 'line',
              commandKey: 'line',
            },
            {
              id: 'line.perpendicular',
              labelKey: 'ribbon.commands.lineVariants.perpendicular',
              icon: 'line-perpendicular',
              commandKey: 'line-perpendicular',
            },
            {
              id: 'line.parallel',
              labelKey: 'ribbon.commands.lineVariants.parallel',
              icon: 'line-parallel',
              commandKey: 'line-parallel',
            },
          ],
        },
        {
          type: 'simple',
          size: 'large',
          command: {
            id: 'draw.polyline',
            labelKey: 'ribbon.commands.polyline',
            icon: 'polyline',
            commandKey: 'polyline',
            shortcut: 'PL',
          },
        },
        {
          type: 'split',
          size: 'large',
          command: {
            id: 'draw.circle',
            labelKey: 'ribbon.commands.circle',
            icon: 'circle-radius',
            commandKey: 'circle',
            shortcut: 'C',
          },
          variants: [
            {
              id: 'circle.radius',
              labelKey: 'ribbon.commands.circleVariants.radius',
              icon: 'circle-radius',
              commandKey: 'circle',
            },
            {
              id: 'circle.diameter',
              labelKey: 'ribbon.commands.circleVariants.diameter',
              icon: 'circle-diameter',
              commandKey: 'circle-diameter',
            },
            {
              id: 'circle.2p',
              labelKey: 'ribbon.commands.circleVariants.twoPoint',
              icon: 'circle-2p',
              commandKey: 'circle-2p-diameter',
            },
            {
              id: 'circle.3p',
              labelKey: 'ribbon.commands.circleVariants.threePoint',
              icon: 'circle-3p',
              commandKey: 'circle-3p',
            },
            {
              id: 'circle.chord-sagitta',
              labelKey: 'ribbon.commands.circleVariants.chordSagitta',
              icon: 'circle-chord-sagitta',
              commandKey: 'circle-chord-sagitta',
            },
            {
              id: 'circle.2p-radius',
              labelKey: 'ribbon.commands.circleVariants.twoPointRadius',
              icon: 'circle-2p-radius',
              commandKey: 'circle-2p-radius',
            },
            {
              id: 'circle.best-fit',
              labelKey: 'ribbon.commands.circleVariants.bestFit',
              icon: 'circle-best-fit',
              commandKey: 'circle-best-fit',
            },
            {
              id: 'circle.ttt',
              labelKey: 'ribbon.commands.circleVariants.ttt',
              icon: 'circle-ttt',
              commandKey: 'circle-ttt',
            },
          ],
        },
        {
          type: 'split',
          size: 'large',
          command: {
            id: 'draw.arc',
            labelKey: 'ribbon.commands.arc',
            icon: 'arc-3p',
            commandKey: 'arc-3p',
            shortcut: 'A',
          },
          variants: [
            {
              id: 'arc.3p',
              labelKey: 'ribbon.commands.arcVariants.threePoint',
              icon: 'arc-3p',
              commandKey: 'arc-3p',
            },
            {
              id: 'arc.sce',
              labelKey: 'ribbon.commands.arcVariants.startCenterEnd',
              icon: 'arc-sce',
              commandKey: 'arc-sce',
            },
            {
              id: 'arc.cse',
              labelKey: 'ribbon.commands.arcVariants.centerStartEnd',
              icon: 'arc-cse',
              commandKey: 'arc-cse',
            },
          ],
        },
        {
          type: 'simple',
          size: 'large',
          command: {
            id: 'draw.rectangle',
            labelKey: 'ribbon.commands.rectangle',
            icon: 'rectangle',
            commandKey: 'rectangle',
            shortcut: 'REC',
          },
        },
        {
          type: 'split',
          size: 'large',
          command: {
            id: 'draw.text',
            labelKey: 'ribbon.commands.text',
            icon: 'text-create',
            commandKey: 'text',
            shortcut: 'T',
          },
          variants: [
            {
              id: 'text.singleline',
              labelKey: 'ribbon.commands.textVariants.singleLine',
              icon: 'text-create',
              commandKey: 'text',
            },
            {
              id: 'text.multiline',
              labelKey: 'ribbon.commands.textVariants.multiLine',
              icon: 'text-placeholder',
              commandKey: 'mtext',
            },
          ],
        },
      ],
    },
    {
      isInFlyout: false,
      buttons: [
        {
          type: 'simple',
          size: 'small',
          command: {
            id: 'draw.polygon',
            labelKey: 'ribbon.commands.polygon',
            icon: 'polygon',
            commandKey: 'polygon',
          },
        },
        {
          type: 'simple',
          size: 'small',
          command: {
            id: 'draw.ellipse',
            labelKey: 'ribbon.commands.ellipse',
            icon: 'ellipse',
            commandKey: 'ellipse',
          },
        },
        // ADR-359 Phase 10.b: Construction Line (XLINE) — infinite reference line.
        {
          type: 'simple',
          size: 'small',
          command: {
            id: 'draw.xline',
            labelKey: 'ribbon.commands.xline',
            tooltipKey: 'ribbon.commands.xlineTooltip',
            icon: 'xline',
            commandKey: 'xline',
            shortcut: 'XL',
          },
        },
        // ADR-359 Phase 10.b: Ray — semi-infinite reference line.
        {
          type: 'simple',
          size: 'small',
          command: {
            id: 'draw.ray',
            labelKey: 'ribbon.commands.ray',
            tooltipKey: 'ribbon.commands.rayTooltip',
            icon: 'ray',
            commandKey: 'ray',
          },
        },
      ],
    },
    // ADR-419 §ribbon-hierarchy — Revit-style 3-launcher split (Giorgio
    // 2026-06-06). The flat 26-item BIM dropdown is reorganized into THREE
    // category launchers in this row: «Δομικά Στοιχεία» (φέροντα: τοίχος/
    // άνοιγμα/πλάκα/κολόνα/δοκάρι/σκάλα/κιγκλίδωμα), «Αρχιτεκτονικά» (στέγη/
    // επικάλυψη δαπέδου) and «ΗΛΜ Εγκαταστάσεις» (ηλεκτρολογικά/ύδρευση/
    // αποχέτευση/θέρμανση/αερισμός). Multi-variant families (wall/slab/column/
    // beam + each MEP discipline) become cascading submenus (`subVariants`).
    // Top-half fires the last-used LEAF variant; chevron opens the list.
    // Keyboard chords (W/OP/SL/SO/CL/BM/ST/RF/FF/…) remain valid in parallel.
    {
      isInFlyout: false,
      buttons: [
        {
          type: 'split',
          size: 'large',
          command: {
            id: 'draw.bim.group',
            labelKey: 'ribbon.commands.bim.group.label',
            tooltipKey: 'ribbon.commands.bim.group.tooltip',
            icon: 'bim-wall',
            commandKey: 'wall',
          },
          variants: [
            // ── Τοίχος (submenu) ──────────────────────────────────────────
            {
              id: 'draw.bim.wallGroup',
              labelKey: 'ribbon.commands.bim.wallGroup.label',
              tooltipKey: 'ribbon.commands.bim.wallGroup.tooltip',
              icon: 'bim-wall',
              commandKey: 'draw.bim.wallGroup',
              subVariants: [
                {
                  id: 'draw.bim.wall',
                  labelKey: 'ribbon.commands.bim.wall.label',
                  tooltipKey: 'ribbon.commands.bim.wall.tooltip',
                  icon: 'bim-wall',
                  commandKey: 'wall',
                  shortcut: 'W',
                },
                // ADR-363 Phase 1J — Wall on existing 2D entity (pick line/rectangle).
                {
                  id: 'draw.bim.wallOnEntity',
                  labelKey: 'ribbon.commands.bim.wallOnEntity.label',
                  tooltipKey: 'ribbon.commands.bim.wallOnEntity.tooltip',
                  icon: 'bim-wall',
                  commandKey: 'wall-on-entity',
                },
                // ADR-419 — «Τοίχος σε περιοχή» split σε 3 διακριτές εντολές
                // (από 4 γραμμές / μέσα σε περιοχή / με πλαίσιο).
                {
                  id: 'draw.bim.wallRegionLines',
                  labelKey: 'ribbon.commands.bim.wallRegionLines.label',
                  tooltipKey: 'ribbon.commands.bim.wallRegionLines.tooltip',
                  icon: 'bim-wall',
                  commandKey: 'wall-region-lines',
                },
                {
                  id: 'draw.bim.wallRegionInside',
                  labelKey: 'ribbon.commands.bim.wallRegionInside.label',
                  tooltipKey: 'ribbon.commands.bim.wallRegionInside.tooltip',
                  icon: 'bim-wall',
                  commandKey: 'wall-region-inside',
                },
                {
                  id: 'draw.bim.wallRegionBox',
                  labelKey: 'ribbon.commands.bim.wallRegionBox.label',
                  tooltipKey: 'ribbon.commands.bim.wallRegionBox.tooltip',
                  icon: 'bim-wall',
                  commandKey: 'wall-region-box',
                },
                // ADR-363 «Τοίχος από περίγραμμα» — box-select the faces of a structural
                // element (rectangle / Γ / Τ / Π) → chain of leg walls (thickness from geometry).
                {
                  id: 'draw.bim.wallFromPerimeter',
                  labelKey: 'ribbon.commands.bim.wallFromPerimeter.label',
                  tooltipKey: 'ribbon.commands.bim.wallFromPerimeter.tooltip',
                  icon: 'bim-wall',
                  commandKey: 'wall-from-perimeter',
                },
              ],
            },
            // ── Άνοιγμα (leaf) ────────────────────────────────────────────
            {
              id: 'draw.bim.opening',
              labelKey: 'ribbon.commands.bim.opening.label',
              tooltipKey: 'ribbon.commands.bim.opening.tooltip',
              icon: 'bim-opening',
              commandKey: 'opening',
              shortcut: 'OP',
            },
            // ── Πλάκα (submenu) ───────────────────────────────────────────
            {
              id: 'draw.bim.slabGroup',
              labelKey: 'ribbon.commands.bim.slabGroup.label',
              tooltipKey: 'ribbon.commands.bim.slabGroup.tooltip',
              icon: 'bim-slab',
              commandKey: 'draw.bim.slabGroup',
              subVariants: [
                {
                  id: 'draw.bim.slab',
                  labelKey: 'ribbon.commands.bim.slab.label',
                  tooltipKey: 'ribbon.commands.bim.slab.tooltip',
                  icon: 'bim-slab',
                  commandKey: 'slab',
                  shortcut: 'SL',
                },
                {
                  id: 'draw.bim.slabOpening',
                  labelKey: 'ribbon.commands.bim.slabOpening.label',
                  tooltipKey: 'ribbon.commands.bim.slabOpening.tooltip',
                  icon: 'bim-slab-opening',
                  commandKey: 'slab-opening',
                  shortcut: 'SO',
                },
              ],
            },
            // ── Κολώνες (submenu) ─────────────────────────────────────────
            // ADR-419 — διαχωρισμός του πρώην ενιαίου «Κολόνα / Τοιχίο» σε δύο
            // ξεχωριστά submenus (Giorgio 2026-06-07): εδώ μόνο κολώνες.
            {
              id: 'draw.bim.columnsGroup',
              labelKey: 'ribbon.commands.bim.columnsGroup.label',
              tooltipKey: 'ribbon.commands.bim.columnsGroup.tooltip',
              icon: 'bim-column',
              commandKey: 'draw.bim.columnsGroup',
              subVariants: [
                {
                  id: 'draw.bim.column',
                  labelKey: 'ribbon.commands.bim.column.label',
                  tooltipKey: 'ribbon.commands.bim.column.tooltip',
                  icon: 'bim-column',
                  commandKey: 'column',
                  shortcut: 'CL',
                },
                // ADR-419 «Κολώνα σε περιοχή» → 3 διακριτές εντολές.
                {
                  id: 'draw.bim.columnRegionLines',
                  labelKey: 'ribbon.commands.bim.columnRegionLines.label',
                  tooltipKey: 'ribbon.commands.bim.columnRegionLines.tooltip',
                  icon: 'bim-column',
                  commandKey: 'column-region-lines',
                },
                {
                  id: 'draw.bim.columnRegionInside',
                  labelKey: 'ribbon.commands.bim.columnRegionInside.label',
                  tooltipKey: 'ribbon.commands.bim.columnRegionInside.tooltip',
                  icon: 'bim-column',
                  commandKey: 'column-region-inside',
                },
                {
                  id: 'draw.bim.columnRegionBox',
                  labelKey: 'ribbon.commands.bim.columnRegionBox.label',
                  tooltipKey: 'ribbon.commands.bim.columnRegionBox.tooltip',
                  icon: 'bim-column',
                  commandKey: 'column-region-box',
                },
                // ADR-419 «Πολλαπλή δημιουργία κολωνών» — discrete-from-perimeter,
                // intent=columns· φτιάχνει κατευθείαν τις κολώνες, ρωτά για τυχόν τοιχία.
                {
                  id: 'draw.bim.columnDiscreteFromPerimeter',
                  labelKey: 'ribbon.commands.bim.columnDiscreteFromPerimeter.label',
                  tooltipKey: 'ribbon.commands.bim.columnDiscreteFromPerimeter.tooltip',
                  icon: 'bim-column',
                  commandKey: 'column-discrete-from-perimeter',
                },
              ],
            },
            // ── Τοιχία (submenu) ──────────────────────────────────────────
            // ADR-419 — το δεύτερο μισό του διαχωρισμού: μόνο τοιχία (φέροντα τοιχία Ο.Σ.).
            {
              id: 'draw.bim.wallPiersGroup',
              labelKey: 'ribbon.commands.bim.wallPiersGroup.label',
              tooltipKey: 'ribbon.commands.bim.wallPiersGroup.tooltip',
              icon: 'bim-column',
              commandKey: 'draw.bim.wallPiersGroup',
              subVariants: [
                // ADR-363 Φάση 3 «Τοιχίο από περίγραμμα» — ΕΝΑ τοιχίο ανά κλειστή περίμετρο.
                {
                  id: 'draw.bim.columnFromPerimeter',
                  labelKey: 'ribbon.commands.bim.columnFromPerimeter.label',
                  tooltipKey: 'ribbon.commands.bim.columnFromPerimeter.tooltip',
                  icon: 'bim-column',
                  commandKey: 'column-from-perimeter',
                },
                // ADR-419 «Πολλαπλή δημιουργία τοιχίων» — discrete-from-perimeter,
                // intent=walls· φτιάχνει κατευθείαν τα τοιχία, ρωτά για τυχόν κολώνες.
                {
                  id: 'draw.bim.columnDiscreteFromPerimeterWalls',
                  labelKey: 'ribbon.commands.bim.columnDiscreteFromPerimeterWalls.label',
                  tooltipKey: 'ribbon.commands.bim.columnDiscreteFromPerimeterWalls.tooltip',
                  icon: 'bim-column',
                  commandKey: 'column-discrete-from-perimeter-walls',
                },
              ],
            },
            // ── Δοκάρι (submenu) ──────────────────────────────────────────
            {
              id: 'draw.bim.beamGroup',
              labelKey: 'ribbon.commands.bim.beamGroup.label',
              tooltipKey: 'ribbon.commands.bim.beamGroup.tooltip',
              icon: 'bim-beam',
              commandKey: 'draw.bim.beamGroup',
              subVariants: [
                {
                  id: 'draw.bim.beam',
                  labelKey: 'ribbon.commands.bim.beam.label',
                  tooltipKey: 'ribbon.commands.bim.beam.tooltip',
                  icon: 'bim-beam',
                  commandKey: 'beam',
                  shortcut: 'BM',
                },
                // ADR-363 «Δοκάρι από τοίχο» — 1 κλικ σε υπάρχοντα τοίχο → δοκάρι στον
                // άξονά του (πλάτος = πάχος τοίχου). Ο τοίχος auto-attach-άρει την κορυφή
                // του στο κάτω μέρος του δοκαριού (ADR-401 D).
                {
                  id: 'draw.bim.beamFromWall',
                  labelKey: 'ribbon.commands.bim.beamFromWall.label',
                  tooltipKey: 'ribbon.commands.bim.beamFromWall.tooltip',
                  icon: 'bim-beam',
                  commandKey: 'beam-from-wall',
                },
              ],
            },
            // ── Σκάλα (leaf) ──────────────────────────────────────────────
            // ADR-358 Phase 5a: Stair tool (useStairTool orchestrator).
            {
              id: 'draw.stair',
              labelKey: 'ribbon.commands.stair',
              icon: 'stair',
              commandKey: 'stair',
              shortcut: 'ST',
            },
            // ── Κιγκλίδωμα (leaf) ─────────────────────────────────────────
            // ADR-407 — path-based railing (guardrail). 2-click straight sketch.
            {
              id: 'draw.bim.railing',
              labelKey: 'ribbon.commands.bim.railing.label',
              tooltipKey: 'ribbon.commands.bim.railing.tooltip',
              icon: 'bim-railing',
              commandKey: 'railing',
              shortcut: 'RL',
            },
          ],
        },
        // ADR-419 §ribbon-hierarchy — «Αρχιτεκτονικά»: μη-φέροντα στοιχεία
        // περιβλήματος (στέγη + επικάλυψη δαπέδου). Ξεχωριστός launcher από τα
        // «Δομικά Στοιχεία» (Revit-style· τα δομικά είναι μόνο φέροντα).
        {
          type: 'split',
          size: 'large',
          command: {
            id: 'draw.arch.group',
            labelKey: 'ribbon.commands.bim.archGroup.label',
            tooltipKey: 'ribbon.commands.bim.archGroup.tooltip',
            icon: 'bim-roof',
            commandKey: 'roof',
          },
          variants: [
            // ADR-417 — parametric pitched roof (footprint polygon + per-edge slopes).
            {
              id: 'draw.bim.roof',
              labelKey: 'ribbon.commands.bim.roof.label',
              tooltipKey: 'ribbon.commands.bim.roof.tooltip',
              icon: 'bim-roof',
              commandKey: 'roof',
              shortcut: 'RF',
            },
            // ADR-419 — floor finish covering (polygon per room, IfcCovering FLOORING).
            {
              id: 'draw.bim.floorFinish',
              labelKey: 'ribbon.commands.bim.floorFinish.label',
              tooltipKey: 'ribbon.commands.bim.floorFinish.tooltip',
              icon: 'bim-slab',
              commandKey: 'floor-finish',
              shortcut: 'FF',
            },
            // ADR-422 — thermal space (analytical IfcSpace, click-in-region «Place Space»).
            {
              id: 'draw.bim.thermalSpace',
              labelKey: 'ribbon.commands.bim.thermalSpace.label',
              tooltipKey: 'ribbon.commands.bim.thermalSpace.tooltip',
              icon: 'bim-slab',
              commandKey: 'thermal-space',
              shortcut: 'TS',
            },
          ],
        },
        // ADR-419 §ribbon-hierarchy — «ΗΛΜ Εγκαταστάσεις»: μηχανολογικά κατά
        // πειθαρχία (ηλεκτρολογικά / ύδρευση / αποχέτευση / θέρμανση / αερισμός),
        // καθένα ως cascading submenu. Ξεχωριστός launcher από τα δομικά.
        {
          type: 'split',
          size: 'large',
          command: {
            id: 'draw.mep.group',
            labelKey: 'ribbon.commands.bim.mepGroup.label',
            tooltipKey: 'ribbon.commands.bim.mepGroup.tooltip',
            icon: 'bim-pipe',
            commandKey: 'mep-pipe',
          },
          variants: [
            // ── Ηλεκτρολογικά (submenu) ───────────────────────────────────
            {
              id: 'draw.bim.mepElectrical',
              labelKey: 'ribbon.commands.bim.mepElectrical.label',
              tooltipKey: 'ribbon.commands.bim.mepElectrical.tooltip',
              icon: 'bim-electrical-panel',
              commandKey: 'draw.bim.mepElectrical',
              subVariants: [
                // ADR-406 — point-based MEP fixture (light fixture first).
                {
                  id: 'draw.bim.mepFixture',
                  labelKey: 'ribbon.commands.bim.mepFixture.label',
                  tooltipKey: 'ribbon.commands.bim.mepFixture.tooltip',
                  icon: 'bim-light-fixture',
                  commandKey: 'mep-fixture',
                  shortcut: 'LF',
                },
                // ADR-408 Φ3 — point-based electrical panel (circuit source).
                {
                  id: 'draw.bim.electricalPanel',
                  labelKey: 'ribbon.commands.bim.electricalPanel.label',
                  tooltipKey: 'ribbon.commands.bim.electricalPanel.tooltip',
                  icon: 'bim-electrical-panel',
                  commandKey: 'electrical-panel',
                  shortcut: 'EP',
                },
              ],
            },
            // ── Ύδρευση (submenu) ─────────────────────────────────────────
            {
              id: 'draw.bim.mepWater',
              labelKey: 'ribbon.commands.bim.mepWater.label',
              tooltipKey: 'ribbon.commands.bim.mepWater.tooltip',
              icon: 'bim-mep-manifold',
              commandKey: 'draw.bim.mepWater',
              subVariants: [
                // ADR-408 Φ12 — point-based plumbing manifold (1 inlet + N outlets).
                {
                  id: 'draw.bim.mepManifold',
                  labelKey: 'ribbon.commands.bim.mepManifold.label',
                  tooltipKey: 'ribbon.commands.bim.mepManifold.tooltip',
                  icon: 'bim-mep-manifold',
                  commandKey: 'mep-manifold',
                },
                // ADR-408 Φ8 — linear MEP pipe run (2-click). Discipline = plumbing.
                {
                  id: 'draw.bim.mepPipe',
                  labelKey: 'ribbon.commands.bim.mepPipe.label',
                  tooltipKey: 'ribbon.commands.bim.mepPipe.tooltip',
                  icon: 'bim-pipe',
                  commandKey: 'mep-pipe',
                  shortcut: 'PP',
                },
                // ADR-408 Φ10 — auto-derive pipe networks from physical connectivity.
                // `action` makes the button fire onAction(...) (NOT a tool).
                {
                  id: 'draw.bim.mepPipeNetwork',
                  labelKey: 'ribbon.commands.bim.mepPipeNetwork.label',
                  tooltipKey: 'ribbon.commands.bim.mepPipeNetwork.tooltip',
                  icon: 'bim-pipe',
                  commandKey: 'mepCircuit.actions.deriveNetworks',
                  action: 'mepCircuit.actions.deriveNetworks',
                },
              ],
            },
            // ── Αυτόματη Ύδρευση (submenu, ADR-426 Slice 2) ───────────────
            // Revit "Generate → review → accept": all three are `action`
            // buttons (fire onAction, not a draw tool).
            {
              id: 'draw.bim.waterAutoSupply',
              labelKey: 'ribbon.commands.bim.waterAutoSupply.label',
              tooltipKey: 'ribbon.commands.bim.waterAutoSupply.tooltip',
              icon: 'bim-pipe',
              commandKey: 'draw.bim.waterAutoSupply',
              subVariants: [
                {
                  id: 'draw.bim.waterAutoGenerate',
                  labelKey: 'ribbon.commands.bim.waterAutoGenerate.label',
                  tooltipKey: 'ribbon.commands.bim.waterAutoGenerate.tooltip',
                  icon: 'bim-pipe',
                  commandKey: 'waterSupply.actions.generate',
                  action: 'waterSupply.actions.generate',
                },
                {
                  id: 'draw.bim.waterAutoAccept',
                  labelKey: 'ribbon.commands.bim.waterAutoAccept.label',
                  tooltipKey: 'ribbon.commands.bim.waterAutoAccept.tooltip',
                  icon: 'bim-pipe',
                  commandKey: 'waterSupply.actions.accept',
                  action: 'waterSupply.actions.accept',
                },
                {
                  id: 'draw.bim.waterAutoReject',
                  labelKey: 'ribbon.commands.bim.waterAutoReject.label',
                  tooltipKey: 'ribbon.commands.bim.waterAutoReject.tooltip',
                  icon: 'bim-pipe',
                  commandKey: 'waterSupply.actions.reject',
                  action: 'waterSupply.actions.reject',
                },
              ],
            },
            // ── Αποχέτευση (submenu) ──────────────────────────────────────
            {
              id: 'draw.bim.mepDrainage',
              labelKey: 'ribbon.commands.bim.mepDrainage.label',
              tooltipKey: 'ribbon.commands.bim.mepDrainage.tooltip',
              icon: 'bim-mep-manifold',
              commandKey: 'draw.bim.mepDrainage',
              subVariants: [
                // ADR-408 Φ14 — drainage collector (φρεάτιο). N inlets + 1 sewer outlet.
                {
                  id: 'draw.bim.mepDrainageCollector',
                  labelKey: 'ribbon.commands.bim.mepDrainageCollector.label',
                  tooltipKey: 'ribbon.commands.bim.mepDrainageCollector.tooltip',
                  icon: 'bim-mep-manifold',
                  commandKey: 'mep-drainage-collector',
                },
                // ADR-408 Φ14 — sanitary drainage pipe (2-click), preset classification + fall.
                {
                  id: 'draw.bim.mepDrainPipe',
                  labelKey: 'ribbon.commands.bim.mepDrainPipe.label',
                  tooltipKey: 'ribbon.commands.bim.mepDrainPipe.tooltip',
                  icon: 'bim-pipe',
                  commandKey: 'mep-drain-pipe',
                  shortcut: 'DP',
                },
                // ADR-408 Φ14 — floor drain (σιφώνι/στόμιο δαπέδου). 1-click, mep-fixture.
                {
                  id: 'draw.bim.mepFloorDrain',
                  labelKey: 'ribbon.commands.bim.mepFloorDrain.label',
                  tooltipKey: 'ribbon.commands.bim.mepFloorDrain.tooltip',
                  icon: 'bim-mep-manifold',
                  commandKey: 'mep-floor-drain',
                },
                // ADR-408 Φ15 — vertical drain stack / riser (κατακόρυφη στήλη). 1-click.
                {
                  id: 'draw.bim.mepDrainRiser',
                  labelKey: 'ribbon.commands.bim.mepDrainRiser.label',
                  tooltipKey: 'ribbon.commands.bim.mepDrainRiser.tooltip',
                  icon: 'bim-pipe',
                  commandKey: 'mep-drain-riser',
                },
              ],
            },
            // ── Είδη Υγιεινής (submenu) ───────────────────────────────────
            // ADR-408 Φ14 — connectable Plumbing Fixtures (Revit): each is a 1-click
            // mep-fixture kind with a single sanitary-drainage outlet → drains into
            // the drainage network. One tool id per kind (manifold/segment convention).
            {
              id: 'draw.bim.mepSanitary',
              labelKey: 'ribbon.commands.bim.mepSanitary.label',
              tooltipKey: 'ribbon.commands.bim.mepSanitary.tooltip',
              icon: 'bim-furniture',
              commandKey: 'draw.bim.mepSanitary',
              subVariants: [
                {
                  id: 'draw.bim.mepWc',
                  labelKey: 'floorplanSymbol.catalog.wc',
                  tooltipKey: 'ribbon.commands.bim.mepSanitary.tooltip',
                  icon: 'bim-furniture',
                  commandKey: 'mep-wc',
                },
                {
                  id: 'draw.bim.mepWashbasin',
                  labelKey: 'floorplanSymbol.catalog.washbasin',
                  tooltipKey: 'ribbon.commands.bim.mepSanitary.tooltip',
                  icon: 'bim-furniture',
                  commandKey: 'mep-washbasin',
                },
                {
                  id: 'draw.bim.mepShower',
                  labelKey: 'floorplanSymbol.catalog.shower',
                  tooltipKey: 'ribbon.commands.bim.mepSanitary.tooltip',
                  icon: 'bim-furniture',
                  commandKey: 'mep-shower',
                },
                {
                  id: 'draw.bim.mepBathtub',
                  labelKey: 'floorplanSymbol.catalog.bathtub',
                  tooltipKey: 'ribbon.commands.bim.mepSanitary.tooltip',
                  icon: 'bim-furniture',
                  commandKey: 'mep-bathtub',
                },
                {
                  id: 'draw.bim.mepBidet',
                  labelKey: 'floorplanSymbol.catalog.bidet',
                  tooltipKey: 'ribbon.commands.bim.mepSanitary.tooltip',
                  icon: 'bim-furniture',
                  commandKey: 'mep-bidet',
                },
              ],
            },
            // ── Συσκευές (submenu) ────────────────────────────────────────
            // ADR-408 Δρόμος B — connectable appliances (Revit IfcElectricAppliance):
            // a DISTINCT family from «Είδη Υγιεινής». Each is a 1-click mep-fixture
            // kind with a cold-water inlet + a sanitary-drainage outlet → joins both
            // the water-supply and drainage networks. One tool id per kind.
            {
              id: 'draw.bim.mepAppliance',
              labelKey: 'ribbon.commands.bim.mepAppliance.label',
              tooltipKey: 'ribbon.commands.bim.mepAppliance.tooltip',
              icon: 'bim-furniture',
              commandKey: 'draw.bim.mepAppliance',
              subVariants: [
                {
                  id: 'draw.bim.mepWashingMachine',
                  labelKey: 'mepFixture.appliance.washingMachine',
                  tooltipKey: 'ribbon.commands.bim.mepAppliance.tooltip',
                  icon: 'bim-furniture',
                  commandKey: 'mep-washing-machine',
                },
              ],
            },
            // ── Θέρμανση (submenu) ────────────────────────────────────────
            {
              id: 'draw.bim.mepHeating',
              labelKey: 'ribbon.commands.bim.mepHeating.label',
              tooltipKey: 'ribbon.commands.bim.mepHeating.tooltip',
              icon: 'bim-mep-radiator',
              commandKey: 'draw.bim.mepHeating',
              subVariants: [
                // ADR-408 Εύρος Β — heating radiator (καλοριφέρ). Hydronic terminal.
                {
                  id: 'draw.bim.mepRadiator',
                  labelKey: 'ribbon.commands.bim.mepRadiator.label',
                  tooltipKey: 'ribbon.commands.bim.mepRadiator.tooltip',
                  icon: 'bim-mep-radiator',
                  commandKey: 'mep-radiator',
                },
                // ADR-408 Εύρος Β #2 — heating boiler (λέβητας). Hydronic source.
                {
                  id: 'draw.bim.mepBoiler',
                  labelKey: 'ribbon.commands.bim.mepBoiler.label',
                  tooltipKey: 'ribbon.commands.bim.mepBoiler.tooltip',
                  icon: 'bim-mep-boiler',
                  commandKey: 'mep-boiler',
                },
                // ADR-408 DHW — domestic hot water heater (θερμοσίφωνας). DHW source.
                {
                  id: 'draw.bim.mepWaterHeater',
                  labelKey: 'ribbon.commands.bim.mepWaterHeater.label',
                  tooltipKey: 'ribbon.commands.bim.mepWaterHeater.tooltip',
                  icon: 'bim-mep-water-heater',
                  commandKey: 'mep-water-heater',
                },
                // ADR-408 Εύρος Β #3 — underfloor radiant heating (ενδοδαπέδια). Area terminal.
                {
                  id: 'draw.bim.mepUnderfloor',
                  labelKey: 'ribbon.commands.bim.mepUnderfloor.label',
                  tooltipKey: 'ribbon.commands.bim.mepUnderfloor.tooltip',
                  icon: 'bim-mep-radiator',
                  commandKey: 'mep-underfloor',
                },
              ],
            },
            // ── Αερισμός / HVAC (submenu) ─────────────────────────────────
            {
              id: 'draw.bim.mepHvac',
              labelKey: 'ribbon.commands.bim.mepHvac.label',
              tooltipKey: 'ribbon.commands.bim.mepHvac.tooltip',
              icon: 'bim-duct',
              commandKey: 'draw.bim.mepHvac',
              subVariants: [
                // ADR-408 Φ8 — linear MEP duct run (2-click). Discipline = mechanical.
                {
                  id: 'draw.bim.mepDuct',
                  labelKey: 'ribbon.commands.bim.mepDuct.label',
                  tooltipKey: 'ribbon.commands.bim.mepDuct.tooltip',
                  icon: 'bim-duct',
                  commandKey: 'mep-duct',
                  shortcut: 'DU',
                },
              ],
            },
          ],
        },
        // ADR-415 / ADR-410 — «Αντικείμενα»: επιπλώσεις/εξοπλισμός, ΟΧΙ δομικά.
        // Ξεχωριστός launcher από τα «Δομικά Στοιχεία» (Giorgio 2026-06-04): 2D
        // σύμβολα κάτοψης (είδη υγιεινής/κουζίνα/έπιπλα) + 3D mesh έπιπλα. Το ποιο
        // 2D σύμβολο τοποθετείται επιλέγεται από την contextual καρτέλα «Ιδιότητες
        // Συμβόλου» (16 σύμβολα), όχι από ξεχωριστά κουμπιά.
        {
          type: 'split',
          size: 'large',
          command: {
            id: 'draw.objects.group',
            labelKey: 'ribbon.commands.bim.objectsGroup.label',
            tooltipKey: 'ribbon.commands.bim.objectsGroup.tooltip',
            icon: 'bim-furniture',
            commandKey: 'floorplan-symbol',
          },
          variants: [
            {
              id: 'draw.bim.floorplanSymbol',
              labelKey: 'ribbon.commands.bim.floorplanSymbol.label',
              tooltipKey: 'ribbon.commands.bim.floorplanSymbol.tooltip',
              icon: 'bim-furniture',
              commandKey: 'floorplan-symbol',
              shortcut: 'WC',
            },
            {
              id: 'draw.bim.furniture',
              labelKey: 'ribbon.commands.bim.furniture.label',
              tooltipKey: 'ribbon.commands.bim.furniture.tooltip',
              icon: 'bim-furniture',
              commandKey: 'furniture',
              shortcut: 'FN',
            },
          ],
        },
      ],
    },
  ],
};
