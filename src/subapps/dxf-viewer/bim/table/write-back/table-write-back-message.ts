/**
 * 🔴 ADR-769 Δ4 / N.11 — **ΤΙ ΛΕΜΕ ΣΤΟΝ ΑΝΘΡΩΠΟ**, και γιατί καμία άρνηση δεν σιωπά.
 *
 * Καθαρή αντιστοίχιση `άρνηση → κλειδί i18n`, **έξω από το hook**: μια `switch` μέσα σε React
 * component δεν τεστάρεται χωρίς να στηθεί ολόκληρο δέντρο απόδοσης, και αυτό ακριβώς είναι το
 * σχήμα που αφήνει μια άρνηση χωρίς λόγια για μήνες.
 *
 * ## 🔴 Γιατί `Record<…['kind'], string>` και όχι `switch` με `default`
 * Νέα άρνηση στον κριτή **δεν μεταγλωττίζεται** μέχρι να αποκτήσει λόγια. Ένα
 * `default: 'κάτι πήγε στραβά'` θα ήταν ακριβώς η σιωπηλή απόρριψη που ολόκληρο το ADR υπάρχει
 * για να αποκλείσει — και θα περνούσε **πράσινο** από κάθε πύλη, γιατί ο μεταγλωττιστής δεν
 * έχει γνώμη για μια συμβολοσειρά.
 *
 * @module subapps/dxf-viewer/bim/table/write-back/table-write-back-message
 * @see src/i18n/locales/el/dxf-viewer.json — `table.writeBack`
 */

import type {
  TableColumnUnwritableReason,
  TableWriteBackRejection,
} from './table-write-back-plan';

const NAMESPACE = 'table.writeBack';

/**
 * Ο **δομικός** λόγος έχει τέσσερις εκδοχές και η καθεμία λέει διαφορετικό πράγμα (Δ2):
 * «υπολογίζεται» δεν είναι «κανείς δεν το κατέχει ακόμη», και η διαφορά καθορίζει αν ο
 * χρήστης πρέπει να περιμένει κάτι ή όχι.
 */
const UNWRITABLE_KEYS: Readonly<Record<TableColumnUnwritableReason, string>> = {
  ordinal: `${NAMESPACE}.unwritableOrdinal`,
  computed: `${NAMESPACE}.unwritableComputed`,
  identity: `${NAMESPACE}.unwritableIdentity`,
  'no-owner': `${NAMESPACE}.unwritableNoOwner`,
};

const REJECTION_KEYS: Readonly<Record<TableWriteBackRejection['kind'], string>> = {
  // Ο δομικός λόγος **δεν** έχει ένα μήνυμα: παραπέμπει στις τέσσερις εκδοχές του.
  'column-unwritable': UNWRITABLE_KEYS['no-owner'],
  'cell-locked': `${NAMESPACE}.cellLocked`,
  'not-bound': `${NAMESPACE}.notBound`,
  'source-unavailable': `${NAMESPACE}.sourceUnavailable`,
  'source-moved': `${NAMESPACE}.sourceMoved`,
  'invalid-value': `${NAMESPACE}.invalidValue`,
};

/** Ο ιδιοκτήτης **εγκρίθηκε αλλά δεν μπόρεσε** — χωριστό από κάθε άρνηση του κριτή. */
export const TABLE_WRITE_BACK_OWNER_REFUSED_KEY = `${NAMESPACE}.ownerRefused`;

/** Το κλειδί μηνύματος μιας άρνησης — **πάντα** υπάρχει, ποτέ κενό. */
export function tableWriteBackMessageKey(rejection: TableWriteBackRejection): string {
  return rejection.kind === 'column-unwritable'
    ? UNWRITABLE_KEYS[rejection.reason]
    : REJECTION_KEYS[rejection.kind];
}
