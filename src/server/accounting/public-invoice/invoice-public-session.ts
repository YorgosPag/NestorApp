import 'server-only';

/**
 * @fileoverview **Η συνεδρία προβολής** του συνδέσμου πληρωμής τιμολογίου (ADR-ACC-018 §16)
 * @description Ό,τι ζητά η σελίδα `/shared/[token]` **μετά** το άνοιγμα (`POST /api/shares/resolve`): την όψη του
 *   τιμολογίου και το PDF. Πρότυπο της συνεδρίας θέασης περιήγησης (`server/spatial-tour/tour-view-session.ts`):
 *
 *   1. Η διαδρομή απαιτεί το **κουπόνι επίσκεψης** του συνδέσμου (ο browser άνοιξε το token στα τελευταία 15′).
 *      Το token δεν ξαναταξιδεύει ποτέ: τα αιτήματα συνέχειας φέρουν μόνο το `shareId`.
 *   2. Εδώ ελέγχεται, με ανάγνωση **με id**, ότι ο σύνδεσμος είναι **ακόμη** ενεργός (`findActiveShareOf`).
 *      Ανάκληση ⇒ καμία νέα απάντηση, ακόμη και μέσα στο κουπόνι.
 *   3. Το τιμολόγιο διαβάζεται **με τον μισθωτή του συνδέσμου** (`readTenantInvoice`).
 *   4. Οι λογαριασμοί είναι αυτοί που **θα τύπωνε σήμερα** (`withCurrentPaymentAccounts`: πρόχειρο ⇒ μητρώο,
 *      εκδομένο ⇒ στιγμιότυπο): ο ίδιος κριτής με το GET, το PDF και το email.
 *
 *   Το ακυρωμένο **δεν** είναι άρνηση: η όψη λέει `standing: 'cancelled'`, και ο πελάτης μαθαίνει ότι δεν οφείλει.
 *
 * @see ADR-ACC-018 §15.2 · §16 · ADR-884 Κ3β
 */

import type { Firestore } from 'firebase-admin/firestore';

import { withCurrentPaymentAccounts } from '@/app/api/accounting/invoices/invoice-payment-snapshot';
import { todayLocalDate } from '@/lib/date-local';
import { findActiveShareOf } from '@/server/sharing/share-active-lookup';
import { buildInvoicePublicView } from '@/subapps/accounting/services/public-invoice/invoice-public-view';
import type { Invoice } from '@/subapps/accounting/types';
import type { InvoicePublicRefusal, InvoicePublicViewResponse } from '@/subapps/accounting/types/invoice-public-view';
import type { IAccountingRepository } from '@/subapps/accounting/types/interfaces';

import { readTenantInvoice } from './tenant-invoice';

export interface InvoicePublicSessionInput {
  readonly shareId: string;
  readonly nowMs: number;
}

type SharedInvoice =
  | { readonly kind: 'found'; readonly invoice: Invoice; readonly repository: IAccountingRepository }
  | { readonly kind: 'refused'; readonly reason: InvoicePublicRefusal };

/** Σύνδεσμος ενεργός → τιμολόγιο του μισθωτή του → οι οδηγίες πληρωμής που θα τύπωνε σήμερα. */
async function readSharedInvoice(db: Firestore, input: InvoicePublicSessionInput): Promise<SharedInvoice> {
  const share = await findActiveShareOf(db, {
    shareId: input.shareId, kind: 'invoice_payment', entityId: null, nowMs: input.nowMs,
  });
  if (share === null) return { kind: 'refused', reason: 'link-inactive' };
  // Ο «χρήστης» του repository είναι ο δημιουργός του συνδέσμου: για λογαριασμό του διαβάζει ο διακομιστής.
  const found = await readTenantInvoice({ companyId: share.companyId, userId: share.createdBy }, share.entityId);
  if (found === null) return { kind: 'refused', reason: 'invoice-absent' };
  const invoice = await withCurrentPaymentAccounts(found.repository, found.invoice);
  return { kind: 'found', invoice, repository: found.repository };
}

/** Η όψη για τη σελίδα. */
export async function openInvoicePublicView(
  db: Firestore, input: InvoicePublicSessionInput,
): Promise<InvoicePublicViewResponse> {
  const shared = await readSharedInvoice(db, input);
  if (shared.kind === 'refused') return { status: 'refused', reason: shared.reason };
  return { status: 'ok', view: buildInvoicePublicView(shared.invoice, todayLocalDate()) };
}

export type InvoicePublicPdfOutcome =
  | { readonly kind: 'pdf'; readonly bytes: Uint8Array; readonly filename: string }
  | { readonly kind: 'refused'; readonly reason: InvoicePublicRefusal };

/** Το PDF, το **ίδιο** με τη λήψη από την εφαρμογή (ίδιος γραφέας, ίδιοι λογαριασμοί, ίδιο όνομα αρχείου). */
export async function renderInvoicePublicPdf(
  db: Firestore, input: InvoicePublicSessionInput,
): Promise<InvoicePublicPdfOutcome> {
  const shared = await readSharedInvoice(db, input);
  if (shared.kind === 'refused') return { kind: 'refused', reason: shared.reason };
  // Δυναμικά: το jsPDF + γραμματοσειρές φορτώνονται μόνο όταν ζητηθεί PDF, όχι σε κάθε προβολή.
  const [pdfDocument, profile] = await Promise.all([
    import('@/subapps/accounting/services/pdf/invoice-pdf-document'),
    shared.repository.getCompanySetup(),
  ]);
  const pdf = await pdfDocument.renderInvoicePdfDocument({
    invoice: shared.invoice, kadCode: pdfDocument.extractKadFromProfile(profile),
  });
  return {
    kind: 'pdf', bytes: new Uint8Array(pdf.output('arraybuffer')), filename: pdfDocument.invoicePdfFilename(shared.invoice),
  };
}
