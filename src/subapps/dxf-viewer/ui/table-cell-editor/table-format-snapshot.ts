/**
 * ADR-739 Φ.Ε / **§52** — **τι δείχνει ένα χειριστήριο μορφοποίησης** για τον τρέχοντα στόχο:
 * η κατάσταση κάθε κουμπιού, απαντημένη μία φορά ανά άνοιγμα ή πάτημα. Καθαρές συναρτήσεις,
 * μηδέν React, μηδέν DOM.
 *
 * ## 🔴 §52 — ΤΡΕΙΣ ΕΠΙΦΑΝΕΙΕΣ, ΕΝΑ ΣΤΙΓΜΙΟΤΥΠΟ
 * Λεγόταν `table-header-format-snapshot.ts` και δεχόταν `{ axis, ids }`, γιατί ο **μόνος**
 * καλών ήταν το mini toolbar των ζωνών δείκτη. Τώρα οι καλούντες είναι **τρεις** — ζώνες
 * δείκτη, επιλογή κελιών, κορδέλα — και μόνο ο πρώτος μιλά για άξονες.
 *
 * Η γενίκευση **δεν** έγινε με τρίτο πεδίο ή με `axis?: …`: ο στόχος περνά ως
 * {@link TableFormatScope}, δηλαδή η διακριτή ένωση που ήδη ξέρει η καθαρή στοίβα
 * (`table-format-scope.ts`). Έτσι η ερώτηση «άξονας ή κελιά;» απαντιέται **μία** φορά, εκεί
 * όπου γεννιέται η επιλογή του χρήστη, και ποτέ ξανά σε επιφάνεια.
 *
 * ## 🔴 §27.17 — ΠΟΛΛΟΙ στόχοι, Η ΙΔΙΑ ερώτηση
 * Το `mixed` σημαίνει «δεν συμφωνούν **όλα** τα κελιά του στόχου» — ακριβώς ό,τι ήξερε ήδη να
 * δείχνει το toolbar (Figma «Mixed», Revit «varies»), είτε ο στόχος είναι τρεις στήλες είτε
 * ένα ορθογώνιο `B2:D9`.
 *
 * ## 🔴 ΜΙΑ συνάρτηση για δύο χρώματα
 * Το χρώμα κειμένου και το χρώμα γεμίσματος ρωτούν **την ίδια** τριπλή ερώτηση («τι ισχύει /
 * συμφωνούν; / ποιος το είπε;») για **άλλο πεδίο**. Δύο συναρτήσεις `textColorStateOf` /
 * `fillColorStateOf` θα ήταν ακριβώς το structural clone που πιάνει το CHECK 3.28 (N.18) — και,
 * χειρότερα, δύο σημεία που μπορούν κάποτε να μάθουν διαφορετικό κανόνα για το «σε τι
 * επιστρέφω;». Το πεδίο και ο ρόλος περνούν ως ορίσματα.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-format-snapshot
 * @see bim/table/table-format-scope.ts — ο ΕΝΑΣ δρόμος προς τον σωστό γραφέα
 * @see ui/components/table-format-toolbar/table-color-menu-selection.ts — πώς διαβάζεται η κατάσταση
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §34, §35, §52
 */

import {
  canResetTableFormatScope,
  resolveTableFormatState,
  setTableFormatField,
  tableFormatScopeBounds,
  type TableFormatScope,
} from '../../bim/table/table-format-scope';
import { resolveTableFormatOverflow } from '../../bim/table/table-format-overflow-scope';
import { collectDrawingColors } from '../../bim/table/table-drawing-colors';
// 🔴 ADR-739 §55 — η μορφή αριθμού **δεν** είναι πεδίο του `TableCellStyle`: κληρονομείται με
// δική της αλυσίδα (κελί→γραμμή→στήλη→`valueType`), οπότε διαβάζεται με τον ΕΝΑ βρόχο πάνω στα
// επιλυμένα κελιά — που κουβαλά ήδη `overrides` + `column` ακριβώς γι' αυτό.
import { forEachResolvedCellStyle } from '../../bim/table/table-cell-style-scan';
import {
  explicitCellNumberFormat,
  resolveCellNumberFormat,
} from '../../bim/table/table-cell-format';
import { isTableCellFormatEqual } from '../../bim/table/table-number-format-ops';
import { tableRangeCellRefs, type TableCellRef } from '../../bim/table/table-cell-range';
import type { PlotColorRole } from '../../config/print-color-policy';
import type { TableCellStyleKey } from '../../bim/table/table-cell-style-scan';
import type { TableCellStyle, TableStyle } from '../../bim/table/table-style';
import type {
  PersistedTableModel,
  TableCellAlign,
  TableCellOverflow,
} from '../../types/table';
import type { TableCellFormat } from '../../types/table-cell-format';
import type { TableAxisColorState } from '../components/table-format-toolbar/table-color-menu-selection';
import type { TableToolbarExtrasState } from '../components/table-format-toolbar/table-toolbar-extras';
import type {
  TableFontControlsState,
  TableFontValueState,
  TableFormatSnapshot,
  TableNumberFormatState,
  TableToggleFormatKey,
  TableToggleFormatState,
} from '../components/table-format-toolbar/TableFormatToolbar';

