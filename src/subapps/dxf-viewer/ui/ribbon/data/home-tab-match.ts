/**
 * ADR-581 Φ6 — Home tab, «Ιδιότητες» panel: μεγάλο κουμπί σύριγγας.
 *
 * Ο ορισμός του κουμπιού ζει στο `match-syringe-command.ts` (SSoT) — το ΙΔΙΟ κουμπί
 * μπαίνει και στο leading panel κάθε contextual tab, οπότε η σημασιολογία του
 * (persistent tool, ΧΩΡΙΣ `action`) δεν επιτρέπεται να αποκλίνει ανά call site.
 */

import type { RibbonPanelDef } from '../types/ribbon-types';
import { buildMatchSyringeCommand } from './match-syringe-command';

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
          command: buildMatchSyringeCommand('match.syringe'),
        },
      ],
    },
  ],
};
