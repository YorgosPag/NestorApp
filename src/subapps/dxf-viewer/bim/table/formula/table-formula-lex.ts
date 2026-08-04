/**
 * ADR-739 Φ.Ζ — **ο λεξικογράφος του τύπου**: κείμενο → λεκτικές μονάδες. Καθαρή συνάρτηση,
 * μηδέν React/DOM/canvas, μηδέν εξάρτηση.
 *
 * ## 🔴 Γιατί ΔΕΝ επαναχρησιμοποιεί το `numeric-expression.ts` (ADR-706) — ομώνυμο, όχι συνώνυμο
 * Η εφαρμογή **έχει ήδη** αξιολογητή αριθμητικών εκφράσεων: κάθε αριθμητικό πεδίο δέχεται
 * `1200/2` (πρότυπο Figma/Revit/C4D). Μοιάζει με αυτό εδώ και **δεν είναι**:
 *
 * | | `numeric-expression.ts` | εδώ |
 * |---|---|---|
 * | `2,4` | ο αριθμός **2.4** (`parseLocaleNumber`, ADR-576) | **δύο ορίσματα**: `2` και `4` |
 * | ερώτηση | «τι αριθμό πληκτρολόγησε ο χρήστης;» | «τι υπολογίζει αυτό το κελί;» |
 * | αναφορές | δεν υπάρχουν | είναι ο λόγος ύπαρξης |
 *
 * Το ίδιο κόμμα, δύο ασύμβατες σημασίες. Κοινός λεξικογράφος θα σήμαινε ότι μια αλλαγή για
 * τον πίνακα αλλάζει **σιωπηλά κάθε πεδίο δεκαδικού της εφαρμογής** — και το αντίστροφο.
 * Είναι ακριβώς η διάκριση που τεκμηριώνει ήδη το `lib/spreadsheet/column-letter.ts` για τις
 * ετικέτες δομικού κανάβου: **ομώνυμα, όχι συνώνυμα· μένουν χωριστά επίτηδες.**
 *
 * Ο πίνακας μιλά την **κανονική** μορφή — `.` δεκαδικό, `,` διαχωριστής ορισμάτων. Δεν είναι
 * προτίμηση: αυτό γράφει το `ACAD_TABLE` στο DXF (`=Sum(A1:A5)`) και αυτό διαβάζουν όλα τα
 * φύλλα υπολογισμού στο **αρχείο** τους, ανεξάρτητα από το τι δείχνουν στην οθόνη.
 *
 * ## Ασφάλεια
 * Μηδέν `eval`, μηδέν `new Function` — όπως όλο το repo. Μόνο οι μονάδες που δηλώνονται εδώ
 * μπορούν ποτέ να παραχθούν· άγνωστος χαρακτήρας ⇒ `null`, και ο τύπος μένει **κείμενο**.
 *
 * @module subapps/dxf-viewer/bim/table/formula/table-formula-lex
 * @see components/ui/numeric-field/numeric-expression.ts — η άλλη ερώτηση (ADR-706)
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §9
 */

import type { TableFormulaBinaryOp } from '../../../types/table-formula';

/** Τα σημεία στίξης της γραμματικής: ομαδοποίηση, χωρισμός ορισμάτων, εύρος. */
export type TableFormulaPunct = '(' | ')' | ',' | ':';

/**
 * Μια λεκτική μονάδα **χωρίς θέση** — ό,τι αναγνωρίζει ένας σαρωτής. Το `name` καλύπτει
 * **και** τα ονόματα συναρτήσεων **και** τις αναφορές κελιών (`SUM`, `A1`): λεξικά είναι το
 * ίδιο πράγμα — γράμματα και ψηφία — και τα ξεχωρίζει μόνο το τι ακολουθεί. Η απόφαση ανήκει
 * στον αναλυτή, που βλέπει το επόμενο σύμβολο· ο λεξικογράφος **δεν κρίνει**.
 */
export type TableFormulaLexeme =
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'name'; readonly value: string }
  | { readonly kind: 'op'; readonly value: TableFormulaBinaryOp }
  | { readonly kind: 'punct'; readonly value: TableFormulaPunct };

