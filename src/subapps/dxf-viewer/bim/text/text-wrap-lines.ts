/**
 * 🏢 ENTERPRISE — **ο ΕΝΑΣ βρόχος αναδίπλωσης**: κείμενο + διαθέσιμο πλάτος → οπτικές γραμμές.
 *
 * ADR-739 §58 (Φάση Γ). Καθαρό module: ο μετρητής **ενίεται**, άρα δεν ξέρει ούτε
 * γραμματοσειρές ούτε μονάδες — δουλεύει το ίδιο σε sheet-mm (διάταξη πίνακα) και σε px
 * (κουτί επεξεργασίας), όπως ακριβώς ο χάρακας του `text-fit.ts` που καταναλώνει.
 *
 * ## 🔴 Γιατί υπάρχει: ο ίδιος βρόχος ήταν ήδη γραμμένος ΔΥΟ φορές
 * Πριν από αυτό το αρχείο, το «σπάσε το κείμενο σε γραμμές» ζούσε σε δύο αντίγραφα με
 * **ταυτόσημη** δομή και διαφορετικές μονάδες:
 * ```
 *   bim/text/text-layout.ts            emitPiece         (MTEXT, μονάδες σχεδίου)
 *   ui/.../table-cell-editor-expansion  wrappedLineCount  (κουτί επεξεργασίας, px)
 * ```
 * Και τα δύο: «μέτρα → δεν χωράει → βρες πρόθεμα → κόψε τα κενά και από τις δύο πλευρές →
 * άμυνα ενός χαρακτήρα για να μη γίνει ατέρμονος βρόχος». Ένα **τρίτο** αντίγραφο για τον
 * πίνακα θα ήταν ακριβώς ο structural clone που πιάνει το CHECK 3.28 (jscpd, ADR-584)
 * **ανεξάρτητα ονόματος** — και, χειρότερα, η τρίτη επιφάνεια που μπορεί να αποκλίνει.
 *
 * ⚠️ **Δηλωμένο όριο**: το `emitPiece` του MTEXT **δεν** γίνεται καταναλωτής. Δεν είναι
 * αμέλεια: εκείνο αναδιπλώνει **ετερογενή κομμάτια με στηλοθέτες και τρέχοντα δρομέα**
 * (`\t` → tab stops, `\H` → άλλο ύψος ανά κομμάτι), δηλαδή λύνει αυστηρά μεγαλύτερο
 * πρόβλημα. Μια ενοποίηση θα ανάγκαζε αυτό το module να μάθει στηλοθέτες για να
 * εξυπηρετήσει έναν καλούντα — και θα άγγιζε το ADR-635, εκτός εμβέλειας της Φάσης Γ.
 *
 * ## 🏆 Η ισορρόπηση — εδώ ο ΝΕΣΤΩΡ περνά ΟΛΟΥΣ τους μεγάλους
 * Excel, Google Sheets, AutoCAD, Revit, ArchiCAD **και κάθε browser** αναδιπλώνουν
 * *greedy first-fit*: γεμίζουν την πρώτη γραμμή μέχρι να σκάσει και προχωρούν. Το
 * αποτέλεσμα είναι η κλασική ορφανή λέξη:
 * ```
 *   greedy                        balanced (ΕΔΩ)
 *   ┌──────────────────────┐      ┌──────────────────────┐
 *   │ ΣΚΥΡΟΔΕΜΑ C20/25 ΑΝΩ │      │ ΣΚΥΡΟΔΕΜΑ C20/25     │
 *   │ ΠΕΔΙΛΟΥ              │      │ ΑΝΩ ΠΕΔΙΛΟΥ          │
 *   └──────────────────────┘      └──────────────────────┘
 * ```
 * Το CSS το πρόσθεσε μόλις ως `text-wrap: balance` (Chrome 114+), σχεδιασμένο ρητά για
 * **μικρά** μπλοκ — δηλαδή για κελί πίνακα. Ο μηχανισμός είναι ο ίδιος που περιγράφει η
 * τεκμηρίωση του Chrome: **δυαδική αναζήτηση για το ελάχιστο πλάτος που δεν προσθέτει
 * γραμμή**.
 *
 * 🔑 **Γιατί είναι ασφαλές, και όχι απλώς όμορφο**: η ισορρόπηση **δεν αλλάζει το πλήθος
 * γραμμών** — αυτό είναι το ίδιο της το κριτήριο. Άρα το ύψος της γραμμής του πίνακα
 * βγαίνει **ταυτόσημο** με του greedy και ο βρόχος ανάδρασης `περιεχόμενο → ύψος →
 * γεωμετρία οντότητας` δεν επηρεάζεται καθόλου. Μηδέν επιπλέον ρίσκο, μόνο καλύτερο σχέδιο.
 *
 * @module subapps/dxf-viewer/bim/text/text-wrap-lines
 * @see bim/text/line-break-opportunities.ts — ΠΟΥ επιτρέπεται να σπάσει
 * @see bim/text/text-fit.ts — ΠΟΣΟ χωρά (η δυαδική αναζήτηση, δεν ξαναγράφεται εδώ)
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §58
 */

