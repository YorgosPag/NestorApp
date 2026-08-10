/**
 * 🔴 ADR-753 Φ1 — **μορφοποίηση ανά χαρακτήρα μέσα σε κελί**: οι καθαρές πράξεις πίσω από το
 * mini toolbar της επιλογής κειμένου. Μηδέν React, μηδέν DOM, μηδέν μοντέλο σκηνής.
 *
 * Ο αδελφός του `table-axis-style-ops.ts` ένα επίπεδο πιο μέσα: εκείνο απαντά «πώς είναι αυτή
 * η **γραμμή/στήλη**», αυτό «πώς είναι **αυτά τα γράμματα**».
 *
 * ## 🔴 Η ΜΙΑ ΜΗΧΑΝΙΚΗ: ξεδίπλωσε → εφάρμοσε → ξαναχτίσε
 *
 * Κάθε πράξη εδώ περνά από τον **ίδιο** δρόμο: ο πίνακας runs ξεδιπλώνεται σε στυλ **ανά
 * χαρακτήρα** ({@link expandStyles}), αλλάζει ό,τι πρέπει, και ξαναχτίζεται συγχωνεύοντας
 * ίσους γείτονες ({@link rebuildRuns}).
 *
 * Δεν είναι ο «γρήγορος» δρόμος — ο κλασικός interval splice θα ήταν `O(πλήθος runs)` αντί για
 * `O(μήκος κειμένου)`. Είναι ο **σωστός** εδώ, για δύο λόγους:
 *
 * 1. Ένα κελί πίνακα σχεδίου έχει δεκάδες χαρακτήρες, όχι σελίδες. Η διαφορά δεν μετριέται.
 * 2. Οι πέντε αναλλοίωτες της κανονικοποίησης (ταξινόμηση · καμία επικάλυψη · κανένα κενό ·
 *    κανένα άδειο στυλ · ίσοι γείτονες συγχωνευμένοι) ισχύουν **εκ κατασκευής**. Με splice θα
 *    ήταν πέντε χειροκίνητοι έλεγχοι που κάθε νέα πράξη πρέπει να θυμάται — και η επικάλυψη
 *    δύο runs είναι ακριβώς η κατάσταση που θα ρωτούσε **τέσσερις** ζωγράφους «ποιο νικά;» και
 *    θα έπαιρνε τέσσερις απαντήσεις.
 *
 * Δηλαδή η επικάλυψη δεν είναι σφάλμα που αποφεύγουμε· είναι κατάσταση **μη εκφράσιμη**.
 *
 * ## Η εγγύηση ταυτότητας — ίδια με κάθε γραφέα του πίνακα
 * Καμία πραγματική αλλαγή ⇒ επιστρέφεται ο **ίδιος** πίνακας by-reference. Χωρίς αυτό, κάθε
 * πάτημα «Β» πάνω σε ήδη έντονη επιλογή θα γεννούσε νέο αντικείμενο μοντέλου, δηλαδή βήμα undo
 * που δεν αναιρεί τίποτα — και ακύρωση των `WeakMap` μνημών χωρίς λόγο. Την ίδια εγγύηση δίνουν
 * ήδη `setPersistedCellText`, `setAxisStyleField` και `setTableEdges`.
 *
 * ## 🔴 ADR-753 Φ4 — Η **ΑΝΑΓΝΩΣΗ** ΜΕΤΑΚΟΜΙΣΕ (N.7.1)
 * Η ενότητα «τι δείχνει το κουμπί» ζει πλέον στο `table-cell-run-state.ts`: η Φ4 πρόσθεσε τον
 * δεύτερο αναγνώστη και το αρχείο πέρασε τις **500 γραμμές**. Η τομή είναι η ίδια που ονόμαζαν
 * ήδη οι δύο επικεφαλίδες («πώς αλλάζει» / «τι ισχύει»), και η ίδια που έχει ένα επίπεδο έξω ο
 * πίνακας (`table-cell-style-scan.ts`).
 *
 * ⚠️ Τρεις συναρτήσεις της «μίας μηχανικής» ({@link expandStyles}, {@link effectiveRange},
 * {@link clampRange}) **εξάγονται** γι' αυτόν τον έναν καταναλωτή. Δεν είναι δημόσιο API: είναι
 * ο μόνος τρόπος να μη διπλασιαστεί ο κανόνας «πού κοιτά ο δρομέας» — δύο εκφράσεις του θα
 * σήμαιναν κουμπί που **δείχνει** την κατάσταση ενός χαρακτήρα και **γράφει** σε άλλον.
 *
 * @module subapps/dxf-viewer/bim/table/table-cell-run-ops
 * @see types/table.ts — `TableCellTextRun`, `TableTextRunStyle` και το γιατί δείκτες
 * @see bim/table/table-cell-run-state.ts — η ανάγνωση (τι δείχνει το χειριστήριο)
 * @see bim/table/table-axis-style-ops.ts — η ίδια δουλειά ένα επίπεδο έξω (άξονας)
 * @see docs/centralized-systems/reference/adrs/ADR-753-table-cell-rich-text.md
 */

