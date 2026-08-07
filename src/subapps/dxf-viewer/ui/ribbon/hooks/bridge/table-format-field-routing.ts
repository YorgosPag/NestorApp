/**
 * 🔴 ADR-739 §56 — **η δρομολόγηση των νέων χειριστηρίων της «Μορφοποίησης»**: στοίχιση,
 * μορφή αριθμού, οικογένεια γραμματοσειράς.
 *
 * Καθαρές συναρτήσεις πάνω στη **θύρα** — μηδέν React, μηδέν hooks. Ο
 * {@link useRibbonTableFormatBridge} τις καλεί και μένει αυτό που ήταν: ένας συνθέτης.
 *
 * ## Γιατί χωριστό αρχείο και όχι μέσα στον bridge
 * Ο bridge είχε **τρία** χειριστήρια μορφοποίησης· τώρα έχει **δεκατρία**. Γραμμένα inline, οι
 * τέσσερις μέθοδοί του (`getToggleState` / `onToggle` / `getComboboxState` / `onAction`) θα
 * περνούσαν όλες το όριο των 40 γραμμών (N.7.1) — και, χειρότερα, η ερώτηση «τι σημαίνει αυτό
 * το κλειδί;» θα ζούσε ανακατεμένη με την ερώτηση «πώς συνδέομαι στην κορδέλα;».
 *
 * ## 🔴 ΚΑΜΙΑ ΑΠΟΦΑΣΗ ΔΕΝ ΓΕΝΝΙΕΤΑΙ ΕΔΩ
 * Τι σημαίνει «%», τι σημαίνει «αριστερά» πάνω σε κελί που είναι ήδη στη μέση, πότε ένα κουμπί
 * είναι πατημένο — **όλα** τα ρωτούν τα δύο καθαρά modules του μοντέλου
 * (`table-align-ops.ts` · `table-number-format-ops.ts`), τα ίδια που ρωτά και το mini toolbar.
 * Εδώ ζει **μόνο** η μετάφραση `commandKey → ερώτηση`, ώστε οι δύο επιφάνειες να μην μπορούν
 * να μάθουν διαφορετικό κανόνα.
 *
 * ## 🔴 «ΤΟ ΧΕΙΡΙΣΤΗΚΑ;» ΩΣ ΤΙΜΗ ΕΠΙΣΤΡΟΦΗΣ
 * Οι γραφείς επιστρέφουν `boolean` και όχι `void`: ο bridge συνθέτει με ~42 άλλους στον
 * `useRibbonCommands` και **δεν επιτρέπεται** να διεκδικήσει ξένο κλειδί. Με `void`, ο καλών θα
 * έπρεπε να ξαναρωτήσει τους ίδιους φύλακες για να ξέρει αν συνεχίσει — δηλαδή δύο σημεία που
 * απαντούν «δικό μου;», και μια μέρα διαφωνούν.
 *
 * @module subapps/dxf-viewer/ui/ribbon/hooks/bridge/table-format-field-routing
 * @see bim/table/table-align-ops.ts — τι κάνει το πάτημα στοίχισης (SSoT)
 * @see bim/table/table-number-format-ops.ts — τι κάνει το πάτημα αριθμού (SSoT)
 */

