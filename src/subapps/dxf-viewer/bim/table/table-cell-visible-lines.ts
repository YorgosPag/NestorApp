/**
 * 🔴 ADR-739 §58 Γ2 — **ΤΟ ΟΡΑΤΟ ΠΕΡΙΕΧΟΜΕΝΟ ΕΝΟΣ ΚΕΛΙΟΥ: μία ή ΠΟΛΛΕΣ οπτικές γραμμές.**
 *
 * ## Γιατί ξεχωριστό αρχείο από το `table-cell-overflow.ts`
 * Οι δύο απαντούν σε **διαφορετικές** ερωτήσεις, και η μία χτίζεται πάνω στην άλλη:
 * ```
 *   table-cell-overflow.ts       →  «σε ΜΙΑ γραμμή, τι γίνεται όταν δεν χωράει;» (clip · shrink)
 *   table-cell-visible-lines.ts  →  «τι ζωγραφίζεται ΣΥΝΟΛΙΚΑ σε αυτό το κελί;»  (+ wrap)
 * ```
 * Η εξαγωγή έγινε όταν το `'wrap'` έφερε το `table-cell-overflow.ts` στις **559 γραμμές**
 * (όριο N.7.1: 500). **Εξαγωγή, όχι κόψιμο**: μεταφέρθηκε ολόκληρη η ενότητα Γ2 μαζί με τους
 * τύπους και την τεκμηρίωσή της, ώστε το όριο μεγέθους να μη γίνει αφορμή να λείψει το «γιατί».
 *
 * ⚠️ **Η εξάρτηση είναι ΜΟΝΟΔΡΟΜΗ**: εδώ → `table-cell-overflow`. Ποτέ ανάποδα. Ο κανόνας της
 * μίας γραμμής δεν επιτρέπεται να μάθει τι είναι η αναδίπλωση — αλλιώς τα δύο αρχεία γίνονται
 * ένα με δύο ονόματα, και ο κύκλος εισαγωγών που περιγράφει το `table-cell-content.ts`
 * ξαναγράφεται εδώ.
 *
 * ⚠️ **ΔΕΝ είναι το `table-cell-content.ts`** (γειτονικό αρχείο, ΑΛΛΟ ερώτημα): εκείνο απαντά
 * «**τι έχει και πώς αλλάζει** ένα κελί» στο **μοντέλο** (ανάγνωση/αμετάβλητη εγγραφή)· εδώ
 * τίποτα δεν γράφεται — μόνο υπολογίζεται τι **φαίνεται**.
 *
 * @module subapps/dxf-viewer/bim/table/table-cell-visible-lines
 * @see bim/table/table-cell-overflow.ts — ο κανόνας της **μίας** γραμμής (Γ1)
 * @see bim/text/text-wrap-lines.ts — ο ΕΝΑΣ βρόχος αναδίπλωσης + η ισορρόπηση
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §58
 */

import type { TableCellOverflow } from '../../types/table';
import { wrapTextToLines } from '../text/text-wrap-lines';
import { sliceCellTextRuns } from './table-cell-run-ops';
import { styledPrefixWidthMm } from './table-cell-styled-spans';
import {
  cellStyledSpansOf,
  resolveVisibleCellText,
  type CellTextFitInput,
  type VisibleCellText,
} from './table-cell-overflow';

/** Μία **οπτική γραμμή** ενός κελιού, μαζί με το πού αρχίζει στο ακέραιο κείμενο. */
export interface VisibleCellLine extends VisibleCellText {
  /**
   * Ο δείκτης του πρώτου χαρακτήρα στο **ακέραιο** κείμενο του κελιού.
   *
   * 🔴 Χωρίς αυτόν οι **διευθύνσεις** (ADR-751) δεν μπορούν να τοποθετηθούν σε αναδιπλωμένο
   * κελί: ο ανιχνευτής τρέχει πάνω στο ακέραιο κείμενο (ώστε ένα κομμένο e-mail να οδηγεί
   * στο πλήρες), οπότε κάποιος πρέπει να ξέρει ποιο κομμάτι του βλέπει κάθε γραμμή.
   * `0` για μονογραμμικά κελιά — δηλαδή για κάθε πίνακα που υπάρχει σήμερα.
   */
  readonly start: number;
}

