/**
 * 🔴 ADR-739 §57 — **η ομάδα «Πρόχειρο»** της καρτέλας «Μορφοποίηση», 1:1 με του Excel.
 *
 * ```
 *   Πρόχειρο:  [Επικόλληση▾]  Αποκοπή  Αντιγραφή  Πινέλο μορφοποίησης
 * ```
 *
 * ## 🔴 ΕΙΝΑΙ Η **ΠΡΩΤΗ** ΟΜΑΔΑ, ΚΑΙ Η ΘΕΣΗ ΕΙΝΑΙ ΜΝΗΜΗ ΧΕΡΙΟΥ
 * Στο Excel το «Πρόχειρο» κάθεται τέρμα αριστερά της *Αρχικής*, πριν από τη «Γραμματοσειρά». Ο
 * χρήστης που ξέρει Excel πάει εκεί χωρίς να διαβάσει — και μια «λογικότερη» σειρά θα ακύρωνε
 * ακριβώς αυτό που ζητήθηκε (full parity 1:1).
 *
 * ## 🔴 ΤΟ ΠΙΝΕΛΟ ΜΕΤΑΚΟΜΙΣΕ ΕΔΩ — και η θέση του δεν είναι διακοσμητική
 * Μέχρι το §57 ζούσε στη «Γραμματοσειρά», με **δηλωμένη** προσωρινότητα. Στο Excel ζει στο
 * «Πρόχειρο», και ο λόγος είναι σημασιολογικός: το πινέλο **είναι** αντιγραφή — απλώς αντιγράφει
 * μόνο την όψη. Η ίδια σκέψη που έβαλε τη συγχώνευση στη «Στοίχιση» (§56).
 *
 * ⚠️ Η «Επαναφορά μορφοποίησης» (`table-reset-format`) **μένει** στη «Γραμματοσειρά»: στο Excel
 * ζει στο «Επεξεργασία → Απαλοιφή», ομάδα που δεν υπάρχει ακόμη εδώ. Είναι **δηλωμένη απόκλιση**,
 * όχι παράλειψη — μετακομίζει όταν και αν φτιαχτεί η ομάδα «Επεξεργασία».
 *
 * ## 🔴 ΓΙΑΤΙ Η «ΕΠΙΚΟΛΛΗΣΗ» ΕΙΝΑΙ `widget` ΚΑΙ ΟΧΙ `type: 'split'`
 * Το split button της κορδέλας ζωγραφίζει το πτυσσόμενό του σε **portal** (`document.body`), και
 * ο φύλακας συνεδρίας κελιού ρωτά `closest('[data-table-session-keepalive]')` πάνω στο
 * `document.activeElement` ⇒ το κλικ σε item θα έκλεινε τον δρομέα και **θα εξαφάνιζε την ίδια
 * την καρτέλα**. Ολόκληρη η διάγνωση ζει στην κεφαλίδα του `TablePasteMenu.tsx`.
 *
 * @module subapps/dxf-viewer/ui/ribbon/data/contextual-table-format-clipboard-panel
 * @see bim/table/table-clipboard-paste.ts — τι κάνει κάθε επιλογή επικόλλησης (SSoT)
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §57
 */

import type { RibbonPanelDef } from '../types/ribbon-types';
import { TABLE_FORMAT_RIBBON_KEYS } from '../hooks/bridge/table-format-command-keys';

// ⚠️ Ένα `type: 'widget'` κουμπί απαιτεί `command` από τον τύπο, αλλά το `RibbonPanel` δεν το
// αποδίδει ποτέ. Το `commandKey` μένει κενό **επίτηδες**, ώστε καμία διαδρομή dispatch να μη
// νομίσει ότι υπάρχει εντολή να δρομολογήσει — ίδιο ιδίωμα με τα άλλα πέντε widgets της καρτέλας.
const WIDGET_NO_COMMAND = { commandKey: '' } as const;

const PASTE_WIDGET_COMMAND = {
  id: 'tableFormat.paste',
  labelKey: 'ribbon.commands.tableFormat.paste',
  ...WIDGET_NO_COMMAND,
};

const FORMAT_PAINTER_WIDGET_COMMAND = {
  id: 'tableFormat.formatPainter',
  labelKey: 'ribbon.commands.tableFormat.formatPainter',
  ...WIDGET_NO_COMMAND,
};

export const TABLE_FORMAT_CLIPBOARD_PANEL: RibbonPanelDef = {
  id: 'table-format-clipboard',
  labelKey: 'ribbon.panels.tableClipboard',
  // 🔴 §52 — **υποχρεωτικό**. Χωρίς αυτό, το κλικ στην «Αντιγραφή» κλείνει τον δρομέα και μαζί
  // του εξαφανίζεται η καρτέλα που μόλις πάτησες. Δες `TABLE_SESSION_KEEPALIVE_MARKER`.
  keepsTableCellSession: true,
  rows: [
    {
      isInFlyout: false,
      buttons: [
        { type: 'widget', size: 'small', widgetId: 'table-paste', command: PASTE_WIDGET_COMMAND },
        {
          type: 'simple',
          size: 'small',
          command: {
            id: 'tableFormat.cut',
            labelKey: 'ribbon.commands.tableFormat.cut',
            icon: 'table-cut',
            commandKey: TABLE_FORMAT_RIBBON_KEYS.actions.cut,
            action: TABLE_FORMAT_RIBBON_KEYS.actions.cut,
          },
        },
        {
          type: 'simple',
          size: 'small',
          command: {
            id: 'tableFormat.copy',
            labelKey: 'ribbon.commands.tableFormat.copy',
            icon: 'table-copy',
            commandKey: TABLE_FORMAT_RIBBON_KEYS.actions.copy,
            action: TABLE_FORMAT_RIBBON_KEYS.actions.copy,
          },
        },
        // ⚠️ **Η μόνιμη** επιφάνεια του πινέλου: το mini toolbar ζει σε μενού δεξιού κλικ που
        // κλείνει με το πρώτο βάψιμο. Δες `RibbonTableFormatPainterWidget`.
        {
          type: 'widget',
          size: 'small',
          widgetId: 'table-format-painter',
          command: FORMAT_PAINTER_WIDGET_COMMAND,
        },
      ],
    },
  ],
};
