/**
 * SSoT για το placeholder των select πεδίων (ADR-666).
 *
 * ΕΝΑ κλειδί με placeholder — ΠΟΤΕ ένωση δύο μεταφράσεων.
 * Η ένωση `t('select') + ' ' + t(label)` κλείδωνε τη σειρά «ρήμα → ουσιαστικό»
 * μέσα στον κώδικα· γλώσσες με άλλη σύνταξη δεν μπορούσαν να τη διορθώσουν.
 * Με το `Επιλέξτε {label}` / `Select {label}` τη σειρά την ελέγχει ο μεταφραστής.
 *
 * Pure — καμία εξάρτηση από React/Firebase, ώστε να είναι απευθείας testable.
 */

/** Το κλειδί ζει στο `common` namespace ως `forms.selectPlaceholder`. */
export const SELECT_PLACEHOLDER_KEY = 'common:forms.selectPlaceholder';

export type SelectPlaceholderTranslator = (key: string, options?: { label: string }) => string;

/**
 * Χτίζει το placeholder ενός select.
 *
 * ⚠️ Το `label` μπαίνει ΩΣ ΕΧΕΙ. Καμία μετατροπή πεζών/κεφαλαίων: το παλιό
 * `.toLowerCase()` κατέστρεφε τα ελληνικά ακρωνύμια («Κατάσταση ΓΕΜΗ» → «κατάσταση γεμη»).
 */
export function buildSelectPlaceholder(label: string, t: SelectPlaceholderTranslator): string {
  return t(SELECT_PLACEHOLDER_KEY, { label });
}