/**
 * Ό,τι **φαίνεται** σε ένα κελί: μία γραμμή για `clip`/`shrink`, N για `wrap`.
 *
 * Είναι η **μία** δημόσια απάντηση στο «τι ζωγραφίζεται εδώ». Το `resolveVisibleCellText`
 * μένει εξαγόμενο γιατί απαντά σε **στενότερη** ερώτηση (μία γραμμή) και το δηλώνει στον
 * τύπο του — δεν είναι δεύτερη είσοδος στο ίδιο πρόβλημα.
 */
export interface VisibleCellContent {
  /** Οι ορατές γραμμές, με τη σειρά. **Κενός πίνακας** για κενό κελί — ποτέ μία κενή γραμμή. */
  readonly lines: readonly VisibleCellLine[];
  /** Ο συντελεστής σμίκρυνσης — **ένας για όλο το κελί**, ποτέ ανά γραμμή. */
  readonly heightScale: number;
}

const NO_CONTENT: VisibleCellContent = { lines: [], heightScale: 1 };

/** Ό,τι χρειάζεται η απόφαση για **ολόκληρο** το περιεχόμενο του κελιού. */
export interface CellContentFitInput extends Omit<CellTextFitInput, 'overflow'> {
  readonly overflow: TableCellOverflow;
  /**
   * Πάνω φράγμα οπτικών γραμμών όταν το κελί αναδιπλώνεται. Απόν ⇒ χωρίς όριο πέρα από την
   * άμυνα του `wrapTextToLines`.
   *
   * Το δίνει ο καλών όταν το ύψος της γραμμής είναι **καρφωμένο**: τότε ό,τι δεν χωρά
   * κατακόρυφα δεν έχει νόημα να υπολογιστεί, και — κυρίως — δεν πρέπει να ζωγραφιστεί έξω
   * από το κελί. Δες `table-layout-place.ts`.
   */
  readonly maxLines?: number;
}

/**
 * 🔴 ADR-739 §58 Γ2 — **το ορατό περιεχόμενο ενός κελιού.** Η μία είσοδος για τα τέσσερα
 * backends.
 *
 * ## Γιατί η αναδίπλωση ΔΕΝ περικόπτει οριζόντια
 * Στο `'wrap'` το κείμενο σπάει αντί να κοπεί, οπότε ο δείκτης «…» δεν εμφανίζεται **ποτέ**
 * από πλάτος. Εμφανίζεται μόνο όταν το ύψος είναι **καρφωμένο** και οι γραμμές δεν χωρούν —
 * και τότε είναι η σωστή ένδειξη, στην **τελευταία** ορατή γραμμή: εκεί ακριβώς σταματά ό,τι
 * βλέπει ο αναγνώστης του σχεδίου.
 *
 * ## Η αναλλοίωτη που κρατά τα σημερινά αρχεία ανέπαφα
 * Για `'clip'` και `'shrink'` επιστρέφεται **ακριβώς μία** γραμμή, παραγόμενη από την ίδια
 * `resolveVisibleCellText` που υπήρχε πριν — byte-για-byte η σημερινή απόφαση.
 */
export function resolveVisibleCellContent(input: CellContentFitInput): VisibleCellContent {
  if (!input.text) return NO_CONTENT;
  if (input.overflow !== 'wrap') {
    const single = resolveVisibleCellText({ ...input, overflow: input.overflow });
    return single.text || single.clipped
      ? { lines: [{ ...single, start: 0 }], heightScale: single.heightScale }
      : NO_CONTENT;
  }
  return wrapToFit(input);
}