/**
 * Η μονάδα **με τη θέση της** στο κείμενο που σαρώθηκε: `[start, end)` σε δείκτες χαρακτήρα.
 *
 * ## Γιατί ο λεξικογράφος κουβαλά θέσεις
 * Ο αναλυτής **δεν τις χρειάζεται** — παράγει δέντρο δεμένο σε ταυτότητες (§9.3). Τις
 * χρειάζεται ο **επεξεργαστής**: για να απαντήσει «τι υπάρχει αριστερά του δρομέα;»
 * (ADR-754 — υπόδειξη κελιού με το ποντίκι) πρέπει να αντιστοιχίσει θέση δρομέα σε μονάδα.
 * Η εναλλακτική ήταν δεύτερος, «ελαφρύς» σαρωτής στον επεξεργαστή — δηλαδή δύο γραμματικές
 * που αποκλίνουν σιωπηλά την πρώτη φορά που κάποια αλλάξει (N.18).
 *
 * Δεν κοστίζει τίποτα: οι θέσεις **υπάρχουν ήδη** μέσα στον βρόχο του {@link tokenizeFormula}
 * (`at` και `next`) και απλώς έπαυαν να αναφέρονται. Γι' αυτό μπαίνουν σε **ένα** σημείο και
 * κανένας σαρωτής δεν άλλαξε.
 *
 * ⚠️ Οι δείκτες είναι σχετικοί με το **κείμενο που δόθηκε** στον λεξικογράφο — δηλαδή
 * **χωρίς** το `=`. Ο καταναλωτής που μετρά πάνω στο πλήρες κείμενο του κελιού προσθέτει
 * μόνος του τη μετατόπιση του προθέματος.
 */
export type TableFormulaToken = TableFormulaLexeme & {
  readonly start: number;
  readonly end: number;
};

/** Το πρόθεμα που δηλώνει «αυτό είναι τύπος» — Excel, Google Sheets, AutoCAD, DXF. */
export const FORMULA_PREFIX = '=';

/** Οι τελεστές δύο χαρακτήρων. Δοκιμάζονται **πρώτοι**: το `<=` δεν είναι `<` και μετά `=`. */
const TWO_CHAR_OPERATORS = ['<>', '<=', '>='] as const;

/** Οι τελεστές ενός χαρακτήρα. Το `=` εδώ είναι **σύγκριση** (μέσα σε `IF`), όχι πρόθεμα. */
const ONE_CHAR_OPERATORS = ['^', '*', '/', '+', '-', '&', '=', '<', '>'] as const;

const PUNCTUATION: readonly string[] = ['(', ')', ',', ':'];

/** Ψηφίο ή δεκαδική υποδιαστολή — **μόνο τελεία**, δες την κεφαλίδα. */
const NUMBER_START = /[0-9.]/u;
/**
 * Γράμμα, κάτω παύλα ή **δολάριο**: η αρχή ονόματος συνάρτησης ή αναφοράς κελιού.
 *
 * ## 🔴 Γιατί το `$` είναι μέρος του **ονόματος** και όχι δικό του σημείο στίξης (ADR-754 Γ2)
 * Το `$A$1` πρέπει να φτάσει στον αναλυτή ως **μία** μονάδα. Αν το `$` ήταν σημείο στίξης, το
 * `$A$1` θα γινόταν πέντε μονάδες και **κάθε** καταναλωτής θέσης —η κατάσταση υπόδειξης, οι
 * χρωματιστές αναφορές, η αντικατάσταση ζωντανής αναφοράς— θα έπρεπε να ξαναχτίζει μόνος του
 * το «ποιες γειτονικές μονάδες αποτελούν μια διεύθυνση». Τρεις υλοποιήσεις της ίδιας
 * συγκόλλησης, που αποκλίνουν στην πρώτη μεικτή μορφή (N.18).
 *
 * Ο λεξικογράφος εξακολουθεί να **μην κρίνει**: το `$` απλώς επιτρέπεται μέσα σε όνομα. Το αν
 * κάθεται σε νόμιμη θέση το απαντά ο **ένας** ιδιοκτήτης του (`table-formula-absolute.ts`),
 * όπως ακριβώς το «είναι υπαρκτό κελί;» το απαντά ο μεταφραστής και όχι εδώ.
 *
 * ⚠️ **Μετρημένη συνέπεια**: το `=$5` έπαυε παλιά να είναι τύπος καθόλου (άγνωστος χαρακτήρας
 * ⇒ `null` ⇒ αποθηκευόταν ως κείμενο) και τώρα γίνεται τύπος με `#REF!`. Είναι η **σωστή**
 * απάντηση —το `$5` δεν είναι διεύθυνση— και συμφωνεί με το Excel, αλλά καταγράφεται ρητά
 * επειδή είναι αλλαγή συμπεριφοράς σε υπάρχον κείμενο.
 */
