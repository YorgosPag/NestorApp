/**
 * 🔴 ADR-753 Φ2 — **το κείμενο ενός κελιού σπασμένο σε ομοιογενή τμήματα, και πού κάθεται
 * το καθένα.** Ο ΕΝΑΣ τόπος όπου η μορφοποίηση ανά χαρακτήρα γίνεται γεωμετρία.
 *
 * ## 🔴 Γιατί υπάρχει: η μέτρηση προθεμάτων παύει να ορίζεται
 *
 * Το ADR-751 τοποθετεί τους συνδέσμους μετρώντας **προθέματα του ίδιου string**
 * (`measure(text.slice(0, k))`), ώστε κάθε ζεύγος kerning μέσα στο πρόθεμα να μετριέται
 * ακριβώς όπως θα το μετρούσε ο ζωγράφος του πλήρους κειμένου. Αυτό είναι σωστό **επειδή**
 * ένας σύνδεσμος αλλάζει μόνο **χρώμα**: ο καμβάς ξαναγράφει ολόκληρο το string μέσα σε
 * αποκοπή, άρα όλα τα περάσματα παράγουν **ταυτόσημες** θέσεις glyph.
 *
 * Ένα τμήμα με άλλο βάρος, μέγεθος ή οικογένεια το ακυρώνει. Δεν υπάρχει «το πρόθεμα» πια:
 * οι πρώτοι k χαρακτήρες δεν έχουν **ένα** στυλ, άρα δεν υπάρχει μετρητής να τους μετρήσει.
 *
 * ⚠️ Η ερώτηση «με ποιο στυλ μετριέται το πρόθεμα — του τρέχοντος ή του προηγούμενου
 * τμήματος;» **δεν έχει απάντηση, γιατί είναι λάθος ερώτηση.** Η θέση ενός τμήματος δεν
 * επιλέγεται· την **επιβάλλει ο τρόπος σχεδίασης**:
 *
 * ```
 *   offsetMm(τμήμα k)  =  Σ advance(κείμενο_j, στυλ_j)   για j < k
 *   ────────────────────────────────────────────────────────────────
 *   μέσα σε τμήμα:  offset(χαρακτήρας i) = offsetMm + measure(πρόθεμα ΤΟΥ ΤΜΗΜΑΤΟΣ)
 * ```
 *
 * Δηλαδή το kerning διατηρείται **μέσα** σε κάθε ομοιογενές τμήμα και χάνεται **μόνο** πάνω
 * στα όρια — όχι από επιλογή μας, αλλά επειδή δύο `fillText` με διαφορετική γραμματοσειρά
 * δεν έχουν κοινό ζεύγος να μετρηθεί. Καμία υλοποίηση δεν μπορεί να το ανακτήσει.
 *
 * ## 🔒 Η αναλλοίωτη που κρατά το ADR-751 ανέπαφο — και γιατί είναι δομική
 * Χωρίς `runs` παράγεται **ένα** τμήμα. Τότε το άθροισμα είναι κενό, το «πρόθεμα του
 * τμήματος» είναι το πρόθεμα ολόκληρου του κειμένου, και το στυλ είναι το στυλ του κελιού —
 * δηλαδή **η ίδια αριθμητική πράξη, με τα ίδια ορίσματα**. Η υπογράμμιση των συνδέσμων δεν
 * μετακινείται ούτε κατά ένα mm σε κανέναν πίνακα που υπάρχει σήμερα, και αυτό δεν είναι
 * υπόσχεση: είναι εκφυλισμός του γενικού τύπου.
 *
 * Το ίδιο ισχύει όταν ο χρήστης βάψει έντονη μια επιλογή και μετά την ξεβάψει: τα γειτονικά
 * τμήματα με **ίσα επιλυμένα** μετρικά ξανασυγχωνεύονται ({@link resolveCellStyledSpans}),
 * οπότε επιστρέφει και το χαμένο ζεύγος kerning. Χωρίς αυτή τη συγχώνευση, ένα «Β» και ένα
 * «όχι Β» θα άφηναν μόνιμο αποτύπωμα στη στοίχιση για μηδέν οπτική διαφορά.
 *
 * @module subapps/dxf-viewer/bim/table/table-cell-styled-spans
 * @see bim/table/table-cell-run-ops.ts — οι πράξεις που παράγουν τα `runs` (ADR-753 Φ1)
 * @see bim/table/table-cell-link-spans.ts — το **άλλο** επίπεδο τμημάτων (χρώμα, μετρικά ουδέτερο)
 * @see docs/centralized-systems/reference/adrs/ADR-753-table-cell-rich-text.md §10
 */

