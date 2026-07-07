/**
 * ADR-581 Φ6 — Home tab, «Ιδιότητες» panel: μεγάλο κουμπί σύριγγας.
 *
 * `commandKey:'match-properties'` ΧΩΡΙΣ `action` → ενεργοποιεί το persistent TOOL
 * (`toolStateStore.selectTool('match-properties')`, όπως Move/Copy/Rotate) αντί για
 * immediate action. Το εικονίδιο `match-syringe` είναι reactive (empty ⇄ full) μέσω
 * του brush store (βλ. `RibbonButtonIcon.tsx`). Το κουμπί παίρνει active highlight
 * όσο το εργαλείο είναι ενεργό (κοινό `activeTool` state των large buttons).
 */

import type { RibbonPanelDef } from '../types/ribbon-types';

export const HOME_MATCH_PANEL: RibbonPanelDef = {
  id: 'match',
  // Reuse (SSoT): το ίδιο label με το contextual multi-selection «Αντιγραφή Ιδιοτήτων».
  labelKey: 'ribbon.panels.multiSelectionMatch',
  rows: [
    {
      isInFlyout: false,
      buttons: [
        {
          type: 'simple',
          size: 'large',
          command: {
            id: 'match.syringe',
            labelKey: 'ribbon.commands.matchSyringe',
            tooltipKey: 'ribbon.commands.matchSyringeTooltip',
            icon: 'match-syringe',
            commandKey: 'match-properties',
            shortcut: 'MA',
          },
        },
      ],
    },
  ],
};
