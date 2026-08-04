/**
 * 🔴 ADR-754 **Β1** — «ποια κελιά διαβάζει αυτός ο τύπος, και με ποιο χρώμα φαίνεται το
 * καθένα;». Καθαρή συνάρτηση: μηδέν React, μηδέν DOM, μηδέν canvas, μηδέν store.
 *
 * ## 🔴 Γιατί ΔΕΝ υπάρχει store για τις αναφορές
 * Το σχέδιο της φάσης προέβλεπε «getter-only store» με τις τρέχουσες αναφορές, που θα το
 * γέμιζε ο επεξεργαστής και θα το διάβαζε ο ζωγράφος. Δεν χρειάστηκε, και η αιτία είναι η
 * **ίδια** που κράτησε την υπόδειξη εκτός κατάστασης (§1): οι αναφορές είναι **παράγωγο του
 * προχείρου**, και το πρόχειρο ζει ήδη στον δρομέα ({@link TableCellCursorState.draft}) που ο
 * `TableRenderer` **ήδη** διαβάζει με getter τη στιγμή του καρέ.
 *
 * Ένα δεύτερο store θα ήταν δεύτερη αλήθεια με υποχρέωση συγχρονισμού σε **κάθε** πάτημα
 * πλήκτρου, σε κάθε `Escape`, σε κάθε undo — δηλαδή ακριβώς η λίστα μονοπατιών που το §1
 * απαρίθμησε για να την απορρίψει. Η πρώτη φορά που θα ξεχνιόταν ένα, ο χρήστης θα έβλεπε
 * χρωματιστά περιγράμματα γύρω από κελιά **που κανένας τύπος δεν διαβάζει πια**.
 *
 * ## 🔑 Ο κέρσορας ΔΕΝ συμμετέχει
 * Σε αντίθεση με το `table-formula-point-state.ts`, εδώ δεν ρωτιέται πού βρίσκεται ο δρομέας:
 * το Excel δείχνει **όλες** τις αναφορές του τύπου ταυτόχρονα, όχι μόνο εκείνη που γράφεται.
 * Πρακτική συνέπεια που μετρά: μηδέν εξάρτηση από το DOM ⇒ η απάντηση είναι διαθέσιμη μέσα
 * στον βρόχο του καμβά, όπου `selectionStart` δεν υπάρχει.
 *
 * ## Το κόστος είναι O(μήκος τύπου), όχι O(πίνακα) — γι' αυτό δεν απομνημονεύεται
 * Τρέχει ανά καρέ όσο ο πίνακας είναι επιλεγμένος. Ένας τύπος είναι δεκάδες χαρακτήρες, οι
 * αναζητήσεις δείκτη περνούν από το **ήδη απομνημονευμένο** `indexById` (WeakMap), και δεν
 * υπάρχει κανένας βρόχος πάνω σε γραμμές ή κελιά. Δηλαδή **δεν** είναι το σχήμα O(εμβαδόν)
 * που πλήρωσε ο ADR-735. Ένα memo θα πρόσθετε κατάσταση —και ερώτημα ακύρωσης— για μετρήσιμο
 * μηδέν.
 *
 * @module subapps/dxf-viewer/bim/table/formula/table-formula-reference-spans
 * @see table-formula-lex.ts — η **μία** γραμματική· εδώ δεν υπάρχει regex αναφοράς
 * @see ../table-cell-range.ts — ο **ένας** ορισμός του «ορθογώνιο κελιών»
 * @see ../../../rendering/entities/table/stamp-table-formula-references.ts — ο ζωγράφος
 * @see docs/centralized-systems/reference/adrs/ADR-754-table-point-mode.md §8 (Β1)
 */

import type { TableModel } from '../../../types/table';
import {
  rawTableCellRangeBounds,
  type TableCellRangeBounds,
  type TableCellRef,
} from '../table-cell-range';
import { resolveWrittenCellRef } from './table-formula-absolute';
import {
  formulaBodyStart,
  tokenizeFormula,
  type TableFormulaToken,
} from './table-formula-lex';

