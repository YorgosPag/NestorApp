/**
 * @fileoverview Οι οδηγίες πληρωμής ενός τιμολογίου: **ζωντανές** όσο είναι πρόχειρο, **παγωμένες** από την έκδοση
 * @description Πρότυπο Stripe (draft → finalize): όσο το παραστατικό αλλάζει ακόμη (`draft` · `rejected`), οι
 *   λογαριασμοί του είναι **προβολή** του σημερινού μητρώου — αλλιώς ένα πρόχειρο της Δευτέρας θα έβγαινε την Πέμπτη
 *   με BIC/λογαριασμό που διορθώθηκε στο μεταξύ (περιστατικό Α-7, `PIABORAA`, 2026-11-10). Από τη διαβίβαση και μετά
 *   (`IMMUTABLE_STATUSES`) το αποθηκευμένο `issuer.bankAccounts` είναι **το** έγγραφο και δεν ξαναγράφεται ποτέ.
 *
 *   Ο ΕΝΑΣ resolver (`resolveInvoicePaymentAccounts`) τρέχει σε κάθε σημείο — ό,τι στέλνει ο browser στο
 *   `issuer.bankAccounts` αγνοείται (ADR-ACC-003 §22):
 *   - **γέννηση** — repository `createInvoice`·
 *   - **PATCH πρόχειρου** που αγγίζει `issuer` · `paymentMethod` · `type` — {@link withServerPaymentAccountsOnUpdate}·
 *   - **ανάγνωση / αποστολή** πρόχειρου (GET, email) — {@link withCurrentPaymentAccounts}·
 *   - **διαβίβαση** (draft/rejected → sent): ο γραφέας της ΠΡΕΠΕΙ να παγώσει το αποτέλεσμα του
 *     {@link withCurrentPaymentAccounts} στην ίδια εγγραφή που αλλάζει την κατάσταση (ADR-ACC-018 §15.2).
 *
 * @see ADR-ACC-018 §15 · §15.2 · ADR-ACC-003 §22
 */

import 'server-only';

import type { IAccountingRepository } from '@/subapps/accounting/types/interfaces';
import type { Invoice, InvoiceIssuer, InvoicePaymentAccount } from '@/subapps/accounting/types';
import { resolveInvoicePaymentAccounts } from '@/subapps/accounting/services/payments/invoice-payment-accounts';
import { IMMUTABLE_STATUSES } from './invoice-schemas';

/** Ό,τι διαβάζεται από το σώμα PATCH — όλα προαιρετικά, το σχήμα είναι `.passthrough()`. */
interface InvoiceBodyPaymentFields {
  readonly type?: unknown;
  readonly paymentMethod?: unknown;
  readonly issuer?: unknown;
}

function isIssuer(value: unknown): value is InvoiceIssuer {
  return typeof value === 'object' && value !== null && typeof (value as { name?: unknown }).name === 'string';
}

function registryAccountsFor(
  repository: IAccountingRepository, subject: { readonly type: unknown; readonly paymentMethod: unknown }, issuerName: string,
): Promise<InvoicePaymentAccount[]> {
  return resolveInvoicePaymentAccounts(() => repository.getBankAccounts(), subject, issuerName);
}

/** Ζωντανές οδηγίες πληρωμής (πρόχειρο / απορριφθέν) ή παγωμένες (διαβιβασμένο · αποδεκτό · ακυρωμένο); */
export function hasLivePaymentAccounts(invoice: Invoice): boolean {
  const status = invoice.mydata?.status;
  return status === undefined || !IMMUTABLE_STATUSES.has(status);
}

/** Ξαναχτίζει τους λογαριασμούς όταν η αλλαγή αγγίζει ό,τι τους καθορίζει· αλλιώς επιστρέφει την αλλαγή αμετάβλητη. */
export async function withServerPaymentAccountsOnUpdate<T extends InvoiceBodyPaymentFields>(
  repository: IAccountingRepository, updates: T, existing: Invoice,
): Promise<T> {
  const touches = updates.issuer !== undefined || updates.paymentMethod !== undefined || updates.type !== undefined;
  if (!touches) return updates;
  const issuer = isIssuer(updates.issuer) ? updates.issuer : existing.issuer;
  const bankAccounts = await registryAccountsFor(
    repository,
    { type: updates.type ?? existing.type, paymentMethod: updates.paymentMethod ?? existing.paymentMethod },
    issuer.name,
  );
  return { ...updates, issuer: { ...issuer, bankAccounts } };
}

/**
 * Το τιμολόγιο με τις οδηγίες πληρωμής που **θα** τύπωνε σήμερα: πρόχειρο ⇒ από το μητρώο· εκδομένο ⇒ αμετάβλητο
 * (το στιγμιότυπο της έκδοσης). Καθαρή ανάγνωση — δεν γράφει· όποιος θέλει να το κρατήσει, το γράφει ο ίδιος.
 */
export async function withCurrentPaymentAccounts(repository: IAccountingRepository, invoice: Invoice): Promise<Invoice> {
  if (!hasLivePaymentAccounts(invoice)) return invoice;
  const bankAccounts = await registryAccountsFor(repository, invoice, invoice.issuer.name);
  return { ...invoice, issuer: { ...invoice.issuer, bankAccounts } };
}
