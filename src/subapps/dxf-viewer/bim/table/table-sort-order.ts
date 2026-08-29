/**
 * 🔴 ADR-828 Φ4β — **ΠΟΙΑ ΓΡΑΜΜΗ ΠΑΕΙ ΠΡΙΝ ΑΠΟ ΠΟΙΑ.** Καθαρή σύγκριση: μηδέν μοντέλο,
 * μηδέν μετάθεση, μηδέν εγγραφή.
 *
 * ## 🔑 Η ΦΥΣΙΚΗ ΣΕΙΡΑ ΔΕΝ ΞΑΝΑΓΡΑΦΕΤΑΙ ΕΔΩ
 * Το «κείμενο ή αριθμός, με τα κενά τελευταία» έχει **έναν** ορισμό στο έργο:
 * {@link compareSortValues} ({@link module:lib/array-utils}), που γεννήθηκε ακριβώς επειδή
 * τρεις λίστες τον είχαν αντιγράψει και το CHECK 3.28 τους μέτρησε. Είναι και **σωστός για
 * φύλλο**: κενά τελευταία σε **αμφότερες** τις φορές (σύμβαση υπολογιστικού φύλλου, όχι SQL
 * `NULLS FIRST`), και ρητό `el` ώστε το «Ά» να κάθεται δίπλα στο «Α» και όχι μετά το «Ω».
 *
 * Αυτό το module προσθέτει **μόνο** ό,τι εκείνο δεν μπορεί να ξέρει: τη διάταξη που δεν ζει
 * στα δεδομένα αλλά σε **λίστα** («Ιανουάριος < Φεβρουάριος», «Ισόγειο < Α΄ όροφος»).
 *
 * @module subapps/dxf-viewer/bim/table/table-sort-order
 * @see lib/array-utils.ts — ο ΕΝΑΣ ορισμός της φυσικής σειράς
 * @see docs/centralized-systems/reference/adrs/ADR-828-table-autofill-series.md §8
 */

import { compareSortValues, type SortableValue } from '@/lib/array-utils';
import { matchNameList } from '@/lib/string/name-list-match';
import type { TableSortCriterion } from './table-sort-types';

/** Η τιμή μιας γραμμής για **ένα** κριτήριο: ό,τι διάβασε ο καλών από το κελί. */
export interface TableSortKey {
  /** Ο αριθμός του κελιού, αν είναι αριθμός· αλλιώς `null`. */
  readonly numeric: number | null;
  /** Το κείμενο του κελιού, ήδη `trim`-αρισμένο· κενό = άδειο κελί. */
  readonly text: string;
}

/**
 * Σύγκριση **ενός** κριτηρίου.
 *
 * ## 🔴 Η ΘΕΣΗ ΣΤΗ ΛΙΣΤΑ ΝΙΚΑΕΙ ΤΗ ΦΥΣΙΚΗ ΣΕΙΡΑ — και ό,τι λείπει πάει ΜΕΤΑ
 * Δύο μέλη της λίστας συγκρίνονται με τη **θέση** τους. Ένα μέλος και ένα μη-μέλος: το μέλος
 * πρώτο. Δύο μη-μέλη: πέφτουν πίσω στη φυσική σειρά, γιατί η λίστα δεν έχει γνώμη γι' αυτά.
 *
 * ⚠️ Η φορά **δεν** αντιστρέφει τον κανόνα «τα μη-μέλη μετά», όπως δεν αντιστρέφει και τα κενά
 * ({@link compareSortValues}): ο άνθρωπος που ταξινομεί ψάχνει άκρο, και μια γραμμή που η
 * λίστα δεν αναγνωρίζει δεν είναι υποψήφια για κανένα από τα δύο. Η αντίστροφη επιλογή θα
 * έφερνε τα άσχετα στην κορυφή κάθε φθίνουσας ταξινόμησης.
 */
export function compareByCriterion(
  a: TableSortKey,
  b: TableSortKey,
  criterion: TableSortCriterion,
): number {
  const direction = criterion.descending ? 'desc' : 'asc';

  if (criterion.byList !== undefined) {
    const list = [criterion.byList];
    const aIndex = matchNameList(a.text, list)?.index ?? null;
    const bIndex = matchNameList(b.text, list)?.index ?? null;
    if (aIndex !== null && bIndex !== null) {
      return criterion.descending ? bIndex - aIndex : aIndex - bIndex;
    }
    if (aIndex !== null) return -1;
    if (bIndex !== null) return 1;
  }

  return compareSortValues(sortableOf(a), sortableOf(b), direction);
}

/**
 * Ολόκληρη η σύγκριση: το πρώτο κριτήριο που **δεν** ισοβαθμεί αποφασίζει.
 *
 * Επιστροφή `0` σημαίνει «ισοβαθμία σε όλα τα επίπεδα» — και τότε η σειρά κρίνεται από τη
 * **σταθερότητα** της `Array.prototype.sort` (εγγυημένη από την ES2019 σε κάθε μηχανή), δηλαδή
 * οι ισόβαθμες γραμμές μένουν όπως ήταν. Είναι η μόνη απάντηση που δεν εφευρίσκει διάταξη:
 * ένα δεύτερο κρυφό κριτήριο («κατά δείκτη γραμμής») θα ήταν το ίδιο πράγμα γραμμένο δύο φορές.
 */
export function compareBySortCriteria(
  a: readonly TableSortKey[],
  b: readonly TableSortKey[],
  criteria: readonly TableSortCriterion[],
): number {
  for (let level = 0; level < criteria.length; level += 1) {
    const verdict = compareByCriterion(a[level], b[level], criteria[level]);
    if (verdict !== 0) return verdict;
  }
  return 0;
}

/**
 * Το κλειδί ως τιμή που καταλαβαίνει η φυσική σύγκριση.
 *
 * ⚠️ Το **κενό γίνεται `null`** και όχι κενή συμβολοσειρά: μόνο έτσι πέφτει στον κανόνα «τα
 * απόντα πάνε τελευταία». Με κενή συμβολοσειρά θα ταξινομούνταν **πρώτο** σε κάθε αύξουσα
 * (κάθε χαρακτήρας είναι μεγαλύτερος από το τίποτα) — δηλαδή ο άνθρωπος που ζητά «από το
 * μικρότερο» θα έπαιρνε μια σελίδα κενές γραμμές πριν δει το πρώτο του δεδομένο.
 */
function sortableOf(key: TableSortKey): SortableValue {
  if (key.numeric !== null) return key.numeric;
  return key.text === '' ? null : key.text;
}
