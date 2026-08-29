/**
 * 🔴 ADR-753 §28 — **το συμβόλαιο του επεξεργαστή κελιού**, χωριστά από την υλοποίησή του.
 *
 * Εξήχθη από το `TableCellEditorOverlay.tsx` όταν εκείνο πέρασε τις 500 γραμμές (N.7.1). Δεν
 * είναι μετακόμιση για τον αριθμό: το «τι χρειάζεται ο επεξεργαστής για να υπάρξει» είναι
 * ερώτηση που την **διαβάζει** ο καλών (`useTableCellDoubleClickEditor`, που συνθέτει αυτά τα
 * props), ενώ το «πώς συμπεριφέρεται» δεν τον αφορά καθόλου. Ο ίδιος διαχωρισμός που ήδη
 * κάνουν τα `table-cell-session-types.ts` και `table-text-toolbar-types.ts` του φακέλου.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-cell-editor-overlay-types
 * @see ui/table-cell-editor/TableCellEditorOverlay.tsx — η υλοποίηση και το σκεπτικό της
 * @see docs/centralized-systems/reference/adrs/ADR-753-table-cell-rich-text.md §28
 */

import type { ClipboardEvent } from 'react';
import type { TextEditorAnchor } from '../text-toolbar/TextEditorAnchorLayer';
import type { TableCellStyle } from '../../bim/table/table-style';
import type { TableCellTextRun, TableColumnId, TableRowId } from '../../types/table';
import type { TableCellCursorMode } from '../../state/table-cell-cursor-store';
import type { TableCellSessionHandlers } from './table-cell-session-types';

export interface TableCellEditorOverlayProps extends TableCellSessionHandlers {
  readonly entityId: string;
  /** Μαζί με το `sessionId` συνθέτουν το `key` του καλούντος — δες το store. */
  readonly rowId: TableRowId;
  readonly colId: TableColumnId;
  readonly mode: TableCellCursorMode;
  /**
   * Το **πρόχειρο** της συνεδρίας γραφής — ζει στον δρομέα, όχι εδώ. Δες το σχόλιο του
   * `TableCellCursorState.draft`: τοπικό `useState` χανόταν σε ασύγχρονο ξαναστήσιμο.
   */
  readonly draft: string;
  /** Το **δεσμευμένο** κείμενο του κελιού, διαβασμένο από το μοντέλο τη στιγμή της απόδοσης. */
  readonly initialText: string;
  /**
   * 🔴 ADR-753 §28 — η μορφοποίηση **ανά χαρακτήρα**, σε δείκτες του {@link initialText}.
   *
   * Τα δύο ταξιδεύουν **μαζί** και διαβάζονται από την ίδια ανάγνωση μοντέλου
   * (`TableCellEditTarget`): δείκτες χωρίς τη βάση τους δεν μπορούν να πουν αν δείχνουν ακόμη
   * στα ίδια γράμματα (§25 / ADR-769). Ο επεξεργαστής τα μετατοπίζει στο **πρόχειρο** με τον
   * ίδιο κανόνα που θα τρέξει και στη δέσμευση — δες `tableCellEditorSpans`.
   */
  readonly runs?: readonly TableCellTextRun[];
  /**
   * 🔴 ADR-753 §28 — το **επιλυμένο** στυλ του κελιού: η βάση από την οποία κληρονομεί κάθε
   * τμήμα, και το μέτρο του «τι διαφέρει».
   *
   * Είναι το **ίδιο** αντικείμενο που τροφοδοτεί το ζωντανό κουτί (`TableCellEditorFrame`),
   * όχι δεύτερη επίλυση: αλλιώς το πεδίο θα μπορούσε να θεωρεί βάση του κάτι άλλο από αυτό
   * που ζωγραφίζει, και η διαφορά θα εμφανιζόταν ως τμήματα που δηλώνουν περιττά ή που
   * ξεχνούν να δηλώσουν.
   */
  readonly cellStyle: TableCellStyle;
  /**
   * ADR-739 Φ.Δ βήμα 3 — ο χαρακτήρας στον οποίο στήνεται ο κέρσορας· `undefined` ⇒ τέλος.
   * Το γεμίζει μόνο το διπλό κλικ (Excel: μπαίνεις εκεί που έδειξες).
   */
  readonly caretIndex?: number;
  /**
   * 🔴 ADR-754 §4 — **η αφορμή** για να ξαναμπεί ο κέρσορας στο {@link caretIndex}. Δες το
   * σχόλιο του πεδίου στο store: η θέση μόνη της δεν αρκεί, γιατί δύο υποδείξεις στο ίδιο
   * σημείο είναι δύο γεγονότα με ίδια θέση.
   */
  readonly caretRevision: number;
  readonly anchor: TextEditorAnchor;
  /**
   * ADR-739 Φ.Δ βήμα 8 — τα **φυσικά** συμβάντα προχείρου του browser. Δεν είναι πλήκτρα:
   * δες `use-table-range-actions.ts` για τους τέσσερις λόγους που το `Ctrl+C` **δεν**
   * αναγνωρίζεται ως `keydown`, και `table-cell-session-types.ts` για το γιατί ζουν εδώ
   * και όχι στο κοινό συμβόλαιο των δύο πεδίων.
   */
  readonly onCopy: (event: ClipboardEvent<HTMLElement>) => void;
  readonly onCut: (event: ClipboardEvent<HTMLElement>) => void;
  readonly onPaste: (event: ClipboardEvent<HTMLElement>) => void;
  /**
   * ADR-751 Φ8.γ — `Alt+Enter` σε **πλοήγηση**: άνοιξε τη διεύθυνση αυτού του κελιού.
   *
   * Ζει εδώ και όχι στο κοινό {@link TableCellSessionHandlers} επειδή η γραμμή τύπων δεν
   * μπορεί να βρεθεί σε πλοήγηση — δες το `onOpenLink` του `use-table-cell-session-keys`.
   */
  readonly onOpenLink: () => void;
  /**
   * 🔴 ADR-828 Φ4α — `Alt+↓` σε **πλοήγηση**: άνοιξε το μενού του κουμπιού «Επιλογές Αυτόματης
   * Συμπλήρωσης», αν το κουμπί ζει.
   *
   * Ζει εδώ και όχι στο κοινό {@link TableCellSessionHandlers} για τον **ίδιο** λόγο με το
   * {@link onOpenLink} από πάνω: παράγεται μόνο σε `nav`, όπου η γραμμή τύπων δεν μπορεί να
   * βρεθεί ποτέ.
   */
  readonly onFillOptions: () => void;
  /**
   * 🔴 ADR-767 Δ1 — **το κελί τρέφεται από πηγή**: ο επεξεργαστής ανοίγει, αλλά δεν γράφεται.
   *
   * Ανοίγει και δεν κλειδώνει την είσοδο, επίτηδες: ο χρήστης πρέπει να μπορεί να **δει** και
   * να **αντιγράψει** την τιμή, όπως σε κάθε φύλλο υπολογισμού — αυτό που δεν επιτρέπεται
   * είναι να πληκτρολογήσει κάτι που θα εξαφανιζόταν στο επόμενο refresh.
   *
   * ⚠️ Ο φρουρός είναι **διπλός** (N.7.2 #4): εδώ ζει η **παρουσίαση** (`readOnly` στο πεδίο),
   * ενώ ο πραγματικός φύλακας ζει στο `buildTableCellEditCommand` και πιάνει κάθε άλλο
   * μονοπάτι εγγραφής. Το ένα χωρίς το άλλο είναι ή ευγενική παράκληση ή μυστήριο.
   */
  readonly readOnly: boolean;
}
