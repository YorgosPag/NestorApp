'use client';

/**
 * ADR-750 Φάση 4 + **ADR-755** — **το δεξί κλικ πάνω σε κελιά πίνακα**: mini toolbar από πάνω,
 * εντολές από κάτω.
 *
 * ## 🔴 ΓΙΑΤΙ ΑΠΕΚΤΗΣΕ ΓΡΑΜΜΗ ΕΡΓΑΛΕΙΩΝ (ADR-755) — ανατροπή της Φ4
 * Εδώ έγραφε: «κανονικό μενού και όχι δεύτερο mini toolbar … το δεξί κλικ σε κελιά έχει
 * **μόνο** περιγράμματα, άρα δεν υπάρχει δεύτερη επιφάνεια από κάτω». Η πρόταση ήταν σωστή
 * **για το περιεχόμενο που υπήρχε τότε**.
 *
 * Ο ιδιοκτήτης ζήτησε συγχώνευση κελιών «στο mini toolbar», δείχνοντας το Excel: εκεί το
 * κουμπί «Συγχώνευση και κεντράρισμα» ζει ακριβώς σε αυτή τη χειρονομία — δεξί κλικ πάνω σε
 * **επιλεγμένα κελιά**. Άρα η επιφάνεια δεν προστέθηκε για συμμετρία· προστέθηκε επειδή η
 * πράξη που ζητήθηκε κατοικεί εκεί.
 *
 * ## 🔴 Τι δείχνει η γραμμή εδώ — **ΑΝΑΤΡΟΠΗ ΤΟΥ §52**
 * Εδώ έγραφε: «**Μόνο** πράξεις περιοχής: συγχώνευση, περιγράμματα. Το τμήμα μορφοποίησης
 * άξονα (Β/Ι/Υ, χρώματα, μέγεθος) **λείπει** — γράφει `styleOverride` γραμμής/στήλης, και πάνω
 * σε επιλογή κελιών δεν υπάρχει άξονας να γράψει».
 *
 * Η πρόταση ήταν σωστή και η αιτία της **πραγματική** — αλλά ήταν έλλειψη του μοντέλου, όχι
 * σχεδιαστική επιλογή. Το §52 έγραψε τον γραφέα που έλειπε (`TableCell.styleOverride`) και την
 * επιλογή στόχου (`table-format-scope.ts`), οπότε η γραμμή δείχνει πλέον **και τα εννιά**
 * χειριστήρια — με στόχο τα μαρκαρισμένα κελιά. Δεν έλειπε κουμπί· έλειπε η **πράξη**.
 *
 * ## 🔴 ΤΙ ΔΕΙΧΝΕΙ ΤΟ ΜΕΝΟΥ ΑΠΟ ΚΑΤΩ — **ΑΝΑΤΡΟΠΗ ΤΗΣ Φ4 ΚΑΙ ΤΟΥ ADR-755**
 * Μέχρι σήμερα (06/08) το σώμα του μενού ήταν **22 εντολές μορφοποίησης**: 4 συγχώνευσης, 13
 * περιγραμμάτων, η επαναφορά τους και 4 διαγώνιοι. Η αιτιολόγηση ήταν πραγματική — «ίδια
 * γνώση, άλλη υποδοχή» — αλλά απαντούσε σε **λάθος ερώτηση**: όχι «τι ανήκει στο δεξί κλικ»,
 * αλλά «τι μπορούμε να δείξουμε δωρεάν, μια και το μητρώο υπάρχει ήδη».
 *
 * Ο ιδιοκτήτης παρήγγειλε το μενού της γωνίας «επιλογή όλων» **1:1 με το Excel**. Εκεί η
 * διάταξη δεν είναι αισθητική προτίμηση αλλά διαχωρισμός ρόλων: **η γραμμή εργαλείων κρατά τη
 * μορφή, το μενού κρατά τα δεδομένα** (αποκοπή/αντιγραφή/επικόλληση, εισαγωγή/διαγραφή/
 * απαλοιφή, φίλτρο/ταξινόμηση, σχόλια). Άρα οι 22 εντολές έφυγαν από **εδώ**.
 *
 * ⚠️ **Καμία δεν χάθηκε — και καμία δεν μετακόμισε.** Και οι 22 ζουν ήδη στο
 * {@link TableFormatToolbar} από πάνω (`TableMergeMenu` + `TableBorderMenu`), που μένει
 * ανέπαφο και εμφανίζεται με **την ίδια χειρονομία**, στο ίδιο σημείο, ταυτόχρονα με το μενού.
 * Πριν, οι ίδιες εντολές φαίνονταν **δύο φορές στην ίδια οθόνη**· η αφαίρεση είναι διόρθωση
 * αυτής της διπλοεγγραφής, όχι απώλεια λειτουργίας.
 *
 * ## 🔑 ΟΨΗ 1:1 ΤΩΡΑ, ΛΕΙΤΟΥΡΓΙΑ ΣΤΑΔΙΑΚΑ — ρητή απόφαση ιδιοκτήτη
 * Δεκαπέντε items, από τα οποία **έξι** έχουν πράξη σήμερα. Τα υπόλοιπα εμφανίζονται γκρίζα,
 * όπως ακριβώς η «Γρήγορη ανάλυση» είναι γκρίζα και μέσα στο ίδιο το Excel: ο χρήστης μαθαίνει
 * **πού** ζει η εντολή πριν αυτή υπάρξει, και δεν πατά ποτέ κάτι που δεν κάνει τίποτα. Η
 * ενεργοποίηση γράφεται σε **ένα** σημείο (δες {@link TableRangeMenuItems}), οπότε είναι
 * αδύνατο να ξεχαστεί γκρίζο ένα item που απέκτησε πράξη.
 *
 * ## 🔑 Α22 — ο στόχος είναι το κελί, ΕΚΤΟΣ αν ανήκει στην επιλογή
 * ```
 * επιλογή B2:D4, δεξί κλικ στο C3  ⇒  στόχος B2:D4   (μέσα στην επιλογή)
 * επιλογή B2:D4, δεξί κλικ στο E5  ⇒  στόχος E5      (έξω από αυτήν)
 * καμία επιλογή,  δεξί κλικ στο E5  ⇒  στόχος E5
 * ```
 * Είναι **ακριβώς η σημασιολογία του Excel**, χωρίς την παρενέργειά του. Το Excel τη
 * συμπεραίνει *μετακινώντας* την επιλογή στο κελί που πατήθηκε· εδώ το δεξί κλικ δεν αγγίζει
 * ποτέ την επιλογή (ADR-739 §27.14: «το δεξί σταματά εδώ»), οπότε ο ίδιος κανόνας βγαίνει από
 * την **ερώτηση** αντί από τη μεταβολή.
 *
 * ## 🔑 Η ΓΝΩΣΗ ΤΩΝ ΕΝΤΟΛΩΝ ΔΕΝ ΞΑΝΑΓΡΑΦΕΤΑΙ ΕΔΩ
 * Εδώ έγραφε ότι σειρά, ομάδες, εικονίδια και ετικέτες έρχονται από τα μητρώα της γραμμής
 * εργαλείων (`tableBorderMenuItems`, `TABLE_DIAGONAL_COMMANDS`, `TABLE_MERGE_COMMANDS`). Ο
 * **κανόνας** μένει ακέραιος — άλλαξε μόνο **ποιο** μητρώο διαβάζεται: τη διάταξη του μενού
 * την κατέχει πλέον το {@link TABLE_RANGE_MENU_GROUPS} και την απόδοση το
 * {@link TableRangeMenuItems}. Αυτό το αρχείο κρατά ό,τι είναι όντως δικό του: τον κύκλο ζωής,
 * τον στόχο και τον **έναν** δρόμο εκτέλεσης ({@link runOnRange}).
 *
 * @module subapps/dxf-viewer/ui/components/TableRangeContextMenu
 * @see ui/table-cell-editor/use-table-range-menu.ts — ποιος το ανοίγει και με ποιον στόχο
 * @see ui/components/table-range-menu/table-range-menu-commands.ts — η διάταξη (Excel 1:1)
 * @see ui/components/table-format-toolbar/table-border-menu-items.ts — η γνώση της γραμμής
 */

