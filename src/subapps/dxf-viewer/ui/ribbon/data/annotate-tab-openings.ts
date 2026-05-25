/**
 * ADR-376 Phase B.1 — Annotate tab "Openings" panel.
 *
 * Hosts the global "Επαναρίθμηση Ανοιγμάτων" (Renumber Openings) button as a
 * Revit-faithful IMAGINiT-style global utility — available χωρίς προ-επιλογή
 * ανοίγματος. Click → opens `RenumberOpeningsDialog` με scope/kind/manual
 * controls.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-376-opening-tags.md §7 Phase B.1
 */

import type { RibbonPanelDef } from '../types/ribbon-types';
import { OPENING_RIBBON_KEYS_ACTIONS } from '../hooks/bridge/opening-command-keys';

export const ANNOTATE_OPENINGS_PANEL: RibbonPanelDef = {
  id: 'annotate-openings',
  labelKey: 'ribbon.panels.annotateOpenings',
  rows: [
    {
      isInFlyout: false,
      buttons: [
        {
          type: 'simple',
          size: 'large',
          command: {
            id: 'annotate.openings.renumber',
            labelKey: 'ribbon.commands.openingEditor.renumber.label',
            icon: 'bim-opening-renumber',
            commandKey: OPENING_RIBBON_KEYS_ACTIONS.renumber,
            action: OPENING_RIBBON_KEYS_ACTIONS.renumber,
          },
        },
      ],
    },
  ],
};