/**
 * Μία **εμφάνιση** αναφοράς μέσα στο κείμενο του τύπου.
 *
 * ⚠️ **Εμφάνιση**, όχι περιοχή: το `=A1+A1*2` δίνει **δύο** εγγραφές με το **ίδιο**
 * {@link colorIndex}. Ο διαχωρισμός δεν είναι σχολαστικότητα — οι δύο καταναλωτές ρωτούν
 * διαφορετικά πράγματα: ο ζωγράφος του καμβά θέλει **μία** ζωγραφιά ανά περιοχή (δύο
 * περιγράμματα στο ίδιο κελί είναι το ίδιο pixel δύο φορές), ενώ ο χρωματισμός του κειμένου
 * (Β2) θέλει **κάθε** εμφάνιση, γιατί βάφει γράμματα σε δύο διαφορετικά σημεία.
 */
export interface TableFormulaReferenceSpan {
  /** Το ορθογώνιο που διαβάζει η αναφορά, σε **δείκτες** του μοντέλου. */
  readonly bounds: TableCellRangeBounds;
  /**
   * Αύξων, **ανά διακριτή περιοχή**, με τη σειρά πρώτης εμφάνισης — 0, 1, 2…
   *
   * Δεν είναι χρώμα: είναι **θέση σε παλέτα**, και η παλέτα ζει στον ζωγράφο. Έτσι το καθαρό
   * module μένει δοκιμάσιμο χωρίς χρώματα, και η οθόνη μπορεί να αλλάξει παλέτα χωρίς να
   * αγγίξει τη γραμματική.
   */
  readonly colorIndex: number;
  /**
   * `[start, end)` σε δείκτες χαρακτήρα του **πλήρους** προχείρου — μαζί με το `=` και τυχόν
   * αρχικά κενά, δηλαδή στο σύστημα συντεταγμένων του `selectionStart`.
   *
   * Ο ζωγράφος του καμβά δεν τα χρειάζεται· τα χρειάζεται το **Β2** (μπλε `E4` μέσα στο
   * κείμενο). Δίνονται εδώ γιατί κοστίζουν μηδέν — υπάρχουν ήδη πάνω στη μονάδα.
   */
  readonly start: number;
  readonly end: number;
}

const EMPTY: readonly TableFormulaReferenceSpan[] = [];

/** Ό,τι διάβασε μια αναφορά: τα δύο άκρα, η έκτασή της, και πού συνεχίζει η σάρωση. */
interface ScannedReference {
  readonly from: TableCellRef;
  readonly to: TableCellRef;
  readonly start: number;
  readonly end: number;
  readonly nextIndex: number;
}

/**
 * Οι αναφορές που περιέχει ένα πρόχειρο, με τη σειρά που εμφανίζονται.
 *
 * Κενός πίνακας —ποτέ `null`— όταν το κείμενο δεν είναι τύπος, όταν ο λεξικογράφος αρνείται
 * (χαρακτήρας εκτός γραμματικής, αλφαριθμητικό που δεν έκλεισε), ή όταν καμία αναφορά δεν
 * δείχνει σε υπαρκτό κελί. Και οι τρεις είναι **κανονικές** καταστάσεις ενός τύπου που
 * γράφεται αυτή τη στιγμή, όχι σφάλματα: ο χρήστης στο μέσο του `=SU` δεν έχει κάνει τίποτα
 * λάθος. Ο καλών απλώς δεν ζωγραφίζει τίποτα.
 */
export function tableFormulaReferenceSpans(
  model: TableModel,
  draft: string,
): readonly TableFormulaReferenceSpan[] {
  const bodyStart = formulaBodyStart(draft);
  if (bodyStart === null) return EMPTY;

  const tokens = tokenizeFormula(draft.slice(bodyStart));
  if (tokens === null) return EMPTY;

  const spans: TableFormulaReferenceSpan[] = [];
  // Περιοχή → θέση παλέτας. Ίδια περιοχή δύο φορές στον ίδιο τύπο ⇒ **ίδιο** χρώμα: αλλιώς
  // το `=A1+A1` θα ζωγράφιζε δύο διαφορετικά περιγράμματα στο ίδιο κελί, το ένα πάνω στο άλλο,
  // και ο χρήστης θα έβλεπε το χρώμα του **δεύτερου** χωρίς να ξέρει γιατί.
  const paletteSlotByRegion = new Map<string, number>();

  let at = 0;
  while (at < tokens.length) {
    const scanned = scanReference(model, tokens, at);
    if (scanned === null) {
      at += 1;
      continue;
    }
    at = scanned.nextIndex;

    const bounds = rawTableCellRangeBounds(model, scanned.from, scanned.to);
    if (!bounds) continue;

    const key = `${bounds.firstRow}:${bounds.firstCol}:${bounds.lastRow}:${bounds.lastCol}`;
    let colorIndex = paletteSlotByRegion.get(key);
    if (colorIndex === undefined) {
      colorIndex = paletteSlotByRegion.size;
      paletteSlotByRegion.set(key, colorIndex);
    }

    spans.push({
      bounds,
      colorIndex,
      start: bodyStart + scanned.start,
      end: bodyStart + scanned.end,
    });
  }

  return spans;
}

