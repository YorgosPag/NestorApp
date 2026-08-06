/**
 * 🔴 ADR-739 §52 — **η contextual καρτέλα «Ιδιότητες Πίνακα»**: ανοίγει με την επιλογή της
 * οντότητας και **μένει** όσο ο πίνακας είναι επιλεγμένος.
 *
 * Είναι η πρώτη μισή του σύνθετου trigger (ADR-566)· η «Μορφοποίηση» προστίθεται δίπλα της
 * μόλις μπεις σε κελί. Δεν αντικαθίστανται ποτέ — δύο καρτέλες, δύο ερωτήσεις:
 *
 * ```
 *   Ιδιότητες Πίνακα  →  τι ΕΙΝΑΙ ο πίνακας   (στυλ, σχήμα, επιλογή)
 *   Μορφοποίηση       →  πώς ΦΑΙΝΕΤΑΙ ό,τι διάλεξες μέσα του
 * ```
 *
 * ## 🔴 ΤΑ ΔΥΟ PANELS ΠΟΥ ΚΡΥΒΟΝΤΑΙ ΧΩΡΙΣ ΔΡΟΜΕΑ
 * Το «Στυλ» έχει νόημα με σκέτη επιλογή: είναι ιδιότητα της οντότητας. Η «Εισαγωγή γραμμής»
 * **δεν** έχει — χρειάζεται απάντηση στο «ποιας γραμμής;», και μόνο ο δρομέας τη δίνει. Είναι
 * ακριβώς η σημασιολογία του Excel (οι εντολές γραμμών/στηλών εννοούν πάντα την τρέχουσα
 * επιλογή κελιών), εκφρασμένη με τον υπάρχοντα μηχανισμό `visibilityKey` (ADR-547 Stage 4)
 * αντί για κουμπιά που δεν ξέρουν πού να γράψουν.
 *
 * ## Καμία νέα πράξη
 * Κάθε εντολή εδώ δείχνει σε κώδικα με δικά του tests: `table-style-registry` (στυλ),
 * `insertAt` / `deleteAxisTarget` + `useTableAxisActionApply` (§42), `selectWholeTable` (§43).
 * Δες την κεφαλίδα του `use-table-structure-actions.ts` για τον πίνακα αντιστοίχισης.
 *
 * ⚠️ **Κλείσιμο / σύριγγα δεν δηλώνονται** — τα βάζει το `withStandardLeadPanel` (ADR-581).
 *
 * @see ui/ribbon/data/contextual-table-format-tab.ts — η δεύτερη μισή του σύνθετου trigger
 * @see ui/table-cell-editor/use-table-structure-actions.ts — οι πράξεις
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §52
 */

import type { RibbonButton, RibbonTab } from '../types/ribbon-types';
import { TABLE_PROPERTIES_RIBBON_KEYS } from '../hooks/bridge/table-format-command-keys';

export const TABLE_CONTEXTUAL_TRIGGER = 'table-selected';

const { actions, panels } = TABLE_PROPERTIES_RIBBON_KEYS;

/**
 * Οι έξι δομικές εντολές ως δεδομένα.
 *
 * Πίνακας και όχι έξι σχεδόν-ταυτόσημα μπλοκ JSON: το σχήμα κάθε κουμπιού (τύπος, μέγεθος,
 * `commandKey === action`) είναι **το ίδιο**, και έξι αντίγραφά του θα ήταν ακριβώς ο κλώνος
 * που μετρά το CHECK 3.28 μέσα στο ίδιο commit — με έξι ευκαιρίες να ξεχαστεί το `action` σε
 * ένα από αυτά, όπου το κουμπί απλώς δεν κάνει τίποτα.
 */
const STRUCTURE_COMMANDS: readonly { readonly key: string; readonly name: string; readonly icon: string }[] = [
  { key: actions.insertRowAbove, name: 'insertRowAbove', icon: 'table-row-insert-above' },
  { key: actions.insertRowBelow, name: 'insertRowBelow', icon: 'table-row-insert-below' },
  { key: actions.insertColumnLeft, name: 'insertColumnLeft', icon: 'table-col-insert-left' },
  { key: actions.insertColumnRight, name: 'insertColumnRight', icon: 'table-col-insert-right' },
  { key: actions.deleteRow, name: 'deleteRow', icon: 'table-row-delete' },
  { key: actions.deleteColumn, name: 'deleteColumn', icon: 'table-col-delete' },
];

function structureButton(command: { key: string; name: string; icon: string }): RibbonButton {
  return {
    type: 'simple',
    size: 'small',
    command: {
      id: `tableProps.${command.name}`,
      labelKey: `ribbon.commands.tableProps.${command.name}`,
      icon: command.icon,
      commandKey: command.key,
      action: command.key,
    },
  };
}

export const CONTEXTUAL_TABLE_TAB: RibbonTab = {
  id: 'table-properties',
  labelKey: 'ribbon.tabs.tableProperties',
  isContextual: true,
  contextualTrigger: TABLE_CONTEXTUAL_TRIGGER,
  panels: [
    {
      id: 'table-properties-style',
      labelKey: 'ribbon.panels.tableStyle',
      // Ορατό **πάντα**: το στυλ είναι ιδιότητα της οντότητας, όχι της επιλογής κελιών.
      keepsTableCellSession: true,
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'tableProps.style',
                labelKey: 'ribbon.commands.tableProps.style',
                commandKey: TABLE_PROPERTIES_RIBBON_KEYS.style,
                comboboxWidthPx: 180,
                // Καμία στατική λίστα: τα στυλ ζουν στο μητρώο (built-in + όσα φτιάξει ο
                // χρήστης) και έρχονται από τον bridge — μια γραμμένη εδώ θα ξεχνούσε
                // ολόκληρη την κατηγορία «custom».
              },
            },
          ],
        },
      ],
    },
    {
      id: 'table-properties-rows-columns',
      labelKey: 'ribbon.panels.tableRowsColumns',
      visibilityKey: panels.rowsColumns,
      keepsTableCellSession: true,
      rows: [{ isInFlyout: false, buttons: STRUCTURE_COMMANDS.map(structureButton) }],
    },
    {
      id: 'table-properties-selection',
      labelKey: 'ribbon.panels.tableSelection',
      visibilityKey: panels.selection,
      keepsTableCellSession: true,
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'tableProps.selectAll',
                labelKey: 'ribbon.commands.tableProps.selectAll',
                icon: 'table-select-all',
                commandKey: actions.selectAll,
                action: actions.selectAll,
                shortcut: 'Ctrl+A',
              },
            },
          ],
        },
      ],
    },
  ],
};
