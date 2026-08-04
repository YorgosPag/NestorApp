/**
 * ADR-739 §39 — η **μία** δήλωση της εντολής «Πίνακας».
 *
 * Ζει χωριστά επειδή την χρειάζονται **δύο** καταναλωτές: το `insert-tab.ts` (για να τη βάλει
 * στην κορδέλα) και το `RibbonTableMenuWidget` (για να ζωγραφίσει το ίδιο εικονίδιο, την ίδια
 * ετικέτα και το ίδιο tooltip στον trigger του). Δεύτερο αντίγραφο θα σήμαινε ότι η αλλαγή
 * ενός εικονιδίου θα άφηνε το άλλο πίσω.
 *
 * Εισάγει **μόνο τύπο** — μηδέν κύκλος εισαγωγών με το `insert-tab.ts`.
 *
 * @module subapps/dxf-viewer/ui/ribbon/data/table-menu-command
 */

import type { RibbonCommand } from '../types/ribbon-types';

export const TABLE_MENU_COMMAND: RibbonCommand = {
  id: 'insert.table',
  labelKey: 'ribbon.commands.table',
  tooltipKey: 'ribbon.commands.tableTooltip',
  icon: 'table',
  // Παραμένει το `ToolType` που οπλίζει το `useTableSizeCommit` μετά την επιλογή μεγέθους.
  commandKey: 'table',
  shortcut: 'TABLE',
};
