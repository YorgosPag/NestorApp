/**
 * 🔴 ADR-739 §52 — **ΤΙ ΚΑΝΕΙ ΤΟ ΠΑΤΗΜΑ**: οι πέντε εντολές μορφοποίησης, μία φορά, για κάθε
 * επιφάνεια. Καθαρές συναρτήσεις πάνω σε έναν δεσμευτή· μηδέν React, μηδέν DOM.
 *
 * ## Γιατί υπάρχει
 * Οι ίδιοι έξι χειριστές («Β», μέγεθος ±, επαναφορά, δύο χρώματα) ζούσαν γραμμένοι μέσα στο
 * `use-table-header-menu.ts`. Το §52 τους ζήτησε **δύο ακόμη** φορές — στο mini toolbar της
 * επιλογής κελιών και στην κορδέλα. Τρία αντίγραφα του σχήματος
 * *«πάρε στόχο → διάβασε κατάσταση → γράψε πεδίο»* είναι sibling clone (CHECK 3.28 / N.18),
 * αλλά το σοβαρό δεν είναι οι γραμμές: θα ήταν **τρεις ευκαιρίες** να μάθει κάποιο από αυτά
 * διαφορετικό κανόνα για το «τι σημαίνει πάτημα σε μεικτή επιλογή» — και η απόκλιση θα ήταν
 * αόρατη, γιατί κάθε πλευρά της δουλεύει.
 *
 * ## 🔴 Η ΚΑΤΑΣΤΑΣΗ ΔΙΑΒΑΖΕΤΑΙ ΜΕΣΑ ΣΤΟΝ ΜΕΤΑΣΧΗΜΑΤΙΣΜΟ, ΟΧΙ ΠΡΙΝ
 * Το `nextBooleanFormat` ρωτά «είναι ήδη έντονα;» πάνω στο μοντέλο που **περνά ως όρισμα** στη
 * μεταβολή — δηλαδή στο **ζωντανό**, αυτό που θα γραφτεί (`useLiveTableMutation`). Η παλιά
 * μορφή διάβαζε από ένα `FormatTarget` φτιαγμένο λίγο νωρίτερα· ανάμεσα στα δύο μπορεί να έχει
 * τρέξει ένα `Ctrl+Z` από συντόμευση, και τότε το κουμπί θα αποφάσιζε με **παλιά** δεδομένα.
 * Το `style` και ο `scope` μένουν έξω γιατί δεν είναι μέρος του μοντέλου: το πρώτο έρχεται από
 * το μητρώο, ο δεύτερος από την επιλογή του χρήστη.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-format-commands
 * @see bim/table/table-format-scope.ts — οι καθαρές πράξεις πίσω από κάθε εντολή
 * @see ui/table-cell-editor/table-format-snapshot.ts — η ανάγνωση (τι δείχνει το κουμπί)
 */

import { nextBooleanFormat } from '../../bim/table/table-cell-style-scan';
import {
  clearTableFormatScope,
  resolveTableFormatState,
  setTableFormatField,
  setTableFormatOverflow,
  stepTableFormatTextHeight,
  type TableFormatScope,
} from '../../bim/table/table-format-scope';
import type { TableStyle } from '../../bim/table/table-style';
import type { TextHeightStepDirection } from '../../bim/table/table-text-height-scale';
import type {
  PersistedTableModel,
  TableAxisStyleOverride,
  TableCellOverflow,
} from '../../types/table';
import type { TableToggleFormatKey } from '../components/table-format-toolbar/TableFormatToolbar';

/**
 * Ο δεσμευτής: καθαρός μετασχηματισμός πάνω στο **ζωντανό** μοντέλο, μία εντολή, ένα `Ctrl+Z`.
 * Στην πράξη πάντα το `useLiveTableMutation` — δηλώνεται ως τύπος ώστε αυτό το module να μένει
 * καθαρό και να ελέγχεται χωρίς store, χωρίς React και χωρίς σκηνή.
 */
export type TableFormatApply = (
  mutate: (model: PersistedTableModel) => PersistedTableModel,
) => void;

/** Ο στόχος + το στυλ του, δηλαδή τα δύο πράγματα που **δεν** ζουν στο μοντέλο. */
export interface TableFormatCommandTarget {
  readonly style: TableStyle;
  readonly scope: TableFormatScope;
}

/**
 * Οι έξι εντολές. Δέχονται όλες `target | null` ώστε ο καλών να μη γράφει τον ίδιο έλεγχο έξι
 * φορές: χωρίς στόχο (undo έσβησε τη γραμμή) η εντολή είναι **no-op**, ποτέ μαντεψιά.
 */
