/**
 * @fileoverview Οδηγίες πληρωμής τιμολογίου — ΠΟΙΟΙ λογαριασμοί τυπώνονται, και ΠΟΤΕ
 * @description Ο ΕΝΑΣ κανόνας για τον γραφέα του snapshot (διακομιστής, POST/PATCH πρόχειρου) **και** για τη
 *   σχεδίαση (PDF): ίδια ερώτηση, ίδια απάντηση — ποτέ πίνακας λογαριασμών σε απόδειξη μετρητών ή σε πιστωτικό.
 *
 *   - Μόνο τρόποι πληρωμής που πληρώνονται με **μεταφορά** (`bank_transfer` · `credit` = επί πιστώσει · `mixed`).
 *   - Ποτέ σε πιστωτικό (`credit_invoice`): εκεί πληρώνει ο εκδότης, όχι ο λήπτης.
 *   - Μόνο ενεργοί λογαριασμοί με `showOnInvoices`, ο προεπιλεγμένος πρώτος, έως {@link MAX_INVOICE_PAYMENT_ACCOUNTS}
 *     (Xero/QuickBooks: 1–3 λογαριασμοί — περισσότεροι μπερδεύουν τον λήπτη).
 *   - Δικαιούχος = ο δηλωμένος του λογαριασμού, αλλιώς η επωνυμία του εκδότη (EN 16931 BT-85).
 *
 * Καθαρές συναρτήσεις· η μόνη ανάγνωση (μητρώο) έρχεται ως παράμετρος — ο καλών δίνει τον αναγνώστη του.
 *
 * @see ADR-ACC-018 §15 · ADR-ACC-008 §2 · EN 16931 BG-16
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { BankAccountConfig } from '../../types/bank';
import type { PaymentMethod } from '../../types/common';
import { INVOICE_TYPES, type InvoicePaymentAccount, type InvoiceType } from '../../types/invoice';

/** Το πολύ τόσοι λογαριασμοί τυπώνονται σε ένα τιμολόγιο. */
export const MAX_INVOICE_PAYMENT_ACCOUNTS = 3;

/** Οι τρόποι πληρωμής που εξοφλούνται με τραπεζική μεταφορά — μόνο εκεί έχουν νόημα IBAN, RF, QR. */
export const TRANSFER_PAYMENT_METHODS: ReadonlySet<PaymentMethod> = new Set<PaymentMethod>(['bank_transfer', 'credit', 'mixed']);

/** Φρουρός για τιμή που ήρθε από έξω (σώμα αιτήματος): εξοφλείται αυτός ο τρόπος με μεταφορά; */
export function isTransferPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === 'string' && (TRANSFER_PAYMENT_METHODS as ReadonlySet<string>).has(value);
}

/** Ό,τι χρειάζεται η ερώτηση «δείχνω οδηγίες πληρωμής;» — υποσύνολο του `Invoice`. */
export interface PaymentInstructionsSubject {
  readonly type: InvoiceType;
  readonly paymentMethod: PaymentMethod;
}

/** Δείχνει αυτό το παραστατικό οδηγίες πληρωμής με μεταφορά; */
export function showsPaymentInstructions(subject: PaymentInstructionsSubject): boolean {
  return subject.type !== 'credit_invoice' && TRANSFER_PAYMENT_METHODS.has(subject.paymentMethod);
}

/**
 * Η ΜΙΑ σειρά των λογαριασμών (οθόνη ρυθμίσεων · τιμολόγιο · λύτης προεπιλογής): ο προεπιλεγμένος πρώτος,
 * μετά `sortOrder`, μετά χρόνος δημιουργίας — ντετερμινιστικά.
 */
export function compareBankAccounts(a: BankAccountConfig, b: BankAccountConfig): number {
  const byDefault = Number(b.isDefaultForInvoices === true) - Number(a.isDefaultForInvoices === true);
  if (byDefault !== 0) return byDefault;
  const bySort = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  return bySort !== 0 ? bySort : a.createdAt.localeCompare(b.createdAt);
}

/**
 * Ποιος είναι ο προεπιλεγμένος μετά την αλλαγή: ο ζητούμενος αν τυπώνεται, αλλιώς ο υπάρχων αν ακόμη τυπώνεται,
 * αλλιώς ο πρώτος που τυπώνεται — προτιμώντας όποιον **δεν** αποεπιλέχθηκε μόλις (`avoidId`), που ξαναγίνεται
 * προεπιλεγμένος μόνο αν είναι ο μόνος. `null` όταν κανένας λογαριασμός δεν τυπώνεται.
 */
export function resolveInvoiceDefault(
  accounts: readonly BankAccountConfig[], requestedId: string | null, avoidId: string | null = null,
): string | null {
  const shown = accounts.filter((a) => a.isActive && a.showOnInvoices === true).sort(compareBankAccounts);
  if (requestedId !== null && shown.some((a) => a.accountId === requestedId)) return requestedId;
  const current = shown.find((a) => a.isDefaultForInvoices === true && a.accountId !== avoidId);
  if (current) return current.accountId;
  return (shown.find((a) => a.accountId !== avoidId) ?? shown[0])?.accountId ?? null;
}

/**
 * Το snapshot των οδηγιών πληρωμής για ένα παραστατικό, από το μητρώο της εταιρείας. Κενό όταν το παραστατικό
 * δεν πληρώνεται με μεταφορά ή κανένας λογαριασμός δεν έχει δηλωθεί για τιμολόγια.
 */
export function selectInvoicePaymentAccounts(
  accounts: readonly BankAccountConfig[],
  subject: PaymentInstructionsSubject,
  issuerName: string,
): InvoicePaymentAccount[] {
  if (!showsPaymentInstructions(subject)) return [];
  return accounts
    .filter((account) => account.isActive && account.showOnInvoices === true)
    .sort(compareBankAccounts)
    .slice(0, MAX_INVOICE_PAYMENT_ACCOUNTS)
    .map((account) => ({
      bankName: account.bankName,
      iban: account.iban,
      bic: account.bankCode,
      holderName: account.holderName?.trim() || issuerName,
    }));
}

function isInvoiceType(value: unknown): value is InvoiceType {
  return typeof value === 'string' && (INVOICE_TYPES as readonly string[]).includes(value);
}

/**
 * Ο ΕΝΑΣ γραφέας του snapshot (`issuer.bankAccounts`): διαβάζει το μητρώο **μόνο** όταν το παραστατικό πληρώνεται
 * με μεταφορά. Δέχεται τιμές «από έξω» (`unknown`) — το σώμα του αιτήματος είναι `.passthrough()`. Τον καλούν η
 * γέννηση κάθε τιμολογίου (repository `createInvoice`: φόρμα · γέφυρα πωλήσεων · πιστωτικό) και το PATCH πρόχειρου.
 */
export async function resolveInvoicePaymentAccounts(
  readAccounts: () => Promise<BankAccountConfig[]>,
  subject: { readonly type: unknown; readonly paymentMethod: unknown },
  issuerName: string,
): Promise<InvoicePaymentAccount[]> {
  const { type, paymentMethod } = subject;
  if (!isInvoiceType(type) || !isTransferPaymentMethod(paymentMethod)) return [];
  if (!showsPaymentInstructions({ type, paymentMethod })) return [];
  return selectInvoicePaymentAccounts(await readAccounts(), { type, paymentMethod }, issuerName);
}