import type { TableCellTextRun, TableTextRunStyle } from '../../types/table';

/**
 * 🔴 Τα κλειδιά ενός run **σε χρόνο εκτέλεσης**, με τον μεταγλωττιστή να επιβάλλει πληρότητα.
 *
 * Ο τύπος δεν παράγει λίστα από μόνος του, οπότε η λίστα πρέπει να γραφτεί — αλλά **όχι** ως
 * σκέτος πίνακας ονομάτων, που θα έμενε πίσω σιωπηλά στην επόμενη προσθήκη πεδίου. Το
 * `Record<keyof …, true>` απαιτεί **ακριβώς** τα κλειδιά του τύπου: ξεχασμένο ⇒ σφάλμα
 * μεταγλώττισης, περιττό ⇒ σφάλμα μεταγλώττισης.
 *
 * Ίδιο πρόβλημα, ίδια οικογένεια λύσης με το `TableAxisNumericKey` του άξονα: **καμία τρίτη
 * χειρόγραφη λίστα που κανείς δεν διασταυρώνει.**
 */
const RUN_STYLE_KEY_SET: Record<keyof TableTextRunStyle, true> = {
  bold: true,
  italic: true,
  underline: true,
  textColorHex: true,
  textHeightMm: true,
  fontFamily: true,
};

export type TableTextRunStyleKey = keyof TableTextRunStyle;

/**
 * Τα πεδία ενός run που ο ζωγράφος επιλύει σε **αριθμό**.
 *
 * Παράγεται από τον ίδιο τον τύπο, ίδια οικογένεια λύσης με το `TableCellNumericKey` του
 * κελιού: μια χειρόγραφη ένωση `'textHeightMm' | …` θα έμενε πίσω σιωπηλά την ημέρα που ένα
 * πεδίο αλλάξει τύπο.
 */
export type TableTextRunNumericKey = {
  [K in TableTextRunStyleKey]: NonNullable<TableTextRunStyle[K]> extends number ? K : never;
}[TableTextRunStyleKey];

/** Τα κλειδιά ως πίνακας — μία φορά, από το σύνολο που ελέγχει ο μεταγλωττιστής. */
const RUN_STYLE_KEYS = Object.keys(RUN_STYLE_KEY_SET) as readonly TableTextRunStyleKey[];