import { lineBreakOpportunities } from './line-break-opportunities';
import { fittingPrefixLengthByWidth } from './text-fit';

/** Μία οπτική γραμμή: το κείμενό της και το εύρος της στο **αρχικό** αλφαριθμητικό. */
export interface WrappedLine {
  /** Το κείμενο **χωρίς** τα κενά που έφαγε το σπάσιμο — έτοιμο προς ζωγραφική. */
  readonly text: string;
  /** Πρώτος χαρακτήρας στο αρχικό κείμενο, συμπεριλαμβανόμενος. */
  readonly start: number;
  /**
   * Τελευταίος, **μη** συμπεριλαμβανόμενος — μετά την αφαίρεση των κενών του σπασίματος.
   *
   * 🔴 Οι δείκτες ταξιδεύουν επειδή ο πίνακας τους **χρειάζεται**: η μορφοποίηση ανά
   * χαρακτήρα (ADR-753 `runs`) και οι διευθύνσεις (ADR-751 `links`) δηλώνονται σε δείκτες
   * του **ακέραιου** κειμένου του κελιού. Μια αναδίπλωση που επέστρεφε μόνο συμβολοσειρές
   * θα ανάγκαζε τον καλούντα να ξαναβρεί «ποιοι χαρακτήρες είναι αυτοί» με αναζήτηση —
   * δηλαδή δεύτερη απάντηση στο ίδιο ερώτημα, και λάθος όποτε το κείμενο επαναλαμβάνεται.
   */
  readonly end: number;
}

/**
 * Το πλάτος του `text.slice(start, end)` στις μονάδες του καλούντος.
 *
 * 🔴 **Εύρος και όχι πρόθεμα**, σε αντίθεση με το {@link PrefixWidth} του `text-fit.ts`: η
 * αναδίπλωση μετρά τη **δεύτερη** και την **τρίτη** γραμμή, που δεν είναι προθέματα του
 * κειμένου. Ο ομοιογενής καλών δίνει `(s, e) => measure(text.slice(s, e))`· ο ετερογενής
 * (κελί με `runs`) δίνει τη διαφορά δύο μετρημένων προθεμάτων — και τα δύο είναι **ο δικός
 * του** SSoT μέτρησης, ποτέ δεύτερος μετρητής μέσα εδώ (N.18).
 */
export type RangeWidth = (start: number, end: number) => number;

export interface WrapTextInput {
  /** Το **ακέραιο** κείμενο — ποτέ ήδη κομμένο. Χωρίς `\n`: αυτά τα λύνει ο καλών. */
  readonly text: string;
  /** Το ωφέλιμο πλάτος στις μονάδες του καλούντος (κελί μείον τα δύο περιθώρια). */
  readonly availableWidth: number;
  readonly rangeWidth: RangeWidth;
  /**
   * Πάνω φράγμα οπτικών γραμμών. Απόν ⇒ {@link MAX_WRAPPED_LINES}. Ο καλών το δίνει όταν
   * έχει δικό του όριο (π.χ. κελί με **καρφωμένο** ύψος: ό,τι δεν χωρά κατακόρυφα δεν
   * χρειάζεται καν να υπολογιστεί).
   */
  readonly maxLines?: number;
  /**
   * Ισορρόπηση πλατών ({@link balanceWidth}). Απούσα ⇒ **ναι**.
   *
   * Η προεπιλογή είναι «ναι» επειδή αυτό είναι το ζητούμενο σε κελί πίνακα και το κόστος
   * φράσσεται από το {@link BALANCE_MAX_LINES}. Ο διακόπτης υπάρχει για τον καλούντα που
   * μετρά **μόνο πλήθος** γραμμών (κουτί επεξεργασίας): εκεί η ισορρόπηση δεν αλλάζει την
   * απάντηση εξ ορισμού, άρα θα ήταν καθαρή σπατάλη.
   */
  readonly balance?: boolean;
}

/** Πάνω φράγμα ασφαλείας — παθολογικό πλάτος δεν γεννά βρόχο χιλιάδων επαναλήψεων. */
export const MAX_WRAPPED_LINES = 64;