/** Ό,τι χρειάζεται μια πράξη μορφοποίησης, διαβασμένο **τη στιγμή** του συμβάντος. */
export interface FormatTarget {
  /**
   * 🔴 ADR-739 §63 — **ΠΟΙΟΣ ΠΙΝΑΚΑΣ.** Η ταυτότητα της οντότητας, όχι μόνο το μοντέλο της.
   *
   * ## Γιατί προστέθηκε — ο στόχος ήταν ΜΙΣΟΣ
   * Ο κανόνας Α22 λέει ότι «ο στόχος **ταξιδεύει με το αίτημα**», και ίσχυε μόνο για το *ποια
   * κελιά* ({@link FormatTarget.scope}). Το *ποιος πίνακας* δεν ταξίδευε πουθενά: κάθε γραφέας
   * το **ξαναμάντευε** από τον ζωντανό δρομέα τη στιγμή της γραφής. Για τις πράξεις που
   * γεννιούνται και εκτελούνται στο **ίδιο** συμβάν (κουμπί κορδέλας, item μενού) οι δύο
   * απαντήσεις συμπίπτουν πάντα, οπότε το κενό ήταν αόρατο.
   *
   * Ο **αιωρούμενος διάλογος** (ADR-750 Φ6β) το εκδήλωσε: ζει **πέρα** από τη συνεδρία που τον
   * γέννησε, άρα ανάμεσα στη γέννηση του στόχου και το «ΟΚ» χωρά οτιδήποτε — `Escape`, δρομέας
   * σε **άλλον** πίνακα, `Ctrl+Z`. Δες `bim/table/table-format-commit-plan.ts` για τις τρεις
   * μετρημένες σιωπηλές καταστάσεις.
   *
   * ⚠️ Ουδέτερο για τους τρεις υπάρχοντες κατασκευαστές: και οι τρεις κρατούν ήδη τη ζωντανή
   * οντότητα (`live`) όταν γεμίζουν το `model`, οπότε είναι **μία γραμμή** ο καθένας — και
   * ακριβώς αυτό αποδεικνύει ότι η πληροφορία υπήρχε και **πετιόταν**.
   */
  readonly entityId: string;
  readonly model: PersistedTableModel;
  readonly style: TableStyle;
  /**
   * 🔴 §52 — **πού γράφεται**: άξονες (με **όλες** τις επιλεγμένες ταυτότητες, §27.17) ή
   * ορθογώνιο κελιών. Ήταν `{ axis, ids }`· η ένωση αντικατέστησε το ζεύγος τη στιγμή που η
   * μορφοποίηση απέκτησε δεύτερο στόχο.
   *
   * Στην πράξη ποτέ εκφυλισμένος (τον γεννά το `tableFormatScopeOf`), αλλά οι αναγνώσεις το
   * αντέχουν: στόχος που δεν επιβίωσε ⇒ `null` ⇒ σβηστά χειριστήρια, ποτέ μαντεψιά.
   */
  readonly scope: TableFormatScope;
  /** Τα χρώματα των layers της σκηνής — η τρίτη πηγή των «χρωμάτων του σχεδίου». */
  readonly layerColors: readonly string[];
}

/** Στόχος που δεν βρέθηκε: όλα σβηστά και τίποτα να επαναφερθεί — ποτέ μαντεψιά. */
const EMPTY_TOGGLE: TableToggleFormatState = { active: false, mixed: false, explicit: false };

