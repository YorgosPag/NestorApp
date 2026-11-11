/**
 * =============================================================================
 * INVOICE PAYMENT SHARE RESOLVER — ο σύνδεσμος «δες και πλήρωσε» ενός τιμολογίου (ADR-ACC-018 §16 · ADR-315)
 * =============================================================================
 *
 * Ο σύνδεσμος εκδίδεται για τον πελάτη του τιμολογίου: τυχαίο token 256 bit, αποθηκεύεται μόνο το
 * hash, η λήξη είναι υποχρεωτική και ο σύνδεσμος ανακαλείται. Κωδικός δεν υπάρχει, όπως στα Stripe,
 * Xero και QuickBooks.
 *
 * 🔑 **Τι ταξιδεύει στον παραλήπτη**: μόνο οι ταυτότητες (σύνδεσμος + τιμολόγιο). Το ίδιο το τιμολόγιο,
 * οι οδηγίες πληρωμής και το PDF έρχονται από τη **συνεδρία προβολής**
 * (`server/accounting/public-invoice/invoice-public-session.ts`) μέσω `GET /api/shares/[shareId]/invoice-payment`.
 * Εκεί κρίνονται ξανά η ζωντάνια του συνδέσμου, ο μισθωτής και η κατάσταση του τιμολογίου. Η προβολή
 * εδώ είναι καθαρή, ενώ οι οδηγίες πληρωμής πρόχειρου απαιτούν ανάγνωση του μητρώου λογαριασμών.
 *
 * 🔐 **Ποιος δημιουργεί**: ο μισθωτής του τιμολογίου, και μόνο για τιμολόγιο που πληρώνεται με μεταφορά
 * (`server/sharing/share-create-authority.ts` → `invoicePaymentAuthority`).
 *
 * @module services/sharing/resolvers/invoice-payment.resolver
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import {
  buildSafePublicProjection,
  validateShareBaseInput,
} from '@/services/sharing/resolver-core/share-resolver-primitives';
import type {
  CreateShareInput,
  ShareEntityDefinition,
  ShareProjectionInput,
  ValidationResult,
} from '@/types/sharing';

export interface InvoicePaymentShareResolvedData {
  /** Η ταυτότητα του συνδέσμου — με αυτήν (και το cookie επίσκεψης) ζητά η σελίδα την προβολή. */
  readonly shareId: string;
  readonly invoiceId: string;
}

function projectInvoicePayment({ share }: ShareProjectionInput): InvoicePaymentShareResolvedData {
  return { shareId: share.id, invoiceId: share.entityId };
}

function validateCreateInput(input: CreateShareInput): ValidationResult {
  return validateShareBaseInput(input, { entityType: 'invoice_payment', entityIdLabel: 'invoiceId' });
}

export const invoicePaymentShareResolver: ShareEntityDefinition<InvoicePaymentShareResolvedData> = {
  entityCollection: COLLECTIONS.ACCOUNTING_INVOICES,
  project: projectInvoicePayment,
  safePublicProjection: (share) => buildSafePublicProjection(share, null),
  validateCreateInput,
  renderPublic: () => null,
};