// 🔴 Το ΕΝΑ σεντινέλι «καμία επιλογή» του έργου. Το Radix Select δεσμεύει το `''` για δική του
// χρήση, οπότε ένα `<SelectItem value="">` είναι δομικά ανέκφραστο — δες `readTableFontFamilyCombobox`.
import { SELECT_CLEAR_VALUE, isSelectClearValue } from '@/config/domain-constants';
import {
  isTableAlignActive,
  nextTableAlign,
} from '../../../../bim/table/table-align-ops';
import {
  isTableNumberFormatActive,
  nextTableNumberFormat,
  stepTableNumberFormatDecimals,
} from '../../../../bim/table/table-number-format-ops';
// 🔴 ADR-739 §58 Γ2 — τι σημαίνει το πάτημα στα δύο κουμπιά ξεχειλίσματος. **Το ίδιο** module
// που ρωτά και το mini toolbar: μια δεύτερη γραφή του κανόνα θα ήταν δύο ευκαιρίες να μάθει η
// μία επιφάνεια «άλλη» αμοιβαία αποκλειστικότητα, με κάθε πλευρά να δουλεύει.
import {
  isTableOverflowActive,
  nextTableOverflow,
} from '../../../../bim/table/table-overflow-ops';
// 🔴 ADR-739 §59 Δ2 — τι σημαίνει ένα σκαλί εσοχής. Το **ίδιο** module που θα ρωτούσε κάθε άλλη
// επιφάνεια: το ξεπάτωμα στο μηδέν (σβήσιμο πεδίου, όχι ρητό `0`) είναι κανόνας του μοντέλου,
// όχι της κορδέλας — δες την κεφαλίδα του `nextTableIndentLevel`.
import { nextTableIndentLevel } from '../../../../bim/table/table-indent-ops';
// 🔴 ADR-739 §59 Δ1 — τι σημαίνει το πάτημα των δύο περιστροφών. Το **ίδιο** module που ρωτά η
// μηχανή διάταξης για την κανονικοποίηση της γωνίας: μια δεύτερη γραφή του «ίδια ⇒ ξεπάτωμα»
// θα ήταν δύο ευκαιρίες να μάθει κάθε επιφάνεια άλλον κανόνα, με κάθε πλευρά να «δουλεύει».
import {
  isTableTextRotationActive,
  nextTableTextRotation,
} from '../../../../bim/table/table-rotation-ops';
import {
  TABLE_FORMAT_ALIGN_CHOICE,
  TABLE_FORMAT_CLIPBOARD_COMMAND,
  TABLE_FORMAT_DECIMAL_DIRECTION,
  TABLE_FORMAT_INDENT_DIRECTION,
  TABLE_FORMAT_NUMBER_COMMAND,
  TABLE_FORMAT_OVERFLOW_CHOICE,
  TABLE_FORMAT_RIBBON_KEYS,
  TABLE_FORMAT_ROTATION_PRESET,
  isTableFormatAlignKey,
  isTableFormatNumberKey,
  isTableFormatOverflowKey,
  isTableFormatRotationKey,
} from './table-format-command-keys';
import type { TableFormatPort } from '../../../table-cell-editor/table-format-port';
import type { RibbonComboboxOption } from '../../types/ribbon-types';
import type {
  RibbonComboboxState,
  RibbonToggleState,
} from '../../context/RibbonCommandContext';

/**
 * 🔴 **Η ΣΤΟΙΧΙΣΗ ΩΣ ΚΑΤΑΣΤΑΣΗ ΚΟΥΜΠΙΟΥ** — `null` = ανάμεικτο, `false` = δεν ισχύει.
 *
 * Η ίδια σύμβαση με τα Β/Ι/Υ δίπλα τους (`RibbonToggleState` = `boolean | null`), και ο λόγος
 * που τα έξι κουμπιά είναι toggles: σε ανάμεικτο στόχο **καμία** θέση δεν είναι η αλήθεια, και
 * ένα πατημένο κουμπί θα έλεγε ψέματα για τα μισά κελιά.
 *
 * Χωρίς στόχο ⇒ `false`: η θύρα απαντά `null` στο `state()` και δεν υπάρχει τίποτα να δείξουμε.
 */
export function readTableAlignToggle(
  port: TableFormatPort | null,
  commandKey: string,
): RibbonToggleState {
  if (!isTableFormatAlignKey(commandKey)) return false;
  const state = port?.state('align');
  if (!state) return false;
  if (state.mixed) return null;
  return isTableAlignActive(state.value ?? null, TABLE_FORMAT_ALIGN_CHOICE[commandKey]);
}