/**
 * 🔴 ADR-739 — **έχει αυτό το πεδίο στυλ νόημα και ΑΝΑ ΧΑΡΑΚΤΗΡΑ;**
 *
 * Η μορφοποίηση ενός ολόκληρου κελιού πρέπει να ξέρει την απάντηση, γιατί τα runs **νικούν**
 * το κελί στην επίλυση: πατώντας «Β» σε κελί που περιέχει έστω ένα run με `bold: false`, η
 * εγγραφή στο κελί δεν θα φαινόταν **πουθενά** — το κουμπί θα έλεγε ψέματα. Ο γραφέας του
 * κελιού ισοπεδώνει λοιπόν το **ίδιο** πεδίο στα runs, και ρωτά εδώ αν αυτό το πεδίο υπάρχει
 * καν εκεί (το `align` και το `fillColorHex` δεν έχουν νόημα σε επιλογή γραμμάτων).
 *
 * Predicate και όχι εξαγωγή της λίστας: ο καλών κάνει **μία** ερώτηση ανά εγγραφή, και μια
 * εξαγόμενη λίστα θα καλούσε τον επόμενο να χτίσει δικό του `Set` — δεύτερη, αποκλίνουσα
 * απάντηση στο «ποια πεδία είναι πεδία run».
 */
export function isTableTextRunStyleKey(key: string): key is TableTextRunStyleKey {
  return Object.prototype.hasOwnProperty.call(RUN_STYLE_KEY_SET, key);
}

/**
 * Ένα εύρος χαρακτήρων, με τη σύμβαση του DOM (`selectionStart`/`selectionEnd`) και του
 * `String.prototype.slice`: `end` **αποκλειστικό**.
 */
