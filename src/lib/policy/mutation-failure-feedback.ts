/**
 * @fileoverview **Η ΜΙΑ απάντηση σε αποτυχημένη mutation** (ADR-898 §21.6 Ε3): κάθε αποτυχία φτάνει στον άνθρωπο, και
 * μια **άρνηση πολιτικής** δεν καταγράφεται ως σφάλμα.
 * @module lib/policy/mutation-failure-feedback
 *
 * 🔑 Δύο είδη αποτυχίας, δύο στάθμες καταγραφής, **πάντα** ένα μήνυμα:
 * - **Άρνηση πολιτικής** (ο server απάντησε με κωδικό του μητρώου — π.χ. 409 `POLICY_SPACE_LINKED_TO_UNIT`): το σύστημα
 *   δούλεψε **σωστά**. ⇒ `info` + το μεταφρασμένο «τι να κάνεις». Ως `error` έβγαινε «Console ApiClientError» στο dev
 *   overlay για κάτι που ήταν ήδη χειρισμένο.
 * - **Οτιδήποτε άλλο**: ⇒ `error` + το γενικό μήνυμα του καλούντα. Ποτέ μόνο console.
 *
 * Ουδέτερο αρχείο (κανένα React, κανένα HTTP): μεταφραστής, ειδοποίηση και καταγραφέας **εγχέονται** — το hook που τα
 * δένει είναι το `hooks/useMutationFailureFeedback`.
 */

import { policyErrorCodeOf, policyErrorMessageOf, type TranslatorFn } from './policy-error-translator';

export interface MutationFailureLogger {
  info(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export interface MutationFailureSinks {
  /** Πρέπει να λύνει `policyErrors.*` — δηλαδή να προέρχεται από `POLICY_ERROR_NAMESPACES`. */
  readonly t: TranslatorFn;
  readonly notify: (message: string) => void;
  readonly logger: MutationFailureLogger;
}

/**
 * @param action — τι επιχειρήθηκε (`create` · `update` · `delete` · `unlink` …), για το ίχνος.
 * @param fallbackMessage — το ήδη μεταφρασμένο γενικό μήνυμα, όταν η αποτυχία **δεν** είναι άρνηση πολιτικής.
 */
export function reportMutationFailure(
  error: unknown,
  action: string,
  fallbackMessage: string,
  { t, notify, logger }: MutationFailureSinks,
): void {
  const policyMessage = policyErrorMessageOf(error, t);
  if (policyMessage !== null) {
    logger.info('Mutation refused by policy', { action, errorCode: policyErrorCodeOf(error) });
    notify(policyMessage);
    return;
  }
  logger.error('Mutation failed', { action, error: error instanceof Error ? error.message : String(error) });
  notify(fallbackMessage);
}