/**
 * Πάνω από τόσες γραμμές η ισορρόπηση **δεν** εφαρμόζεται.
 *
 * Δύο ανεξάρτητοι λόγοι, και οι δύο υπάρχουν και στο CSS `text-wrap: balance` (που ορίζει
 * παρόμοιο όριο ως προϋπόθεση εφαρμογής):
 *  1. **Δεν φαίνεται.** Η ορφανή τελευταία λέξη ενοχλεί σε δύο ή τρεις γραμμές· σε δέκα
 *     είναι αόρατη — η ματιά διαβάζει ήδη ένα μπλοκ.
 *  2. **Κόστος.** Η ισορρόπηση είναι `~12 × greedy`. Σε κελί δύο γραμμών αυτό είναι
 *     μηδαμινό· σε μια παράγραφο 40 γραμμών γίνεται το O(zoom²) του ADR-735 σε άλλη μορφή.
 */
export const BALANCE_MAX_LINES = 6;

/** Επαναλήψεις δυαδικής αναζήτησης — 12 δίνουν ακρίβεια πλάτους 1/4096 του κελιού. */
const BALANCE_ITERATIONS = 12;

/** Κενά **μόνο** στα άκρα του σπασίματος· τα εσωτερικά είναι περιεχόμενο του χρήστη. */
const TRIM_END = /[ \t]+$/u;
const TRIM_START = /^[ \t]+/u;

/**
 * Η μεγαλύτερη νόμιμη ευκαιρία μέσα στο `(from, limit]`, ή `undefined` όταν δεν υπάρχει
 * καμία — οπότε ο καλών πέφτει σε κοπή χαρακτήρα.
 *
 * Γραμμική σάρωση από το τέλος και όχι δυαδική: οι ευκαιρίες μιας γραμμής κελιού είναι
 * λίγες (λέξεις, όχι χαρακτήρες) και η δυαδική θα ήταν κώδικας που δεν πληρώνεται.
 */
function lastOpportunityWithin(
  opportunities: readonly number[],
  from: number,
  limit: number,
): number | undefined {
  for (let i = opportunities.length - 1; i >= 0; i--) {
    const k = opportunities[i];
    if (k > limit) continue;
    return k > from ? k : undefined;
  }
  return undefined;
}

/**
 * Το **greedy first-fit** πέρασμα — η κλασική αναδίπλωση, με προτίμηση σε νόμιμη ευκαιρία
 * και άμυνα ενός χαρακτήρα όταν δεν χωρά τίποτα.
 *
 * Η άμυνα δεν είναι διακοσμητική: χωρίς αυτήν, ένα κελί στενότερο από ένα γράμμα δίνει
 * `fit === 0` και ο βρόχος δεν προχωρά **ποτέ**. Ίδια άμυνα με το `emitPiece` του MTEXT
 * και το `wrappedLineCount` του επεξεργαστή — εδώ γραμμένη μία φορά για όλους.
 */
function greedyLines(
  input: WrapTextInput,
  opportunities: readonly number[],
  width: number,
  maxLines: number,
): WrappedLine[] {
  const { text, rangeWidth } = input;
  const out: WrappedLine[] = [];
  let start = 0;

  while (start < text.length && out.length < maxLines) {
    if (rangeWidth(start, text.length) <= width) {
      pushLine(out, text, start, text.length);
      return out;
    }
    const fit = fittingPrefixLengthByWidth(text.length - start, width, (n) =>
      rangeWidth(start, start + n),
    );
    const opportunity = lastOpportunityWithin(opportunities, start, start + fit);
    // Χωρίς νόμιμη ευκαιρία: μία λέξη πλατύτερη από ολόκληρο το κελί ⇒ κοπή χαρακτήρα,
    // ό,τι κάνει και το AutoCAD αντί να ξεχειλίσει επ' αόριστον.
    const cut = opportunity ?? start + Math.max(fit, 1);
    pushLine(out, text, start, cut);
    start = cut + (TRIM_START.exec(text.slice(cut))?.[0].length ?? 0);
  }

  // Ό,τι απέμεινε πάνω από το φράγμα μπαίνει ακέραιο στην τελευταία γραμμή: το φράγμα
  // προστατεύει από ατέρμονο βρόχο, δεν είναι άδεια να **χαθεί** κείμενο του χρήστη.
  if (start < text.length && out.length > 0) {
    const last = out[out.length - 1];
    out[out.length - 1] = { text: text.slice(last.start), start: last.start, end: text.length };
  }
  return out;
}