import { fittingPrefixLengthByWidth } from '../text/text-fit';
import type { TableCellTextRun, TableTextRunStyle } from '../../types/table';
import type { TableTextMeasurer, TableTextStyleSpan } from './table-layout-types';
import { clearable, inherited, type TableCellStyle } from './table-style';

/** Η τυπογραφία ενός τμήματος — το {@link TableTextStyleSpan} χωρίς τη γεωμετρία του. */
type SpanTypography = Omit<TableTextStyleSpan, 'text' | 'start' | 'end' | 'offsetMm' | 'advanceMm'>;

export interface CellStyledSpansInput {
  /**
   * Το **ορατό** κείμενο του κελιού — ό,τι θα ζωγραφιστεί, ήδη περικομμένο. Ποτέ το
   * `TableCell.value`: μετά την περικοπή οι δείκτες των δύο δεν αντιστοιχούν.
   */
  readonly text: string;
  /** Τα κανονικοποιημένα runs του μοντέλου (ADR-753 Φ1). Απόντα ⇒ ένα τμήμα, το κελί ολόκληρο. */
  readonly runs?: readonly TableCellTextRun[];
  /**
   * 🔴 Πόσοι από τους πρώτους χαρακτήρες του {@link text} είναι **περιεχόμενο του χρήστη**.
   * Απόν ⇒ όλοι.
   *
   * Ό,τι είναι πέρα από αυτό είναι **σημάδι του πίνακα** — τα αποσιωπητικά της περικοπής ή το
   * `####` — και παίρνει το στυλ του **κελιού**, ποτέ του τελευταίου ορατού χαρακτήρα.
   *
   * Δεν είναι λεπτομέρεια υλοποίησης αλλά **απόφαση**: ο δείκτης «εδώ κόπηκε» δεν ανήκει στο
   * κείμενο του χρήστη, ανήκει στον πίνακα που το έκοψε. Ένα «…» που κληρονομούσε τα έντονα
   * του τελευταίου γράμματος θα διαβαζόταν ως μέρος της τιμής — και το `####`, που
   * **αντικαθιστά** ολόκληρο τον αριθμό, δεν θα είχε καν χαρακτήρα να κληρονομήσει.
   */
  readonly runsLimit?: number;
  /** Το **επιλυμένο** στυλ του κελιού — η βάση κάθε κληρονομιάς. */
  readonly style: TableCellStyle;
  /** Ο μετρητής **της διάταξης**, ο ίδιος που αποφάσισε τα πλάτη στηλών. Ποτέ δεύτερος (N.18). */
  readonly measure: TableTextMeasurer;
}

/**
 * Το κείμενο σπασμένο σε **μέγιστα ομοιογενή** τμήματα, μετρημένα και τοποθετημένα.
 *
 * Κενός πίνακας για κενό κείμενο· **ακριβώς ένα** τμήμα όταν δεν υπάρχει καμία μορφοποίηση
 * ανά χαρακτήρα — δες την αναλλοίωτη στην κεφαλίδα.
 */