export interface TableTextRange {
  readonly start: number;
  readonly end: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Εγγραφή
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Θέτει **ένα** πεδίο στους χαρακτήρες ενός εύρους.
 *
 * ```
 *   value === undefined  →  ΑΦΑΙΡΕΣΕ το πεδίο (πίσω στην κληρονομιά του κελιού)
 *   αλλιώς               →  ρητή τιμή
 * ```
 *
 * Ένα πεδίο τη φορά και όχι patch αντικείμενο — **ίδια αιτιολογία με τον άξονα**: σε ένα patch
 * το `{ bold: undefined }` είναι δυσδιάκριτο από το «δεν ανέφερα καθόλου το bold», δηλαδή η
 * αφαίρεση (το μισό αυτού του toolbar) δεν θα μπορούσε καν να εκφραστεί.
 *
 * Το `textLength` δεν είναι διακοσμητικό: χωρίς αυτό, ένα εύρος πέρα από το τέλος του κειμένου
 * θα γεννούσε run που δείχνει στο πουθενά, και θα επιβίωνε στο JSON.
 */
export function setCellRunStyleField<K extends TableTextRunStyleKey>(
  runs: readonly TableCellTextRun[] | undefined,
  textLength: number,
  range: TableTextRange,
  key: K,
  value: TableTextRunStyle[K],
): readonly TableCellTextRun[] | undefined {
  return editStyles(runs, textLength, range, (style) => patchStyle(style, key, value));
}

/**
 * Σβήνει **κάθε** ρητή μορφοποίηση μέσα στο εύρος — η «Απαλοιφή μορφοποίησης» του Excel,
 * περιορισμένη στους επιλεγμένους χαρακτήρες.
 *
 * Χωριστή από ένα «θέσε κάθε πεδίο σε `undefined`» με βρόχο: εκείνο θα ήταν έξι περάσματα
 * ξεδιπλώματος/ξαναχτισίματος για μία εννοιολογικά **μία** πράξη, και θα ξανάγραφε τη λίστα
 * κλειδιών σε δεύτερο σημείο.
 */
export function clearCellRunStyles(
  runs: readonly TableCellTextRun[] | undefined,
  textLength: number,
  range: TableTextRange,
): readonly TableCellTextRun[] | undefined {
  return editStyles(runs, textLength, range, () => undefined);
}

/**
 * 🔴 **Οι δείκτες ακολουθούν το κείμενο** — αλλιώς η μορφοποίηση βάφει άλλα γράμματα.
 *
 * Τα runs δείχνουν σε **θέσεις χαρακτήρων** του `TableCell.value`. Μια πληκτρολόγηση στην αρχή
 * του κελιού μετακινεί κάθε επόμενο γράμμα κατά ένα· runs που έμεναν ακίνητα θα έβαφαν σιωπηλά
 * λάθος τμήμα, και μόνο **μετά** την επόμενη αλλαγή — δηλαδή το ελάττωμα θα εμφανιζόταν μακριά
 * από την αιτία του.
 *
 * ## Ο κανόνας: κοινό πρόθεμα + κοινό επίθεμα
 * ```
 *   ┌ κοινό πρόθεμα ┬─ αλλαγμένη ζώνη ─┬ κοινό επίθεμα ┐
 *     αμετάβλητα      παίρνει το στυλ    μετατοπισμένα
 *                     του χαρακτήρα      κατά (νέο−παλιό)
 *                     ΑΡΙΣΤΕΡΑ της
 * ```
 *
 * Η **κληρονομιά από αριστερά** δεν είναι αυθαίρετη: είναι ό,τι κάνει κάθε επεξεργαστής όταν
 * συνεχίζεις να γράφεις μέσα σε έντονη λέξη, και η μόνη επιλογή που δεν εκπλήσσει. Στη θέση 0
 * δεν υπάρχει αριστερά, οπότε το νέο κείμενο γεννιέται **άβαφο** — σωστό: κείμενο πριν από
 * κάθε μορφοποίηση δεν κληρονομεί από το μέλλον του.
 *
 * ⚠️ **ΔΕΝ είναι diff, και δεν πρέπει να γίνει.** Πρόθεμα+επίθεμα καλύπτει ακριβώς ό,τι παράγει
 * ένα `<textarea>`: πληκτρολόγηση, `Backspace`/`Delete`, επικόλληση, αντικατάσταση επιλογής.
 * Ένας πραγματικός αλγόριθμος διαφορών θα ήταν μηχανή για σενάρια που καμία διαδρομή δεν
 * παράγει — και θα έδινε **άλλο** αποτέλεσμα στην απλή περίπτωση («ΑΒΑΒ» → «ΑΒ»), χωρίς κανέναν
 * να μπορεί να πει ποιο είναι το σωστό.
 */
export function remapCellTextRuns(
  runs: readonly TableCellTextRun[] | undefined,
  oldText: string,
  newText: string,
): readonly TableCellTextRun[] | undefined {
  if (!runs || runs.length === 0) return runs;
  if (oldText === newText) return runs;

  const prefix = commonPrefixLength(oldText, newText);
  const suffix = commonSuffixLength(oldText, newText, prefix);
  const old = expandStyles(runs, oldText.length);
  // Ό,τι πληκτρολογήθηκε συνεχίζει τη μορφοποίηση του γράμματος αριστερά του.
  const carried = prefix > 0 ? old[prefix - 1] : undefined;
  const delta = newText.length - oldText.length;

  const next: (TableTextRunStyle | undefined)[] = [];
  for (let i = 0; i < newText.length; i += 1) {
    if (i < prefix) next.push(old[i]);
    else if (i >= newText.length - suffix) next.push(old[i - delta]);
    else next.push(carried);
  }
  return sameOrNew(runs, rebuildRuns(next));
}

/**
 * 🔴 ADR-739 §58 Γ2 — τα runs **ενός τμήματος** του κειμένου, με δείκτες **σχετικούς** στο
 * τμήμα.
 *
 * ## Γιατί το χρειάστηκε η αναδίπλωση
 * Η αναδίπλωση σπάει το κείμενο ενός κελιού σε N οπτικές γραμμές, και **κάθε γραμμή είναι
 * αυτόνομη** για τη διάταξη: έχει δικά της τμήματα, δικό της πλάτος, δική της γραμμή βάσης.
 * Τα `runs` όμως δηλώνονται σε δείκτες του **ακέραιου** κειμένου του κελιού. Χωρίς αυτή τη
 * μετατόπιση, ένα «έντονο» στους χαρακτήρες 20-30 θα εφαρμοζόταν στους χαρακτήρες 20-30 της
 * **δεύτερης γραμμής** — δηλαδή η μορφοποίηση θα μετακινούνταν μόνη της με κάθε αλλαγή
 * πλάτους στήλης.
 *
 * ## Γιατί ΕΔΩ και όχι μέσα στην αναδίπλωση
 * Είναι πράξη πάνω σε runs, και αυτό το module είναι το SSoT τους (ADR-753 Φ1): εδώ ζουν ήδη
 * η κανονικοποίηση, η συγχώνευση και η μετατόπιση. Γραμμένη μέσα στη μηχανή διάταξης θα ήταν
 * δεύτερος τόπος που ξέρει τι σημαίνει «run που τέμνει εύρος» — και ο πρώτος που θα αποκλίνει
 * όταν το σχήμα των runs αποκτήσει πεδίο.
 *
 * Τα runs είναι ήδη ταξινομημένα και χωρίς επικαλύψεις, οπότε η τομή διατηρεί και τα δύο.
 * Επιστρέφει `undefined` όταν κανένα run δεν αγγίζει το τμήμα — η **ίδια** σύμβαση «απόν
 * όταν δεν λέει τίποτα» με το υπόλοιπο σχήμα, ώστε ένα κελί χωρίς μορφοποίηση να παράγει
 * byte-ταυτόσημη διάταξη με πριν.
 */
export function sliceCellTextRuns(
  runs: readonly TableCellTextRun[] | undefined,
  start: number,
  end: number,
): readonly TableCellTextRun[] | undefined {
  if (!runs || runs.length === 0 || end <= start) return undefined;

  const out: TableCellTextRun[] = [];
  for (const run of runs) {
    const from = Math.max(run.start, start);
    const to = Math.min(run.end, end);
    if (to <= from) continue;
    out.push({ start: from - start, end: to - start, style: run.style });
  }
  return out.length > 0 ? out : undefined;
}

// ──────────────────────────────────────────────────────────────────────────────
// Ιδιωτικά — η μία μηχανική
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Ο κοινός σκελετός κάθε εγγραφής: ξεδίπλωσε, εφάρμοσε τον μετασχηματισμό στο εύρος, ξαναχτίσε.
 *
 * Γραμμένος **μία** φορά: οι δύο δημόσιοι γραφείς διαφέρουν μόνο στο τι κάνουν σε **ένα** στυλ,
 * και δύο σώματα θα ήταν sibling clone με δύο πιθανές απαντήσεις στο ίδιο clamp.
 */
function editStyles(
  runs: readonly TableCellTextRun[] | undefined,
  textLength: number,
  range: TableTextRange,
  transform: (style: TableTextRunStyle | undefined) => TableTextRunStyle | undefined,
): readonly TableCellTextRun[] | undefined {
  const { start, end } = clampRange(range, textLength);
  if (start >= end) return runs;

  const styles = expandStyles(runs, textLength);
  for (let i = start; i < end; i += 1) styles[i] = transform(styles[i]);
  return sameOrNew(runs, rebuildRuns(styles));
}

/**
 * Τα runs ως στυλ **ανά χαρακτήρα**. Θέση χωρίς run ⇒ `undefined` (κληρονομεί από το κελί).
 *
 * Ανθεκτικό σε μη κανονικοποιημένη είσοδο **επίτηδες**: ο τύπος υπόσχεται κανονικοποίηση, αλλά
 * η υπόσχεση αφορά ό,τι παράγει αυτό το module — ένα αποθηκευμένο αρχείο από χέρι, μια
 * μελλοντική εισαγωγή `.xlsx` ή ένα μπαγιάτικο run μετά από undo δεν δεσμεύονται από αυτήν. Το
 * κόστος της ανοχής είναι μηδέν (η τελευταία εγγραφή κερδίζει)· το κόστος της εμπιστοσύνης θα
 * ήταν σιωπηλά κατεστραμμένο κείμενο.
 */
export function expandStyles(
  runs: readonly TableCellTextRun[] | undefined,
  textLength: number,
): (TableTextRunStyle | undefined)[] {
  const styles = new Array<TableTextRunStyle | undefined>(Math.max(0, textLength)).fill(undefined);
  if (!runs) return styles;

  for (const run of runs) {
    const from = Math.max(0, run.start);
    const to = Math.min(styles.length, run.end);
    for (let i = from; i < to; i += 1) styles[i] = run.style;
  }
  return styles;
}

/**
 * Από στυλ ανά χαρακτήρα, πίσω σε runs — **εδώ γεννιούνται και οι πέντε αναλλοίωτες**.
 *
 * Η σάρωση είναι αύξουσα (⇒ ταξινομημένα), κάθε χαρακτήρας ανήκει σε ένα ακριβώς run
 * (⇒ καμία επικάλυψη), ένα run κλείνει μόνο με `start < end` (⇒ κανένα κενό), τα άδεια στυλ
 * πετιούνται πριν καν μπουν (⇒ κανένα `{}`), και ίσοι γείτονες δεν ανοίγουν νέο run
 * (⇒ συγχωνευμένοι).
 *
 * `undefined` όταν δεν έμεινε κανένα run: ένα `runs: []` θα ταξίδευε στο JSON, θα εμφανιζόταν
 * σε κάθε diff και θα έκανε το «έχει μορφοποίηση;» να απαντιέται `true` για κάτι που δεν
 * μορφοποιεί τίποτα. Ίδια απόφαση με το `styleOverride: {}` του άξονα.
 */
function rebuildRuns(
  styles: readonly (TableTextRunStyle | undefined)[],
): readonly TableCellTextRun[] | undefined {
  const out: TableCellTextRun[] = [];
  let open: TableTextRunStyle | undefined;
  let openAt = 0;

  const close = (at: number): void => {
    if (open !== undefined && at > openAt) out.push({ start: openAt, end: at, style: open });
  };

  for (let i = 0; i < styles.length; i += 1) {
    const style = emptyToUndefined(styles[i]);
    if (sameStyle(style, open)) continue;
    close(i);
    open = style;
    openAt = i;
  }
  close(styles.length);

  return out.length > 0 ? out : undefined;
}

/** Η νέα μορφή ενός στυλ μετά την αλλαγή ενός πεδίου· `undefined` όταν δεν έμεινε τίποτα. */
function patchStyle<K extends TableTextRunStyleKey>(
  current: TableTextRunStyle | undefined,
  key: K,
  value: TableTextRunStyle[K],
): TableTextRunStyle | undefined {
  const next: Record<string, unknown> = { ...current };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return emptyToUndefined(next as TableTextRunStyle);
}

/** Ένα στυλ χωρίς κανένα δηλωμένο πεδίο **δεν είναι** στυλ. */
function emptyToUndefined(style: TableTextRunStyle | undefined): TableTextRunStyle | undefined {
  if (style === undefined) return undefined;
  return RUN_STYLE_KEYS.some((key) => style[key] !== undefined) ? style : undefined;
}

/**
 * Δύο στυλ λένε το ίδιο πράγμα;
 *
 * Πεδίο-πεδίο πάνω στο ελεγμένο σύνολο κλειδιών, **ποτέ** `JSON.stringify`: εκείνο εξαρτάται
 * από τη **σειρά εισαγωγής** των κλειδιών, οπότε `{bold, italic}` και `{italic, bold}` —
 * απολύτως ίδια στυλ, παραγμένα από δύο διαφορετικές σειρές πατημάτων— θα κρίνονταν διαφορετικά.
 * Δύο γειτονικά runs δεν θα συγχωνεύονταν ποτέ, και η εγγύηση ταυτότητας θα έλεγε «άλλαξε» για
 * κάθε πάτημα που δεν αλλάζει τίποτα.
 */
function sameStyle(a: TableTextRunStyle | undefined, b: TableTextRunStyle | undefined): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined) return false;
  return RUN_STYLE_KEYS.every((key) => a[key] === b[key]);
}

