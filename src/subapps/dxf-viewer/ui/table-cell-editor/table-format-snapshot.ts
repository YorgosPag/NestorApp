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
  type TableFormatScope,
} from '../../bim/table/table-format-scope';
import { collectDrawingColors } from '../../bim/table/table-drawing-colors';
import type { PlotColorRole } from '../../config/print-color-policy';
import type { TableStyle } from '../../bim/table/table-style';
import type { PersistedTableModel } from '../../types/table';
import type { TableAxisColorState } from '../components/table-format-toolbar/table-color-menu-selection';
import type {
  TableFormatSnapshot,
  TableToggleFormatKey,
  TableToggleFormatState,
} from '../components/table-format-toolbar/TableFormatToolbar';

/** Ό,τι χρειάζεται μια πράξη μορφοποίησης, διαβασμένο **τη στιγμή** του συμβάντος. */
export interface FormatTarget {
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
