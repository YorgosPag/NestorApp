/**
 * ADR-763 §13 — **η σύζευξη**: μεταφρασμένα ονόματα (i18n) + δομή (TS) ⇒ οι σειρές του
 * διαλόγου «Ορίσματα συνάρτησης». Καθαρές συναρτήσεις: μέσα κείμενο, έξω δομή.
 *
 * ## 🔴 ΤΟ `;` ΕΔΩ ΔΕΝ ΕΙΝΑΙ ΔΙΑΧΩΡΙΣΤΗΣ ΟΡΙΣΜΑΤΩΝ — ΚΑΙ Η ΔΙΑΚΡΙΣΗ ΕΙΝΑΙ ΟΥΣΙΩΔΗΣ
 * Το i18n κρατά τα ονόματα ως **μία** εγγραφή ανά συνάρτηση
 * (`"κείμενο1;κείμενο2;..."`), χωρισμένα με `;`. Αυτό είναι **μορφή αποθήκευσης** — η ίδια
 * που έγραψε η Φάση 1, με 306 μεταφράσεις ήδη ελεγμένες σε δύο γλώσσες.
 *
 * Ο διαχωριστής **που βλέπει ο χρήστης** στην υπογραφή είναι εντελώς άλλο πράγμα: τον ορίζει
 * η γραμματική του σχεδίου (ADR-761) και είναι `;` **ή** `,` ανάλογα με το locale. Μέχρι
 * σήμερα ο διάλογος τύπωνε αυτούσια την αποθηκευμένη συμβολοσειρά, δηλαδή **δεύτερη αυθεντία
 * για τον διαχωριστή**: με `DEFAULT_TABLE_FORMAT_LOCALE = 'el-GR'` οι δύο συμπίπτουν και όλα
 * φαίνονται σωστά — την ημέρα που το locale γίνει πεδίο του μοντέλου (κάτι που το
 * `table-formula-grammar.ts` σχεδιάζει ρητά), ο διάλογος θα **έδειχνε** `SUM(αριθμός1;…)` ενώ
 * ο τύπος θα **απαιτούσε** κόμμα. Λάθος οδηγία μέσα στο ίδιο παράθυρο που τη διδάσκει.
 *
 * Γι' αυτό το {@link formatSignature} **συνθέτει** την υπογραφή από τα ονόματα, με
 * διαχωριστή που του δίνει ο καλών από τη γραμματική. Η αποθηκευμένη συμβολοσειρά δεν φτάνει
 * ποτέ αυτούσια στην οθόνη.
 *
 * @module subapps/dxf-viewer/bim/table/formula/catalog/formula-signature
 * @see formula-argument-data.ts — η δομή· @see formula-argument-taxonomy.ts — το λεξιλόγιο
 * @see docs/centralized-systems/reference/adrs/ADR-763-table-insert-function-dialog.md §13
 */

import { FORMULA_ARGUMENT_STRUCTURE, FORMULA_MAX_ARGUMENTS } from './formula-argument-data';
import {
  parseKindCode,
  type FormulaArgumentKind,
  type FormulaArgumentSpec,
  type FormulaSignatureSpec,
} from './formula-argument-taxonomy';

/**
 * Ο διαχωριστής **της αποθηκευμένης μετάφρασης**. Δες την κεφαλίδα: δεν έχει καμία σχέση με
 * το `TableFormulaGrammar.argumentSeparator` και δεν επιτρέπεται να συγχυστεί μαζί του.
 */
const NAME_LIST_SEPARATOR = ';';

/** Τα σημάδια «και άλλα» στο τέλος μιας αποθηκευμένης υπογραφής — δεν είναι ορίσματα. */
const ELLIPSIS_TOKENS: ReadonlySet<string> = new Set(['...', '…', '..']);

/** Πόσες γενικές σειρές δείχνει ο διάλογος για συνάρτηση **χωρίς** γνωστά ονόματα. */
const GENERIC_ROW_COUNT = 2;