/** Μία γραμμή, με τα κενά του σπασίματος κομμένα — η ΜΙΑ διατύπωση του κανόνα. */
function pushLine(out: WrappedLine[], text: string, start: number, end: number): void {
  const raw = text.slice(start, end);
  const trimmed = raw.replace(TRIM_END, '');
  out.push({ text: trimmed, start, end: start + trimmed.length });
}

/**
 * 🏆 Το **ελάχιστο πλάτος που δεν προσθέτει γραμμή** — ο μηχανισμός του `text-wrap: balance`.
 *
 * Δυαδική αναζήτηση στο διάστημα `(0, availableWidth]`: αν σε πλάτος `w` το greedy δίνει
 * **το ίδιο** πλήθος γραμμών με το πλήρες πλάτος, τότε το `w` είναι αρκετό και ψάχνουμε
 * μικρότερο· αλλιώς ψάχνουμε μεγαλύτερο. Το αποτέλεσμα είναι το στενότερο «νοητό κουτί»
 * που χωρά τις ίδιες γραμμές — δηλαδή γραμμές όσο πιο κοντά γίνεται σε ίσο μήκος.
 *
 * ⚠️ **Το κείμενο ζωγραφίζεται στο ΠΡΑΓΜΑΤΙΚΟ κελί, όχι στο στενό κουτί.** Το `w` είναι
 * εργαλείο απόφασης για το **πού σπάει**, ποτέ γεωμετρία: η στοίχιση (αριστερά/κέντρο/
 * δεξιά) εφαρμόζεται μετά, μέσα στο κανονικό ορθογώνιο. Αν το `w` διέρρεε ως πλάτος, ένα
 * κεντραρισμένο κελί θα ζωγραφιζόταν μετατοπισμένο.
 */
function balanceWidth(
  input: WrapTextInput,
  opportunities: readonly number[],
  targetLines: number,
  maxLines: number,
): number {
  let lo = 0;
  let hi = input.availableWidth;
  for (let i = 0; i < BALANCE_ITERATIONS; i++) {
    const mid = (lo + hi) / 2;
    if (!(mid > 0)) break;
    if (greedyLines(input, opportunities, mid, maxLines).length <= targetLines) hi = mid;
    else lo = mid;
  }
  return hi;
}

/**
 * Το κείμενο σπασμένο σε οπτικές γραμμές.
 *
 * Καθαρή συνάρτηση: ίδιες είσοδοι ⇒ ίδιο αποτέλεσμα, πάντα — προϋπόθεση για την
 * απομνημόνευση της διάταξης (`resolveTableLayout`) και για το bitmap cache (ADR-040).
 *
 * Κενό κείμενο ⇒ **κενός πίνακας**, όχι μία κενή γραμμή: ένα κελί χωρίς περιεχόμενο δεν
 * έχει γραμμή να ζωγραφίσει, και μια κενή γραμμή θα το έκανε να «ζητά» ύψος.
 */
export function wrapTextToLines(input: WrapTextInput): readonly WrappedLine[] {
  const { text, availableWidth } = input;
  if (!text) return [];
  // Μηδενικό ή αρνητικό ωφέλιμο πλάτος (στήλη στενότερη από τα περιθώριά της): μία γραμμή
  // με ό,τι υπάρχει. Η **περικοπή** είναι δουλειά του καλούντος (`table-cell-overflow.ts`),
  // όχι της αναδίπλωσης — εδώ δεν υπάρχει πλάτος να αποφασίσει τίποτα.
  if (!(availableWidth > 0)) return [{ text, start: 0, end: text.length }];

  const maxLines = Math.max(input.maxLines ?? MAX_WRAPPED_LINES, 1);
  const opportunities = lineBreakOpportunities(text);
  const greedy = greedyLines(input, opportunities, availableWidth, maxLines);

  if (input.balance === false || greedy.length < 2 || greedy.length > BALANCE_MAX_LINES) {
    return greedy;
  }
  return greedyLines(
    input,
    opportunities,
    balanceWidth(input, opportunities, greedy.length, maxLines),
    maxLines,
  );
}

/**
 * Πόσες οπτικές γραμμές χρειάζεται το κείμενο — ο **αριθμός** χωρίς τις συμβολοσειρές.
 *
 * Υπάρχει ως ρητή είσοδος επειδή ο καλών που ρωτά μόνο αυτό (το κουτί επεξεργασίας, που
 * θέλει ύψος) δεν πρέπει να πληρώνει την ισορρόπηση: εξ ορισμού δεν αλλάζει το πλήθος.
 */
export function wrappedLineCount(input: Omit<WrapTextInput, 'balance'>): number {
  return Math.max(wrapTextToLines({ ...input, balance: false }).length, 1);
}