/**
 * 🔴 **Η ΜΟΡΦΗ ΑΡΙΘΜΟΥ ΩΣ ΚΑΤΑΣΤΑΣΗ ΚΟΥΜΠΙΟΥ.**
 *
 * ⚠️ **Ο φύλακας `scope()` ΔΕΝ είναι πλεονασμός** — και είναι η μία θέση όπου η κορδέλα
 * **δεν** μπορεί να αντιγράψει το mini toolbar. Το `EMPTY_TABLE_NUMBER_FORMAT_STATE` κωδικοποιεί
 * το «χωρίς στόχο» ως `current: null`, δηλαδή **την ίδια τιμή** με το «ανάμεικτο». Το ίδιο του
 * το σχόλιο δηλώνει γιατί είναι ακίνδυνο εκεί: *«η γραμμή δεν αποδίδεται καθόλου χωρίς στόχο»*.
 *
 * Εδώ αποδίδεται. Η καρτέλα μένει ορατή ένα καρέ αφότου κλείσει ο δρομέας (§52), οπότε χωρίς
 * αυτόν τον φύλακα τα τρία κουμπιά θα γίνονταν **indeterminate** — δηλαδή θα δήλωναν «τα κελιά
 * διαφωνούν» για επιλογή που δεν υπάρχει.
 */
export function readTableNumberToggle(
  port: TableFormatPort | null,
  commandKey: string,
): RibbonToggleState {
  if (!isTableFormatNumberKey(commandKey)) return false;
  if (!port || port.scope() === null) return false;
  const { current } = port.numberFormat();
  if (current === null) return null;
  return isTableNumberFormatActive(current, TABLE_FORMAT_NUMBER_COMMAND[commandKey]);
}

/**
 * 🔴 §58 Γ2 — **ΤΟ ΞΕΧΕΙΛΙΣΜΑ ΩΣ ΚΑΤΑΣΤΑΣΗ ΚΟΥΜΠΙΟΥ.**
 *
 * ⚠️ **Ο φύλακας `scope()` ΔΕΝ είναι πλεονασμός** — τρίτη εμφάνιση της ίδιας παγίδας, μετά τη
 * μορφή αριθμού (§56 β). Το `port.overflow()` κωδικοποιεί το «χωρίς στόχο» ως `null`, δηλαδή
 * **την ίδια τιμή** με το «ανάμεικτο». Στο mini toolbar είναι ακίνδυνο (η γραμμή δεν αποδίδεται
 * καθόλου χωρίς στόχο)· **στην κορδέλα αποδίδεται** — η καρτέλα μένει ορατή ένα καρέ αφότου
 * κλείσει ο δρομέας (§52), οπότε χωρίς τον φύλακα τα δύο κουμπιά θα δήλωναν «τα κελιά
 * διαφωνούν» για επιλογή που δεν υπάρχει.
 *
 * 🔑 Σε **ανάμεικτο** στόχο η απάντηση είναι `null` και για τα δύο κουμπιά — καμία θέση δεν
 * είναι η αλήθεια, ίδια σύμβαση με τη στοίχιση.
 */
export function readTableOverflowToggle(
  port: TableFormatPort | null,
  commandKey: string,
): RibbonToggleState {
  if (!isTableFormatOverflowKey(commandKey)) return false;
  if (!port || port.scope() === null) return false;
  const current = port.overflow();
  if (current === null) return null;
  return isTableOverflowActive(current, TABLE_FORMAT_OVERFLOW_CHOICE[commandKey]);
}

/**
 * 🔴 §59 Δ1 — **Ο ΠΡΟΣΑΝΑΤΟΛΙΣΜΟΣ ΩΣ ΚΑΤΑΣΤΑΣΗ ΚΟΥΜΠΙΟΥ.**
 *
 * ⚠️ **Κανένας φύλακας `scope()` εδώ, και είναι απόφαση** — σε αντίθεση με τη μορφή αριθμού
 * (§56 β) και το ξεχείλισμα (§58 Γ2). Εκείνα διαβάζονται από **δικά τους μέλη** της θύρας, που
 * κωδικοποιούν το «χωρίς στόχο» με την **ίδια** τιμή που σημαίνει «ανάμεικτο» (`null`), οπότε
 * χωρίς φύλακα τα κουμπιά γίνονταν indeterminate για επιλογή που δεν υπάρχει. Η γωνία περνά
 * από το γενικό `state()`, που απαντά `null` **μόνο** όταν δεν υπάρχει στόχος και σηματοδοτεί
 * το ανάμεικτο με ρητό `mixed: true`: οι δύο καταστάσεις είναι **διακριτές στον τύπο**, άρα ο
 * φύλακας δεν έχει τι να προσθέσει. Ίδια δομή με τα έξι κουμπιά στοίχισης από πάνω.
 */