import { forwardRef, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DxfMenuContent,
  DxfMenuHiddenTrigger,
  DxfMenuItem,
  DxfMenuLabel,
  DxfMenuSeparator,
} from './dxf-context-menu/DxfContextMenu';
import { useAnchoredContextMenu } from './dxf-context-menu/use-anchored-context-menu';
import { useKeepOpenOnSurface } from './dxf-context-menu/use-keep-open-on-surface';
import { TABLE_CELL_SESSION_MARKER } from '../table-cell-editor/table-cell-session-focus';
import {
  TableRangeMenuItems,
  type TableRangeMenuActions,
} from './table-range-menu/TableRangeMenuItems';
import type { TableRangeMenuEnabled } from './table-range-menu/table-range-menu-commands';
import {
  TableFormatToolbar,
  type TableBorderMenuHostProps,
  type TableFormatSnapshot,
  type TableToggleFormatKey,
} from './table-format-toolbar/TableFormatToolbar';
// 🔴 ADR-739 §55 — τα τρία νέα τμήματα (τυπογραφία / αριθμός / στοίχιση) χτίζονται **μία**
// φορά για τις δύο υποδοχές: δες την κεφαλίδα του module για το γιατί όχι δύο φορές το JSX.
import {
  tableToolbarExtrasProps,
  type TableToolbarExtrasState,
} from './table-format-toolbar/table-toolbar-extras';
import type { TableAxisStyleOverride } from '../../types/table';
import type { TextHeightStepDirection } from '../../bim/table/table-text-height-scale';
import type { TableBorderCommandId } from '../../bim/table/table-range-border-ops';
import type { TableDiagonalCommandId } from '../../bim/table/table-cell-diagonal-ops';
import type {
  TableMergeCommandId,
  TableMergeState,
} from '../../bim/table/table-range-merge-ops';
import type { TableCellRangeBounds } from '../../bim/table/table-cell-range';