/**
 * Η **εγγύηση ταυτότητας**: δομικά ίσο αποτέλεσμα ⇒ ο αρχικός πίνακας by-reference.
 *
 * Δες την κεφαλίδα για το τι σπάει χωρίς αυτήν (βήματα undo για το τίποτα, ακύρωση μνημών).
 */
function sameOrNew(
  previous: readonly TableCellTextRun[] | undefined,
  next: readonly TableCellTextRun[] | undefined,
): readonly TableCellTextRun[] | undefined {
  if (previous === undefined || next === undefined) {
    return previous === undefined && next === undefined ? previous : next;
  }
  if (previous.length !== next.length) return next;

  const identical = previous.every((run, i) =>
    run.start === next[i].start && run.end === next[i].end && sameStyle(run.style, next[i].style));
  return identical ? previous : next;
}

/**
 * 🔴 **Ποιους χαρακτήρες κοιτά ΜΙΑ ΑΝΑΓΝΩΣΗ** — ο ΕΝΑΣ κανόνας, για κάθε αναγνώστη.
 *
 * Δύο αναγνώστες ρωτούν διαφορετικά πράγματα για την **ίδια** διαδρομή («συμφωνούν;» και
 * «ποια τα άκρα;»), και ο κανόνας «κενή επιλογή ⇒ ο χαρακτήρας **αριστερά**» πρέπει να είναι
 * ένας: δύο εκφράσεις του θα σήμαιναν κουμπί που **δείχνει** την κατάσταση ενός χαρακτήρα και
 * **γράφει** σε άλλον — απόκλιση ορατή μόνο με τον δρομέα σε ένα συγκεκριμένο σημείο.
 *
 * ⚠️ Το `to` μπορεί να ξεπεράσει το `textLength` στο **κενό** κείμενο (`from = to = 0` ⇒ ο
 * βρόχος δεν τρέχει), και αυτό είναι σωστό: `styles[i]` είναι τότε `undefined` και ο κάθε
 * αναγνώστης πέφτει στην κληρονομιά — καμία ειδική περίπτωση σε δύο σημεία.
 */
