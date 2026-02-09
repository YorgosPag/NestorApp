'use client';

import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { Invoice } from '@/subapps/accounting/types';

interface InvoiceSummaryCardProps {
  invoice: Invoice;
}

export function InvoiceSummaryCard({ invoice }: InvoiceSummaryCardProps) {
  const { t } = useTranslation('accounting');

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(amount);

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
      new Date(iso)
    );

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Customer */}
          <section>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">{t('invoices.customer')}</h3>
            <p className="font-medium">{invoice.customer.name}</p>
            {invoice.customer.vatNumber && (
              <p className="text-sm text-muted-foreground">ΑΦΜ: {invoice.customer.vatNumber}</p>
            )}
            {invoice.customer.address && (
              <p className="text-sm text-muted-foreground">
                {invoice.customer.address}, {invoice.customer.city} {invoice.customer.postalCode}
              </p>
            )}
          </section>

          {/* Right: Status & Dates */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('invoices.issueDate')}</span>
              <span className="text-sm">{formatDate(invoice.issueDate)}</span>
            </div>
            {invoice.dueDate && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('invoices.dueDate')}</span>
                <span className="text-sm">{formatDate(invoice.dueDate)}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('invoices.paymentStatus')}</span>
              <Badge>{t(`invoices.paymentStatuses.${invoice.paymentStatus}`)}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('invoices.mydataStatus')}</span>
              <Badge variant="outline">{t(`invoices.mydataStatuses.${invoice.mydata.status}`)}</Badge>
            </div>
          </section>
        </div>

        <Separator className="my-4" />

        {/* Totals */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-muted-foreground">{t('invoices.netAmount')}</p>
            <p className="text-lg font-medium">{formatCurrency(invoice.totalNetAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('invoices.vatAmount')}</p>
            <p className="text-lg font-medium">{formatCurrency(invoice.totalVatAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('invoices.grossAmount')}</p>
            <p className="text-lg font-bold">{formatCurrency(invoice.totalGrossAmount)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
