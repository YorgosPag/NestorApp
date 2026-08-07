/**
 * 🔴 ADR-739 §55 — **ΤΑ ΤΡΙΑ ΝΕΑ ΤΜΗΜΑΤΑ ΤΗΣ ΓΡΑΜΜΗΣ, ΣΕ ΜΙΑ ΕΡΩΤΗΣΗ ΚΑΙ ΕΝΑΝ ΓΡΑΦΕΑ.**
 *
 * Τυπογραφία (γραμματοσειρά + μέγεθος), αριθμητική μορφή και στοίχιση προστέθηκαν στο mini
 * toolbar ως **προαιρετικά** διαμερίσματα — και έμειναν αόρατα, γιατί καμία από τις **δύο**
 * υποδοχές (μενού άξονα, μενού περιοχής) δεν τα τροφοδοτούσε.
 *
 * ## Γιατί ένα κοινό module και όχι δύο φορές το ίδιο JSX
 * Οι δύο υποδοχές θα έγραφαν **κατά λέξη** τα ίδια δώδεκα πεδία props, με μόνη διαφορά τον
 * τυλιχτή εκτέλεσης (`runOnRange` / `runFormat`). Είναι ακριβώς το σχήμα «η μία πλευρά έμαθε,
 * η άλλη όχι» που το ADR-739 έχει ήδη πληρώσει τρεις φορές — και εδώ θα ήταν αόρατο, γιατί
 * κάθε πλευρά του δουλεύει.
 *
 * ## 🔑 ΕΝΑΣ γραφέας για τέσσερα πεδία
 * Και τα τέσσερα χειριστήρια γράφουν με το **ίδιο** `setField(target, key, value)`
 * (`table-format-commands.ts`). Άρα ο καλών δίνει **μία** συνάρτηση με το κλειδί ως όρισμα,
 * αντί για τέσσερις χειριστές που θα μπορούσαν κάποτε να καταλήξουν σε διαφορετικούς δρόμους
 * εγγραφής — και ο τύπος του κλειδιού κρατά την αντιστοίχιση κλειδί↔τιμή σφιχτή, χωρίς cast.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/table-toolbar-extras
 * @see ui/table-cell-editor/table-format-snapshot.ts — οι τρεις αναγνώσεις
 * @see ui/table-cell-editor/table-format-commands.ts — ο ΕΝΑΣ γραφέας
 */

import type {
  TableAxisStyleOverride,
  TableCellAlign,
  TableCellOverflow,
} from '../../../types/table';
import type { TableFontControlsState } from './TableFontControls';
import type { TableNumberFormatState } from './TableNumberFormatSection';
import type {
  TableAlignHostProps,
  TableFontHostProps,
  TableNumberFormatHostProps,
  TableOverflowHostProps,
} from './TableFormatToolbar';

/**
 * **Τι δείχνουν** τα τρία τμήματα για τον τρέχοντα στόχο — παγωμένο στο άνοιγμα, ξαναρωτημένο
 * μετά από κάθε πράξη, ακριβώς όπως το {@link TableFormatSnapshot} δίπλα του.
 *
 * Ένας τύπος και όχι τρία πεδία στον στόχο: τα τρία τμήματα εμφανίζονται και εξαφανίζονται
 * **μαζί** (καμία υποδοχή δίνει τα δύο από τα τρία), οπότε μια κατάσταση «δύο από τα τρία» δεν
 * πρέπει να είναι εκφράσιμη.
 */
export interface TableToolbarExtrasState {
  readonly fonts: TableFontControlsState;
  /**
   * Ό,τι μπορεί να διαλέξει ο χρήστης στο combobox γραμματοσειράς.
   *
   * Έρχεται από το SSoT `collectAvailableFontNames` (φορτωμένες + όσες αναφέρει η σκηνή) και
   * ταξιδεύει **μαζί με την κατάσταση**: η λίστα διαβάζεται με getter τη στιγμή του δεξιού
   * κλικ, γιατί μια συνδρομή θα έκανε re-render τον `CanvasSection` (ADR-040 κανόνας #1).
   */
  readonly fontNames: readonly string[];
  readonly numberFormat: TableNumberFormatState;
  /** `null` ⇒ **ανάμεικτος** στόχος (ή στόχος που δεν επιβίωσε) — δες `TableAlignMenu`. */
  readonly align: TableCellAlign | null;
  /**
   * 🔴 ADR-739 §58 Γ2 — τι ξεχείλισμα ισχύει· `null` ⇒ ανάμεικτος στόχος.
   *
   * Ταξιδεύει **μαζί** με τα άλλα τρία και όχι σε δικό του prop του ξενιστή, γιατί η ίδια
   * υπόδειξη ισχύει αυτούσια: εμφανίζονται και εξαφανίζονται **μαζί** (καμία υποδοχή δίνει τρία
   * από τα τέσσερα), οπότε μια κατάσταση «τρία από τα τέσσερα» δεν πρέπει να είναι εκφράσιμη.
   */
  readonly overflow: TableCellOverflow | null;
}

