'use client';

import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { Invoice } from '@/subapps/accounting/types';
import { formatAccountingCurrency, formatAccountingDate } from '../../../utils/format';

import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import { cn } from '@/lib/utils';

interface InvoiceSummaryCardProps {
  invoice: Invoice;
}

export function InvoiceSummaryCard({ invoice }: InvoiceSummaryCardProps) {
  const { t } = useTranslation(['accounting', 'accounting-setup', 'accounting-tax-offices']);
  const colors = useSemanticColors();
  const isCancelled = invoice.mydata.status === 'cancelled';

  return (
    <Card className={cn(isCancelled && 'opacity-60')}>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Customer */}
          <section>
            <h3 className={cn("text-sm font-medium mb-2", colors.text.muted)}>{t('invoices.customer')}</h3>
            <p className="font-medium">{invoice.customer.name}</p>
            {invoice.customer.vatNumber && (
              <p className={cn("text-sm", colors.text.muted)}>ΑΦΜ: {invoice.customer.vatNumber}</p>
            )}
            {invoice.customer.address && (
              <p className={cn("text-sm", colors.text.muted)}>
                {invoice.customer.address}, {invoice.customer.city} {invoice.customer.postalCode}
              </p>
            )}
          </section>

          {/* Right: Status & Dates */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <span className={cn("text-sm", colors.text.muted)}>{t('invoices.issueDate')}</span>
              <span className="text-sm">{formatAccountingDate(invoice.issueDate)}</span>
            </div>
            {invoice.dueDate && (
              <div className="flex items-center justify-between">
                <span className={cn("text-sm", colors.text.muted)}>{t('invoices.dueDate')}</span>
                <span className="text-sm">{formatAccountingDate(invoice.dueDate)}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className={cn("text-sm", colors.text.muted)}>{t('invoices.paymentStatus')}</span>
              <Badge>{t(`invoices.paymentStatuses.${invoice.paymentStatus}`)}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className={cn("text-sm", colors.text.muted)}>{t('invoices.mydataStatus')}</span>
              <Badge variant="outline">{t(`invoices.mydataStatuses.${invoice.mydata.status}`)}</Badge>
            </div>
          </section>
        </div>

        <Separator className="my-4" />

        {/* Totals */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className={cn("text-xs", colors.text.muted)}>{t('invoices.netAmount')}</p>
            <p className="text-lg font-medium">{formatAccountingCurrency(invoice.totalNetAmount)}</p>
          </div>
          <div>
            <p className={cn("text-xs", colors.text.muted)}>{t('invoices.vatAmount')}</p>
            <p className="text-lg font-medium">{formatAccountingCurrency(invoice.totalVatAmount)}</p>
          </div>
          <div>
            <p className={cn("text-xs", colors.text.muted)}>{t('invoices.grossAmount')}</p>
            <p className="text-lg font-bold">{formatAccountingCurrency(invoice.totalGrossAmount)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