/**
 * Το ίδιο, για τα χρώματα.
 *
 * ⚠️ Το `inheritedColor` είναι **`undefined`** και όχι `'#000000'`: ένας στόχος που δεν υπάρχει
 * δεν κληρονομεί μαύρο — δεν κληρονομεί **τίποτα**. Το παλιό `'#000000'` ήταν αβλαβές μόνο
 * επειδή η γραμμή δεν εμφανίζεται καν χωρίς στόχο· τώρα που το `undefined` έχει **σημασία**
 * («κανένα γέμισμα»), μια εφευρημένη τιμή θα ήταν ψέμα με συνέπειες.
 */
const EMPTY_COLOR: TableAxisColorState = {
  current: undefined,
  mixed: false,
  explicit: false,
  inheritedColor: undefined,
  inheritedMixed: false,
  drawingColors: [],
};

/**
 * Ό,τι δείχνει η μορφοποίηση **χωρίς στόχο** — μία δήλωση, δύο καλούντες.
 *
 * Ο δεύτερος είναι η κορδέλα (§52): εκεί η καρτέλα μπορεί να είναι ορατή ενώ ο δρομέας μόλις
 * έκλεισε, και τα χειριστήρια οφείλουν να δείξουν «τίποτα» αντί να πετάξουν.
 */
export const EMPTY_TABLE_FORMAT_SNAPSHOT: TableFormatSnapshot = {
  bold: EMPTY_TOGGLE,
  italic: EMPTY_TOGGLE,
  underline: EMPTY_TOGGLE,
  textColor: EMPTY_COLOR,
  fillColor: EMPTY_COLOR,
  canReset: false,
};

/**
 * ADR-739 §55 — τυπογραφία **χωρίς στόχο**: κανένα όνομα, κανένα μέγεθος.
 *
 * ⚠️ `mixed: false` και όχι `true`: «ανάμεικτο» είναι **απάντηση** («τα κελιά διαφωνούν») και
 * θα ζωγράφιζε την υπόδειξη «διαφέρει ανά κελί» πάνω σε στόχο που δεν υπάρχει καν. Ο στόχος
 * που δεν βρέθηκε δεν διαφωνεί με τίποτα — δεν έχει τι να πει, ίδια σύμβαση με το
 * {@link EMPTY_TOGGLE}.
 */
export const EMPTY_TABLE_FONT_STATE: TableFontControlsState = {
  family: { current: undefined, mixed: false },
  size: { current: undefined, mixed: false },
};

/**
 * ADR-739 §55 / ADR-760 — μορφή αριθμού **χωρίς στόχο**: κανένα από τα πέντε κουμπιά πατημένο.
 *
 * ⚠️ Το `current: null` είναι η **μόνη** εκφράσιμη «καμία απάντηση» του τύπου, και συμπίπτει με
 * το «ανάμεικτο». Η σύμπτωση είναι ακίνδυνη επειδή η γραμμή **δεν αποδίδεται καθόλου** χωρίς
 * στόχο (κάθε διαμέρισμα είναι προαιρετικό prop — δες `TableFormatToolbar`): η υπόδειξη
 * «διαφέρει ανά κελί» δεν έχει πού να φανεί. Η εναλλακτική — να μαντέψουμε `general` — θα ήταν
 * ρητή δήλωση «κανένας δεν έχει μορφή», δηλαδή ψέμα με συνέπειες.
 */
export const EMPTY_TABLE_NUMBER_FORMAT_STATE: TableNumberFormatState = {
  current: null,
  explicit: false,
};

/**
 * Η κατάσταση όλων των χειριστηρίων + αν υπάρχει τι να επαναφερθεί.
 *
 * Υπολογίζεται **μία φορά ανά άνοιγμα ή πάτημα**, όχι σε κάθε απόδοση: κάθε κλήση διατρέχει
 * όλα τα κελιά του στόχου μία φορά ανά πεδίο, και ένα μενού δεν είναι θέση για βρόχο που
 * τρέχει με τον ρυθμό της απόδοσης.
 */
export function resolveTableFormatSnapshot(target: FormatTarget | null): TableFormatSnapshot {
  if (!target) return EMPTY_TABLE_FORMAT_SNAPSHOT;
  return {
    bold: toggleStateOf(target, 'bold'),
    italic: toggleStateOf(target, 'italic'),
    underline: toggleStateOf(target, 'underline'),
    textColor: formatColorStateOf(target, 'textColorHex', 'ink'),
    fillColor: formatColorStateOf(target, 'fillColorHex', 'fill'),
    canReset: canResetTableFormatScope(target.model, target.scope),
  };
}