export function readTableRotationToggle(
  port: TableFormatPort | null,
  commandKey: string,
): RibbonToggleState {
  if (!isTableFormatRotationKey(commandKey)) return false;
  const state = port?.state('textRotationDeg');
  if (!state) return false;
  if (state.mixed) return null;
  return isTableTextRotationActive(state.value ?? null, TABLE_FORMAT_ROTATION_PRESET[commandKey]);
}

/**
 * Πάτημα κουμπιού στοίχισης, αριθμού, ξεχειλίσματος ή **προσανατολισμού**· `false` ⇒ **δεν ήταν
 * δικό μου κλειδί**.
 *
 * ⚠️ Το `nextValue` της κορδέλας αγνοείται και εδώ, για τον λόγο που τεκμηριώνει ήδη το
 * `onToggle` του bridge: η κορδέλα το υπολογίζει ως `!current`, και σε ανάμεικτο στόχο το
 * `!null` δίνει `true` κατά τύχη. Ο σωστός κανόνας ζει στα δύο ops modules.
 */
export function writeTableFormatToggle(
  port: TableFormatPort | null,
  commandKey: string,
): boolean {
  if (!port) {
    return isTableFormatAlignKey(commandKey)
      || isTableFormatNumberKey(commandKey)
      || isTableFormatOverflowKey(commandKey)
      || isTableFormatRotationKey(commandKey);
  }

  if (isTableFormatAlignKey(commandKey)) {
    const state = port.state('align');
    const current = !state || state.mixed ? null : state.value ?? null;
    port.setField('align', nextTableAlign(current, TABLE_FORMAT_ALIGN_CHOICE[commandKey]));
    return true;
  }

  if (isTableFormatNumberKey(commandKey)) {
    const { current } = port.numberFormat();
    // `undefined` ⇒ **σβήσε** το πεδίο (ξεπάτημα ⇒ κληρονομιά). Το `setField` δέχεται ήδη τις
    // τρεις καταστάσεις αυτούσιες — καμία μετάφραση δεν χρειάζεται εδώ.
    port.setField('numberFormat', nextTableNumberFormat(current, TABLE_FORMAT_NUMBER_COMMAND[commandKey]));
    return true;
  }

  if (isTableFormatOverflowKey(commandKey)) {
    // 🔑 Η **αμοιβαία αποκλειστικότητα** δεν γράφεται εδώ και δεν επιτρέπεται να γραφτεί: το
    // `nextTableOverflow` επιστρέφει **μία** τιμή της ένωσης, οπότε «σμίκρυνση πάνω σε
    // αναδιπλωμένο» σβήνει την αναδίπλωση **δομικά**. Ένα χειροκίνητο «ξετσέκαρε το άλλο» εδώ
    // θα ήταν κανόνας που η δεύτερη επιφάνεια μπορεί να ξεχάσει.
    port.setOverflow(nextTableOverflow(port.overflow(), TABLE_FORMAT_OVERFLOW_CHOICE[commandKey]));
    return true;
  }

  if (isTableFormatRotationKey(commandKey)) {
    const state = port.state('textRotationDeg');
    const current = !state || state.mixed ? null : state.value ?? null;
    // 🔑 Η **αμοιβαία αποκλειστικότητα** των δύο περιστροφών δεν γράφεται εδώ και δεν
    // χρειάζεται: το πεδίο είναι **ένας αριθμός**, οπότε «προς τα πάνω» πάνω σε «προς τα κάτω»
    // απλώς γράφει `+90`. Ίδια αρχή με το ξεχείλισμα από πάνω — τη δουλειά την κάνει το σχήμα
    // των δεδομένων, όχι κώδικας που η δεύτερη επιφάνεια μπορεί να ξεχάσει.
    port.setField(
      'textRotationDeg',
      nextTableTextRotation(current, TABLE_FORMAT_ROTATION_PRESET[commandKey]),
    );
    return true;
  }

  return false;
}

