/**
 * @fileoverview **Η υποβολή του τιμολογίου** — δημιουργία ή ενημέρωση, μέσω του ΕΝΟΣ μεταφορέα (`apiClient`).
 * @module subapps/accounting/components/invoices/forms/invoice-submit
 * @see ADR-ACC-003 §22.10
 *
 * 🔴 **Γιατί υπάρχει**: ως 2026-11-10 η φόρμα έκανε χειροκίνητο `fetch` και διάβαζε `result.data?.id ?? result.id`·
 * ο διακομιστής απαντά `created({ invoiceId, … })` ⇒ το id ήταν **πάντα** `undefined` και κάθε επιτυχής
 * δημιουργία κατέληγε στο `?view=undefined` («Invoice not found»). Τώρα: ο `apiClient` ξετυλίγει το `data`, και ο
 * τύπος {@link InvoiceCreatedResponse} είναι **ο ίδιος** που δηλώνει ο route.
 *
 * ⚠️ Η σημασιολογία σφάλματος **δεν αλλάζει**: η άρνηση του διακομιστή περνά από το ίδιο `invoiceSubmitErrorMessage`
 * (άρνηση περιόδου · πολιτική · πιστωτικό όριο). Ο `apiClient` **δεν** επαναλαμβάνει POST χωρίς κλειδί ιδεμποτίας
 * (`isReplayableRequest`) ⇒ καμία διπλή έκδοση από αυτόματη επανάληψη.
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import { ApiClientError, apiErrorBodyOf } from '@/lib/api/api-client-types';
import { API_ROUTES } from '@/config/domain-constants';
import type { InvoiceCreatedResponse } from '@/subapps/accounting/types';
import {
  invoiceSubmitErrorMessage,
  type InvoiceSubmitErrorBody,
  type InvoiceSubmitTranslators,
} from './invoice-submit-error';

/**
 * Στέλνει το τιμολόγιο και επιστρέφει το id του. `editInvoiceId` ⇒ ενημέρωση (PATCH) του υπάρχοντος.
 * Σε άρνηση πετά `Error` με το **μεταφρασμένο** μήνυμα.
 */
export async function submitInvoice(
  body: Readonly<Record<string, unknown>>,
  editInvoiceId: string | null,
  t: InvoiceSubmitTranslators,
): Promise<string> {
  try {
    if (editInvoiceId) {
      await apiClient.patch(API_ROUTES.ACCOUNTING.INVOICES.BY_ID(editInvoiceId), body);
      return editInvoiceId;
    }
    const { invoiceId } = await apiClient.post<InvoiceCreatedResponse>(API_ROUTES.ACCOUNTING.INVOICES.LIST, body);
    return invoiceId;
  } catch (cause) {
    if (!ApiClientError.isApiClientError(cause)) throw cause;
    // Ο φάκελος σφάλματος του διακομιστή: ο φρουρός εγγυάται αντικείμενο· τα πεδία του είναι όλα προαιρετικά.
    const errorBody = apiErrorBodyOf(cause) as InvoiceSubmitErrorBody | null;
    throw new Error(invoiceSubmitErrorMessage(errorBody, cause.statusCode, t));
  }
}