/**
 * 🔴 ADR-739 §55 — **γραμματοσειρά + μέγεθος**, οι δύο πρώτες θέσεις της σειράς 1.
 *
 * Και τα δύο βγαίνουν από το **υπάρχον** `resolveTableFormatState`: είναι κανονικά πεδία του
 * επιλυμένου στυλ (`fontFamily`, `textHeightMm`), δηλαδή η ίδια ερώτηση με τα Β/Ι/Υ σε άλλο
 * λεξιλόγιο απάντησης. Καμία νέα σάρωση, κανένας νέος κανόνας κληρονομικότητας.
 */
export function resolveTableFontState(target: FormatTarget | null): TableFontControlsState {
  if (!target) return EMPTY_TABLE_FONT_STATE;
  return {
    family: valueStateOf(target, 'fontFamily'),
    size: valueStateOf(target, 'textHeightMm'),
  };
}

/**
 * 🔴 ADR-739 §55 — **η στοίχιση**· `null` ⇒ ανάμεικτος στόχος (ή στόχος που δεν βρέθηκε).
 *
 * Η σύμπτωση των δύο «τίποτα» είναι σκόπιμη και ακίνδυνη: το `TableAlignMenu` δέχεται ακριβώς
 * αυτόν τον τύπο και συμπεριφέρεται **ίδια** και στις δύο περιπτώσεις — καμία επιλογή
 * τσεκαρισμένη, βάση σύνθεσης η προεπιλογή της κλάσης δεδομένων. Ένα τρίτο σκέλος στον τύπο θα
 * ήταν διάκριση που καμία επιφάνεια δεν μπορεί να δείξει.
 */
export function resolveTableAlignState(target: FormatTarget | null): TableCellAlign | null {
  if (!target) return null;
  const state = valueStateOf(target, 'align');
  return state.mixed ? null : state.current ?? null;
}

/**
 * 🔴 ADR-739 §58 Γ2 — **τι ξεχείλισμα ισχύει**· `null` ⇒ ανάμεικτο ή στόχος που δεν βρέθηκε.
 *
 * Προσαρμογέας μιας γραμμής και **όχι** δεύτερη ανάγνωση: η γνώση ζει ολόκληρη στο
 * {@link resolveTableFormatOverflow} (καθαρό, `bim/`), γιατί η απάντηση είναι τιμή του
 * **μοντέλου** και όχι σχήμα της επιφάνειας — σε αντίθεση με τη μορφή αριθμού από κάτω, που
 * παράγει `TableNumberFormatState` και γι' αυτό ζει εδώ.
 *
 * Υπάρχει ώστε οι **δύο** υποδοχές του mini toolbar να μιλούν την ίδια γλώσσα με τα άλλα τρία
 * τμήματα (`FormatTarget | null` μέσα, κατάσταση έξω) και να μην ξέρουν ότι υπάρχει `scope`.
 * Ίδια ακριβώς μορφή με το {@link resolveTableAlignState}.
 */
export function resolveTableOverflowState(
  target: FormatTarget | null,
): TableCellOverflow | null {
  return target === null
    ? null
    : resolveTableFormatOverflow(target.model, target.style, target.scope);
}

/**
 * 🔴 ADR-739 §55 / ADR-760 — **τι μορφή αριθμού ισχύει** σε αυτά τα κελιά.
 *
 * ## Γιατί ΔΕΝ περνά από το `resolveTableFormatState`
 * Το `numberFormat` **δεν είναι πεδίο** του `TableCellStyle` (δες `TableCellStyleKey`: η τομή
 * το αποκλείει ρητά). Κληρονομείται με **δική του** αλυσίδα — κελί → γραμμή → στήλη → η
 * σημασιολογική βάση του `TableColumn.valueType` — και μόνο το τέταρτο επίπεδο εξηγεί γιατί το
 * κουμπί «%» οφείλει να δείχνει πατημένο σε στήλη που **δεν** έχει καμία παράκαμψη.
 *
 * 🔑 Ο βρόχος είναι ο **ΕΝΑΣ** ({@link forEachResolvedCellStyle}), όχι δεύτερος: το
 * `TableResolvedCell` κουβαλά ήδη `overrides` + `column` **ακριβώς** για αυτόν εδώ τον
 * καταναλωτή (δες την κεφαλίδα του `table-cell-style-scan.ts` — το πρόβλεψε πριν γραφτεί).
 *
 * ⚠️ Ο στόχος-**άξονας** μεταφράζεται σε ορθογώνιο από το `tableFormatScopeBounds` (ο ΕΝΑΣ
 * ορισμός της «ολόκληρης στήλης», §27.16 Ε2): η μορφή αριθμού είναι ερώτηση **κελιών**, και
 * μια μαρκαρισμένη στήλη είναι τα κελιά της.
 */
