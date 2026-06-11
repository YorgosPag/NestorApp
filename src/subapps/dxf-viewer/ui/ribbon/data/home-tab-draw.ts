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
    // ADR-419 §ribbon-hierarchy — Revit-style launcher split. ADR-443 (Giorgio
    // 2026-06-12): τα «Δομικά Στοιχεία» (φέροντα) μετακινήθηκαν σε ΜΟΝΙΜΗ καρτέλα
    // «Δομικά» (STRUCTURAL_TAB, Revit "Structure") ως μεγάλα flat κουμπιά — το
    // legacy «draw.bim.group» αφαιρέθηκε. ADR-444: ομοίως «Αρχιτεκτονικά»
    // (draw.arch.group) → ARCHITECTURE_TAB και «ΗΛΜ» (draw.mep.group) → ΕΞΙ discipline
    // tabs (MEP_DISCIPLINE_TABS: electrical/water/drainage/heating/hvac/fire-gas, μία
    // ανά Η/Μ μελέτη· clash → «Ανάλυση»). Σε αυτή τη σειρά μένει μόνο το «Αντικείμενα»
    // (επιπλώσεις/σύμβολα — όχι BIM discipline). Keyboard chords remain valid in parallel.
    {
      isInFlyout: false,
      buttons: [
        // ADR-444 — «Αρχιτεκτονικά» (draw.arch.group) → ARCHITECTURE_TAB και «ΗΛΜ»
        // (draw.mep.group) → 6 discipline tabs (MEP_DISCIPLINE_TABS). Εδώ μένει μόνο
        // το «Αντικείμενα» launcher.
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
