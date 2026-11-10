/**
 * @fileoverview PATCH πρόχειρου: οι οδηγίες πληρωμής ξαναγράφονται από τον ΔΙΑΚΟΜΙΣΤΗ — ποτέ από τον browser
 * @description Η **γέννηση** κάθε τιμολογίου γράφει το `issuer.bankAccounts` μέσα στο repository `createInvoice`.
 *   Εδώ καλύπτεται η **επεξεργασία** πρόχειρου: όταν αλλάζει `issuer` · `paymentMethod` · `type`, το snapshot
 *   ξαναχτίζεται από το μητρώο με τον ΙΔΙΟ resolver — ό,τι έστειλε ο browser στο `issuer.bankAccounts` αγνοείται.
 *   Τα διαβιβασμένα δεν φτάνουν εδώ (`IMMUTABLE_STATUSES`): το snapshot της έκδοσης δεν ξαναγράφεται ποτέ.
 *
 * @see ADR-ACC-018 §15 · ADR-ACC-003 §22 (ο διακομιστής δεν εμπιστεύεται τον πελάτη)
 */

import 'server-only';

import type { IAccountingRepository } from '@/subapps/accounting/types/interfaces';
import type { Invoice, InvoiceIssuer } from '@/subapps/accounting/types';
import { resolveInvoicePaymentAccounts } from '@/subapps/accounting/services/payments/invoice-payment-accounts';

/** Ό,τι διαβάζεται από το σώμα PATCH — όλα προαιρετικά, το σχήμα είναι `.passthrough()`. */
interface InvoiceBodyPaymentFields {
  readonly type?: unknown;
  readonly paymentMethod?: unknown;
  readonly issuer?: unknown;
}

function isIssuer(value: unknown): value is InvoiceIssuer {
  return typeof value === 'object' && value !== null && typeof (value as { name?: unknown }).name === 'string';
}

/** Ξαναχτίζει τους λογαριασμούς όταν η αλλαγή αγγίζει ό,τι τους καθορίζει· αλλιώς επιστρέφει την αλλαγή αμετάβλητη. */
export async function withServerPaymentAccountsOnUpdate<T extends InvoiceBodyPaymentFields>(
  repository: IAccountingRepository, updates: T, existing: Invoice,
): Promise<T> {
  const touches = updates.issuer !== undefined || updates.paymentMethod !== undefined || updates.type !== undefined;
  if (!touches) return updates;
  const issuer = isIssuer(updates.issuer) ? updates.issuer : existing.issuer;
  const bankAccounts = await resolveInvoicePaymentAccounts(
    () => repository.getBankAccounts(),
    { type: updates.type ?? existing.type, paymentMethod: updates.paymentMethod ?? existing.paymentMethod },
    issuer.name,
  );
  return { ...updates, issuer: { ...issuer, bankAccounts } };
}
