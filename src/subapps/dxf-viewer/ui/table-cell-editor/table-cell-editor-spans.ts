/**
 * 🔴 ADR-753 §28 — **ΤΟ ΚΕΙΜΕΝΟ ΠΟΥ ΓΡΑΦΕΤΑΙ ΤΩΡΑ, ΣΠΑΣΜΕΝΟ ΣΕ ΒΑΜΜΕΝΑ ΤΜΗΜΑΤΑ.**
 *
 * Καθαρή συνάρτηση: παίρνει το **πρόχειρο**, το δεσμευμένο κείμενο, τα `runs` του κελιού και
 * το επιλυμένο στυλ του — και επιστρέφει τι πρέπει να δείχνει ο επεξεργαστής. Μηδέν DOM,
 * μηδέν store, μηδέν React.
 *
 * ## 🔴 Η ΑΝΑΛΛΟΙΩΤΗ ΠΟΥ ΚΡΑΤΑ ΤΑ ΚΕΡΔΙΣΜΕΝΑ: το τμήμα λέει **μόνο ό,τι διαφέρει**
 *
 * Κάθε ιδιότητα **που κληρονομείται** παραλείπεται όταν συμπίπτει με το στυλ του κελιού
 * (η υπογράμμιση δεν κληρονομείται — δες {@link spanCssDelta}). Η συνέπεια είναι δομική, όχι
 * αισθητική: ένα κελί **χωρίς καμία** μορφοποίηση ανά χαρακτήρα παράγει **ένα** τμήμα που
 * δεν αγγίζει ούτε γραμματοσειρά ούτε μέγεθος ούτε μελάνι, δηλαδή ο επεξεργαστής ζωγραφίζει
 * ό,τι ακριβώς ζωγράφιζε το ενιαίο `textarea` — **ίδια θέση κάθε glyph**.
 *
 * Άρα η αλλαγή του §28 **δεν μπορεί** να μετακινήσει κείμενο σε κανένα από τα κελιά που
 * υπάρχουν σήμερα. Είναι ο ίδιος εκφυλισμός που κρατά το ADR-751 ανέπαφο στη μεριά του καμβά
 * (δες `table-cell-styled-spans.ts`), εφαρμοσμένος στη μεριά του DOM.
 *
 * ## 🔴 ΓΙΑΤΙ ΤΟ ΜΕΓΕΘΟΣ ΤΑΞΙΔΕΥΕΙ ΩΣ **ΛΟΓΟΣ** ΚΑΙ ΟΧΙ ΩΣ px
 *
 * Ο επεξεργαστής ζουμάρει μαζί με τον καμβά (ADR-739 Φ.Δ βήμα 3): σε κάθε καρέ zoom αλλάζει
 * το px μέγεθος της γραμματοσειράς. Αν το τμήμα δήλωνε `fontSize: '18px'`, κάθε καρέ θα
 * απαιτούσε **νέο render** ενός πεδίου κειμένου με ενεργό δρομέα — ακριβώς η συνδρομή που
 * απαγορεύει ο ADR-040.
 *
 * Το μέγεθος του **κελιού** ταξιδεύει ήδη ζωντανά ως custom property
 * ({@link TABLE_CELL_EDITOR_VARS.fontSize}, γραμμένη επιτακτικά σε κάθε tick). Ο **λόγος**
 * `ύψος τμήματος / ύψος κελιού` είναι καθαρός αριθμός του μοντέλου, ανεξάρτητος από zoom.
 * Άρα `calc(var(--tce-em) * λόγος)` δίνει σωστό μέγεθος σε **κάθε** κλίμακα με **μηδέν**
 * re-render — δομικά, όχι κατά τύχη.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-cell-editor-spans
 * @see bim/table/table-cell-typography-ranges.ts — η ΜΙΑ διαμέριση, κοινή με τον καμβά
 * @see bim/table/table-cell-run-ops.ts — `remapCellTextRuns`, ο ΕΝΑΣ κανόνας μετατόπισης
 * @see docs/centralized-systems/reference/adrs/ADR-753-table-cell-rich-text.md §28
 */

