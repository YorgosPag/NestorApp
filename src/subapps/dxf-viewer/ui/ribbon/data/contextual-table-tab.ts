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
  /**
   * 🔴 ADR-739 §58 Γ2 — **«Αυτόματο ύψος γραμμής»**: το ύψος ξαναγίνεται παράγωγο του
   * περιεχομένου. Η θέση είναι του Excel (*Home ▸ Cells ▸ Format ▸ AutoFit Row Height*): ομάδα
   * που μιλά για **γραμμές**, ποτέ «Στοίχιση».
   *
   * 🏆 Σε αντίθεση με το Excel, το κουμπί **απαντά**: ο bridge το εκτελεί μόνο όταν κάποια
   * γραμμή του στόχου είναι όντως καρφωμένη, ώστε να μη γεννηθεί `Ctrl+Z` που δεν αναιρεί
   * τίποτα ορατό.
   */
  { key: actions.autoFitRowHeight, name: 'autoFitRowHeight', icon: 'table-row-autofit' },
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
    {
      /**
       * 🔴 ADR-767 Δ3 — **«Δεδομένα»**: η μία ρητή ενέργεια ανανέωσης ενός δεμένου πίνακα.
       *
       * Ορατό **μόνο** όταν ο πίνακας δηλώνει πηγή (`panels.data`). Ο δεσμός δεν χρειάζεται
       * δρομέα — ανανεώνεται ολόκληρος ο πίνακας, γιατί το Δ8 ορίζει **ένα** `sourceRef` ανά
       * πίνακα. Γι' αυτό δεν μοιράζεται τον φύλακα των δύο από πάνω.
       *
       * ⛔ **Καμία αυτόματη ανανέωση.** Απόφαση Giorgio (06/08): ο πίνακας δεν ξαναγεμίζει
       * ποτέ μόνος του — δες `use-table-binding-actions.ts` για το γιατί.
       */
      id: 'table-properties-data',
      labelKey: 'ribbon.panels.tableData',
      visibilityKey: panels.data,
      keepsTableCellSession: true,
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'tableProps.refreshBinding',
                labelKey: 'ribbon.commands.tableProps.refreshBinding',
                icon: 'table-refresh-binding',
                commandKey: actions.refreshBinding,
                action: actions.refreshBinding,
              },
            },
          ],
        },
      ],
    },
    {
      /**
       * 🔴 ADR-833 §1.3 — **το panel «Αρχείο»: `.xlsx` μέσα κι έξω.**
       *
       * ⚠️ **Ορατό ΠΑΝΤΑ — και αυτό είναι η απόφαση, όχι παράλειψη.** Ο προφανής πειρασμός
       * ήταν να μπουν τα δύο κουμπιά στο διπλανό panel «Δεδομένα», που μιλά ήδη για την πηγή
       * του πίνακα. Θα ήταν **λάθος**: εκείνο κουβαλά `visibilityKey: panels.data` και
       * **εξαφανίζεται σε πίνακα χωρίς δεσμό** (ADR-767) — δηλαδή σε κάθε συνηθισμένο πίνακα,
       * που είναι ακριβώς αυτός που θέλει να ανοίξει ένα αρχείο. Το «Άνοιγμα» θα φαινόταν
       * μόνο σε όποιον **ήδη** έχει δεδομένα από αλλού.
       *
       * Ούτε μοιράζεται τον φύλακα των «Γραμμές & Στήλες»/«Επιλογή»: εκείνα ρωτούν «ποιας
       * γραμμής;» και θέλουν δρομέα. Το «Άνοιγμα» δεν ρωτά τίποτα — γεμίζει ολόκληρο τον
       * πίνακα, όπως το *File ▸ Open* δεν χρειάζεται επιλεγμένο κελί.
       */
      id: 'table-properties-file',
      labelKey: 'ribbon.panels.tableFile',
      keepsTableCellSession: true,
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'tableProps.openXlsx',
                labelKey: 'ribbon.commands.tableProps.openXlsx',
                tooltipKey: 'ribbon.commands.tableProps.openXlsxTooltip',
                icon: 'table-open-xlsx',
                commandKey: actions.openXlsx,
                action: actions.openXlsx,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'tableProps.importXlsx',
                labelKey: 'ribbon.commands.tableProps.importXlsx',
                tooltipKey: 'ribbon.commands.tableProps.importXlsxTooltip',
                icon: 'table-import-xlsx',
                commandKey: actions.importXlsx,
                action: actions.importXlsx,
              },
            },
            {
              // 🔴 ADR-833 Φάση 6 — η **τρίτη** πόρτα του ίδιου panel, και η μόνη που δείχνει
              // προς τα έξω. Μέχρι σήμερα ο πίνακας δεν είχε **καμία** εξαγωγή.
              type: 'simple',
              size: 'small',
              command: {
                id: 'tableProps.exportXlsx',
                labelKey: 'ribbon.commands.tableProps.exportXlsx',
                tooltipKey: 'ribbon.commands.tableProps.exportXlsxTooltip',
                icon: 'table-export-xlsx',
                commandKey: actions.exportXlsx,
                action: actions.exportXlsx,
              },
            },
          ],
        },
      ],
    },
  ],
};