export function effectiveRange(range: TableTextRange, textLength: number): { from: number; to: number } {
  const { start, end } = clampRange(range, textLength);
  if (start !== end) return { from: start, to: end };
  const from = Math.max(0, start - 1);
  return { from, to: Math.min(from + 1, Math.max(0, textLength)) };
}

/** Το εύρος μέσα στα όρια του κειμένου, με τα άκρα σε σειρά. Μπαγιάτικη επιλογή ⇒ κενό. */
export function clampRange(range: TableTextRange, textLength: number): TableTextRange {
  const limit = Math.max(0, textLength);
  const lo = Math.min(range.start, range.end);
  const hi = Math.max(range.start, range.end);
  return { start: clamp(lo, limit), end: clamp(hi, limit) };
}

function clamp(value: number, limit: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(0, Math.trunc(value)), limit);
}

function commonPrefixLength(a: string, b: string): number {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a[i] === b[i]) i += 1;
  return i;
}

/**
 * Το κοινό επίθεμα, **χωρίς να ξαναμετρήσει ό,τι ήδη μέτρησε το πρόθεμα.**
 *
 * Ο φραγμός δεν είναι μικροβελτίωση: για `'αα'` → `'ααα'` το πρόθεμα είναι 2 και το ανεξάρτητο
 * επίθεμα επίσης 2, δηλαδή 4 χαρακτήρες «αμετάβλητοι» σε κείμενο 3 — και η αλλαγμένη ζώνη θα
 * έβγαινε **αρνητική**. Το `max` κρατά τα δύο να μη σκεπάζονται.
 */
function commonSuffixLength(a: string, b: string, prefix: number): number {
  const max = Math.min(a.length, b.length) - prefix;
  let i = 0;
  while (i < max && a[a.length - 1 - i] === b[b.length - 1 - i]) i += 1;
  return i;
}
