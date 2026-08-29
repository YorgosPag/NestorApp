/**
 * ADR-750 Φ4 / ADR-755 / ADR-739 §61 — **το συμβόλαιο** του μενού δεξιού κλικ σε κελιά.
 *
 * ## Γιατί ξεχωριστό αρχείο
 * Ζούσε μέσα στο `TableRangeContextMenu.tsx`, που έφτασε τις **451/500** γραμμές (N.7.1) και
 * χρειάστηκε χώρο για την υποδοχή «Μορφοποίηση κελιών…». **Εξαγωγή, ποτέ trim** — και η τομή
 * δεν επινοήθηκε εδώ: το **αδελφό** μενού (ζώνες δείκτη) έκανε ήδη ακριβώς αυτή την κίνηση στο
 * ADR-755 (`table-header-menu-types.ts`), με το ίδιο κριτήριο: το συμβόλαιο είναι **γνώση**, ο
 * κύκλος ζωής είναι **μηχανική**, και τα δύο δεν διαβάζονται μαζί.
 *
 * ⚠️ Το `TableRangeContextMenu.tsx` **επανεξάγει** ό,τι υπήρχε: καμία υπάρχουσα διαδρομή
 * εισαγωγής δεν αλλάζει, ακριβώς όπως και στο αδελφό μενού.
 *
 * @module subapps/dxf-viewer/ui/components/table-range-menu/table-range-menu-types
 * @see ui/components/TableRangeContextMenu.tsx — ο κύκλος ζωής και η απόδοση
 * @see ui/components/table-header-menu-types.ts — η ίδια κίνηση, στο αδελφό μενού
 */

import type { TableRangeMenuEnabled } from './table-range-menu-commands';
import type {
  TableBorderMenuHostProps,
  TableFormatSnapshot,
  TableToggleFormatKey,
} from '../table-format-toolbar/TableFormatToolbar';
import type { TableToolbarExtrasState } from '../table-format-toolbar/table-toolbar-extras';
import type { TableAxisStyleOverride, TableCellOverflow } from '../../../types/table';
import type { TextHeightStepDirection } from '../../../bim/table/table-text-height-scale';
import type { TableBorderCommandId } from '../../../bim/table/table-range-border-ops';
import type { TableDiagonalCommandId } from '../../../bim/table/table-cell-diagonal-ops';
import type {
  TableMergeCommandId,
  TableMergeState,
} from '../../../bim/table/table-range-merge-ops';
import type { TableRangeMenuSortChildId } from './table-range-menu-commands';
import type { TableCellRangeBounds } from '../../../bim/table/table-cell-range';

/**
 * 🔴 ADR-739 §52 — οι **πέντε** εντολές μορφοποίησης, παραμετρικές ως προς τα όρια.
 *
 * Ένα αντικείμενο και όχι πέντε props, για τον ίδιο λόγο που το ADR-750 έβαλε τα περιγράμματα
 * σε ένα: ο τύπος **είναι** το συμβόλαιο, και μια κατάσταση «τρεις από τις πέντε» δεν πρέπει
 * να είναι εκφράσιμη. Παραμετρικές ως προς τα **όρια** (και όχι δεμένες) επειδή ο κανόνας
 * ξαναρωτήματος του {@link TableRangeMenuProps.resolveTarget} απαιτεί να ξαναδοθούν φρέσκα
 * μετά από κάθε πράξη — ένα undo ενόσω η γραμμή ήταν ανοιχτή δεν επιτρέπεται να γράψει σε
 * κελιά που δεν υπάρχουν.
 */
