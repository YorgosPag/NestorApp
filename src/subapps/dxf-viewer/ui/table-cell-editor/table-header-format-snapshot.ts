/**
 * ADR-739 Φ.Ε — **τι δείχνει το mini toolbar** για έναν άξονα: η κατάσταση κάθε χειριστηρίου,
 * απαντημένη μία φορά ανά άνοιγμα ή πάτημα. Καθαρές συναρτήσεις, μηδέν React, μηδέν DOM.
 *
 * ## Γιατί ξεχωριστό αρχείο
 * Ζούσαν μέσα στο `use-table-header-menu.ts` ως «Καθαροί βοηθοί». Δεν είναι hook τίποτα από
 * αυτά — δεν καλούν `use*`, δεν αγγίζουν store, δεν χρειάζονται render — και το αρχείο του hook
 * είχε φτάσει τις **481/500** γραμμές (N.7.1). **Εξαγωγή, ποτέ trim**: ο κώδικας και τα σχόλιά
 * του μετακόμισαν αυτούσια.
 *
 * ## 🔴 ΜΙΑ συνάρτηση για δύο χρώματα
 * Το χρώμα κειμένου και το χρώμα γεμίσματος ρωτούν **την ίδια** τριπλή ερώτηση («τι ισχύει /
 * συμφωνούν; / ποιος το είπε;») για **άλλο πεδίο**. Δύο συναρτήσεις `textColorStateOf` /
 * `fillColorStateOf` θα ήταν ακριβώς το structural clone που πιάνει το CHECK 3.28 (N.18) — και,
 * χειρότερα, δύο σημεία που μπορούν κάποτε να μάθουν διαφορετικό κανόνα για το «σε τι
 * επιστρέφω;». Το πεδίο και ο ρόλος περνούν ως ορίσματα.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-header-format-snapshot
 * @see bim/table/table-axis-style-ops.ts — οι καθαρές αναγνώσεις πάνω στο μοντέλο
 * @see ui/components/table-format-toolbar/table-color-menu-selection.ts — πώς διαβάζεται η κατάσταση
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §34, §35
 */

import {
  hasAxisStyleOverride,
  resolveAxisFormat,
  setAxisStyleField,
  type TableStyleAxis,
} from '../../bim/table/table-axis-style-ops';
import { collectDrawingColors } from '../../bim/table/table-drawing-colors';
import type { PlotColorRole } from '../../config/print-color-policy';
import type { TableStyle } from '../../bim/table/table-style';
import type { PersistedTableModel } from '../../types/table';
import type { TableAxisColorState } from '../components/table-format-toolbar/table-color-menu-selection';
import type {
  TableAxisFormatSnapshot,
  TableToggleFormatKey,
  TableToggleFormatState,
} from '../components/table-format-toolbar/TableFormatToolbar';

/** Ό,τι χρειάζεται μια πράξη μορφοποίησης, διαβασμένο **τη στιγμή** του συμβάντος. */
export interface FormatTarget {
  readonly model: PersistedTableModel;
  readonly style: TableStyle;
  readonly axis: TableStyleAxis;
  readonly id: string;
  /** Τα χρώματα των layers της σκηνής — η τρίτη πηγή των «χρωμάτων του σχεδίου». */
  readonly layerColors: readonly string[];
}

/** Άξονας που δεν βρέθηκε: όλα σβηστά και τίποτα να επαναφερθεί — ποτέ μαντεψιά. */
const EMPTY_TOGGLE: TableToggleFormatState = { active: false, mixed: false, explicit: false };

/**
 * Το ίδιο, για τα χρώματα.
 *
 * ⚠️ Το `inheritedColor` είναι **`undefined`** και όχι `'#000000'`: ένας άξονας που δεν υπάρχει
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
 * Η κατάσταση όλων των χειριστηρίων + αν υπάρχει τι να επαναφερθεί.
 *
 * Υπολογίζεται **μία φορά ανά άνοιγμα ή πάτημα**, όχι σε κάθε απόδοση: κάθε κλήση διατρέχει
 * όλα τα κελιά του άξονα μία φορά ανά πεδίο, και το μενού δεν είναι θέση για βρόχο που τρέχει
 * με τον ρυθμό της απόδοσης.
 */