export function resolveTableNumberFormatState(
  target: FormatTarget | null,
): TableNumberFormatState {
  const refs = target === null ? null : numberFormatCellRefs(target);
  if (target === null || refs === null) return EMPTY_TABLE_NUMBER_FORMAT_STATE;

  let value: TableCellFormat | undefined;
  let mixed = false;
  let explicit = true;

  const visited = forEachResolvedCellStyle(target.model, target.style, refs, (cell) => {
    const format = resolveCellNumberFormat(cell.overrides, cell.column.valueType);
    // «Ρητό» σημαίνει **όλα** τα κελιά το δηλώνουν — ίδια σύμβαση με το `overridden` της
    // περιοχής στο `resolveRangeFormat`: ένα κελί που κληρονομεί αρκεί για να σβήσει η κουκκίδα.
    if (explicitCellNumberFormat(cell.overrides) === undefined) explicit = false;
    if (value === undefined) value = format;
    else if (!isTableCellFormatEqual(value, format)) mixed = true;
  });
  if (!visited || value === undefined) return EMPTY_TABLE_NUMBER_FORMAT_STATE;

  return { current: mixed ? null : value, explicit: !mixed && explicit };
}

/**
 * 🔴 ADR-739 §58 Γ2 — **τα τέσσερα τμήματα της γραμμής, από ΕΝΑΝ στόχο: ο ΕΝΑΣ κατασκευαστής.**
 *
 * ## Γιατί υπάρχει (CHECK 3.28 το έπιασε στο ίδιο commit)
 * Οι δύο υποδοχές του mini toolbar — το μενού των **ζωνών δείκτη** (`use-table-header-menu`)
 * και το μενού της **περιοχής** (`use-table-range-menu`) — έγραφαν το ίδιο σώμα η καθεμιά.
 * Με **τρία** τμήματα (§55) το δίδυμο ήταν κάτω από το κατώφλι του jscpd· το **τέταρτο** (§58
 * Γ2) το πέρασε, και σωστά: δύο σώματα που απαντούν «τι δείχνει η γραμμή» μπορούν κάποτε να
 * μάθουν **διαφορετικό** σύνολο τμημάτων, και η διαφωνία τους θα ήταν αόρατη όσο κάθε πλευρά
 * δουλεύει (δεν υπάρχει υποδοχή που να τις δείχνει και τις δύο ταυτόχρονα).
 *
 * 🔑 Ο στόχος περνά **μία** φορά, όπως και πριν: οι τέσσερις αναγνώσεις διατρέχουν η καθεμιά τα
 * κελιά της, και μια δεύτερη κατασκευή στόχου ανάμεσά τους θα άφηνε ανοιχτό το παράθυρο να
 * απαντήσουν πάνω σε **διαφορετικά** μοντέλα (ένα `Ctrl+Z` από συντόμευση ενδιάμεσα) — δηλαδή
 * γραμματοσειρά ενός πίνακα με στοίχιση ενός άλλου. Γι' αυτό η υπογραφή δέχεται τον **έτοιμο**
 * στόχο και όχι τον τρόπο να τον φτιάξει: το «μία φορά» παραμένει ευθύνη του καλούντος, που
 * είναι ο μόνος που ξέρει τι σημαίνει «ο στόχος» στη δική του υποδοχή (ζώνη ή όρια).
 *
 * ⚠️ Το `fontNames` έρχεται ως **τιμή** και όχι ως getter για τον ίδιο λόγο: διαβάζεται τη
 * στιγμή του δεξιού κλικ (ADR-040 κανόνας #2) από τον καλούντα, όχι εδώ.
 */