/**
 * Διαβάζει **μία** αναφορά που ξεκινά στη μονάδα `at`, ή `null` αν εκεί δεν υπάρχει αναφορά.
 *
 * Το εύρος (`A1:B5`) καταναλώνεται **ολόκληρο** — τρεις μονάδες, μία αναφορά. Είναι η ίδια
 * απόφαση που το §1.2 του ADR χρειάστηκε να πάρει για την αντικατάσταση, και για τον ίδιο
 * λόγο: ένα εύρος δεν είναι «δύο κελιά που τυχαίνει να έχουν άνω τελεία ανάμεσά τους».
 */
function scanReference(
  model: TableModel,
  tokens: readonly TableFormulaToken[],
  at: number,
): ScannedReference | null {
  const head = tokens[at];
  const from = cellRefOf(model, tokens, at);
  if (head === undefined || from === null) return null;

  // Εύρος: `name : name`. Η δεύτερη μονάδα πρέπει να είναι κι αυτή υπαρκτό κελί — αλλιώς το
  // `A1:` που πληκτρολογείται ακόμη θα έδινε μισό εύρος, δηλαδή ορθογώνιο που δεν ζήτησε
  // κανείς. Υποβαθμίζεται σε **σκέτη** αναφορά προς το `A1`, που είναι και η αλήθεια: αυτό
  // μόνο έχει γραφτεί μέχρι στιγμής.
  const separator = tokens[at + 1];
  if (separator?.kind === 'punct' && separator.value === ':') {
    const tail = cellRefOf(model, tokens, at + 2);
    const tailToken = tokens[at + 2];
    if (tail !== null && tailToken !== undefined) {
      return { from, to: tail, start: head.start, end: tailToken.end, nextIndex: at + 3 };
    }
  }

  return { from, to: from, start: head.start, end: head.end, nextIndex: at + 1 };
}

/**
 * Η μονάδα `at` ως **υπαρκτό κελί** του μοντέλου, ή `null`.
 *
 * ## Γιατί ελέγχεται η παρένθεση που ακολουθεί
 * Λεξικά, `SUM` και `A1` είναι το **ίδιο** πράγμα (`name`) — ο λεξικογράφος δεν κρίνει, το
 * γράφει ρητά στην κεφαλίδα του. Το `parseTableCellReference` απορρίπτει ήδη τα περισσότερα
 * ονόματα συναρτήσεων επειδή δεν έχουν τη μορφή «γράμματα + ψηφία», αλλά **όχι όλα**: ένα
 * μελλοντικό `LOG10` ή `T3` περνά τη μορφή, και σε αρκετά μεγάλο πίνακα θα περνούσε και τα
 * όρια. Τότε ο χρήστης θα έβλεπε περίγραμμα γύρω από κελί που **κανείς δεν διαβάζει**.
 *
 * Ο έλεγχος είναι ο ίδιος που κάνει ο αναλυτής: όνομα + `(` ⇒ **κλήση**, ποτέ διεύθυνση.
 */
function cellRefOf(
  model: TableModel,
  tokens: readonly TableFormulaToken[],
  at: number,
): TableCellRef | null {
  const token = tokens[at];
  if (token?.kind !== 'name') return null;

  const next = tokens[at + 1];
  if (next?.kind === 'punct' && next.value === '(') return null;

  // ADR-754 Γ2 — το `$A$1` δείχνει **στα ίδια** κελιά με το `A1`: η απολυτότητα αφορά την
  // αντιγραφή, όχι το τι διαβάζεται τώρα. Άρα το περίγραμμα είναι το ίδιο, και η αποκόλληση
  // του δείκτη γίνεται από τον έναν ιδιοκτήτη του, όχι με regex εδώ.
  return resolveWrittenCellRef(model, token.value);
}
