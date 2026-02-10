'use client';

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { InvoiceLineItem } from '@/subapps/accounting/types';
import { formatCurrency } from '../../../utils/format';

interface InvoicePreviewProps {
  totals: {
    totalNetAmount: number;
    totalVatAmount: number;
    totalGrossAmount: number;
  };
  lineItems: InvoiceLineItem[];
}

export function InvoicePreview({ totals, lineItems }: InvoicePreviewProps) {
  const { t } = useTranslation('accounting');

  // Group VAT by rate
  const vatByRate = new Map<number, number>();
  for (const item of lineItems) {
    const net = item.quantity * item.unitPrice;
    const vat = Math.round(net * (item.vatRate / 100) * 100) / 100;
    vatByRate.set(item.vatRate, (vatByRate.get(item.vatRate) ?? 0) + vat);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('forms.preview')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('invoices.netAmount')}</span>
            <span className="font-medium">{formatCurrency(totals.totalNetAmount)}</span>
          </div>

          {Array.from(vatByRate.entries()).map(([rate, amount]) => (
            <div key={rate} className="flex justify-between text-sm">
              <span className="text-muted-foreground">ΦΠΑ {rate}%</span>
              <span className="font-medium">{formatCurrency(amount)}</span>
            </div>
          ))}

          <Separator />

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('forms.totalVat')}</span>
            <span className="font-medium">{formatCurrency(totals.totalVatAmount)}</span>
          </div>

          <Separator />

          <div className="flex justify-between text-lg font-bold">
            <span>{t('forms.grandTotal')}</span>
            <span>{formatCurrency(totals.totalGrossAmount)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