export function resolveTableToolbarExtrasState(
  target: FormatTarget | null,
  fontNames: readonly string[],
): TableToolbarExtrasState {
  return {
    fonts: resolveTableFontState(target),
    fontNames,
    numberFormat: resolveTableNumberFormatState(target),
    align: resolveTableAlignState(target),
    overflow: resolveTableOverflowState(target),
  };
}

/** Τα κελιά του στόχου· `null` όταν ο στόχος δεν επιβίωσε (undo έσβησε τον άξονα). */
function numberFormatCellRefs(target: FormatTarget): readonly TableCellRef[] | null {
  const bounds = tableFormatScopeBounds(target.model, target.scope);
  return bounds === null ? null : tableRangeCellRefs(target.model, bounds);
}

/**
 * 🔴 **ΜΙΑ συνάρτηση για τρία πεδία** — ίδιος κανόνας με το {@link formatColorStateOf}.
 *
 * Η γραμματοσειρά, το μέγεθος και η στοίχιση ρωτούν **την ίδια** διπλή ερώτηση («ποια τιμή /
 * συμφωνούν;») για άλλο πεδίο. Τρία σώματα `fontFamilyStateOf` / `sizeStateOf` /
 * `alignStateOf` θα ήταν ακριβώς το structural clone που πιάνει το CHECK 3.28 (N.18) — και,
 * χειρότερα, τρία σημεία που μπορούν κάποτε να μάθουν διαφορετικό κανόνα για το τι επιστρέφει
 * ένας μεικτός στόχος.
 *
 * `current: undefined` σε μεικτό στόχο: το combobox δείχνει **κενό**, όπως το Excel — ποτέ την
 * τιμή του πρώτου κελιού, που θα ήταν σιωπηλή δήλωση ότι ισχύει παντού.
 */
function valueStateOf<K extends TableCellStyleKey>(
  target: FormatTarget,
  key: K,
): TableFontValueState<TableCellStyle[K]> {
  const state = resolveTableFormatState(target.model, target.style, target.scope, key);
  if (!state) return { current: undefined, mixed: false };
  return { current: state.mixed ? undefined : state.value, mixed: state.mixed };
}

/**
 * Η κατάσταση ενός πεδίου **χρώματος** — τέσσερις ερωτήσεις, όχι μία.
 *
 * ## 🔴 Γιατί το «κληρονομείται» υπολογίζεται με προσωρινή αφαίρεση
 * Το δείγμα δίπλα στο «Αυτόματο» πρέπει να δείξει *σε τι επιστρέφεις*, όχι *τι ισχύει τώρα*.
 * Η μόνη ειλικρινής απάντηση είναι «τρέξε την ίδια επίλυση **χωρίς** την παράκαμψη του
 * στόχου» — γι' αυτό φτιάχνεται ένα εφήμερο μοντέλο με το πεδίο αφαιρεμένο. Είναι φθηνό (και
 * οι δύο γραφείς επιστρέφουν το **ίδιο** αντικείμενο by-reference όταν δεν υπάρχει τι να
 * αφαιρεθεί) και τρέχει **μία φορά ανά άνοιγμα ή πάτημα**, ποτέ ανά απόδοση.
 *
 * ⚠️ Στον στόχο **κελιών** το εφήμερο μοντέλο δεν γεννά ποτέ εγγραφές-φαντάσματα: το
 * `setRangeStyleField` με `undefined` δημιουργεί κελί **μόνο** για ρητή τιμή. Χωρίς αυτή την
 * εγγύηση, μια απλή ανάγνωση κληρονομιάς σε `Ctrl+A` θα υλοποιούσε 4.000 κελιά στη μνήμη.
 *
 * Το εναλλακτικό — «δείξε σκέτο μαύρο», όπως κάνει το Excel — είναι ψέμα σε κάθε στυλ που δεν
 * γράφει μαύρο· και το δικό μας προεπιλεγμένο στυλ γράφει `#111111`.
 *
 * ## 🔴 Το `mixed` ΔΕΝ πετιέται πια — και για το γέμισμα δεν επιτρέπεται να πεταχτεί
 * Για το κείμενο, «καμία κοινή τιμή» μπορούσε να κωδικοποιηθεί ως `current: undefined`, γιατί
 * το `textColorHex` του επιλυμένου στυλ είναι **υποχρεωτικό**: κάθε κελί έχει πάντα χρώμα.
 * Το `fillColorHex` είναι **προαιρετικό**, οπότε το ίδιο `undefined` σημαίνει ταυτόχρονα
 * «μεικτό» **και** «ρητά κανένα» **και** «κληρονομεί κενό». Δες
 * `table-color-menu-selection.ts` για το τι σπάει αν συγχυστούν.
 *
 * ## 🔴 ΓΙΑΤΙ Η ΚΛΗΡΟΝΟΜΙΑ ΔΗΛΩΝΕΤΑΙ ΜΕΙΚΤΗ ΑΝΤΙ ΝΑ ΠΕΣΕΙ ΣΤΗΝ ΚΛΑΣΗ `data`
 * ── ΤΟ ΕΛΑΤΤΩΜΑ ΠΟΥ ΒΡΗΚΕ Η ΟΘΟΝΗ, ΟΧΙ ΤΑ TESTS (ζωντανή επαλήθευση 2026-08-03) ──
 *
 * Εδώ έγραφε `inherited?.value ?? style.rowClasses.data[key]`. Σε **μεικτό** στόχο το
 * `inherited.value` είναι `undefined`, οπότε η κλάση `data` γινόταν η απάντηση. Για το
 * **κείμενο** ήταν αβλαβές — η `data` δηλώνει πάντα χρώμα και η υπόδειξη ήταν γενική.
 *
 * Για το **γέμισμα** η ίδια γραμμή **αντιστρέφει το νόημα**: η `data` του `standard` **δεν
 * βάφει**, άρα μια **κεφαλίδα** (`#EDEDED`) που περνά πάνω από στήλη με ρητό γέμισμα δήλωνε
 * «Κληρονομεί «κανένα γέμισμα» από το στυλ» — ψέμα, στο χειριστήριο που υπάρχει για να λέει
 * την αλήθεια για την κληρονομιά. Το Revit απαντά την ίδια ερώτηση με `<varies>`: **μη-δήλωση**,
 * όχι λάθος δήλωση.
 *
 * ⚠️ Η πτώση στην `data` **μένει** για την περίπτωση «στόχος που δεν βρέθηκε» (`inherited`
 * είναι `null`, όχι μεικτό) — εκεί δεν υπάρχει τίποτα να ρωτήσεις, και η γραμμή δεν
 * εμφανίζεται καν.
 */
