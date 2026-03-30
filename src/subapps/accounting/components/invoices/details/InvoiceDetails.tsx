'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { ArrowLeft, ClipboardCheck, Ban, FileX2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/hooks/useAuth';
import { API_ROUTES } from '@/config/domain-constants';
import type { Invoice } from '@/subapps/accounting/types';
import { useCompanySetup } from '@/subapps/accounting/hooks/useCompanySetup';
import { InvoiceSummaryCard } from './InvoiceSummaryCard';
import { InvoiceActionsMenu } from './InvoiceActionsMenu';
import { SendInvoiceEmailDialog } from './SendInvoiceEmailDialog';
import { CancelInvoiceDialog } from './CancelInvoiceDialog';
import { Badge } from '@/components/ui/badge';

import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import { cn } from '@/lib/utils';

interface InvoiceDetailsProps {
  invoiceId: string;
  onBack: () => void;
}

export function InvoiceDetails({ invoiceId, onBack }: InvoiceDetailsProps) {
  const { t } = useTranslation('accounting');
  const colors = useSemanticColors();
  const router = useRouter();
  const { user } = useAuth();
  const { profile: companyProfile } = useCompanySetup();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const fetchInvoice = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(API_ROUTES.ACCOUNTING.INVOICES.BY_ID(invoiceId), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setInvoice(json.data ?? null);
      }
    } catch {
      // Error handled by empty state
    } finally {
      setLoading(false);
    }
  }, [user, invoiceId]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="large" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-12">
        <p className={colors.text.muted}>Invoice not found</p>
        <Button variant="outline" onClick={onBack} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-xl font-bold">
              {invoice.series}-{invoice.number}
            </h2>
            <p className={cn("text-sm", colors.text.muted)}>{t(`invoices.types.${invoice.type}`)}</p>
          </div>
        </div>
        <InvoiceActionsMenu
          invoice={invoice}
          onRefresh={fetchInvoice}
          companyProfile={companyProfile}
          onSendEmail={() => setEmailDialogOpen(true)}
          onEdit={() => router.push(`/accounting/invoices/${invoiceId}/edit`)}
          onCancel={() => setCancelDialogOpen(true)}
        />
      </header>

      {/* Cancelled banner — SAP/NetSuite enterprise pattern */}
      {invoice.mydata.status === 'cancelled' && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950">
          <Ban className="h-5 w-5 text-red-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              {t('cancelDialog.cancelledBanner')}
            </p>
            {invoice.cancellationReason && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                {t(`cancelDialog.reasons.${invoice.cancellationReason}`)}
                {invoice.cancellationNotes ? ` — ${invoice.cancellationNotes}` : ''}
              </p>
            )}
          </div>
          <Badge variant="destructive">{t('invoices.mydataStatuses.cancelled')}</Badge>
        </div>
      )}

      {/* Credit note link — bidirectional (ADR A-1) */}
      {invoice.creditNoteInvoiceId && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <FileX2 className="h-4 w-4 text-blue-600 shrink-0" />
          <p className="text-sm text-blue-800 flex-1">
            {t('cancelDialog.creditNoteLink')}
          </p>
          <Link
            href={`/accounting/invoices?view=${invoice.creditNoteInvoiceId}`}
            className="text-sm font-medium text-blue-700 underline whitespace-nowrap hover:text-blue-900"
          >
            {t('cancelDialog.viewCreditNote')} →
          </Link>
        </div>
      )}

      {/* Related invoice link (for credit notes pointing back to original) */}
      {invoice.type === 'credit_invoice' && invoice.relatedInvoiceId && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <FileX2 className="h-4 w-4 text-blue-600 shrink-0" />
          <p className="text-sm text-blue-800 flex-1">
            {t('cancelDialog.originalInvoiceLink')}
          </p>
          <Link
            href={`/accounting/invoices?view=${invoice.relatedInvoiceId}`}
            className="text-sm font-medium text-blue-700 underline whitespace-nowrap hover:text-blue-900"
          >
            {t('cancelDialog.viewOriginal')} →
          </Link>
        </div>
      )}

      <InvoiceSummaryCard invoice={invoice} />

      <SendInvoiceEmailDialog
        invoice={invoice}
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        onSuccess={fetchInvoice}
      />

      <CancelInvoiceDialog
        invoice={invoice}
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        onSuccess={fetchInvoice}
      />

      {/* APY Certificate shortcut — ADR-ACC-020 */}
      {invoice.withholdingAmount != null && invoice.withholdingAmount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <ClipboardCheck className="h-4 w-4 text-blue-600 shrink-0" />
          <p className="text-sm text-blue-800 flex-1">
            Αυτό το τιμολόγιο έχει παρακράτηση{' '}
            <strong>
              {invoice.withholdingRate ?? ''}% (
              {(invoice.withholdingAmount).toLocaleString('el-GR', {
                style: 'currency',
                currency: 'EUR',
              })}
              )
            </strong>
            .
          </p>
          <Link
            href="/accounting/apy-certificates"
            className="text-sm font-medium text-blue-700 underline whitespace-nowrap hover:text-blue-900"
          >
            Βεβαιώσεις Παρακράτησης →
          </Link>
        </div>
      )}

      {/* Line Items */}
      <section className="border border-border rounded-lg p-4">
        <h3 className="font-medium mb-3">{t('invoices.type')}</h3>
        <div className="space-y-2">
          {invoice.lineItems.map((item) => (
            <div
              key={item.lineNumber}
              className="flex items-center justify-between py-2 border-b border-border last:border-0"
            >
              <div className="flex-1">
                <p className="text-sm font-medium">{item.description}</p>
                <p className={cn("text-xs", colors.text.muted)}>
                  {item.quantity} × {item.unit} @ €{item.unitPrice.toFixed(2)} | ΦΠΑ {item.vatRate}%
                </p>
              </div>
              <span className="font-medium">
                €{item.netAmount.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