import type React from 'react';
import {
  cellTypographyRanges,
  type TableSpanTypography,
} from '../../bim/table/table-cell-typography-ranges';
import { remapCellTextRuns } from '../../bim/table/table-cell-run-ops';
// 🔴 ADR-786 §4 (γ) — «ποιο face ζωγραφίζει πράγματι αυτή η τυπογραφία;». Το τμήμα οφείλει να
// ρωτήσει το **ίδιο** που ρωτά ο καμβάς: η υποκατάσταση (`arial → Liberation Sans`) και η
// πτώση στο tier CSS (έντονα/πλάγια) αλλάζουν **και** το όνομα οικογένειας **και** το em.
import { tableTextFace, type TableTextFace } from '../../bim/table/table-text-font';
import type { TableCellStyle } from '../../bim/table/table-style';
import type { TableCellTextRun } from '../../types/table';
import { TABLE_CELL_EDITOR_VARS } from './table-cell-editor-vars';

/** Ένα βαμμένο τμήμα του προχείρου, έτοιμο για DOM. */
export interface TableCellEditorSpan {
  readonly text: string;
  /**
   * Ό,τι **διαφέρει** από το στυλ του κελιού, συν την υπογράμμιση που δηλώνεται πάντα.
   *
   * Δεν είναι βελτιστοποίηση: δες την αναλλοίωτη στην κεφαλίδα. Ένα «πλήρες» στυλ σε κάθε
   * τμήμα θα ξανάγραφε τη γραμματοσειρά του κελιού με **δικά μας** νούμερα, δηλαδή θα
   * εισήγαγε δεύτερη διαδρομή για μια τιμή που ήδη κληρονομείται σωστά.
   */
  readonly style: React.CSSProperties;
}

export interface TableCellEditorSpansInput {
  /** Το κείμενο που βλέπει **αυτή τη στιγμή** ο χρήστης στο πεδίο. */
  readonly draft: string;
  /**
   * Το **δεσμευμένο** κείμενο του κελιού — η βάση πάνω στην οποία μετρήθηκαν τα {@link runs}.
   *
   * Ταξιδεύει μαζί τους και δεν είναι προαιρετικό: δύο δείκτες δεν μπορούν να πουν αν
   * δείχνουν ακόμη στα ίδια γράμματα (ADR-753 §25 / ADR-769).
   */
  readonly committedText: string;
  /** Τα runs του μοντέλου, σε δείκτες του {@link committedText}. */
  readonly runs?: readonly TableCellTextRun[];
  /** Το **επιλυμένο** στυλ του κελιού — η βάση κάθε κληρονομιάς. */
  readonly style: TableCellStyle;
}

/**
 * Τα τμήματα που πρέπει να ζωγραφιστούν μέσα στον επεξεργαστή.
 *
 * ## 🔴 Γιατί τα runs **μετατοπίζονται** πρώτα
 * Τα `runs` δείχνουν σε θέσεις του **δεσμευμένου** κειμένου. Όσο ο χρήστης πληκτρολογεί, το
 * πρόχειρο αποκλίνει — και ένα «έντονο» στους χαρακτήρες 3-5 του παλιού κειμένου βάφει
 * **άλλα γράμματα** του νέου. Ο κανόνας μετατόπισης δεν επινοείται εδώ: είναι ο **ίδιος**
 * {@link remapCellTextRuns} που θα τρέξει και στη δέσμευση.
 *
 * Αυτό είναι το ουσιώδες, όχι η ορθότητα των δεικτών: ο χρήστης βλέπει **ακριβώς** ό,τι θα
 * αποθηκευτεί όταν πατήσει `Enter`. Μια δεύτερη, «ζωντανή» ερμηνεία θα ήταν δεύτερη αλήθεια
 * για το ίδιο κείμενο (ADR-749) — και θα φαινόταν ως μορφοποίηση που **μετακινείται** τη
 * στιγμή της δέσμευσης.
 *
 * Πάντα **τουλάχιστον ένα** τμήμα, ακόμη και σε κενό πρόχειρο: ο επεξεργαστής χρειάζεται
 * κόμβο κειμένου για να στηθεί ο δρομέας, και ένα κενό `span` είναι ο μόνος τρόπος να
 * υπάρχει θέση `0` σε άδειο κελί.
 */