const NAME_START = /[A-Za-z_$]/u;
const NAME_PART = /[A-Za-z0-9_.$]/u;

/** Το εισαγωγικό κειμένου. Διπλό μέσα σε αλφαριθμητικό ⇒ ένα κυριολεκτικό (σύμβαση Excel). */
const QUOTE = '"';

/**
 * True όταν ο χαρακτήρας μπορεί να **συνεχίσει** ένα `name` ή `number` που ήδη ξεκίνησε.
 *
 * Απαντά σε μία μόνο ερώτηση, και τη ρωτά ο επεξεργαστής (ADR-754): «ο δρομέας κάθεται στη
 * **μέση** μιας μονάδας;». Το `=A12` με τον δρομέα ανάμεσα στο `1` και στο `2` σαρώνεται
 * αριστερά ως τέλειο `A1` — δηλαδή θα φαινόταν έγκυρη αναφορά ενώ ο χρήστης απλώς γράφει
 * ακόμη. Χωρίς αυτόν τον έλεγχο, ένα κλικ εκεί θα **έσβηνε μισή λέξη** που πληκτρολογείται.
 *
 * Ζει εδώ και όχι στον καταναλωτή επειδή η απάντηση **είναι** τα `NAME_PART`/`NUMBER_START`
 * αυτού του αρχείου. Αντιγραμμένη μία φορά, θα ήταν δεύτερος ορισμός του «τι είναι όνομα» —
 * και θα απέκλινε την πρώτη φορά που η γραμματική δεχτεί νέο χαρακτήρα (N.18).
 */
export function continuesLexeme(char: string | undefined): boolean {
  if (char === undefined) return false;
  return NAME_PART.test(char) || NUMBER_START.test(char);
}

/**
 * Η θέση **μετά** το `=`, ή `null` όταν το κείμενο δεν είναι δήλωση τύπου.
 *
 * Δεν καλεί το `isFormulaInput`: εκείνο απαντά «ναι/όχι» ενώ εδώ χρειάζεται και **πού** — και
 * τα αρχικά κενά μετρούν, γιατί ο καταναλωτής μετρά δείκτες πάνω στο **ακατέργαστο** κείμενο
 * του πεδίου (θέση δρομέα, θέση αναφοράς).
 *
 * Ζει εδώ, δίπλα στο {@link FORMULA_PREFIX}, για τον ίδιο λόγο με το {@link continuesLexeme}:
 * η απάντηση **είναι** η σταθερά αυτού του αρχείου. Δύο καταναλωτές τη ρωτούν ήδη — «τι
 * σημαίνει το κλικ;» (`table-formula-point-state`) και «ποιες αναφορές περιέχει ο τύπος;»
 * (`table-formula-reference-spans`) — και ένα αντίγραφο στον δεύτερο θα ήταν δεύτερος ορισμός
 * του «πού αρχίζει ο τύπος» (N.18).
 */
export function formulaBodyStart(draft: string): number | null {
  const firstVisible = draft.search(/\S/u);
  if (firstVisible === -1) return null;
  return draft[firstVisible] === FORMULA_PREFIX ? firstVisible + 1 : null;
}

/**
 * Κείμενο τύπου (**χωρίς** το `=`) → μονάδες, ή `null` αν υπάρχει χαρακτήρας εκτός
 * γραμματικής ή αλφαριθμητικό που δεν κλείνει.
 *
 * Το `null` είναι σημασιολογικό: ο καλών **δεν** το θεωρεί σφάλμα τύπου αλλά «αυτό δεν ήταν
 * τύπος», και το αποθηκεύει ως σκέτο κείμενο. Δες `table-formula-parse.ts`.
 */
