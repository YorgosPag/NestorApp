/**
 * **Οι αρνήσεις της δημιουργίας RFQ, με λέξεις** (ADR-923 §5.13 Τ6) — για το κοινό `explainProcurementError`.
 *
 * 🔑 `Record` πάνω στο κλειστό `RfqCreateRefusalCode`: νέος κωδικός στον διακομιστή δεν μένει ποτέ χωρίς πρόταση στην οθόνη.
 * 🔑 Τα κλειδιά είναι γραμμένα κυριολεκτικά (ADR-744), ώστε οι πύλες i18n να τα βλέπουν. Τις ίδιες προτάσεις δείχνει η φόρμα
 *    και η προσυμπλήρωση `?catalog=`, γιατί ο διακομιστής απαντά και στις δύο με τους ίδιους κωδικούς.
 *
 * @module subapps/procurement/components/rfq-create-refusal-messages
 */

import type { RfqCreateRefusalCode } from '@/subapps/procurement/types/rfq-create-refusal';

type Translate = (key: string) => string;

/** κωδικός → μεταφρασμένο μήνυμα, στο σχήμα που δέχεται το `explainProcurementError`. */
export function rfqCreateRefusalMessages(t: Translate): Readonly<Record<RfqCreateRefusalCode, string>> {
  return {
    catalogSkuUnavailable: t('quotes:rfqs.errors.refusals.catalogSkuUnavailable'),
    supplierNotAcceptingQuotes: t('quotes:rfqs.errors.refusals.supplierNotAcceptingQuotes'),
    supplierContactUnavailable: t('quotes:rfqs.errors.refusals.supplierContactUnavailable'),
    rfqTooLarge: t('quotes:rfqs.errors.refusals.rfqTooLarge'),
  };
}