function formatColorStateOf(
  target: FormatTarget,
  key: 'textColorHex' | 'fillColorHex',
  role: PlotColorRole,
): TableAxisColorState {
  const { model, style, scope, layerColors } = target;
  const state = resolveTableFormatState(model, style, scope, key);
  // 🔴 §27.17 — η παράκαμψη αφαιρείται από **όλον** τον στόχο, όχι από ένα κομμάτι του: το
  // δείγμα δίπλα στο «Αυτόματο» δείχνει **τι θα συμβεί αν πατηθεί**, και το πάτημα καθαρίζει
  // τα πάντα. Με μερική αφαίρεση, η πρόβλεψη θα ήταν λάθος για τα υπόλοιπα.
  const withoutOverride = setTableFormatField(model, scope, key, undefined);
  const inherited = resolveTableFormatState(withoutOverride, style, scope, key);

  return {
    current: state?.value,
    mixed: state?.mixed ?? false,
    explicit: state?.overridden ?? false,
    inheritedColor: inherited === null ? style.rowClasses.data[key] : inherited.value,
    inheritedMixed: inherited?.mixed ?? false,
    drawingColors: collectDrawingColors({ style, model, layerColors, role }),
  };
}

/**
 * Οι **δύο** ερωτήσεις του `TableFormatState` μεταφρασμένες στη γλώσσα του κουμπιού.
 *
 * Το `active` διαβάζεται από την **επιλυμένη** τιμή (τι βλέπει ο χρήστης), το `explicit` από
 * την **παράκαμψη** (ποιος το είπε). Διαβάζοντας και τα δύο από το ίδιο σημείο, το κουμπί θα
 * έλεγε «όχι έντονα» για στήλη που το στυλ της γράφει έντονη — ψέμα για ό,τι είναι στην οθόνη.
 */
function toggleStateOf(target: FormatTarget, key: TableToggleFormatKey): TableToggleFormatState {
  const state = resolveTableFormatState(target.model, target.style, target.scope, key);
  if (!state) return EMPTY_TOGGLE;
  return { active: state.value === true, mixed: state.mixed, explicit: state.overridden };
}
