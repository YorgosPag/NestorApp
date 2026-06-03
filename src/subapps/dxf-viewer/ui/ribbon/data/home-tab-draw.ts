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
    // ADR-363 Phase 4.5d → centralized into a single split button (Giorgio
    // 2026-05-29). All seven BIM entities (wall/opening/slab/slabOpening/
    // column/beam + stair) collapse into ONE "Δομικά Στοιχεία" launcher with a
    // dropdown of variants, mirroring the Line/Circle/Arc split-button SSoT
    // pattern. Top-half fires the last-used variant; chevron opens the list.
    // Keyboard chords (W/OP/SL/SO/CL/BM/ST) remain valid in parallel.
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
            // ADR-363 Phase 1K — Wall in region (pick 4 lines / click inside / box).
            {
              id: 'draw.bim.wallInRegion',
              labelKey: 'ribbon.commands.bim.wallInRegion.label',
              tooltipKey: 'ribbon.commands.bim.wallInRegion.tooltip',
              icon: 'bim-wall',
              commandKey: 'wall-in-region',
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
            {
              id: 'draw.bim.opening',
              labelKey: 'ribbon.commands.bim.opening.label',
              tooltipKey: 'ribbon.commands.bim.opening.tooltip',
              icon: 'bim-opening',
              commandKey: 'opening',
              shortcut: 'OP',
            },
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
            {
              id: 'draw.bim.column',
              labelKey: 'ribbon.commands.bim.column.label',
              tooltipKey: 'ribbon.commands.bim.column.tooltip',
              icon: 'bim-column',
              commandKey: 'column',
              shortcut: 'CL',
            },
            // ADR-363 Φάση 3 «Τοιχίο από περίγραμμα» — box-select the faces of a
            // structural element (ορθογώνιο/Γ/Τ/Π/σύνθετο) → ΕΝΑ τοιχίο (ColumnEntity)
            // ανά κλειστή περίμετρο (exact-polygon για μη-ορθογωνικά).
            {
              id: 'draw.bim.columnFromPerimeter',
              labelKey: 'ribbon.commands.bim.columnFromPerimeter.label',
              tooltipKey: 'ribbon.commands.bim.columnFromPerimeter.tooltip',
              icon: 'bim-column',
              commandKey: 'column-from-perimeter',
            },
            // ADR-363 Φάση 3c «Κολώνα από περίγραμμα» — box-select παρειές → ΧΩΡΙΣ ένωση,
            // κάθε περίγραμμα ξεχωριστό· αυτόματη ταξινόμηση κολώνα/τοιχίο από αναλογία
            // πλευρών + ενημερωτικό confirm dialog (στατικά τίμιο, μη αλλοίωση).
            {
              id: 'draw.bim.columnDiscreteFromPerimeter',
              labelKey: 'ribbon.commands.bim.columnDiscreteFromPerimeter.label',
              tooltipKey: 'ribbon.commands.bim.columnDiscreteFromPerimeter.tooltip',
              icon: 'bim-column',
              commandKey: 'column-discrete-from-perimeter',
            },
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
            // ADR-358 Phase 5a: Stair tool (useStairTool orchestrator),
            // folded into the BIM group (Giorgio 2026-05-29).
            {
              id: 'draw.stair',
              labelKey: 'ribbon.commands.stair',
              icon: 'stair',
              commandKey: 'stair',
              shortcut: 'ST',
            },
            // ADR-406 — point-based MEP fixture (light fixture first). Single-click
            // placement; discipline = electrical (ADR-405 discipline visibility).
            {
              id: 'draw.bim.mepFixture',
              labelKey: 'ribbon.commands.bim.mepFixture.label',
              tooltipKey: 'ribbon.commands.bim.mepFixture.tooltip',
              icon: 'bim-light-fixture',
              commandKey: 'mep-fixture',
              shortcut: 'LF',
            },
            // ADR-408 Φ3 — point-based electrical panel (circuit source). Single-click
            // placement; discipline = electrical (ADR-405 discipline visibility).
            {
              id: 'draw.bim.electricalPanel',
              labelKey: 'ribbon.commands.bim.electricalPanel.label',
              tooltipKey: 'ribbon.commands.bim.electricalPanel.tooltip',
              icon: 'bim-electrical-panel',
              commandKey: 'electrical-panel',
              shortcut: 'EP',
            },
            // ADR-407 — path-based railing (guardrail). 2-click straight sketch;
            // discipline = architectural (ADR-405 discipline visibility).
            {
              id: 'draw.bim.railing',
              labelKey: 'ribbon.commands.bim.railing.label',
              tooltipKey: 'ribbon.commands.bim.railing.tooltip',
              icon: 'bim-railing',
              commandKey: 'railing',
              shortcut: 'RL',
            },
            // ADR-410 — mesh-based CC0 furniture (chair first). Single-click
            // placement; discipline = interior (ADR-405 discipline visibility).
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