export interface TableRangeFormatActions {
  readonly onToggle: (bounds: TableCellRangeBounds, key: TableToggleFormatKey) => void;
  readonly onStepSize: (
    bounds: TableCellRangeBounds,
    direction: TextHeightStepDirection,
  ) => void;
  readonly onReset: (bounds: TableCellRangeBounds) => void;
  readonly onSetTextColor: (bounds: TableCellRangeBounds, value: string | undefined) => void;
  readonly onSetFillColor: (
    bounds: TableCellRangeBounds,
    value: string | null | undefined,
  ) => void;
  /**
   * 🔴 ADR-739 §55 — ο **ΕΝΑΣ** γραφέας των τεσσάρων υπόλοιπων πεδίων (γραμματοσειρά, μέγεθος,
   * αριθμητική μορφή, στοίχιση).
   *
   * Ένας χειριστής με το **κλειδί ως όρισμα** και όχι τέσσερα props: και τα τέσσερα
   * χειριστήρια καταλήγουν στο ίδιο `setField(target, key, value)` του
   * `table-format-commands.ts`, οπότε τέσσερις υπογραφές θα ήταν τέσσερις ευκαιρίες να πάρει
   * κάποια από αυτές δικό της δρόμο εγγραφής. Η γενική παράμετρος κρατά την αντιστοίχιση
   * κλειδί↔τιμή σφιχτή — καμία δήλωση χωρίς απόδειξη.
   *
   * ⚠️ Τα **δύο χρώματα** κρατούν δικά τους props (από τη Φ.Ε): η υπογραφή τους κωδικοποιεί
   * τις **τρεις καταστάσεις** του γεμίσματος (`hex` / `null` / `undefined`) στο ίδιο το
   * συμβόλαιο της επιφάνειας, πληροφορία που ένας γενικός γραφέας δεν φέρνει στο μάτι του
   * αναγνώστη.
   */
  readonly onSetField: <K extends keyof TableAxisStyleOverride>(
    bounds: TableCellRangeBounds,
    key: K,
    value: TableAxisStyleOverride[K] | undefined,
  ) => void;
  /**
   * 🔴 ADR-739 §58 Γ2 — ο γραφέας του **ξεχειλίσματος**· ξεχωριστός από το {@link onSetField}.
   *
   * Δεν χωρά εκεί: το `overflow` **δεν είναι** `keyof TableAxisStyleOverride` — ζει μόνο στο
   * `TableCellStyleOverride`. Ιδια ακριβώς δήλωση με το `onSetOverflow` του μενού των ζωνών δείκτη.
   */
  readonly onSetOverflow: (bounds: TableCellRangeBounds, value: TableCellOverflow) => void;
  /**
   * 🔴 ADR-739 §61 — **«Μορφοποίηση κελιών…»**: ο κανονικός δρόμος του Excel προς τον διάλογο.
   *
   * ## Γιατί ζει στη ΜΟΡΦΟΠΟΙΗΣΗ και όχι στις εντολές δεδομένων
   * Στη διάταξη του Excel το item κάθεται στην **έβδομη** ομάδα, δίπλα σε «Επιλογή από λίστα» και
   * «Ορισμός ονόματος» — δηλαδή οπτικά ανάμεσα στα δεδομένα. Το κριτήριο εδώ όμως δεν είναι η
   * **θέση** αλλά η **πράξη**: ανοίγει την επιφάνεια που γράφει στυλ, με τον ίδιο ακριβώς
   * `FormatTarget` που δίνουν τα άλλα εννιά χειριστήρια μορφοποίησης. Η διάταξη ζει, όπως πάντα,
   * στο {@link TABLE_RANGE_MENU_GROUPS} — και εκεί το item υπήρχε **ήδη**, γκρίζο, από το §43.
   *
   * ⚠️ Παραμετρική ως προς τα όρια σαν όλες τις υπόλοιπες: ο στόχος γεννιέται **μέσα** στον
   * χειριστή, τη στιγμή του πατήματος. Ένας δεμένος στόχος θα άνοιγε διάλογο πάνω σε κελιά που
   * ένα `Ctrl+Z` έχει ήδη σβήσει, ενόσω το μενού ήταν ανοιχτό.
   */
  readonly onOpenFormatCells: (bounds: TableCellRangeBounds) => void;
}