export function resolveCellStyledSpans(
  input: CellStyledSpansInput,
): readonly TableTextStyleSpan[] {
  const { text, style, measure } = input;
  if (!text) return [];

  const limit = Math.min(input.runsLimit ?? text.length, text.length);
  const merged = mergeEqualNeighbours(styledRanges(text.length, input.runs, limit), style);

  let offsetMm = 0;
  return merged.map((range) => {
    const segment = text.slice(range.start, range.end);
    const advanceMm = measure(segment, range.typography.heightMm, range.typography);
    const span: TableTextStyleSpan = {
      text: segment,
      start: range.start,
      end: range.end,
      offsetMm,
      advanceMm,
      ...range.typography,
    };
    offsetMm += advanceMm;
    return span;
  });
}

/**
 * Το συνολικό πλάτος του κειμένου, ως άθροισμα **ετερογενών** τμημάτων.
 *
 * Διαβάζεται από το τελευταίο τμήμα αντί να ξανααθροιστεί: το `offsetMm` **είναι** ήδη το
 * τρέχον άθροισμα, και μια δεύτερη πρόσθεση των ίδιων αριθμών σε άλλη σειρά μπορεί να δώσει
 * άλλο τελευταίο bit κινητής υποδιαστολής — δηλαδή δύο απαντήσεις στο «πόσο πλατύ είναι».
 */
export function styledSpansWidthMm(spans: readonly TableTextStyleSpan[]): number {
  const last = spans[spans.length - 1];
  return last === undefined ? 0 : last.offsetMm + last.advanceMm;
}

/**
 * Το πλάτος των πρώτων `index` χαρακτήρων — η **γενίκευση** του `measure(text.slice(0, k))`.
 *
 * Ο δείκτης εντοπίζεται στο τμήμα του, το πρόθεμα μετριέται **μέσα σε αυτό** με το στυλ του,
 * και προστίθεται το ήδη συσσωρευμένο `offsetMm`. Με ένα τμήμα εκφυλίζεται στην ταυτόσημη
 * σημερινή έκφραση (βλ. κεφαλίδα).
 */
export function styledPrefixWidthMm(
  spans: readonly TableTextStyleSpan[],
  index: number,
  measure: TableTextMeasurer,
): number {
  if (index <= 0) return 0;
  for (const span of spans) {
    if (index >= span.end) continue;
    // Ακριβώς στην αρχή τμήματος: το άθροισμα **είναι** η απάντηση. Χωρίς αυτόν τον κλάδο θα
    // ζητούσαμε μέτρηση κενής συμβολοσειράς σε κάθε όριο — κόστος για γνωστό μηδέν.
    if (index <= span.start) return span.offsetMm;
    return span.offsetMm + measure(span.text.slice(0, index - span.start), span.heightMm, span);
  }
  return styledSpansWidthMm(spans);
}

/**
 * «Πόσοι χαρακτήρες χωρούν σε αυτό το πλάτος;» πάνω σε **ετερογενές** κείμενο.
 *
 * Ο χάρακας είναι ο ΕΝΑΣ του έργου ({@link fittingPrefixLengthByWidth}) — η δυαδική αναζήτηση
 * δεν ξαναγράφεται εδώ. Το μόνο που αλλάζει είναι **πώς απαντιέται το πλάτος ενός προθέματος**,
 * που είναι ακριβώς η παράμετρος που ο χάρακας δέχεται (N.18 / CHECK 3.28).
 */
export function fittingPrefixLengthAcrossSpans(
  spans: readonly TableTextStyleSpan[],
  availableMm: number,
  measure: TableTextMeasurer,
): number {
  const last = spans[spans.length - 1];
  if (last === undefined) return 0;
  return fittingPrefixLengthByWidth(last.end, availableMm, (n) =>
    styledPrefixWidthMm(spans, n, measure),
  );
}