/**
 * Η αποθηκευμένη συμβολοσειρά → ονόματα ορισμάτων.
 *
 * Τα σημάδια έλλειψης πέφτουν: το `...` του `κείμενο1;κείμενο2;...` **δεν** είναι τρίτο
 * όρισμα, είναι η δήλωση ότι το τελευταίο επαναλαμβάνεται — και αυτή τη δήλωση την κρατά ήδη
 * ο κωδικός ειδών. Δύο πηγές για την ίδια πληροφορία θα απέκλιναν· εδώ η μία **επαληθεύει**
 * την άλλη μέσω του test μήκους.
 */
export function parseArgumentNames(list: string): readonly string[] {
  return list
    .split(NAME_LIST_SEPARATOR)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !ELLIPSIS_TOKENS.has(part));
}

/** Ό,τι χρειάζεται ο επιλύτης από τον κόσμο των μεταφράσεων. */
export interface FormulaSignatureInput {
  /** Το όνομα με τη γραφή του χρήστη (`CEILING.MATH`). */
  readonly name: string;
  /**
   * Η αποθηκευμένη μεταφρασμένη υπογραφή, ή `''` για τις μη τεκμηριωμένες. Ο καλών τη
   * διαβάζει με `t('table.insertFunction.args.' + formulaCatalogKey(name))`.
   */
  readonly argumentNames: string;
  /** Το μεταφρασμένο γενικό όνομα («Όρισμα»), για τις μη τεκμηριωμένες. */
  readonly genericName: string;
}

/**
 * **Η υπογραφή μιας συνάρτησης, έτοιμη για ζωγράφισμα** — και ποτέ `null`.
 *
 * ## Γιατί ο διάλογος ανοίγει και για τις 222 άγνωστες
 * Ο Giorgio ζήτησε τον διάλογο για **όλες**. Για όσες δεν ξέρουμε υπογραφή, η τίμια απάντηση
 * δεν είναι «κλειστή πόρτα» ούτε «εφευρημένες ετικέτες»: είναι γενικά ονόματα με **ζωντανή
 * προεπισκόπηση που δουλεύει**. Η προεπισκόπηση είναι η πραγματική απάντηση στο «τι
 * περιμένει αυτή η συνάρτηση;» — ο χρήστης γράφει, βλέπει το αποτέλεσμα, και ξέρει. Μια
 * εφευρημένη ετικέτα θα του έλεγε ψέματα με σιγουριά.
 *
 * Η υποχρεωτικότητα μένει `unspecified`: κανένα έντονο, κανένας φρουρός στο «OK».
 */
export function resolveFormulaSignature(input: FormulaSignatureInput): FormulaSignatureSpec {
  const names = parseArgumentNames(input.argumentNames);
  const structure = FORMULA_ARGUMENT_STRUCTURE[input.name];
  const parsed = structure === undefined ? null : parseKindCode(structure.k);

  // Η δομή και τα ονόματα πρέπει να συμφωνούν στο πλήθος. Όταν δεν συμφωνούν (κόκκινο σε
  // test, αλλά ας μην κρεμάσει η οθόνη) πέφτουμε στη γενική μορφή: καλύτερα τίμια γενικές
  // ετικέτες παρά μετατοπισμένη στήλη ειδών δίπλα σε σωστά ονόματα.
  if (structure === undefined || parsed === null || names.length !== parsed.kinds.length) {
    return genericSignature(input.name, input.genericName);
  }

  const args = names.map((name, index) => ({
    name,
    kind: parsed.kinds[index],
    requirement: index < structure.req ? ('required' as const) : ('optional' as const),
  }));
  return {
    name: input.name,
    args,
    repeat: parsed.repeatGroup === 0
      ? undefined
      : { groupSize: parsed.repeatGroup, max: FORMULA_MAX_ARGUMENTS },
    named: true,
  };
}

/** `Όρισμα1`, `Όρισμα2`, … — δύο σειρές που μεγαλώνουν, χωρίς καμία αξίωση γνώσης. */
function genericSignature(name: string, genericName: string): FormulaSignatureSpec {
  const args: FormulaArgumentSpec[] = [];
  for (let index = 1; index <= GENERIC_ROW_COUNT; index += 1) {
    args.push({ name: `${genericName}${index}`, kind: 'any', requirement: 'unspecified' });
  }
  return {
    name,
    args,
    repeat: { groupSize: 1, max: FORMULA_MAX_ARGUMENTS },
    named: false,
  };
}

