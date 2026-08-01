/**
 * ADR-739 Φ.Δ βήμα 6 — **πόσο μεγάλο πρέπει να γίνει το κουτί επεξεργασίας**, και πού
 * ακριβώς θα κοπεί το κείμενο όταν τυπωθεί.
 *
 * ## Το πρόβλημα (μετρημένο στο βήμα 5)
 * Το βήμα 5 όρισε πού τελειώνει το **ορατό** κείμενο ενός κελιού. Άρα γεννήθηκε κατάσταση
 * όπου ο χρήστης βλέπει λιγότερα απ' όσα έχει γράψει — και μπαίνοντας να διορθώσει, το
 * `<textarea>` **έχει** όλο το κείμενο αλλά **δείχνει** όσο χωρά σε πλάτος 3 εκατοστών.
 * Η λύση είναι 30 ετών και λέγεται Excel: το πλαίσιο επεξεργασίας μεγαλώνει και σκεπάζει
 * τα διπλανά κελιά όσο γράφεις, και επανέρχεται στο commit.
 *
 * ## 🔴 ΠΟΙΟΝ ΜΕΤΡΗΤΗ ΡΩΤΑ — ρητή απόφαση, και είναι ο **ΑΛΛΟΣ** από του βήματος 5
 * Ο πίνακας έχει **δύο** μετρητές κειμένου (χρέος ήδη καταγραμμένο, ADR-739 §21.8):
 *   - `measureTextAdvanceWorld` (opentype, τιμά το `fontFamily`) → **η διάταξη**, σε mm·
 *   - `ctx.measureText` με `tableCellFont(...)` → **ο καμβάς και το DOM**, σε px.
 *
 * Το βήμα 5 διάλεξε ρητά τον **πρώτο**, γιατί η περικοπή πρέπει να ισχύει και σε PDF/DXF
 * όπου δεν υπάρχει `ctx`. Το βήμα 6 διαλέγει εξίσου ρητά τον **δεύτερο** — και **δεν είναι
 * ασυνέπεια, είναι άλλη ερώτηση**: «πόσο πλατύ πρέπει να γίνει το κουτί» είναι ερώτηση για
 * το τι **ζωγραφίζει ο browser μέσα στο `<textarea>`**. Αν απαντούσε ο μετρητής της
 * διάταξης, το κουτί θα ήταν συστηματικά λίγο μικρό ή μεγάλο και το κείμενο θα σκρόλαρε
 * μέσα του **παρότι «χώρεσε»** — δηλαδή θα ξαναφέρναμε ακριβώς το ελάττωμα που λύνουμε.
 *
 * ⚠️ Ο **δείκτης κοπής** ({@link CellEditorExpansion.clipMarkerPx}) πληρώνει το τίμημα αυτής
 * της επιλογής: υπολογίζεται με τον px μετρητή ενώ η **πραγματική** κοπή αποφασίζεται σε mm.
 * Όσο ο καμβάς ζωγραφίζει `'arial'` και ο μετρητής της διάταξης τιμά το `fontFamily` (§21.8),
 * σε κελί με **άλλη** γραμματοσειρά ο δείκτης μπορεί να πέσει κατά έναν χαρακτήρα δίπλα.
 * Δηλωμένο, όχι κρυμμένο· με το σημερινό preset (ίδια οικογένεια) η απόκλιση είναι μηδενική.
 *
 * ## Τι ΔΕΝ κάνει
 * **Δεν αγγίζει ούτε τη διάταξη ούτε το μοντέλο.** Η επέκταση είναι αποκλειστικά κατάσταση
 * διεπαφής: μετά το commit ο πίνακας ξαναδείχνει κομμένο. Αν βρεθεί επέκταση να επηρεάζει
 * τη διάταξη, έχει σπάσει το βήμα 5.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-cell-editor-expansion
 * @see bim/text/text-fit.ts — ο ΕΝΑΣ χάρακας «πόσο χωρά», με ενεθειμένο μετρητή
 * @see bim/table/table-cell-overflow.ts — ο κανόνας περικοπής του βήματος 5 (σε mm)
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §24
 */