/**
 * `true` όταν τα τμήματα λένε κάτι που το `TableTextRun` **δεν λέει ήδη μόνο του**.
 *
 * 🔴 Ο φύλακας του σχήματος: όσο επιστρέφει `false`, το `spans` **λείπει** από το run και κάθε
 * χαρακτηρισμένο στιγμιότυπο του έργου μένει byte-ταυτόσημο. Ίδια αρχή με τα `clipped`,
 * `links` και `diagonals` — παρόν μόνο όταν έχει κάτι να πει.
 *
 * ## 🔴 Γιατί ΔΕΝ αρκεί το «πάνω από ένα τμήμα» — ελάττωμα που βρέθηκε γράφοντας το test
 * Ένα run που βάφει έντονο **ολόκληρο** το κελί συγχωνεύεται σε **ένα** τμήμα. Με κριτήριο
 * το πλήθος, το `spans` θα παραλειπόταν — και τότε ο ζωγράφος θα διάβαζε `run.bold` (που
 * έρχεται από το **στυλ του κελιού**, δηλαδή `false`) ενώ η διάταξη είχε μετρήσει **έντονα**.
 *
 * Δηλαδή μέτρηση και ζωγραφική θα απαντούσαν διαφορετικά για το ίδιο κελί: το κείμενο θα
 * ζωγραφιζόταν κανονικό μέσα σε στήλη μετρημένη για έντονα. Είναι **η ίδια** κατηγορία
 * ελαττώματος που πλήρωσε η ADR-739 Φ.Ε (ο καμβάς ζωγράφιζε καρφωτά Arial ενώ η διάταξη
 * τιμούσε το `fontFamily`) — και όπως τότε, θα φαινόταν μόνο σε όσους το χρησιμοποιούσαν.
 *
 * Το κριτήριο είναι επομένως **σημασιολογικό**: παραλείπεται μόνο το τμήμα που δεν προσθέτει
 * τίποτα πάνω στο στυλ του κελιού. Έτσι καλύπτονται και οι δύο σιωπηλές περιπτώσεις — κελί
 * χωρίς runs, και run που δηλώνει ό,τι ισχύει ήδη.
 */
export function hasStyledSpans(
  spans: readonly TableTextStyleSpan[],
  style: TableCellStyle,
): boolean {
  if (spans.length === 0) return false;
  if (spans.length > 1) return true;
  return !sameTypography(spans[0], typographyOf(style, undefined));
}

// ──────────────────────────────────────────────────────────────────────────────
// Εσωτερικά
// ──────────────────────────────────────────────────────────────────────────────

/** Ένα εύρος πριν μετρηθεί: δείκτες + η τυπογραφία που ισχύει μέσα του. */
interface MergedRange {
  start: number;
  end: number;
  readonly typography: SpanTypography;
}

/** Ένα εύρος με το **ωμό** run που το γέννησε (απόν στα κενά ανάμεσα στα runs). */
interface StyledRange {
  readonly start: number;
  readonly end: number;
  readonly style?: TableTextRunStyle;
}

/**
 * Τα runs σε **πλήρη κάλυψη** του κειμένου: τα κενά ανάμεσά τους γίνονται ρητά εύρη χωρίς
 * στυλ, ώστε ο επόμενος βρόχος να μη χρειάζεται να ρωτήσει ποτέ «υπάρχει τμήμα εδώ;».
 *
 * Τα runs είναι ήδη κανονικοποιημένα (ταξινομημένα, χωρίς επικαλύψεις) από το
 * `table-cell-run-ops.ts` — ο περιορισμός στο `limit` και ο `cursor` δεν το ξαναελέγχουν,
 * κόβουν μόνο ό,τι πέφτει έξω από το **ορατό** κείμενο μετά την περικοπή.
 */
function styledRanges(
  textLength: number,
  runs: readonly TableCellTextRun[] | undefined,
  limit: number,
): readonly StyledRange[] {
  const out: StyledRange[] = [];
  let cursor = 0;
  for (const run of runs ?? []) {
    const start = Math.max(run.start, cursor);
    const end = Math.min(run.end, limit);
    if (end <= start) continue;
    if (start > cursor) out.push({ start: cursor, end: start });
    out.push({ start, end, style: run.style });
    cursor = end;
  }
  if (cursor < textLength) out.push({ start: cursor, end: textLength });
  return out;
}

