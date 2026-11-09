/**
 * @fileoverview **Ο κύκλος ζωής της διαβίβασης ενός παραστατικού — ο ΕΝΑΣ πίνακας μεταβάσεων.**
 * @module subapps/accounting/services/mydata/mydata-status-transitions
 *
 * Λεξιλόγιο: το υπάρχον `MyDataDocumentStatus` (`types/common.ts`) — καμία νέα κατάσταση.
 *
 * ```
 *   draft ──► sent ──► accepted ──► cancelled      (CancelInvoice της ΑΑΔΕ)
 *     │        │
 *     │        └────► rejected ──► sent            (επανυποβολή μετά από διόρθωση)
 *     │                  │
 *     └──────────────────┴──► cancelled            (ακύρωση πριν φτάσει ποτέ στην ΑΑΔΕ)
 * ```
 *
 * 🔑 **Ένας γραφέας** (ADR-ACC-003 §22): την κατάσταση την αλλάζει **μόνο ο διακομιστής** — ο πελάτης
 * δεν στέλνει ποτέ `mydata` (`stripServerOwnedInvoiceFields`). Χωρίς αυτό, ένα πρόχειρο τιμολόγιο
 * μπορούσε να δηλωθεί `accepted` με ψεύτικο ΜΑΡΚ, χωρίς να φύγει ποτέ στην ΑΑΔΕ.
 */

import type { MyDataDocumentStatus } from '../../types/common';
import type { InvoiceMyDataMeta } from '../../types/invoice';

const ALLOWED_TRANSITIONS: Readonly<Record<MyDataDocumentStatus, readonly MyDataDocumentStatus[]>> = {
  draft: ['sent', 'cancelled'],
  sent: ['accepted', 'rejected'],
  rejected: ['sent', 'cancelled'],
  accepted: ['cancelled'],
  cancelled: [],
};

export function canTransitionMyDataStatus(from: MyDataDocumentStatus, to: MyDataDocumentStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Μπορεί να ξεκινήσει διαβίβαση από αυτή την κατάσταση; (`draft` ή `rejected`) */
export function isMyDataTransmittable(status: MyDataDocumentStatus): boolean {
  return canTransitionMyDataStatus(status, 'sent');
}

/** Η **μία** αρχική κατάσταση myDATA ενός νέου παραστατικού — τη γράφει ο διακομιστής, ποτέ ο πελάτης. */
export function createDraftMyDataMeta(): InvoiceMyDataMeta {
  return {
    status: 'draft',
    mark: null,
    uid: null,
    authCode: null,
    submittedAt: null,
    respondedAt: null,
    errorMessage: null,
  };
}
