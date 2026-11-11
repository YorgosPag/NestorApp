/**
 * Οι οδηγίες πληρωμής της δημόσιας σελίδας (ADR-ACC-018 §16): ένα EPC QR **ανά λογαριασμό**, με το **υπόλοιπο**,
 * και κάθε στοιχείο με αντιγραφή. Η αιτιολογία είναι η ίδια με το PDF (RF ή «σειρά-αριθμός»), ώστε η πληρωμή να
 * αντιστοιχίζεται αυτόματα (ADR-ACC-018 §15).
 *
 * Πολλοί λογαριασμοί ⇒ καρτέλες. Ο προεπιλεγμένος είναι πρώτος, γιατί η σειρά έρχεται έτοιμη από τον κριτή
 * `selectInvoicePaymentAccounts`.
 *
 * @module components/shared/pages/invoice-payment/InvoicePublicPaymentSection
 */

'use client';

import React from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { formatCreditorReference } from '@/subapps/accounting/services/payments/creditor-reference';
import type { InvoicePublicPayment, InvoicePublicPaymentAccount } from '@/subapps/accounting/types/invoice-public-view';
import { formatAccountingCurrency } from '@/subapps/accounting/utils/format';
import { formatIBAN } from '@/types/contacts/banking';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import { CopyField, INVOICE_PUBLIC_PAYMENT_NS, PaymentQrSymbol } from './invoice-payment-primitives';

interface AccountPanelProps {
  readonly account: InvoicePublicPaymentAccount;
  readonly payment: InvoicePublicPayment;
  readonly amountDue: number;
}

function AccountPanel({ account, payment, amountDue }: AccountPanelProps): React.ReactElement {
  const { t } = useTranslation(INVOICE_PUBLIC_PAYMENT_NS);
  const colors = useSemanticColors();
  const reference = payment.creditorReference ? formatCreditorReference(payment.creditorReference) : payment.remittance;
  return (
    <article className="grid gap-6 md:grid-cols-[auto_1fr] md:items-start">
      <figure className="flex flex-col items-center gap-2">
        {account.epcQrPayload
          ? <PaymentQrSymbol payload={account.epcQrPayload} label={t('pay.qrAlt', { bank: account.bankName })} />
          : <p className={cn('max-w-44 text-center text-xs', colors.text.muted)}>{t('pay.noQr')}</p>}
        {account.epcQrPayload && (
          <figcaption className="max-w-44 text-center">
            <span className="block text-sm font-medium">{t('pay.scanTitle')}</span>
            <span className={cn('block text-xs', colors.text.muted)}>{t('pay.scanHint')}</span>
          </figcaption>
        )}
      </figure>
      <dl className="grid min-w-0 grid-cols-1 gap-x-4 gap-y-1">
        <CopyField label={t('pay.beneficiary')} display={account.beneficiary} />
        <CopyField label={t('pay.iban')} display={formatIBAN(account.iban)} value={account.iban} emphasis />
        {account.bic && <CopyField label={t('pay.bic')} display={account.bic} />}
        <CopyField label={t('pay.bank')} display={account.bankName} />
        <CopyField label={t('pay.amount')} display={formatAccountingCurrency(amountDue)} value={amountDue.toFixed(2)} emphasis />
        <CopyField label={t('pay.reference')} display={reference} value={payment.remittance} emphasis />
      </dl>
    </article>
  );
}

interface InvoicePublicPaymentSectionProps {
  readonly payment: InvoicePublicPayment;
  readonly amountDue: number;
}

export function InvoicePublicPaymentSection({ payment, amountDue }: InvoicePublicPaymentSectionProps): React.ReactElement {
  const { t } = useTranslation(INVOICE_PUBLIC_PAYMENT_NS);
  const colors = useSemanticColors();
  const [first] = payment.accounts;
  return (
    <section aria-labelledby="invoice-pay-title" className="space-y-4 rounded-lg border p-4">
      <h2 id="invoice-pay-title" className="text-base font-semibold">{t('pay.title')}</h2>
      {payment.accounts.length === 1 && first
        ? <AccountPanel account={first} payment={payment} amountDue={amountDue} />
        : (
          <Tabs defaultValue={payment.accounts[0]?.iban}>
            <TabsList aria-label={t('pay.accountsLabel')}>
              {payment.accounts.map((account) => (
                <TabsTrigger key={account.iban} value={account.iban}>{account.bankName}</TabsTrigger>
              ))}
            </TabsList>
            {payment.accounts.map((account) => (
              <TabsContent key={account.iban} value={account.iban}>
                <AccountPanel account={account} payment={payment} amountDue={amountDue} />
              </TabsContent>
            ))}
          </Tabs>
        )}
      <p className={cn('text-xs', colors.text.muted)}>{t('pay.referenceHint')}</p>
    </section>
  );
}