/**
 * 🔴 Οι **έξι** εντολές δεδομένων του μενού (Excel 1:1), παραμετρικές ως προς τα όρια.
 *
 * Ένα αντικείμενο και όχι έξι props — ίδιος λόγος με το {@link TableRangeFormatActions}: ο
 * τύπος **είναι** το συμβόλαιο. Παραμετρικές ως προς τα όρια για τον ίδιο λόγο κι εκεί: το
 * μενού μπορεί να ξαναρωτήσει μετά από πράξη, και μια δεμένη κλειστότητα θα κρατούσε όρια που
 * ένα `Ctrl+Z` έχει ήδη διαγράψει.
 *
 * ⚠️ Ο **τύπος επιστροφής** δέχεται `Promise` όπως και η συγχώνευση: η εισαγωγή και η διαγραφή
 * κελιών ρωτούν πριν μετακινήσουν περιεχόμενο, και ο `runOnRange` οφείλει να ξαναρωτήσει
 * την κατάσταση **αφού** απαντηθεί η ερώτηση, ποτέ ενόσω ο διάλογος είναι ανοιχτός.
 */
export interface TableRangeCommandActions {
  readonly onCut: (bounds: TableCellRangeBounds) => void | Promise<void>;
  readonly onCopy: (bounds: TableCellRangeBounds) => void | Promise<void>;
  readonly onPaste: (bounds: TableCellRangeBounds) => void | Promise<void>;
  readonly onInsert: (bounds: TableCellRangeBounds) => void | Promise<void>;
  readonly onDelete: (bounds: TableCellRangeBounds) => void | Promise<void>;
  readonly onClearContents: (bounds: TableCellRangeBounds) => void | Promise<void>;
  /**
   * 🔴 ADR-828 Φ4β — **«Ταξινόμηση ▶»**: γρήγορη ταξινόμηση ή ο διάλογος.
   *
   * Παραμετρική ως προς τα όρια όπως οι έξι αδελφές της, και για τον ίδιο λόγο: το μενού
   * επιβιώνει για την επόμενη εντολή, και ένα `Ctrl+Z` ενδιάμεσα πρέπει να σημαίνει «καμία
   * πράξη» αντί για γραφή σε κελιά που δεν υπάρχουν πια.
   */
  readonly onSort: (
    bounds: TableCellRangeBounds,
    child: TableRangeMenuSortChildId,
  ) => void | Promise<void>;
}

/**
 * Ο στόχος, **παγωμένος στο άνοιγμα**: τα όρια που θα γραφτούν, το όνομα που φαίνεται και το τι
 * έχει νόημα να πατηθεί. Όλα μαζί, ώστε να μην μπορούν να αποκλίνουν μεταξύ τους — ίδια
 * σύμβαση με το `OpenTarget` του μενού των ζωνών.
 */