export interface TableFormatCommands {
  /** «Β»/«Ι»/«Υ» — ο κανόνας «**μεικτό ⇒ όλα ναι**» ζει εδώ, όχι στον καλούντα. */
  readonly toggle: (target: TableFormatCommandTarget | null, key: TableToggleFormatKey) => void;
  readonly stepSize: (
    target: TableFormatCommandTarget | null,
    direction: TextHeightStepDirection,
  ) => void;
  readonly reset: (target: TableFormatCommandTarget | null) => void;
  /**
   * Ρητό χρώμα / «Αυτόματο» / «Κανένα γέμισμα» — η **ίδια** πράξη με άλλο όρισμα:
   * `hex` γράφει · `undefined` αφαιρεί το πεδίο (κληρονομιά) · `null` γράφει «ρητά κανένα».
   *
   * Ξεχωριστές συναρτήσεις («clearTextColor», «setNoFill») θα ήταν δεύτερος και τρίτος δρόμος
   * για την ίδια εγγραφή — και κάποιος από αυτούς θα ξεχνούσε κάποτε το no-op by-reference
   * που κρατά καθαρό το ιστορικό αναιρέσεων.
   */
  readonly setField: <K extends keyof TableAxisStyleOverride>(
    target: TableFormatCommandTarget | null,
    key: K,
    value: TableAxisStyleOverride[K] | undefined,
  ) => void;
  /**
   * 🔴 ADR-739 §58 Γ2 — **αναδίπλωση / σμίκρυνση**: δικό της μέλος, όχι `setField`.
   *
   * Δεν **γίνεται** μέσω του {@link setField}: εκείνο δέχεται `keyof TableAxisStyleOverride`, και
   * το `overflow` ζει **μόνο** στο `TableCellStyleOverride`. Ο αποκλεισμός δεν είναι τυπικός —
   * είναι ο ίδιος λόγος που το `setTableFormatOverflow` γράφει πάντα σε κελιά (δες την
   * τεκμηρίωσή του: υπάρχει ήδη γραφέας, και γράφει κελιά).
   *
   * ⚠️ Δέχεται την **τελική** τιμή, όχι την επιλογή του κουμπιού. Ο κανόνας «ίδια ⇒ ξεπάτωμα»
   * ζει στο `bim/table/table-overflow-ops.ts` και τον ρωτούν **και οι δύο** επιφάνειες — ίδια
   * ακριβώς διαίρεση με τη στοίχιση (`nextTableAlign` → `setField('align', …)`).
   */
  readonly setOverflow: (
    target: TableFormatCommandTarget | null,
    value: TableCellOverflow | undefined,
  ) => void;
}

/** Δένει τις πέντε εντολές σε **έναν** δεσμευτή. */
export function tableFormatCommands(apply: TableFormatApply): TableFormatCommands {
  return {
    /**
     * 🔴 §27.17 — **μία** απόφαση για όλον τον στόχο, όχι μία ανά κομμάτι του.
     *
     * Η επόμενη τιμή βγαίνει από τη **συναθροισμένη** κατάσταση, άρα ισχύει αυτούσιος ο
     * κανόνας «μεικτό ⇒ όλα ναι»: με δύο έντονες στήλες και μία όχι, το «Β» τις κάνει **όλες**
     * έντονες. Αν κάθε άξονας/κελί αποφάσιζε μόνο του, το ίδιο πάτημα θα έσβηνε τα έντονα από
     * τα δύο και θα τα άναβε στο τρίτο — δηλαδή το κουμπί θα **αντέστρεφε** αντί να ορίζει.
     */
    toggle: (target, key) => {
      if (!target) return;
      const { style, scope } = target;
      apply((model) => setTableFormatField(
        model, scope, key, nextBooleanFormat(resolveTableFormatState(model, style, scope, key)),
      ));
    },
    stepSize: (target, direction) => {
      if (!target) return;
      const { style, scope } = target;
      apply((model) => stepTableFormatTextHeight(model, style, scope, direction));
    },
    reset: (target) => {
      if (!target) return;
      const { scope } = target;
      apply((model) => clearTableFormatScope(model, scope));
    },
    setField: (target, key, value) => {
      if (!target) return;
      const { scope } = target;
      apply((model) => setTableFormatField(model, scope, key, value));
    },
    setOverflow: (target, value) => {
      if (!target) return;
      const { scope } = target;
      apply((model) => setTableFormatOverflow(model, scope, value));
    },
  };
}