export function tableCellEditorSpans(
  input: TableCellEditorSpansInput,
): readonly TableCellEditorSpan[] {
  const { draft, committedText, style } = input;
  const runs = remapCellTextRuns(input.runs, committedText, draft);
  const ranges = cellTypographyRanges({ textLength: draft.length, runs, style });
  if (ranges.length === 0) return [{ text: '', style: {} }];

  return ranges.map((range) => ({
    text: draft.slice(range.start, range.end),
    style: spanCssDelta(range.typography, style),
  }));
}

/**
 * Ό,τι πρέπει να **ξαναδηλωθεί** επειδή διαφέρει από το κελί.
 *
 * ## 🔴 Η ΥΠΟΓΡΑΜΜΙΣΗ ΕΙΝΑΙ Η ΜΙΑ ΕΞΑΙΡΕΣΗ, ΚΑΙ ΤΗΝ ΕΠΙΒΑΛΛΕΙ ΤΟ CSS
 * Το `text-decoration` **δεν κληρονομείται με τη συνήθη έννοια**: ο γονέας το ζωγραφίζει σε
 * ολόκληρο το πλάτος του, **περνώντας από πάνω** από τα παιδιά, και κανένα παιδί δεν μπορεί
 * να το σβήσει από κάτω του (CSS Text Decoration, «decorations propagate to in-flow
 * descendants»). Άρα το «δηλώνω μόνο ό,τι διαφέρει» **δεν λειτουργεί** εδώ: ένα μη
 * υπογραμμισμένο τμήμα μέσα σε υπογραμμισμένο κελί θα έβγαινε υπογραμμισμένο ό,τι κι αν
 * δήλωνε.
 *
 * Η λύση είναι να **μην ζωγραφίζει ποτέ ο γονέας** και να το δηλώνουν **πάντα** τα τμήματα —
 * ένας κανόνας, καμία ειδική περίπτωση, καμία εξάρτηση από το τι έτυχε να έχει το κελί. Δες
 * το `textDecoration: 'none'` του {@link TABLE_CELL_RICH_STYLE}: τα δύο είναι **ένα** ζεύγος
 * και δεν επιτρέπεται να αλλάξει μόνο το ένα.
 */
function spanCssDelta(
  typography: TableSpanTypography,
  cell: TableCellStyle,
): React.CSSProperties {
  const css: React.CSSProperties = {
    textDecoration: typography.underline ? 'underline' : 'none',
  };
  if (typography.colorHex !== cell.textColorHex) css.color = typography.colorHex;

  // 🔴 ADR-786 §4 (γ) — **η σύγκριση γίνεται στο face που ΘΑ ΖΩΓΡΑΦΙΣΤΕΙ, όχι στο αιτούμενο.**
  // Δύο τμήματα που ζητούν `arial` και `verdana` καταλήγουν και τα δύο στο ίδιο υποκατάστατο
  // (catch-all `'*' → Liberation Sans`), οπότε μια σύγκριση ωμών ονομάτων θα δήλωνε διαφορά που
  // ο καμβάς **δεν** ζωγραφίζει. Και αντίστροφα: ένα **έντονο** τμήμα πέφτει στο tier CSS
  // (δεν υπάρχει bundled bold face), άρα ζωγραφίζεται με **άλλη οικογένεια** από το κελί δίπλα
  // του χωρίς να έχει αλλάξει καμία οικογένεια — διαφορά αόρατη στα ωμά ονόματα.
  const span = tableTextFace(typography.bold, typography.italic, typography.fontFamily);
  const base = tableTextFace(cell.bold, cell.italic, cell.fontFamily);
  if (span.cssFamily !== base.cssFamily) css.fontFamily = span.cssFamily;
  if (span.cssBold !== base.cssBold) css.fontWeight = span.cssBold ? 'bold' : 'normal';
  if (span.cssItalic !== base.cssItalic) css.fontStyle = span.cssItalic ? 'italic' : 'normal';

  const ratio = fontSizeRatio(typography.heightMm, cell.textHeightMm, span, base);
  if (ratio !== null) css.fontSize = `calc(var(${TABLE_CELL_EDITOR_VARS.fontSize}) * ${ratio})`;
  return css;
}