import { fittingPrefixLengthByChar, fittingPrefixLengthByWord, type TextWidthMeasure } from '../../bim/text/text-fit';
import { CELL_CLIP_ELLIPSIS } from '../../bim/table/table-cell-overflow';

/**
 * Πόσα px αφαιρούνται από το διαθέσιμο πλάτος **μόνο** κατά τον υπολογισμό της αναδίπλωσης.
 *
 * 🔴 Δεν είναι μαγικός αριθμός — είναι η **φορά του σφάλματος**. Την τελική αναδίπλωση την
 * κάνει ο browser μέσα στο `<textarea>`, με τα δικά του υποδιαιρετικά px και το δικό του
 * kerning· εμείς απλώς προβλέπουμε **πόσες γραμμές** θα βγουν για να δώσουμε ύψος. Αν
 * πέσουμε έξω προς τα κάτω, η τελευταία γραμμή κόβεται και ο χρήστης ξαναγράφει στα τυφλά —
 * ακριβώς το ελάττωμα που λύνουμε. Αν πέσουμε έξω προς τα πάνω, περισσεύει μια άδεια γραμμή.
 * Υπολογίζοντας με **ένα px λιγότερο** από όσο θα έχει ο browser, εξασφαλίζουμε ότι εμείς
 * αναδιπλώνουμε **το αργότερο** όποτε αναδιπλώνει κι εκείνος: το σφάλμα γίνεται μονόπλευρο
 * και ακίνδυνο, εξ ορισμού και όχι κατά τύχη.
 */
const WRAP_SAFETY_PX = 1;

/** Πάνω φράγμα γραμμών — παθολογικό πλάτος δεν γεννά βρόχο χιλιάδων επαναλήψεων. */
const MAX_WRAPPED_LINES = 64;

/** Ό,τι χρειάζεται η απόφαση. Καθαρές τιμές: καμία γνώση DOM, store ή σκηνής. */
export interface CellEditorExpansionInput {
  /** Το **πρόχειρο** — ό,τι βλέπει τώρα ο χρήστης, όχι το κείμενο του μοντέλου. */
  readonly text: string;
  /** Ωφέλιμο πλάτος του κελιού σε px = πλάτος κελιού μείον τα δύο οριζόντια περιθώρια. */
  readonly cellContentWidthPx: number;
  /**
   * Πόσο μπορεί να απλωθεί το περιεχόμενο πριν αναγκαστεί να αναδιπλωθεί (px).
   *
   * Είναι η απόσταση από την άγκυρα του κελιού μέχρι την άκρη του παραθύρου **κατά μήκος
   * της κατεύθυνσης επέκτασης** — γι' αυτό δίνεται έτοιμη: μόνο ο καλών ξέρει πού κάθεται
   * το κελί στην οθόνη και πόσο γυρισμένος είναι ο πίνακας.
   */
  readonly maxContentWidthPx: number;
  /** Μετρητής **px του browser** με τη γραμματοσειρά που θα ζωγραφιστεί. Δες την κεφαλίδα. */
  readonly measure: TextWidthMeasure;
}

/** Το κουτί που ζητά το κείμενο, μαζί με το πού θα κοπεί όταν τυπωθεί. */
export interface CellEditorExpansion {
  /** Ωφέλιμο πλάτος του **επεκτεταμένου** κουτιού (px) — ποτέ μικρότερο από το κελί. */
  readonly contentWidthPx: number;
  /** Πόσες οπτικές γραμμές θα χρειαστεί το κείμενο σε αυτό το πλάτος. `1` όταν χωρά. */
  readonly lines: number;
  /** `true` όταν το κουτί είναι όντως μεγαλύτερο από το κελί (πλάτος **ή** γραμμές). */
  readonly expanded: boolean;
  /**
   * Πόσα px από την αρχή του κειμένου θα επιβιώσουν στην εκτύπωση — δηλαδή **πού μπαίνει η
   * κατακόρυφη γραμμή** που δείχνει το όριο του κελιού.
   *
   * `undefined` όταν δεν κόβεται τίποτα (τότε δεν υπάρχει τίποτα να δειχθεί).
   *
   * 🔴 Είναι η πληροφορία που **λείπει από όλους τους μεγάλους**: το Excel, το Google Sheets
   * και ο in-place editor του AutoCAD σου δείχνουν το πλήρες κείμενο ενώ γράφεις, αλλά
   * κανένα δεν σου λέει **τι θα τυπωθεί**. Σε φύλλο υπολογισμού αυτό είναι ανεκτό — έχεις
   * γραμμή τύπων. Σε εργαλείο **εκτυπώσιμων σχεδίων** είναι ακριβώς η ερώτηση του χρήστη.
   */
  readonly clipMarkerPx?: number;
}