/**
 * Γειτονικά εύρη με **ίδια επιλυμένη** τυπογραφία γίνονται ένα.
 *
 * 🔴 Η σύγκριση γίνεται στο **επιλυμένο** στυλ, όχι στο run: ένα run που δηλώνει
 * `bold: false` πάνω σε κελί που ήδη δεν είναι έντονο **δεν είναι** τμήμα — δεν αλλάζει
 * κανένα glyph. Αν επιβίωνε ως χωριστό τμήμα, θα κόστιζε ένα ζεύγος kerning και μια κλήση
 * σχεδίασης για μηδέν οπτική διαφορά, μόνιμα.
 */
function mergeEqualNeighbours(
  ranges: readonly StyledRange[],
  style: TableCellStyle,
): readonly MergedRange[] {
  const out: MergedRange[] = [];
  for (const range of ranges) {
    const typography = typographyOf(style, range.style);
    const last = out[out.length - 1];
    if (last !== undefined && sameTypography(last.typography, typography)) last.end = range.end;
    else out.push({ start: range.start, end: range.end, typography });
  }
  return out;
}

/**
 * Στυλ κελιού + η δήλωση του τμήματος → η τυπογραφία που ισχύει.
 *
 * Οι δύο βοηθοί έρχονται από το `table-style.ts` και **δεν** ξαναγράφονται: η δοκτρίνα
 * «`undefined` ⇒ κληρονόμησε · `null` ⇒ ρητά η προεπιλογή» έχει ένα σώμα για όλα τα επίπεδα
 * (§3.2 του ADR-753). Από τα έξι πεδία μόνο το `fontFamily` είναι καθαρίσιμο — ακριβώς εκείνα
 * που το `TableCellStyle` δηλώνει προαιρετικά.
 */
function typographyOf(
  base: TableCellStyle,
  style: TableTextRunStyle | undefined,
): SpanTypography {
  const fontFamily = clearable([style?.fontFamily], base.fontFamily);
  return {
    heightMm: inherited([style?.textHeightMm], base.textHeightMm),
    colorHex: inherited([style?.textColorHex], base.textColorHex),
    bold: inherited([style?.bold], base.bold),
    italic: inherited([style?.italic], base.italic),
    underline: inherited([style?.underline], base.underline),
    ...(fontFamily !== undefined && { fontFamily }),
  };
}

/**
 * Ισότητα τυπογραφίας — **πεδίο προς πεδίο, ρητά**.
 *
 * ⚠️ **Δηλωμένο ρητά: κανένα test δεν διακρίνει αυτή την εκδοχή από ένα `JSON.stringify`.**
 * Και δεν μπορεί να το διακρίνει, γιατί κάθε τυπογραφία γεννιέται από **έναν** τόπο
 * ({@link typographyOf}), άρα πάντα με την ίδια σειρά κλειδιών — ακριβώς η συνθήκη υπό την
 * οποία τα δύο είναι ισοδύναμα.
 *
 * Γράφεται έτσι επειδή αυτή η ισοδυναμία είναι **σύμπτωση ενός κατασκευαστή**, όχι ιδιότητα
 * του ερωτήματος: την ημέρα που μια δεύτερη διαδρομή φτιάξει τυπογραφία (μια εισαγωγή
 * `.xlsx`, ένα υπόλειμμα από `JSON.parse`), το `stringify` θα άρχιζε να λέει «διαφορετικά»
 * για ίσα στυλ — και το σύμπτωμα θα ήταν τμήματα που δεν συγχωνεύονται ποτέ, δηλαδή χαμένο
 * kerning χωρίς κανένα κόκκινο test.
 *
 * Το ADR-753 §8 κατέγραψε ότι **ένα σχόλιο δεν είναι φύλακας**. Η συνέπεια δεν είναι να
 * επινοηθεί test που δεν μπορεί να υπάρξει — είναι να **μη διεκδικηθεί** φύλακας που λείπει.
 */
function sameTypography(a: SpanTypography, b: SpanTypography): boolean {
  return (
    a.heightMm === b.heightMm &&
    a.colorHex === b.colorHex &&
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.underline === b.underline &&
    a.fontFamily === b.fontFamily
  );
}