/**
 * 🔴 ADR-753 §28 — **Η ΠΛΑΤΥΤΕΡΗ ΤΥΠΟΓΡΑΦΙΑ ΤΟΥ ΚΕΛΙΟΥ**: ό,τι πρέπει να υποθέσει ο
 * υπολογισμός του κουτιού για να μην κοπεί ποτέ κείμενο.
 *
 * ## Γιατί χρειάζεται — και γιατί η απάντηση είναι «το χειρότερο», όχι «το ακριβές»
 * Το κουτί του επεξεργαστή μεγαλώνει και αναδιπλώνει ρωτώντας έναν μετρητή `(κείμενο) → px`
 * (ADR-739 Φ.Δ βήμα 6). Ο μετρητής αυτός δέχεται **σκέτη συμβολοσειρά**, χωρίς θέση: ο
 * χάρακας της αναδίπλωσης του δίνει **ουρές** του κειμένου, όχι προθέματα. Άρα δεν μπορεί —
 * δομικά — να ξέρει ποια τμήματα αγγίζει, και μια «rich» μέτρηση εκεί θα απαιτούσε να
 * ξαναγραφεί ο χάρακας σε δείκτες. Δεν αξίζει, και δεν χρειάζεται.
 *
 * Αντ' αυτού μετριέται με τη **βαρύτερη και μεγαλύτερη** τυπογραφία που εμφανίζεται στο
 * κείμενο. Το κουτί βγαίνει τότε **πάντα ≥** του πραγματικού: το σφάλμα γίνεται μονόπλευρο
 * και ακίνδυνο — περισσεύει λίγος χώρος όταν το κελί έχει ανάμεικτα μεγέθη, ποτέ δεν κόβεται
 * γράμμα. Είναι **ακριβώς** το επιχείρημα του `WRAP_SAFETY_PX` δίπλα
 * ({@link import('./table-cell-editor-expansion')}), εφαρμοσμένο στην τυπογραφία αντί για τα
 * υποδιαιρετικά px: *υπολόγισε με το χειρότερο, και η αστοχία δεν μπορεί να είναι επικίνδυνη*.
 *
 * Επιστρέφει `null` όταν κανένα τμήμα δεν ξεπερνά το κελί — τότε ο σημερινός μετρητής είναι
 * **ακριβής**, όχι απλώς επαρκής, και δεν αλλάζει τίποτα για κανέναν υπάρχοντα πίνακα.
 */