/**
 * Πόσο μακριά φτάνει μια ακτίνα από το `anchor` προς την κατεύθυνση `(dx, dy)` πριν βγει από
 * το παράθυρο. Παράλληλη προς άξονα κατεύθυνση αγνοεί εκείνον τον άξονα (καμία τομή).
 */
function roomAlong(
  anchor: { readonly x: number; readonly y: number },
  dx: number,
  dy: number,
  viewport: { readonly width: number; readonly height: number },
): number {
  const EPS = 1e-6;
  let t = Number.POSITIVE_INFINITY;
  if (dx > EPS) t = Math.min(t, (viewport.width - anchor.x) / dx);
  else if (dx < -EPS) t = Math.min(t, anchor.x / -dx);
  if (dy > EPS) t = Math.min(t, (viewport.height - anchor.y) / dy);
  else if (dy < -EPS) t = Math.min(t, anchor.y / -dy);
  return Math.max(Number.isFinite(t) ? t : viewport.width, 0);
}

/**
 * Πόσο πλατύ επιτρέπεται να γίνει το κουτί πριν αναγκαστεί να αναδιπλώσει — **μετρημένο κατά
 * μήκος της γραμμής του πίνακα**, όχι οριζόντια στην οθόνη.
 *
 * 🔴 Η διάκριση είναι όλη η ουσία σε **στραμμένο** πίνακα: η κατεύθυνση επέκτασης είναι ο
 * τοπικός άξονας x του κελιού, δηλαδή `(cos θ, sin θ)`. Ένας υπολογισμός «πλάτος παραθύρου
 * μείον x» θα ήταν σωστός μόνο για γωνία μηδέν — και θα φαινόταν σωστός σε **κάθε** test που
 * δεν στρίβει τον πίνακα.
 *
 * Η στοίχιση καθορίζει **ποια** απόσταση μετρά, γιατί αυτή καθορίζει και προς τα πού
 * μεγαλώνει το κουτί (δες `growthOffsetPx`): δεξιά στοίχιση ξοδεύει τον χώρο **πίσω** από την
 * άγκυρα, κεντρική ξοδεύει και από τις δύο μεριές, άρα περιορίζεται από τη **στενότερη**.
 */
export function editorGrowthCeilingPx(params: {
  readonly anchor: { readonly x: number; readonly y: number } | null;
  readonly rotationRad: number;
  readonly cellWidthPx: number;
  readonly growsFrom: 'left' | 'right' | 'center';
  readonly viewport: { readonly width: number; readonly height: number };
}): number {
  const { anchor, rotationRad, cellWidthPx, growsFrom, viewport } = params;
  // Χωρίς προβολή (άγκυρο εκτός οθόνης) το κουτί κρατιέται στην τελευταία έγκυρη θέση του:
  // το πλάτος του παραθύρου είναι το μόνο τίμιο άνω φράγμα που ξέρουμε.
  if (!anchor) return viewport.width;

  const dx = Math.cos(rotationRad);
  const dy = Math.sin(rotationRad);
  const forward = roomAlong(anchor, dx, dy, viewport);
  if (growsFrom === 'left') return forward;

  const backward = roomAlong(anchor, -dx, -dy, viewport);
  if (growsFrom === 'right') return cellWidthPx + backward;
  return cellWidthPx + 2 * Math.min(backward, Math.max(forward - cellWidthPx, 0));
}