export interface TableRangeMenuTarget {
  readonly bounds: TableCellRangeBounds;
  /** `C3` για ένα κελί, `B2:D4` για περιοχή — η γλώσσα του χρήστη, ποτέ «ακμή» (Α5). */
  readonly label: string;
  readonly canReset: boolean;
  /** ADR-750 Φ5 (Α2) — υπάρχει διαγώνιος να σβηστεί; Ίδια σύμβαση με το {@link canReset}. */
  readonly canClearDiagonals: boolean;
  /**
   * ADR-755 — τι ισχύει για τη **συγχώνευση**. Ανανεώνεται μετά από κάθε εντολή, γιατί η
   * γραμμή εργαλείων επιβιώνει του μενού και το κουμπί οφείλει να δείξει πατημένο.
   */
  readonly merge: TableMergeState;
  /** ADR-755 — το dropdown περιγραμμάτων, σε μία ερώτηση (ίδιο σχήμα με το μενού ζωνών). */
  readonly borders: TableBorderMenuHostProps;
  /**
   * 🔴 ADR-739 §52 — **τι δείχνουν τα εννιά χειριστήρια μορφοποίησης** για αυτά τα κελιά.
   *
   * Έλειπε μέχρι το §52 — όχι από παράλειψη: δεν υπήρχε γραφέας για το
   * `TableCell.styleOverride`, οπότε το τμήμα θα ήταν εννιά κουμπιά που δεν κάνουν τίποτα.
   */
  readonly format: TableFormatSnapshot;
  /**
   * 🔴 ADR-739 §55 — **τυπογραφία, αριθμητική μορφή και στοίχιση** για αυτά τα κελιά.
   *
   * Έλειπε μέχρι το §55 για τον ίδιο λόγο που έλειπε και το {@link format} μέχρι το §52: τα
   * τμήματα υπήρχαν στη γραμμή ως **προαιρετικά** props και κανείς δεν τα τροφοδοτούσε, άρα
   * δεν αποδίδονταν καθόλου. Δεν έλειπε κουμπί — έλειπε η **ανάγνωση**.
   */
  readonly toolbar: TableToolbarExtrasState;
  /**
   * 🔴 **Ποιες εντολές έχουν νόημα ΤΩΡΑ** — π.χ. δεν υπάρχει τίποτα να επικολληθεί.
   *
   * Ζει στον **στόχο** και όχι σε prop, επειδή είναι ακριβώς το είδος της απάντησης που ο
   * στόχος υπάρχει για να παγώνει: εξαρτάται από τα ίδια τα όρια *και* από τη στιγμή, και
   * ξαναρωτιέται μετά από κάθε πράξη μέσω του {@link TableRangeMenuProps.resolveTarget}. Μια
   * σταθερή τιμή σε prop θα ήταν μπαγιάτικη ακριβώς εκεί που μετράει: μετά από «Αποκοπή», η
   * «Επικόλληση» γίνεται πατήσιμη — και το μενού επιβιώνει για την **επόμενη** εντολή.
   *
   * Ό,τι λείπει από τον χάρτη μένει γκρίζο· δες τον έναν κανόνα στο `TableRangeMenuItems`.
   */
  readonly commands: TableRangeMenuEnabled;
}

export interface TableRangeMenuProps {
  readonly onApplyBorder: (bounds: TableCellRangeBounds, commandId: TableBorderCommandId) => void;
  readonly onResetBorders: (bounds: TableCellRangeBounds) => void;
  /**
   * ADR-750 Φ5 (Α2) — οι **διαγώνιοι**.
   *
   * ⚠️ Αυτή η υποδοχή δείχνει τις **εντολές** (13 + 4), όχι τη ζώνη σχεδίασης του μολυβιού:
   * το μολύβι είναι **εργαλείο**, όχι εντολή, και ζει σε ένα σημείο — τη γραμμή εργαλείων.
   * Δύο σημεία ρύθμισης του ίδιου μολυβιού θα ήταν δύο απαντήσεις στο «με τι γράφω τώρα».
   * Το ίδιο κάνουν AutoCAD και Excel: ο πένα ρυθμίζεται μία φορά, εφαρμόζεται από παντού.
   */
  readonly onApplyDiagonal: (
    bounds: TableCellRangeBounds,
    commandId: TableDiagonalCommandId,
  ) => void;
  /** ADR-755 — μία από τις τέσσερις εντολές συγχώνευσης· ασύγχρονη όταν ρωτά (δες §4). */
  readonly onApplyMerge: (
    bounds: TableCellRangeBounds,
    commandId: TableMergeCommandId,
  ) => void | Promise<void>;
  /** ADR-739 §52/§61 — οι εντολές μορφοποίησης κελιών (Β/Ι/Υ, χρώματα, μέγεθος, ο διάλογος). */
  readonly formatActions: TableRangeFormatActions;
  /**
   * Οι **έξι εντολές δεδομένων** του μενού. Ένα prop, όχι έξι — δες
   * {@link TableRangeCommandActions}.
   */
  readonly rangeActions: TableRangeCommandActions;
  /** Ξαναρωτά την κατάσταση μετά από εντολή — η γραμμή επιβιώνει και οφείλει να λέει αλήθεια. */
  readonly resolveTarget: (bounds: TableCellRangeBounds) => TableRangeMenuTarget | null;
  /** Το μενού έκλεισε — με ή χωρίς ενέργεια. Εδώ επιστρέφει η εστίαση στο κελί. */
  readonly onClosed: () => void;
}

export interface TableRangeContextMenuHandle {
  open: (x: number, y: number, target: TableRangeMenuTarget) => void;
  close: () => void;
}