/**
 * Ένα σκαλί ακρίβειας· `false` ⇒ δεν ήταν δικό μου κλειδί.
 *
 * ⚠️ `null` από το SSoT ⇒ **καμία εγγραφή**: είμαστε στο άκρο (0 ή 8 δεκαδικά) και μια εγγραφή
 * θα γεννούσε βήμα `Ctrl+Z` που δεν αλλάζει τίποτα ορατό. Η κορδέλα δεν έχει «γκρίζο» εδώ όπως
 * το mini toolbar — το κουμπί απλώς δεν κάνει τίποτα, που είναι το ίδιο αποτέλεσμα με το
 * `disabled` και δεν απαιτεί ανά-καρέ ερώτηση για κάθε κουμπί.
 */
export function writeTableDecimalStep(
  port: TableFormatPort | null,
  commandKey: string,
): boolean {
  const direction = TABLE_FORMAT_DECIMAL_DIRECTION[commandKey];
  if (direction === undefined) return false;
  if (!port) return true;

  const next = stepTableNumberFormatDecimals(port.numberFormat().current, direction);
  if (next !== null) port.setField('numberFormat', next);
  return true;
}

/**
 * 🔴 ADR-739 §59 Δ2 — **ένα σκαλί εσοχής**· `false` ⇒ δεν ήταν δικό μου κλειδί.
 *
 * ## ⚠️ ΠΡΕΠΕΙ ΝΑ ΚΛΗΘΕΙ **ΠΡΙΝ** ΤΟΝ ΓΕΝΙΚΟ ΚΛΑΔΟ ΤΩΝ `actions` — τέταρτη φορά
 * Τα δύο κλειδιά ζουν μέσα στο `TABLE_FORMAT_RIBBON_KEYS.actions`, άρα ο
 * `isTableFormatActionKey` τα δέχεται, και ο κλάδος του στέλνει ό,τι δεν είναι «επαναφορά» στο
 * `stepTextHeight`. Ανάποδα, η «Αύξηση εσοχής» θα **μεγάλωνε τη γραμματοσειρά**, χωρίς κανένα
 * σφάλμα και με το κουμπί να φαίνεται ότι δουλεύει. Ίδια παγίδα με τα δεκαδικά (§56) και το
 * πρόχειρο (§57)· ρητή άγκυρα στο `useRibbonTableFormatBridge.test.tsx`.
 *
 * ## Η ανάγνωση περνά από το γενικό `state()` — και ΔΕΝ χρειάστηκε μέλος θύρας
 * Το `indentLevel` ζει **και** στο `TableAxisStyleOverride` **και** στο `TableCellStyle`, άρα
 * ανήκει στην τομή `TableCellStyleKey` που δέχονται το `state()` και το `setField()`. Είναι
 * ακριβώς η κατάσταση του `align`/`fontFamily` του §56 («δεν χρειάστηκαν τίποτα») και το
 * αντίθετο του ξεχειλίσματος, που ζει μόνο στο στενότερο σκέλος και χρειάστηκε **δύο** μέλη.
 *
 * ⚠️ **Ανάμεικτος στόχος διαβάζεται ως `0`**, όχι ως «μην κάνεις τίποτα»: ο χρήστης που πατά
 * «Αύξηση» πάνω σε ανάμεικτη επιλογή ζητά «βάλ' τα όλα ένα σκαλί μέσα». Ο κανόνας ζει στο
 * `nextTableIndentLevel`, όχι εδώ.
 */
export function writeTableIndentStep(
  port: TableFormatPort | null,
  commandKey: string,
): boolean {
  const direction = TABLE_FORMAT_INDENT_DIRECTION[commandKey];
  if (direction === undefined) return false;
  if (!port) return true;

  const state = port.state('indentLevel');
  const current = !state || state.mixed ? null : state.value ?? null;
  const next = nextTableIndentLevel(current, direction);
  // `null` ⇒ **καμία εγγραφή** (είμαστε στο άκρο)· `undefined` ⇒ **σβήσιμο** του πεδίου, που
  // είναι πραγματική εγγραφή και δεν επιτρέπεται να μπερδευτεί με το πρώτο. Δύο διαφορετικές
  // «κενές» τιμές, δύο διαφορετικές πράξεις — γι' αυτό ο έλεγχος είναι ρητά `!== null`.
  if (next !== null) port.setField('indentLevel', next);
  return true;
}

