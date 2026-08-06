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
  TABLE_FORMAT_COLOR_SLOTS,
  TABLE_FORMAT_PAINTER_SLOTS,
  TABLE_FORMAT_RESET_SLOTS,
  TABLE_FORMAT_SIZE_SLOTS,
  TABLE_FORMAT_TOGGLE_SLOTS,
  TABLE_FORMAT_UNDERLINE_SLOTS,
  TABLE_FORMAT_WRAP_SLOTS,
} from './TableFormatSection';

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
  readonly wrapText: number;
  // ── Σειρά 2 ────────────────────────────────────────────────────────────────
  readonly toggles: number;
  readonly align: number;
  readonly colors: number;
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

  const { fonts, format, numberFormat, align, borders, merge } = presence;

  return {
    fontControls: take(TABLE_FONT_CONTROL_SLOTS, fonts),
    sizeSteps: take(TABLE_FORMAT_SIZE_SLOTS, format),
    numberKinds: take(TABLE_NUMBER_KIND_SLOTS, numberFormat),
    wrapText: take(TABLE_FORMAT_WRAP_SLOTS, format),

    toggles: take(TABLE_FORMAT_TOGGLE_SLOTS, format),
    align: take(TABLE_ALIGN_SLOTS, align),
    colors: take(TABLE_FORMAT_COLOR_SLOTS, format),
    borders: take(TABLE_BORDER_SLOTS, borders),
    decimals: take(TABLE_DECIMAL_SLOTS, numberFormat),
    formatPainter: take(TABLE_FORMAT_PAINTER_SLOTS, format),

    underline: take(TABLE_FORMAT_UNDERLINE_SLOTS, format),
    merge: take(TABLE_MERGE_SLOTS, merge),
    reset: take(TABLE_FORMAT_RESET_SLOTS, format),

    total: cursor,
  };
}
