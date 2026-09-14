/**
 * @fileoverview **Ο ΑΡΙΘΜΟΣ ΓΕΜΗ ΣΕ ΜΙΑ ΚΑΝΟΝΙΚΗ ΜΟΡΦΗ** — ADR-841 §7 Α23.
 * @module lib/company/gemi-number
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΧΡΕΙΑΖΕΤΑΙ ΣΥΝΑΡΤΗΣΗ ΓΙΑ ΕΝΑΝ ΑΡΙΘΜΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το ΓΕΜΗ Open Data δηλώνει το `arGemi` ως **integer** (OpenAPI `Company.arGemi` και η
 * παράμετρος διαδρομής `/companies/{arGemi}`). Ένας αριθμός που ο άνθρωπος γράφει
 * «000123401000» επιστρέφει ως `123401000`. Σύγκριση **κειμένου** θα έβγαζε «άλλος αριθμός»
 * για κάθε αριθμό με αρχικά μηδενικά — δηλαδή ψευδή «απόκλιση από το ΓΕΜΗ» σε σωστή δήλωση.
 *
 * 🔑 **Κανονική μορφή = τα σημαντικά ψηφία.** Είναι μορφή **σύγκρισης**· στην οθόνη
 * φαίνεται ό,τι δήλωσε ο άνθρωπος.
 *
 * ⚠️ **Δηλωμένα όρια**: (1) ταβάνι 12 ψηφίων — όσοι αριθμοί ΓΕΜΗ εξετάστηκαν είναι 12ψήφιοι,
 * αλλά **δεν βρέθηκε** επίσημη προδιαγραφή μήκους· (2) **κανένα** ψηφίο ελέγχου — δεν βρέθηκε
 * δημοσιευμένος αλγόριθμος. Η μόνη απόδειξη ύπαρξης είναι η ερώτηση στο ίδιο το μητρώο.
 *
 * **Layering**: leaf, καθαρή — πελάτης και διακομιστής.
 */

/** Το ταβάνι ψηφίων (με τα αρχικά μηδενικά). */
export const GEMI_NUMBER_MAX_DIGITS = 12;

/** Διαχωριστικά που γράφει ο άνθρωπος για να διαβάζεται ο αριθμός — δεν αλλάζουν τον αριθμό. */
const HUMAN_SEPARATORS = /[\s.\-]/g;

const DIGITS_ONLY = new RegExp(`^\\d{1,${GEMI_NUMBER_MAX_DIGITS}}$`);

function textOfNumber(value: number): string {
  return Number.isSafeInteger(value) && value > 0 ? String(value) : '';
}

/**
 * Η κανονική μορφή, **ή `null` αν η είσοδος δεν είναι αριθμός ΓΕΜΗ**.
 *
 * ⚠️ `null` και για το μηδέν: «0000» δεν είναι αριθμός που μπορεί να ρωτηθεί.
 */
export function canonicalGemiNumber(input: string | number | null | undefined): string | null {
  const text =
    typeof input === 'number'
      ? textOfNumber(input)
      : typeof input === 'string'
        ? input.replace(HUMAN_SEPARATORS, '')
        : '';
  if (!DIGITS_ONLY.test(text)) return null;
  const significant = text.replace(/^0+/, '');
  return significant === '' ? null : significant;
}

/** Ίδιος αριθμός; — `false` όταν **οποιοσδήποτε** δεν είναι αριθμός (δύο κενά δεν «ταιριάζουν»). */
export function sameGemiNumber(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
): boolean {
  const left = canonicalGemiNumber(a);
  return left !== null && left === canonicalGemiNumber(b);
}