/**
 * 🔴 ADR-739 §57 — **αποκοπή / αντιγραφή**· `false` ⇒ δεν ήταν δικό μου κλειδί.
 *
 * ## ⚠️ ΠΡΕΠΕΙ ΝΑ ΚΛΗΘΕΙ **ΠΡΙΝ** ΤΟΝ ΓΕΝΙΚΟ ΚΛΑΔΟ ΤΩΝ `actions`
 * Τα δύο κλειδιά ζουν μέσα στο `TABLE_FORMAT_RIBBON_KEYS.actions`, άρα ο
 * `isTableFormatActionKey` τα δέχεται — και ο κλάδος του στέλνει ό,τι δεν είναι «επαναφορά» στο
 * `stepTextHeight`. Ανάποδα, η «Αντιγραφή» θα **μεγάλωνε τη γραμματοσειρά** (`STEP_DIRECTION[copy]`
 * = `undefined` ⇒ βήμα προς το πουθενά), χωρίς κανένα σφάλμα και με το κουμπί να φαίνεται ότι
 * δουλεύει. Είναι **η ίδια παγίδα** που έπιασε τα δεκαδικά του §56, δεύτερη φορά.
 *
 * ## Ο στόχος ξαναρωτιέται τη στιγμή του πατήματος
 * `port.bounds()` εδώ και όχι παγωμένο στο render (ADR-040 #2): ένα `Ctrl+Z` ανάμεσα στην
 * απόδοση της κορδέλας και το κλικ σημαίνει «καμία πράξη», ποτέ αντιγραφή κελιών που δεν
 * φωτίζουν πια.
 *
 * Το `void` είναι ρητό: οι δύο πράξεις είναι **ασύγχρονες** (γράφουν στο πρόχειρο του
 * λειτουργικού) και κάθε άρνηση λέγεται από μέσα τους — δεν υπάρχει `Promise` να περιμένει κανείς.
 */
export function writeTableClipboardCommand(
  port: TableFormatPort | null,
  commandKey: string,
): boolean {
  const command = TABLE_FORMAT_CLIPBOARD_COMMAND[commandKey];
  if (command === undefined) return false;
  if (!port) return true;

  const target = port.bounds();
  if (target) void port.clipboard[command](target);
  return true;
}

