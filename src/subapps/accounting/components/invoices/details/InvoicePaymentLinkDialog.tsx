'use client';

/**
 * Ο διάλογος «Σύνδεσμος πληρωμής» ενός τιμολογίου (ADR-ACC-018 §16).
 *
 * Δεν είναι νέος διάλογος. Είναι ο ΕΝΑΣ διάλογος συνδέσμων της πλατφόρμας (`UnifiedShareDialog`) με είδος
 * `invoice_payment`: δημιουργία + αντιγραφή στο ίδιο κλικ, λίστα ενεργών συνδέσμων, ανάκληση. Η πολιτική του
 * είδους (χωρίς κωδικό, λήξη 30 ημερών) έρχεται από το `SHARE_KIND_LINK_POLICY`, την ίδια που επιβάλλει ο
 * διακομιστής.
 *
 * Φορτώνεται δυναμικά, μόνο όταν ανοίξει, όπως στις ρυθμίσεις περιήγησης.
 */

import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';

import type { Invoice } from '@/subapps/accounting/types';

const UnifiedShareDialog = dynamic(
  () => import('@/components/sharing/UnifiedShareDialog').then((module) => ({ default: module.UnifiedShareDialog })),
  { ssr: false },
);

interface InvoicePaymentLinkDialogProps {
  readonly invoice: Invoice;
  readonly companyId: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function InvoicePaymentLinkDialog({ invoice, companyId, open, onOpenChange }: InvoicePaymentLinkDialogProps) {
  const { t } = useTranslation('accounting');
  if (!open) return null;
  return (
    <UnifiedShareDialog
      open={open}
      onOpenChange={onOpenChange}
      entityType="invoice_payment"
      entityId={invoice.invoiceId}
      entityTitle={t('invoices.paymentLink.dialogTitle', { number: `${invoice.series}-${invoice.number}` })}
      entitySubtitle={invoice.customer.name}
      companyId={companyId}
    />
  );
}