export function resolveAxisFormatSnapshot(target: FormatTarget | null): TableAxisFormatSnapshot {
  if (!target) {
    return {
      bold: EMPTY_TOGGLE,
      italic: EMPTY_TOGGLE,
      underline: EMPTY_TOGGLE,
      textColor: EMPTY_COLOR,
      fillColor: EMPTY_COLOR,
      canReset: false,
    };
  }
  return {
    bold: toggleStateOf(target, 'bold'),
    italic: toggleStateOf(target, 'italic'),
    underline: toggleStateOf(target, 'underline'),
    textColor: axisColorStateOf(target, 'textColorHex', 'ink'),
    fillColor: axisColorStateOf(target, 'fillColorHex', 'fill'),
    canReset: hasAxisStyleOverride(target.model, target.axis, target.id),
  };
}

/**
 * Η κατάσταση ενός πεδίου **χρώματος** — τέσσερις ερωτήσεις, όχι μία.
 *
 * ## 🔴 Γιατί το «κληρονομείται» υπολογίζεται με προσωρινή αφαίρεση
 * Το δείγμα δίπλα στο «Αυτόματο» πρέπει να δείξει *σε τι επιστρέφεις*, όχι *τι ισχύει τώρα*.
 * Η μόνη ειλικρινής απάντηση είναι «τρέξε την ίδια επίλυση **χωρίς** την παράκαμψη του άξονα»
 * — γι' αυτό φτιάχνεται ένα εφήμερο μοντέλο με το πεδίο αφαιρεμένο. Είναι φθηνό (η
 * `setAxisStyleField` αντιγράφει μόνο τον έναν πίνακα άξονα) και τρέχει **μία φορά ανά άνοιγμα
 * ή πάτημα**, ποτέ ανά απόδοση.
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
 * Εδώ έγραφε `inherited?.value ?? style.rowClasses.data[key]`. Σε **μεικτό** άξονα το
 * `inherited.value` είναι `undefined`, οπότε η κλάση `data` γινόταν η απάντηση. Για το
 * **κείμενο** ήταν αβλαβές — η `data` δηλώνει πάντα χρώμα και η υπόδειξη ήταν γενική.
 *
 * Για το **γέμισμα** η ίδια γραμμή **αντιστρέφει το νόημα**: η `data` του `standard` **δεν
 * βάφει**, άρα μια **κεφαλίδα** (`#EDEDED`) που περνά πάνω από στήλη με ρητό γέμισμα δήλωνε
 * «Κληρονομεί «κανένα γέμισμα» από το στυλ» — ψέμα, στο χειριστήριο που υπάρχει για να λέει
 * την αλήθεια για την κληρονομιά. Το Revit απαντά την ίδια ερώτηση με `<varies>`: **μη-δήλωση**,
 * όχι λάθος δήλωση.
 *
 * ⚠️ Η πτώση στην `data` **μένει** για την περίπτωση «άξονας που δεν βρέθηκε» (`inherited`
 * είναι `null`, όχι μεικτό) — εκεί δεν υπάρχει τίποτα να ρωτήσεις, και η γραμμή δεν
 * εμφανίζεται καν.
 */
function axisColorStateOf(
  target: FormatTarget,
  key: 'textColorHex' | 'fillColorHex',
  role: PlotColorRole,
): TableAxisColorState {
  const { model, style, axis, id, layerColors } = target;
  const state = resolveAxisFormat(model, style, axis, id, key);
  const withoutOverride = setAxisStyleField(model, axis, id, key, undefined);
  const inherited = resolveAxisFormat(withoutOverride, style, axis, id, key);

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
 * Οι **δύο** ερωτήσεις του `TableAxisFormatState` μεταφρασμένες στη γλώσσα του κουμπιού.
 *
 * Το `active` διαβάζεται από την **επιλυμένη** τιμή (τι βλέπει ο χρήστης), το `explicit` από
 * την **παράκαμψη** (ποιος το είπε). Διαβάζοντας και τα δύο από το ίδιο σημείο, το κουμπί θα
 * έλεγε «όχι έντονα» για στήλη που το στυλ της γράφει έντονη — ψέμα για ό,τι είναι στην οθόνη.
 */
function toggleStateOf(target: FormatTarget, key: TableToggleFormatKey): TableToggleFormatState {
  const state = resolveAxisFormat(target.model, target.style, target.axis, target.id, key);
  if (!state) return EMPTY_TOGGLE;
  return { active: state.value === true, mixed: state.mixed, explicit: state.overridden };
}