/**
 * 🔴 **Η ΟΙΚΟΓΕΝΕΙΑ ΓΡΑΜΜΑΤΟΣΕΙΡΑΣ** — τιμή + λίστα, από τη θύρα.
 *
 * ## Οι τρεις καταστάσεις της τιμής
 * ```
 *   ανάμεικτο       →  null                →  η κορδέλα δείχνει κενό πεδίο (συμπεριφορά Excel)
 *   κληρονομεί      →  SELECT_CLEAR_VALUE  →  η επιλογή «Αυτόματη»
 *   ρητή οικογένεια →  όνομα
 * ```
 *
 * ## 🔴 ΓΙΑΤΙ `SELECT_CLEAR_VALUE` ΚΑΙ ΟΧΙ `''` — ΔΙΟΡΘΩΣΗ ΧΡΟΝΟΥ ΕΚΤΕΛΕΣΗΣ (2026-08-08)
 * Εδώ έγραφε `value: ''` με την αιτιολόγηση *«το κενό αλφαριθμητικό είναι **τιμή** και όχι
 * “τίποτα”: είναι η ταυτότητα της επιλογής “Αυτόματη”»*. Η **πρόθεση** ήταν σωστή· η **τιμή**
 * όχι: το Radix Select δεσμεύει το `''` ως «καμία επιλογή» και το χρησιμοποιεί για να καθαρίζει
 * το πεδίο — άρα ένα `<SelectItem value="">` είναι δομικά ανέκφραστο. Ο φύλακας του
 * `components/ui/select.tsx` **πετά ρητά** σε dev, και η καρτέλα «Μορφοποίηση» **δεν
 * αποδιδόταν καθόλου**.
 *
 * ⚠️ Η αστοχία ήταν **αόρατη σε κάθε πύλη**: το κλειδί υπάρχει, τα tests του bridge περνούσαν
 * (ρωτούν τη **λίστα**, όχι το Radix), και ο μεταγλωττιστής δέχεται κάθε `string`. Την είδε
 * **άνθρωπος ανοίγοντας την καρτέλα** — το ίδιο σχήμα με τα ωμά ελληνικά του N.11.
 *
 * Το `SELECT_CLEAR_VALUE` (`'__clear__'`) είναι το **υπάρχον SSoT** του έργου γι' αυτό ακριβώς
 * το ερώτημα (`@/config/domain-constants`) και το ίδιο το μήνυμα του φύλακα το ονομάζει. Ένα
 * δεύτερο τοπικό σεντινέλι εδώ θα ήταν η δεύτερη απάντηση στο «πώς λέγεται το τίποτα σε ένα
 * dropdown» — και θα ξανάσπαγε στον επόμενο φύλακα.
 *
 * 🔑 Το σεντινέλι **δεν διαρρέει στο μοντέλο**: το {@link writeTableFontFamily} το μεταφράζει σε
 * `undefined` (= σβήσε το πεδίο) πριν φτάσει στη θύρα, με τον **ίδιο** φύλακα
 * (`isSelectClearValue`) που ορίζει το SSoT. Η κατεύθυνση ανάγνωσης και η κατεύθυνση εγγραφής
 * ρωτούν το ίδιο πράγμα, άρα δεν μπορούν να διαφωνήσουν.
 *
 * ⚠️ Το mini toolbar (`TableFontControls`) κρατά το `key: ''` και **σωστά**: εκείνο δεν είναι
 * Radix Select — είναι το δικό μας `ToolbarCombobox`, όπου το `key` είναι σκέτο κλειδί React και
 * η πράξη ταξιδεύει σε `onSelect`. Δεν υπάρχει τιμή να συγκρουστεί με τίποτα.
 *
 * ## Γιατί οι επιλογές είναι `isLiteralLabel`
 * Τα ονόματα γραμματοσειρών **δεν** είναι κλειδιά i18n — είναι δεδομένα της σκηνής. Χωρίς τη
 * σημαία, το `t('Arial')` θα ζωγράφιζε το ωμό κλειδί· δες τη διόρθωση του §52.2 στο dropdown
 * στυλ, ίδιο ακριβώς σχήμα.
 */
export function readTableFontFamilyCombobox(port: TableFormatPort | null): RibbonComboboxState {
  const state = port?.state('fontFamily');
  const options: readonly RibbonComboboxOption[] = [
    { value: SELECT_CLEAR_VALUE, labelKey: 'ribbon.commands.tableFormat.automaticFont' },
    ...(port?.fontNames() ?? []).map((font) => ({
      value: font,
      labelKey: font,
      isLiteralLabel: true,
    })),
  ];

  if (!state) return { value: null, options };
  // `null` σημαίνει «μεικτό» και για τα δύο combobox της καρτέλας — δες `getComboboxState`.
  if (state.mixed) return { value: null, options };
  return { value: state.value ?? SELECT_CLEAR_VALUE, options };
}

/**
 * Γράφει την οικογένεια· **η «Αυτόματη» σβήνει το πεδίο** (⇒ κληρονομιά).
 *
 * Ο φύλακας είναι ο `isSelectClearValue` του SSoT και όχι σύγκριση με literal: το σεντινέλι
 * ορίζεται σε **ένα** σημείο, και μια τοπική `=== '__clear__'` θα ήταν αντίγραφό του που
 * επιβιώνει σιωπηλά αν αυτό αλλάξει.
 */
export function writeTableFontFamily(port: TableFormatPort, value: string): void {
  port.setField('fontFamily', isSelectClearValue(value) ? undefined : value);
}

/** Είναι το κλειδί της οικογένειας; Ρωτιέται και από τους δύο δρόμους του combobox. */
export function isTableFontFamilyKey(commandKey: string): boolean {
  return commandKey === TABLE_FORMAT_RIBBON_KEYS.fontFamily;
}