/**
 * 🔑 Ο τύπος του **στόχου** ταξιδεύει μαζί με το μενού: ο καλών (`use-table-range-menu.ts`)
 * γεμίζει το {@link TableRangeMenuTarget.commands} και οφείλει να μπορεί να ονομάσει τον τύπο
 * χωρίς να ξέρει ότι υπάρχει φάκελος `table-range-menu/`.
 */
export type { TableRangeMenuEnabled, TableRangeMenuActions };

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
 * κελιών ρωτούν πριν μετακινήσουν περιεχόμενο, και ο {@link runOnRange} οφείλει να ξαναρωτήσει
 * την κατάσταση **αφού** απαντηθεί η ερώτηση, ποτέ ενόσω ο διάλογος είναι ανοιχτός.
 */
export interface TableRangeCommandActions {
  readonly onCut: (bounds: TableCellRangeBounds) => void | Promise<void>;
  readonly onCopy: (bounds: TableCellRangeBounds) => void | Promise<void>;
  readonly onPaste: (bounds: TableCellRangeBounds) => void | Promise<void>;
  readonly onInsert: (bounds: TableCellRangeBounds) => void | Promise<void>;
  readonly onDelete: (bounds: TableCellRangeBounds) => void | Promise<void>;
  readonly onClearContents: (bounds: TableCellRangeBounds) => void | Promise<void>;
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
   * Δες την κεφαλίδα του `TableFormatSection`.
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
   * 🔴 **Ποιες εντολές δεδομένων έχουν νόημα ΤΩΡΑ** — π.χ. δεν υπάρχει τίποτα να επικολληθεί.
   *
   * Ζει στον **στόχο** και όχι σε prop, επειδή είναι ακριβώς το είδος της απάντησης που ο
   * στόχος υπάρχει για να παγώνει: εξαρτάται από τα ίδια τα όρια *και* από τη στιγμή, και
   * ξαναρωτιέται μετά από κάθε πράξη μέσω του {@link TableRangeMenuProps.resolveTarget}. Μια
   * σταθερή τιμή σε prop θα ήταν μπαγιάτικη ακριβώς εκεί που μετράει: μετά από «Αποκοπή», η
   * «Επικόλληση» γίνεται πατήσιμη — και το μενού επιβιώνει για την **επόμενη** εντολή.
   *
   * Ό,τι λείπει από τον χάρτη μένει γκρίζο· δες τον έναν κανόνα στο {@link TableRangeMenuItems}.
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
  /** ADR-739 §52 — οι πέντε εντολές μορφοποίησης κελιών (Β/Ι/Υ, χρώματα, μέγεθος, επαναφορά). */
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

const TableRangeContextMenuInner = forwardRef<TableRangeContextMenuHandle, TableRangeMenuProps>(
  ({
    onApplyBorder, onResetBorders, onApplyDiagonal, onApplyMerge, formatActions,
    rangeActions, resolveTarget, onClosed,
  }, ref) => {
    const { t } = useTranslation('dxf-viewer');
    const toolbarRef = useRef<HTMLDivElement>(null);

    // 🔴 ADR-751 Φ8.β — ο κύκλος ζωής (τέσσερις καταστάσεις, τοποθέτηση κρυφού trigger,
    // `open`/`close`, ΕΝΑΣ δρόμος εξόδου) **εξήχθη**: το τρίτο μενού δεξιού κλικ πίνακα τον
    // αντέγραψε αυτούσιο και το CHECK 3.28 τον μέτρησε — 32 γραμμές / 138 tokens. Το
    // `onClosed` μένει **εδώ** ως όρισμα γιατί είναι η μία πραγματική διαφορά: αυτό το μενού
    // ζει μέσα σε συνεδρία κελιού και οφείλει να την ξαναζωντανέψει.
    const { triggerRef, isOpen, target, onOpenChange, anchor, setTarget, closeMenuKeepTarget } =
      useAnchoredContextMenu<TableRangeMenuTarget>(ref, onClosed);

    // 🔴 Το toolbar ζει σε **δικό του** portal, άρα κάθε πάτημα κουμπιού φτάνει εδώ ως
    // `pointerDownOutside` — και το `DismissableLayer` κλείνει στο `pointerdown`, δηλαδή ΠΡΙΝ
    // το `click`. Χωρίς τον φύλακα, το `onClick` της εντολής δεν θα έτρεχε ποτέ.
    const keepOpenOnToolbar = useKeepOpenOnSurface(toolbarRef);

    /**
     * Μια εντολή της γραμμής: **κλείνει το μενού, εκτελεί, ξαναρωτά**.
     *
     * Το κλείσιμο προηγείται γιατί η συγχώνευση μπορεί να ανοίξει modal διάλογο — με το μενού
     * ακόμη ανοιχτό, το `FocusScope` του Radix θα επανέφερε κάθε εστίαση στο `role="menu"` και
     * ο χρήστης θα έβλεπε ερώτηση που δεν μπορεί να απαντήσει με πληκτρολόγιο.
     *
     * Η ανανέωση γίνεται με updater και έλεγχο `prev`: η γραμμή μπορεί να έχει φύγει (`Escape`)
     * όσο έτρεχε η ασύγχρονη πράξη.
     */
    const runOnRange = useCallback(
      (action: (bounds: TableCellRangeBounds) => void | Promise<void>) => {
        if (!target) return;
        const { bounds } = target;
        closeMenuKeepTarget();
        void Promise.resolve(action(bounds)).then(() => {
          setTarget((prev) => (prev ? resolveTarget(prev.bounds) ?? prev : prev));
        });
      },
      [target, closeMenuKeepTarget, setTarget, resolveTarget],
    );

    /**
     * 🔴 §55 — ο γραφέας των τεσσάρων νέων πεδίων, τυλιγμένος στον **ίδιο** δρόμο εκτέλεσης με
     * κάθε άλλη εντολή της γραμμής.
     *
     * Γενικός και όχι τέσσερις χειριστές: δες {@link TableRangeFormatActions.onSetField}. Ζει
     * εδώ (και όχι inline στο JSX) ώστε ο μεταγλωττιστής να δει τη γενική παράμετρο ρητά —
     * μέσα σε λίστα χαρακτηριστικών JSX η ίδια υπογραφή διαβάζεται με το ζόρι.
     */
    const setToolbarField = useCallback(
      <K extends keyof TableAxisStyleOverride>(
        key: K,
        value: TableAxisStyleOverride[K] | undefined,
      ): void => {
        runOnRange((bounds) => formatActions.onSetField(bounds, key, value));
      },
      [runOnRange, formatActions],
    );

    /**
     * 🔑 Οι έξι εντολές, τυλιγμένες στον **έναν** δρόμο εκτέλεσης.
     *
     * Τα items τις βλέπουν χωρίς όρια (`() => void`) **επίτηδες**: η υποδοχή δεν επιτρέπεται να
     * ξέρει σε ποια κελιά γράφει, γιατί τότε θα μπορούσε να κρατήσει μπαγιάτικα όρια. Τα όρια
     * τα δίνει ο {@link runOnRange} τη στιγμή του πατήματος, από τον **τρέχοντα** στόχο.
     */
    const menuActions = useMemo<TableRangeMenuActions>(
      () => ({
        onCut: () => runOnRange(rangeActions.onCut),
        onCopy: () => runOnRange(rangeActions.onCopy),
        onPaste: () => runOnRange(rangeActions.onPaste),
        onInsert: () => runOnRange(rangeActions.onInsert),
        onDelete: () => runOnRange(rangeActions.onDelete),
        onClearContents: () => runOnRange(rangeActions.onClearContents),
      }),
      [runOnRange, rangeActions],
    );

    return (
      <>
        {/*
          ⚠️ Κρέμεται από το `target`, ΟΧΙ από το `isOpen` — ίδια απόφαση με το μενού των ζωνών:
          η γραμμή επιβιώνει του μενού για την **επόμενη** εντολή και φεύγει μόνο με `Escape` /
          κλικ έξω / νέο δεξί κλικ.
        */}
        {target && anchor ? (
          <TableFormatToolbar
            anchorX={anchor.x}
            anchorY={anchor.y}
            scope="range"
            label={target.label}
            surfaceRef={toolbarRef}
            /*
              🔴 ADR-739 §52 — **τα ίδια εννιά χειριστήρια με τη ζώνη δείκτη**, με άλλον στόχο
              μέσα τους. Κάθε εντολή περνά από το {@link runOnRange}: εφαρμογή → ξαναρώτημα →
              κλείσιμο **μόνο** του μενού· η γραμμή μένει, γιατί η μορφοποίηση είναι κατεξοχήν
              επαναλαμβανόμενη πράξη (έντονα, μετά πλάγια, μετά ένα μέγεθος πάνω).
            */
            format={{
              format: target.format,
              onToggle: (key) => runOnRange((bounds) => formatActions.onToggle(bounds, key)),
              onStepSize: (dir) => runOnRange((bounds) => formatActions.onStepSize(bounds, dir)),
              onReset: () => runOnRange((bounds) => formatActions.onReset(bounds)),
              onSetTextColor: (v) => runOnRange((bounds) => formatActions.onSetTextColor(bounds, v)),
              onSetFillColor: (v) => runOnRange((bounds) => formatActions.onSetFillColor(bounds, v)),
            }}
            /*
              🔴 §55 — τα τρία τμήματα, χτισμένα από τον **κοινό** builder: η κατάσταση έρχεται
              παγωμένη από τον στόχο, ο γραφέας τυλίγεται στο {@link runOnRange} όπως κάθε άλλη
              εντολή της γραμμής (εφαρμογή → ξαναρώτημα → κλείσιμο μόνο του μενού).
            */
            {...tableToolbarExtrasProps(target.toolbar, setToolbarField)}
            merge={{
              state: target.merge,
              onApply: (id) => runOnRange((bounds) => onApplyMerge(bounds, id)),
            }}
            borders={{
              ...target.borders,
              onApply: (id) => runOnRange((bounds) => onApplyBorder(bounds, id)),
              onReset: () => runOnRange((bounds) => onResetBorders(bounds)),
              onApplyDiagonal: (id) => runOnRange((bounds) => onApplyDiagonal(bounds, id)),
            }}
          />
        ) : null}

        <DropdownMenu open={isOpen} onOpenChange={onOpenChange}>
          <DropdownMenuTrigger asChild>
            <DxfMenuHiddenTrigger ref={triggerRef} {...TABLE_CELL_SESSION_MARKER} />
          </DropdownMenuTrigger>

          {target ? (
            <DxfMenuContent
              {...TABLE_CELL_SESSION_MARKER}
              onPointerDownOutside={keepOpenOnToolbar}
              onFocusOutside={keepOpenOnToolbar}
            >
              {/*
                🔑 Ο τίτλος **μένει**, παρότι το Excel δεν τον έχει (Α22): εκεί το δεξί κλικ
                *μετακινεί* την επιλογή, οπότε το «ποια περιοχή» φαίνεται στην ίδια την οθόνη.
                Εδώ η επιλογή δεν αγγίζεται ποτέ, άρα ο τίτλος είναι η **μόνη** απάντηση στο
                «τι θα επηρεαστεί» — και ένα μενού που δεν την έχει είναι μαντεψιά.
              */}
              <DxfMenuItem disabled>
                <DxfMenuLabel>{t('table.borders.rangeMenuTitle', { label: target.label })}</DxfMenuLabel>
              </DxfMenuItem>
              <DxfMenuSeparator />

              <TableRangeMenuItems actions={menuActions} enabled={target.commands} />
            </DxfMenuContent>
          ) : null}
        </DropdownMenu>
      </>
    );
  },
);

TableRangeContextMenuInner.displayName = 'TableRangeContextMenu';

export const TableRangeContextMenu = TableRangeContextMenuInner;