export function tokenizeFormula(source: string): readonly TableFormulaToken[] | null {
  const tokens: TableFormulaToken[] = [];
  let at = 0;

  while (at < source.length) {
    const char = source[at];

    if (char === ' ' || char === '\t') {
      at += 1;
      continue;
    }

    const scanned = scanToken(source, at);
    if (scanned === null) return null;
    // Η **μία** θέση όπου η μονάδα αποκτά θέση — δες {@link TableFormulaToken}.
    tokens.push({ ...scanned.token, start: at, end: scanned.next });
    at = scanned.next;
  }

  return tokens;
}

/** Ό,τι διάβασε ένας σαρωτής: η μονάδα και η θέση **μετά** από αυτήν. */
interface Scanned {
  readonly token: TableFormulaLexeme;
  readonly next: number;
}

/** Η μία διακλάδωση ανά είδος χαρακτήρα — η σειρά είναι σημασία, όχι τύχη. */
function scanToken(source: string, at: number): Scanned | null {
  const char = source[at];

  if (NUMBER_START.test(char)) return scanNumber(source, at);
  if (NAME_START.test(char)) return scanName(source, at);
  if (char === QUOTE) return scanText(source, at);
  if (PUNCTUATION.includes(char)) {
    return { token: { kind: 'punct', value: char as TableFormulaPunct }, next: at + 1 };
  }
  return scanOperator(source, at);
}

/**
 * Αριθμητικό κυριολεκτικό, με προαιρετικό εκθέτη: `12`, `1.5`, `.5`, `1e3`, `2.5E-2`.
 *
 * Ο εκθέτης διαβάζεται **μόνο** μετά από ψηφία, γι' αυτό δεν συγκρούεται με την αναφορά
 * `E3`: εκείνη ξεκινά με γράμμα και πάει στον {@link scanName}.
 */
function scanNumber(source: string, at: number): Scanned | null {
  let end = at;
  let dots = 0;
  while (end < source.length && NUMBER_START.test(source[end])) {
    if (source[end] === '.') dots += 1;
    end += 1;
  }
  if (dots > 1) return null;

  end = skipExponent(source, end);
  const value = Number(source.slice(at, end));
  if (!Number.isFinite(value)) return null;
  return { token: { kind: 'number', value }, next: end };
}

/** Ο εκθέτης `e±ψηφία`, αν υπάρχει ολόκληρος· αλλιώς η θέση μένει ως έχει. */
function skipExponent(source: string, at: number): number {
  if (at >= source.length || (source[at] !== 'e' && source[at] !== 'E')) return at;
  let end = at + 1;
  if (source[end] === '+' || source[end] === '-') end += 1;
  const digitsFrom = end;
  while (end < source.length && source[end] >= '0' && source[end] <= '9') end += 1;
  return end === digitsFrom ? at : end;
}

/** Όνομα συνάρτησης ή αναφορά κελιού — ο αναλυτής αποφασίζει ποιο από τα δύο. */
function scanName(source: string, at: number): Scanned {
  let end = at;
  while (end < source.length && NAME_PART.test(source[end])) end += 1;
  return { token: { kind: 'name', value: source.slice(at, end) }, next: end };
}

/** Κυριολεκτικό κειμένου· `""` μέσα του σημαίνει ένα εισαγωγικό (σύμβαση Excel). */
function scanText(source: string, at: number): Scanned | null {
  let value = '';
  let end = at + 1;
  while (end < source.length) {
    if (source[end] === QUOTE) {
      if (source[end + 1] !== QUOTE) return { token: { kind: 'text', value }, next: end + 1 };
      end += 1; // διπλό εισαγωγικό ⇒ κυριολεκτικό
    }
    value += source[end];
    end += 1;
  }
  return null; // αλφαριθμητικό που δεν έκλεισε ποτέ
}

/** Τελεστής — **δύο χαρακτήρες πρώτα**, αλλιώς το `<=` θα διαβαζόταν ως `<` και `=`. */
function scanOperator(source: string, at: number): Scanned | null {
  const pair = source.slice(at, at + 2);
  for (const operator of TWO_CHAR_OPERATORS) {
    if (pair === operator) return { token: { kind: 'op', value: operator }, next: at + 2 };
  }
  for (const operator of ONE_CHAR_OPERATORS) {
    if (source[at] === operator) return { token: { kind: 'op', value: operator }, next: at + 1 };
  }
  return null;
}