/**
 * 🔴 **Η υπογραφή ΩΣ ΚΕΙΜΕΝΟ** — με τον διαχωριστή της γραμματικής, όχι της αποθήκευσης.
 *
 * Δες την κεφαλίδα για το γιατί αυτή η συνάρτηση υπάρχει αντί για σκέτη εκτύπωση της
 * μεταφρασμένης συμβολοσειράς.
 */
export function formatSignature(spec: FormulaSignatureSpec, separator: string): string {
  const parts = spec.args.map((arg) => arg.name);
  if (spec.repeat !== undefined) parts.push('…');
  return `${spec.name}(${parts.join(separator)})`;
}

/**
 * 🔴 **Πόσες σειρές δείχνει ΤΩΡΑ ο διάλογος** — και γιατί δέχεται «πόσα είναι γεμάτα».
 *
 * Το Excel προσθέτει σειρά μόλις γραφτεί κάτι στην τελευταία, και **σε ομάδα**: το `SUMIFS`
 * κατεβάζει `εύρος_κριτηρίων2` **και** `κριτήρια2` μαζί, ποτέ το μισό ζεύγος (δες
 * {@link FormulaRepeatSpec}).
 *
 * Η συνάρτηση είναι καθαρή και **ιδεμποτής**: ίδιο `filled` ⇒ ίδιες σειρές. Δεν κρατά
 * κατάσταση «πόσες έχω δείξει», γιατί μια τέτοια κατάσταση θα έπρεπε να μηδενίζεται σε κάθε
 * αλλαγή συνάρτησης, σε κάθε άνοιγμα, και σε κάθε αναίρεση — ακριβώς το είδος της σημαίας που
 * το ADR-754 αρνήθηκε να κρατήσει.
 */
export function signatureRows(
  spec: FormulaSignatureSpec,
  filled: number,
): readonly FormulaArgumentSpec[] {
  const repeat = spec.repeat;
  if (repeat === undefined) return spec.args;

  const base = spec.args.length;
  const total = base + wholeGroups(filled + 1 - base, repeat.groupSize, repeat.max - base);
  const rows: FormulaArgumentSpec[] = [...spec.args];
  for (let index = base; index < total; index += 1) {
    rows.push(repeatedRow(spec.args, repeat.groupSize, index));
  }
  return rows;
}

/**
 * 🔴 Πόσες **επιπλέον** σειρές, στρογγυλεμένες σε ολόκληρες ομάδες.
 *
 * ## Το σφάλμα που έπιασε το test, και γιατί δεν ήταν προφανές
 * Η πρώτη γραφή ήταν `max(base, filled + 1)` — «δείξε μία κενή σειρά παραπάνω», που είναι
 * σωστό για κάθε συνάρτηση με ομάδα ενός, δηλαδή για **29 από τις 36**. Στο `SUMIFS` έδινε
 * τέσσερις σειρές: `περιοχή_κριτηρίων2` **χωρίς** το `κριτήρια2` του. Ο χρήστης θα διάλεγε
 * εύρος που δεν έχει κριτήριο να εφαρμοστεί — `#VALUE!` που μοιάζει δικό του λάθος.
 *
 * Η στρογγύλευση προς τα πάνω είναι το σωστό: μόλις αγγίξεις την τελευταία ομάδα, κατεβαίνει
 * **ολόκληρη** η επόμενη. Το ανώτατο κόβεται κι αυτό σε ολόκληρη ομάδα, ώστε να μην μείνει
 * ποτέ μισό ζεύγος στην κορυφή του ορίου.
 */
function wholeGroups(needed: number, groupSize: number, room: number): number {
  if (needed <= 0) return 0;
  const groups = Math.min(Math.ceil(needed / groupSize), Math.floor(room / groupSize));
  return Math.max(groups, 0) * groupSize;
}

