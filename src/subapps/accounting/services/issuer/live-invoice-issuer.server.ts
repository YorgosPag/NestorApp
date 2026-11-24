import 'server-only';

/**
 * @fileoverview **Τα πεδία του εκδότη που γράφει ΜΟΝΟ ο server** — οδηγίες πληρωμής (§15) + λογότυπο του χώρου (§17.3).
 * @module subapps/accounting/services/issuer/live-invoice-issuer.server
 * @related app/api/accounting/invoices/invoice-issuer-snapshot (ζωντανό/παγωμένο) · repository `createInvoice` (γέννηση)
 *
 * 🔑 **ΕΝΑΣ συνθέτης, κάθε σημείο**: γέννηση · PATCH πρόχειρου · ανάγνωση/αποστολή πρόχειρου. Ό,τι έφερε ο καλών στο
 *    `issuer.bankAccounts` ή στο `issuer.logo` **αντικαθίσταται** — ο browser δεν ορίζει ποτέ ούτε IBAN ούτε bytes.
 * 🔑 Λογαριασμοί από το μητρώο (`resolveInvoicePaymentAccounts`) · λογότυπο από το `companies/{companyId}.brandLogo`
 *    (μόνο τα πεδία της **αναφοράς**, `brandLogoRefOf`).
 * 🔑 **Το λογότυπο δεν μπλοκάρει ποτέ την τιμολόγηση**: αποτυχία ανάγνωσης ⇒ `null` + προειδοποίηση. Είναι ασφαλές,
 *    γιατί ο συνθέτης τρέχει μόνο σε **ζωντανό** εκδότη (πρόχειρο): η επόμενη ανάγνωση ξαναρωτά την πηγή.
 */

import { brandLogoRefOf } from '@/lib/company/brand-logo-ref';
import { createModuleLogger } from '@/lib/telemetry';
import { readCompanyBrandLogo } from '@/server/company/brand-logo-read.server';
import type { BrandLogoRef } from '@/types/company-brand';

import type { BankAccountConfig } from '../../types/bank';
import type { InvoiceIssuer } from '../../types/invoice';
import { resolveInvoicePaymentAccounts } from '../payments/invoice-payment-accounts';

const logger = createModuleLogger('LiveInvoiceIssuer');

/** Από πού βγαίνουν τα πεδία του server: το μητρώο λογαριασμών, ο χώρος, και ό,τι καθορίζει τις οδηγίες πληρωμής. */
interface LiveIssuerSource {
  readonly readAccounts: () => Promise<BankAccountConfig[]>;
  readonly companyId: string;
  /** Τιμές «από έξω» (`unknown`): το σώμα του αιτήματος είναι `.passthrough()`. */
  readonly subject: { readonly type: unknown; readonly paymentMethod: unknown };
}

/** Η αναφορά στο **τρέχον** λογότυπο του χώρου, ή `null` (κανένα · άκυρο · αποτυχία ανάγνωσης). */
async function currentIssuerLogo(companyId: string): Promise<BrandLogoRef | null> {
  try {
    return brandLogoRefOf(await readCompanyBrandLogo(companyId));
  } catch (error) {
    logger.warn('Issuer logo read failed', { companyId, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/** Ο εκδότης με τα πεδία του server **όπως είναι σήμερα** — καθαρή σύνθεση, δεν γράφει. */
export async function liveInvoiceIssuer(issuer: InvoiceIssuer, source: LiveIssuerSource): Promise<InvoiceIssuer> {
  const [bankAccounts, logo] = await Promise.all([
    resolveInvoicePaymentAccounts(source.readAccounts, source.subject, issuer.name),
    currentIssuerLogo(source.companyId),
  ]);
  return { ...issuer, bankAccounts, logo };
}