/**
 * Ο γραφέας ενός πεδίου στυλ, όπως τον βλέπει η γραμμή: **χωρίς στόχο**.
 *
 * Ο στόχος (όρια ή ζώνη) ξαναφτιάχνεται **μέσα** στον τυλιχτή του κάθε μενού — ο κανόνας που
 * και οι δύο υποδοχές ήδη επιβάλλουν για τη μορφοποίηση: ένα undo ενόσω η γραμμή ήταν ανοιχτή
 * σημαίνει «καμία πράξη», ποτέ εγγραφή σε κελιά που δεν υπάρχουν πια.
 */
export type TableToolbarFieldWriter = <K extends keyof TableAxisStyleOverride>(
  key: K,
  value: TableAxisStyleOverride[K] | undefined,
) => void;

/**
 * 🔴 ADR-739 §58 Γ2 — ο γραφέας του **ξεχειλίσματος**, όπως τον βλέπει η γραμμή: χωρίς στόχο.
 *
 * ⚠️ **Δεύτερη παράμετρος και όχι κλειδί του {@link TableToolbarFieldWriter}**, παρότι και τα
 * δύο γράφουν «ένα πεδίο του κελιού»: το `overflow` **δεν είναι** `keyof TableAxisStyleOverride`
 * — ζει μόνο στο `TableCellStyleOverride` και έχει δικό του γραφέα
 * ({@link setTableFormatOverflow}), που γράφει **πάντα** σε επίπεδο κελιού. Χωμένο στον γενικό
 * γραφέα θα απαιτούσε cast, δηλαδή θα έκανε εκφράσιμη μια εγγραφή που το μοντέλο απορρίπτει.
 */
export type TableToolbarOverflowWriter = (value: TableCellOverflow) => void;

/** Τα τέσσερα props του {@link TableFormatToolbar}, έτοιμα να απλωθούν. */
export interface TableToolbarExtrasProps {
  readonly fonts: TableFontHostProps;
  readonly numberFormat: TableNumberFormatHostProps;
  readonly align: TableAlignHostProps;
  readonly overflow: TableOverflowHostProps;
}

/**
 * Κατάσταση + γραφέας → τα τρία διαμερίσματα.
 *
 * ⚠️ Το `onSetTextHeightMm` γράφει **ρητή** τιμή από τη σκάλα (`number`), ενώ το
 * `onSetFontFamily` δέχεται και `null`/`undefined`: είναι η ίδια ασυμμετρία που δηλώνει ήδη το
 * μοντέλο (`TableAxisStyleOverride.fontFamily` έχει `null` = «ρητά η προεπιλογή του μετρητή»,
 * το `textHeightMm` όχι — «αυτόματο ύψος» δεν υπάρχει). Δεν εξομαλύνεται εδώ: μια ενιαία
 * υπογραφή θα έκανε εκφράσιμη μια εγγραφή που το μοντέλο απορρίπτει.
 */
export function tableToolbarExtrasProps(
  state: TableToolbarExtrasState,
  setField: TableToolbarFieldWriter,
  setOverflow: TableToolbarOverflowWriter,
): TableToolbarExtrasProps {
  return {
    overflow: {
      current: state.overflow,
      onSetOverflow: setOverflow,
    },
    fonts: {
      state: state.fonts,
      fonts: state.fontNames,
      onSetFontFamily: (value) => setField('fontFamily', value),
      onSetTextHeightMm: (value) => setField('textHeightMm', value),
    },
    numberFormat: {
      state: state.numberFormat,
      onSetNumberFormat: (value) => setField('numberFormat', value),
    },
    align: {
      current: state.align,
      onSetAlign: (value) => setField('align', value),
    },
  };
}