/**
 * ADR-739 §58 Γ2 — η **αναδίπλωση**: το κείμενο σπασμένο σε γραμμές που χωρούν στο πλάτος.
 *
 * 🔴 **Ο βρόχος δεν είναι εδώ.** Ζει στο `bim/text/text-wrap-lines.ts` μαζί με την
 * ισορρόπηση, και αυτό το module του δίνει μόνο ό,τι ξέρει μόνο αυτό: πώς μετριέται ένα
 * **ετερογενές** εύρος (ADR-753). Ένα δεύτερο `while` εδώ θα ήταν το τρίτο αντίγραφο του
 * ίδιου σχήματος (N.18 / CHECK 3.28).
 *
 * Ο μετρητής εύρους είναι η διαφορά δύο **μετρημένων προθεμάτων** — η ίδια πράξη που ήδη
 * τοποθετεί τους συνδέσμους (`styledPrefixWidthMm`). Το kerning διατηρείται μέσα σε κάθε
 * ομοιογενές τμήμα και χάνεται μόνο στα όρια, ακριβώς όπως δηλώνει το
 * `table-cell-styled-spans.ts`: καμία υλοποίηση δεν μπορεί να το ανακτήσει, γιατί δύο
 * `fillText` με άλλη γραμματοσειρά δεν έχουν κοινό ζεύγος.
 */
function wrapToFit(input: CellContentFitInput): VisibleCellContent {
  const full = cellStyledSpansOf(input, input.text, input.text.length);
  const wrapped = wrapTextToLines({
    text: input.text,
    availableWidth: input.availableWidthMm,
    rangeWidth: (from, to) =>
      styledPrefixWidthMm(full, to, input.measure) - styledPrefixWidthMm(full, from, input.measure),
    ...(input.maxLines !== undefined && { maxLines: input.maxLines }),
  });

  const lines = wrapped.map((line, index) => {
    // 🔴 Η **τελευταία** γραμμή, όταν το φράγμα ύψους έκοψε περιεχόμενο, δεν δείχνει το δικό
    // της κομμάτι αλλά **ό,τι χωράει από ΟΛΟ το υπόλοιπο** — με τον δείκτη «…». Αλλιώς ο
    // αναγνώστης του σχεδίου δεν έχει κανένα σημάδι ότι το κελί κρύβει κείμενο, που είναι
    // ακριβώς η αστοχία για την οποία υπάρχει το `CELL_CLIP_ELLIPSIS`.
    const truncated = index === wrapped.length - 1 && line.end < input.text.length;
    const from = line.start;
    const to = truncated ? input.text.length : line.end;

    const single = resolveVisibleCellText({
      ...input,
      text: truncated ? input.text.slice(from) : line.text,
      // Ο ΙΔΙΟΣ κανόνας περικοπής — δεν υπάρχει δεύτερος τρόπος να μπει ένας δείκτης.
      overflow: 'clip',
      runs: sliceCellTextRuns(input.runs, from, to),
      // Ένας αριθμός δεν αναδιπλώνεται ποτέ σε πολλές γραμμές· ένα «####» πάνω σε κομμάτι
      // κειμένου θα ήταν ανοησία.
      numeric: false,
      // 🔴 Μη περικομμένη γραμμή: **καμία δεύτερη κρίση χωρητικότητας.** Το «χωράει;» το
      // απάντησε ήδη ο βρόχος αναδίπλωσης, μετρώντας εύρη του **ίδιου** αλφαριθμητικού. Μια
      // επαναμέτρηση της γραμμής ως αυτόνομου string είναι **άλλη πράξη** (χάνει τα ζεύγη
      // kerning στα άκρα) και μπορεί να πει «δεν χωρά» για γραμμή που μόλις χώρεσε — δηλαδή
      // ένα «…» που εμφανίζεται από στρογγυλοποίηση. Δύο όργανα, ένα ερώτημα: απαγορευμένο.
      availableWidthMm: truncated ? input.availableWidthMm : Number.POSITIVE_INFINITY,
    });
    return { ...single, start: from };
  });

  return { lines, heightScale: 1 };
}