export function widestCellTypography(
  input: TableCellEditorSpansInput,
): { readonly heightMm: number; readonly bold: boolean; readonly fontFamily?: string } | null {
  const { draft, committedText, style } = input;
  // ⚠️ Καλείται από το `projectBox()`, δηλαδή **σε κάθε καρέ zoom**. Χωρίς runs η απάντηση
  // είναι γνωστή χωρίς καμία δουλειά — κάθε τμήμα έχει την τυπογραφία του κελιού — και αυτή
  // είναι η συντριπτικά συνηθέστερη περίπτωση. Ο ADR-735 τιμώρησε ακριβώς το αντίθετο.
  if (!input.runs || input.runs.length === 0) return null;

  const runs = remapCellTextRuns(input.runs, committedText, draft);
  const ranges = cellTypographyRanges({ textLength: draft.length, runs, style });

  let heightMm = style.textHeightMm;
  let bold = style.bold;
  let fontFamily = style.fontFamily;
  let widened = false;
  for (const { typography } of ranges) {
    if (typography.heightMm > heightMm) {
      heightMm = typography.heightMm;
      widened = true;
    }
    if (typography.bold && !bold) {
      bold = true;
      widened = true;
    }
    // Άλλη οικογένεια **δεν** συγκρίνεται σε πλάτος — δεν υπάρχει διάταξη γραμματοσειρών. Η
    // παρουσία της όμως αρκεί για να μη θεωρηθεί ακριβής ο μετρητής του κελιού, οπότε
    // κρατιέται η **πρώτη** που διαφέρει: μια αυθαίρετη αλλά ρητή επιλογή, καλύτερη από τη
    // σιωπηλή υπόθεση ότι όλες οι οικογένειες μετρούν το ίδιο.
    if (typography.fontFamily !== fontFamily && !widened) {
      fontFamily = typography.fontFamily;
      widened = true;
    }
  }
  return widened ? { heightMm, bold, ...(fontFamily !== undefined && { fontFamily }) } : null;
}

/**
 * Ο λόγος **em τμήματος ÷ em κελιού**· `null` όταν δεν χρειάζεται δήλωση.
 *
 * 🔴 **ADR-786 §4 (γ) — ΔΕΝ είναι ο λόγος των υψών.** Η custom property `--tce-em` κουβαλά
 * πλέον **em** (όχι ύψος κεφαλαίου), και το em ενός ύψους εξαρτάται από το **face**:
 *
 * ```
 *   em = ύψος κεφαλαίου × emPerCap(face)
 *   λόγος = (h_τμήματος × emPerCap_τμήματος) ÷ (h_κελιού × emPerCap_κελιού)
 * ```
 *
 * Με **ίδιο** face οι δύο συντελεστές απλοποιούνται και μένει ο σκέτος λόγος υψών — δηλαδή η
 * σημερινή συμπεριφορά, ακέραιη, για κάθε τμήμα που αλλάζει μόνο μέγεθος. Όταν όμως το τμήμα
 * αλλάζει **tier** (ένα έντονο τμήμα μέσα σε κανονικό κελί πέφτει στο CSS ενώ το κελί
 * ζωγραφίζεται με opentype), οι συντελεστές διαφέρουν κατά ~1,4 και ο σκέτος λόγος υψών θα
 * έδινε γράμματα **40% λάθος** — ορατά, στο ίδιο κουτί με τα σωστά.
 *
 * ⚠️ Ο έλεγχος `> 0` στο ύψος του κελιού δεν είναι ευλάβεια: ένα αποθηκευμένο αρχείο από
 * χέρι, ή ένα preset υπό κατασκευή, μπορεί να δώσει μηδέν — και μια διαίρεση εκεί θα έδινε
 * `Infinity` μέσα σε `calc()`, δηλαδή τμήμα **χωρίς μέγεθος** που ο browser αγνοεί σιωπηλά.
 * Πέφτοντας στην κληρονομιά, το χειρότερο που συμβαίνει είναι «το μέγεθος του κελιού».
 */
function fontSizeRatio(
  spanHeightMm: number,
  cellHeightMm: number,
  span: TableTextFace,
  base: TableTextFace,
): number | null {
  const denominator = cellHeightMm * base.emPerCap;
  if (!(denominator > 0) || !Number.isFinite(spanHeightMm)) return null;
  const ratio = (spanHeightMm * span.emPerCap) / denominator;
  return ratio === 1 ? null : ratio;
}
