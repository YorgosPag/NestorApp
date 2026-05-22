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
import { createStaleCache } from '@/lib/stale-cache';
import { cn } from '@/lib/utils';

const invoiceDetailsCache = createStaleCache<Invoice>('accounting-invoice-detail-view');

interface InvoiceDetailsProps {
  invoiceId: string;
  onBack: () => void;
}

export function InvoiceDetails({ invoiceId, onBack }: InvoiceDetailsProps) {
  const { t } = useTranslation(['accounting', 'accounting-setup', 'accounting-tax-offices']);
  const colors = useSemanticColors();
  const router = useRouter();
  const { user } = useAuth();
  const { profile: companyProfile } = useCompanySetup();

  const [invoice, setInvoice] = useState<Invoice | null>(invoiceDetailsCache.get(invoiceId) ?? null);
  const [loading, setLoading] = useState(!invoiceDetailsCache.hasLoaded(invoiceId));
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const fetchInvoice = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    if (!invoiceDetailsCache.hasLoaded(invoiceId)) setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(API_ROUTES.ACCOUNTING.INVOICES.BY_ID(invoiceId), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        const data: Invoice | null = json.data ?? null;
        if (data) invoiceDetailsCache.set(data, invoiceId);
        setInvoice(data);
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
        <div className="flex items-center gap-3 rounded-lg border border-destructive bg-destructive/10 px-4 py-3">
          <Ban className="h-5 w-5 text-destructive shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-destructive">
              {t('cancelDialog.cancelledBanner')}
            </p>
            {invoice.cancellationReason && (
              <p className="text-xs text-destructive/80 mt-0.5">
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
        <div className="flex items-center gap-3 rounded-lg border border-ring bg-[hsl(var(--bg-info))]/20 px-4 py-3">
          <FileX2 className="h-4 w-4 text-primary shrink-0" />
          <p className="text-sm text-foreground flex-1">
            {t('cancelDialog.creditNoteLink')}
          </p>
          <Link
            href={`/accounting/invoices?view=${invoice.creditNoteInvoiceId}`}
            className="text-sm font-medium text-primary underline whitespace-nowrap hover:text-primary/80"
          >
            {t('cancelDialog.viewCreditNote')} →
          </Link>
        </div>
      )}

      {/* Related invoice link (for credit notes pointing back to original) */}
      {invoice.type === 'credit_invoice' && invoice.relatedInvoiceId && (
        <div className="flex items-center gap-3 rounded-lg border border-ring bg-[hsl(var(--bg-info))]/20 px-4 py-3">
          <FileX2 className="h-4 w-4 text-primary shrink-0" />
          <p className="text-sm text-foreground flex-1">
            {t('cancelDialog.originalInvoiceLink')}
          </p>
          <Link
            href={`/accounting/invoices?view=${invoice.relatedInvoiceId}`}
            className="text-sm font-medium text-primary underline whitespace-nowrap hover:text-primary/80"
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
        <div className="flex items-center gap-3 rounded-lg border border-ring bg-[hsl(var(--bg-info))]/20 px-4 py-3">
          <ClipboardCheck className="h-4 w-4 text-primary shrink-0" />
          <p className="text-sm text-foreground flex-1">
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
            className="text-sm font-medium text-primary underline whitespace-nowrap hover:text-primary/80"
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
