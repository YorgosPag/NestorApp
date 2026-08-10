/**
 * 🔴 ADR-739 §55 — **Η ΑΡΙΘΜΗΣΗ ΤΩΝ ΘΕΣΕΩΝ ROVING**, σε ένα σημείο και με τη σειρά του DOM.
 *
 * ## Γιατί δεν έμεινε μέσα στο δοχείο
 * Μέχρι το §55 τα διαμερίσματα ήταν τρία και η αριθμητική χωρούσε σε τρεις γραμμές
 * (`mergeBase` → `bordersIndex` → σύνολο). Με **δεκατρία** θραύσματα σε δύο σειρές, οι ίδιες
 * γραμμές θα γίνονταν μια αλυσίδα από ένθετα τριαδικά μέσα στο JSX — δηλαδή ακριβώς το σημείο
 * όπου η επόμενη προσθήκη ξεχνά ένα `+` και ο δείκτης δείχνει σε κουμπί άλλης σειράς. Εδώ η
 * σειρά είναι **δεδομένα**: διαβάζεται κάθετα και ελέγχεται χωρίς React.
 *
 * ## 🔴 ΔΥΟ ΚΑΝΟΝΕΣ ΠΟΥ ΔΕΝ ΣΠΑΝΕ
 * 1. **Η σειρά εδώ ΕΙΝΑΙ η σειρά του DOM.** Το roving δεν ξέρει γεωμετρία — ξέρει δείκτες. Αν
 *    η λίστα εδώ πει άλλη σειρά από αυτή που αποδίδει το δοχείο, το `→` θα πηδά ανάμεσα στις
 *    δύο σειρές με τυχαία σειρά, και **κανένα** test διάταξης δεν θα το δείξει.
 * 2. **Κανένα πλήθος δεν γράφεται εδώ με το χέρι.** Κάθε τμήμα δηλώνει το δικό του (τα
 *    `*_SLOTS` που εισάγονται παρακάτω)· γραμμένο εδώ θα ήταν σιωπηλή εξάρτηση που σπάει στην
 *    επόμενη προσθήκη **εκεί**.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/table-format-toolbar-slots
 * @see ui/components/table-format-toolbar/TableFormatToolbar.tsx — ο μόνος καταναλωτής
 */

import { TABLE_ALIGN_SLOTS } from './TableAlignMenu';
import { TABLE_FONT_CONTROL_SLOTS } from './TableFontControls';
import {
  TABLE_DECIMAL_SLOTS,
  TABLE_NUMBER_KIND_SLOTS,
} from './TableNumberFormatSection';
import {
  TABLE_FORMAT_FILL_COLOR_SLOTS,
  TABLE_FORMAT_PAINTER_SLOTS,
  TABLE_FORMAT_RESET_SLOTS,
  TABLE_FORMAT_SIZE_SLOTS,
  TABLE_FORMAT_TEXT_COLOR_SLOTS,
  TABLE_FORMAT_TOGGLE_SLOTS,
  TABLE_FORMAT_UNDERLINE_SLOTS,
} from './TableFormatSection';
import { TABLE_OVERFLOW_SLOTS } from './TableOverflowButtons';

/**
 * Το split button συγχώνευσης είναι **δύο** εστιάσιμα μισά, όχι ένα (`ToolbarSplitButton`).
 */
const TABLE_MERGE_SLOTS = 2;
/** Το dropdown περιγραμμάτων είναι **ένας** trigger· η λίστα του έχει δικό της roving. */
const TABLE_BORDER_SLOTS = 1;

/** Ποια διαμερίσματα έδωσε ο ξενιστής — **η παρουσία**, ποτέ σταθερό μέγεθος. */
export interface TableToolbarPresence {
  readonly fonts: boolean;
  readonly format: boolean;
  readonly numberFormat: boolean;
  readonly align: boolean;
  readonly borders: boolean;
  readonly merge: boolean;
  /**
   * 🔴 §58 Γ2 — **δικό του σκέλος, όχι μέρος του `format`.**
   *
   * Μέχρι το §58 η θέση της αναδίπλωσης κρατιόταν από το `format`, γιατί το κουμπί ήταν
   * ανενεργό placeholder μέσα στο `TableFormatSection`. Τώρα το ξεχείλισμα έχει **δικό του**
   * prop στο δοχείο και **δικό του** γραφέα — μια παρουσία που εξακολουθούσε να διαβάζεται από
   * το `format` θα σήμαινε ότι τα δύο κουμπιά καταλαμβάνουν θέσεις roving χωρίς να αποδίδονται.
   */
  readonly overflow: boolean;
  /**
   * 🔴 ADR-753 Φ4 — **τα τέσσερα χειριστήρια του `format` που μπορεί να λείπουν μεμονωμένα.**
   *
   * Μέχρι τη Φ4 η μορφοποίηση ήταν **αδιαίρετη**: ή και τα εννιά χειριστήρια, ή κανένα. Το mini
   * toolbar της **επεξεργασίας κελιού** έδειξε ότι η υπόθεση ήταν λάθος — εκεί ο χρήστης
   * δείχνει γράμματα, και το Excel εμφανίζει **μόνο** τα χειριστήρια που έχουν νόημα ανά
   * χαρακτήρα (μετρημένο από τον ιδιοκτήτη πάνω σε στιγμιότυπο).
   *
   * ⚠️ Χωριστά πεδία και όχι ένα `format: 'all' | 'text-edit'`: μια ονομασμένη «εκδοχή» θα
   * κωδικοποιούσε **πολιτική** μέσα στην αρίθμηση θέσεων, δηλαδή ο επόμενος ξενιστής θα έπρεπε
   * ή να χωρέσει σε μία από τις δύο ή να προσθέσει τρίτη. Η παρουσία μένει **δεδομένο**.
   */
  readonly formatFill: boolean;
  readonly formatUnderline: boolean;
  readonly formatPainter: boolean;
  readonly formatReset: boolean;
}