/**
 * Η σειρά υπ' αριθμόν `index` όταν ξεπεράσαμε τις δηλωμένες: **πρότυπο** από την
 * επαναλαμβανόμενη ομάδα, με τον αύξοντα αριθμό προωθημένο.
 */
function repeatedRow(
  args: readonly FormulaArgumentSpec[],
  groupSize: number,
  index: number,
): FormulaArgumentSpec {
  const offset = index - args.length;
  const template = args[args.length - groupSize + (offset % groupSize)];
  const ordinal = trailingOrdinal(template.name) + Math.floor(offset / groupSize) + 1;
  return { ...template, name: `${stripOrdinal(template.name)}${ordinal}` };
}

/** Ο αύξων αριθμός στο τέλος ενός ονόματος (`κείμενο2` ⇒ `2`), ή `1` όταν δεν υπάρχει. */
function trailingOrdinal(name: string): number {
  const digits = /(\d+)$/.exec(name);
  return digits === null ? 1 : Number(digits[1]);
}

/** Το όνομα χωρίς τον αύξοντα αριθμό του (`κείμενο2` ⇒ `κείμενο`). */
function stripOrdinal(name: string): string {
  return name.replace(/\d+$/, '');
}

/**
 * Έχει αυτή η συνάρτηση **γραμμένη περιγραφή για κάθε όρισμά της**;
 *
 * Είναι ο ίδιος φρουρός με το `documented` του καταλόγου, στο ίδιο πνεύμα: η απουσία
 * περιγραφής είναι **δηλωμένη**, όχι ανιχνευόμενη από αστοχία του i18next (δες το πεδίο `h`
 * στο {@link FormulaArgumentStructure} για το γιατί η ανίχνευση θα ήταν λάθος).
 */
export function hasArgumentHelp(name: string): boolean {
  return FORMULA_ARGUMENT_STRUCTURE[name]?.h === true;
}

/**
 * 🔴 **Ποιο κλειδί περιγραφής διαβάζει η σειρά `rowIndex`** — και γιατί δεν είναι ο ίδιος ο
 * `rowIndex`.
 *
 * Οι επαναλαμβανόμενες σειρές δεν έχουν δική τους περιγραφή, και δεν πρέπει να έχουν: το
 * `Κείμενο7` του `CONCATENATE` σημαίνει **ακριβώς** ό,τι και το `Κείμενο1`, και μια δεύτερη
 * γραφή του ίδιου κειμένου θα ήταν 255 μεταφράσεις ανά συνάρτηση που αποκλίνουν. Άρα η σειρά
 * που ξεπερνά τις δηλωμένες δανείζεται την περιγραφή **της θέσης της μέσα στην ομάδα** — με
 * τον ίδιο ακριβώς υπολογισμό που της δίνει το όνομά της το {@link repeatedRow}.
 *
 * ⚠️ Η κοινή αριθμητική είναι σκόπιμη και **οφείλει** να μείνει κοινή: αν οι δύο αποκλίνουν,
 * η σειρά `κριτήρια2` θα διάβαζε την περιγραφή του `περιοχή_κριτηρίων` — σωστό όνομα πάνω από
 * λάθος επεξήγηση, που κανένα σφάλμα δεν θα ανέφερε.
 *
 * Επιστρέφει `null` όταν δεν υπάρχει περιγραφή να δειχτεί: μη τεκμηριωμένη συνάρτηση, γενική
 * υπογραφή (`named: false`), ή σειρά εκτός κάθε ομάδας.
 */
export function argumentHelpIndex(spec: FormulaSignatureSpec, rowIndex: number): number | null {
  if (!spec.named || !hasArgumentHelp(spec.name) || rowIndex < 0) return null;
  if (rowIndex < spec.args.length) return rowIndex;

  const repeat = spec.repeat;
  if (repeat === undefined) return null;
  const offset = rowIndex - spec.args.length;
  return spec.args.length - repeat.groupSize + (offset % repeat.groupSize);
}

/** Τα είδη, για καταναλωτές που ζητούν τη μεταφρασμένη ετικέτα τους. Δες το i18n. */
export type { FormulaArgumentKind };