/**
 * Το μήκος του προθέματος που **θα τυπωθεί** — ο ίδιος κανόνας με το βήμα 5
 * (`clipWithEllipsis`), εκφρασμένος στον px μετρητή: τα αποσιωπητικά μπαίνουν **μέσα** στο
 * διαθέσιμο πλάτος, δεν προστίθενται μετά.
 */
function printablePrefixLength(text: string, availablePx: number, measure: TextWidthMeasure): number {
  const budgetPx = availablePx - measure(CELL_CLIP_ELLIPSIS);
  return fittingPrefixLengthByChar(text, budgetPx > 0 ? budgetPx : availablePx, measure);
}

/**
 * Πόσες οπτικές γραμμές πιάνει το κείμενο σε δοσμένο πλάτος, με **προτίμηση λέξης** — η
 * συμπεριφορά που δηλώνει και το ίδιο το `<textarea>` (`overflow-wrap: break-word`: σπάει σε
 * κενά, και μέσα σε λέξη μόνο όταν η λέξη δεν χωρά μόνη της σε ολόκληρη τη γραμμή).
 *
 * Χρησιμοποιεί τον **ΕΝΑ** χάρακα (`fittingPrefixLengthByWord`) — τον ίδιο που κάνει την
 * αναδίπλωση MTEXT, με άλλο ενεθειμένο μετρητή. Καμία δεύτερη μηχανή αναδίπλωσης (N.18).
 */
function wrappedLineCount(text: string, widthPx: number, measure: TextWidthMeasure): number {
  const available = widthPx - WRAP_SAFETY_PX;
  if (!(available > 0)) return 1;

  let rest = text;
  let lines = 0;
  while (rest.length > 0 && lines < MAX_WRAPPED_LINES) {
    lines++;
    const cut = fittingPrefixLengthByWord(rest, available, measure);
    if (cut >= rest.length) return lines;
    // Ούτε ένας χαρακτήρας δεν χωρά (παθολογικά στενό κουτί): προχώρα έναν, αλλιώς ο βρόχος
    // δεν τερματίζει ποτέ. Ίδια άμυνα με το `emitPiece` της αναδίπλωσης MTEXT.
    // Το κενό στο οποίο έσπασε η γραμμή είναι **διαχωριστικό, όχι περιεχόμενο**.
    rest = rest.slice(Math.max(cut, 1)).replace(/^ +/u, '');
  }
  return Math.max(lines, 1);
}

/**
 * Το κουτί που ζητά αυτό το πρόχειρο.
 *
 * Η σειρά των αποφάσεων είναι το συμβόλαιο:
 *  1. **χωρά στο κελί;** ⇒ καμία επέκταση, καμία ένδειξη — το κουτί μένει ακριβώς το κελί
 *     (η συνηθισμένη περίπτωση δεν πληρώνει τίποτα και δεν αλλάζει όψη)·
 *  2. αλλιώς **άπλωσε οριζόντια** μέχρι να χωρέσει ή μέχρι την άκρη (Excel/Figma auto-width)·
 *  3. αν χτύπησε στην άκρη, **αναδίπλωσε κατακόρυφα** (Excel)·
 *  4. και σε κάθε περίπτωση επέκτασης, πες **πού θα κοπεί**.
 */
export function computeCellEditorExpansion(input: CellEditorExpansionInput): CellEditorExpansion {
  const { text, cellContentWidthPx, maxContentWidthPx, measure } = input;
  const cellWidthPx = Math.max(cellContentWidthPx, 0);
  const textWidthPx = text ? measure(text) : 0;

  if (!text || textWidthPx <= cellWidthPx) {
    return { contentWidthPx: cellWidthPx, lines: 1, expanded: false };
  }

  const ceilingPx = Math.max(maxContentWidthPx, cellWidthPx);
  const contentWidthPx = Math.min(textWidthPx, ceilingPx);
  const lines = contentWidthPx >= textWidthPx ? 1 : wrappedLineCount(text, contentWidthPx, measure);

  return {
    contentWidthPx,
    lines,
    expanded: true,
    clipMarkerPx: measure(text.slice(0, printablePrefixLength(text, cellWidthPx, measure))),
  };
}