/**
 * Η **πρώτη** θέση roving κάθε θραύσματος, με τη σειρά του DOM (σειρά 1, μετά σειρά 2).
 *
 * Απόν τμήμα ⇒ η τιμή του δεν προχωρά τον μετρητή και **δεν διαβάζεται ποτέ** (το θραύσμα δεν
 * αποδίδεται). Δεν είναι `undefined` επίτηδες: ένα `number | undefined` θα ανάγκαζε δεκατρείς
 * ελέγχους `?? 0` στο δοχείο, δηλαδή δεκατρείς ευκαιρίες να γραφτεί `0` εκεί που δεν πρέπει.
 */
export interface TableToolbarSlots {
  // ── Σειρά 1 ────────────────────────────────────────────────────────────────
  readonly fontControls: number;
  readonly sizeSteps: number;
  readonly numberKinds: number;
  /** §58 Γ2 — **δύο** θέσεις πλέον (αναδίπλωση · σμίκρυνση), όχι μία. */
  readonly overflow: number;
  // ── Σειρά 2 ────────────────────────────────────────────────────────────────
  readonly toggles: number;
  readonly align: number;
  /** 🔴 ADR-753 Φ4 — **δύο** μετρητές πλέον: το γέμισμα μπορεί να λείπει χωρίς το μελάνι. */
  readonly fillColor: number;
  readonly textColor: number;
  readonly borders: number;
  readonly decimals: number;
  readonly formatPainter: number;
  // ── Σειρά 2, τρίτο τμήμα (η απόκλιση του ΝΕΣΤΟΡΑ) ──────────────────────────
  readonly underline: number;
  readonly merge: number;
  readonly reset: number;
  /** Πόσες θέσεις έχει συνολικά η γραμμή — το όρισμα του `useRovingToolbar`. */
  readonly total: number;
}

/**
 * Μοιράζει διαδοχικές θέσεις στα παρόντα θραύσματα.
 *
 * Ο μετρητής είναι τοπικός και εφήμερος (μία κλήση = μία ανάγνωση), οπότε δεν υπάρχει
 * κατάσταση να αποσυγχρονιστεί: η ίδια είσοδος δίνει πάντα την ίδια αρίθμηση.
 */
export function planTableToolbarSlots(presence: TableToolbarPresence): TableToolbarSlots {
  let cursor = 0;
  const take = (count: number, present: boolean): number => {
    const at = cursor;
    if (present) cursor += count;
    return at;
  };

  const { fonts, format, numberFormat, align, borders, merge, overflow } = presence;
  const { formatFill, formatUnderline, formatPainter, formatReset } = presence;

  return {
    fontControls: take(TABLE_FONT_CONTROL_SLOTS, fonts),
    sizeSteps: take(TABLE_FORMAT_SIZE_SLOTS, format),
    numberKinds: take(TABLE_NUMBER_KIND_SLOTS, numberFormat),
    overflow: take(TABLE_OVERFLOW_SLOTS, overflow),

    toggles: take(TABLE_FORMAT_TOGGLE_SLOTS, format),
    align: take(TABLE_ALIGN_SLOTS, align),
    // 🔴 ADR-753 Φ4 — τα τέσσερα προαιρετικά απαιτούν **και** το διαμέρισμα: χωρίς `format` δεν
    // υπάρχει κατάσταση να δείξουν, όσο κι αν ο ξενιστής τα ζήτησε.
    fillColor: take(TABLE_FORMAT_FILL_COLOR_SLOTS, format && formatFill),
    textColor: take(TABLE_FORMAT_TEXT_COLOR_SLOTS, format),
    borders: take(TABLE_BORDER_SLOTS, borders),
    decimals: take(TABLE_DECIMAL_SLOTS, numberFormat),
    formatPainter: take(TABLE_FORMAT_PAINTER_SLOTS, format && formatPainter),

    underline: take(TABLE_FORMAT_UNDERLINE_SLOTS, format && formatUnderline),
    merge: take(TABLE_MERGE_SLOTS, merge),
    reset: take(TABLE_FORMAT_RESET_SLOTS, format && formatReset),

    total: cursor,
  };
}
